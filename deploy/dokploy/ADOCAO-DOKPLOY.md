# Adoção da stack Lumen+ pelo Dokploy

Procedimento para o Dokploy assumir a stack que hoje roda manualmente na VPS,
**preservando o volume já populado**.

Nada aqui foi executado. O documento existe para ser conferido antes.

---

## Estado atual (capturado em 06/09/2026)

### Containers da stack manual

| Container | Imagem | Estado |
|---|---|---|
| `lumenplus-api-1` | `lumenplus-api:current` | Up, healthy |
| `lumenplus-postgres-1` | `postgres:18.6` | Up, healthy |

Ambos com `com.docker.compose.project = lumenplus`.

### Volume definitivo — **não recriar**

| | |
|---|---|
| Nome | `lumenplus_postgres_data` |
| Driver | `local` |
| CreatedAt | `2026-09-06T08:09:17+02:00` |
| Mountpoint | `/var/lib/docker/volumes/lumenplus_postgres_data/_data` |
| Destino no container | `/var/lib/postgresql` |
| Tamanho | ~70 MB |

O `CreatedAt` é o critério de prova da adoção: se depois do deploy pelo
Dokploy ele mudar, o volume foi recriado e os dados restaurados se perderam.

### Baseline do banco

```
tabelas       58
linhas       623
índices      160
constraints  441
colunas      500
alembic      046_community_guidelines
```

---

## Como o Dokploy nomeia os containers

O Dokploy **sobrescreve** o campo `name:` do compose com o `appName` que ele
gera, passando `docker compose -p <appName>`. Prova: o arquivo do Precatórios
declara `name: precatorios`, mas os containers rodam como
`precatrios-1mrted-app-1`, com `com.docker.compose.project = precatrios-1mrted`.

Consequência prática: depois da adoção os containers **não** se chamarão
`lumenplus-api-1`. Serão `<appName>-api-1` e `<appName>-postgres-1`. Isso é
esperado e não é problema — o que precisa ser preservado é o **volume**, e ele
é `external` com nome fixo, então independe do nome do projeto.

---

## Colisão de Traefik — por que a ordem não é negociável

Este é o ponto de risco real da adoção, e são **dois** riscos, não um.

### Risco 1 — dois Postgres sobre o mesmo volume

Se a stack do Dokploy subir com a manual ainda de pé, dois containers Postgres
montam `lumenplus_postgres_data` ao mesmo tempo. O Postgres se protege com o
`postmaster.pid`, então o segundo tende a recusar iniciar em vez de corromper
— mas depender dessa proteção é aceitar um risco que não precisa existir.

### Risco 2 — dois routers com o mesmo nome e o mesmo Host

Os dois compose declaram os mesmos nomes de router (`lumenplus`,
`lumenplus-insecure`) e a mesma regra `Host(...)`. Com ambos de pé, o Traefik
vê duas definições do mesmo router e dois backends para o mesmo serviço:
requisições passariam a alternar entre a API antiga e a nova, de forma não
determinística. Como as duas apontam para bancos diferentes durante a
transição, o usuário veria respostas inconsistentes.

### Como eliminar a janela

**Parar a stack manual ANTES de fazer deploy pelo Dokploy.** Não há
sobreposição possível: enquanto a manual estiver de pé, não se clica em Deploy.

O comando de parada usa `stop`, nunca `down -v`:

```bash
ssh contabo-andrade 'cd /etc/dokploy/compose/lumenplus/code && docker compose stop'
```

`docker compose stop` para os containers e **não toca em volume nem em rede**.
`docker compose down` removeria a rede; `down -v` removeria o volume — este
último apagaria os 623 registros restaurados. Não usar.

A indisponibilidade é o intervalo entre esse `stop` e o Dokploy terminar o
deploy — tipicamente menos de um minuto, e **hoje isso não afeta ninguém**,
porque o tráfego real ainda está na Railway. É por isso que a adoção deve
acontecer **antes** do cutover, e não depois.

---

## Sequência de adoção

Nenhum passo aqui foi executado.

### 1 — Criar na UI do Dokploy

```
Project:          Lumen+
Environment:      production
Compose service:  lumenplus
Provider:         Raw / Docker Compose
```

### 2 — Colar o compose

Conteúdo de `deploy/dokploy/docker-compose.yml`, sem alteração.

### 3 — Colar o Environment

Os 21 nomes listados abaixo, com os valores. **Não marcar "Fresh Volumes".**

