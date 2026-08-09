# Lumen+ — Snapshot da Codebase

## Data da análise

2026-06-24

---

## Escopo analisado

Repositório monorepo `lumenplus-main`. Análise somente leitura. Arquivos lidos: `backend/app/main.py`, `backend/app/settings.py`, `backend/app/db/models.py`, `backend/app/auth/firebase.py`, `backend/requirements.txt`, `backend/Dockerfile`, `backend/railway.toml`, `backend/start.sh`, `lumen_mobile/package.json`, `lumen_mobile/app.json`, `lumen_mobile/vercel.json`, `lumen_mobile/src/services/api.ts`, `lumen_mobile/src/stores/authStore.ts`, `lumen_mobile/app/_layout.tsx`, `.github/workflows/ci.yml`, `backend/.env.example`, `docs/final/*.md`, `docs/ops/*.md`, `docs/superpowers/plans/`. Nenhum segredo foi exposto.

---

## Resumo executivo

O Lumen+ é uma plataforma de gestão comunitária e formação espiritual para membros da **Obra Lumen de Evangelização** (associação religiosa, Fortaleza/CE). O produto está em **produção operacional** desde junho de 2026, com backend versão `0.3.0` e frontend `1.0.0`. O ciclo de hardening de segurança H1→H6A foi concluído. O roadmap POST-RC tem 35 itens classificados P0–P3, nenhum blocker crítico. O staging isolado foi provisionado em 2026-06-15. A próxima prioridade é fechar os itens P1 do Ciclo 2 (CSP enforced, push web end-to-end, LGPD, mobile nativo).

---

## Visão do produto

**O que é:** App de formação e vida comunitária. Centraliza comunicação interna, gestão de membros, eventos/retiros e acompanhamento pessoal de formação espiritual.

**Missão:** "Apoiar a vida de formação e comunhão dos membros da Obra, oferecendo ferramentas digitais que respeitam a privacidade, a confiança e o ritmo próprio de cada pessoa no seu caminho de discipulado."

**Público-alvo:**

| Perfil | Papel |
|--------|-------|
| Membro | Usa no dia a dia: PdV, canal, retiros, inbox |
| Coordenador | Gerencia membros da unidade, posta no canal |
| Administrador | Plataforma completa: usuários, entidades, retiros, avisos, logs |
| Analista | Dashboard de métricas somente |
| DEV | Acesso técnico completo, inclui endpoints `/dev/*` |

**Plataformas:**
- Web → produção via Vercel (`https://lumenplus.vercel.app`)
- iOS e Android → código pronto, distribuição via EAS Build **ainda não submetida às lojas**

**O que NÃO é:** CRM comercial, sistema financeiro, rede social aberta, ferramenta de Analytics — o conteúdo do Projeto de Vida é protegido por PIN e inacessível ao admin.

---

## Stack técnica

### Backend
| Componente | Tecnologia |
|-----------|------------|
| Framework | FastAPI 0.109 + Uvicorn 0.27 |
| Linguagem | Python 3.11 (Docker) |
| ORM | SQLAlchemy 2.0 + psycopg3 |
| Migrations | Alembic (44 migrations) |
| Banco | PostgreSQL 15 |
| Cache / Rate limit | Redis 7 (fallback em memória) |
| Auth | Firebase Auth (RS256 JWT, sem Admin SDK) |
| Criptografia | AES-256-GCM (CPF/RG) + HMAC-SHA256 (hash CPF) |
| Push | pywebpush ≥ 2.0 (VAPID) |
| Email | SendGrid ≥ 6.11 |
| Upload | Cloudinary 1.40 |
| Scheduling | APScheduler ≥ 3.10 |
| Monitoramento | Sentry SDK 2.19 (FastAPI integration, sem PII) |
| Logging | structlog (JSON) |
| Settings | pydantic-settings |
| Versão | 0.3.0 |

### Frontend
| Componente | Tecnologia |
|-----------|------------|
| Framework | React Native 0.76.9 + Expo SDK 52 |
| Roteamento | Expo Router 4 (file-based) |
| Linguagem | TypeScript 5.3 |
| State | Zustand 4 |
| Queries | TanStack React Query 5 |
| Forms | react-hook-form 7 + zod |
| Auth | Firebase JS SDK 10.7 |
| Build web | `expo export --platform web` |
| Monitoramento | Sentry React 10.45 + Vercel Analytics 2 |
| Fonte | Nunito (Google Fonts via Expo) |
| Versão | 1.0.0 |

### Infra e Deploy
| Serviço | Plataforma |
|---------|------------|
| Backend produção | Railway (environment `production`, serviço `backend`) |
| Backend staging | Railway (environment `staging`, serviço `backend-staging`) |
| Banco produção | Railway Postgres (serviço `Postgres`) |
| Banco staging | Railway Postgres (serviço `Postgres-mFan`) |
| Frontend produção | Vercel (branch `main`) |
| Frontend staging | Vercel (branch `staging`, preview automático) |
| Auth | Firebase project `lumenplus-3fec7` |
| CI/CD | GitHub Actions |

---

## Estrutura do repositório

