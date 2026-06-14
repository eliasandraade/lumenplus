# Lumen+ — Ambiente Staging

**Data de criação:** 2026-06-13  
**Atualizado:** 2026-06-14  
**Status:** Infraestrutura provisionada via CLI — aguardando configuração de GitHub branch e secrets no Railway Dashboard

---

## Infraestrutura atual

| Recurso | Produção | Staging | Status |
|---|---|---|---|
| Railway environment | `production` | `staging` | ✅ criado |
| Railway Postgres | serviço `Postgres` | serviço `Postgres-mFan` | ✅ criado |
| Railway backend | serviço `backend` | serviço `backend-staging` | ⚠️ criado, deploy falhando |
| Vercel frontend | branch `main` → lumenplus.vercel.app | branch `staging` → lumenplus-git-staging-applumenplus-1605s-projects.vercel.app | ✅ env var configurada |
| Firebase Auth | projeto `lumenplus` | mesmo projeto (usuários de teste separados) | — |

### URLs reais

| Serviço | URL |
|---------|-----|
| Backend staging | `https://backend-staging-staging-3d47.up.railway.app` |
| Vercel staging preview | `https://lumenplus-git-staging-applumenplus-1605s-projects.vercel.app` |

---

## Branch Strategy

```
main          → produção (Railway prod + Vercel prod)
staging       → staging  (Railway staging + Vercel staging)
post-rc/*     → feature branches, PR para staging primeiro
```

Fluxo:
1. Desenvolve em `post-rc/<feature>`
2. Abre PR para `staging` → CI roda → merge para `staging`
3. Valida em staging
4. Abre PR de `staging` para `main` → merge → deploy produção

---

## O que foi feito via CLI (2026-06-14)

### Railway (CLI)

```bash
railway environment new staging         # ✅ ambiente staging criado
railway environment staging             # ✅ ambiente ativado

# Postgres-staging
railway add --database postgres         # ✅ criado como "Postgres-mFan"

# backend-staging
railway add --service backend-staging --repo eliasandraade/lumenplus  # ✅ serviço criado
railway domain --service backend-staging   # ✅ domínio: backend-staging-staging-3d47.up.railway.app
```

Variáveis configuradas via CLI (sem secrets):
```
ENVIRONMENT=staging
SENTRY_ENVIRONMENT=staging
AUTH_MODE=PROD
IS_DEV_AUTH=false
ENABLE_DEV_ENDPOINTS=false
DATABASE_URL=${{Postgres-mFan.DATABASE_URL}}   ← referência Railway
SECRET_KEY=<gerado com openssl rand -hex 32>   ← novo, exclusivo do staging
ALLOWED_ORIGINS=https://lumenplus-git-staging-applumenplus-1605s-projects.vercel.app,https://lumenplus.vercel.app
APP_NAME=Lumen+ API
APP_VERSION=0.3.0
LOG_LEVEL=INFO
DEBUG=false
ENABLE_AUDIT=true
ENABLE_PHONE_VERIFICATION=false
ENABLE_EMAIL_VERIFICATION=false
ENABLE_SENSITIVE_ACCESS=false
```

### Vercel (CLI)

```bash
# Em lumen_mobile/
vercel env add EXPO_PUBLIC_API_URL preview staging
# Valor: https://backend-staging-staging-3d47.up.railway.app
# Resultado: ✅ configurado para Preview (staging) apenas — production não alterado
```

### GitHub

```bash
git checkout staging && git merge main --no-edit   # ✅ staging atualizado com main
git push origin staging                             # ✅ branch staging publicada no GitHub
```

---

## Pendências — Railway Dashboard

> Acesso: https://railway.app → Workspace `obralumendeevangelizacao` → Projeto `lumen+` → Environment `staging` → Service `backend-staging`

### 1. Configurar Root Directory (BLOCKER — causa do erro Railpack)

O Railpack falha porque está analisando a raiz do monorepo (`./`) em vez de `backend/`.  
O serviço de produção funciona porque tem `Root Directory: backend` configurado no painel.

```
Railway Dashboard → backend-staging → Settings → Build → Root Directory: backend
```

Sem isso, o Railpack não encontra `Dockerfile` nem detecta Python, e o deploy falha com:
`Railpack could not determine how to build the app.`

### 2. Configurar branch GitHub

O serviço `backend-staging` precisa apontar para a branch `staging` do repositório:

