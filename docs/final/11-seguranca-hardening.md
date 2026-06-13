# Lumen+ — Segurança e Hardening

**Versão da documentação:** 1.0  
**Data:** 2026-06-12  
**Audiência:** desenvolvedor, operador de segurança

---

## Visão Geral

O ciclo de hardening do Lumen+ é estruturado em subfases H0–H6A, cobrindo cabeçalhos HTTP, rate limiting, limites de upload, auditoria IDOR e logs de auditoria. Este documento descreve o estado atual (o que está em produção), o que foi corrigido e o que permanece como pendência documentada.

---

## H0 — Baseline (Auditoria Inicial)

A auditoria H0 (jun/2026) documentou o estado de segurança antes de qualquer hardening.

### Resultado: Variáveis de ambiente críticas (9/9 passaram)

| Variável | Status H0 |
|----------|-----------|
| `AUTH_MODE=PROD` | Confirmado |
| `ENABLE_DEV_ENDPOINTS=False` | Confirmado |
| `DEBUG_VERIFICATION_CODE=False` | Confirmado |
| `ENCRYPTION_KEY` (set, 32 bytes) | Confirmado |
| `HMAC_PEPPER` (set, 32 bytes) | Confirmado |
| `FIREBASE_PROJECT_ID` (set) | Confirmado |
| `SECRET_KEY` (alterado de default) | Confirmado |
| `ENABLE_AUDIT=True` | Confirmado |
| `ENABLE_SENSITIVE_ACCESS=True` | Confirmado |

### Lacunas identificadas no H0

| Item | Estado H0 | Resolução |
|------|-----------|-----------|
| Backend sem HSTS | Ausente | Corrigido em H1 |
| Backend sem CSP | Ausente | Corrigido em H1 |
| Frontend sem headers de segurança | Ausente | Corrigido em H2 |
| Rate limit com hash de prefixo (ineficaz) | Bug ativo | Corrigido em H3 |
| Upload sem limite de tamanho | Ausente | Corrigido em H4 |
| npm audit — 41 vulnerabilidades runtime | Pendente | Ver nota abaixo |

**npm audit (estado H0):** 41 vulnerabilidades de runtime identificadas (1 crítica: `protobufjs`; 22 high). A maioria está vinculada ao Expo SDK 52 — dependências transitivas sem patch disponível na época da auditoria. Não há evidência de secrets hardcoded no código-fonte.

---

## H1 — Cabeçalhos de Segurança (Backend)

**Status: em produção.**

O backend (FastAPI) aplica os seguintes cabeçalhos via middleware em `backend/app/main.py:205`:

| Cabeçalho | Valor em produção |
|-----------|------------------|
| `Strict-Transport-Security` | `max-age=31536000; includeSubDomains` |
| `Content-Security-Policy` | `default-src 'none'; frame-ancestors 'none'` (API-only) |
| `X-Content-Type-Options` | `nosniff` |
| `X-Frame-Options` | `DENY` |
| `Referrer-Policy` | `strict-origin-when-cross-origin` |
| `X-XSS-Protection` | `0` |

**Sobre `X-XSS-Protection: 0`:** esse header **desativa** o filtro de XSS embutido em browsers legados (IE, Chrome antigo). A remoção é intencional e alinhada com OWASP — o filtro legado foi deprecado por introduzir vulnerabilidades próprias. A defesa real contra XSS é combinação de CSP, escaping adequado no frontend e uso de frameworks que sanitizam output. Não confundir com "proteção XSS ativa" — é o oposto.

**Sobre a CSP do backend (`default-src 'none'; frame-ancestors 'none'`):** esta CSP é **enforced** (não Report-Only). Como a API serve apenas JSON e não carrega recursos externos, a política estrita é segura. `frame-ancestors 'none'` bloqueia a API de ser carregada em iframes (complementar ao `X-Frame-Options: DENY`).

**Notas de implementação:**

- Em dev, os paths `/docs` e `/redoc` recebem uma CSP relaxada (permite CDN, inline scripts) — esses endpoints **não existem em produção** (`docs_url=None` em `settings.is_production`).
- O header `Server: railway-hikari` é reinjetado pelo Railway no edge — fora do controle da aplicação.
- `preload` no HSTS foi omitido intencionalmente (requer validação de domínio e subdomínios antes de ativar).