```
lumenplus-main/
├── backend/                    ← API FastAPI
│   ├── app/
│   │   ├── main.py             ← Ponto de entrada; middlewares; registra todos os routers
│   │   ├── settings.py         ← Fonte única de configuração (pydantic-settings)
│   │   ├── api/                ← Routers FastAPI
│   │   ├── auth/               ← Firebase token verification (sem Admin SDK)
│   │   ├── crypto/             ← AES-256-GCM + HMAC para CPF/RG
│   │   ├── db/                 ← models.py + session.py
│   │   ├── middlewares/        ← RateLimitMiddleware (Redis + fallback memória)
│   │   ├── notifications/      ← push_service, email_service, scheduler, notification_service
│   │   ├── org/                ← lógica de OrgUnit, memberships, permissões
│   │   ├── audit/              ← AuditLog service
│   │   └── schemas/            ← Pydantic schemas de request/response
│   ├── alembic/versions/       ← 44 migrations numeradas
│   ├── tests/                  ← pytest; 159 passed baseline
│   ├── Dockerfile              ← python:3.11-slim; instala requirements.txt
│   ├── railway.toml            ← builder=DOCKERFILE; healthcheck=/health
│   ├── start.sh                ← alembic upgrade head → uvicorn
│   ├── requirements.txt        ← arquivo canônico (Dockerfile instala daqui)
│   └── pyproject.toml          ← configs ruff/mypy (NÃO usado pelo Dockerfile)
├── lumen_mobile/               ← Frontend React Native / Expo
│   ├── app/                    ← Expo Router (file-based)
│   │   ├── _layout.tsx         ← Root Stack; registra todos os grupos de rotas
│   │   ├── index.tsx           ← Redirect inteligente (onboarding/home/login)
│   │   ├── (auth)/             ← login.tsx, register.tsx (wizard 4 passos)
│   │   ├── (onboarding)/       ← fluxo de primeiro acesso
│   │   ├── (tabs)/             ← home, community, service, invites, profile
│   │   ├── admin/              ← dashboard, users, entities, retreats, avisos, logs
│   │   ├── vida/               ← Projeto de Vida (wizard, semanal, revisao, historico)
│   │   ├── channel/            ← Canal de grupos/ministérios
│   │   ├── retreats/           ← Listagem e inscrição em retiros
│   │   ├── biblia/             ← Módulo Bíblia
│   │   ├── catecismo/          ← Módulo Catecismo
│   │   ├── coordinator/        ← Telas de coordenador
│   │   └── members.tsx         ← Gestão de membros por unidade
│   ├── src/
│   │   ├── services/           ← api.ts, lifePlan.ts, push.ts, bible.ts, etc.
│   │   ├── stores/             ← authStore.ts, onboardingStore.ts
│   │   ├── components/         ← componentes reutilizáveis
│   │   ├── theme/              ← tokens de design, ThemeProvider, dark mode
│   │   ├── data/               ← constantes (vida.ts, etc.)
│   │   ├── hooks/              ← hooks reutilizáveis
│   │   ├── types/              ← tipos TypeScript
│   │   └── utils/              ← parseApiError, etc.
│   ├── public/
│   │   └── sw.js               ← Service Worker para Web Push
│   ├── vercel.json             ← build config + CSP Report-Only headers
│   ├── eas.json                ← profiles: dev/preview/prod (EAS Build)
│   └── package.json            ← Expo 52, RN 0.76, TS 5.3
├── docs/
│   ├── final/                  ← 16 documentos de RC (visão, arquitetura, módulos, guias)
│   ├── ops/                    ← staging.md, csp-plan.md, secrets-rotation.md, push-web-activation-plan.md
│   ├── ops/lgpd/               ← drafts de política de privacidade, ROPA, retenção
│   └── superpowers/            ← specs, planos, auditorias de segurança
├── .github/workflows/
│   ├── ci.yml                  ← frontend: tsc+lint+build; backend: ruff+migrations+pytest
│   └── discord-log.yml         ← notificações no Discord (job `notify`)
└── CLAUDE.md                   ← instruções para Claude Code
```

---

## Backend

### Ponto de entrada e middlewares

`backend/app/main.py` registra, nesta ordem:
1. Sentry (antes de tudo)
2. `RateLimitMiddleware` (Redis + fallback memória)
3. `CORSMiddleware` (origens explícitas via `CORS_ORIGINS`)
4. Middleware de limite de body JSON (1 MB; multipart tem limite próprio no endpoint)
5. Middleware de security headers (CSP estrita, HSTS, X-Frame-Options, Referrer-Policy)
6. Middleware de Request ID (UUID injetado em `X-Request-ID`)
7. Handlers de erro (422 limpo, 500 sem PII, CORS manual em respostas de erro)

### Routers registrados

