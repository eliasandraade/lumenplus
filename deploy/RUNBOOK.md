# RUNBOOK — Lumen+ em produção (Contabo / Dokploy)

Estado após a migração full-stack concluída em **06/09/2026**.

---

## Arquitetura

```
                    Internet
                       │
                  Traefik v3.6.7  (dokploy-network, Let's Encrypt)
                       │
        ┌──────────────┴──────────────┐
        │                             │
lumenplus.andradesystems.com.br   api.lumenplus.andradesystems.com.br
        │                             │
   frontend (nginx)              api (FastAPI)
   estático, :80                 :8000
                                      │
                                 rede `internal`
                                      │
                              postgres 18.6  (sem porta publicada)
                                      │
                          volume lumenplus_postgres_data
```

O frontend **não** entra na rede `internal`: é estático e nunca fala com o
banco. Quem chama a API é o navegador do usuário, por HTTPS, de fora.
O Postgres **não** entra na `dokploy-network`: não existe caminho do Traefik
até o banco.

## Domínios

| Domínio | Aponta para | Estado |
|---|---|---|
| `lumenplus.andradesystems.com.br` | frontend nginx na VPS | **oficial** |
| `api.lumenplus.andradesystems.com.br` | FastAPI na VPS | **oficial** |
| `lumenplus.vercel.app` | frontend antigo na Vercel | **não oficial** — aponta para a Railway congelada, quebrado por consequência. Projeto preservado; acesso administrativo é pendência. |
| `lumenmobile.vercel.app` | — | legado, 404 |
| `backend-production-6efc.up.railway.app` | backend Railway | **congelado** — rollback temporário, não reativar |
| `backend-staging-staging-3d47.up.railway.app` | staging Railway | intacto |

Ambos os domínios oficiais resolvem para `13.140.36.49` (A records na GoDaddy,
`ns05`/`ns06.domaincontrol.com`).

## Containers

Projeto Dokploy: **`lumenplus-lumenplus-buaufv`** (o `appName` é gerado pelo
Dokploy e **muda** se o serviço for recriado na UI — não use o nome como
âncora em scripts).

| Container | Imagem | Limites |
|---|---|---|
| `…-frontend-1` | `lumenplus-web:current` | 128 MB · 0,5 CPU |
| `…-api-1` | `lumenplus-api:current` | 512 MB · 1,5 CPU |
| `…-postgres-1` | `postgres:18.6` | 1 GB · 1 CPU |

Uso observado: frontend ~8 MiB, api ~134 MiB, postgres ~42 MiB.

Smoke test por SSH: `127.0.0.1:8081` (api) e `127.0.0.1:8082` (frontend).

## Volume — a âncora estável

```
nome       lumenplus_postgres_data
external   true
montagem   /var/lib/postgresql        ← NÃO /data; a partir do PG 18 a imagem
                                        aborta com "unused mount/volume"
CreatedAt  2026-09-06T08:09:17+02:00  ← histórico; se mudar, o volume foi
                                        recriado e os dados se perderam
```

O `CreatedAt` é o critério de prova em qualquer operação que recrie a stack.
Scripts devem localizar o container **pelo volume**, não pelo nome:

```bash
docker ps --filter volume=lumenplus_postgres_data --format '{{.Names}}'
```

## CORS

`CORS_ORIGINS` (Environment do Dokploy, autoritativo):

```
https://lumenplus.andradesystems.com.br
https://lumenplus.vercel.app
https://lumenmobile.vercel.app
```

Sem aspas: o parser é `split(",")` + `strip()` em `backend/app/settings.py`, e
não trata aspas. Não incluir `api.lumenplus…` — é o domínio da própria API,
não uma origem de frontend.

## Environment

A **UI do Dokploy é a fonte autoritativa**. Ele guarda o Environment cifrado
(`enc:v1:…`) no banco interno e escreve o `.env` no diretório do projeto a cada
Deploy. Editar `/etc/dokploy/compose/…/code/` funciona até o próximo Deploy, que
sobrescreve — nunca use isso como caminho permanente.

Não regenerar `ENCRYPTION_KEY` nem `HMAC_PEPPER`: o primeiro decifra campos
sensíveis já gravados, o segundo valida hashes persistidos.

---

## Backup

### Local — diário às 05:00

`/srv/andrade/lumenplus/scripts/backup.sh`

`pg_dump --format=custom --no-owner --no-acl`, validado com `pg_restore --list`
antes de ser aceito, `chmod 600`, retenção de 14 dias podada **só após sucesso**.
Destino: `/srv/andrade/lumenplus/backups/`.

### Off-site — diário às 05:15

`/srv/andrade/lumenplus/scripts/offsite-backup.sh` → `gdrive-lumen-crypt:`
(crypt sobre `gdrive:lumenplus-backups`), cifrado em trânsito e em repouso,
com nomes de arquivo cifrados.

