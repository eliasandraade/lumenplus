# Lumen+ — Backend

**Versão da documentação:** 1.0  
**Data:** 2026-06-12  
**Audiência:** desenvolvedor, operador de deploy

---

## Visão Geral

O backend do Lumen+ é uma API RESTful construída com Python 3.12 e FastAPI. Hospedado no Railway, expõe todos os dados, regras de negócio e controles de segurança da plataforma. O banco de dados é PostgreSQL, gerenciado com SQLAlchemy e Alembic.

**Versão em produção:** 0.3.0  
**URL de produção:** `https://backend-production-6efc.up.railway.app`  
**Health check:** `GET /health` → `{"status":"healthy","version":"0.3.0"}`

---

## Estrutura de Diretórios

```
backend/app/
├── api/
│   ├── routes/
│   │   ├── auth.py               # /auth/*
│   │   ├── organization.py       # /org/*
│   │   ├── admin.py              # /admin/* (usuários, dashboard, audit)
│   │   ├── export.py             # /admin/export/*
│   │   └── dev.py                # /dev/* (apenas em AUTH_MODE=DEV)
│   ├── profile_routes.py         # /profile/*
│   ├── inbox_routes.py           # /inbox/*
│   ├── legal_routes.py           # /legal/*
│   ├── verification_routes.py    # /verify/*
│   ├── retreat_routes.py         # /retreats/* (área do membro)
│   ├── admin_routes.py           # /admin/* (acesso sensível CPF/RG)
│   ├── admin_retreat_routes.py   # /admin/retreats/*
│   ├── channel_routes.py         # /channel/*
│   ├── life_plan_routes.py       # /life-plan/*
│   ├── projeto_vida_mensal_routes.py   # /projeto-vida-mensal/*
│   ├── projeto_vida_semanal_routes.py  # /projeto-vida-semanal/*
│   ├── push_routes.py            # /push/*
│   └── deps.py                   # CurrentUser, DBSession
├── audit/service.py              # create_audit_log()
├── auth/firebase.py              # Validação de tokens Firebase
├── crypto/service.py             # AES-256-GCM + HMAC-SHA256
├── db/
│   ├── models.py                 # Todos os modelos SQLAlchemy
│   └── session.py                # get_db()
├── middlewares/
│   ├── exceptions.py             # Handler global de erros
│   ├── logging.py                # Structured logging (Structlog)
│   ├── rate_limit.py             # Rate limiting por IP (Redis)
│   └── request_id.py             # X-Request-ID em todas as respostas
├── schemas/                      # Schemas Pydantic por domínio
├── services/                     # Regras de negócio por domínio
├── main.py                       # FastAPI app + registro de rotas + middlewares
└── settings.py                   # Configurações via Pydantic Settings
```

---

## Domínios e Endpoints

### Auth (`/auth`)

| Endpoint | Acesso | Descrição |
|----------|--------|-----------|
| `POST /auth/register` | público (DEV only) | Cria usuário + perfil vazio + registra identidade. Retorna 501 em produção. |
| `POST /auth/login` | público (DEV only) | Valida token Firebase, retorna dados do usuário. Retorna 501 em produção. |
| `GET /auth/me` | autenticado | Retorna usuário atual com memberships, papéis e convites pendentes. |
| `DELETE /auth/me` | autenticado | Soft delete do próprio usuário + exclusão no Firebase. |

### Perfil (`/profile`)

| Endpoint | Acesso | Descrição |
|----------|--------|-----------|
| `GET /profile` | autenticado | Retorna perfil com labels de catálogo resolvidos. |
| `PUT /profile` | autenticado | Cria ou atualiza perfil (idempotente). CPF/RG são criptografados. |
| `GET /profile/catalogs` | autenticado | Lista catálogos: LIFE_STATE, MARITAL_STATUS, VOCATIONAL_REALITY. |
| `POST /profile/emergency-contact` | autenticado | Upsert de contato de emergência (1 por usuário). |

**Campos condicionais do perfil:**
- `consecration_year` → obrigatório se `vocational_reality = CONSAGRADO_FILHO_DA_LUZ`
- `vocational_accompanist_name` → obrigatório se `has_vocational_accompaniment = true`
- `instrument_names` e `music_availability` → presentes se `plays_instrument = true`

### Organização (`/org`)

Hierarquia em 5 níveis: `CONSELHO_GERAL → CONSELHO_EXECUTIVO → SETOR → MINISTERIO → GRUPO`

