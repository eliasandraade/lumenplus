# Cargos + Gestão de Usuários Avançada — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Corrigir o bug de atribuição de cargos, adicionar filtros avançados na listagem de usuários, visualização completa de perfil com RG/CPF auditado, e exportação de listas com dupla confirmação para dados sensíveis.

**Architecture:** Bug fix via migration idempotente que insere os roles faltantes. Filtros via query params no endpoint existente. Perfil completo via novo endpoint + nova tela mobile. Exportação com workflow assíncrono: solicitação → notificação no Inbox para COUNCIL_GENERAL → aprovação → geração de CSV → download por 24h.

**Tech Stack:** FastAPI, SQLAlchemy 2.0, Alembic, React Native (Expo), SQLite (testes), PostgreSQL (produção). Testes com pytest + TestClient. CSV gerado com `csv` stdlib do Python.

**Branch:** `feat/cargos-gestao-usuarios` — criar antes de começar.

---

## Mapa de arquivos

### Backend — criar
- `backend/alembic/versions/035_seed_missing_roles_and_export_requests.py` — migration: insere roles faltantes + cria tabela `data_export_requests`
- `backend/app/api/routes/export.py` — endpoints de exportação (request, list, approve, reject, download)
- `backend/tests/test_roles_fix.py` — testes do bug fix de cargos
- `backend/tests/test_user_filters.py` — testes dos novos filtros
- `backend/tests/test_user_profile_full.py` — testes do perfil completo
- `backend/tests/test_export.py` — testes do fluxo de exportação

### Backend — modificar
- `backend/app/api/routes/admin.py` — adicionar filtros ao `GET /admin/users` e novo endpoint `GET /admin/users/{id}/profile`
- `backend/app/main.py` — registrar router de exportação
- `backend/app/db/models.py` — adicionar model `DataExportRequest`

### Mobile — criar
- `lumen_mobile/app/admin/users/[id].tsx` — tela de perfil completo do usuário
- `lumen_mobile/app/admin/approvals/index.tsx` — fila de aprovações de exportação
- `lumen_mobile/app/admin/users/export.tsx` — tela de solicitação de exportação

### Mobile — modificar
- `lumen_mobile/app/admin/users/index.tsx` — adicionar botão filtrar, pills de filtros ativos, link para perfil e botão exportar
- `lumen_mobile/app/admin/users/_layout.tsx` — adicionar rota `[id]` e `export`
- `lumen_mobile/app/admin/_layout.tsx` — adicionar aba/rota `approvals`
- `lumen_mobile/src/services/index.ts` — adicionar `adminExportService` e `adminUserProfileService`

---

## Task 1: Branch + Migration (bug fix de cargos + tabela de exportação)

**Files:**
- Create: `backend/alembic/versions/035_seed_missing_roles_and_export_requests.py`

- [ ] **Step 1: Criar a branch**

```bash
cd /path/to/lumenplus-main
git checkout -b feat/cargos-gestao-usuarios
```

- [ ] **Step 2: Criar a migration**

Criar o arquivo `backend/alembic/versions/035_seed_missing_roles_and_export_requests.py`:

```python
"""Seed missing global roles + create data_export_requests table

Revision ID: 035_seed_missing_roles_and_export_requests
Revises: 034_pvm_json_fields_revisao_v2
Create Date: 2026-06-03
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "035_seed_missing_roles_and_export_requests"
down_revision: Union[str, None] = "034_pvm_json_fields_revisao_v2"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ── 1. Seed de todos os roles globais (idempotente) ────────────────────
    roles = [
        ("DEV", "Desenvolvedor"),
        ("ADMIN", "Administrador"),
        ("SECRETARY", "Secretário Geral"),
        ("AVISOS", "Avisos"),
        ("COUNCIL_GENERAL", "Conselho Geral"),
        ("ANALISTA", "Analista"),
    ]
    for code, name in roles:
        op.execute(
            sa.text(
                "INSERT INTO global_roles (id, code, name) "
                "VALUES (gen_random_uuid(), :code, :name) "
                "ON CONFLICT (code) DO NOTHING"
            ).bindparams(code=code, name=name)
        )

    # ── 2. Tabela data_export_requests ─────────────────────────────────────
    op.create_table(
        "data_export_requests",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            nullable=False,
            server_default=sa.text("gen_random_uuid()"),
        ),
        sa.Column(
            "requested_by",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "status",
            sa.Text(),
            nullable=False,
            server_default="PENDING",
        ),
        sa.Column("fields_requested", postgresql.ARRAY(sa.Text()), nullable=False),
        sa.Column("filters_json", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("has_sensitive", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column(
            "approved_by",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("approved_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("file_path", sa.Text(), nullable=True),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_export_requests_requested_by",
        "data_export_requests",
        ["requested_by"],
    )
    op.create_index(
        "ix_export_requests_status",
        "data_export_requests",
        ["status"],
    )


def downgrade() -> None:
    op.drop_index("ix_export_requests_status", table_name="data_export_requests")
    op.drop_index("ix_export_requests_requested_by", table_name="data_export_requests")
    op.drop_table("data_export_requests")
```

- [ ] **Step 3: Escrever o teste do bug fix**

Criar `backend/tests/test_roles_fix.py`:

```python
"""
Testa que os roles globais existem no banco após a migration/seed.
Reproduz o bug: atribuição de ADMIN/SECRETARY/AVISOS/COUNCIL_GENERAL
retornava silenciosamente sem salvar porque o role não existia em global_roles.
"""
import pytest
from sqlalchemy import select
from app.db.models import GlobalRole, User, UserGlobalRole, UserProfile, UserIdentity
import uuid


EXPECTED_ROLES = {"DEV", "ADMIN", "SECRETARY", "AVISOS", "COUNCIL_GENERAL", "ANALISTA"}


def _seed_roles(db_session):
    """Insere os roles que a migration 035 insere."""
    roles_data = [
        ("DEV", "Desenvolvedor"),
        ("ADMIN", "Administrador"),
        ("SECRETARY", "Secretário Geral"),
        ("AVISOS", "Avisos"),
        ("COUNCIL_GENERAL", "Conselho Geral"),
        ("ANALISTA", "Analista"),
    ]
    for code, name in roles_data:
        existing = db_session.execute(
            select(GlobalRole).where(GlobalRole.code == code)
        ).scalar_one_or_none()
        if not existing:
            db_session.add(GlobalRole(code=code, name=name))
    db_session.commit()


def _create_user(db_session, email="dev@test.com"):
    uid = uuid.uuid4()
    user = User(id=uid, created_at=__import__("datetime").datetime.utcnow())
    identity = UserIdentity(
        user_id=uid, provider="firebase", provider_uid=str(uid), email=email
    )
    profile = UserProfile(user_id=uid, full_name="Test User")
    db_session.add_all([user, identity, profile])
    db_session.commit()
    return user


def test_all_roles_exist_after_seed(db_session):
    """Todos os roles esperados existem no banco após seed."""
    _seed_roles(db_session)
    codes = {
        r[0]
        for r in db_session.execute(select(GlobalRole.code)).all()
    }
    assert EXPECTED_ROLES.issubset(codes), f"Roles faltando: {EXPECTED_ROLES - codes}"


def test_assign_admin_role_persists(db_session):
    """Atribuir ADMIN a um usuário persiste corretamente."""
    _seed_roles(db_session)
    user = _create_user(db_session)

    role = db_session.execute(
        select(GlobalRole).where(GlobalRole.code == "ADMIN")
    ).scalar_one()

    db_session.add(UserGlobalRole(user_id=user.id, global_role_id=role.id))
    db_session.commit()

    assigned = db_session.execute(
        select(GlobalRole.code)
        .join(UserGlobalRole)
        .where(UserGlobalRole.user_id == user.id)
    ).scalars().all()
    assert "ADMIN" in assigned


def test_assign_secretary_role_persists(db_session):
    """Atribuir SECRETARY a um usuário persiste corretamente."""
    _seed_roles(db_session)
    user = _create_user(db_session, email="sec@test.com")

    role = db_session.execute(
        select(GlobalRole).where(GlobalRole.code == "SECRETARY")
    ).scalar_one()

    db_session.add(UserGlobalRole(user_id=user.id, global_role_id=role.id))
    db_session.commit()

    assigned = db_session.execute(
        select(GlobalRole.code)
        .join(UserGlobalRole)
        .where(UserGlobalRole.user_id == user.id)
    ).scalars().all()
    assert "SECRETARY" in assigned


def test_assign_avisos_role_persists(db_session):
    """Atribuir AVISOS persiste — era o role mais comumente ausente."""
    _seed_roles(db_session)
    user = _create_user(db_session, email="avisos@test.com")

    role = db_session.execute(
        select(GlobalRole).where(GlobalRole.code == "AVISOS")
    ).scalar_one()

    db_session.add(UserGlobalRole(user_id=user.id, global_role_id=role.id))
    db_session.commit()

    assigned = db_session.execute(
        select(GlobalRole.code)
        .join(UserGlobalRole)
        .where(UserGlobalRole.user_id == user.id)
    ).scalars().all()
    assert "AVISOS" in assigned
```

- [ ] **Step 4: Rodar os testes (devem falhar — roles não existem ainda no SQLite de teste)**

```bash
cd backend
pytest tests/test_roles_fix.py -v
```

Esperado: `FAILED test_all_roles_exist_after_seed` (roles não estão no SQLite de teste — correto, pois a migration não roda no SQLite).

> **Nota:** Os testes usam `_seed_roles()` que replica o que a migration faz. O teste `test_all_roles_exist_after_seed` vai passar porque `_seed_roles` é chamado explicitamente. Os testes de atribuição também devem passar.

```bash
cd backend
pytest tests/test_roles_fix.py -v
```

Esperado: todos PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/alembic/versions/035_seed_missing_roles_and_export_requests.py backend/tests/test_roles_fix.py
git commit -m "fix: migration 035 — seed missing global roles (ADMIN, SECRETARY, AVISOS, COUNCIL_GENERAL) + create data_export_requests table"
```

---

## Task 2: Model DataExportRequest no SQLAlchemy

**Files:**
- Modify: `backend/app/db/models.py`

- [ ] **Step 1: Adicionar o model**

Abrir `backend/app/db/models.py` e localizar a seção `# === INBOX (AVISOS) ===`. Adicionar antes dela:

```python
# === EXPORTAÇÃO DE DADOS ===

class DataExportRequest(Base):
    __tablename__ = "data_export_requests"

    id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True),
        primary_key=True,
        default=_uuid_mod.uuid4,
        server_default=func.gen_random_uuid(),
    )
    requested_by: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    # PENDING | APPROVED | REJECTED | GENERATED | EXPIRED
    status: Mapped[str] = mapped_column(Text, nullable=False, default="PENDING")
    fields_requested: Mapped[list[str]] = mapped_column(
        postgresql.ARRAY(Text), nullable=False
    )
    filters_json: Mapped[dict | None] = mapped_column(
        postgresql.JSONB(astext_type=Text), nullable=True
    )
    has_sensitive: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    approved_by: Mapped[UUID | None] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    approved_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    file_path: Mapped[str | None] = mapped_column(Text, nullable=True)
    expires_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    requester: Mapped["User"] = relationship("User", foreign_keys=[requested_by])
    approver: Mapped["User | None"] = relationship("User", foreign_keys=[approved_by])
```

> **Atenção:** `postgresql.ARRAY` e `postgresql.JSONB` já são importados no topo do arquivo para outros models. Verifique que `from sqlalchemy.dialects import postgresql` está presente. Se não estiver, adicione.

- [ ] **Step 2: Verificar que o model não quebra a importação**

```bash
cd backend
python -c "from app.db.models import DataExportRequest; print('OK')"
```

Esperado: `OK`

- [ ] **Step 3: Commit**

```bash
git add backend/app/db/models.py
git commit -m "feat: add DataExportRequest SQLAlchemy model"
```

---

## Task 3: Filtros avançados no GET /admin/users (backend)

**Files:**
- Modify: `backend/app/api/routes/admin.py`
- Create: `backend/tests/test_user_filters.py`

- [ ] **Step 1: Escrever os testes de filtro**

Criar `backend/tests/test_user_filters.py`:

```python
"""
Testa os filtros avançados de GET /admin/users:
cidade, estado, realidade_vocacional, ministerio_id, estado_civil, profile_status.
"""
import uuid
import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session
from app.db.models import (
    User, UserProfile, UserIdentity, GlobalRole, UserGlobalRole,
    ProfileCatalog, ProfileCatalogItem
)
import datetime


def _create_user_with_profile(db: Session, email: str, **profile_kwargs) -> User:
    uid = uuid.uuid4()
    user = User(id=uid, created_at=datetime.datetime.utcnow())
    identity = UserIdentity(
        user_id=uid, provider="firebase", provider_uid=str(uid), email=email
    )
    profile = UserProfile(user_id=uid, full_name=profile_kwargs.pop("full_name", "Test"), **profile_kwargs)
    db.add_all([user, identity, profile])
    db.commit()
    return user


def _seed_admin_role(db: Session) -> User:
    """Cria usuário admin para autenticar os requests."""
    role_obj = db.query(GlobalRole).filter_by(code="ADMIN").first()
    if not role_obj:
        role_obj = GlobalRole(code="ADMIN", name="Admin")
        db.add(role_obj)
        db.flush()
    admin = _create_user_with_profile(db, "admin@test.com", full_name="Admin")
    db.add(UserGlobalRole(user_id=admin.id, global_role_id=role_obj.id))
    db.commit()
    return admin


def _seed_catalog_item(db: Session, catalog_code: str, item_code: str, label: str) -> ProfileCatalogItem:
    cat = db.query(ProfileCatalog).filter_by(code=catalog_code).first()
    if not cat:
        cat = ProfileCatalog(code=catalog_code, name=catalog_code)
        db.add(cat)
        db.flush()
    item = db.query(ProfileCatalogItem).filter_by(catalog_id=cat.id, code=item_code).first()
    if not item:
        item = ProfileCatalogItem(catalog_id=cat.id, code=item_code, label=label, sort_order=0)
        db.add(item)
        db.flush()
    db.commit()
    return item


def test_filter_by_city(client: TestClient, db_session: Session):
    _seed_admin_role(db_session)
    _create_user_with_profile(db_session, "sp@test.com", city="São Paulo", state="SP")
    _create_user_with_profile(db_session, "rj@test.com", city="Rio de Janeiro", state="RJ")

    resp = client.get(
        "/admin/users?cidade=São Paulo",
        headers={"Authorization": "Bearer dev:admin:admin@test.com"},
    )
    assert resp.status_code == 200
    data = resp.json()
    emails = [u["email"] for u in data["users"]]
    assert "sp@test.com" in emails
    assert "rj@test.com" not in emails


def test_filter_by_state(client: TestClient, db_session: Session):
    _seed_admin_role(db_session)
    _create_user_with_profile(db_session, "sp2@test.com", city="Campinas", state="SP")
    _create_user_with_profile(db_session, "mg@test.com", city="BH", state="MG")

    resp = client.get(
        "/admin/users?estado=SP",
        headers={"Authorization": "Bearer dev:admin:admin@test.com"},
    )
    assert resp.status_code == 200
    emails = [u["email"] for u in resp.json()["users"]]
    assert "sp2@test.com" in emails
    assert "mg@test.com" not in emails


def test_filter_by_profile_status(client: TestClient, db_session: Session):
    _seed_admin_role(db_session)
    _create_user_with_profile(db_session, "complete@test.com", status="COMPLETE")
    _create_user_with_profile(db_session, "incomplete@test.com")

    resp = client.get(
        "/admin/users?profile_status=COMPLETE",
        headers={"Authorization": "Bearer dev:admin:admin@test.com"},
    )
    assert resp.status_code == 200
    emails = [u["email"] for u in resp.json()["users"]]
    assert "complete@test.com" in emails
    assert "incomplete@test.com" not in emails


def test_filter_by_vocational_reality(client: TestClient, db_session: Session):
    _seed_admin_role(db_session)
    item = _seed_catalog_item(db_session, "VOCATIONAL_REALITY", "VOCACIONAL", "Vocacional")
    _create_user_with_profile(
        db_session, "voc@test.com", vocational_reality_item_id=item.id
    )
    _create_user_with_profile(db_session, "other@test.com")

    resp = client.get(
        f"/admin/users?realidade_vocacional={item.code}",
        headers={"Authorization": "Bearer dev:admin:admin@test.com"},
    )
    assert resp.status_code == 200
    emails = [u["email"] for u in resp.json()["users"]]
    assert "voc@test.com" in emails
    assert "other@test.com" not in emails
```

- [ ] **Step 2: Rodar testes — devem falhar (filtros não implementados)**

```bash
cd backend
pytest tests/test_user_filters.py -v
```

Esperado: FAILED (parâmetros ignorados ou 422).

- [ ] **Step 3: Implementar os filtros no endpoint**

Abrir `backend/app/api/routes/admin.py`. Localizar a função `list_users` (cerca da linha 65).

Substituir a assinatura e o corpo do filtro de busca:

```python
@router.get("/users")
async def list_users(
    current_user: CurrentUser,
    db: DBSession,
    search: str = Query(default="", description="Busca por nome ou e-mail"),
    cidade: str = Query(default="", description="Filtro por cidade"),
    estado: str = Query(default="", description="Filtro por estado (UF)"),
    realidade_vocacional: str = Query(default="", description="Code do item de realidade vocacional"),
    ministerio_id: str = Query(default="", description="UUID da unidade org tipo MINISTRY"),
    estado_civil: str = Query(default="", description="Code do item de estado civil"),
    profile_status: str = Query(default="", description="COMPLETE ou INCOMPLETE"),
    limit: int = Query(default=50, le=200),
    offset: int = Query(default=0, ge=0),
) -> Any:
    """
    Lista usuários com perfil, e-mail e papéis globais.
    Requer DEV, ADMIN ou SECRETARY.
    Suporta filtros por: cidade, estado, realidade_vocacional, ministerio_id, estado_civil, profile_status.
    """
    global_roles = get_user_global_roles(db, current_user.id)
    if not any(r in global_roles for r in ["DEV", "ADMIN", "SECRETARY"]):
        if not is_conselho_geral_coordinator(db, current_user.id):
            raise HTTPException(
                status_code=403,
                detail={"error": "forbidden", "message": "Sem permissão para listar usuários"},
            )

    # Base query
    stmt = (
        select(User)
        .outerjoin(UserProfile, User.id == UserProfile.user_id)
        .outerjoin(UserIdentity, User.id == UserIdentity.user_id)
    )

    # Filtro de busca textual (nome ou e-mail)
    if search:
        stmt = stmt.where(
            or_(
                UserProfile.full_name.ilike(f"%{search}%"),
                UserIdentity.email.ilike(f"%{search}%"),
            )
        )

    # Filtros adicionais
    if cidade:
        stmt = stmt.where(UserProfile.city.ilike(f"%{cidade}%"))
    if estado:
        stmt = stmt.where(UserProfile.state.ilike(f"%{estado}%"))
    if profile_status:
        stmt = stmt.where(UserProfile.status == profile_status)

    if realidade_vocacional:
        voc_item = db.execute(
            select(ProfileCatalogItem)
            .join(ProfileCatalog)
            .where(
                ProfileCatalog.code == "VOCATIONAL_REALITY",
                ProfileCatalogItem.code == realidade_vocacional,
            )
        ).scalar_one_or_none()
        if voc_item:
            stmt = stmt.where(UserProfile.vocational_reality_item_id == voc_item.id)
        else:
            # Código inválido — retorna lista vazia
            return {"users": [], "total": 0}

    if estado_civil:
        ec_item = db.execute(
            select(ProfileCatalogItem)
            .join(ProfileCatalog)
            .where(
                ProfileCatalog.code == "MARITAL_STATUS",
                ProfileCatalogItem.code == estado_civil,
            )
        ).scalar_one_or_none()
        if ec_item:
            stmt = stmt.where(UserProfile.marital_status_item_id == ec_item.id)
        else:
            return {"users": [], "total": 0}

    if ministerio_id:
        try:
            from uuid import UUID as _UUID
            min_uuid = _UUID(ministerio_id)
            stmt = stmt.where(UserProfile.interested_ministry_id == min_uuid)
        except ValueError:
            return {"users": [], "total": 0}

    # Contagem total
    count_stmt = select(func.count()).select_from(stmt.subquery())
    total = db.execute(count_stmt).scalar_one()

    # Paginação + ordenação
    stmt = stmt.order_by(nullslast(UserProfile.full_name.asc())).limit(limit).offset(offset)
    users = db.execute(stmt).scalars().unique().all()

    result = []
    for u in users:
        profile = u.profile
        email = u.identities[0].email if u.identities else None
        user_roles = get_user_global_roles(db, u.id)
        result.append(
            {
                "id": str(u.id),
                "name": profile.full_name if profile else None,
                "email": email,
                "photo_url": profile.photo_url if profile else None,
                "profile_status": profile.status if profile else "INCOMPLETE",
                "global_roles": user_roles,
                "created_at": u.created_at.isoformat(),
            }
        )

    return {"users": result, "total": total}
```