| Prefixo | Arquivo | Responsabilidade |
|---------|---------|-----------------|
| `/auth` | `routes/auth.py` | Login, registro, `/auth/me`, check CPF |
| `/profile` | `profile_routes.py` | Perfil, foto, catálogos |
| `/org` | `routes/organization.py` | OrgUnits, memberships, convites |
| `/admin` | `routes/admin.py` | Dashboard, usuários, roles, audit logs |
| `/admin` (sensitive) | `admin_routes.py` | Acesso a documentos sensíveis (CPF/RG) com auditoria |
| `/admin/retreats` | `admin_retreat_routes.py` | CRUD de retiros pelo admin |
| `/retreats` | `retreat_routes.py` | Listagem e inscrição por membros |
| `/inbox` | `inbox_routes.py` | Avisos: criação, envio, recebimento |
| `/verify` | `verification_routes.py` | Verificação de telefone OTP |
| `/legal` | `legal_routes.py` | Termos de uso e política de privacidade |
| `/life-plan` | `life_plan_routes.py` | Projeto de Vida (ciclos, diagnóstico, metas, rotina) |
| `/pvm` | `projeto_vida_mensal_routes.py` | Revisão mensal do PdV |
| `/pvs` | `projeto_vida_semanal_routes.py` | Acompanhamento semanal do PdV |
| `/export` | `routes/export.py` | Exportações de dados (requer aprovação admin) |
| `/channel` | `channel_routes.py` | Canal de grupos (posts e replies) |
| `/push` | `push_routes.py` | VAPID public key, subscribe, unsubscribe |
| `/dev/*` | `routes/dev.py` | Endpoints DEV (só se `ENABLE_DEV_ENDPOINTS=True`) |

### Configuração (`backend/app/settings.py`)

Blocos: APP, SECURITY, DATABASE, REDIS, FIREBASE, SENTRY, VAPID, SENDGRID, CLOUDINARY, FEATURE FLAGS, RATE LIMITING, INVITES.

`validate_production_settings()` bloqueia o boot se em produção faltar `ENCRYPTION_KEY`, `HMAC_PEPPER`, `FIREBASE_PROJECT_ID`, ou se `SECRET_KEY` for o valor padrão.

---

## Frontend

### Roteamento (Expo Router)

`lumen_mobile/app/_layout.tsx` define o Stack raiz com todos os grupos de rotas:

| Grupo / Tela | Localização |
|-------------|-------------|
| Redirect inicial | `app/index.tsx` |
| Auth (login/registro) | `app/(auth)/` |
| Onboarding | `app/(onboarding)/` |
| Tabs principais | `app/(tabs)/` (home, community, service, invites, profile) |
| Admin | `app/admin/` |
| Projeto de Vida | `app/vida/` (index, wizard, revisao, historico) |
| Canal | `app/channel/` |
| Retiros | `app/retreats/` |
| Bíblia | `app/biblia/` |
| Catecismo | `app/catecismo/` |
| Coordenador | `app/coordinator/` |
| Membros | `app/members.tsx` |

### API Client (`lumen_mobile/src/services/api.ts`)

- Fetch nativo (sem axios)
- **`api.get<T>()` retorna `Promise<T>` — o JSON direto. Nunca usar `.data` no retorno.**
- Token: Firebase `getIdToken()` em PROD, AsyncStorage em DEV
- `EXPO_PUBLIC_API_URL` configura o backend (baked em build time — não é runtime)
- 401 → `clearToken()` → Firebase `signOut()`

### Estado global (`lumen_mobile/src/stores/`)

- `authStore.ts` — user, isLoading, isAuthenticated; `initialize()` deve ser chamado explicitamente
- `onboardingStore.ts` — estado do wizard de cadastro

### Variáveis de ambiente frontend

| Variável | Uso |
|---------|-----|
| `EXPO_PUBLIC_API_URL` | URL do backend (baked no build) |
| `EXPO_PUBLIC_SENTRY_DSN` | DSN do Sentry |
| `EXPO_PUBLIC_ENVIRONMENT` | `production` \| `staging` |
| `EXPO_PUBLIC_APP_VERSION` | versão |
| Credenciais Firebase | via `lumen_mobile/src/config/firebase.ts` |

### Vercel (`lumen_mobile/vercel.json`)

- Build: `expo export --platform web` → `dist/`
- SPA: rewrite `/*` → `/index.html`
- Headers: `X-Frame-Options: DENY`, `X-Content-Type-Options`, `Referrer-Policy`
- CSP: **`Content-Security-Policy-Report-Only`** (não enforced ainda — item SEC-01 do roadmap)
- `connect-src` inclui backend produção E staging, Firebase, Sentry, Cloudinary

---

## Banco de dados e migrações

### Engine
PostgreSQL 15, SQLAlchemy 2.0, driver psycopg3. Pool: `DATABASE_POOL_SIZE` + `DATABASE_MAX_OVERFLOW` (padrão prod: 15/20 = 35 conexões). URL automáticamente convertida de `postgresql://` para `postgresql+psycopg://` por validator no settings.

### Modelos principais (`backend/app/db/models.py`)

| Grupo | Modelos |
|-------|---------|
| Usuário | `User`, `UserIdentity`, `UserProfile`, `UserGlobalRole`, `UserPreferences`, `UserPermission`, `UserConsent`, `UserEmergencyContact` |
| Organização | `OrgUnit`, `OrgMembership`, `OrgInvite`, `GlobalRole` |
| Catálogos | `ProfileCatalog`, `ProfileCatalogItem` |
| Inbox | `InboxMessage`, `InboxRecipient`, `InboxMessageAudit` |
| Projeto de Vida | `LifePlanCycle`, `LifePlanDiagnosis`, `LifePlanCore`, `LifePlanGoal`, `LifePlanAction`, `LifePlanSpiritualRoutine`, `LifePlanMonthlyReview` |
| PvM (mensal) | `ProjetoVidaMensal`, `ProjetoVidaAreaMensal`, `ProjetoVidaCompromisso`, `ProjetoVidaComunidade`, `ProjetoVidaCuidado`, `ProjetoVidaPratica`, `ProjetoVidaRevisao`, `ProjetoVidaExame`, `ProjetoVidaIntercessao`, `ProjetoVidaSemanal` |
| Retiros | `Retreat`, `RetreatHouse`, `RetreatFeeType`, `RetreatEligibilityRule`, `RetreatServiceTeam`, `RetreatServiceTeamMember`, `RetreatCoordinator`, `RetreatRegistration`, `RetreatTeamPreference` |
| Canal | `ChannelPost`, `ChannelReply` |
| Push | `PushSubscription`, `NotificationDeliveryLog` |
| Segurança | `SensitiveAccessRequest`, `SensitiveAccessAudit`, `DataExportRequest`, `AuditLog` |
| Legal | `LegalDocument` |
| Verificação | `PhoneVerification`, `EmailVerification` |