| Endpoint | Acesso | Descrição |
|----------|--------|-----------|
| `GET /org/tree` | autenticado | Árvore completa; unidades RESTRICTED filtradas para não-membros. |
| `GET /org/ministries` | autenticado | Lista plana de ministérios ativos. |
| `POST /org/units/{id}/children` | coordenador | Cria unidade filha. |
| `PATCH /org/units/{id}` | coordenador | Atualiza unidade. |
| `GET /org/units/{id}/members` | autenticado | Lista membros com papéis; e-mail mascarado para não-membros de RESTRICTED. |
| `POST /org/units/{id}/invites` | coordenador | Envia convite. |
| `POST /org/invites/{id}/accept` | dono do convite | Aceita convite. |
| `GET /org/my/invites` | autenticado | Convites pendentes do usuário atual. |
| `GET /org/my/memberships` | autenticado | Memberships ativas do usuário atual. |

### Inbox / Avisos (`/inbox`)

Sistema de mensagens internas com escopo flexível de destinatários.

Filtros de envio disponíveis: por unidade, por realidade vocacional, por estado de vida, por estado civil, por UF/cidade, ou global (requer papel especial).

Permissões de envio verificadas em `GET /inbox/permissions`. Avisos críticos (escopo global ou com destinatários sensíveis) passam por fluxo de aprovação (`/inbox/approval`).

### Legal (`/legal`)

- `GET /legal/latest` — público (sem autenticação); retorna documentos vigentes (TERMS, PRIVACY)
- `POST /legal/accept` — autenticado; registra aceite com timestamp, versão e flags de opt-in

O frontend bloqueia acesso ao app até que o usuário aceite as versões vigentes.

### Verificação (`/verify`)

- **Telefone:** gera código de 6 dígitos; envia via WhatsApp/SMS em produção; retorna no response em DEV
- **E-mail:** gera token de 32+ chars; envia por e-mail; confirma via link
- Expiração configurável; máximo de 3 tentativas por código

### Retiros (`/retreats` e `/admin/retreats`)

**Área do membro:** listagem, detalhe, inscrição, upload de comprovante, cancelamento.  
**Área admin:** criação, publicação, gerenciamento de casas/taxas/equipes, confirmação de pagamentos, exportação de lista.

Estrutura de um retiro:
```
Retiro
├── Casas (acomodações com capacidade)
├── Taxas (por tipo de participação)
├── Regras de Elegibilidade
├── Inscrições (PARTICIPANT | SERVICE_TEAM)
└── Equipes de Serviço (por função)
```

### Admin (`/admin`)

Acesso restrito por papel global (DEV, ADMIN, ANALISTA, SECRETARY).

| Endpoint | Acesso | Descrição |
|----------|--------|-----------|
| `GET /admin/users` | ADMIN/DEV/SECRETARY | Lista usuários com filtros. |
| `GET /admin/users/{id}/profile` | ADMIN/DEV/SECRETARY | Perfil completo. CPF/RG exigem SensitiveAccessRequest aprovada ou papel DEV (H5A-01 corrigido). |
| `PATCH /admin/users/{id}` | ADMIN/DEV | Edita papéis do usuário. |
| `DELETE /admin/users/{id}` | ADMIN/DEV | Anonimiza conta. DEV exclui qualquer conta exceto si mesmo e contas DEV. ADMIN exclui apenas contas sem papel DEV ou ADMIN. Idempotente. |
| `GET /admin/dashboard` | ADMIN/DEV/ANALISTA | Métricas operacionais agregadas. |
| `GET /admin/audit-logs` | ADMIN/DEV/ANALISTA | Logs de auditoria de ações sensíveis. |

**Acesso a documentos sensíveis (CPF/RG):**

`GET /admin/users/{id}/profile` aplica o seguinte controle (H5A-01, corrigido em H5B):
- **DEV:** acesso direto (bypass)
- **ADMIN/SECRETARY:** recebem `cpf=null, rg=null` a menos que exista uma `SensitiveAccessRequest` APROVADA e não expirada para (solicitante, alvo)

Para obter CPF/RG sem papel DEV:

1. Solicitante (SECRETARY/DEV) cria request com justificativa → `POST /admin/sensitive-access/request`
2. Aprovador (ADMIN/DEV, diferente do solicitante) aprova → `POST /admin/sensitive-access/{id}/approve`
3. Acesso liberado por janela de tempo → `GET /admin/users/{id}/documents` (ou `/profile`)
4. Acesso registrado em `audit_logs` com IP e user-agent

