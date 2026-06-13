# Lumen+ — Deploy e Ambientes

**Versão da documentação:** 1.0  
**Data:** 2026-06-12  
**Audiência:** desenvolvedor, operador

---

## Visão Geral

O Lumen+ tem dois serviços com plataformas de deploy distintas:

| Serviço | Plataforma | Origem |
|---------|-----------|--------|
| Backend (FastAPI) | Railway | `backend/` |
| Frontend (React Native Web) | Vercel | `lumen_mobile/` |

Não existe ambiente de staging formal — há apenas produção. O Vercel gera preview deployments para branches/PRs, mas esses previews não têm backend dedicado e não substituem um ambiente de staging com banco separado.

---

## Backend — Railway

### Stack

- Python 3.12 / FastAPI / Uvicorn
- PostgreSQL (Railway managed)
- Redis (Railway managed — usado pelo rate limit)
- Alembic (44 migrações: 001–044)

### Deploy

- **Trigger:** push para `main` → Railway detecta e faz build automático
- **Migrations:** Alembic roda via script de start ou comando manual antes do deploy
- **Rollback:** Railway permite reverter para deploy anterior via dashboard
- **URL de produção:** `https://backend-production-6efc.up.railway.app` (refletida no CSP do frontend)

### Checks Antes de Deploy

```bash
cd backend
python -m mypy app     # typecheck (se configurado)
python -m pytest       # testes
```

Nunca deployar com:
- Erro de typecheck mypy
- Teste falhando
- `validate_production_settings()` retornando erros
- Secret hardcoded no diff

### validate_production_settings()

O backend (`backend/app/settings.py:123`) verifica ao inicializar em produção:

```python
def validate_production_settings(self) -> list[str]:
    errors = []
    if self.is_production:
        if "change-me" in self.secret_key:
            errors.append("SECRET_KEY deve ser alterado em produção")
        if self.auth_mode == "DEV":
            errors.append("AUTH_MODE deve ser PROD em produção")
        if self.enable_dev_endpoints:
            errors.append("ENABLE_DEV_ENDPOINTS deve ser False em produção")
        if self.debug_verification_code:
            errors.append("DEBUG_VERIFICATION_CODE deve ser False em produção")
        if not self.encryption_key:
            errors.append("ENCRYPTION_KEY é obrigatório em produção")
        if not self.hmac_pepper:
            errors.append("HMAC_PEPPER é obrigatório em produção")
        if not self.firebase_project_id:
            errors.append("FIREBASE_PROJECT_ID é obrigatório em produção")
    return errors
```

Erros nesta validação são **fatais** — abortam o processo de inicialização.

---

## Frontend — Vercel

### Stack

- React Native 0.76.9 / Expo 52 / expo-router 4.0
- Build: `npm run build` → `dist/` (bundled SPA, ~11.1 MB, sem code splitting)
- Framework: `null` (Vercel trata como SPA estática com rewrite)
- Rewrite: `/(.*) → /index.html` (SPA routing)

### Deploy

- **Trigger:** push para `main` → Vercel deploya automaticamente
- **Preview deployments:** gerados para qualquer branch/PR — úteis para revisão visual, mas sem backend dedicado
- **Configuração:** `lumen_mobile/vercel.json` (buildCommand, outputDirectory, rewrites, headers)

### Checks Antes de Deploy

```bash
cd lumen_mobile
npx tsc --noEmit    # typecheck — deve passar sem erros
npm run lint        # ESLint — atenção: ver nota abaixo
npm run build       # build completo
```

> **Nota ESLint (dívida POST-RC):** o projeto não tem `.eslintrc` configurado — `npm run lint` retorna exit 0 sem inspecionar nenhum arquivo. O lint está inoperante. Esta é uma dívida técnica documentada; não confundir "lint passou" com "código inspecionado".

> **TypeScript:** `npx tsc --noEmit` passa sem erros — este check é válido e deve ser rodado antes de todo deploy.

---

## Variáveis de Ambiente (Backend)

As variáveis são lidas via `pydantic-settings` (`backend/app/settings.py`). Valores default inseguros são protegidos por `validate_production_settings()`.

### Bloco: APP

| Variável | Default | Obrigatório em produção |
|----------|---------|------------------------|
| `ENVIRONMENT` | `dev` | Sim (`production`) |
| `APP_NAME` | `Lumen+ API` | Não |
| `APP_VERSION` | `0.3.0` | Não |
| `LOG_LEVEL` | `INFO` | Não |
| `DEBUG` | `False` | Não (deve ser `False`) |

### Bloco: SECURITY

| Variável | Descrição | Obrigatório em produção |
|----------|-----------|------------------------|
| `SECRET_KEY` | Chave interna da aplicação | Sim (não pode conter "change-me") |
| `AUTH_MODE` | `DEV` ou `PROD` | Sim (`PROD`) |
| `CORS_ORIGINS` | Lista de origens permitidas (CSV) | Sim |
| `ENCRYPTION_KEY` | Chave AES-256-GCM para CPF/RG (base64, 32 bytes) | Sim |
| `HMAC_PEPPER` | Pepper para HMAC-SHA256 do CPF (base64, 32 bytes) | Sim |

> `ENCRYPTION_KEY` e `HMAC_PEPPER` nunca devem ser rotacionados sem migração de dados — os documentos criptografados existentes ficariam inacessíveis.