---

## H2 — Cabeçalhos de Segurança (Frontend)

**Status: em produção.**

O frontend (Vercel SPA) aplica cabeçalhos via `lumen_mobile/vercel.json`:

| Cabeçalho | Valor |
|-----------|-------|
| `X-Frame-Options` | `DENY` |
| `X-Content-Type-Options` | `nosniff` |
| `Referrer-Policy` | `strict-origin-when-cross-origin` |
| `Content-Security-Policy-Report-Only` | (ver abaixo) |

**Distinção crítica de efetividade:**

| Cabeçalho | Modo | Efeito |
|-----------|------|--------|
| `X-Frame-Options: DENY` | Enforced | **Bloqueia** carregamento em iframe (clickjacking) |
| `X-Content-Type-Options: nosniff` | Enforced | **Bloqueia** MIME sniffing |
| `Referrer-Policy` | Enforced | Controla referrer em links externos |
| `Content-Security-Policy-Report-Only` | **Report-Only** | **Apenas monitora violações — não bloqueia nada** |

O `Content-Security-Policy-Report-Only` registra violações para diagnóstico mas não impede execução de scripts ou carregamento de recursos. A proteção real contra XSS via CSP só vigorará quando o header for promovido a `Content-Security-Policy` (enforced). A política cobre: `default-src 'self'`, `script-src 'self' 'unsafe-inline' 'unsafe-eval' blob:`, Firebase, Sentry, Cloudinary e origens do backend.

> **Pendência POST-RC:** migrar `Content-Security-Policy-Report-Only` → `Content-Security-Policy` (enforced) após validar que nenhuma fonte legítima é bloqueada. Enquanto isso, a defesa contra clickjacking é real (X-Frame-Options + frame-ancestors 'none' no backend); a defesa CSP é apenas observatória no frontend.

---

## H3 — Rate Limiting (Correção do Identificador de Cliente)

**Status: em produção.**

O middleware de rate limiting (`backend/app/middlewares/rate_limit.py`) opera com Redis (fixed window, fallback em memória).

**Como o identificador de cliente é determinado** (lógica atual, `rate_limit.py:81-101`):

| Situação da requisição | Identificador usado | Bucket |
|----------------------|--------------------|----|
| Header `Authorization: Bearer <token>` presente | `auth:sha256(token)[:16]` | **Por token** — cada sessão autenticada tem seu bucket independente |
| Sem auth, mas com `X-Forwarded-For` | `ip:<primeiro IP da cadeia>` | **Por IP** (confiável apenas atrás de proxy reverso — Railway é) |
| Sem auth, sem X-Forwarded-For | `ip:<request.client.host>` | **Por IP do socket** |
| Sem qualquer identificador | `ip:unknown` | **Bucket único compartilhado** por todos nessa situação |

```python
# backend/app/middlewares/rate_limit.py:81-101
def _get_client_id(self, request: Request) -> str:
    auth = request.headers.get("authorization", "")
    if auth.startswith("Bearer "):
        token = auth[7:]
        token_hash = hashlib.sha256(token.encode()).hexdigest()[:16]
        return f"auth:{token_hash}"
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return f"ip:{forwarded.split(',')[0].strip()}"
    if request.client:
        return f"ip:{request.client.host}"
    return "ip:unknown"
```

**Bug corrigido em H3:** antes da correção, o código usava apenas os primeiros ~20 caracteres do token Bearer. Para tokens JWT Firebase RS256, esses caracteres são o header base64 (`{"alg":"RS256",...}`), **idêntico em todos os tokens** — toda a base de usuários compartilhava o mesmo bucket, tornando o rate limit ineficaz por token.

**Limitações conhecidas:**
- O limite é 60 req/min por token/IP — sem distinção de endpoint (um endpoint pesado consome a mesma cota que chamadas leves)
- Requisições sem header de autenticação e sem `X-Forwarded-For` identificável caem em `ip:unknown` e compartilham cota

O token bruto nunca é logado — apenas o hash truncado.

**Configuração (via env vars):**

| Variável | Default | Produção |
|----------|---------|---------|
| `RATE_LIMIT_ENABLED` | `True` | `True` |
| `RATE_LIMIT_REQUESTS_PER_MINUTE` | `60` | `60` |
| `RATE_LIMIT_VERIFICATION_PER_HOUR` | `5` | `5` |
| `REDIS_URL` | `redis://localhost:6379/0` | Configurado em Railway |

