# Lumen+ — Ambiente Staging

**Data de criação:** 2026-06-13  
**Status:** Pronto para criação manual (infraestrutura externa pendente)

---

## Visão Geral

| Recurso | Produção | Staging |
|---|---|---|
| Railway backend | serviço `backend` | serviço `backend-staging` |
| Railway Postgres | serviço `Postgres` | serviço `Postgres-staging` |
| Railway Redis | serviço `Redis` | serviço `Redis-staging` (ou omitir) |
| Vercel frontend | branch `main` → lumenplus.vercel.app | branch `staging` → lumenplus-staging.vercel.app |
| Firebase Auth | projeto `lumenplus` | mesmo projeto (usuários de teste separados) |

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

## Criação do Ambiente Railway (manual)

### Pré-requisitos
- Acesso ao painel Railway: https://railway.app
- Workspace: `obralumendeevangelizacao`
- Projeto: `lumen+`

### Passo a passo

**1. Criar serviço Postgres-staging**
```
Railway Dashboard → Projeto lumen+ → + New → Database → PostgreSQL
Nome: Postgres-staging
```

**2. Criar serviço backend-staging**
```
Railway Dashboard → Projeto lumen+ → + New → GitHub Repo
Repositório: lumenplus-main
Branch: staging
Nome: backend-staging
```

**3. Configurar env vars no backend-staging**

Copiar todas as env vars de `backend` (produção) e ajustar:

| Variável | Produção | Staging |
|---|---|---|
| `DATABASE_URL` | URL do Postgres prod | URL do Postgres-staging |
| `REDIS_URL` | URL do Redis prod | URL do Redis-staging (ou deixar em branco) |
| `ENVIRONMENT` | `production` | `staging` |
| `SENTRY_ENVIRONMENT` | `production` | `staging` |
| `AUTH_MODE` | `PROD` | `PROD` (manter) |
| `IS_DEV_AUTH` | `false` | `false` (manter) |
| `ENABLE_DEV_ENDPOINTS` | `false` | `false` (manter) |
| `ALLOWED_ORIGINS` | URL prod | URL staging Vercel + URL prod |
| `SECRET_KEY` | (valor prod) | gerar novo: `openssl rand -hex 32` |
| `FIREBASE_*` | (valores prod) | mesmos valores (mesmo projeto Firebase) |

**4. Verificar health do backend-staging**
```
GET https://backend-staging.up.railway.app/health
Esperado: 200 OK
```

---

## Criação do Ambiente Vercel (manual)

### Pré-requisitos
- Acesso ao painel Vercel: https://vercel.com
- Projeto: `lumenplus`

### Passo a passo

**1. Criar branch `staging` no repositório**
```bash
git checkout -b staging
git push origin staging
```

**2. Configurar branch staging no Vercel**
```
Vercel Dashboard → lumenplus → Settings → Git
Em "Branch Deployments": ativar para branch `staging`
```

**3. Adicionar env vars para staging no Vercel**
```
Vercel Dashboard → lumenplus → Settings → Environment Variables
EXPO_PUBLIC_API_URL = https://backend-staging.up.railway.app
(marcar apenas para branch staging, não para production)
```

**4. Verificar deploy automático**
Fazer push de qualquer commit para `staging` → Vercel deve buildar automaticamente.

---

## Variáveis de Ambiente Necessárias (backend-staging)

Variáveis obrigatórias para o backend funcionar:

```bash
# Banco de dados
DATABASE_URL=postgresql://...

# Autenticação
AUTH_MODE=PROD
IS_DEV_AUTH=false
SECRET_KEY=<gerar com openssl rand -hex 32>

# Firebase
FIREBASE_PROJECT_ID=<mesmo de prod>
FIREBASE_PRIVATE_KEY_ID=<mesmo de prod>
FIREBASE_PRIVATE_KEY=<mesmo de prod>
FIREBASE_CLIENT_EMAIL=<mesmo de prod>
FIREBASE_CLIENT_ID=<mesmo de prod>

# CORS
ALLOWED_ORIGINS=https://lumenplus-staging.vercel.app,https://lumenplus.vercel.app

# Pool de conexões
DATABASE_POOL_SIZE=5
DATABASE_MAX_OVERFLOW=10

# Ambiente
ENVIRONMENT=staging
SENTRY_ENVIRONMENT=staging
ENABLE_DEV_ENDPOINTS=false

# Redis (opcional — omitir se não quiser criar serviço separado)
# REDIS_URL=redis://...
```

---

## Variáveis de Ambiente Necessárias (frontend staging)

```bash
# Vercel env var para branch staging:
EXPO_PUBLIC_API_URL=https://backend-staging.up.railway.app
```

---

## Smoke Tests (após criação)

Executar manualmente após provisionar:

- [ ] `GET https://backend-staging.up.railway.app/health` → 200
- [ ] `GET https://backend-staging.up.railway.app/openapi.json` → 200
- [ ] Login no frontend staging com conta de teste → sucesso
- [ ] Requests da frontend staging vão para backend staging (Network tab do browser)
- [ ] Módulo admin abre normalmente para usuário DEV
- [ ] Módulo vida abre normalmente para usuário comum

---

## Redis no Staging

**Opção A (recomendada para início):** Omitir REDIS_URL no staging. O rate limiter usa fallback em memória. Não há cache Redis. Aceitável para validação técnica.

**Opção B:** Criar serviço `Redis-staging` no Railway (mesmo processo do Postgres-staging). Usar quando push notifications ou cache forem testados.

---

## Firebase no Staging

Usar o mesmo projeto Firebase inicialmente para testes internos. Usuários de teste podem ser criados no mesmo projeto.

**Antes de testes externos ou lojas:** criar projeto Firebase separado (`lumenplus-staging`) para isolamento completo. Atualizar todas as `FIREBASE_*` env vars do backend-staging.

---

## Rollback

Para remover o ambiente staging:
1. Deletar serviços Railway `backend-staging` e `Postgres-staging`
2. Remover configuração Vercel de staging
3. Deletar branch `staging` do repositório: `git push origin --delete staging`

Não afeta produção.

---

## Pendências Externas

- [ ] **Criar serviços Railway** (requer acesso manual ao painel)
- [ ] **Configurar Vercel** para branch staging (requer acesso manual ao painel)
- [ ] **Confirmar custo Railway** antes de criar novo serviço (verificar plano atual)
- [ ] **Definir se Redis staging é necessário** antes de provisionar
- [ ] **Criar branch `staging`** no repositório (`git push origin staging`)
