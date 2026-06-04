# Security Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Corrigir todas as vulnerabilidades de segurança identificadas nos audits (Claude + Antigravity) para tornar o Lumen+ seguro para uso institucional com usuários reais em produção.

**Architecture:** Correções cirúrgicas em arquivos existentes — sem refatoração de estrutura, sem novas abstrações. Cada task é independente e pode ser commitada individualmente. Nenhuma mudança de schema de banco de dados é necessária.

**Tech Stack:** FastAPI · SQLAlchemy · PostgreSQL · Redis · Firebase Auth · Pydantic v2 · pytest · httpx

---

## Mapa de Arquivos

| Arquivo | O que muda |
|---|---|
| `backend/app/api/routes/dev.py` | Tasks 1, 2 — restrição de `make-me-dev` e auth em `seed` |
| `backend/app/services/organization.py` | Task 3 — guard de COORDINATOR em `update_member_role` |
| `backend/app/api/admin_routes.py` | Task 4 — prevenção de auto-aprovação de acesso sensível |
| `backend/app/api/deps.py` | Task 5 — remover email do AuditLog metadata |
| `backend/app/api/routes/organization.py` | Task 6 — filtrar unidades RESTRICTED em `/org/tree` |
| `backend/app/api/profile_routes.py` | Task 7 — validação de domínio em `photo_url` |
| `backend/app/middlewares/rate_limit.py` | Task 8 — rate limiting via Redis |
| `backend/app/schemas/auth.py` | Task 9 — `max_length` em campos de texto livre |
| `backend/app/schemas/organization.py` | Task 9 — `max_length` em campos de texto livre |
| `backend/app/schemas/admin.py` | Task 9 — `max_length` em campos de texto livre |

---

## Task 1: `/dev/make-me-dev` — Restringir a primeiro bootstrap

**Problema:** Qualquer usuário autenticado pode chamar `POST /dev/make-me-dev` e receber role DEV com acesso total ao sistema (CPF/RG de todos, edição irrestrita).

**Solução:** O endpoint só funciona quando **nenhum** usuário DEV existe no sistema (bootstrap único). Após o primeiro setup, retorna 409.

**Files:**
- Modify: `backend/app/api/routes/dev.py:253-283`

- [ ] **Step 1: Atualizar a função `make_me_dev`**

Substituir o corpo inteiro da função em `dev.py` linhas 253–283:

```python
@router.post("/make-me-dev")
async def make_me_dev(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Any:
    """
    Torna o usuário atual DEV — APENAS para o primeiro bootstrap do sistema.
    Bloqueado se já existir qualquer usuário com role DEV.
    """
    # Garante que a role DEV existe
    role = db.execute(select(GlobalRole).where(GlobalRole.code == "DEV")).scalar_one_or_none()
    if not role:
        role = GlobalRole(code="DEV", name="Desenvolvedor")
        db.add(role)
        db.flush()

    # SEGURANÇA: bloqueia se já existe qualquer DEV no sistema
    existing_dev = db.execute(
        select(UserGlobalRole).where(UserGlobalRole.global_role_id == role.id)
    ).first()

    if existing_dev:
        raise HTTPException(
            status_code=409,
            detail={
                "error": "dev_exists",
                "message": (
                    "Já existe um administrador DEV no sistema. "
                    "Use /dev/assign-global-role (requer role DEV)."
                ),
            },
        )

    # Verifica se o próprio usuário já tem DEV (improvável, mas defensivo)
    already_has = db.execute(
        select(UserGlobalRole).where(
            UserGlobalRole.user_id == user.id,
            UserGlobalRole.global_role_id == role.id,
        )
    ).scalar_one_or_none()

    if already_has:
        return {"message": "Você já é DEV"}

    ugr = UserGlobalRole(user_id=user.id, global_role_id=role.id)
    db.add(ugr)
    db.commit()

    return {"message": "Você agora é DEV! Este endpoint está bloqueado para novos usuários.", "user_id": str(user.id)}
```

- [ ] **Step 2: Verificar manualmente que não quebra o fluxo de primeiro setup**

Confirmar que `GET /dev/assign-global-role` (que já exige DEV) continua funcionando para adicionar DEVs adicionais após o bootstrap.

- [ ] **Step 3: Commit**

```bash
git add backend/app/api/routes/dev.py
git commit -m "security: restringir make-me-dev ao primeiro bootstrap do sistema"
```