### Projeto de Vida (`/life-plan` e `/projeto-vida-mensal`)

Todos os endpoints dessas rotas verificam `user_id == current_user.id` — seja diretamente ou via JOIN ao recurso pai. Nenhum dado de Projeto de Vida de um usuário é acessível por outro usuário ou por rotas de admin.

O PIN do Projeto de Vida é validado no servidor (`POST /projeto-vida-mensal/{id}/pin/verificar`) com lockout após tentativas incorretas.

---

## Modelo de Dados (principais entidades)

| Entidade | Descrição |
|----------|-----------|
| `User` | Usuário do sistema; `firebase_uid` para identificação; soft-delete |
| `UserProfile` | Dados pessoais, documentos (CPF/RG criptografados), estado de vida |
| `GlobalRole` | Papel global do usuário (DEV, ADMIN, ANALISTA, etc.) |
| `OrgUnit` | Unidade organizacional em hierarquia de 5 níveis |
| `OrgMembership` | Pertencimento de User a OrgUnit com papel (COORDINATOR/MEMBER) |
| `InboxMessage` | Aviso enviado; `recipients` vinculados via `InboxRecipient` |
| `Retreat` | Retiro com casas, taxas, regras de elegibilidade |
| `RetreatRegistration` | Inscrição de usuário em retiro com status de pagamento |
| `LifePlanCycle` | Ciclo de Projeto de Vida (life-plan) |
| `ProjetoVidaMensal` | Ciclo mensal do Projeto de Vida (própria feature CP8) |
| `AuditLog` | Log imutável de ações sensíveis |
| `UserConsent` | Aceite de termos e política pelo usuário |

Todos os identificadores são **UUID** (não sequenciais), o que reduz explorabilidade de IDOR por enumeração.

---

## Migrações

Alembic gerencia as migrações. Convenção de nome: `NNN_descricao_snake_case.py`. A fonte de verdade é o diretório `backend/alembic/versions/`.

O repositório contém 44 arquivos de migração numerados (001–044), cobrindo desde o schema inicial até os módulos de Projeto de Vida Mensal (CP8), canal de grupos, push notifications e Analytics. Alguns números têm variantes (ex.: 009 e 010 aparecem em dois arquivos cada, resultado de branches paralelos que foram mergeados).

| Faixa | Escopo principal |
|-------|-----------------|
| 001–008 | Schema inicial, cadastro, catálogos, perfil, inbox, permissões |
| 009–013 | Documentos legais, módulo de retiros, papel Analista, DPO |
| 014–021 | Retiros: casas, taxas, elegibilidade, equipes, coordenadores, `retreat_scope`, campos de música |
| 022–031 | Índices de performance, módulo Life Plan, seed de catálogos, profile overhaul, inbox aprovação, unidade MISSÃO |
| 032–044 | Projeto de Vida Mensal completo: PIN, revisão, áreas, exame, semanal, intercessão, evangelização |

> Consultar `backend/alembic/versions/` para a lista exata e o `alembic current` para o estado aplicado em cada ambiente.

**Comandos:**

```bash
alembic current          # estado atual
alembic upgrade head     # aplicar todas as pendentes
alembic downgrade -1     # reverter uma migração
alembic revision --autogenerate -m "descricao"  # nova migração pelo diff
```

---

## Segurança e Hardening

O backend passou por ciclo de hardening H1→H6A entre maio e junho/2026.

### Criptografia de Documentos

CPF e RG são armazenados com dupla proteção:

```python
# CPF
cpf_hash = HMAC-SHA256(cpf_digits, hmac_pepper)     # busca e unicidade
cpf_encrypted = AES-256-GCM(cpf_digits, encryption_key)  # recuperação

# RG
rg_encrypted = AES-256-GCM(rg_string, encryption_key)
```

As chaves (`ENCRYPTION_KEY`, `HMAC_PEPPER`) são geradas aleatoriamente e configuradas via variáveis de ambiente. Nunca são hardcoded.

### Middlewares (ordem de execução)

1. `RequestIDMiddleware` — adiciona `X-Request-ID` a todas as respostas
2. `CORSMiddleware` — origens permitidas via `CORS_ORIGINS`
3. `RateLimitMiddleware` — por IP via Redis; retorna 429 ao exceder
4. `LoggingMiddleware` — log estruturado (Structlog) de cada requisição
5. `ExceptionHandler` — captura exceções não tratadas sem vazar stack trace

### Headers de Segurança (H1)