### Bloco: DATABASE

| Variável | Descrição |
|----------|-----------|
| `DATABASE_URL` | URL PostgreSQL (Railway injeta automaticamente) |
| `DATABASE_POOL_SIZE` | Default: 5 |
| `DATABASE_MAX_OVERFLOW` | Default: 10 |
| `REDIS_URL` | URL Redis (Railway injeta automaticamente) |

O backend aceita `postgresql://` e converte automaticamente para `postgresql+psycopg://` (psycopg3).

### Bloco: INTEGRATIONS

| Variável | Descrição | Obrigatório em produção |
|----------|-----------|------------------------|
| `FIREBASE_PROJECT_ID` | ID do projeto Firebase Auth | Sim |
| `SENTRY_DSN` | DSN do Sentry (monitoramento) | Não (recomendado) |
| `VAPID_PRIVATE_KEY` | Chave privada VAPID (Web Push) | Recomendado |
| `VAPID_PUBLIC_KEY` | Chave pública VAPID | Recomendado |
| `VAPID_EMAIL` | E-mail de contato VAPID | Não |
| `SENDGRID_API_KEY` | Chave SendGrid (e-mail transacional) | Recomendado |
| `SENDGRID_FROM_EMAIL` | Remetente de e-mail | Não |
| `SENDGRID_FROM_NAME` | Nome do remetente | Não |
| `CLOUDINARY_CLOUD_NAME` | Cloudinary (uploads) | Não (se não usar upload) |
| `CLOUDINARY_API_KEY` | Cloudinary API key | Não |
| `CLOUDINARY_API_SECRET` | Cloudinary API secret | Não |

### Bloco: FEATURE FLAGS

| Variável | Default | Deve ser em produção |
|----------|---------|---------------------|
| `ENABLE_DEV_ENDPOINTS` | `False` | `False` (fail-closed) |
| `ENABLE_AUDIT` | `True` | `True` |
| `ENABLE_PHONE_VERIFICATION` | `True` | `True` |
| `ENABLE_EMAIL_VERIFICATION` | `True` | `True` |
| `ENABLE_SENSITIVE_ACCESS` | `True` | `True` |
| `DEBUG_VERIFICATION_CODE` | `False` | `False` (nunca expor OTP em produção) |

### Bloco: RATE LIMITING

| Variável | Default |
|----------|---------|
| `RATE_LIMIT_ENABLED` | `True` |
| `RATE_LIMIT_REQUESTS_PER_MINUTE` | `60` |
| `RATE_LIMIT_VERIFICATION_PER_HOUR` | `5` |

### Bloco: INVITES

| Variável | Default |
|----------|---------|
| `INVITE_EXPIRATION_DAYS` | `7` |

---

## Variáveis de Ambiente (Frontend — Vercel)

O frontend Expo/React Native não usa `.env` do servidor — as variáveis de ambiente do Expo (prefixo `EXPO_PUBLIC_*`) são embutidas no bundle no momento do build. As configurações de URL de backend e Firebase são definidas no código ou via `app.config.js`.

Não há lista canônica de variáveis Expo documentada no código auditado — verificar `lumen_mobile/app.config.js` ou `lumen_mobile/.env.example` para a lista atual antes de configurar um novo ambiente.

---

## Geração de Chaves para Produção

Para gerar `ENCRYPTION_KEY` e `HMAC_PEPPER`:

```bash
python -c "import secrets, base64; print(base64.b64encode(secrets.token_bytes(32)).decode())"
```

Rodar duas vezes (uma para cada chave). Armazenar no gerenciador de segredos do Railway — nunca em `.env` commitado no repositório.

---

## Migrações de Banco

As 44 migrações Alembic cobrem o schema completo. Para rodar migrações em produção:

```bash
cd backend
alembic upgrade head
```

Rodar **antes** do deploy da nova versão do backend quando houver mudanças de schema. O Railway não roda migrações automaticamente — é responsabilidade do operador.

---

## Monitoramento

| Ferramenta | Escopo | Configuração |
|-----------|--------|-------------|
| Sentry | Erros de runtime (backend + frontend web) | `SENTRY_DSN` no backend; `sendDefaultPii: false` no frontend |
| Vercel Analytics | Pageviews web | Habilitado no build Vercel |
| Railway Logs | Logs de processo do backend | Dashboard Railway |

Sentry no frontend usa `sendDefaultPii: false` — dados pessoais não são enviados automaticamente para o Sentry.

---

## Pendências POST-RC

| Item | Descrição |
|------|-----------|
| Staging formal | Não existe — criar ambiente de staging com banco isolado para validar deploys antes de produção |
| ESLint inoperante | Configurar `.eslintrc` para que `npm run lint` realmente inspecione o código |
| Documentar env vars Expo | Listar e documentar variáveis `EXPO_PUBLIC_*` usadas no frontend |
| Runbook de deploy | Documentar o passo a passo de deploy (migrations → backend → frontend) com rollback |
| CI/CD formal | Nenhum pipeline de CI está configurado — checks manuais antes do push |

---

## Próxima leitura

- **Segurança e hardening:** `11-seguranca-hardening.md`
- **LGPD e dados sensíveis:** `13-lgpd-dados-sensiveis.md`
- **Backend — estrutura:** `03-backend.md`