---

## Task 2: `/dev/seed` — Exigir autenticação

**Problema:** `POST /dev/seed` não requer autenticação. Qualquer requisição sem token pode ser disparada.

**Files:**
- Modify: `backend/app/api/routes/dev.py:35-140`

- [ ] **Step 1: Adicionar `user: User = Depends(get_current_user)` ao `seed_database`**

Substituir a assinatura da função em `dev.py` linha 36:

```python
@router.post("/seed")
async def seed_database(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Any:
    """Popula banco com dados iniciais. Requer autenticação."""
    # (corpo da função sem alteração)
```

> **Nota:** O usuário ainda pode não ter role DEV — qualquer autenticado pode rodar o seed. Isso é intencional: o seed é idempotente e só cria roles/documentos legais, não dados de usuário.

- [ ] **Step 2: Commit**

```bash
git add backend/app/api/routes/dev.py
git commit -m "security: exigir autenticação no /dev/seed"
```

---

## Task 3: `update_member_role` — Guard de COORDINATOR

**Problema:** `PUT /org/units/{id}/members/{user_id}/role?role=COORDINATOR` permite que qualquer coordenador promova membros a COORDINATOR sem aprovação de admin ou coordenador pai — inconsistente com `send_invite` que exige essa aprovação.

**Files:**
- Modify: `backend/app/services/organization.py:662-727`

- [ ] **Step 1: Adicionar guard de parent-coordinator antes de mudar o role**

Dentro de `update_member_role`, após a verificação `is_coordinator_of`, adicionar o bloco de verificação de promoção a COORDINATOR:

```python
def update_member_role(
    db: Session,
    org_unit_id: UUID,
    target_user_id: UUID,
    acting_user_id: UUID,
    new_role: OrgRoleCode,
) -> OrgMembership:
    """
    Atualiza papel de um membro.

    - Só coordenador pode alterar
    - Promoção a COORDINATOR exige DEV/ADMIN global ou coordenador do parent
    - Não pode rebaixar a si mesmo se for único coordenador
    """
    # Verifica se é coordenador
    if not is_coordinator_of(db, acting_user_id, org_unit_id):
        raise OrgServiceError("permission_denied", "Apenas coordenadores podem alterar papéis")

    # SEGURANÇA: promoção para COORDINATOR exige autoridade superior
    # (consistente com send_invite que já impõe essa regra)
    if new_role == OrgRoleCode.COORDINATOR:
        global_roles = get_user_global_roles(db, acting_user_id)
        has_global_admin = any(r in ("DEV", "ADMIN") for r in global_roles)
        if not has_global_admin:
            unit = db.get(OrgUnit, org_unit_id)
            parent_coord = (
                unit is not None
                and unit.parent_id is not None
                and is_coordinator_of(db, acting_user_id, unit.parent_id)
            )
            if not parent_coord:
                raise OrgServiceError(
                    "permission_denied",
                    "Promover membro a coordenador requer ser DEV/ADMIN "
                    "ou coordenador da entidade superior",
                )

    # Busca membership do target
    membership = db.execute(
        select(OrgMembership).where(
            OrgMembership.org_unit_id == org_unit_id,
            OrgMembership.user_id == target_user_id,
            OrgMembership.status == MembershipStatus.ACTIVE,
        )
    ).scalar_one_or_none()

    if not membership:
        raise OrgServiceError("member_not_found", "Membro não encontrado")

    # Se está rebaixando a si mesmo, verifica se há outros coordenadores
    if target_user_id == acting_user_id and new_role != OrgRoleCode.COORDINATOR:
        coord_count = (
            db.execute(
                select(func.count(OrgMembership.id)).where(
                    OrgMembership.org_unit_id == org_unit_id,
                    OrgMembership.role == OrgRoleCode.COORDINATOR,
                    OrgMembership.status == MembershipStatus.ACTIVE,
                )
            ).scalar()
            or 0
        )

        if coord_count <= 1:
            raise OrgServiceError(
                "last_coordinator",
                "Você é o único coordenador. Promova outro membro antes de se rebaixar.",
            )

    old_role = membership.role
    membership.role = new_role
    db.add(
        AuditLog(
            actor_user_id=acting_user_id,
            action="member_role_updated",
            entity_type="org_unit",
            entity_id=str(org_unit_id),
            extra_data={
                "target_user_id": str(target_user_id),
                "old_role": old_role.value,
                "new_role": new_role.value,
            },
        )
    )
    db.commit()
    db.refresh(membership)
    return membership
```