Adicionados via middleware: HSTS, CSP (`default-src 'none'; frame-ancestors 'none'`), `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy`.

### Audit Log (H6)

Ações sensíveis são registradas com `create_audit_log()`:

```python
create_audit_log(
    db=db,
    actor_user_id=current_user.id,
    action="profile_updated",
    entity_type="user_profile",
    entity_id=str(user_id),
    ip=request.client.host,
    user_agent=request.headers.get("user-agent"),
    metadata={"status": "COMPLETE"},
)
```

### Autorização IDOR (H5A)

Auditoria de ~140 endpoints em jun/2026. Resultado: todos os endpoints de dados sensíveis (Projeto de Vida, inscrições de retiro, perfil, inbox) aplicam `WHERE user_id = current_user.id` ou equivalente. Dois achados pós-RC documentados (H5A-01, H5A-02) não afetam membros regulares.

---

## Testes

```bash
# Todos os testes
cd backend && pytest

# Com cobertura
pytest -v --cov=app --cov-report=term-missing

# Teste específico
pytest tests/test_auth.py::test_register -v
```

**Fixtures principais (`tests/conftest.py`):**

| Fixture | Descrição |
|---------|-----------|
| `client` | TestClient do FastAPI com banco SQLite em memória |
| `db` | Sessão de banco isolada por teste |
| `auth_headers` | Headers `Authorization: Bearer dev:...` para testes autenticados |
| `test_user` | Usuário criado no banco de teste |

O banco de testes usa SQLite em memória — cada teste roda em sessão isolada. Não há dependência de banco externo para rodar os testes.

A suíte inclui 25+ arquivos de teste, cobrindo auth, perfil, organização, inbox, legal, retiros, Projeto de Vida Mensal, segurança (rate limit, body size, upload) e regressões de autorização H5B (três suítes de regressão IDOR). Rodar `pytest` para obter o resultado atualizado antes de cada release.

---

## Configuração

Todas as configurações são lidas de variáveis de ambiente via `Pydantic Settings` (`app/settings.py`):

| Variável | Descrição | Produção |
|----------|-----------|---------|
| `AUTH_MODE` | `PROD` ou `DEV` | `PROD` |
| `DATABASE_URL` | URL do PostgreSQL | Railway |
| `REDIS_URL` | URL do Redis | Railway |
| `SECRET_KEY` | Chave secreta da aplicação | 32+ bytes aleatórios |
| `ENCRYPTION_KEY` | Chave AES-256-GCM (base64, 32 bytes) | Gerada aleatoriamente |
| `HMAC_PEPPER` | Pepper HMAC-SHA256 (base64, 32 bytes) | Gerado aleatoriamente |
| `FIREBASE_PROJECT_ID` | ID do projeto Firebase | Configurado |
| `ENABLE_DEV_ENDPOINTS` | Liga/desliga `/dev/*` | `false` |
| `DEBUG_VERIFICATION_CODE` | Retorna código de verificação na resposta | `false` |
| `ENABLE_AUDIT` | Ativa registro de audit log | `true` |
| `SENTRY_DSN` | DSN do Sentry para erros | Configurado |

A configuração de produção passou por auditoria (H0, jun/2026): 9/9 verificações de segurança aprovadas; todos os secrets fortes, sem valores default.

---

## Deploy (Railway)

O backend é deployado no Railway a partir da branch `main`.

```bash
# Início rápido em desenvolvimento local
docker compose up -d          # PostgreSQL + Redis locais
pip install -e ".[dev]"       # dependências
alembic upgrade head          # migrações
uvicorn app.main:app --reload # servidor (http://localhost:8000)
# Swagger: http://localhost:8000/docs
```

**Setup inicial (uma vez, em DEV):**

```bash
POST /dev/seed                    # Cria roles e documentos legais
POST /dev/assign-global-role      # Atribui papel DEV ao primeiro usuário
POST /org/units  (type=CONSELHO_GERAL)  # Cria raiz da hierarquia
```

Em produção, o Railway executa automaticamente `alembic upgrade head` no boot via Procfile/start command.

---

## Próxima leitura

- **Frontend em detalhe:** `04-frontend.md`
- **Autenticação e permissões:** `05-autenticacao-permissoes.md`
- **Segurança e hardening completo:** `11-seguranca-hardening.md`
- **Deploy e variáveis de ambiente:** `12-deploy-ambientes.md`
- **LGPD e dados sensíveis:** `13-lgpd-dados-sensiveis.md`
