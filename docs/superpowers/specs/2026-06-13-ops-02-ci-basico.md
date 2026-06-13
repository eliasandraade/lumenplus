# Spec: OPS-02 — Criar CI Básico

**Data:** 2026-06-13  
**Ciclo:** POST-RC / Ciclo 1 — Fundamentos técnicos  
**Prioridade:** P0  
**Estimativa:** 4–6 horas  
**Depende de:** MAINT-FE-01 (ESLint real)

---

## Problema

O Lumen+ não possui pipeline de CI (Continuous Integration). Isso significa:

- Pull Requests podem ser mergeados com TypeScript quebrado, lint falhando ou testes regressivos
- O histórico de deploys mostra que erros de lint/ESLint já bloquearam deploys em produção anteriormente
- Não há validação automática de nenhuma mudança antes de chegar à `main`
- O backend tem 159 testes que nunca são executados automaticamente
- À medida que o time cresce ou o ritmo de desenvolvimento aumenta, a falta de CI se torna um risco de qualidade crítico

---

## Objetivo

Criar um pipeline de CI com GitHub Actions que execute automaticamente em todo PR e push para `main`/`staging`:

1. **Frontend:** TypeScript + ESLint + build web
2. **Backend:** typecheck (mypy) + testes (pytest)

---

## Escopo

**Dentro do escopo:**
- Criar workflow GitHub Actions: `.github/workflows/ci.yml`
- Jobs: `lint-typecheck-frontend`, `test-backend`
- Trigger: `push` para `main`/`staging` + `pull_request` para `main`/`staging`
- Usar Python 3.11 (mesma versão do Docker de produção)
- Usar Node.js compatível com Expo SDK 52

**Fora do escopo:**
- Deploy automático (CD) — fora do escopo desta spec
- Build nativo (EAS) — isso é MOBILE-01
- Testes E2E — isso é MOBILE-02
- Notificações de CI (Slack, email) — pode vir depois
- Coverage report — pode vir depois
- Cache de dependências otimizado — pode ser adicionado iterativamente

---

## Arquivos Prováveis

```
.github/
  workflows/
    ci.yml                ← criar
backend/
  requirements.txt        ← deps de produção (Python)
  requirements-dev.txt    ← criar se não existir (pytest, mypy)
  pyproject.toml          ← verificar se tem config de pytest/mypy
lumen_mobile/
  package.json            ← scripts lint e typecheck
  .eslintrc.js            ← depende de MAINT-FE-01
```

---

## Abordagem Recomendada

### Estrutura do workflow

```yaml
# .github/workflows/ci.yml
name: CI

on:
  push:
    branches: [main, staging]
  pull_request:
    branches: [main, staging]

jobs:
  frontend:
    name: Frontend — TypeScript + Lint + Build
    runs-on: ubuntu-latest
    defaults:
      run:
        working-directory: lumen_mobile
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
          cache-dependency-path: lumen_mobile/package-lock.json
      - run: npm ci
      - run: npx tsc --noEmit
      - run: npm run lint
      # Build web — valida que o bundle não quebra
      - run: npx expo export --platform web
        env:
          EXPO_PUBLIC_API_URL: https://backend-production-6efc.up.railway.app

  backend:
    name: Backend — Pytest + Mypy
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:15
        env:
          POSTGRES_USER: test
          POSTGRES_PASSWORD: test
          POSTGRES_DB: lumenplus_test
        ports: ['5432:5432']
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
    defaults:
      run:
        working-directory: backend
    env:
      DATABASE_URL: postgresql://test:test@localhost:5432/lumenplus_test
      AUTH_MODE: DEV
      IS_DEV_AUTH: 'false'
      ENABLE_DEV_ENDPOINTS: 'false'
      SECRET_KEY: ci-test-secret-key-not-used-in-prod
      REDIS_URL: ''
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with:
          python-version: '3.11'
          cache: 'pip'
          cache-dependency-path: backend/requirements.txt
      - run: pip install -r requirements.txt
      - run: pip install pytest pytest-asyncio httpx
      - run: python -m pytest tests/ -q
      - run: python -m mypy app --ignore-missing-imports
        continue-on-error: true  # mypy pode ter warnings não-bloqueantes inicialmente
```

### Variáveis de ambiente do CI para o backend

O CI precisa de um banco PostgreSQL de teste. A opção mais simples é usar o serviço `postgres` do GitHub Actions (sem custo adicional). As env vars mínimas para rodar os testes:

- `DATABASE_URL` → postgres local do CI
- `AUTH_MODE=DEV` → não precisa de Firebase real
- `SECRET_KEY` → qualquer string (não vai a produção)
- `REDIS_URL=''` → testes não precisam de Redis (fallback em memória)

**Atenção:** verificar quais env vars são obrigatórias em `backend/app/settings.py` para o app não crashar no startup.

---

## Riscos

| Risco | Mitigação |
|---|---|
| Testes do backend precisam de env vars secretas (Firebase, Cloudinary) | Usar `AUTH_MODE=DEV` para pular Firebase; Cloudinary não é necessário para testes unitários |
| Build web do Expo falha sem `EXPO_PUBLIC_API_URL` | Definir a URL de produção como valor dummy no CI |
| Mypy com muitos erros existentes (não bloqueante) | Iniciar com `continue-on-error: true` para mypy; tornar bloqueante gradualmente |
| npm ci falha por lock file desatualizado | Garantir que `package-lock.json` está commitado e atualizado |
| Tempo de CI muito longo (> 10 min) | Adicionar cache de pip/npm desde o início; build web pode ser removido em iteração futura se demorar muito |
| Redis não disponível no CI | Usar `REDIS_URL=''` e verificar se o fallback em memória do rate limiter funciona |

---

## Plano de Implementação

1. **Diagnóstico:**
   - Verificar se existe `.github/workflows/` no repositório
   - Verificar `backend/requirements.txt` — todas as dependências de teste estão lá?
   - Executar os checks localmente uma vez para confirmar que passam: `cd lumen_mobile && npm run lint && npx tsc --noEmit`
   - Executar `cd backend && python -m pytest tests/ -q` localmente

2. **Criar workflow:**
   - Criar `.github/workflows/ci.yml` conforme template acima
   - Ajustar env vars conforme o necessário do `settings.py`

3. **Validar:**
   - Fazer push para branch de feature
   - Abrir PR para `staging` ou `main`
   - Verificar que o workflow dispara e passa

4. **Ajustar se necessário:**
   - Se algum teste flaky, investigar (não suprimir)
   - Se mypy tem muitos erros, deixar `continue-on-error: true` inicialmente

---

## Plano de Testes

- Workflow dispara em PR para `main`
- Job `frontend` passa: TypeScript sem erros + lint sem erros
- Job `backend` passa: 159+ testes passando (baseline atual)
- Falha proposital: modificar um arquivo com `console.log` → lint deve falhar no CI
- Falha proposital: adicionar erro de TypeScript → typecheck deve falhar no CI

---

## Critérios de Aceite

- [ ] `.github/workflows/ci.yml` criado e commitado
- [ ] Workflow dispara em push para `main` e em PR para `main`
- [ ] Job `frontend` executa: `npx tsc --noEmit` + `npm run lint`
- [ ] Job `backend` executa: `pytest` com banco PostgreSQL do CI
- [ ] Baseline verde: todos os jobs passam na branch `main` atual
- [ ] Falha de lint bloqueia o CI (exit code não-zero)
- [ ] Falha de TypeScript bloqueia o CI
- [ ] Falha de teste backend bloqueia o CI

---

## Rollback

Deletar `.github/workflows/ci.yml`. Não afeta código de produção.

---

## Estimativa de Esforço

**4–6 horas** (diagnóstico + criação do workflow + primeira execução + ajustes de env vars + validação)

---

## Dependências

- **Depende de:** MAINT-FE-01 (ESLint configurado para que `npm run lint` seja real)
- **Recomendado após:** MAINT-FE-01 e MAINT-FE-02 (para CI não iniciar com muitos warnings)
- **Bloqueia (indiretamente):** OPS-01 pode fornecer o ambiente de staging para deploy de CI; porém o CI básico pode ser criado antes do staging

---

## Decisões Pendentes para o Usuário

1. **Build web no CI:** incluir `npx expo export --platform web` no CI ou deixar para depois? (aumenta tempo de execução em ~3–5 min)
2. **Mypy bloqueante:** tornar `mypy` bloqueante desde o início ou `continue-on-error: true` inicialmente?
3. **GitHub Actions minutes:** verificar se o repositório é privado e qual o limite de minutes no plano GitHub atual
4. **Branch strategy:** CI deve rodar também em PRs para `staging`, ou apenas `main`?