---

## H4 — Limites de Tamanho de Payload

**Status: em produção.**

Dois limites independentes foram implementados — com escopos distintos:

| Tipo de requisição | Limite | Onde é aplicado | Retorno se exceder |
|-------------------|--------|----------------|-------------------|
| JSON / form (não-multipart) | **1 MB** | Middleware global em `main.py:154` | HTTP 413 |
| Multipart / upload de arquivo | **8 MB** | Endpoint de comprovante de pagamento em `retreat_routes.py:62` | HTTP 413 |

### Limite global de body JSON (1 MB)

```python
# backend/app/main.py:150
MAX_JSON_BODY_BYTES = 1 * 1024 * 1024  # 1 MB
```

Aplicado a **qualquer** requisição não-multipart (JSON, form). O middleware verifica o header `Content-Length`; se declarado e acima do limite, retorna 413 antes de ler o body. Requisições sem `Content-Length` **não são bloqueadas pelo middleware** — o parsing downstream é responsável. Requisições multipart são excluídas explicitamente (o middleware as ignora).

### Limite de upload multipart (8 MB)

```python
# backend/app/api/retreat_routes.py:62
MAX_UPLOAD_BYTES = 8 * 1024 * 1024  # 8 MB
```

Aplicado no endpoint de upload de comprovante de pagamento de retiro. O limite é duplo: (1) verificado pelo `Content-Length` declarado; (2) verificado pela leitura efetiva (`file.read(MAX_UPLOAD_BYTES + 1)` — se o conteúdo real exceder, também retorna 413). Outros endpoints de upload (banner de retiro, foto de perfil) não foram confirmados com limite explícito análogo no código auditado.

---

## H5A — Auditoria IDOR (~140 endpoints)

**Status: auditoria concluída; correções H5A-01, H5A-02 e H5A-07 em produção. H5A-03 e H5A-04 permanecem como suspeitos documentados.**

A auditoria H5A (jun/2026) revisou aproximadamente 140 endpoints do backend para verificar autorização por objeto (IDOR — Insecure Direct Object Reference).

### Achados e Status

| ID | Endpoint / Área | Severidade | Status |
|----|----------------|-----------|--------|
| H5A-01 | `GET /admin/users/{user_id}/profile` retornava CPF/RG sem verificar aprovação de acesso sensível | Alta (🟠) | **CORRIGIDO em H5B** |
| H5A-02 | `edit_reply` / `delete_reply` não validavam `org_unit_id` da rota — coordenador de unidade A poderia editar reply da unidade B | Alta (🟠) | **CORRIGIDO em H5B** |
| H5A-03 | `GET /org/units/{id}` sem verificação de visibilidade — retornava metadados de unidades RESTRICTED sem checar membership | Médio (🟡) | **CORRIGIDO em H5B** |
| H5A-04 | `POST /admin/export/{id}/approve` sem guard de auto-aprovação — solicitante podia aprovar a própria exportação sensível | Médio (🟡) | **CORRIGIDO em H5B** |
| H5A-05 | Endpoints `/dev/*` (`make_me_dev`, `grant_inbox_permission`, `seed_database`) permitiam auto-escalação — só protegidos pela flag `ENABLE_DEV_ENDPOINTS` | Médio (🟡) | **CORRIGIDO em H5B** |
| H5A-06 | `PUT /profile` aceitava `vocational_accompanist_user_id` arbitrário e ecoava o `full_name` do usuário referenciado — info disclosure de nome de terceiro | Baixo (🟢) | **CORRIGIDO em H5B** |
| H5A-07 | `POST /push/subscribe` reatribuía `user_id` de subscription existente (takeover silencioso) | Baixo (🟢) | **CORRIGIDO em H5B** |

**Todos os recursos usam UUIDs** como identificadores — reduz o risco de enumeração por sequência numérica.

### H5A-01 — Detalhes do Fix

O endpoint `GET /admin/users/{user_id}/profile` agora verifica a existência de `SensitiveAccessRequest` aprovada e não expirada antes de retornar CPF/RG. Sem aprovação, retorna `cpf=null, rg=null`. DEV tem bypass direto (comportamento intencional documentado).