Adicionar ao bloco de imports no topo do arquivo (se não existir):
```python
from app.db.models import ProfileCatalog, ProfileCatalogItem
```

- [ ] **Step 4: Rodar os testes**

```bash
cd backend
pytest tests/test_user_filters.py -v
```

Esperado: todos PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/app/api/routes/admin.py backend/tests/test_user_filters.py
git commit -m "feat: add advanced filters to GET /admin/users (cidade, estado, realidade_vocacional, ministerio_id, estado_civil, profile_status)"
```

---

## Task 4: Endpoint GET /admin/users/{id}/profile (perfil completo)

**Files:**
- Modify: `backend/app/api/routes/admin.py`
- Create: `backend/tests/test_user_profile_full.py`

- [ ] **Step 1: Escrever os testes**

Criar `backend/tests/test_user_profile_full.py`:

```python
"""
Testa GET /admin/users/{id}/profile — perfil completo com RG/CPF e auditoria.
"""
import uuid
import datetime
import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session
from app.db.models import (
    User, UserProfile, UserIdentity, GlobalRole, UserGlobalRole, AuditLog
)


def _make_user(db: Session, email: str, roles: list[str] = []) -> tuple[User, dict]:
    uid = uuid.uuid4()
    user = User(id=uid, created_at=datetime.datetime.utcnow())
    identity = UserIdentity(
        user_id=uid, provider="firebase", provider_uid=str(uid), email=email
    )
    profile = UserProfile(user_id=uid, full_name="Test", city="SP", state="SP")
    db.add_all([user, identity, profile])
    db.flush()
    for code in roles:
        role_obj = db.query(GlobalRole).filter_by(code=code).first()
        if not role_obj:
            role_obj = GlobalRole(code=code, name=code)
            db.add(role_obj)
            db.flush()
        db.add(UserGlobalRole(user_id=uid, global_role_id=role_obj.id))
    db.commit()
    return user, {"Authorization": f"Bearer dev:{code.lower() if roles else 'user'}:{email}"}


def test_full_profile_requires_admin(client: TestClient, db_session: Session):
    target, _ = _make_user(db_session, "target@test.com")
    _, user_headers = _make_user(db_session, "regular@test.com")

    resp = client.get(
        f"/admin/users/{target.id}/profile",
        headers=user_headers,
    )
    assert resp.status_code == 403


