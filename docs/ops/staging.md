# Lumen+ — Ambiente Staging

**Atualizado em:** 2026-06-14  
**Status atual:** Branch criada. Infraestrutura Railway pendente de provisionamento manual.

---

## Estado de cada componente

| Componente | Status | Observação |
|---|---|---|
| Branch `staging` no Git | ✅ **Criada** | Criada em 2026-06-14 a partir de `main` (commit `b13005e`) |
| CI rodando em `staging` | ✅ **Ativo** | `.github/workflows/ci.yml` já inclui branch `staging` (desde OPS-02, Ciclo 1) |
| Vercel — Preview automático | ✅ **Funciona** | Vercel auto-deploya qualquer branch como Preview; mas `EXPO_PUBLIC_API_URL` aponta para produção (ver seção Vercel abaixo) |
| Vercel — env var staging | ⏳ Pendente manual | Precisa adicionar `EXPO_PUBLIC_API_URL` para branch staging no painel Vercel |
| Railway Postgres-staging | ⏳ Pendente manual | CLI Railway não suporta criação de serviços; requer painel web |
| Railway backend-staging | ⏳ Pendente manual | Mesmo motivo; requer painel web |
| Railway Redis-staging | Decisão: omitir | Opção A: sem Redis staging, fallback em memória (OK para validação técnica) |

---

## Branch Strategy

```
main          → produção   (Railway prod + Vercel prod)
staging       → staging    (Railway staging + Vercel staging)
post-rc/*     → feature branches → PR para staging → valida → PR para main
```

Fluxo de deploy:
1. Desenvolve em `post-rc/<feature>`
2. Abre PR para `staging` → CI roda → merge para `staging`
3. Valida em staging
4. Abre PR de `staging` para `main` → merge → deploy produção

---

## CI no staging

O workflow `.github/workflows/ci.yml` já roda automaticamente para pushes e PRs em `staging`:

```yaml
on:
  push:
    branches: [main, staging]
  pull_request:
    branches: [main, staging]
```

Ambos os jobs (`frontend` e `backend`) rodam. O backend inclui ruff, migrations e pytest (192 testes).

---

## Criação do Ambiente Railway (manual — requer painel web)

Railway CLI v4.33.0 disponível, mas **não suporta criação de novos serviços ou environments via CLI**.  
Toda criação deve ser feita no painel: https://railway.app → Workspace `obralumendeevangelizacao` → Projeto `lumen+`.

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

Gerar SECRET_KEY novo antes de tudo:
```bash
openssl rand -hex 32
```

| Variável | Valor |
|---|---|
| `DATABASE_URL` | URL do Postgres-staging (Railway fornece automaticamente) |
| `AUTH_MODE` | `PROD` |
| `IS_DEV_AUTH` | `false` |
| `ENABLE_DEV_ENDPOINTS` | `false` |
| `ENVIRONMENT` | `staging` |
| `SENTRY_ENVIRONMENT` | `staging` |
| `SECRET_KEY` | gerar novo (`openssl rand -hex 32`) |
| `DATABASE_POOL_SIZE` | `5` |
| `DATABASE_MAX_OVERFLOW` | `10` |
| `FIREBASE_PROJECT_ID` | mesmo de produção |
| `FIREBASE_PRIVATE_KEY_ID` | mesmo de produção |
| `FIREBASE_PRIVATE_KEY` | mesmo de produção |
| `FIREBASE_CLIENT_EMAIL` | mesmo de produção |
| `FIREBASE_CLIENT_ID` | mesmo de produção |
| `ALLOWED_ORIGINS` | `https://lumenplus-git-staging-applumenplus-1605s-projects.vercel.app,https://lumenplus.vercel.app` |
| `REDIS_URL` | omitir (Opção A — fallback em memória) |

> **Não copiar** DATABASE_URL, REDIS_URL ou SECRET_KEY de produção.  
> **Não copiar** dados reais para o banco staging.

**4. Confirmar health**
```bash
curl https://backend-staging.up.railway.app/health
# Esperado: {"status":"healthy",...}
```

---

## Vercel — Configuração de staging

### Estado atual