### H5A-02 — Detalhes do Fix

```python
# backend/app/api/channel_routes.py (~linha 382)
post = db.query(ChannelPost).join(OrgUnit).filter(
    ChannelPost.id == post_id,
    ChannelPost.org_unit_id == org_unit_id  # ← garante que o post pertence à unidade da rota
).first()
```

O JOIN com `ChannelPost` garante que `post.org_unit_id == org_unit_id` da rota antes de qualquer operação de edit/delete em reply.

### H5A-03 — Detalhes do Fix

**Achado original:** `GET /org/units/{org_unit_id}` retornava nome, descrição, visibilidade e slug de qualquer unidade por UUID, sem checar se o usuário tinha acesso. As rotas `/org/tree` e `/org/units/{id}/members` já filtravam unidades RESTRICTED para não-membros; esta rota não.

**Correção (H5B, em produção):** o endpoint agora aplica a mesma regra de visibilidade usada pelas outras rotas da organização:

```python
# backend/app/api/routes/organization.py:360-368
# SEGURANÇA (H5A-03): unidade RESTRICTED só é visível para membro ou admin.
# Reusa get_user_permissions.can_view (PUBLIC ∨ membro ∨ DEV/ADMIN), o mesmo
# critério reportado por GET /org/units/{id}/permissions e consistente com a
# filtragem de /org/tree e /org/units/{id}/members.
if not get_user_permissions(db, user.id, org_unit_id)["can_view"]:
    raise HTTPException(
        status_code=403,
        detail={"error": "forbidden", "message": "Você não tem acesso a esta unidade"},
    )
```

### H5A-04 — Detalhes do Fix

**Achado original:** `POST /admin/export/{export_id}/approve` não impedia que o solicitante aprovasse a própria exportação de dados sensíveis. Um usuário com papel COUNCIL_GENERAL, DEV ou ADMIN poderia solicitar e aprovar sozinho — inconsistente com o endpoint `approve_sensitive_access` (que proíbe auto-aprovação explicitamente).

**Correção (H5B, em produção):** adicionado guard de separação de deveres, espelhando `approve_sensitive_access`:

```python
# backend/app/api/routes/export.py:477-486
# SEGURANÇA (H5A-04): separação de deveres — quem solicitou não pode aprovar
# a própria exportação. Espelha approve_sensitive_access.
if export_req.requested_by == current_user.id:
    raise HTTPException(
        status_code=403,
        detail={
            "error": "self_approval_denied",
            "message": "Não é permitido aprovar sua própria solicitação de exportação.",
        },
    )
```

### H5A-07 — Detalhes do Fix

```python
# backend/app/api/push_routes.py
existing = db.query(PushSubscription).filter_by(endpoint=endpoint).first()
if existing and existing.user_id != current_user.id:
    raise HTTPException(status_code=409, detail="Endpoint already registered to another user")
```

### H5A-05 — Detalhes do Fix

**Achado original:** os endpoints `/dev/*` (`make_me_dev`, `grant_inbox_permission`, `seed_database`) permitiam auto-escalação de privilégios para qualquer usuário autenticado se `ENABLE_DEV_ENDPOINTS=True`. A única barreira era a flag de inclusão do router em `main.py`. A recomendação do H5A era adicionar `assert not settings.is_production` como defesa em profundidade dentro de cada endpoint.

**Correção (H5B, em produção):** implementada como dependency de **router** (mais abrangente que por endpoint individual) — `_block_in_production()` é chamada em todos os endpoints do router `/dev`, retornando HTTP 404 se `settings.is_production`:

```python
# backend/app/api/routes/dev.py:34-52
def _block_in_production() -> None:
    """
    Defesa em profundidade (H5A-05): os endpoints /dev (seed, bootstrap de DEV,
    self-grant de permissões) nunca executam em produção, mesmo que
    ENABLE_DEV_ENDPOINTS seja ligado por engano. Não dependemos apenas do flag
    de inclusão do router em main.py. Retorna 404 para não revelar a superfície
    /dev em produção.
    """
    if settings.is_production:
        raise HTTPException(
            status_code=404, detail={"error": "not_found", "message": "Not found"}
        )

router = APIRouter(
    prefix="/dev",
    tags=["dev"],
    dependencies=[Depends(_block_in_production)],  # ← aplicado a todos os endpoints
)
```