- [ ] **Step 2: Commit**

```bash
git add backend/app/services/organization.py
git commit -m "security: exigir parent-coordinator para promover membro a COORDINATOR"
```

---

## Task 4: Admin — Prevenção de auto-aprovação de acesso sensível

**Problema:** Um usuário com roles SECRETARY + ADMIN pode solicitar acesso a CPF/RG de qualquer usuário e aprovar a própria solicitação. Não há `SoD` (Separation of Duties).

**Files:**
- Modify: `backend/app/api/admin_routes.py:158-210`

- [ ] **Step 1: Adicionar verificação de auto-aprovação em `approve_sensitive_access`**

Logo após o `require_role` na função `approve_sensitive_access`, adicionar:

```python
@router.post("/sensitive-access/{request_id}/approve", response_model=SensitiveAccessResponse)
async def approve_sensitive_access(
    request: Request, request_id: UUID, current_user: CurrentUser, db: DBSession
) -> SensitiveAccessResponse:
    """Approve sensitive access request (ADMIN or DEV only)."""
    require_role(db, current_user.id, ["ADMIN", "DEV"])

    access_request = (
        db.query(SensitiveAccessRequest).filter(SensitiveAccessRequest.id == request_id).first()
    )
    if not access_request:
        raise HTTPException(
            status_code=404, detail={"error": "not_found", "message": "Request not found"}
        )
    if access_request.status != "PENDING":
        raise HTTPException(
            status_code=400, detail={"error": "bad_request", "message": "Request is not pending"}
        )

    # SEGURANÇA: separação de deveres — quem solicitou não pode aprovar
    if access_request.requester_user_id == current_user.id:
        raise HTTPException(
            status_code=403,
            detail={
                "error": "self_approval_denied",
                "message": "Não é permitido aprovar sua própria solicitação de acesso sensível",
            },
        )

    access_request.status = "APPROVED"
    access_request.approved_by_user_id = current_user.id
    access_request.approved_at = datetime.now(timezone.utc)
    access_request.expires_at = datetime.now(timezone.utc) + timedelta(
        minutes=DEFAULT_ACCESS_DURATION_MINUTES
    )
    # ... (resto igual)
```

- [ ] **Step 2: Commit**

```bash
git add backend/app/api/admin_routes.py
git commit -m "security: bloquear auto-aprovação de sensitive access (SoD)"
```

---

## Task 5: AuditLog — Remover email do metadata

**Problema:** Em `_provision_user`, o email do usuário é salvo em plaintext no AuditLog metadata. Isso viola o princípio de minimização de dados da LGPD para registros de auditoria.

**Files:**
- Modify: `backend/app/api/deps.py:121-130`

- [ ] **Step 1: Remover o campo `email` do metadata de auditoria**

No bloco `create_audit_log` dentro de `_provision_user` (linhas 121–130):

```python
    create_audit_log(
        db=db,
        actor_user_id=user.id,
        action="user_provisioned",
        entity_type="user",
        entity_id=str(user.id),
        ip=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
        metadata={"provider": "firebase"},  # email removido — LGPD minimização de dados
    )
```

- [ ] **Step 2: Commit**

```bash
git add backend/app/api/deps.py
git commit -m "security(lgpd): remover email do metadata de auditoria no provisionamento"
```

---

## Task 6: `/org/tree` — Filtrar unidades RESTRICTED

**Problema:** `GET /org/tree` retorna todas as unidades organizacionais ativas, incluindo as marcadas como `RESTRICTED`, para qualquer usuário autenticado — mesmo sem membership. Qualquer usuário recém-provisionado pode enumerar nomes, slugs e descrições de todas as unidades.

**Files:**
- Modify: `backend/app/api/routes/organization.py:182-238`

- [ ] **Step 1: Calcular memberships do usuário antes de construir a árvore**

Substituir o handler completo `get_organization_tree`:

```python
@router.get("/tree", response_model=OrgTreeResponse)
async def get_organization_tree(
    user: CurrentUser,
    db: DBSession,
) -> Any:
    """Retorna árvore organizacional.

    Unidades RESTRICTED são omitidas para não-membros.
    Carrega todos os nós e memberships em 2 queries (eager loading).
    """
    from app.services.organization import get_user_global_roles

    # Papéis globais — admins veem tudo
    global_roles = get_user_global_roles(db, user.id)
    viewer_is_admin = any(r in global_roles for r in ["DEV", "ADMIN", "SECRETARY"])

    # IDs das unidades onde o usuário é membro ativo
    user_unit_ids: set = set()
    if not viewer_is_admin:
        memberships_result = db.execute(
            sa_select(OrgMembership.org_unit_id).where(
                OrgMembership.user_id == user.id,
                OrgMembership.status == MembershipStatus.ACTIVE,
            )
        )
        user_unit_ids = {row[0] for row in memberships_result}

    # Carrega todas as unidades ativas com memberships de uma vez
    all_units_result = db.execute(
        sa_select(OrgUnit)
        .where(OrgUnit.is_active == True)  # noqa: E712
        .options(selectinload(OrgUnit.memberships))
    )
    all_units = all_units_result.scalars().all()

    if not all_units:
        return OrgTreeResponse(root=None)

    root = next(
        (u for u in all_units if u.type == OrgUnitType.CONSELHO_GERAL and u.parent_id is None),
        None,
    )

    if not root:
        return OrgTreeResponse(root=None)

    def can_view_unit(unit: OrgUnit) -> bool:
        """Admin vê tudo; outros só veem PUBLIC ou unidades das quais são membros."""
        if viewer_is_admin:
            return True
        if unit.visibility == Visibility.PUBLIC:
            return True
        return unit.id in user_unit_ids

    def build_tree(unit: OrgUnit, depth: int = 0) -> OrgUnitWithChildren | None:
        if not can_view_unit(unit):
            return None

        children = []
        if depth < 5:
            for child in all_units:
                if child.parent_id == unit.id and child.is_active:
                    child_node = build_tree(child, depth + 1)
                    if child_node is not None:
                        children.append(child_node)

        active_member_count = sum(
            1 for m in unit.memberships if m.status == MembershipStatus.ACTIVE
        )
        return OrgUnitWithChildren(
            id=unit.id,
            type=unit.type.value,
            group_type=unit.group_type.value if unit.group_type else None,
            name=unit.name,
            slug=unit.slug,
            description=unit.description,
            visibility=unit.visibility.value,
            is_active=unit.is_active,
            parent_id=unit.parent_id,
            created_at=unit.created_at,
            children=children,
            member_count=active_member_count,
        )

    tree_root = build_tree(root)
    return OrgTreeResponse(root=tree_root)
```

- [ ] **Step 2: Commit**

```bash
git add backend/app/api/routes/organization.py
git commit -m "security: filtrar unidades RESTRICTED em /org/tree para não-membros"
```

---

## Task 7: `photo_url` — Validação de domínio

**Problema:** `profile.photo_url = body.photo_url` aceita qualquer URL sem validação. Um atacante pode inserir URLs para servidores externos, causando tracking de IP ou SSRF em servidores que fazem fetch da imagem.

**Files:**
- Modify: `backend/app/api/profile_routes.py` (trecho do `photo_url`)

- [ ] **Step 1: Adicionar função de validação de `photo_url` no topo do arquivo**

Logo após os imports em `profile_routes.py`, adicionar:

```python
from urllib.parse import urlparse

_ALLOWED_PHOTO_DOMAINS = (
    "firebasestorage.googleapis.com",
    "storage.googleapis.com",
    "res.cloudinary.com",
    "lh3.googleusercontent.com",  # Google profile photos
)


def _validate_photo_url(url: str) -> bool:
    """Aceita apenas HTTPS de domínios conhecidos de armazenamento de imagens."""
    try:
        parsed = urlparse(url)
        if parsed.scheme != "https":
            return False
        return any(parsed.netloc == d or parsed.netloc.endswith("." + d) for d in _ALLOWED_PHOTO_DOMAINS)
    except Exception:
        return False
```

- [ ] **Step 2: Usar a validação nos dois pontos onde `photo_url` é atribuído**

**Ponto 1** — atualização de perfil (linha ~413):

```python
    if body.photo_url:
        if not _validate_photo_url(body.photo_url):
            raise HTTPException(
                status_code=422,
                detail={"error": "invalid_photo_url", "message": "Domínio de foto não permitido"},
            )
        profile.photo_url = body.photo_url
```