### Migrations Alembic (`backend/alembic/versions/`)

44 migrations numeradas de `001_initial_schema` a `044_pvm_evangelizacao_acoes`. Executadas automaticamente no boot via `start.sh` (`alembic upgrade head`). Bug histórico: migrations 009/010 criaram `LegalDocument` duplicados → fix: sempre usar `.limit(1)` em queries de `LegalDocument`.

### Criptografia de dados sensíveis (`backend/app/crypto/service.py`)

- CPF: HMAC-SHA256 (`cpf_hash`) para unicidade + AES-256-GCM (`cpf_encrypted`) para recuperação
- RG: AES-256-GCM (`rg_encrypted`)
- Chaves: `ENCRYPTION_KEY` e `HMAC_PEPPER` (base64, 32 bytes cada). Chaves efêmeras em DEV. Fatal em PROD se ausentes.

---

## Autenticação e permissões

### Firebase Auth (`backend/app/auth/firebase.py`)

- **Sem Firebase Admin SDK.** Busca chaves públicas do Google via HTTPS (`googleapis.com/.../securetoken`) com cache TTL 1h.
- Verifica JWT RS256: audience=`FIREBASE_PROJECT_ID`, issuer=`https://securetoken.google.com/{project_id}`
- Modo DEV: aceita tokens `dev:<uid>:<email>` (hardcoded) — rejeitado explicitamente em PROD
- `AUTH_MODE=PROD` rejeita qualquer token com prefixo `dev:`

### Dependency FastAPI (`backend/app/api/deps.py`)

`CurrentUser` — Annotated type que injeta o usuário autenticado em todos os endpoints protegidos.

### Roles globais (`UserGlobalRole`, tabela no banco)

| Role | Acesso |
|------|--------|
| DEV | Tudo, incluindo `/dev/*` |
| ADMIN | Painel admin completo |
| ANALISTA | Apenas Dashboard de métricas |
| SECRETARY | Pode enviar avisos (inbox) |
| AVISOS | Pode enviar avisos (inbox) |

### Roles por unidade (`OrgMembership`)

`COORDINATOR` ou `MEMBER`. Coordenador pode convidar/remover membros da própria unidade. Coordenador da unidade pai pode remover membros da filha.

### Acesso a documentos sensíveis (CPF/RG)

`SensitiveAccessRequest` com aprovação manual. Sem UI de frontend implementada — apenas DEV consegue ver CPF/RG no estado atual.

### Rate limiting (`backend/app/middlewares/rate_limit.py`)

60 req/min por token (hash SHA-256 do token completo). Backend Redis com fallback em memória. Em CI: `RATE_LIMIT_ENABLED=false`. Staging usa fallback em memória (sem Redis).

---

## Integrações externas

| Integração | Lib | Uso | Status |
|-----------|-----|-----|--------|
| Firebase Auth | `firebase` JS SDK 10 / HTTPS verify | Autenticação | ✅ produção |
| Railway | CLI + Dashboard | Deploy backend + Postgres | ✅ produção |
| Vercel | CLI + Dashboard | Deploy frontend | ✅ produção |
| Sentry | `sentry-sdk[fastapi]` + `@sentry/react` | Erros backend e frontend | ✅ produção (backend); frontend configurado |
| Cloudinary | `cloudinary` 1.40 | Upload comprovantes de retiro | ⚠️ configurado, smoke test pendente |
| SendGrid | `sendgrid` ≥ 6.11 | Email transacional (fallback de push) | ⚠️ configurado, não testado |
| pywebpush | ≥ 2.0 | Web Push VAPID | ✅ staging ativo; produção pendente |
| Brasil API | `brasilApi.ts` | Busca de dados de CEP | ✅ frontend |
| Vercel Analytics | `@vercel/analytics` | Pageviews web | ✅ frontend |

---

## Módulos e funcionalidades

### ✅ Implementados e em produção

**Autenticação e Onboarding**
- Firebase Auth (email/senha)
- Wizard de cadastro 4 passos: conta → dados pessoais → vocacional (opt) → extras (opt)
- Termos de uso com consentimento explícito (re-aceitação forçada por versão)
- Verificação de telefone OTP (feature flag `ENABLE_PHONE_VERIFICATION`)
- Onboarding retomável automaticamente

**Perfil**
- Dados básicos, foto (Cloudinary), CPF/RG criptografados, localização
- Catálogos dinâmicos: Estado de Vida (8), Estado Civil (7), Realidade Vocacional (7)
- Acompanhamento vocacional, interesse em ministério, instrumento musical (13 opções)
- Encontro Despertar (46 opções incluindo Kadosh), contato de emergência

