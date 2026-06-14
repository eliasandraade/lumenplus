# Spec: OPS-01 — Criar Staging Formal

**Data:** 2026-06-13  
**Ciclo:** POST-RC / Ciclo 1 — Fundamentos técnicos  
**Prioridade:** P0  
**Estimativa:** 4–8 horas (inclui decisões de infraestrutura)

---

## Problema

O Lumen+ não possui ambiente de staging formal. Hoje, todo desenvolvimento e validação ocorre diretamente em produção, o que:

- Impede validar mudanças de risco (CSP enforced, migrations, push notifications) antes de ir a produção
- Torna impossível testar builds nativas (App Store / Play Store) sem um ambiente separado
- Deixa o CI (OPS-02) sem um target de deploy seguro
- É um risco operacional crescente à medida que o produto amadurece

---

## Objetivo

Criar um ambiente staging formal com:
1. **Backend staging** — Railway (serviço separado, banco separado, mesmas env vars exceto URLs e secrets)
2. **Frontend staging** — Vercel Preview Branch (automático para branch `staging`)
3. **Banco de dados staging** — PostgreSQL separado no Railway (dados de teste, não de produção)
4. Configuração documentada em `docs/ops/staging.md`

---

## Escopo

**Dentro do escopo:**
- Criar serviços staging no Railway (backend + postgres)
- Configurar branch `staging` no repositório
- Configurar Vercel para deploy automático de `staging` → staging URL
- Configurar env vars de staging (Railway + Vercel)
- Documentar o ambiente em `docs/ops/staging.md`

**Fora do escopo:**
- Migração de dados de produção para staging
- Staging para Expo/EAS mobile (isso é MOBILE-01)
- Monitoramento dedicado para staging (Sentry pode ser o mesmo projeto com tag `environment=staging`)
- Redis staging (pode usar o mesmo Redis de produção ou omitir inicialmente)

---

## Arquivos Prováveis

```
.github/                                ← configuração de workflows (OPS-02)
railway.toml                            ← verificar se existe configuração Railway
docker-compose.yml                      ← verificar se existe
backend/start.sh                        ← script de start (roda migrations)
docs/ops/staging.md                     ← criar (documentação do ambiente)
lumen_mobile/.env.staging               ← criar (API URL de staging)
```

---

## Abordagem Recomendada

### Estrutura de ambientes

| Recurso | Produção | Staging |
|---|---|---|
| Railway backend | serviço `backend` | serviço `backend-staging` |
| Railway postgres | serviço `Postgres` | serviço `Postgres-staging` |
| Railway Redis | serviço `Redis` | mesmo Redis prod (ou omitir) |
| Vercel frontend | branch `main` → lumenplus.vercel.app | branch `staging` → lumenplus-staging.vercel.app |
| Firebase | mesmo projeto (auth compartilhado) | mesmo projeto (usuários de test podem ser criados separado) |

### Variáveis de ambiente staging (Railway)

Copiar todas as env vars de produção e ajustar:
- `DATABASE_URL` → URL do Postgres staging
- `ENVIRONMENT=staging` (ou `STAGING=true`)
- `SENTRY_ENVIRONMENT=staging`
- Manter `AUTH_MODE=PROD` e `IS_DEV_AUTH=false`
- Manter `ENABLE_DEV_ENDPOINTS=false`
- `ALLOWED_ORIGINS` → incluir URL de staging do Vercel

### Branch strategy

```
main          → produção (Railway + Vercel prod)
staging       → staging (Railway staging + Vercel staging)
feature/*     → PRs para staging primeiro, depois staging → main
```

### Vercel configuração

No painel Vercel, configurar:
- Branch `staging` → deploy automático para URL de preview dedicada
- Env var `EXPO_PUBLIC_API_URL` apontando para Railway staging

---

## Riscos

| Risco | Mitigação |
|---|---|
| Custo adicional Railway (novo serviço) | Railway tem plano hobby com margem; verificar custo antes de criar |
| Staging sync com produção drifta | Documentar que staging é "best-effort", não espelho perfeito |
| Firebase compartilhado entre prod e staging | Aceitável: usuários de teste são criados no mesmo projeto; staging não afeta prod |
| Migrations de staging divergindo de produção | Staging roda `alembic upgrade head` no start.sh como produção |
| Developer acidentalmente aponta para staging em produção | Documentar URLs claramente; nunca hardcodar URLs no código |

---

## Plano de Implementação

### Fase 1 — Infraestrutura (Railway)
1. Acessar Railway dashboard → projeto `lumen+`
2. Criar novo serviço `backend-staging` (clonar configuração do `backend`)
3. Criar novo serviço `Postgres-staging`
4. Configurar env vars de staging no `backend-staging`
5. Fazer deploy manual do `backend-staging` com branch `main` para validar boot
6. Verificar: `GET https://backend-staging.up.railway.app/health` → 200

### Fase 2 — Infraestrutura (Vercel)
1. Acessar Vercel dashboard → projeto `lumenplus`
2. Configurar branch `staging` para deploy automático
3. Adicionar env var `EXPO_PUBLIC_API_URL=https://backend-staging.up.railway.app` para branch `staging`
4. Criar branch `staging` no repositório: `git checkout -b staging && git push origin staging`
5. Verificar deploy automático no Vercel

### Fase 3 — Validação
1. Acessar URL de staging do Vercel
2. Fazer login com conta de teste
3. Verificar que requests vão para o backend de staging (Network tab)
4. Fazer uma operação simples (ver perfil, ver avisos)

### Fase 4 — Documentação
1. Criar `docs/ops/staging.md` com URLs, env vars, instruções de uso
2. Atualizar `CLAUDE.md` se necessário

---

## Plano de Testes

- Backend staging: `GET /health` → 200
- Backend staging: `GET /openapi.json` → 200
- Frontend staging: carrega sem erros de console
- Login funciona no staging
- Requests da frontend staging vão para o backend staging (verificar URL nos Network requests)
- Migrations rodaram: `alembic upgrade head` no boot do staging

---

## Critérios de Aceite

- [ ] Serviço `backend-staging` no Railway com health check passando
- [ ] Banco `Postgres-staging` separado no Railway
- [ ] Branch `staging` no repositório
- [ ] Vercel faz deploy automático de `staging` para URL dedicada
- [ ] Login funciona no ambiente staging
- [ ] Requests do frontend staging vão para o backend staging
- [ ] `docs/ops/staging.md` criado com URLs e instruções
- [ ] Env vars de staging documentadas (sem valores secretos commitados)

---

## Rollback

- Deletar serviços Railway de staging (não afeta produção)
- Deletar branch `staging` do repositório
- Remover configuração Vercel de staging

---

## Estimativa de Esforço

**4–8 horas** (incluindo decisões de infraestrutura, configuração Railway/Vercel, validação e documentação)

---

## Dependências

- Nenhuma dependência técnica de outros itens POST-RC
- **Bloqueia (indiretamente):** OPS-02 (CI precisa de staging para deploy de validação), SEC-01 (CSP enforced deve ser testado em staging antes de produção), MOBILE-01 (audit EAS usa staging)
- **Requer:** acesso ao painel Railway e Vercel (credenciais do usuário)

---

## Decisões Pendentes para o Usuário

1. **Custo Railway:** confirmar plano Railway atual e margem disponível para novo serviço
2. **Redis staging:** usar o mesmo Redis de produção ou criar um separado?
3. **Firebase staging:** mesmo projeto Firebase ou projeto separado de test?
4. **URL de staging:** aceitar URL gerada pelo Railway/Vercel ou configurar domínio customizado?