A defesa é em dois níveis: o router `/dev` só é incluído quando `enable_dev_endpoints=True` (flag); mesmo se incluído por engano em produção, `_block_in_production()` retorna 404 antes de executar qualquer lógica.

### H5A-06 — Detalhes do Fix

**Achado original:** `PUT /profile` aceitava qualquer UUID em `vocational_accompanist_user_id` e `_build_profile_response` resolvia o `full_name` do usuário referenciado a partir desse UUID — permitindo a qualquer autenticado obter o nome de terceiros se soubesse o UUID.

**Correção (H5B, em produção):** a função `_build_profile_response` não resolve mais `full_name` pelo UUID do acompanhador. Usa apenas o campo de texto livre `vocational_accompanist_name` armazenado no próprio perfil do usuário:

```python
# backend/app/api/profile_routes.py:548-554
# SEGURANÇA (H5A-06): NÃO resolvemos o full_name a partir de
# vocational_accompanist_user_id arbitrário — não existe modelo/regra de
# "acompanhador legítimo" (qualquer UUID pode ser informado no próprio
# perfil), então ecoar o nome permitiria descobrir o full_name de terceiros
# por UUID. Usamos apenas o nome em texto livre informado pelo usuário.
accompanist_display_name = profile.vocational_accompanist_name
```

O UUID `vocational_accompanist_user_id` ainda é armazenado no perfil (para uso futuro quando existir um modelo de acompanhamento formal), mas **não é usado para resolver nomes**.

---

## H6 / H6A — AuditLog

**Status: em produção.**

O backend implementa `AuditLog` para rastrear ações sensíveis. A criação é feita via `create_audit_log` (em `app/audit/service.py`), chamada em:

- Exclusão/anonimização de conta (`account_deleted`, `lgpd_art: "18_VI"`)
- Acesso a perfis completos e documentos sensíveis
- Mudanças de papel global
- Ações no canal (deleção moderada)
- Exportações de dados
- Login/logout
- Aceite de termos

A feature flag `ENABLE_AUDIT=True` está ativa em produção (confirmado em H0).

O painel de audit logs (`app/admin/audit-logs.tsx`) exibe os registros para ADMIN e DEV. ANALISTA tem acesso via backend mas o frontend oculta a seção do menu — tensão documentada em `06-admin.md`.

> **Pendência POST-RC (parcial):** mapeamento de `ACTION_META` no frontend não cobre todos os códigos emitidos pelo backend — eventos não mapeados aparecem como código cru. Verificar se a implementação do Admin 2.0 Fase 1 completou o mapeamento ou se ainda há eventos exibidos como código bruto.

---

## Resumo do Estado de Hardening

| Subfase | Descrição | Status |
|---------|-----------|--------|
| H0 | Baseline — 9/9 env vars passaram | Concluído |
| H1 | Backend: HSTS, CSP, X-Content-Type-Options, X-Frame-Options, Referrer-Policy | Em produção |
| H2 | Frontend: headers via vercel.json | Em produção |
| H3 | Rate limit: hash do token completo (não prefixo) | Em produção |
| H4 | Upload 8 MB, body JSON 1 MB, parseApiError | Em produção |
| H5A | Auditoria IDOR ~140 endpoints | Concluído |
| H5B | Correções H5A-01, H5A-02, H5A-03, H5A-04, H5A-05, H5A-06, H5A-07 | Em produção |
| H6/H6A | AuditLog implementado | Em produção |

---

## Pendências POST-RC

| Item | Descrição |
|------|-----------|
| CSP frontend (enforced) | Migrar `Content-Security-Policy-Report-Only` → `Content-Security-Policy` após validação |
| npm audit (41 vulns) | Vulnerabilidades transitivas vinculadas ao Expo SDK 52 — monitorar patches disponíveis |
| HSTS preload | Ativar após validar domínio e subdomínios |
| Testes de penetração externos | Nenhum pentest externo formal foi realizado até o RC |

---

## Próxima leitura

- **Deploy e variáveis de ambiente:** `12-deploy-ambientes.md`
- **Dados sensíveis e LGPD:** `13-lgpd-dados-sensiveis.md`
- **Autenticação e papéis:** `05-autenticacao-permissoes.md`
- **Painel Admin (audit logs):** `06-admin.md`