**Organização e Membros**
- Hierarquia: Conselho Geral → Executivo → Setor → Ministério → Grupo → Missão
- Sistema de convites (não auto-solicitação): coordenadores convidam via email
- COORDINATOR / MEMBER por unidade; visibilidade PUBLIC / RESTRICTED
- Canal por unidade: posts e replies; modo COORDINATOR_ONLY ou ALL_MEMBERS

**Inbox / Avisos**
- Criação por ADMIN/AVISOS/SECRETARY/coordenador do Conselho Geral
- Segmentação por unidade ou estado de vida
- Fluxo de aprovação para certos tipos de aviso
- Categorias e deeplinks

**Projeto de Vida (privado por PIN)**
- Wizard de criação (8 passos): realidade vocacional, diagnóstico 5 dimensões, síntese, objetivo, meios, rotina espiritual, diretor espiritual, confirmar
- Revisão mensal com áreas, compromissos, cuidado, comunidade, práticas espirituais
- Acompanhamento semanal, diário de exame de consciência, intercessão, evangelização
- PIN de acesso; histórico de ciclos arquivados
- Scheduler automático para lembretes e revisões

**Retiros / Eventos**
- CRUD completo pelo admin: casas, taxas, regras de elegibilidade, equipes de serviço, coordenadores
- Membros: listagem, detalhes, inscrição, upload de comprovante (Cloudinary)
- Múltiplas modalidades e tipos; visibilidade configurável

**Admin (Admin 2.0 Fase 1 + 1.1)**
- Dashboard de métricas operacionais
- Gestão de usuários e roles globais (DEV, ADMIN, ANALISTA, SECRETARY, AVISOS)
- Gestão de entidades organizacionais
- Aprovações de exportação de dados (requer admin)
- Logs de auditoria (AuditLog)
- Gestão de retiros
- Histórico de avisos enviados

**Segurança (H1→H6A + H5A fixadas)**
- Security headers: HSTS, CSP estrita, X-Frame-Options DENY, X-XSS-Protection 0
- CORS explícito; rate limit por token
- AES-256-GCM para CPF/RG; HMAC-SHA256 para hash de CPF
- 7/7 achados H5A (IDOR/authz) corrigidos em produção
- Endpoints `/dev/*` bloqueados em produção por dependency separada (não só flag)
- Body size limit 1 MB JSON; multipart limit por endpoint
- SensitiveAccessRequest com aprovação para ver CPF/RG

**Push Web (infraestrutura)**
- `GET /push/vapid-public-key`, `POST /push/subscribe`, `DELETE /push/unsubscribe`
- `send_web_push()` via pywebpush; delivery log (`NotificationDeliveryLog`)
- Service Worker `lumen_mobile/public/sw.js`; `push.ts` no frontend
- VAPID configurado em staging; smoke tests manuais pendentes

### ⚠️ Parcialmente implementado / Pendente de validação

**Push Web end-to-end (PROD-01)**
- Backend e frontend 100% implementados
- VAPID configurado em staging (2026-06-15); smoke tests manuais pendentes
- VAPID não configurado em produção (aguarda validação em staging)
- PR #9 em Draft

**Push FCM Mobile (PROD-05)**
- `eas.json` criado com profiles dev/preview/prod
- Integração `expo-notifications` e FCM server key: não implementados

**Email transacional (PROD-03)**
- `email_service.py` e `notification_service.py` existem com lógica de fallback
- `SENDGRID_API_KEY` no settings; envio de email não testado em produção

**CSP enforced (SEC-01)**
- Atualmente `Content-Security-Policy-Report-Only` no Vercel
- Violações logadas, não bloqueadas
- Validação em staging necessária antes de enforced em prod

**Distribuição mobile (MOBILE-01)**
- Assets (icon, splash) são 192×192 px — insuficientes para App Store (1024×1024 req.)
- Contas Apple Developer e Google Play Console não configuradas
- Publicação nas lojas não realizada

### ❌ Não implementado

**LGPD**
- DPO não designado formalmente (LGPD-02)
- ROPA não construído (LGPD-03)
- Política de retenção sem enforcement técnico (LGPD-01)
- Portabilidade de dados `GET /auth/me/export` não existe (LGPD-04)
- Reset de PIN do Projeto de Vida sem fluxo (LGPD-05)

**Outros**
- Pentest externo (SEC-04)
- Analytics Missionais (Ciclo 5 — gate: LGPD-07)
- Runbook de deploy (OPS-03)
- Code splitting do bundle web (MAINT-FE-05)

---

## Estado atual

| Item | Estado |
|------|--------|
| Backend v0.3.0 | ✅ Em produção — Railway |
| Frontend v1.0.0 | ✅ Em produção — Vercel |
| Staging | ✅ Operacional desde 2026-06-15 |
| CI (GitHub Actions) | ✅ frontend tsc+lint+build; backend ruff+pytest+mypy |
| Hardening H1→H6A | ✅ Em produção |
| H5A 7/7 achados | ✅ Corrigidos em produção |
| Admin 2.0 Fase 1.1 | ✅ Em produção |
| Push web infra | ✅ Backend + frontend implementados; VAPID staging ativo |
| LGPD conformidade | ⚠️ Drafts existem; DPO e ROPA pendentes |
| Distribuição mobile | ❌ Lojas não configuradas |
| CSP enforced | ❌ Report-Only apenas |