### 4 — Parar a stack manual

```bash
ssh contabo-andrade 'cd /etc/dokploy/compose/lumenplus/code && docker compose stop'
ssh contabo-andrade 'docker ps --filter name=lumenplus --format "{{.Names}} {{.Status}}"'
```

A segunda linha deve não retornar nada. Confirmar antes de seguir.

### 5 — Deploy pelo Dokploy

Botão Deploy na UI.

### 6 — Validar a adoção

```bash
ssh contabo-andrade '
  echo "--- CreatedAt do volume (deve ser 2026-09-06T08:09:17+02:00) ---"
  docker volume inspect lumenplus_postgres_data --format "{{.CreatedAt}}"
  echo "--- exatamente uma API e um Postgres ---"
  docker ps --format "{{.Names}}" | grep -cE "api-1$"
  docker ps --format "{{.Names}}" | grep -cE "postgres-1$"
  echo "--- quem monta o volume ---"
  docker ps --filter volume=lumenplus_postgres_data --format "{{.Names}}"
'
```

Critérios:

- `CreatedAt` **inalterado** — prova de que o volume não foi recriado
- exatamente **um** container de API do Lumen+ e **um** Postgres
- o Postgres que monta o volume é o novo, do Dokploy

### 7 — Validar dados e HTTPS

```bash
curl -s https://lumenplus.andradesystems.com.br/health/ready
```

Esperado: `{"status":"ready","database":"ok"}`.

E a impressão digital contra a Railway, exigindo **diff zero** — mesmo
procedimento já executado duas vezes, em `CUTOVER.md`.

### 8 — Limpeza (só depois de tudo validado)

O diretório manual `/etc/dokploy/compose/lumenplus/code/` fica órfão. **Não
apagar antes do cutover**: o `.env` dele é a única cópia local do Environment
até que a UI do Dokploy esteja confirmada como fonte autoritativa.

---

## Environment — 21 nomes

A partir daqui a **UI do Dokploy é a fonte autoritativa** para redeploys.

### Banco (gerados na VPS, não copiados da Railway)

```
POSTGRES_DB
POSTGRES_USER
POSTGRES_PASSWORD
DATABASE_URL
```

### Identidade e segredos (copiados da Railway sem alteração)

```
ENVIRONMENT
AUTH_MODE
SECRET_KEY
ENCRYPTION_KEY
HMAC_PEPPER
FIREBASE_PROJECT_ID
```

`ENCRYPTION_KEY` e `HMAC_PEPPER` não podem ser regenerados: o primeiro decifra
campos sensíveis já gravados, o segundo valida hashes já persistidos.

### Rede e pool

```
CORS_ORIGINS
DATABASE_POOL_SIZE
DATABASE_MAX_OVERFLOW
PORT
```

### Flags (fail-closed)

```
ENABLE_DEV_ENDPOINTS
DEBUG_VERIFICATION_CODE
```

### Web Push

```
VAPID_PUBLIC_KEY
VAPID_PRIVATE_KEY
VAPID_EMAIL
```

### E-mail

```
SENDGRID_FROM_EMAIL
SENDGRID_FROM_NAME
```

### Completude — conferido contra `/root/lumen-migracao/.env.api`

| | |
|---|---|
| `.env.api` (ensaio) | 19 nomes |
| `.env` definitivo | 21 nomes |
| Em comum | 18 |
| Só no ensaio | `REDIS_URL` — removido por decisão; sem Redis o rate limit usa o fallback em memória |
| Só no definitivo | `POSTGRES_DB`, `POSTGRES_USER`, `POSTGRES_PASSWORD` — o serviço de banco é nosso agora |

**O Environment está completo.** A única variável do ensaio que não migra saiu
de propósito, e as três acrescentadas existem porque a Railway fornecia o banco
como serviço gerenciado e agora ele faz parte da stack.

### Ausentes de propósito

Confirmado por varredura dos 6 serviços nos 2 ambientes da Railway, mais o
escopo compartilhado. Acrescentar qualquer um mudaria comportamento durante o
cutover:

```
CLOUDINARY_CLOUD_NAME / CLOUDINARY_API_KEY / CLOUDINARY_API_SECRET
SENDGRID_API_KEY
SENTRY_DSN
METRICS_TOKEN
REDIS_URL
LOG_LEVEL            (default INFO)
TRUSTED_PROXY_HOPS   (default 1 — correto para 1 proxy)
```
