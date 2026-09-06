# Cutover Lumen+ — Railway → Contabo

Runbook do corte. **Não executar sem autorização explícita.**

Domínio aprovado: `lumenplus.andradesystems.com.br` — já resolve para
`13.140.36.49` (registro explícito, verificado: um nome aleatório sob o mesmo
domínio não resolve, então não é curinga).

---

## Antes de tudo: os nomes mudam depois da adoção

Este runbook usa `lumenplus-postgres-1` e a rede `lumenplus_internal`, que são
os nomes da stack **manual**. Depois que o Dokploy adotar a stack
(`ADOCAO-DOKPLOY.md`), ele passa a rodar o projeto com o `appName` que gera —
como fez com `precatrios-1mrted` — e os nomes viram `<appName>-postgres-1` e
`<appName>_internal`.

Descobrir os nomes reais antes de executar qualquer passo:

```bash
ssh contabo-andrade '
  docker ps --filter volume=lumenplus_postgres_data --format "container: {{.Names}}"
  docker ps --filter volume=lumenplus_postgres_data --format "{{.Names}}" \
    | xargs -r -n1 docker inspect --format "rede: {{range \$k,\$v := .NetworkSettings.Networks}}{{\$k}} {{end}}"
'
```

O que **não** muda é o volume: `lumenplus_postgres_data`, `external: true`.

---

## Por que a ordem importa

Duas restrições descobertas em ensaio, não deduzidas:

**O `start.sh` roda `alembic upgrade head` no boot.** Com o volume vazio, a API
criou o schema inteiro do zero antes de qualquer restore. Se a API subir antes
do restore, o `pg_restore` entra num banco que já tem schema e conflita. Por
isso a ordem é sempre **postgres → restore → api**, nunca as três juntas.

**Duas instâncias contra o mesmo banco podem migrar ao mesmo tempo.** Enquanto
a Railway estiver servindo, a VPS não pode apontar para o banco dela — e não
aponta: o `DATABASE_URL` do Environment usa o host interno `postgres:5432`.

---

## Pré-condições (todas já satisfeitas)

| | |
|---|---|
| Volume externo | `lumenplus_postgres_data` criado, montado em `/var/lib/postgresql` |
| Imagem | `lumenplus-api:current` — Python 3.11.16, psycopg 3.2.3 |
| Environment | `/etc/dokploy/compose/lumenplus/code/.env`, modo 600, 21 variáveis, zero referência à Railway |
| Traefik | certificado Let's Encrypt emitido, HTTP→HTTPS 302 |
| Backup inicial | `/root/lumen-migracao/backups/lumen-prod-20260906T054904Z.dump` — preservado, **não sobrescrever** |

---

## Passo a passo

### 1 — Suspender escrita na Railway

O objetivo é uma janela em que **apenas um lado aceita escrita**. Com 27
usuários, a janela é de minutos.

```bash
railway down --environment production --service backend
```

Alternativa menos abrupta, se preferir manter o serviço de pé: escalar para
zero réplicas pela UI. O que **não** serve é confiar que "ninguém vai usar
agora" — um cadastro que entre depois do dump se perde sem aviso.

Confirme que parou:

```bash
curl -s -o /dev/null -w '%{http_code}\n' https://backend-production-6efc.up.railway.app/health
```

### 2 — Dump final

Roda na VPS, com cliente 18.6 idêntico ao servidor. A URL vai por stdin e
nunca aparece em log nem em `ps`.

```bash
railway variables --environment production --service backend --json \
  | python -c "import sys,json;sys.stdout.write(json.load(sys.stdin)['DATABASE_PUBLIC_URL'])" \
  | ssh contabo-andrade 'IFS= read -r U; umask 077; \
      printf "PGURL=%s\n" "$U" > /root/lumen-migracao/.env.final; \
      D=/root/lumen-migracao/backups/lumen-prod-final-$(date -u +%Y%m%dT%H%M%SZ).dump; \
      docker run --rm --env-file /root/lumen-migracao/.env.final postgres:18.6 \
        sh -c "pg_dump --format=custom --no-owner --no-acl \"\$PGURL\"" > "$D"; \
      echo "exit=$?"; rm -f /root/lumen-migracao/.env.final; \
      echo "$D"; stat -c%s "$D"; sha256sum "$D"'
```