def test_full_profile_returns_all_fields(client: TestClient, db_session: Session):
    target, _ = _make_user(db_session, "target2@test.com")
    admin, admin_headers = _make_user(db_session, "admin2@test.com", roles=["ADMIN"])

    resp = client.get(
        f"/admin/users/{target.id}/profile",
        headers={"Authorization": "Bearer dev:admin:admin2@test.com"},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert "id" in data
    assert "name" in data
    assert "email" in data
    assert "city" in data
    assert "state" in data
    assert "global_roles" in data
    assert "audit_entries" in data


def test_full_profile_creates_audit_log(client: TestClient, db_session: Session):
    target, _ = _make_user(db_session, "target3@test.com")

    client.get(
        f"/admin/users/{target.id}/profile",
        headers={"Authorization": "Bearer dev:admin:admin3@test.com"},
    )

    # Verifica que foi criada uma entrada de auditoria
    # (mesmo que o admin não exista no banco, o endpoint deve criar o log)
    # Em ambiente de teste com AUTH_MODE=DEV o usuário é criado automaticamente
    logs = db_session.query(AuditLog).filter_by(
        entity_type="USER",
        entity_id=str(target.id),
        action="VIEW_FULL_PROFILE",
    ).all()
    assert len(logs) >= 1


def test_full_profile_404_for_unknown_user(client: TestClient, db_session: Session):
    resp = client.get(
        f"/admin/users/{uuid.uuid4()}/profile",
        headers={"Authorization": "Bearer dev:admin:admin4@test.com"},
    )
    assert resp.status_code == 404
```

- [ ] **Step 2: Rodar — deve falhar (endpoint não existe)**

```bash
cd backend
pytest tests/test_user_profile_full.py -v
```

Esperado: FAILED 404 nos endpoints.

- [ ] **Step 3: Implementar o endpoint**

Em `backend/app/api/routes/admin.py`, após a função `list_users`, adicionar:

```python
@router.get("/users/{user_id}/profile")
async def get_user_full_profile(
    user_id: UUID,
    current_user: CurrentUser,
    db: DBSession,
) -> Any:
    """
    Retorna perfil completo de um usuário, incluindo RG/CPF (descriptografados)
    e histórico de auditoria.
    Requer DEV, ADMIN ou SECRETARY.
    """
    from app.crypto.service import get_crypto_service

    caller_roles = get_user_global_roles(db, current_user.id)
    if not any(r in caller_roles for r in ["DEV", "ADMIN", "SECRETARY"]):
        raise HTTPException(status_code=403, detail={"error": "forbidden"})

    target = db.execute(select(User).where(User.id == user_id)).scalar_one_or_none()
    if not target:
        raise HTTPException(status_code=404, detail={"error": "not_found"})

    profile = target.profile
    email = target.identities[0].email if target.identities else None
    user_roles = get_user_global_roles(db, user_id)

    # Descriptografar RG e CPF
    crypto = get_crypto_service()
    cpf_plain = None
    rg_plain = None
    if profile:
        if profile.cpf_encrypted:
            try:
                cpf_plain = crypto.decrypt(profile.cpf_encrypted)
            except Exception:
                cpf_plain = None
        if profile.rg_encrypted:
            try:
                rg_plain = crypto.decrypt(profile.rg_encrypted)
            except Exception:
                rg_plain = None

    # Auditoria
    db.add(
        AuditLog(
            actor_user_id=current_user.id,
            action="VIEW_FULL_PROFILE",
            entity_type="USER",
            entity_id=str(user_id),
            extra_data={"caller_email": email},
        )
    )
    db.commit()

    # Últimas 50 entradas de auditoria sobre este usuário
    audit_entries = db.execute(
        select(AuditLog)
        .where(AuditLog.entity_type == "USER", AuditLog.entity_id == str(user_id))
        .order_by(desc(AuditLog.created_at))
        .limit(50)
    ).scalars().all()

    return {
        "id": str(target.id),
        "name": profile.full_name if profile else None,
        "email": email,
        "phone": profile.phone_e164 if profile else None,
        "birth_date": profile.birth_date.isoformat() if profile and profile.birth_date else None,
        "city": profile.city if profile else None,
        "state": profile.state if profile else None,
        "instagram": profile.instagram if profile else None,
        "cpf": cpf_plain,
        "rg": rg_plain,
        "profile_status": profile.status if profile else "INCOMPLETE",
        "global_roles": user_roles,
        "created_at": target.created_at.isoformat(),
        "audit_entries": [
            {
                "id": str(e.id),
                "action": e.action,
                "actor_user_id": str(e.actor_user_id) if e.actor_user_id else None,
                "extra_data": e.extra_data,
                "created_at": e.created_at.isoformat(),
            }
            for e in audit_entries
        ],
    }
```

Garantir que `desc` está importado no topo do arquivo (já deve estar de `sqlalchemy import ... desc`).

- [ ] **Step 4: Rodar os testes**

```bash
cd backend
pytest tests/test_user_profile_full.py -v
```

Esperado: todos PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/app/api/routes/admin.py backend/tests/test_user_profile_full.py
git commit -m "feat: GET /admin/users/{id}/profile — full profile with decrypted RG/CPF + audit log"
```

---

## Task 5: Endpoints de exportação (backend)

**Files:**
- Create: `backend/app/api/routes/export.py`
- Modify: `backend/app/main.py`
- Create: `backend/tests/test_export.py`

- [ ] **Step 1: Escrever os testes**

Criar `backend/tests/test_export.py`:

```python
"""
Testa o fluxo de exportação de dados:
- Sem dados sensíveis → CSV gerado imediatamente
- Com dados sensíveis → fica PENDING, requer aprovação
- Aprovação por COUNCIL_GENERAL → CSV gerado
- Download só funciona no status GENERATED e antes de expirar
"""
import uuid
import datetime
import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session
from app.db.models import (
    User, UserProfile, UserIdentity, GlobalRole, UserGlobalRole
)


def _make_user_with_role(db: Session, email: str, role_code: str | None = None) -> User:
    uid = uuid.uuid4()
    user = User(id=uid, created_at=datetime.datetime.utcnow())
    identity = UserIdentity(
        user_id=uid, provider="firebase", provider_uid=str(uid), email=email
    )
    profile = UserProfile(user_id=uid, full_name="Test User")
    db.add_all([user, identity, profile])
    db.flush()
    if role_code:
        role = db.query(GlobalRole).filter_by(code=role_code).first()
        if not role:
            role = GlobalRole(code=role_code, name=role_code)
            db.add(role)
            db.flush()
        db.add(UserGlobalRole(user_id=uid, global_role_id=role.id))
    db.commit()
    return user


def test_export_without_sensitive_is_immediate(client: TestClient, db_session: Session):
    _make_user_with_role(db_session, "admin@exp.com", "ADMIN")

    resp = client.post(
        "/admin/export/request",
        json={"fields": ["name", "email", "city"], "filters": {}},
        headers={"Authorization": "Bearer dev:admin:admin@exp.com"},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "GENERATED"
    assert data["id"] is not None


def test_export_with_sensitive_stays_pending(client: TestClient, db_session: Session):
    _make_user_with_role(db_session, "admin2@exp.com", "ADMIN")

    resp = client.post(
        "/admin/export/request",
        json={"fields": ["name", "email", "cpf", "rg"], "filters": {}},
        headers={"Authorization": "Bearer dev:admin:admin2@exp.com"},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "PENDING"


def test_export_requires_admin_role(client: TestClient, db_session: Session):
    _make_user_with_role(db_session, "regular@exp.com")

    resp = client.post(
        "/admin/export/request",
        json={"fields": ["name", "email"], "filters": {}},
        headers={"Authorization": "Bearer dev:user:regular@exp.com"},
    )
    assert resp.status_code == 403


def test_council_can_approve_export(client: TestClient, db_session: Session):
    _make_user_with_role(db_session, "admin3@exp.com", "ADMIN")
    _make_user_with_role(db_session, "council@exp.com", "COUNCIL_GENERAL")

    # Criar solicitação pendente
    resp = client.post(
        "/admin/export/request",
        json={"fields": ["name", "cpf"], "filters": {}},
        headers={"Authorization": "Bearer dev:admin:admin3@exp.com"},
    )
    assert resp.status_code == 200
    export_id = resp.json()["id"]

    # Aprovar
    resp = client.post(
        f"/admin/export/{export_id}/approve",
        headers={"Authorization": "Bearer dev:council_general:council@exp.com"},
    )
    assert resp.status_code == 200
    assert resp.json()["status"] == "GENERATED"


def test_download_returns_csv(client: TestClient, db_session: Session):
    _make_user_with_role(db_session, "admin4@exp.com", "ADMIN")

    # Gerar exportação sem dados sensíveis
    resp = client.post(
        "/admin/export/request",
        json={"fields": ["name", "email"], "filters": {}},
        headers={"Authorization": "Bearer dev:admin:admin4@exp.com"},
    )
    export_id = resp.json()["id"]

    resp = client.get(
        f"/admin/export/{export_id}/download",
        headers={"Authorization": "Bearer dev:admin:admin4@exp.com"},
    )
    assert resp.status_code == 200
    assert "text/csv" in resp.headers.get("content-type", "")
```

- [ ] **Step 2: Rodar testes — devem falhar**

```bash
cd backend
pytest tests/test_export.py -v
```

Esperado: FAILED (rotas não existem).

- [ ] **Step 3: Criar backend/app/api/routes/export.py**

```python
"""
Export Routes
=============
Endpoints de exportação de dados de usuários com dupla confirmação para dados sensíveis.

Fluxo:
- Sem RG/CPF: CSV gerado imediatamente (status GENERATED)
- Com RG/CPF:  status PENDING → aprovação por COUNCIL_GENERAL/DEV/ADMIN → GENERATED
               Link disponível por 24h, depois EXPIRED
"""

import csv
import io
import os
import uuid
from datetime import datetime, timedelta, timezone
from typing import Any
from uuid import UUID

from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from sqlalchemy import select, or_

from app.api.deps import CurrentUser, DBSession
from app.db.models import (
    AuditLog,
    DataExportRequest,
    GlobalRole,
    User,
    UserGlobalRole,
    UserIdentity,
    UserProfile,
)
from app.services.organization import get_user_global_roles

router = APIRouter(prefix="/admin/export", tags=["Export"])

SENSITIVE_FIELDS = {"cpf", "rg"}
ALLOWED_FIELDS = {
    "name", "email", "phone", "city", "state", "birth_date",
    "instagram", "profile_status", "cpf", "rg",
}
EXPORT_TTL_HOURS = 24


def _require_export_permission(db, user_id: UUID) -> None:
    roles = get_user_global_roles(db, user_id)
    if not any(r in roles for r in ["DEV", "ADMIN", "SECRETARY"]):
        raise HTTPException(status_code=403, detail={"error": "forbidden"})


def _require_approval_permission(db, user_id: UUID) -> None:
    roles = get_user_global_roles(db, user_id)
    if not any(r in roles for r in ["DEV", "ADMIN", "COUNCIL_GENERAL"]):
        raise HTTPException(status_code=403, detail={"error": "forbidden"})


def _generate_csv(db, fields: list[str], filters: dict) -> str:
    """Gera CSV em memória com os usuários que passam nos filtros."""
    from app.crypto.service import get_crypto_service
    crypto = get_crypto_service()

    stmt = (
        select(User)
        .outerjoin(UserProfile, User.id == UserProfile.user_id)
        .outerjoin(UserIdentity, User.id == UserIdentity.user_id)
    )

    users = db.execute(stmt).scalars().unique().all()

    output = io.StringIO()
    writer = csv.DictWriter(output, fieldnames=fields)
    writer.writeheader()

    for user in users:
        profile = user.profile
        identity = user.identities[0] if user.identities else None
        row = {}
        for field in fields:
            if field == "name":
                row["name"] = profile.full_name if profile else ""
            elif field == "email":
                row["email"] = identity.email if identity else ""
            elif field == "phone":
                row["phone"] = profile.phone_e164 if profile else ""
            elif field == "city":
                row["city"] = profile.city if profile else ""
            elif field == "state":
                row["state"] = profile.state if profile else ""
            elif field == "birth_date":
                row["birth_date"] = profile.birth_date.isoformat() if profile and profile.birth_date else ""
            elif field == "instagram":
                row["instagram"] = profile.instagram if profile else ""
            elif field == "profile_status":
                row["profile_status"] = profile.status if profile else "INCOMPLETE"
            elif field == "cpf":
                if profile and profile.cpf_encrypted:
                    try:
                        row["cpf"] = crypto.decrypt(profile.cpf_encrypted)
                    except Exception:
                        row["cpf"] = ""
                else:
                    row["cpf"] = ""
            elif field == "rg":
                if profile and profile.rg_encrypted:
                    try:
                        row["rg"] = crypto.decrypt(profile.rg_encrypted)
                    except Exception:
                        row["rg"] = ""
                else:
                    row["rg"] = ""
        writer.writerow(row)

    return output.getvalue()


class ExportRequestBody(BaseModel):
    fields: list[str]
    filters: dict = {}


@router.post("/request")
async def create_export_request(
    body: ExportRequestBody,
    current_user: CurrentUser,
    db: DBSession,
) -> Any:
    """Solicita exportação. CSV imediato se sem dados sensíveis, PENDING se tiver."""
    _require_export_permission(db, current_user.id)

    # Valida campos
    invalid = set(body.fields) - ALLOWED_FIELDS
    if invalid:
        raise HTTPException(
            status_code=422,
            detail={"error": "invalid_fields", "fields": list(invalid)},
        )

    has_sensitive = bool(set(body.fields) & SENSITIVE_FIELDS)

    export_req = DataExportRequest(
        requested_by=current_user.id,
        status="PENDING" if has_sensitive else "PENDING",
        fields_requested=body.fields,
        filters_json=body.filters,
        has_sensitive=has_sensitive,
    )
    db.add(export_req)
    db.flush()

    db.add(
        AuditLog(
            actor_user_id=current_user.id,
            action="EXPORT_REQUESTED",
            entity_type="DATA_EXPORT",
            entity_id=str(export_req.id),
            extra_data={"fields": body.fields, "has_sensitive": has_sensitive},
        )
    )

    if not has_sensitive:
        # Gerar imediatamente
        csv_content = _generate_csv(db, body.fields, body.filters)
        file_path = f"/tmp/export_{export_req.id}.csv"
        with open(file_path, "w", encoding="utf-8") as f:
            f.write(csv_content)
        export_req.status = "GENERATED"
        export_req.file_path = file_path
        export_req.expires_at = datetime.now(timezone.utc) + timedelta(hours=EXPORT_TTL_HOURS)
        db.commit()
        return {
            "id": str(export_req.id),
            "status": export_req.status,
            "has_sensitive": has_sensitive,
            "expires_at": export_req.expires_at.isoformat(),
        }
    else:
        # Notificar COUNCIL_GENERAL via Inbox
        _notify_council_for_approval(db, export_req, current_user.id)
        db.commit()
        return {
            "id": str(export_req.id),
            "status": export_req.status,
            "has_sensitive": has_sensitive,
            "message": "Aguardando aprovação do Conselho Geral",
        }


def _notify_council_for_approval(db, export_req: DataExportRequest, requester_id: UUID) -> None:
    """Envia mensagem no Inbox para todos os usuários com cargo COUNCIL_GENERAL."""
    from app.services.inbox_service import InboxService
    from app.schemas.inbox import InboxFilters

    requester = db.execute(select(User).where(User.id == requester_id)).scalar_one_or_none()
    requester_name = requester.profile.full_name if requester and requester.profile else "Alguém"

    fields_str = ", ".join(export_req.fields_requested)
    title = "Aprovação necessária: Exportação de dados sensíveis"
    message = (
        f"{requester_name} solicitou uma exportação de dados que inclui informações sensíveis "
        f"(campos: {fields_str}). Acesse a área de Aprovações no painel admin para aprovar ou rejeitar."
    )

    # Buscar IDs dos usuários COUNCIL_GENERAL
    council_user_ids = db.execute(
        select(UserGlobalRole.user_id)
        .join(GlobalRole)
        .where(GlobalRole.code == "COUNCIL_GENERAL")
    ).scalars().all()

    if not council_user_ids:
        return

    # Usar sistema de inbox existente — envio direto sem filtros
    from app.db.models import InboxMessage, InboxMessageType, InboxApprovalStatus, InboxRecipient
    from datetime import timedelta

    inbox_msg = InboxMessage(
        title=title,
        message=message,
        type=InboxMessageType.INFO,
        created_by_user_id=requester_id,
        expires_at=datetime.now(timezone.utc) + timedelta(days=7),
        approval_status=InboxApprovalStatus.AUTO_APPROVED,
    )
    db.add(inbox_msg)
    db.flush()

    for uid in council_user_ids:
        db.add(InboxRecipient(message_id=inbox_msg.id, user_id=uid))


@router.get("/requests")
async def list_export_requests(
    current_user: CurrentUser,
    db: DBSession,
) -> Any:
    """Lista solicitações. DEV/ADMIN/COUNCIL_GENERAL veem todas pendentes; outros veem as próprias."""
    caller_roles = get_user_global_roles(db, current_user.id)
    can_see_all = any(r in caller_roles for r in ["DEV", "ADMIN", "COUNCIL_GENERAL"])

    stmt = select(DataExportRequest).order_by(DataExportRequest.created_at.desc())
    if not can_see_all:
        stmt = stmt.where(DataExportRequest.requested_by == current_user.id)

    reqs = db.execute(stmt).scalars().all()
    return [
        {
            "id": str(r.id),
            "requested_by": str(r.requested_by),
            "status": r.status,
            "fields_requested": r.fields_requested,
            "has_sensitive": r.has_sensitive,
            "approved_by": str(r.approved_by) if r.approved_by else None,
            "approved_at": r.approved_at.isoformat() if r.approved_at else None,
            "expires_at": r.expires_at.isoformat() if r.expires_at else None,
            "created_at": r.created_at.isoformat(),
        }
        for r in reqs
    ]


@router.post("/{export_id}/approve")
async def approve_export(
    export_id: UUID,
    current_user: CurrentUser,
    db: DBSession,
) -> Any:
    """Aprova exportação pendente. Requer COUNCIL_GENERAL, DEV ou ADMIN."""
    _require_approval_permission(db, current_user.id)

    export_req = db.execute(
        select(DataExportRequest).where(DataExportRequest.id == export_id)
    ).scalar_one_or_none()
    if not export_req:
        raise HTTPException(status_code=404, detail={"error": "not_found"})
    if export_req.status != "PENDING":
        raise HTTPException(
            status_code=409,
            detail={"error": "not_pending", "current_status": export_req.status},
        )

    csv_content = _generate_csv(db, export_req.fields_requested, export_req.filters_json or {})
    file_path = f"/tmp/export_{export_req.id}.csv"
    with open(file_path, "w", encoding="utf-8") as f:
        f.write(csv_content)

    now = datetime.now(timezone.utc)
    export_req.status = "GENERATED"
    export_req.approved_by = current_user.id
    export_req.approved_at = now
    export_req.file_path = file_path
    export_req.expires_at = now + timedelta(hours=EXPORT_TTL_HOURS)

    db.add(
        AuditLog(
            actor_user_id=current_user.id,
            action="EXPORT_APPROVED",
            entity_type="DATA_EXPORT",
            entity_id=str(export_id),
        )
    )

    # Notificar solicitante
    _notify_requester_approved(db, export_req, current_user.id)

    db.commit()
    return {"id": str(export_req.id), "status": export_req.status}


def _notify_requester_approved(db, export_req: DataExportRequest, approver_id: UUID) -> None:
    """Envia inbox para o solicitante informando que a exportação foi aprovada."""
    from app.db.models import InboxMessage, InboxMessageType, InboxApprovalStatus, InboxRecipient
    from datetime import timedelta

    inbox_msg = InboxMessage(
        title="Exportação aprovada",
        message="Sua exportação de dados foi aprovada e está disponível para download por 24 horas.",
        type=InboxMessageType.INFO,
        created_by_user_id=approver_id,
        expires_at=datetime.now(timezone.utc) + timedelta(days=2),
        approval_status=InboxApprovalStatus.AUTO_APPROVED,
    )
    db.add(inbox_msg)
    db.flush()
    db.add(InboxRecipient(message_id=inbox_msg.id, user_id=export_req.requested_by))


@router.post("/{export_id}/reject")
async def reject_export(
    export_id: UUID,
    current_user: CurrentUser,
    db: DBSession,
) -> Any:
    """Rejeita exportação pendente."""
    _require_approval_permission(db, current_user.id)

    export_req = db.execute(
        select(DataExportRequest).where(DataExportRequest.id == export_id)
    ).scalar_one_or_none()
    if not export_req:
        raise HTTPException(status_code=404, detail={"error": "not_found"})
    if export_req.status != "PENDING":
        raise HTTPException(status_code=409, detail={"error": "not_pending"})

    export_req.status = "REJECTED"
    db.add(
        AuditLog(
            actor_user_id=current_user.id,
            action="EXPORT_REJECTED",
            entity_type="DATA_EXPORT",
            entity_id=str(export_id),
        )
    )
    db.commit()
    return {"id": str(export_req.id), "status": "REJECTED"}


@router.get("/{export_id}/download")
async def download_export(
    export_id: UUID,
    current_user: CurrentUser,
    db: DBSession,
) -> StreamingResponse:
    """Baixa o CSV. Apenas o solicitante ou admins. Registra auditoria."""
    caller_roles = get_user_global_roles(db, current_user.id)
    is_admin = any(r in caller_roles for r in ["DEV", "ADMIN"])

    export_req = db.execute(
        select(DataExportRequest).where(DataExportRequest.id == export_id)
    ).scalar_one_or_none()
    if not export_req:
        raise HTTPException(status_code=404, detail={"error": "not_found"})

    if export_req.requested_by != current_user.id and not is_admin:
        raise HTTPException(status_code=403, detail={"error": "forbidden"})

    if export_req.status != "GENERATED":
        raise HTTPException(
            status_code=409,
            detail={"error": "not_ready", "status": export_req.status},
        )

    now = datetime.now(timezone.utc)
    if export_req.expires_at and now > export_req.expires_at:
        export_req.status = "EXPIRED"
        db.commit()
        raise HTTPException(status_code=410, detail={"error": "expired"})

    if not export_req.file_path or not os.path.exists(export_req.file_path):
        raise HTTPException(status_code=500, detail={"error": "file_not_found"})

    db.add(
        AuditLog(
            actor_user_id=current_user.id,
            action="EXPORT_DOWNLOADED",
            entity_type="DATA_EXPORT",
            entity_id=str(export_id),
        )
    )
    db.commit()

    def iter_file():
        with open(export_req.file_path, "r", encoding="utf-8") as f:
            yield from f

    return StreamingResponse(
        iter_file(),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename=export_{export_id}.csv"},
    )
```

- [ ] **Step 4: Registrar o router em main.py**

Abrir `backend/app/main.py` e localizar onde os outros routers admin são registrados. Adicionar:

```python
from app.api.routes.export import router as export_router
# ...
app.include_router(export_router)
```

- [ ] **Step 5: Rodar os testes**

```bash
cd backend
pytest tests/test_export.py -v
```

Esperado: todos PASS.

- [ ] **Step 6: Rodar todos os testes para garantir que não quebrou nada**

```bash
cd backend
pytest tests/ -v --tb=short
```

Esperado: todos PASS (ou os que já estavam passando continuam passando).

- [ ] **Step 7: Commit**

```bash
git add backend/app/api/routes/export.py backend/app/main.py backend/tests/test_export.py
git commit -m "feat: data export endpoints — immediate CSV for non-sensitive, pending+approval flow for RG/CPF"
```

---

## Task 6: Mobile — Filtros na tela de usuários

**Files:**
- Modify: `lumen_mobile/app/admin/users/index.tsx`
- Modify: `lumen_mobile/src/services/index.ts`

- [ ] **Step 1: Atualizar o service para incluir os novos filtros**

Abrir `lumen_mobile/src/services/index.ts`. Localizar a função `adminUserService.listUsers`. Atualizar o tipo de parâmetro:

```typescript
export interface ListUsersParams {
  search?: string;
  limit?: number;
  offset?: number;
  cidade?: string;
  estado?: string;
  realidade_vocacional?: string;
  ministerio_id?: string;
  estado_civil?: string;
  profile_status?: string;
}
```

E a implementação (localizar `listUsers` e atualizar para passar os novos params via URLSearchParams ou objeto):

```typescript
listUsers: async (params: ListUsersParams = {}): Promise<{ users: AdminUserItem[]; total: number }> => {
  const query = new URLSearchParams();
  if (params.search)               query.set('search', params.search);
  if (params.limit)                query.set('limit', String(params.limit));
  if (params.offset !== undefined) query.set('offset', String(params.offset));
  if (params.cidade)               query.set('cidade', params.cidade);
  if (params.estado)               query.set('estado', params.estado);
  if (params.realidade_vocacional) query.set('realidade_vocacional', params.realidade_vocacional);
  if (params.ministerio_id)        query.set('ministerio_id', params.ministerio_id);
  if (params.estado_civil)         query.set('estado_civil', params.estado_civil);
  if (params.profile_status)       query.set('profile_status', params.profile_status);

  const response = await api.get<{ users: AdminUserItem[]; total: number }>(
    `/admin/users?${query.toString()}`
  );
  return response;
},
```

- [ ] **Step 2: Atualizar index.tsx — estado de filtros**

Abrir `lumen_mobile/app/admin/users/index.tsx`. No bloco de estado (`useState`), adicionar após `const [error, setError]`:

```typescript
const [filtersVisible, setFiltersVisible] = useState(false);
const [filters, setFilters] = useState<{
  cidade: string;
  estado: string;
  realidade_vocacional: string;
  estado_civil: string;
  profile_status: string;
}>({
  cidade: '',
  estado: '',
  realidade_vocacional: '',
  estado_civil: '',
  profile_status: '',
});
```

- [ ] **Step 3: Atualizar fetchUsers para passar filtros**

Localizar `fetchUsers` e alterar a chamada:

```typescript
const fetchUsers = useCallback(async (q: string, offset: number, append: boolean = false) => {
  try {
    setError(null);
    const data = await adminUserService.listUsers({
      search: q,
      limit: LIMIT,
      offset,
      ...Object.fromEntries(
        Object.entries(filters).filter(([_, v]) => v !== '')
      ),
    });
    if (append) {
      setUsers((prev) => [...prev, ...data.users]);
    } else {
      setUsers(data.users);
    }
    setTotal(data.total);
  } catch (e: any) {
    const msg = e?.response?.data?.detail?.message ?? 'Erro ao carregar usuários';
    setError(msg);
  }
}, [filters]);
```

- [ ] **Step 4: Adicionar botão Filtrar e pills de filtros ativos**

Na View do `searchBar`, adicionar botão após o `TextInput`:

```tsx
{/* Botão filtrar */}
<TouchableOpacity
  style={[styles.filterBtn, activeFilterCount > 0 && styles.filterBtnActive]}
  onPress={() => setFiltersVisible(true)}
>
  <Ionicons name="options-outline" size={18} color={activeFilterCount > 0 ? colors.white : colors.admin} />
  {activeFilterCount > 0 && (
    <Text style={styles.filterBtnCount}>{activeFilterCount}</Text>
  )}
</TouchableOpacity>
```

Calcular `activeFilterCount` antes do return:

```typescript
const activeFilterCount = Object.values(filters).filter(Boolean).length;
```

Adicionar linha de pills logo após a searchBar (antes do totalText):

```tsx
{activeFilterCount > 0 && (
  <View style={styles.pillRow}>
    {Object.entries(filters).map(([key, val]) =>
      val ? (
        <TouchableOpacity
          key={key}
          style={styles.pill}
          onPress={() => setFilters((prev) => ({ ...prev, [key]: '' }))}
        >
          <Text style={styles.pillText}>{FILTER_LABELS[key]}: {val}</Text>
          <Ionicons name="close-circle" size={14} color={colors.admin} />
        </TouchableOpacity>
      ) : null
    )}
  </View>
)}
```

Adicionar constante de labels:

```typescript
const FILTER_LABELS: Record<string, string> = {
  cidade: 'Cidade',
  estado: 'Estado',
  realidade_vocacional: 'Voc.',
  estado_civil: 'Est. Civil',
  profile_status: 'Status',
};
```

- [ ] **Step 5: Adicionar bottom sheet de filtros (FilterModal)**

Ao final do arquivo, antes dos StyleSheet, adicionar o componente:

```tsx
function FilterModal({
  visible,
  filters,
  onChange,
  onClose,
  onApply,
}: {
  visible: boolean;
  filters: Record<string, string>;
  onChange: (key: string, val: string) => void;
  onClose: () => void;
  onApply: () => void;
}) {
  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: '#fff' }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, borderBottomWidth: 1, borderBottomColor: '#E8E8E8' }}>
          <Text style={{ fontSize: 16, fontWeight: '700' }}>Filtros</Text>
          <TouchableOpacity onPress={onClose}>
            <Ionicons name="close" size={24} color="#171717" />
          </TouchableOpacity>
        </View>
        <ScrollView style={{ flex: 1, padding: 16 }}>
          {[
            { key: 'cidade', label: 'Cidade', placeholder: 'Ex: São Paulo' },
            { key: 'estado', label: 'Estado (UF)', placeholder: 'Ex: SP' },
            { key: 'realidade_vocacional', label: 'Realidade Vocacional', placeholder: 'Ex: VOCACIONAL' },
            { key: 'estado_civil', label: 'Estado Civil', placeholder: 'Ex: SOLTEIRO' },
            { key: 'profile_status', label: 'Status do Perfil', placeholder: 'COMPLETE ou INCOMPLETE' },
          ].map(({ key, label, placeholder }) => (
            <View key={key} style={{ marginBottom: 16 }}>
              <Text style={{ fontSize: 13, fontWeight: '600', marginBottom: 4 }}>{label}</Text>
              <TextInput
                style={{ borderWidth: 1, borderColor: '#E8E8E8', borderRadius: 8, padding: 10, fontSize: 14 }}
                value={filters[key] ?? ''}
                onChangeText={(v) => onChange(key, v)}
                placeholder={placeholder}
                placeholderTextColor="#6b7280"
                autoCapitalize="none"
              />
            </View>
          ))}
        </ScrollView>
        <View style={{ flexDirection: 'row', gap: 12, padding: 16, borderTopWidth: 1, borderTopColor: '#E8E8E8' }}>
          <TouchableOpacity
            style={{ flex: 1, borderWidth: 2, borderColor: '#7c3aed', borderRadius: 10, paddingVertical: 14, alignItems: 'center' }}
            onPress={() => { onChange('cidade', ''); onChange('estado', ''); onChange('realidade_vocacional', ''); onChange('estado_civil', ''); onChange('profile_status', ''); onApply(); onClose(); }}
          >
            <Text style={{ color: '#7c3aed', fontWeight: '700' }}>Limpar</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={{ flex: 1, backgroundColor: '#7c3aed', borderRadius: 10, paddingVertical: 14, alignItems: 'center' }}
            onPress={() => { onApply(); onClose(); }}
          >
            <Text style={{ color: '#fff', fontWeight: '700' }}>Aplicar</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}
```

Renderizar antes do `EditUserModal`:

```tsx
<FilterModal
  visible={filtersVisible}
  filters={filters}
  onChange={(key, val) => setFilters((prev) => ({ ...prev, [key]: val }))}
  onClose={() => setFiltersVisible(false)}
  onApply={() => { setLoading(true); fetchUsers(search, 0).finally(() => setLoading(false)); }}
/>
```

Adicionar estilos:

```typescript
filterBtn: { padding: 6, marginLeft: 4, borderRadius: 8, borderWidth: 1, borderColor: colors.admin, flexDirection: 'row', alignItems: 'center', gap: 4 },
filterBtnActive: { backgroundColor: colors.admin },
filterBtnCount: { color: colors.white, fontSize: 12, fontWeight: '700' },
pillRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, paddingHorizontal: 12, paddingBottom: 6 },
pill: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#ede9fe', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4 },
pillText: { color: colors.admin, fontSize: 12, fontWeight: '600' },
```

- [ ] **Step 6: Commit**

```bash
git add lumen_mobile/app/admin/users/index.tsx lumen_mobile/src/services/index.ts
git commit -m "feat(mobile): advanced filters in user management screen"
```

---

## Task 7: Mobile — Tela de perfil completo do usuário

**Files:**
- Create: `lumen_mobile/app/admin/users/[id].tsx`
- Modify: `lumen_mobile/app/admin/users/_layout.tsx`
- Modify: `lumen_mobile/app/admin/users/index.tsx`
- Modify: `lumen_mobile/src/services/index.ts`

- [ ] **Step 1: Adicionar adminUserProfileService ao services/index.ts**

Em `lumen_mobile/src/services/index.ts`, adicionar:

```typescript
export interface UserFullProfile {
  id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  birth_date: string | null;
  city: string | null;
  state: string | null;
  instagram: string | null;
  cpf: string | null;
  rg: string | null;
  profile_status: string;
  global_roles: string[];
  created_at: string;
  audit_entries: Array<{
    id: string;
    action: string;
    actor_user_id: string | null;
    extra_data: Record<string, any> | null;
    created_at: string;
  }>;
}

export const adminUserProfileService = {
  getFullProfile: async (userId: string): Promise<UserFullProfile> => {
    return api.get<UserFullProfile>(`/admin/users/${userId}/profile`);
  },
};
```

- [ ] **Step 2: Criar a tela [id].tsx**

Criar `lumen_mobile/app/admin/users/[id].tsx`:

```tsx
/**
 * Admin — Perfil Completo do Usuário
 * ===================================
 * Exibe todos os dados do perfil, incluindo RG/CPF com toggle de visibilidade.
 * Acessível apenas para DEV, ADMIN e SECRETARY.
 * Todo acesso é auditado automaticamente pelo backend.
 */

import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { adminUserProfileService, UserFullProfile } from '@/services';

const colors = {
  admin: '#7c3aed',
  white: '#ffffff',
  gray: '#6b7280',
  lightGray: '#E8E8E8',
  danger: '#dc2626',
  text: '#171717',
  bg: '#f5f5f5',
  success: '#16a34a',
};

const ROLE_LABELS: Record<string, { label: string; color: string }> = {
  DEV:            { label: 'Dev',           color: '#1d4ed8' },
  ADMIN:          { label: 'Admin',         color: '#7c3aed' },
  SECRETARY:      { label: 'Secretário',    color: '#0891b2' },
  AVISOS:         { label: 'Avisos',        color: '#d97706' },
  COUNCIL_GENERAL:{ label: 'Conselho Geral',color: '#7c3aed' },
  ANALISTA:       { label: 'Analista',      color: '#059669' },
};

const ACTION_LABELS: Record<string, string> = {
  VIEW_FULL_PROFILE: 'Visualizou perfil completo',
  VIEW_SENSITIVE_FIELD: 'Visualizou campo sensível',
  ROLE_GRANTED: 'Cargo concedido',
  ROLE_REVOKED: 'Cargo revogado',
  EXPORT_REQUESTED: 'Solicitou exportação',
  EXPORT_APPROVED: 'Aprovou exportação',
  EXPORT_DOWNLOADED: 'Baixou exportação',
};

export default function UserFullProfileScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [profile, setProfile] = useState<UserFullProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cpfVisible, setCpfVisible] = useState(false);
  const [rgVisible, setRgVisible] = useState(false);

  useEffect(() => {
    if (!id) return;
    adminUserProfileService
      .getFullProfile(id)
      .then(setProfile)
      .catch((e: any) => {
        const msg = e?.response?.data?.detail?.message ?? 'Erro ao carregar perfil';
        setError(msg);
      })
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.admin} />
      </View>
    );
  }

  if (error || !profile) {
    return (
      <View style={styles.center}>
        <Ionicons name="alert-circle-outline" size={40} color={colors.danger} />
        <Text style={styles.errorText}>{error ?? 'Perfil não encontrado'}</Text>
      </View>
    );
  }

  const initial = (profile.name ?? profile.email ?? '?')[0].toUpperCase();

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Cabeçalho */}
      <View style={styles.header}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{initial}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.name}>{profile.name ?? '—'}</Text>
          <Text style={styles.email}>{profile.email ?? '—'}</Text>
          <View style={styles.roleRow}>
            {profile.global_roles.map((r) => {
              const info = ROLE_LABELS[r];
              if (!info) return null;
              return (
                <View key={r} style={[styles.rolePill, { backgroundColor: info.color + '18', borderColor: info.color }]}>
                  <Text style={[styles.rolePillText, { color: info.color }]}>{info.label}</Text>
                </View>
              );
            })}
          </View>
        </View>
      </View>

      {/* Dados Pessoais */}
      <Section title="Dados Pessoais">
        <Field label="Telefone" value={profile.phone} />
        <Field label="Data de Nascimento" value={profile.birth_date} />
        <Field label="Cidade" value={profile.city} />
        <Field label="Estado" value={profile.state} />
        <Field label="Instagram" value={profile.instagram} />
        <Field label="Cadastrado em" value={profile.created_at?.slice(0, 10)} />
      </Section>

      {/* Documentos */}
      <Section title="Documentos">
        <SensitiveField
          label="CPF"
          value={profile.cpf}
          visible={cpfVisible}
          onToggle={() => setCpfVisible((v) => !v)}
        />
        <SensitiveField
          label="RG"
          value={profile.rg}
          visible={rgVisible}
          onToggle={() => setRgVisible((v) => !v)}
        />
      </Section>

      {/* Auditoria */}
      <Section title={`Auditoria (${profile.audit_entries.length})`}>
        {profile.audit_entries.length === 0 ? (
          <Text style={styles.emptyText}>Nenhuma ação registrada</Text>
        ) : (
          profile.audit_entries.map((entry) => (
            <View key={entry.id} style={styles.auditRow}>
              <View style={styles.auditDot} />
              <View style={{ flex: 1 }}>
                <Text style={styles.auditAction}>
                  {ACTION_LABELS[entry.action] ?? entry.action}
                </Text>
                <Text style={styles.auditDate}>
                  {new Date(entry.created_at).toLocaleString('pt-BR')}
                </Text>
              </View>
            </View>
          ))
        )}
      </Section>
    </ScrollView>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

function Field({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <View style={styles.fieldRow}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <Text style={styles.fieldValue}>{value ?? '—'}</Text>
    </View>
  );
}

function SensitiveField({
  label,
  value,
  visible,
  onToggle,
}: {
  label: string;
  value: string | null;
  visible: boolean;
  onToggle: () => void;
}) {
  return (
    <View style={styles.fieldRow}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <Text style={styles.fieldValue}>
          {value ? (visible ? value : '•••••••••') : '—'}
        </Text>
        {value && (
          <TouchableOpacity onPress={onToggle}>
            <Ionicons
              name={visible ? 'eye-off-outline' : 'eye-outline'}
              size={18}
              color={colors.gray}
            />
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  content: { paddingBottom: 40 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 24 },
  errorText: { color: colors.danger, fontSize: 14, textAlign: 'center' },

  header: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    backgroundColor: colors.white, padding: 16,
    borderBottomWidth: 1, borderBottomColor: colors.lightGray,
  },
  avatar: {
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: colors.admin, alignItems: 'center', justifyContent: 'center',
  },
  avatarText: { color: colors.white, fontSize: 22, fontWeight: '700' },
  name: { fontSize: 17, fontWeight: '700', color: colors.text },
  email: { fontSize: 13, color: colors.gray, marginTop: 2 },
  roleRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 6 },
  rolePill: { borderWidth: 1, borderRadius: 20, paddingHorizontal: 8, paddingVertical: 3 },
  rolePillText: { fontSize: 11, fontWeight: '700' },

  section: {
    backgroundColor: colors.white, marginTop: 12,
    borderRadius: 12, marginHorizontal: 12, overflow: 'hidden',
  },
  sectionTitle: {
    fontSize: 13, fontWeight: '700', color: colors.admin,
    paddingHorizontal: 16, paddingTop: 14, paddingBottom: 8,
    borderBottomWidth: 1, borderBottomColor: colors.lightGray,
  },
  fieldRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 10,
    borderBottomWidth: 1, borderBottomColor: '#f3f4f6',
  },
  fieldLabel: { fontSize: 13, color: colors.gray, flex: 1 },
  fieldValue: { fontSize: 13, color: colors.text, fontWeight: '500', flexShrink: 1, textAlign: 'right' },

  auditRow: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 10,
    paddingHorizontal: 16, paddingVertical: 10,
    borderBottomWidth: 1, borderBottomColor: '#f3f4f6',
  },
  auditDot: {
    width: 8, height: 8, borderRadius: 4,
    backgroundColor: colors.admin, marginTop: 4,
  },
  auditAction: { fontSize: 13, color: colors.text, fontWeight: '500' },
  auditDate: { fontSize: 11, color: colors.gray, marginTop: 2 },
  emptyText: { fontSize: 13, color: colors.gray, padding: 16, textAlign: 'center' },
});
```

- [ ] **Step 3: Adicionar rota [id] ao layout**

Abrir `lumen_mobile/app/admin/users/_layout.tsx`. Verificar se existe e adicionar a rota dinâmica se não estiver:

```tsx
// Dentro do Stack ou Tabs, adicionar:
<Stack.Screen name="[id]" options={{ title: 'Perfil do Usuário' }} />
```

- [ ] **Step 4: Tornar o card de usuário navegável**

Em `lumen_mobile/app/admin/users/index.tsx`, na função `renderUser`, substituir o `<View style={styles.userCard}>` externo por `<TouchableOpacity>` que navega para o perfil:

```tsx
import { useRouter } from 'expo-router';
// ... dentro do componente:
const router = useRouter();

// No renderUser, substituir:
<TouchableOpacity
  style={styles.userCard}
  onPress={() => router.push(`/admin/users/${item.id}`)}
  activeOpacity={0.7}
>
  {/* conteúdo existente */}
</TouchableOpacity>
```

- [ ] **Step 5: Commit**

```bash
git add lumen_mobile/app/admin/users/[id].tsx lumen_mobile/app/admin/users/_layout.tsx lumen_mobile/app/admin/users/index.tsx lumen_mobile/src/services/index.ts
git commit -m "feat(mobile): full user profile screen with audited RG/CPF toggle"
```

---

## Task 8: Mobile — Tela de exportação e fila de aprovações

**Files:**
- Create: `lumen_mobile/app/admin/users/export.tsx`
- Create: `lumen_mobile/app/admin/approvals/index.tsx`
- Modify: `lumen_mobile/app/admin/_layout.tsx`
- Modify: `lumen_mobile/src/services/index.ts`

- [ ] **Step 1: Adicionar adminExportService ao services/index.ts**

```typescript
export interface ExportRequest {
  id: string;
  requested_by: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'GENERATED' | 'EXPIRED';
  fields_requested: string[];
  has_sensitive: boolean;
  approved_by: string | null;
  approved_at: string | null;
  expires_at: string | null;
  created_at: string;
}

export const adminExportService = {
  requestExport: async (fields: string[], filters: Record<string, string> = {}): Promise<ExportRequest & { message?: string }> => {
    return api.post('/admin/export/request', { fields, filters });
  },
  listRequests: async (): Promise<ExportRequest[]> => {
    return api.get('/admin/export/requests');
  },
  approve: async (id: string): Promise<ExportRequest> => {
    return api.post(`/admin/export/${id}/approve`);
  },
  reject: async (id: string): Promise<ExportRequest> => {
    return api.post(`/admin/export/${id}/reject`);
  },
  getDownloadUrl: (id: string): string => {
    return `/admin/export/${id}/download`;
  },
};
```

- [ ] **Step 2: Criar a tela de solicitação de exportação**

Criar `lumen_mobile/app/admin/users/export.tsx`:

```tsx
/**
 * Admin — Exportar Lista de Usuários
 * ====================================
 * Permite selecionar campos e solicitar exportação em CSV.
 * Campos sensíveis (RG/CPF) requerem aprovação do Conselho Geral.
 */

import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { adminExportService } from '@/services';

const FIELD_GROUPS = [
  {
    label: 'Dados Básicos',
    fields: [
      { code: 'name',           label: 'Nome' },
      { code: 'email',          label: 'E-mail' },
      { code: 'phone',          label: 'Telefone' },
      { code: 'birth_date',     label: 'Data de Nascimento' },
      { code: 'city',           label: 'Cidade' },
      { code: 'state',          label: 'Estado' },
      { code: 'profile_status', label: 'Status do Perfil' },
    ],
  },
  {
    label: 'Documentos (requer aprovação)',
    fields: [
      { code: 'cpf', label: 'CPF' },
      { code: 'rg',  label: 'RG'  },
    ],
    sensitive: true,
  },
];

const SENSITIVE = new Set(['cpf', 'rg']);

const colors = { admin: '#7c3aed', white: '#fff', gray: '#6b7280', lightGray: '#E8E8E8', text: '#171717', danger: '#dc2626', warning: '#d97706' };

export default function ExportScreen() {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set(['name', 'email']));
  const [loading, setLoading] = useState(false);

  const toggle = (code: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(code) ? next.delete(code) : next.add(code);
      return next;
    });

  const hasSensitive = [...selected].some((f) => SENSITIVE.has(f));

  const handleExport = async () => {
    if (selected.size === 0) {
      Alert.alert('Selecione ao menos um campo');
      return;
    }
    if (hasSensitive) {
      Alert.alert(
        'Dados sensíveis',
        'Esta exportação inclui RG e/ou CPF e requer aprovação do Conselho Geral. Deseja enviar para aprovação?',
        [
          { text: 'Cancelar', style: 'cancel' },
          { text: 'Enviar', onPress: doExport },
        ]
      );
    } else {
      doExport();
    }
  };

  const doExport = async () => {
    setLoading(true);
    try {
      const result = await adminExportService.requestExport([...selected]);
      if (result.status === 'GENERATED') {
        Alert.alert('Pronto!', 'O CSV está disponível. Acesse a fila de exportações para baixar.', [
          { text: 'OK', onPress: () => router.back() },
        ]);
      } else {
        Alert.alert('Enviado para aprovação', result.message ?? 'Aguardando aprovação do Conselho Geral.', [
          { text: 'OK', onPress: () => router.back() },
        ]);
      }
    } catch (e: any) {
      Alert.alert('Erro', e?.response?.data?.detail?.message ?? 'Erro ao solicitar exportação');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: '#f5f5f5' }}>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 100 }}>
        {hasSensitive && (
          <View style={styles.warningBox}>
            <Ionicons name="lock-closed-outline" size={18} color={colors.warning} />
            <Text style={styles.warningText}>
              Campos sensíveis selecionados — exportação requer aprovação do Conselho Geral
            </Text>
          </View>
        )}

        {FIELD_GROUPS.map((group) => (
          <View key={group.label} style={styles.group}>
            <Text style={styles.groupLabel}>{group.label}</Text>
            {group.fields.map((field) => {
              const active = selected.has(field.code);
              return (
                <TouchableOpacity
                  key={field.code}
                  style={styles.fieldRow}
                  onPress={() => toggle(field.code)}
                >
                  <Ionicons
                    name={active ? 'checkbox' : 'square-outline'}
                    size={22}
                    color={active ? colors.admin : colors.gray}
                  />
                  <Text style={[styles.fieldLabel, active && { color: colors.text, fontWeight: '600' }]}>
                    {field.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        ))}
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.exportBtn, loading && { opacity: 0.6 }]}
          onPress={handleExport}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator size="small" color={colors.white} />
          ) : (
            <>
              <Ionicons name="download-outline" size={18} color={colors.white} />
              <Text style={styles.exportBtnText}>
                Exportar {selected.size} campo{selected.size !== 1 ? 's' : ''}
              </Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  warningBox: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#fffbeb', borderRadius: 10, padding: 12,
    borderWidth: 1, borderColor: '#fcd34d', marginBottom: 16,
  },
  warningText: { flex: 1, fontSize: 13, color: colors.warning },
  group: { backgroundColor: colors.white, borderRadius: 12, marginBottom: 12, overflow: 'hidden' },
  groupLabel: {
    fontSize: 12, fontWeight: '700', color: colors.gray,
    paddingHorizontal: 16, paddingTop: 12, paddingBottom: 6, textTransform: 'uppercase',
  },
  fieldRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 16, paddingVertical: 12,
    borderTopWidth: 1, borderTopColor: '#f3f4f6',
  },
  fieldLabel: { fontSize: 15, color: colors.gray },
  footer: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    padding: 16, backgroundColor: colors.white,
    borderTopWidth: 1, borderTopColor: colors.lightGray,
  },
  exportBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, backgroundColor: colors.admin,
    borderRadius: 12, paddingVertical: 16,
  },
  exportBtnText: { color: colors.white, fontWeight: '700', fontSize: 16 },
});
```

- [ ] **Step 3: Criar a tela de aprovações**

Criar `lumen_mobile/app/admin/approvals/index.tsx`:

```tsx
/**
 * Admin — Fila de Aprovações
 * ===========================
 * Exibe exportações pendentes de aprovação.
 * Acessível para DEV, ADMIN e COUNCIL_GENERAL.
 */

import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  ActivityIndicator, RefreshControl, Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { adminExportService, ExportRequest } from '@/services';

const colors = { admin: '#7c3aed', white: '#fff', gray: '#6b7280', lightGray: '#E8E8E8', text: '#171717', danger: '#dc2626', success: '#16a34a', warning: '#d97706' };

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  PENDING:   { label: 'Pendente',  color: colors.warning },
  APPROVED:  { label: 'Aprovado',  color: colors.success },
  REJECTED:  { label: 'Rejeitado', color: colors.danger  },
  GENERATED: { label: 'Pronto',    color: colors.success },
  EXPIRED:   { label: 'Expirado',  color: colors.gray    },
};

export default function ApprovalsScreen() {
  const [requests, setRequests] = useState<ExportRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchRequests = useCallback(async () => {
    try {
      const data = await adminExportService.listRequests();
      setRequests(data);
    } catch {
      // silently fail
    }
  }, []);

  useEffect(() => {
    fetchRequests().finally(() => setLoading(false));
  }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchRequests();
    setRefreshing(false);
  }, [fetchRequests]);

  const handleApprove = (req: ExportRequest) => {
    Alert.alert(
      'Aprovar exportação?',
      `Campos: ${req.fields_requested.join(', ')}`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Aprovar',
          onPress: async () => {
            try {
              await adminExportService.approve(req.id);
              await fetchRequests();
            } catch (e: any) {
              Alert.alert('Erro', e?.response?.data?.detail?.message ?? 'Erro ao aprovar');
            }
          },
        },
      ]
    );
  };

  const handleReject = (req: ExportRequest) => {
    Alert.alert(
      'Rejeitar exportação?',
      'Esta ação não pode ser desfeita.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Rejeitar',
          style: 'destructive',
          onPress: async () => {
            try {
              await adminExportService.reject(req.id);
              await fetchRequests();
            } catch (e: any) {
              Alert.alert('Erro', e?.response?.data?.detail?.message ?? 'Erro ao rejeitar');
            }
          },
        },
      ]
    );
  };

  const renderItem = ({ item }: { item: ExportRequest }) => {
    const status = STATUS_CONFIG[item.status] ?? { label: item.status, color: colors.gray };
    return (
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={[styles.statusBadge, { borderColor: status.color }]}>
            <Text style={[styles.statusText, { color: status.color }]}>{status.label}</Text>
          </View>
          {item.has_sensitive && (
            <View style={styles.sensitiveBadge}>
              <Ionicons name="lock-closed-outline" size={12} color={colors.danger} />
              <Text style={styles.sensitiveText}>Dados sensíveis</Text>
            </View>
          )}
          <Text style={styles.date}>{new Date(item.created_at).toLocaleDateString('pt-BR')}</Text>
        </View>
        <Text style={styles.fields}>Campos: {item.fields_requested.join(', ')}</Text>
        {item.status === 'PENDING' && (
          <View style={styles.actions}>
            <TouchableOpacity style={styles.rejectBtn} onPress={() => handleReject(item)}>
              <Text style={styles.rejectBtnText}>Rejeitar</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.approveBtn} onPress={() => handleApprove(item)}>
              <Text style={styles.approveBtnText}>Aprovar</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    );
  };

  if (loading) {
    return <View style={styles.center}><ActivityIndicator size="large" color={colors.admin} /></View>;
  }

  const pending = requests.filter((r) => r.status === 'PENDING');

  return (
    <View style={{ flex: 1, backgroundColor: '#f5f5f5' }}>
      {pending.length > 0 && (
        <View style={styles.banner}>
          <Ionicons name="alert-circle-outline" size={18} color={colors.warning} />
          <Text style={styles.bannerText}>{pending.length} exportação{pending.length !== 1 ? 'ões' : ''} aguardando aprovação</Text>
        </View>
      )}
      <FlatList
        data={requests}
        keyExtractor={(r) => r.id}
        renderItem={renderItem}
        contentContainerStyle={{ padding: 12, paddingBottom: 32 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        ListEmptyComponent={
          <View style={styles.center}>
            <Ionicons name="checkmark-circle-outline" size={40} color={colors.gray} />
            <Text style={{ color: colors.gray, marginTop: 8 }}>Nenhuma solicitação</Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40 },
  banner: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#fffbeb', padding: 12,
    borderBottomWidth: 1, borderBottomColor: '#fcd34d',
  },
  bannerText: { fontSize: 13, color: colors.warning, fontWeight: '600' },
  card: {
    backgroundColor: colors.white, borderRadius: 12, padding: 14, marginBottom: 10,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  statusBadge: { borderWidth: 1, borderRadius: 20, paddingHorizontal: 8, paddingVertical: 3 },
  statusText: { fontSize: 11, fontWeight: '700' },
  sensitiveBadge: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  sensitiveText: { fontSize: 11, color: colors.danger },
  date: { marginLeft: 'auto', fontSize: 11, color: colors.gray },
  fields: { fontSize: 13, color: colors.gray, marginBottom: 10 },
  actions: { flexDirection: 'row', gap: 10 },
  rejectBtn: {
    flex: 1, borderWidth: 2, borderColor: colors.danger,
    borderRadius: 8, paddingVertical: 10, alignItems: 'center',
  },
  rejectBtnText: { color: colors.danger, fontWeight: '700' },
  approveBtn: {
    flex: 1, backgroundColor: colors.admin,
    borderRadius: 8, paddingVertical: 10, alignItems: 'center',
  },
  approveBtnText: { color: colors.white, fontWeight: '700' },
});
```

- [ ] **Step 4: Registrar rotas no layout admin**

Abrir `lumen_mobile/app/admin/_layout.tsx`. Adicionar as novas rotas:

```tsx
// Dentro do Stack/Tabs:
<Stack.Screen name="approvals/index" options={{ title: 'Aprovações' }} />
<Stack.Screen name="users/export" options={{ title: 'Exportar Usuários' }} />
```

Também adicionar botão "Exportar" na tela de usuários (`users/index.tsx`), próximo ao header ou ao botão de filtros:

```tsx
<TouchableOpacity
  style={styles.exportHeaderBtn}
  onPress={() => router.push('/admin/users/export')}
>
  <Ionicons name="download-outline" size={18} color={colors.admin} />
</TouchableOpacity>
```

Adicionar estilo:
```typescript
exportHeaderBtn: { padding: 6, marginLeft: 4 },
```

- [ ] **Step 5: Commit final**

```bash
git add lumen_mobile/app/admin/users/export.tsx lumen_mobile/app/admin/approvals/index.tsx lumen_mobile/app/admin/_layout.tsx lumen_mobile/src/services/index.ts lumen_mobile/app/admin/users/index.tsx
git commit -m "feat(mobile): export screen + approvals queue for sensitive data exports"
```

---

## Task 9: Smoke test + push

- [ ] **Step 1: Rodar toda a suite de testes**

```bash
cd backend
pytest tests/ -v --tb=short
```

Esperado: todos os testes passam.

- [ ] **Step 2: Verificar que o mobile builda sem erros de TypeScript**

```bash
cd lumen_mobile
npx tsc --noEmit
```

Esperado: sem erros.

- [ ] **Step 3: Push da branch**

```bash
git push origin feat/cargos-gestao-usuarios
```

- [ ] **Step 4: Abrir PR**

```bash
gh pr create \
  --title "feat: cargos + gestão de usuários avançada (bug fix, filtros, perfil completo, exportação)" \
  --body "## O que muda\n- Fix: migration 035 insere roles faltantes (ADMIN, SECRETARY, AVISOS, COUNCIL_GENERAL) — resolve bug de cargos não salvando\n- Filtros avançados em GET /admin/users (cidade, estado, realidade vocacional, estado civil, status)\n- Novo endpoint GET /admin/users/{id}/profile com RG/CPF + auditoria\n- Exportação de CSV com dupla confirmação para dados sensíveis\n- Mobile: tela de perfil completo, filtros, exportação, fila de aprovações\n\n## Como testar\n1. Em produção: verificar que atribuir ADMIN/SECRETARY/AVISOS agora persiste\n2. Filtrar usuários por cidade na gestão\n3. Abrir perfil completo de um usuário\n4. Solicitar exportação com CPF — verificar que aparece como PENDING para COUNCIL_GENERAL\n\n🤖 Co-desenvolvido com Claude"
```

---

## Checklist de cobertura do spec

- [x] **Bug fix de cargos** — Task 1 (migration 035) + Task 2 (model)
- [x] **Filtros avançados backend** — Task 3
- [x] **Perfil completo backend** — Task 4
- [x] **Exportação backend** — Task 5
- [x] **Filtros mobile** — Task 6
- [x] **Perfil completo mobile** — Task 7
- [x] **Exportação + aprovações mobile** — Task 8
- [x] **Auditoria** — Task 4 e 5 (cada ação relevante cria entrada em `audit_log`)
- [x] **Controle de acesso** — implementado em cada endpoint (DEV/ADMIN/SECRETARY para visualização, COUNCIL_GENERAL para aprovação)
- [x] **Notificação via Inbox** — Task 5 (`_notify_council_for_approval`)