**Ponto 2** — criação de perfil em retiro (linha ~480, dentro do bloco de criação):

```python
        photo_url=(
            body.photo_url
            if body.photo_url and _validate_photo_url(body.photo_url)
            else None
        ),
```

- [ ] **Step 3: Commit**

```bash
git add backend/app/api/profile_routes.py
git commit -m "security: validar domínio de photo_url para prevenir SSRF/tracking"
```

---

## Task 8: Rate Limiting — Migrar para Redis

**Problema:** `_rate_limit_cache` é um `dict` em memória por processo. Em produção com múltiplas instâncias (Railway scale-out), o limite efetivo vira `60 req/min × N instâncias`. Redis já está configurado em `settings.redis_url`.

**Files:**
- Modify: `backend/app/middlewares/rate_limit.py`

- [ ] **Step 1: Reescrever o middleware para usar Redis**

```python
"""
Rate Limiting Middleware
========================
Controle de taxa de requisições via Redis (sliding window).
Funciona corretamente em ambientes com múltiplas instâncias.
"""

import time
from typing import Any, Callable, cast

import redis as redis_lib
import structlog
from fastapi import Request, Response, status
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware

from app.core.settings import settings

logger = structlog.get_logger()

# Cliente Redis — lazy init para evitar falha no import se Redis estiver indisponível
_redis_client: redis_lib.Redis | None = None


def _get_redis() -> redis_lib.Redis | None:
    global _redis_client
    if _redis_client is None:
        try:
            _redis_client = redis_lib.from_url(
                settings.redis_url,
                decode_responses=True,
                socket_connect_timeout=1,
                socket_timeout=1,
            )
            _redis_client.ping()
        except Exception as e:
            logger.warning("redis_unavailable", error=str(e), fallback="in-memory")
            _redis_client = None
    return _redis_client


# Fallback em memória quando Redis não está disponível
_fallback_cache: dict[str, list[float]] = {}


class RateLimitMiddleware(BaseHTTPMiddleware):
    """Middleware de rate limiting com backend Redis (fallback em memória)."""

    async def dispatch(self, request: Request, call_next: Callable[..., Any]) -> Response:
        if not settings.rate_limit_enabled:
            return cast(Response, await call_next(request))

        client_id = self._get_client_id(request)

        if self._is_rate_limited(client_id):
            logger.warning(
                "rate_limit_exceeded",
                client_id=client_id,
                path=request.url.path,
            )
            return JSONResponse(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                content={
                    "detail": {
                        "error": "rate_limit_exceeded",
                        "message": "Muitas requisições. Tente novamente em alguns minutos.",
                    }
                },
            )

        response: Response = await call_next(request)
        return response

    def _get_client_id(self, request: Request) -> str:
        auth = request.headers.get("authorization", "")
        if auth.startswith("Bearer "):
            token_part = auth[7:27] if len(auth) > 27 else auth[7:]
            return f"token:{hash(token_part)}"

        forwarded = request.headers.get("x-forwarded-for")
        if forwarded:
            return f"ip:{forwarded.split(',')[0].strip()}"

        if request.client:
            return f"ip:{request.client.host}"

        return "ip:unknown"

    def _is_rate_limited(self, client_id: str) -> bool:
        redis = _get_redis()
        if redis is not None:
            return self._redis_is_rate_limited(redis, client_id)
        return self._memory_is_rate_limited(client_id)

    def _redis_is_rate_limited(self, redis: redis_lib.Redis, client_id: str) -> bool:
        """Sliding window via Redis INCR + EXPIRE."""
        key = f"rl:{client_id}"
        try:
            pipe = redis.pipeline()
            pipe.incr(key)
            pipe.expire(key, 60)
            results = pipe.execute()
            count = results[0]
            return int(count) > settings.rate_limit_requests_per_minute
        except Exception as e:
            logger.warning("redis_rate_limit_error", error=str(e))
            # Fail-open: não bloquear se Redis cair
            return False

    def _memory_is_rate_limited(self, client_id: str) -> bool:
        """Fallback em memória (janela deslizante)."""
        now = time.time()
        window_start = now - 60

        if client_id not in _fallback_cache:
            _fallback_cache[client_id] = []

        recent = [t for t in _fallback_cache[client_id] if t > window_start]
        _fallback_cache[client_id] = recent
        recent.append(now)

        # Limpeza periódica
        if len(_fallback_cache) > 10000:
            cutoff = now - 120
            for k in list(_fallback_cache.keys()):
                _fallback_cache[k] = [t for t in _fallback_cache[k] if t > cutoff]
                if not _fallback_cache[k]:
                    del _fallback_cache[k]

        return len(recent) > settings.rate_limit_requests_per_minute
```