**PRs recentes:**
- PR #8 mergeado (2026-06-15): staging operacional
- PR #9 (Draft): PROD-01 — Push Web Staging Activation

**Suíte de testes (baseline 2026-06-09):** 159 passed, 0 failed, 0 xfailed.

---

## O que parece validado

- Autenticação Firebase RS256 sem Admin SDK funciona em staging e produção
- Rate limit por token (Redis + fallback memória) — fallback causa burst 429 após CORS desbloqueado
- Criptografia CPF/RG em AES-256-GCM com `ENCRYPTION_KEY` e `HMAC_PEPPER` exclusivos por ambiente
- Push web: `GET /push/vapid-public-key` → 200 OK em staging; chave pública `BIqJBGSa49OdnD8OUG-...`
- Security headers em todas as respostas backend
- CORS explícito: `CORS_ORIGINS` (não `ALLOWED_ORIGINS`) é a variável correta no settings
- `EXPO_PUBLIC_*` são baked em build time — mudar no Vercel exige novo build (push para branch)
- Migrations rodam automaticamente no boot (`start.sh`)
- CI passa em PRs para `main` e `staging` (job `notify` do Discord pode falhar por bug de script — não é gate de qualidade)

---

## Pendências e próximos passos

**P1 imediato (Ciclo 2):**
1. **PROD-01** — Smoke tests manuais de push em staging (sw.js, subscribe, envio, recebimento) → depois configurar VAPID em produção
2. **SEC-01** — Validar CSP enforced em staging → ativar em produção via `vercel.json`
3. **LGPD-02** — Designar DPO (decisão institucional do Conselho)
4. **LGPD-01 / LGPD-03 / LGPD-06** — Política de retenção, ROPA, revisão da Política de Privacidade (após DPO)
5. **MOBILE-01** — Assets redesenhados (1024×1024), contas Apple/Google, `eas init`
6. **PROD-05** — FCM mobile após MOBILE-01
7. **SEC-04** — Contratar pentest externo

**P2 dívida técnica:**
- DS-02: migração completa de ~585 hardcoded colors para tokens
- MAINT-FE-05: code splitting (bundle 11.1 MB sem splitting)
- LGPD-04: portabilidade de dados
- LGPD-05: reset de PIN do PdV

**Backlog técnico baixa prioridade (MAINT-DEP-01):**
- `requirements.txt` diverge de `pyproject.toml` e de `.venv` local
- Arquivos órfãos: `app/api/routes.py`, `app/api/membership_routes.py`, `app/api/dev_routes.py`
- Relatório de auditoria H5A não commitado: `docs/superpowers/audits/2026-06-07-h5a-authz-idor-matrix.md`

---

## Decisões arquiteturais identificadas

| Decisão | Racional | Impacto |
|---------|---------|---------|
| Sem Firebase Admin SDK | Fetcha Google public certs via HTTPS; menor superfície de ataque, sem service account no servidor | Só precisa de `FIREBASE_PROJECT_ID` |
| Monorepo | Backend Python + Frontend RN/Expo no mesmo repo | CI unificado; Railway usa Root Directory `backend/` |
| `EXPO_PUBLIC_*` baked em build | Padrão Expo/RN Web — não é configurável em runtime | Mudar URL de backend exige novo build e deploy |
| Auth via token (não sessão) | Stateless; compatível com Railway multi-instance | Rate limit precisa de Redis para ser consistente entre instâncias |
| CPF/RG com dupla estratégia | HMAC para busca sem decrypt; AES-GCM para recuperação | Duas chaves separadas (`ENCRYPTION_KEY`, `HMAC_PEPPER`) |
| PdV privado por PIN | Conteúdo espiritual inacessível ao admin | Sem endpoint admin de leitura do PdV; PIN sem reset implementado |
| LegalDocument com `.limit(1)` | Migrations anteriores criaram duplicatas | Padrão para todas as queries em `LegalDocument` |
| Web first | iOS/Android suportados pelo codebase mas distribuição não publicada | `Platform.OS` para diferenciar comportamentos |
| `CORS_ORIGINS` (não `ALLOWED_ORIGINS`) | Nome exato do campo em `settings.py` via pydantic-settings | Comum fonte de erro na configuração de novos ambientes |
| Migrations automáticas no boot | `start.sh` roda `alembic upgrade head` antes de subir uvicorn | Seguro para staging/prod; cria risco de lock em deploy simultâneo com múltiplas instâncias |
| Rate limit com fallback memória | Redis down → fallback em memória (sem distribuição entre instâncias) | Em staging sem Redis: burst 429 após CORS desbloqueado é esperado |
| `enable_dev_endpoints` como dependency | `routes/dev.py` tem `_block_in_production` dependency além da flag | Defense in depth — não depende só da flag |

---

## Riscos técnicos e pontos de atenção