```
Railway Dashboard → backend-staging → Settings → Source → Branch: staging
```

Fazer na mesma tela do passo 1 (Settings → Source).

### 2. Configurar secrets que não podem ser copiados via CLI

Adicionar no serviço `backend-staging` → Variables:

| Variável | Valor | Onde obter |
|----------|-------|------------|
| `FIREBASE_PROJECT_ID` | mesmo valor de produção | Railway prod → backend → Variables |
| `SENTRY_DSN` | mesmo valor de produção (ou DSN separado para staging) | Sentry Dashboard |
| `CLOUDINARY_CLOUD_NAME` | mesmo valor de produção | Cloudinary Dashboard |
| `CLOUDINARY_API_KEY` | mesmo valor de produção | Cloudinary Dashboard |
| `CLOUDINARY_API_SECRET` | mesmo valor de produção | Cloudinary Dashboard |
| `SENDGRID_API_KEY` | mesmo valor de produção (atenção: emails de staging vão para usuários reais) | SendGrid Dashboard |

> **Nota de segurança:** FIREBASE_PROJECT_ID não é sensível (é público no SDK do frontend), mas os demais são secrets. Copiar via painel sem expor no terminal.

### 3. Verificar DATABASE_URL resolvida

Confirmar que a referência `${{Postgres-mFan.DATABASE_URL}}` foi resolvida corretamente:

```
Railway Dashboard → backend-staging → Variables → DATABASE_URL → deve mostrar URL do Postgres-mFan
```

---

## Smoke Tests (após completar pendências Railway)

- [ ] `GET https://backend-staging-staging-3d47.up.railway.app/health` → 200
- [ ] `GET https://backend-staging-staging-3d47.up.railway.app/openapi.json` → 200
- [ ] Login no frontend staging (`lumenplus-git-staging-applumenplus-1605s-projects.vercel.app`) → sucesso
- [ ] Network tab: requests da frontend staging vão para `backend-staging-staging-3d47.up.railway.app`
- [ ] Módulo admin abre normalmente para usuário DEV
- [ ] Módulo vida abre normalmente para usuário comum

---

## Variáveis de Ambiente Completas (backend-staging)

Variáveis obrigatórias para o backend funcionar em staging:

| Variável | Status | Valor |
|----------|--------|-------|
| `DATABASE_URL` | ✅ via referência Railway | `${{Postgres-mFan.DATABASE_URL}}` |
| `SECRET_KEY` | ✅ CLI | novo, gerado com openssl |
| `AUTH_MODE` | ✅ CLI | `PROD` |
| `IS_DEV_AUTH` | ✅ CLI | `false` |
| `ENABLE_DEV_ENDPOINTS` | ✅ CLI | `false` |
| `ENVIRONMENT` | ✅ CLI | `staging` |
| `SENTRY_ENVIRONMENT` | ✅ CLI | `staging` |
| `ALLOWED_ORIGINS` | ✅ CLI | Vercel staging + Vercel prod |
| `FIREBASE_PROJECT_ID` | ⚠️ **pendente painel** | mesmo de produção |
| `SENTRY_DSN` | ⚠️ pendente painel | mesmo de produção (ou separado) |
| `CLOUDINARY_CLOUD_NAME` | ⚠️ pendente painel | mesmo de produção |
| `CLOUDINARY_API_KEY` | ⚠️ pendente painel | mesmo de produção |
| `CLOUDINARY_API_SECRET` | ⚠️ pendente painel | mesmo de produção |
| `SENDGRID_API_KEY` | ⚠️ pendente painel | mesmo de produção |

---

## Redis no Staging

**Opção A (ativa):** Sem REDIS_URL. Rate limiter usa fallback em memória. Aceitável para validação técnica.

**Opção B:** Criar serviço `Redis-staging` no Railway quando push notifications ou cache forem testados.

---

## Firebase no Staging

Usar o mesmo projeto Firebase inicialmente para testes internos. Usuários de teste podem ser criados no mesmo projeto.

**Antes de testes externos ou lojas:** criar projeto Firebase separado (`lumenplus-staging`) para isolamento completo.

---

## Rollback

Para remover o ambiente staging:
1. Deletar serviços Railway `backend-staging` e `Postgres-mFan` (environment `staging`)
2. Remover env var `EXPO_PUBLIC_API_URL` da Preview (staging) no Vercel
3. Deletar branch `staging` do repositório: `git push origin --delete staging`

Não afeta produção.