Exigir `exit=0`. Registrar tamanho e sha256.

### 3 — Restore

```bash
ssh contabo-andrade 'cd /etc/dokploy/compose/lumenplus/code && . ./.env && \
  docker compose stop api && \
  docker compose exec -T postgres psql -U "$POSTGRES_USER" -d postgres -q \
    -c "DROP DATABASE IF EXISTS lumen_db WITH (FORCE);" \
    -c "CREATE DATABASE lumen_db OWNER lumen ENCODING UTF8;" && \
  docker run --rm --network lumenplus_internal \
    -v /root/lumen-migracao/backups:/b:ro -e PGPASSWORD="$POSTGRES_PASSWORD" \
    postgres:18.6 pg_restore --no-owner --no-acl --exit-on-error \
      -h lumenplus-postgres-1 -U "$POSTGRES_USER" -d "$POSTGRES_DB" "/b/<DUMP_FINAL>"'
```

### 4 — Validar antes de virar o DNS

Rodar a impressão digital nos dois lados e exigir **diff zero**. É o mesmo
procedimento do ensaio, que já deu diff zero duas vezes.

```bash
ssh contabo-andrade 'diff -u /root/lumen-migracao/fp-origem.txt \
                          /root/lumen-migracao/fp-definitivo.txt && echo "DIFF ZERO"'
```

Confirmar também:

- `ALEMBIC|046_community_guidelines` nos dois lados
- 58 tabelas, mesma soma de linhas
- `docker compose up -d api` → healthy, e **zero** linhas `Running upgrade`
  no log do boot (o dump já traz o head)

### 5 — Subir a API

```bash
ssh contabo-andrade 'cd /etc/dokploy/compose/lumenplus/code && docker compose up -d api'
```

### 6 — Confirmar pelo domínio

```bash
curl -s https://lumenplus.andradesystems.com.br/health/ready
```

Esperado: `{"status":"ready","database":"ok"}`.

---

## Rollback

O rollback **não depende de nova build nem de nova submissão às lojas**, e é
por isso que o app tem de apontar para o domínio próprio desde a primeira
build de produção.

| Momento | Como reverter |
|---|---|
| Antes do passo 5 | Religar o serviço na Railway. A VPS nunca recebeu tráfego; nada a desfazer. |
| Depois do passo 5 | Religar a Railway e apontar o DNS de volta. Manter TTL 300s ajuda. |
| Se o restore falhar | O banco da VPS é descartável — recriar e restaurar de novo. A origem não foi tocada. |

**A Railway permanece de pé e intacta por pelo menos duas semanas.** Não
desligar, não apagar, não remover variáveis. O custo de mantê-la é pequeno
perto do custo de não ter para onde voltar.

Escrita que entrar na Railway depois do dump final **se perde** se o rollback
acontecer depois de usuários já terem escrito na VPS. É o único caminho sem
volta do procedimento, e a razão de a janela ser curta.

---

## Pendências registradas — nenhuma bloqueia o cutover

Todas preservam o comportamento atual, por decisão:

| Item | Estado | Quando resolver |
|---|---|---|
| Cloudinary | Produção não possui `CLOUDINARY_*`; upload de comprovante pode já estar indisponível | Pós-cutover |
| SendGrid | Sem `SENDGRID_API_KEY`; `email_service.py` desiste em silêncio | Pós-cutover |
| Sentry | Sem `SENTRY_DSN` | Pós-cutover |
| `GET /profile/me` | Rota não existe; o caminho real é `GET /profile`. O `ci-provision.sh` chama a errada e trata 404 como aviso | Issue separada |
| Python 3.12 | `pyproject.toml` e mypy declaram 3.12; o runtime é 3.11 | Tarefa própria |
| Redis | Ausente por decisão; rate limit no fallback em memória, por processo | Se escalar réplicas |
| `/openapi.json` | Responde 200 em produção, mesmo com `/docs` fechado | Decisão de produto |