| Risco | Severidade | Observação |
|-------|-----------|------------|
| CSP Report-Only (não enforced) | Médio | XSS não bloqueado pelo browser; item SEC-01 |
| 44 vulns npm audit (1 crítica `protobufjs`) | Médio | Todas transitivas Expo SDK 52; sem patch disponível; revisão programada para 2026-12-14 |
| `authStore.isLoading` começa `true` e só vai para `false` após `initialize()` | Médio | Se `initialize()` não for chamado, tela trava; bug histórico documentado |
| `Alert.alert` na web é no-op | Alto (UX) | Silenciosamente bloqueado. Qualquer código que use Alert em tela web perde o feedback de erro |
| Staging sem Redis | Baixo | Rate limit usa memória; burst 429 esperado; aceitável para validação |
| Secrets `ENCRYPTION_KEY`/`HMAC_PEPPER` únicos por ambiente | Alto | Se rotacionados sem migração de dados, CPF/RG existentes se tornam irrecuperáveis |
| `LegalDocument` duplicado legado | Baixo | Já corrigido com `.limit(1)` mas migrações antigas ainda existem |
| VAPID staging ≠ produção (chaves diferentes) | Normal | VAPID staging tem chaves próprias. Subscriptions são vinculadas à chave pública — quando produção for ativada, usuários precisarão se re-inscrever |
| `pyproject.toml` diverge de `requirements.txt` | Baixo | Dockerfile usa `requirements.txt`; `.venv` local usa versões mais novas. Não afeta prod |
| bundle web 11.1 MB sem code splitting | Médio | Carregamento pesado em mobile web; item MAINT-FE-05 |
| Portabilidade de dados LGPD não implementada | Médio | Direito do titular (art. 18, V) atendido manualmente pelo DPO |
| Reset de PIN PdV inexistente | Médio | Membro que perde o PIN perde acesso permanente ao próprio histórico |

---

## Arquivos importantes

### Backend
| Arquivo | Por que ler |
|---------|------------|
| `backend/app/main.py` | Visão completa dos middlewares e routers registrados |
| `backend/app/settings.py` | Todas as variáveis de ambiente com defaults e validação de produção |
| `backend/app/db/models.py` | Schema completo do banco (70+ classes) |
| `backend/app/auth/firebase.py` | Como a verificação JWT funciona sem Admin SDK |
| `backend/app/api/deps.py` | `CurrentUser` — dependency usada por todos os endpoints protegidos |
| `backend/app/crypto/service.py` | Estratégia de criptografia CPF/RG |
| `backend/app/notifications/notification_service.py` | Orquestração push + email com prioridades |
| `backend/requirements.txt` | Deps canônicas (Dockerfile instala daqui, não do pyproject.toml) |
| `backend/start.sh` | Boot de produção: migrations → uvicorn |
| `backend/.env.example` | Todas as variáveis documentadas sem valores |

### Frontend
| Arquivo | Por que ler |
|---------|------------|
| `lumen_mobile/app/_layout.tsx` | Registra todos os grupos de rotas; providers globais |
| `lumen_mobile/src/services/api.ts` | Contrato do API client (fetch, não axios; retorna T direto, não `{data: T}`) |
| `lumen_mobile/src/stores/authStore.ts` | Estado de auth; bug histórico de `isLoading` |
| `lumen_mobile/vercel.json` | Config de build + headers CSP + rewrites SPA |
| `lumen_mobile/public/sw.js` | Service Worker de Web Push |
| `lumen_mobile/src/services/push.ts` | Fluxo de subscribe e registro de push |
| `lumen_mobile/eas.json` | Profiles de build EAS (dev/preview/prod) |

### CI/CD e infra
| Arquivo | Por que ler |
|---------|------------|
| `.github/workflows/ci.yml` | Jobs frontend (tsc+lint+build) e backend (ruff+migrations+pytest) |
| `backend/railway.toml` | Builder DOCKERFILE; healthcheck `/health` |
| `backend/Dockerfile` | python:3.11-slim; instala requirements.txt; CMD = start.sh |

### Documentação
| Arquivo | Por que ler |
|---------|------------|
| `docs/final/01-visao-geral.md` | Produto, módulos, missão, público |
| `docs/final/14-roadmap-pos-rc.md` | 35 itens priorizados P0–P3 |
| `docs/final/05-autenticacao-permissoes.md` | Auth, roles, permissões detalhadas |
| `docs/ops/staging.md` | URLs, env vars e smoke tests do staging |
| `docs/ops/push-web-activation-plan.md` | Estado do PROD-01 e sequência de ativação |
| `docs/ops/csp-plan.md` | Plano para SEC-01 (CSP enforced) |
| `docs/ops/secrets-rotation.md` | Inventário e rotação dos 11 segredos |
| `CLAUDE.md` | Instruções de trabalho para Claude Code neste repositório |

---

## Como rodar localmente

### Backend

```bash
# Pré-requisitos: Python 3.11, PostgreSQL, Redis

cd backend
cp .env.example .env
# Editar .env: DATABASE_URL, REDIS_URL, AUTH_MODE=DEV, ENVIRONMENT=dev

pip install -r requirements.txt
alembic upgrade head
python scripts/seed_dev.py   # opcional — popula dados de dev

# Iniciar
uvicorn app.main:app --reload --port 8000
# /docs disponível em modo DEV
```

**Docker Compose** (`backend/docker-compose.yml`): sobe Postgres + Redis + app.

### Frontend

```bash
cd lumen_mobile
cp .env.example .env.local
# Editar: EXPO_PUBLIC_API_URL=http://localhost:8000

npm install
npm run dev          # Expo dev server
npm run web          # Build web e serve
npm run android      # Emulador Android
npm run ios          # Simulador iOS
```