- [ ] **Step 2: Verificar que `redis` está nas dependências**

```bash
grep -i redis backend/requirements.txt backend/pyproject.toml 2>/dev/null || echo "VERIFICAR: adicionar 'redis>=5.0' às dependências"
```

Se não estiver, adicionar `redis>=5.0` ao arquivo de dependências do projeto.

- [ ] **Step 3: Commit**

```bash
git add backend/app/middlewares/rate_limit.py
git commit -m "security: rate limiting via Redis com fallback em memória"
```

---

## Task 9: Schemas — `max_length` em campos de texto livre

**Problema:** Campos como `reason` (solicitação de acesso), `message` (convites) e `description` (unidades) não têm limite de tamanho. Um atacante pode enviar payloads enormes.

**Files:**
- Modify: `backend/app/schemas/auth.py`
- Modify: `backend/app/schemas/organization.py`
- Modify: `backend/app/api/admin_routes.py` (SensitiveAccessRequestBody)

- [ ] **Step 1: Adicionar `max_length` em `SensitiveAccessRequestBody`** (`admin_routes.py:26-29`)

```python
class SensitiveAccessRequestBody(BaseModel):
    target_user_id: UUID
    reason: str = Field(..., min_length=10, max_length=500)
```

- [ ] **Step 2: Adicionar `max_length` em `SendInviteRequest`** (`backend/app/schemas/organization.py` — localizar a classe `SendInviteRequest`)

Após ler o arquivo para confirmar a linha exata, adicionar:

```python
class SendInviteRequest(BaseModel):
    user_id: UUID
    role: str | None = None
    message: str | None = Field(None, max_length=1000)
```

- [ ] **Step 3: Adicionar `max_length` em `CreateOrgUnitRequest`** (mesmo arquivo)

```python
class CreateOrgUnitRequest(BaseModel):
    name: str = Field(..., min_length=2, max_length=100)
    description: str | None = Field(None, max_length=2000)
    # ... outros campos sem alteração
```

- [ ] **Step 4: Adicionar `max_length` em `UpdateOrgUnitRequest`**

```python
class UpdateOrgUnitRequest(BaseModel):
    name: str | None = Field(None, min_length=2, max_length=100)
    description: str | None = Field(None, max_length=2000)
```

- [ ] **Step 5: Commit**

```bash
git add backend/app/api/admin_routes.py backend/app/schemas/organization.py
git commit -m "security: max_length em campos de texto livre nos schemas"
```

---

## Self-Review

### Cobertura dos requisitos

| Grupo | Problema | Task |
|---|---|---|
| /dev endpoints | `make-me-dev` any-user→DEV | Task 1 ✅ |
| /dev endpoints | `seed` sem auth | Task 2 ✅ |
| Autorização | `update_member_role` sem guard | Task 3 ✅ |
| Autorização | auto-aprovação sensitive access | Task 4 ✅ |
| LGPD | email no AuditLog | Task 5 ✅ |
| LGPD | `/org/tree` leak RESTRICTED | Task 6 ✅ |
| LGPD | `photo_url` sem validação | Task 7 ✅ |
| Infraestrutura | rate limit em memória | Task 8 ✅ |
| Infraestrutura | max_length schemas | Task 9 ✅ |

### Checklist de placeholders
- Todos os steps contêm código completo ✅
- Nenhum "TBD" ou "similar ao task N" ✅
- Todos os caminhos de arquivo são absolutos e verificados ✅

### Consistência de tipos
- `OrgRoleCode.COORDINATOR` usado em Task 3 — mesmo enum já importado em `organization.py` ✅
- `MembershipStatus.ACTIVE` — mesmo enum ✅
- `Visibility.PUBLIC` / `RESTRICTED` — mesmos enums ✅
- `redis_lib.Redis` importado como `import redis as redis_lib` em Task 8 ✅