O Vercel já auto-deploya a branch `staging` como **Preview** via integração GitHub nativa.  
URL do Preview de staging: `https://lumenplus-git-staging-applumenplus-1605s-projects.vercel.app`

**Problema atual:** a variável `EXPO_PUBLIC_API_URL` nos Previews ainda aponta para produção.  
O frontend staging continuará fazendo requests para o backend de produção até que isso seja corrigido.

### Passo para corrigir (manual — painel Vercel)

```
Vercel Dashboard → lumenplus → Settings → Environment Variables
→ Adicionar nova variável:
  Nome:  EXPO_PUBLIC_API_URL
  Valor: https://backend-staging.up.railway.app
  Ambientes: marcar apenas "Preview" (não marcar Production)
  Branch: opcionalmente restringir apenas à branch "staging"
```

Após salvar, fazer um novo push à branch `staging` para triggerar rebuild com a variável correta.

> **Sem esta variável correta**, o frontend staging funciona mas aponta para produção — não é um ambiente de staging isolado.

---

## Redis no Staging

**Decisão: Opção A** — omitir REDIS_URL no staging.

- O rate limiter usa fallback em memória (implementado em `app/middlewares/rate_limit.py`)
- Nenhum dado de cache compartilhado com produção
- Aceitável para validação funcional

**Quando migrar para Opção B:** criar serviço `Redis-staging` no Railway quando push notifications ou rate limiting real precisarem ser testados em staging.

---

## Firebase no Staging

Usar o mesmo projeto Firebase inicialmente para testes internos.  
Criar usuários de teste no Firebase Console com email reconhecível (ex: `staging-test@obralumen.org`).

**Antes de testes externos ou lojas:** criar projeto Firebase separado (`lumenplus-staging`) e atualizar todas as `FIREBASE_*` env vars do backend-staging.

---

## Smoke Tests (executar após ativar staging)

```bash
# 1. Health do backend staging
curl https://backend-staging.up.railway.app/health

# 2. OpenAPI disponível
curl -o /dev/null -w "%{http_code}" https://backend-staging.up.railway.app/openapi.json
```

Manual (browser):
- [ ] Frontend staging carrega sem erro de console
- [ ] Login com conta de teste → sucesso
- [ ] Network tab: requests apontam para `backend-staging.up.railway.app` (não produção)
- [ ] Módulo admin abre normalmente para usuário DEV
- [ ] Módulo vida abre normalmente para usuário comum

---

## Rollback

Para remover o ambiente staging:
1. Deletar serviços Railway `backend-staging` e `Postgres-staging` no painel
2. Remover env var `EXPO_PUBLIC_API_URL` do ambiente Preview no Vercel
3. Branch `staging` pode ser mantida; se quiser deletar: `git push origin --delete staging`

Produção não é afetada.

---

## Checklist de Ativação do Staging

Status atual de cada item:

- [x] Branch `staging` criada (2026-06-14, commit `b13005e`)
- [x] CI configurado para branch `staging` (`.github/workflows/ci.yml`)
- [x] Vercel auto-deploy de Preview ativo para branch `staging`
- [ ] **Backend Railway staging criado** (`backend-staging`) — requer painel manual
- [ ] **Postgres staging criado** (`Postgres-staging`) — requer painel manual
- [ ] **Env vars staging configuradas** (Railway painel — ver tabela acima)
- [ ] **`EXPO_PUBLIC_API_URL` staging configurado no Vercel** — requer painel manual
- [ ] **`ALLOWED_ORIGINS` no backend-staging** inclui URL do Vercel staging
- [ ] **`/health` backend staging retorna 200** — validar após criar serviço
- [ ] **Frontend staging retorna 200** — validar após env var Vercel
- [ ] **Login com usuário de teste validado** em staging
- [ ] **Requests do frontend staging apontam para backend staging** (verificar Network tab)
- [ ] **Nenhum dado real copiado para staging** (confirmar antes de ativar)
- [ ] **Redis staging omitido** (Opção A confirmada) ou criado se necessário

**Para ativar o staging completamente, faltam os 4 itens marcados como "requer painel manual".**