**Isolamento do PrecGS — a razão do crypt separado:** o script do Portal termina
com `rclone delete "gdrive-crypt:" --min-age 30d`, e `rclone delete` é
recursivo. Backups do Lumen+ num subdiretório daquele crypt seriam apagados
pela retenção do Portal, em silêncio. Por isso o script do Lumen+ tem portão
duro: recusa qualquer destino que não seja exatamente `gdrive-lumen-crypt:`, e
recusa explicitamente `gdrive-crypt:` e qualquer caminho com `precatorios`.

O script revalida o dump antes de enviar, confere a listagem remota, **re-baixa
e compara sha256**, e só então aplica retenção de 30 dias — pulando-a quando há
menos de duas cópias remotas, para nunca existir janela com o off-site vazio.

### Cron

```
30 4 * * *  PrecGS  backup + off-site      ← NÃO ALTERAR
 0 5 * * *  Lumen+  backup local
15 5 * * *  Lumen+  off-site
```

---

## Restore

### De um backup local

```bash
ssh contabo-andrade '
  CONT=$(docker ps --filter volume=lumenplus_postgres_data --format "{{.Names}}")
  # 1. PARAR A API ANTES. O start.sh roda `alembic upgrade head` no boot; com a
  #    API de pé, o restore disputa o banco com as migrations.
  docker stop <appName>-api-1
  docker exec "$CONT" sh -c "PGPASSWORD=\$POSTGRES_PASSWORD psql -U \$POSTGRES_USER -d postgres \
     -c \"DROP DATABASE IF EXISTS lumen_db WITH (FORCE);\" \
     -c \"CREATE DATABASE lumen_db OWNER \$POSTGRES_USER ENCODING UTF8;\""
  docker cp /srv/andrade/lumenplus/backups/<DUMP> "$CONT:/tmp/r.dump"
  docker exec "$CONT" sh -c "PGPASSWORD=\$POSTGRES_PASSWORD pg_restore --no-owner --no-acl \
     --exit-on-error -U \$POSTGRES_USER -d \$POSTGRES_DB /tmp/r.dump"
  docker start <appName>-api-1
'
```

Ordem obrigatória: **postgres → restore → api**. Com o dump já no head, o boot
seguinte aplica **zero** migrations — é o sinal de que deu certo.

### Do off-site (disaster recovery)

```bash
rclone lsf gdrive-lumen-crypt:                       # lista as cópias
rclone copy gdrive-lumen-crypt:<NOME> /tmp/dr/       # baixa
sha256sum /tmp/dr/<NOME>                             # confere
```

Depois, restaurar como acima. **Testado de ponta a ponta em 06/09/2026**:
download do Drive, sha256 idêntico, restore em banco descartável, e impressão
digital byte a byte igual à produção.

---

## Rollback

Ver `deploy/dokploy/ROLLBACK.md`. Em resumo, e com a ressalva que importa:

**Não existe "apontar o DNS de volta".** `lumenplus.andradesystems.com.br`
sempre apontou para a VPS; o domínio nunca esteve na Railway. O caminho é um
arquivo dinâmico no Traefik apontando para o host da Railway, com
`passHostHeader: false` — sem isso o edge dela devolve 404.

E o único caminho sem volta: **escrita que entre na VPS depois do cutover só
existe lá**. Capturar dump ANTES de qualquer rollback, sempre.

Deployment da Railway para redeploy: `60f5004b-7d00-418d-a3ac-c6eec994cc47`.

---

## Dependências externas

| Serviço | Função | Estado |
|---|---|---|
| Firebase | Autenticação | ativo — `FIREBASE_PROJECT_ID` define `aud` e `iss` |
| Cloudinary | Imagens e comprovantes | **sem credencial em produção** — upload de comprovante de retiro pode estar indisponível. Pendência funcional. |
| SendGrid | E-mail | **sem `SENDGRID_API_KEY`** — `email_service.py` desiste em silêncio |
| Sentry | Erros | **sem `SENTRY_DSN`** — desativado |
| BrasilAPI | UF e municípios | público, sem chave |
| `liturgia.up.railway.app` | Liturgia diária | API de terceiro na Railway — sobrevive à migração |
| Google Drive | Off-site | via `gdrive-lumen-crypt` |

As três primeiras ausências foram **preservadas por decisão**, para manter
paridade durante o cutover. São pendências pós-cutover, não regressões.

## Outras pendências registradas

- `GET /profile/me` não existe (o caminho é `GET /profile`); o `ci-provision.sh`
  do E2E chama a rota errada e trata 404 como aviso
- `pyproject.toml` e mypy declaram Python 3.12; o runtime é 3.11
- `/openapi.json` responde 200 em produção mesmo com `/docs` fechado
- Sem Redis: rate limit no fallback em memória, por processo
- Resíduos de ensaio na VPS: containers `lumen-api-teste` e `lumen-pg-teste`
  (isolados na rede `lumen-teste`, sem porta publicada, sem router Traefik) e o
  volume `lumen_pgdata_teste` com cópia dos dados
