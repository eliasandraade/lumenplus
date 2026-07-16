# SEC-05 — Prontidão Operacional de Segredos + Config Drift

- **Data:** 2026-07-16 (Ciclo 2)
- **Runbook de rotação:** `docs/ops/secrets-rotation.md` (procedimentos passo a passo)
- **Regra:** valores reais **nunca** no repositório; este doc lista apenas **nomes, ambiente e metadados**.

> Complementa `secrets-rotation.md` com foco em **prontidão**: o que é obrigatório no boot, o drift esperado entre ambientes e a prioridade de rotação.

---

## Matriz de prontidão de segredos

| Segredo | Ambientes | Obrigatório no boot | Impacto se ausente/errado | Rotação | Rollback | Prioridade |
|---------|-----------|---------------------|---------------------------|---------|----------|-----------|
| `SECRET_KEY` | dev/staging/prod | **prod** (crash se `change-me`) | JWTs inválidos; sessões caem | gerar novo (`openssl rand -hex 32`) | restaurar anterior | Alta |
| `ENCRYPTION_KEY` | **staging + prod** | **sim (staging e prod)** — CryptoService | app não sobe; CPF/RG não decifram | par novo + re-cifrar | restaurar anterior | Crítica |
| `HMAC_PEPPER` | **staging + prod** | **sim (staging e prod)** | lookups por hash quebram | novo + recomputar | restaurar anterior | Crítica |
| `FIREBASE_PRIVATE_KEY` (+ IDs) | staging/prod | prod (auth) | autenticação cai | Firebase Console | restaurar anterior | Crítica |
| `FIREBASE_PROJECT_ID` | prod | **prod** (crash se vazio) | autenticação cai | imutável | — | Alta |
| `VAPID_PRIVATE_KEY` / `VAPID_PUBLIC_KEY` | staging + prod | **não** (falha silenciosa) | push não envia (sem sinal no boot) | par novo (invalida subs) | restaurar par | Média |
| `SENDGRID_API_KEY` | staging/prod | não | e-mail não envia | novo no SendGrid | restaurar | Média |
| `CLOUDINARY_*` | staging/prod | não | upload de foto falha | novo no Cloudinary | restaurar | Baixa |
| `DATABASE_URL` | todos | conexão (runtime) | sem banco | rotacionar credencial | restaurar | Alta |

> `VAPID_*` **não** é validado no startup (`push_service` só falha em runtime). Recomendação: adicionar validação/aviso de boot em ambiente não-dev (item técnico futuro).

---

## Config drift esperado (staging × produção)

Diferenças **esperadas e corretas** entre ambientes (não são erro):

| Variável | staging | produção |
|----------|---------|----------|
| `ENVIRONMENT` | `staging` | `production` |
| `DATABASE_URL` | banco staging (Postgres-mFan) | banco de produção |
| `SECRET_KEY` | valor próprio de staging | valor próprio de prod |
| `ENCRYPTION_KEY` / `HMAC_PEPPER` | próprios de staging | próprios de prod |
| `VAPID_*` | par de staging (fp `40593c53…`) | par próprio de prod (fp `fca687c2…`) |
| `AUTH_MODE` | pode ser `DEV`* | `PROD` |
| `ENABLE_DEV_ENDPOINTS` | pode ser `true`* | `false` |

\* **Landmine de drift:** as validações "production-only" (`validate_production_settings`) só disparam quando `ENVIRONMENT=production`. Copiar a config de staging para produção sem ajustar `AUTH_MODE`, `FIREBASE_PROJECT_ID`, `ENABLE_DEV_ENDPOINTS`, `DEBUG_VERIFICATION_CODE` faz o boot de prod **falhar** (proposital). Ao promover, revisar esses campos.

---

## Prontidão / pendências

- [x] Inventário e runbook de rotação (`secrets-rotation.md`).
- [x] Matriz de prontidão + drift (este doc).
- [x] Nenhum segredo real versionado (varredura 2026-07-16: sem `.env` real, sem CPF).
- [ ] Validação de boot para `VAPID_*` em ambiente não-dev (item técnico futuro).
- [ ] Registrar a data da última rotação de cada segredo quando ocorrer.

> **Fixtures de teste:** `backend/tests/conftest.py` define `ENCRYPTION_KEY`/`HMAC_PEPPER` determinísticos **apenas para testes** (SQLite em memória). Não são segredos de produção — aceitável, porém sinalizado para revisão futura.