**Observação:** `EXPO_PUBLIC_API_URL` é baked em build time no Expo. Em `npm run dev` (modo dev), variáveis do `.env.local` são lidas. Em build de produção/staging, a variável deve estar configurada no Vercel antes do build.

---

## Deploy e produção

### Fluxo de branches

```
main        → produção (Railway prod + Vercel prod)
staging     → staging  (Railway staging + Vercel staging)
post-rc/*   → feature branches → PR para staging primeiro → PR de staging para main
```

### Backend (Railway)

- Dockerfile em `backend/Dockerfile` (python:3.11-slim)
- Root Directory no Railway: `backend/` (crítico — sem isso, Railpack falha)
- Healthcheck: `GET /health` timeout 30s
- `start.sh` roda migrations automáticas antes de subir uvicorn
- Variáveis de ambiente configuradas via painel Railway (nunca via CLI para secrets)

**URLs:**
- Produção: `https://backend-production-6efc.up.railway.app`
- Staging: `https://backend-staging-staging-3d47.up.railway.app`

### Frontend (Vercel)

- Build command: `npm run build` (= `expo export --platform web`)
- Output: `dist/`
- Variável `EXPO_PUBLIC_API_URL` é baked no build — mudar exige novo deploy
- CSP: `Content-Security-Policy-Report-Only` (item SEC-01 para enforcement)

**URLs:**
- Produção: `https://lumenplus.vercel.app`
- Staging: `https://lumenplus-git-staging-applumenplus-1605s-projects.vercel.app`

### CI

GitHub Actions em `.github/workflows/ci.yml`:
- Trigger: push/PR para `main` ou `staging`
- Job `frontend`: Node 20, `tsc --noEmit`, `npm run lint`, `expo export`
- Job `backend`: Python 3.11, Postgres 15 + Redis 7 como services, `ruff check`, `alembic upgrade head`, `pytest`, `mypy` (continue-on-error)
- Job `notify` (`.github/workflows/discord-log.yml`): notificação Discord — falha de script não bloqueia merge

### Variáveis de ambiente de produção (não secretas)

| Variável | Valor de referência |
|---------|-------------------|
| `ENVIRONMENT` | `production` |
| `AUTH_MODE` | `PROD` |
| `IS_DEV_AUTH` | `false` |
| `ENABLE_DEV_ENDPOINTS` | `false` |
| `FIREBASE_PROJECT_ID` | `lumenplus-3fec7` |
| `CORS_ORIGINS` | `https://lumenplus.vercel.app,https://api.lumenplus.app` |
| `APP_VERSION` | `0.3.0` |
| `SENTRY_ENVIRONMENT` | `production` |

---

## Contradições ou pontos em aberto

1. **`pyproject.toml` vs `requirements.txt`:** O Dockerfile instala `requirements.txt` (Python 3.11, pins mais antigos). O `pyproject.toml` tem pins diferentes e não é usado no deploy. O `.venv` local pode ter Python 3.14 com versões mais novas. Risk: divergência de comportamento entre dev e prod.

2. **`authStore.initialize()` não é chamado automaticamente:** O store começa com `isLoading: true` para sempre se `initialize()` não for chamado. A documentação alerta, mas é fácil introduzir regressão em novas telas.

3. **VAPID staging ≠ produção:** Chaves diferentes geradas para staging (2026-06-15). Quando produção receber VAPID, subscriptions de usuários reais precisarão ser re-feitas. Deve usar as mesmas chaves do staging se o objetivo for preservar subscriptions.

4. **`backend/lumen_mobile/` (symlink/cópia):** Existe um `lumen_mobile/` dentro de `backend/` — provavelmente artifact de alguma operação passada. Merece investigação para verificar se é ativo ou resíduo.

5. **`docs/superpowers/audits/2026-06-07-h5a-authz-idor-matrix.md`:** Arquivo criado mas não commitado (untracked). Relatório de auditoria de segurança importante que pode ser perdido.

6. **`retreat_module` tem dois arquivos de migration com prefixo `009_`:** `009_legal_documents_v1.py` e `009_retreat_module.py` — numeração duplicada. O Alembic resolve pela chain de `down_revision`, mas pode causar confusão.

7. **`api.lumenplus.app`** aparece no `api.ts` e no CSP como domínio canônico do backend. A URL atual de produção é `backend-production-6efc.up.railway.app`. Não está claro se `api.lumenplus.app` é um alias ativo ou um domínio planejado.

---

## Recomendações para a wiki

- **Manter este snapshot datado** — o projeto evolui rapidamente. Próximo snapshot recomendado após Ciclo 2 concluído.
- **Seção "Armadilhas conhecidas"** merece página própria na wiki: `api.get()` vs `.data`, `authStore.isLoading`, `CORS_ORIGINS` vs `ALLOWED_ORIGINS`, `EXPO_PUBLIC_*` baked, `LegalDocument .limit(1)`, Railpack root dir.
- **Diagrama de fluxo de autenticação** seria valioso: Firebase SDK → token → backend verify → `CurrentUser` dependency.
- **Mapa de routers** pode ser extraído de `main.py` e cruzado com os arquivos de routes para ter um índice de endpoints.
- **Estado do PROD-01** deve ser atualizado quando smoke tests manuais forem concluídos em staging.
- **Nunca commitar `ENCRYPTION_KEY` ou `HMAC_PEPPER`** — se rotacionados, dados existentes se tornam irrecuperáveis sem migração de dados.
