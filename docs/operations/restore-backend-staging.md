# Runbook — restaurar o `backend-staging` (403 no edge)

**Quando usar:** `https://backend-staging.up.railway.app/*` responde **403** e a
Sprint 7 (carga) está bloqueada.

## Classificação do 403 (o que é fato vs. hipótese)

### COMPROVADO (medido em 2026-07-24, sem Railway)
- O 403 vem **antes** do FastAPI: resposta traz `Server: railway-hikari`,
  `x-powered-by: Express`, `x-railway-edge: mia1` — assinatura do **edge do Railway**.
- **Nenhum** path chega à aplicação: `/health`, `/health/live`, `/openapi.json`,
  `/` — todos 403 com corpo `Forbidden` (9 bytes).
- Produção se comporta **diferente**: mesmo edge (`railway-hikari`), mas **200** e
  corpo JSON do FastAPI (`{"status":"healthy",...}`) — logo o app de produção é
  alcançado; o de staging não.

### INFERÊNCIA (a confirmar com acesso ao Railway — NÃO afirmar como causa)
Possíveis causas do edge devolver 403 sem upstream:
- ausência de **deployment ativo** (serviço sem deploy / crashado / removido);
- **domínio** não vinculado ao serviço atual;
- serviço **pausado**;
- **routing/branch** incorreto;
- restrição de borda (proteção de acesso).

> Não declare qual é a causa até checar no painel. Este runbook checa cada uma.

## Pré-requisito: autenticar (Ação humana)

```bash
railway login
```

Confirme no navegador e volte ao terminal. **Não** copie tokens/secrets para lugar
nenhum.

## Passos de diagnóstico e correção

Para cada passo: **resultado esperado**, **possível erro**, **ação**, **risco**.

### 1. Selecionar projeto e serviço
```bash
railway status
railway service            # selecionar backend-staging
```
- **Esperado:** projeto `lumen+`, ambiente `staging`, serviço `backend-staging`.
- **Erro possível:** serviço não listado → foi removido. **Ação:** recriar a partir
  do repo (branch `staging` ou `main`). **Risco:** médio (recriação).

### 2. Verificar deployments
Railway → `backend-staging` → **Deployments**.
- **Esperado:** um deployment `Active`/`Success` recente.
- **Erro:** nenhum ativo, ou `Crashed`/`Removed`. **Ação:** ver logs (passo 6);
  se crash de boot, corrigir env (passo 5) e **Redeploy**. **Risco:** baixo.

### 3. Verificar domínio (Settings → Networking)
- **Esperado:** `backend-staging.up.railway.app` vinculada a ESTE serviço.
- **Erro:** domínio órfão / apontando para serviço errado. **Ação:** revincular.
  **Risco:** baixo. Um domínio sem upstream é a causa clássica de 403 no edge.

### 4. Verificar branch / start command / porta / healthcheck (Settings)
- **Branch:** a de staging (confirmar qual — `main` ou `staging`).
- **Start command:** deve rodar o mesmo `start.sh`/uvicorn da produção.
- **Porta:** o serviço deve escutar em `$PORT` (Railway injeta).
- **Healthcheck path:** usar **`/health/live`** (não `/health/ready`) — ver nota abaixo.
- **Erro:** start command aponta para script inexistente / porta fixa. **Ação:**
  corrigir. **Risco:** baixo.

### 5. Verificar variáveis de ambiente (sem imprimir secrets)
Confirmar presença (não valor) de: `DATABASE_URL` (→ `Postgres-mFan`, o **de
staging**, nunca o de produção), `REDIS_URL` (Redis de staging), `ENVIRONMENT`,
`AUTH_MODE`, `ENCRYPTION_KEY`, `HMAC_PEPPER`, `SECRET_KEY`, `FIREBASE_PROJECT_ID`.
- **Nota crítica:** `ENVIRONMENT` deve ser exatamente `staging` (o Literal aceita
  `dev|staging|production|test` — `prod` faz o boot falhar). Se `is_production`
  não for o esperado, `validate_production_settings` pode abortar o boot.
- **Erro:** falta `ENCRYPTION_KEY`/`HMAC_PEPPER`/`FIREBASE_PROJECT_ID` em produção
  → boot aborta (fatal). **Ação:** preencher. **Risco:** médio (config).
- **AUTH_MODE:** informar se é `DEV` (tokens `dev:*` aceitos → o seed de carga
  emite tokens sozinho) ou `PROD` (Firebase real → tokens vêm do Firebase).

### 6. Ler logs
```bash
railway logs --service backend-staging
```
- **Esperado:** `application_startup ... environment=staging`.
- **Erro:** `RuntimeError [SEGURANÇA] Configuração inválida` → env faltando (passo 5).
  Nenhum log → a request nem chega ao container (confirma 403 no edge, não no app).

### 7. Redeploy
Após corrigir a causa encontrada: **Deployments → Redeploy** (ou push na branch).
- **Risco:** baixo. **Rollback:** o Railway mantém deployments anteriores —
  reverter para o último `Success` se o novo falhar.

### 8. Smoke pós-deploy
```bash
curl -sS -o /dev/null -w "%{http_code}\n" https://backend-staging.up.railway.app/health/live   # 200
curl -sS -o /dev/null -w "%{http_code}\n" https://backend-staging.up.railway.app/health/ready   # 200
curl -sS -o /dev/null -w "%{http_code}\n" https://backend-staging.up.railway.app/openapi.json    # 200 (dev/staging)
```
- **Esperado:** `/health/live` 200 com `Server: railway-hikari` **e SEM**
  `x-powered-by: Express` (ou seja, chegou ao uvicorn).
- Depois: rodar o script pós-login (`resume_after_railway_login.sh`) e, se tudo
  verde, a suíte de carga (`backend/performance/load/`, alvos `make load-*`).

## Nota — healthcheck deve ser `/health/live`
Aponte o healthcheck do Railway para **`/health/live`** (só o processo), não
`/health/ready` (que checa o banco). Assim uma lentidão de banco não reinicia o
container em cascata. Ver `docs/engineering/observability-resilience.md`.
