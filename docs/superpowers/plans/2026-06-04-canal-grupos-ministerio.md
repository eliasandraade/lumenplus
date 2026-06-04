# Canal de Grupos por Ministério — Implementation Plan (v2)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **Revisão arquitetural:** `docs/superpowers/plans/2026-06-04-revisao-arquitetural.md`

**Goal:** Canal de mensagens por OrgUnit — posts com threads de resposta, moderação completa, auditoria, edição, destaque institucional e consultas sem N+1.

**Architecture:** `ChannelPost` + `ChannelReply` com soft-delete, `edited_at`, `is_institutional_highlight` e `media_metadata` (expansão futura). `channel_post_mode` como Python enum no `OrgUnit`. Endpoints de list/get usam JOIN + subquery para eliminar N+1. Settings endpoint resolve `can_post`/`can_moderate` para o usuário atual. Todas as operações destrutivas registradas no `AuditLog` existente.

**Tech Stack:** FastAPI + SQLAlchemy 2.x + Alembic, Pydantic v2, React Native + Expo Router, fetch-based api client (`src/services/api.ts`).

> **Nota:** Os tipos `CHANNEL_NEW_POST`, `CHANNEL_NEW_REPLY` e `CHANNEL_MENTION` já estão declarados em `NotificationType` no `notification_service.py` (plano de notificações). O disparo desses eventos **não é implementado neste plano** — apenas a infraestrutura de canal. Quando implementados, chamarão `notify_new_inbox` com o `notification_type` correspondente e o `deep_link` apontando para `/channel/{unitId}`.

---

## File Map

### Backend — novos
| Arquivo | Responsabilidade |
|---|---|
| `backend/app/api/channel_routes.py` | Endpoints do canal |
| `backend/app/schemas/channel.py` | Pydantic schemas |
| `backend/alembic/versions/036_channel_posts.py` | Migration: tabelas + campo em org_units |

### Backend — modificados
| Arquivo | O que muda |
|---|---|
| `backend/app/db/models.py` | `ChannelPostMode` enum, `ChannelPost`, `ChannelReply`, `channel_post_mode` em `OrgUnit` |
| `backend/app/main.py` | `include_router(channel_router)` |
| `backend/app/api/routes/admin.py` | `channel_post_mode` no update de OrgUnit |
| `backend/app/schemas/organization.py` | `channel_post_mode` nos schemas de OrgUnit |

### Frontend — novos
| Arquivo | Responsabilidade |
|---|---|
| `lumen_mobile/src/services/channel.ts` | API client |
| `lumen_mobile/app/channel/_layout.tsx` | Stack layout |
| `lumen_mobile/app/channel/[unitId].tsx` | Tela principal do canal |

### Frontend — modificados
| Arquivo | O que muda |
|---|---|
| `lumen_mobile/app/_layout.tsx` | `Stack.Screen name="channel"` |
| `lumen_mobile/app/members.tsx` | Botão "Canal" |
| `lumen_mobile/app/admin/entities/index.tsx` | Seletor `channel_post_mode` |

---

## Task 1: Migration 036 — Canal Completo

**Files:**
- Create: `backend/alembic/versions/036_channel_posts.py`

- [ ] **Step 1: Verificar o head atual da chain de migrations**

```bash
cd backend && python -c "
from alembic.config import Config
from alembic.script import ScriptDirectory
cfg = Config('alembic.ini')
s = ScriptDirectory.from_config(cfg)
print('Current head:', s.get_current_head())
"
```

Expected: imprime o ID da última migration (ex: `035`). Usar esse valor como `down_revision` no próximo passo.

- [ ] **Step 2: Criar o arquivo de migration**

```python
# backend/alembic/versions/036_channel_posts.py
"""add channel posts, replies and org_unit channel_post_mode

Revision ID: 036
Revises: 035
Create Date: 2026-06-04
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

revision = "036"
down_revision = "035"  # ajustar se necessário após step 1
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ── campo em org_units ────────────────────────────────────────────────────
    op.add_column(
        "org_units",
        sa.Column(
            "channel_post_mode",
            sa.Text(),
            nullable=False,
            server_default="COORDINATOR_ONLY",
        ),
    )

    # ── channel_posts ─────────────────────────────────────────────────────────
    op.create_table(
        "channel_posts",
        sa.Column("id", UUID(as_uuid=True), primary_key=True,
                  server_default=sa.text("gen_random_uuid()")),
        sa.Column("org_unit_id", UUID(as_uuid=True),
                  sa.ForeignKey("org_units.id", ondelete="CASCADE"), nullable=False),
        sa.Column("author_user_id", UUID(as_uuid=True),
                  sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("title", sa.Text(), nullable=False),
        sa.Column("body", sa.Text(), nullable=False),
        sa.Column("is_pinned", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("is_institutional_highlight", sa.Boolean(), nullable=False,
                  server_default="false"),
        # JSON nullable — reserved para futura expansão com anexos/imagens/PDFs
        sa.Column("media_metadata", sa.JSON(), nullable=True),
        # Soft delete — padrão do projeto (ver InboxMessage)
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("deleted_by_user_id", UUID(as_uuid=True),
                  sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("delete_reason", sa.Text(), nullable=True),
        # Edição
        sa.Column("edited_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True),
                  server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True),
                  server_default=sa.text("now()")),
    )
    op.create_index("idx_channel_posts_org_unit_id", "channel_posts", ["org_unit_id"])
    op.create_index("idx_channel_posts_created_at", "channel_posts", ["created_at"])
    # Para ordenação: highlights no topo, depois pins, depois cronológico
    op.create_index("idx_channel_posts_ordering", "channel_posts",
                    ["org_unit_id", "is_institutional_highlight", "is_pinned", "created_at"])

    # ── channel_replies ───────────────────────────────────────────────────────
    op.create_table(
        "channel_replies",
        sa.Column("id", UUID(as_uuid=True), primary_key=True,
                  server_default=sa.text("gen_random_uuid()")),
        sa.Column("post_id", UUID(as_uuid=True),
                  sa.ForeignKey("channel_posts.id", ondelete="CASCADE"), nullable=False),
        sa.Column("author_user_id", UUID(as_uuid=True),
                  sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("body", sa.Text(), nullable=False),
        # Soft delete
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("deleted_by_user_id", UUID(as_uuid=True),
                  sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("delete_reason", sa.Text(), nullable=True),
        # Edição
        sa.Column("edited_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True),
                  server_default=sa.text("now()")),
    )
    op.create_index("idx_channel_replies_post_id", "channel_replies", ["post_id"])


def downgrade() -> None:
    op.drop_table("channel_replies")
    op.drop_table("channel_posts")
    op.drop_column("org_units", "channel_post_mode")
```

- [ ] **Step 3: Rodar a migration**

```bash
cd backend && alembic upgrade head
```

Expected: `Running upgrade 035 -> 036, add channel posts, replies and org_unit channel_post_mode`

- [ ] **Step 4: Commit**

```bash
git add backend/alembic/versions/036_channel_posts.py
git commit -m "feat(canal): migration 036 — channel_posts, channel_replies + channel_post_mode em org_units"
```

---

## Task 2: Modelos SQLAlchemy e Enum

**Files:**
- Modify: `backend/app/db/models.py`

- [ ] **Step 1: Adicionar o enum `ChannelPostMode`**

Localizar o bloco de enums no início do arquivo (linha ~39, após `OrgUnitType`) e adicionar:

```python
class ChannelPostMode(enum.Enum):
    COORDINATOR_ONLY = "COORDINATOR_ONLY"
    ALL_MEMBERS = "ALL_MEMBERS"
```

- [ ] **Step 2: Adicionar modelos `ChannelPost` e `ChannelReply`**

Adicionar após a classe `OrgUnit` (após o bloco de relationships dela, antes de `OrgMembership`):

```python
class ChannelPost(Base):
    __tablename__ = "channel_posts"
    __table_args__ = (
        Index("idx_channel_posts_org_unit_id", "org_unit_id"),
        Index("idx_channel_posts_created_at", "created_at"),
        Index("idx_channel_posts_ordering",
              "org_unit_id", "is_institutional_highlight", "is_pinned", "created_at"),
    )

    id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True), primary_key=True,
        default=_uuid_mod.uuid4, server_default=func.gen_random_uuid()
    )
    org_unit_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("org_units.id", ondelete="CASCADE"), nullable=False
    )
    author_user_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    title: Mapped[str] = mapped_column(Text, nullable=False)
    body: Mapped[str] = mapped_column(Text, nullable=False)
    is_pinned: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default="false")
    is_institutional_highlight: Mapped[bool] = mapped_column(
        Boolean, nullable=False, server_default="false"
    )
    media_metadata: Mapped[dict[str, Any] | None] = mapped_column(JSON, nullable=True)
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    deleted_by_user_id: Mapped[UUID | None] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    delete_reason: Mapped[str | None] = mapped_column(Text, nullable=True)
    edited_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    replies: Mapped[list["ChannelReply"]] = relationship(
        "ChannelReply", back_populates="post", cascade="all, delete-orphan"
    )


class ChannelReply(Base):
    __tablename__ = "channel_replies"
    __table_args__ = (Index("idx_channel_replies_post_id", "post_id"),)

    id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True), primary_key=True,
        default=_uuid_mod.uuid4, server_default=func.gen_random_uuid()
    )
    post_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("channel_posts.id", ondelete="CASCADE"), nullable=False
    )
    author_user_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    body: Mapped[str] = mapped_column(Text, nullable=False)
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    deleted_by_user_id: Mapped[UUID | None] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    delete_reason: Mapped[str | None] = mapped_column(Text, nullable=True)
    edited_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    post: Mapped["ChannelPost"] = relationship("ChannelPost", back_populates="replies")
```

- [ ] **Step 3: Adicionar `channel_post_mode` em `OrgUnit`**

Localizar a classe `OrgUnit` (linha ~416) e adicionar após `retreat_scope`:

```python
    channel_post_mode: Mapped[ChannelPostMode] = mapped_column(
        Enum(ChannelPostMode, name="channel_post_mode_enum", create_constraint=False),
        nullable=False,
        default=ChannelPostMode.COORDINATOR_ONLY,
        server_default="COORDINATOR_ONLY",
    )
```

Adicionar relationship no bloco de relationships de `OrgUnit` (após `invites`):

```python
    channel_posts: Mapped[list["ChannelPost"]] = relationship(
        "ChannelPost",
        cascade="all, delete-orphan",
        foreign_keys="ChannelPost.org_unit_id",
        primaryjoin="OrgUnit.id == ChannelPost.org_unit_id",
    )
```

- [ ] **Step 4: Verificar que Python não tem erros de importação**

```bash
cd backend && python -c "from app.db.models import ChannelPost, ChannelReply, ChannelPostMode; print('OK')"
```

Expected: `OK`

- [ ] **Step 5: Commit**

```bash
git add backend/app/db/models.py
git commit -m "feat(canal): modelos ChannelPost, ChannelReply, enum ChannelPostMode"
```

---

## Task 3: Schemas Pydantic

**Files:**
- Create: `backend/app/schemas/channel.py`

- [ ] **Step 1: Criar o arquivo de schemas**

```python
# backend/app/schemas/channel.py
from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field


class ChannelReplyResponse(BaseModel):
    id: UUID
    post_id: UUID
    author_user_id: UUID
    author_name: str
    body: str
    edited_at: datetime | None
    created_at: datetime
    is_deleted: bool  # True se deleted_at não é None — frontend exibe "mensagem removida"

    model_config = {"from_attributes": True}


class ChannelPostResponse(BaseModel):
    id: UUID
    org_unit_id: UUID
    author_user_id: UUID
    author_name: str
    title: str
    body: str
    is_pinned: bool
    is_institutional_highlight: bool
    reply_count: int
    edited_at: datetime | None
    created_at: datetime
    updated_at: datetime
    is_deleted: bool

    model_config = {"from_attributes": True}


class ChannelPostDetailResponse(ChannelPostResponse):
    replies: list[ChannelReplyResponse]


class ChannelPostListResponse(BaseModel):
    posts: list[ChannelPostResponse]
    total: int


class ChannelSettingsResponse(BaseModel):
    org_unit_id: UUID
    channel_post_mode: str  # ChannelPostMode.value
    can_post: bool          # resolvido para o current_user
    can_moderate: bool      # coordinator ou admin global


class CreatePostRequest(BaseModel):
    title: str = Field(..., min_length=3, max_length=200)
    body: str = Field(..., min_length=1, max_length=5000)


class EditPostRequest(BaseModel):
    title: str | None = Field(None, min_length=3, max_length=200)
    body: str | None = Field(None, min_length=1, max_length=5000)


class CreateReplyRequest(BaseModel):
    body: str = Field(..., min_length=1, max_length=2000)


class EditReplyRequest(BaseModel):
    body: str = Field(..., min_length=1, max_length=2000)


class DeleteContentRequest(BaseModel):
    reason: str = Field(..., min_length=3, max_length=500)
```

- [ ] **Step 2: Commit**

```bash
git add backend/app/schemas/channel.py
git commit -m "feat(canal): schemas Pydantic — posts, replies, settings, edit, delete"
```

---

## Task 4: Endpoints FastAPI

**Files:**
- Create: `backend/app/api/channel_routes.py`
- Modify: `backend/app/main.py`

- [ ] **Step 1: Criar `channel_routes.py`**

```python
# backend/app/api/channel_routes.py
"""
Canal de Grupos por Ministério
==============================
Endpoints:
  GET    /{org_unit_id}/settings         → configurações + can_post + can_moderate
  GET    /{org_unit_id}/posts            → lista paginada (sem N+1)
  GET    /{org_unit_id}/posts/{post_id}  → detalhe com replies (sem N+1)
  POST   /{org_unit_id}/posts            → criar post
  PATCH  /{org_unit_id}/posts/{post_id}  → editar (autor ou coordenador)
  DELETE /{org_unit_id}/posts/{post_id}  → soft delete (coordenador ou admin)
  PATCH  /{org_unit_id}/posts/{post_id}/pin        → toggle pin (coordenador)
  PATCH  /{org_unit_id}/posts/{post_id}/highlight  → toggle highlight (admin)
  POST   /{org_unit_id}/posts/{post_id}/replies    → criar reply
  PATCH  /{org_unit_id}/posts/{post_id}/replies/{reply_id}  → editar reply
  DELETE /{org_unit_id}/posts/{post_id}/replies/{reply_id}  → soft delete reply
"""

from datetime import datetime, timezone
from uuid import UUID

from fastapi import HTTPException
from fastapi.routing import APIRouter
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.api.deps import CurrentUser, DBSession
from app.audit.service import create_audit_log
from app.db.models import (
    AuditLog,
    ChannelPost,
    ChannelPostMode,
    ChannelReply,
    MembershipStatus,
    OrgMembership,
    OrgRoleCode,
    OrgUnit,
    UserProfile,
)
from app.schemas.channel import (
    ChannelPostDetailResponse,
    ChannelPostListResponse,
    ChannelPostResponse,
    ChannelReplyResponse,
    ChannelSettingsResponse,
    CreatePostRequest,
    CreateReplyRequest,
    DeleteContentRequest,
    EditPostRequest,
    EditReplyRequest,
)
from app.services.organization import get_user_global_roles

router = APIRouter(prefix="/channel", tags=["channel"])

# ── helpers de permissão ──────────────────────────────────────────────────────


def _get_membership(db: Session, user_id: UUID, org_unit_id: UUID) -> OrgMembership | None:
    return db.scalars(
        select(OrgMembership).where(
            OrgMembership.user_id == user_id,
            OrgMembership.org_unit_id == org_unit_id,
            OrgMembership.status == MembershipStatus.ACTIVE,
        )
    ).first()


def _require_active_member(db: Session, user_id: UUID, org_unit_id: UUID) -> OrgMembership:
    membership = _get_membership(db, user_id, org_unit_id)
    if not membership:
        raise HTTPException(
            status_code=403,
            detail={"error": "forbidden", "message": "Você não é membro desta unidade"},
        )
    return membership


def _is_global_admin(db: Session, user_id: UUID) -> bool:
    roles = get_user_global_roles(db, user_id)
    return any(r in roles for r in ["DEV", "ADMIN"])


def _resolve_can_post(membership: OrgMembership, org_unit: OrgUnit) -> bool:
    if org_unit.channel_post_mode == ChannelPostMode.ALL_MEMBERS:
        return True
    return membership.role == OrgRoleCode.COORDINATOR


def _resolve_can_moderate(membership: OrgMembership, is_admin: bool) -> bool:
    return is_admin or membership.role == OrgRoleCode.COORDINATOR


def _require_org_unit(db: Session, org_unit_id: UUID) -> OrgUnit:
    unit = db.scalars(select(OrgUnit).where(OrgUnit.id == org_unit_id)).first()
    if not unit:
        raise HTTPException(
            status_code=404, detail={"error": "not_found", "message": "Unidade não encontrada"}
        )
    return unit


# ── queries otimizadas (sem N+1) ──────────────────────────────────────────────


def _build_post_list(db: Session, org_unit_id: UUID, offset: int, limit: int):
    """
    Uma query para posts + nomes dos autores.
    Uma subquery para reply_count.
    Total: 2 queries independente do volume.
    """
    # Subquery: contagem de replies não deletadas por post
    reply_count_sq = (
        select(
            ChannelReply.post_id,
            func.count(ChannelReply.id).label("reply_count"),
        )
        .where(ChannelReply.deleted_at.is_(None))
        .group_by(ChannelReply.post_id)
        .subquery()
    )

    rows = db.execute(
        select(
            ChannelPost,
            UserProfile.full_name.label("author_name"),
            func.coalesce(reply_count_sq.c.reply_count, 0).label("reply_count"),
        )
        .outerjoin(UserProfile, UserProfile.user_id == ChannelPost.author_user_id)
        .outerjoin(reply_count_sq, reply_count_sq.c.post_id == ChannelPost.id)
        .where(
            ChannelPost.org_unit_id == org_unit_id,
            ChannelPost.deleted_at.is_(None),
        )
        .order_by(
            ChannelPost.is_institutional_highlight.desc(),
            ChannelPost.is_pinned.desc(),
            ChannelPost.created_at.desc(),
        )
        .offset(offset)
        .limit(limit)
    ).all()

    return rows


def _row_to_post_response(row) -> ChannelPostResponse:
    post: ChannelPost = row[0]
    author_name: str = row[1] or "Membro"
    reply_count: int = row[2]
    return ChannelPostResponse(
        id=post.id,
        org_unit_id=post.org_unit_id,
        author_user_id=post.author_user_id,
        author_name=author_name,
        title=post.title,
        body=post.body,
        is_pinned=post.is_pinned,
        is_institutional_highlight=post.is_institutional_highlight,
        reply_count=reply_count,
        edited_at=post.edited_at,
        created_at=post.created_at,
        updated_at=post.updated_at,
        is_deleted=post.deleted_at is not None,
    )


def _build_reply_list(db: Session, post_id: UUID) -> list[ChannelReplyResponse]:
    """Replies + nomes dos autores em uma única query."""
    rows = db.execute(
        select(
            ChannelReply,
            UserProfile.full_name.label("author_name"),
        )
        .outerjoin(UserProfile, UserProfile.user_id == ChannelReply.author_user_id)
        .where(
            ChannelReply.post_id == post_id,
            ChannelReply.deleted_at.is_(None),
        )
        .order_by(ChannelReply.created_at.asc())
    ).all()

    return [
        ChannelReplyResponse(
            id=r[0].id,
            post_id=r[0].post_id,
            author_user_id=r[0].author_user_id,
            author_name=r[1] or "Membro",
            body=r[0].body,
            edited_at=r[0].edited_at,
            created_at=r[0].created_at,
            is_deleted=r[0].deleted_at is not None,
        )
        for r in rows
    ]


# ── endpoints ─────────────────────────────────────────────────────────────────


@router.get("/{org_unit_id}/settings", response_model=ChannelSettingsResponse)
def get_channel_settings(
    org_unit_id: UUID, db: DBSession, current_user: CurrentUser
) -> ChannelSettingsResponse:
    membership = _require_active_member(db, current_user.id, org_unit_id)
    unit = _require_org_unit(db, org_unit_id)
    is_admin = _is_global_admin(db, current_user.id)
    return ChannelSettingsResponse(
        org_unit_id=org_unit_id,
        channel_post_mode=unit.channel_post_mode.value,
        can_post=_resolve_can_post(membership, unit),
        can_moderate=_resolve_can_moderate(membership, is_admin),
    )


@router.get("/{org_unit_id}/posts", response_model=ChannelPostListResponse)
def list_posts(
    org_unit_id: UUID,
    db: DBSession,
    current_user: CurrentUser,
    offset: int = 0,
    limit: int = 30,
) -> ChannelPostListResponse:
    _require_active_member(db, current_user.id, org_unit_id)

    total = db.scalar(
        select(func.count()).where(
            ChannelPost.org_unit_id == org_unit_id,
            ChannelPost.deleted_at.is_(None),
        )
    ) or 0

    rows = _build_post_list(db, org_unit_id, offset, limit)
    return ChannelPostListResponse(
        posts=[_row_to_post_response(r) for r in rows],
        total=total,
    )


@router.get("/{org_unit_id}/posts/{post_id}", response_model=ChannelPostDetailResponse)
def get_post(
    org_unit_id: UUID, post_id: UUID, db: DBSession, current_user: CurrentUser
) -> ChannelPostDetailResponse:
    _require_active_member(db, current_user.id, org_unit_id)

    row = db.execute(
        select(
            ChannelPost,
            UserProfile.full_name.label("author_name"),
        )
        .outerjoin(UserProfile, UserProfile.user_id == ChannelPost.author_user_id)
        .where(
            ChannelPost.id == post_id,
            ChannelPost.org_unit_id == org_unit_id,
            ChannelPost.deleted_at.is_(None),
        )
    ).first()

    if not row:
        raise HTTPException(
            status_code=404, detail={"error": "not_found", "message": "Post não encontrado"}
        )

    post: ChannelPost = row[0]
    author_name: str = row[1] or "Membro"

    # Subquery separada para reply_count deste post
    reply_count = db.scalar(
        select(func.count()).where(
            ChannelReply.post_id == post_id,
            ChannelReply.deleted_at.is_(None),
        )
    ) or 0

    replies = _build_reply_list(db, post_id)

    base = ChannelPostResponse(
        id=post.id,
        org_unit_id=post.org_unit_id,
        author_user_id=post.author_user_id,
        author_name=author_name,
        title=post.title,
        body=post.body,
        is_pinned=post.is_pinned,
        is_institutional_highlight=post.is_institutional_highlight,
        reply_count=reply_count,
        edited_at=post.edited_at,
        created_at=post.created_at,
        updated_at=post.updated_at,
        is_deleted=False,
    )
    return ChannelPostDetailResponse(**base.model_dump(), replies=replies)


@router.post("/{org_unit_id}/posts", response_model=ChannelPostResponse, status_code=201)
def create_post(
    org_unit_id: UUID, body: CreatePostRequest, db: DBSession, current_user: CurrentUser
) -> ChannelPostResponse:
    membership = _require_active_member(db, current_user.id, org_unit_id)
    unit = _require_org_unit(db, org_unit_id)

    if not _resolve_can_post(membership, unit):
        raise HTTPException(
            status_code=403,
            detail={
                "error": "forbidden",
                "message": "Apenas coordenadores podem criar posts neste canal",
            },
        )

    post = ChannelPost(
        org_unit_id=org_unit_id,
        author_user_id=current_user.id,
        title=body.title,
        body=body.body,
    )
    db.add(post)
    db.flush()  # gera o ID antes do commit

    create_audit_log(
        db,
        actor_user_id=current_user.id,
        action="channel_post_created",
        entity_type="channel_post",
        entity_id=str(post.id),
        extra_data={"org_unit_id": str(org_unit_id), "title": body.title},
    )

    db.commit()
    db.refresh(post)

    return ChannelPostResponse(
        id=post.id,
        org_unit_id=post.org_unit_id,
        author_user_id=post.author_user_id,
        author_name=db.scalars(
            select(UserProfile.full_name).where(UserProfile.user_id == current_user.id)
        ).first() or "Membro",
        title=post.title,
        body=post.body,
        is_pinned=post.is_pinned,
        is_institutional_highlight=post.is_institutional_highlight,
        reply_count=0,
        edited_at=None,
        created_at=post.created_at,
        updated_at=post.updated_at,
        is_deleted=False,
    )


@router.patch("/{org_unit_id}/posts/{post_id}", response_model=ChannelPostResponse)
def edit_post(
    org_unit_id: UUID,
    post_id: UUID,
    body: EditPostRequest,
    db: DBSession,
    current_user: CurrentUser,
) -> ChannelPostResponse:
    membership = _require_active_member(db, current_user.id, org_unit_id)
    is_admin = _is_global_admin(db, current_user.id)

    post = db.scalars(
        select(ChannelPost).where(
            ChannelPost.id == post_id,
            ChannelPost.org_unit_id == org_unit_id,
            ChannelPost.deleted_at.is_(None),
        )
    ).first()
    if not post:
        raise HTTPException(
            status_code=404, detail={"error": "not_found", "message": "Post não encontrado"}
        )

    # Pode editar: próprio autor, coordenador da unidade, ou admin global
    can_edit = (
        post.author_user_id == current_user.id
        or membership.role == OrgRoleCode.COORDINATOR
        or is_admin
    )
    if not can_edit:
        raise HTTPException(
            status_code=403,
            detail={"error": "forbidden", "message": "Sem permissão para editar este post"},
        )

    if body.title is not None:
        post.title = body.title
    if body.body is not None:
        post.body = body.body
    post.edited_at = datetime.now(timezone.utc)

    create_audit_log(
        db,
        actor_user_id=current_user.id,
        action="channel_post_edited",
        entity_type="channel_post",
        entity_id=str(post.id),
        extra_data={"fields_changed": [k for k, v in body.model_dump().items() if v is not None]},
    )

    db.commit()

    # Reutiliza _build_post_list para retornar o response com reply_count e author_name
    rows = db.execute(
        select(
            ChannelPost,
            UserProfile.full_name.label("author_name"),
            func.coalesce(
                select(func.count(ChannelReply.id))
                .where(ChannelReply.post_id == post.id, ChannelReply.deleted_at.is_(None))
                .scalar_subquery(),
                0,
            ).label("reply_count"),
        )
        .outerjoin(UserProfile, UserProfile.user_id == ChannelPost.author_user_id)
        .where(ChannelPost.id == post_id)
    ).first()

    return _row_to_post_response(rows)


@router.delete("/{org_unit_id}/posts/{post_id}", status_code=200)
def delete_post(
    org_unit_id: UUID,
    post_id: UUID,
    body: DeleteContentRequest,
    db: DBSession,
    current_user: CurrentUser,
) -> dict:
    membership = _require_active_member(db, current_user.id, org_unit_id)
    is_admin = _is_global_admin(db, current_user.id)

    post = db.scalars(
        select(ChannelPost).where(
            ChannelPost.id == post_id,
            ChannelPost.org_unit_id == org_unit_id,
            ChannelPost.deleted_at.is_(None),
        )
    ).first()
    if not post:
        raise HTTPException(
            status_code=404, detail={"error": "not_found", "message": "Post não encontrado"}
        )

    can_delete = (
        membership.role == OrgRoleCode.COORDINATOR or is_admin
    )
    if not can_delete:
        raise HTTPException(
            status_code=403,
            detail={"error": "forbidden", "message": "Apenas coordenadores podem remover posts"},
        )

    now = datetime.now(timezone.utc)
    post.deleted_at = now
    post.deleted_by_user_id = current_user.id
    post.delete_reason = body.reason

    create_audit_log(
        db,
        actor_user_id=current_user.id,
        action="channel_post_deleted",
        entity_type="channel_post",
        entity_id=str(post.id),
        extra_data={"reason": body.reason, "org_unit_id": str(org_unit_id)},
    )

    db.commit()
    return {"status": "deleted"}


@router.patch("/{org_unit_id}/posts/{post_id}/pin", response_model=ChannelPostResponse)
def toggle_pin(
    org_unit_id: UUID, post_id: UUID, db: DBSession, current_user: CurrentUser
) -> ChannelPostResponse:
    membership = _require_active_member(db, current_user.id, org_unit_id)
    is_admin = _is_global_admin(db, current_user.id)

    if membership.role != OrgRoleCode.COORDINATOR and not is_admin:
        raise HTTPException(
            status_code=403,
            detail={"error": "forbidden", "message": "Apenas coordenadores podem fixar posts"},
        )

    post = db.scalars(
        select(ChannelPost).where(
            ChannelPost.id == post_id,
            ChannelPost.org_unit_id == org_unit_id,
            ChannelPost.deleted_at.is_(None),
        )
    ).first()
    if not post:
        raise HTTPException(
            status_code=404, detail={"error": "not_found", "message": "Post não encontrado"}
        )

    post.is_pinned = not post.is_pinned
    db.commit()

    rows = db.execute(
        select(
            ChannelPost,
            UserProfile.full_name.label("author_name"),
            func.coalesce(
                select(func.count(ChannelReply.id))
                .where(ChannelReply.post_id == post.id, ChannelReply.deleted_at.is_(None))
                .scalar_subquery(),
                0,
            ).label("reply_count"),
        )
        .outerjoin(UserProfile, UserProfile.user_id == ChannelPost.author_user_id)
        .where(ChannelPost.id == post_id)
    ).first()
    return _row_to_post_response(rows)


@router.patch("/{org_unit_id}/posts/{post_id}/highlight", response_model=ChannelPostResponse)
def toggle_institutional_highlight(
    org_unit_id: UUID, post_id: UUID, db: DBSession, current_user: CurrentUser
) -> ChannelPostResponse:
    """Apenas admins globais (DEV, ADMIN) podem definir destaque institucional."""
    if not _is_global_admin(db, current_user.id):
        raise HTTPException(
            status_code=403,
            detail={
                "error": "forbidden",
                "message": "Apenas administradores podem definir destaque institucional",
            },
        )
    _require_active_member(db, current_user.id, org_unit_id)

    post = db.scalars(
        select(ChannelPost).where(
            ChannelPost.id == post_id,
            ChannelPost.org_unit_id == org_unit_id,
            ChannelPost.deleted_at.is_(None),
        )
    ).first()
    if not post:
        raise HTTPException(
            status_code=404, detail={"error": "not_found", "message": "Post não encontrado"}
        )

    post.is_institutional_highlight = not post.is_institutional_highlight

    create_audit_log(
        db,
        actor_user_id=current_user.id,
        action="channel_post_highlight_toggled",
        entity_type="channel_post",
        entity_id=str(post.id),
        extra_data={"is_institutional_highlight": post.is_institutional_highlight},
    )

    db.commit()

    rows = db.execute(
        select(
            ChannelPost,
            UserProfile.full_name.label("author_name"),
            func.coalesce(
                select(func.count(ChannelReply.id))
                .where(ChannelReply.post_id == post.id, ChannelReply.deleted_at.is_(None))
                .scalar_subquery(),
                0,
            ).label("reply_count"),
        )
        .outerjoin(UserProfile, UserProfile.user_id == ChannelPost.author_user_id)
        .where(ChannelPost.id == post_id)
    ).first()
    return _row_to_post_response(rows)


@router.post(
    "/{org_unit_id}/posts/{post_id}/replies",
    response_model=ChannelReplyResponse,
    status_code=201,
)
def create_reply(
    org_unit_id: UUID,
    post_id: UUID,
    body: CreateReplyRequest,
    db: DBSession,
    current_user: CurrentUser,
) -> ChannelReplyResponse:
    _require_active_member(db, current_user.id, org_unit_id)

    post = db.scalars(
        select(ChannelPost).where(
            ChannelPost.id == post_id,
            ChannelPost.org_unit_id == org_unit_id,
            ChannelPost.deleted_at.is_(None),
        )
    ).first()
    if not post:
        raise HTTPException(
            status_code=404, detail={"error": "not_found", "message": "Post não encontrado"}
        )

    reply = ChannelReply(
        post_id=post_id,
        author_user_id=current_user.id,
        body=body.body,
    )
    db.add(reply)
    db.flush()

    create_audit_log(
        db,
        actor_user_id=current_user.id,
        action="channel_reply_created",
        entity_type="channel_reply",
        entity_id=str(reply.id),
        extra_data={"post_id": str(post_id)},
    )

    db.commit()

    author_name = db.scalars(
        select(UserProfile.full_name).where(UserProfile.user_id == current_user.id)
    ).first() or "Membro"

    return ChannelReplyResponse(
        id=reply.id,
        post_id=reply.post_id,
        author_user_id=reply.author_user_id,
        author_name=author_name,
        body=reply.body,
        edited_at=None,
        created_at=reply.created_at,
        is_deleted=False,
    )


@router.patch(
    "/{org_unit_id}/posts/{post_id}/replies/{reply_id}",
    response_model=ChannelReplyResponse,
)
def edit_reply(
    org_unit_id: UUID,
    post_id: UUID,
    reply_id: UUID,
    body: EditReplyRequest,
    db: DBSession,
    current_user: CurrentUser,
) -> ChannelReplyResponse:
    membership = _require_active_member(db, current_user.id, org_unit_id)
    is_admin = _is_global_admin(db, current_user.id)

    reply = db.scalars(
        select(ChannelReply).where(
            ChannelReply.id == reply_id,
            ChannelReply.post_id == post_id,
            ChannelReply.deleted_at.is_(None),
        )
    ).first()
    if not reply:
        raise HTTPException(
            status_code=404, detail={"error": "not_found", "message": "Resposta não encontrada"}
        )

    can_edit = (
        reply.author_user_id == current_user.id
        or membership.role == OrgRoleCode.COORDINATOR
        or is_admin
    )
    if not can_edit:
        raise HTTPException(
            status_code=403,
            detail={"error": "forbidden", "message": "Sem permissão para editar esta resposta"},
        )

    reply.body = body.body
    reply.edited_at = datetime.now(timezone.utc)

    create_audit_log(
        db,
        actor_user_id=current_user.id,
        action="channel_reply_edited",
        entity_type="channel_reply",
        entity_id=str(reply.id),
    )

    db.commit()

    author_name = db.scalars(
        select(UserProfile.full_name).where(UserProfile.user_id == reply.author_user_id)
    ).first() or "Membro"

    return ChannelReplyResponse(
        id=reply.id,
        post_id=reply.post_id,
        author_user_id=reply.author_user_id,
        author_name=author_name,
        body=reply.body,
        edited_at=reply.edited_at,
        created_at=reply.created_at,
        is_deleted=False,
    )


@router.delete(
    "/{org_unit_id}/posts/{post_id}/replies/{reply_id}",
    status_code=200,
)
def delete_reply(
    org_unit_id: UUID,
    post_id: UUID,
    reply_id: UUID,
    body: DeleteContentRequest,
    db: DBSession,
    current_user: CurrentUser,
) -> dict:
    membership = _require_active_member(db, current_user.id, org_unit_id)
    is_admin = _is_global_admin(db, current_user.id)

    reply = db.scalars(
        select(ChannelReply).where(
            ChannelReply.id == reply_id,
            ChannelReply.post_id == post_id,
            ChannelReply.deleted_at.is_(None),
        )
    ).first()
    if not reply:
        raise HTTPException(
            status_code=404, detail={"error": "not_found", "message": "Resposta não encontrada"}
        )

    can_delete = (
        membership.role == OrgRoleCode.COORDINATOR or is_admin
    )
    if not can_delete:
        raise HTTPException(
            status_code=403,
            detail={"error": "forbidden", "message": "Apenas coordenadores podem remover respostas"},
        )

    now = datetime.now(timezone.utc)
    reply.deleted_at = now
    reply.deleted_by_user_id = current_user.id
    reply.delete_reason = body.reason

    create_audit_log(
        db,
        actor_user_id=current_user.id,
        action="channel_reply_deleted",
        entity_type="channel_reply",
        entity_id=str(reply.id),
        extra_data={"reason": body.reason},
    )

    db.commit()
    return {"status": "deleted"}
```

- [ ] **Step 2: Verificar assinatura de `create_audit_log`**

```bash
grep -n "def create_audit_log" backend/app/audit/service.py
```

Expected: `def create_audit_log(db, actor_user_id, action, entity_type, entity_id, extra_data=None)`.
Se a assinatura for diferente, ajustar as chamadas no arquivo criado.

- [ ] **Step 3: Registrar router em `backend/app/main.py`**

Após `from app.api.routes.export import router as export_router`:
```python
from app.api.channel_routes import router as channel_router  # noqa: E402
```

Após `app.include_router(export_router)`:
```python
app.include_router(channel_router)
```

- [ ] **Step 4: Testar os endpoints**

```bash
cd backend && uvicorn app.main:app --reload --port 8000
```

```
GET http://localhost:8000/channel/{org_unit_id}/settings
Authorization: Bearer dev:{user_id}:{email}
```

Expected: `200 {"org_unit_id": "...", "channel_post_mode": "COORDINATOR_ONLY", "can_post": true/false, "can_moderate": true/false}`

- [ ] **Step 5: Commit**

```bash
git add backend/app/api/channel_routes.py backend/app/main.py
git commit -m "feat(canal): endpoints completos — CRUD + edit + soft-delete + pin + highlight + audit"
```

---

## Task 5: Admin — channel_post_mode em OrgUnit

**Files:**
- Modify: `backend/app/schemas/organization.py`
- Modify: `backend/app/api/routes/admin.py`

- [ ] **Step 1: Encontrar os schemas de OrgUnit**

```bash
grep -n "class Org\|channel_post_mode" backend/app/schemas/organization.py | head -20
```

- [ ] **Step 2: Adicionar `channel_post_mode` no schema de update**

No schema de update de OrgUnit (tipicamente `OrgUnitUpdateRequest` ou similar), adicionar:

```python
channel_post_mode: str | None = None  # COORDINATOR_ONLY | ALL_MEMBERS
```

- [ ] **Step 3: Adicionar `channel_post_mode` no schema de response de OrgUnit**

No schema de response de OrgUnit, adicionar:

```python
channel_post_mode: str  # valor do enum ChannelPostMode
```

- [ ] **Step 4: Adicionar lógica de validação e update no endpoint**

No endpoint de edição de OrgUnit em `backend/app/api/routes/admin.py`, localizar onde os campos são atribuídos ao objeto `org_unit` e adicionar:

```python
from app.db.models import ChannelPostMode

if body.channel_post_mode is not None:
    try:
        mode = ChannelPostMode(body.channel_post_mode)
    except ValueError:
        raise HTTPException(
            status_code=422,
            detail={
                "error": "invalid_value",
                "message": "channel_post_mode deve ser COORDINATOR_ONLY ou ALL_MEMBERS",
            },
        )
    org_unit.channel_post_mode = mode
```

- [ ] **Step 5: Verificar que o response inclui `channel_post_mode`**

Onde a OrgUnit é serializada para response, verificar que `channel_post_mode` está mapeado como `.value` (string) ou que o schema Pydantic com `from_attributes=True` faz a conversão.

- [ ] **Step 6: Commit**

```bash
git add backend/app/schemas/organization.py backend/app/api/routes/admin.py
git commit -m "feat(canal): channel_post_mode no endpoint de edição de OrgUnit + validação de enum"
```

---

## Task 6: API Client Frontend

**Files:**
- Create: `lumen_mobile/src/services/channel.ts`

- [ ] **Step 1: Criar o serviço**

```typescript
// lumen_mobile/src/services/channel.ts
import api from './api';

export type ChannelPostMode = 'COORDINATOR_ONLY' | 'ALL_MEMBERS';

export interface ChannelReply {
  id: string;
  post_id: string;
  author_user_id: string;
  author_name: string;
  body: string;
  edited_at: string | null;
  created_at: string;
  is_deleted: boolean;
}

export interface ChannelPost {
  id: string;
  org_unit_id: string;
  author_user_id: string;
  author_name: string;
  title: string;
  body: string;
  is_pinned: boolean;
  is_institutional_highlight: boolean;
  reply_count: number;
  edited_at: string | null;
  created_at: string;
  updated_at: string;
  is_deleted: boolean;
}

export interface ChannelPostDetail extends ChannelPost {
  replies: ChannelReply[];
}

export interface ChannelPostList {
  posts: ChannelPost[];
  total: number;
}

export interface ChannelSettings {
  org_unit_id: string;
  channel_post_mode: ChannelPostMode;
  can_post: boolean;
  can_moderate: boolean;
}

export const channelService = {
  getSettings: (orgUnitId: string) =>
    api.get<ChannelSettings>(`/channel/${orgUnitId}/settings`),

  listPosts: (orgUnitId: string, offset = 0, limit = 30) =>
    api.get<ChannelPostList>(`/channel/${orgUnitId}/posts?offset=${offset}&limit=${limit}`),

  getPost: (orgUnitId: string, postId: string) =>
    api.get<ChannelPostDetail>(`/channel/${orgUnitId}/posts/${postId}`),

  createPost: (orgUnitId: string, title: string, body: string) =>
    api.post<ChannelPost>(`/channel/${orgUnitId}/posts`, { title, body }),

  editPost: (orgUnitId: string, postId: string, title?: string, body?: string) =>
    api.patch<ChannelPost>(`/channel/${orgUnitId}/posts/${postId}`, { title, body }),

  deletePost: (orgUnitId: string, postId: string, reason: string) =>
    api.delete<{ status: string }>(`/channel/${orgUnitId}/posts/${postId}`, { reason }),

  togglePin: (orgUnitId: string, postId: string) =>
    api.patch<ChannelPost>(`/channel/${orgUnitId}/posts/${postId}/pin`, {}),

  toggleHighlight: (orgUnitId: string, postId: string) =>
    api.patch<ChannelPost>(`/channel/${orgUnitId}/posts/${postId}/highlight`, {}),

  createReply: (orgUnitId: string, postId: string, body: string) =>
    api.post<ChannelReply>(`/channel/${orgUnitId}/posts/${postId}/replies`, { body }),

  editReply: (orgUnitId: string, postId: string, replyId: string, body: string) =>
    api.patch<ChannelReply>(`/channel/${orgUnitId}/posts/${postId}/replies/${replyId}`, { body }),

  deleteReply: (orgUnitId: string, postId: string, replyId: string, reason: string) =>
    api.delete<{ status: string }>(
      `/channel/${orgUnitId}/posts/${postId}/replies/${replyId}`,
      { reason },
    ),
};
```

- [ ] **Step 2: Verificar que `api.patch` e `api.delete` existem no cliente**

```bash
grep -n "patch\|delete\|async patch\|async delete" lumen_mobile/src/services/api.ts | head -15
```

Se `api.delete` aceitar um segundo argumento de body ou não, ajustar as chamadas. Se `delete` não suportar body, passar o `reason` como query param no endpoint DELETE ou mudar para `PATCH` com `{ deleted: true, reason }`. O endpoint backend aceita `DeleteContentRequest` no body — verificar se o cliente suporta body em DELETE antes de implementar.

- [ ] **Step 3: Commit**

```bash
git add lumen_mobile/src/services/channel.ts
git commit -m "feat(canal): API client frontend — CRUD + edit + delete + pin + highlight"
```

---

## Task 7: Tela do Canal (Frontend)

**Files:**
- Create: `lumen_mobile/app/channel/_layout.tsx`
- Create: `lumen_mobile/app/channel/[unitId].tsx`
- Modify: `lumen_mobile/app/_layout.tsx`

- [ ] **Step 1: Criar o layout**

```typescript
// lumen_mobile/app/channel/_layout.tsx
import { Stack } from 'expo-router';

export default function ChannelLayout() {
  return (
    <Stack screenOptions={{ headerShown: true }}>
      <Stack.Screen name="[unitId]" options={{ title: 'Canal' }} />
    </Stack>
  );
}
```

- [ ] **Step 2: Criar a tela principal**

```typescript
// lumen_mobile/app/channel/[unitId].tsx
import { useLocalSearchParams } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import {
  ChannelPost,
  ChannelPostDetail,
  ChannelReply,
  ChannelSettings,
  channelService,
} from '@/src/services/channel';
import { useAuthStore } from '@/stores/authStore';

type Screen = 'list' | 'post';

export default function ChannelScreen() {
  const { unitId } = useLocalSearchParams<{ unitId: string }>();
  const { user } = useAuthStore();
  const currentUserId = user?.uid ?? '';

  const [screen, setScreen] = useState<Screen>('list');
  const [posts, setPosts] = useState<ChannelPost[]>([]);
  const [totalPosts, setTotalPosts] = useState(0);
  const [selectedPost, setSelectedPost] = useState<ChannelPostDetail | null>(null);
  const [settings, setSettings] = useState<ChannelSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form novo post
  const [showNewPost, setShowNewPost] = useState(false);
  const [postTitle, setPostTitle] = useState('');
  const [postBody, setPostBody] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Form reply
  const [replyBody, setReplyBody] = useState('');
  const [replyError, setReplyError] = useState<string | null>(null);

  // Edit state
  const [editingPostId, setEditingPostId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editBody, setEditBody] = useState('');
  const [editingReplyId, setEditingReplyId] = useState<string | null>(null);
  const [editReplyBody, setEditReplyBody] = useState('');

  const loadList = useCallback(async () => {
    try {
      const [list, cfg] = await Promise.all([
        channelService.listPosts(unitId),
        channelService.getSettings(unitId),
      ]);
      setPosts(list.posts);
      setTotalPosts(list.total);
      setSettings(cfg);
      setError(null);
    } catch {
      setError('Não foi possível carregar o canal.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [unitId]);

  useEffect(() => { loadList(); }, [loadList]);

  const loadPost = async (postId: string) => {
    try {
      const detail = await channelService.getPost(unitId, postId);
      setSelectedPost(detail);
    } catch {
      setError('Não foi possível carregar o post.');
      setScreen('list');
    }
  };

  const openPost = (post: ChannelPost) => {
    setScreen('post');
    setSelectedPost(null);
    loadPost(post.id);
  };

  const handleCreatePost = async () => {
    setFormError(null);
    if (!postTitle.trim() || postTitle.trim().length < 3) {
      setFormError('Título deve ter pelo menos 3 caracteres.');
      return;
    }
    if (!postBody.trim()) {
      setFormError('O corpo do post não pode estar vazio.');
      return;
    }
    setSubmitting(true);
    try {
      await channelService.createPost(unitId, postTitle.trim(), postBody.trim());
      setPostTitle('');
      setPostBody('');
      setShowNewPost(false);
      await loadList();
    } catch (e: any) {
      setFormError(e?.detail?.message || 'Erro ao publicar post.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSaveEditPost = async () => {
    if (!editingPostId) return;
    setSubmitting(true);
    try {
      await channelService.editPost(unitId, editingPostId, editTitle || undefined, editBody || undefined);
      setEditingPostId(null);
      if (screen === 'list') await loadList();
      else if (selectedPost) await loadPost(selectedPost.id);
    } catch (e: any) {
      setFormError(e?.detail?.message || 'Erro ao editar post.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeletePost = (postId: string) => {
    if (Platform.OS === 'web') {
      const reason = window.prompt('Motivo da remoção (obrigatório):');
      if (!reason || reason.trim().length < 3) return;
      channelService.deletePost(unitId, postId, reason.trim())
        .then(() => { loadList(); if (screen === 'post') setScreen('list'); })
        .catch((e: any) => setError(e?.detail?.message || 'Erro ao remover post.'));
    }
    // Em nativo: Alert.alert com TextInput — simplificado para web-first
  };

  const handleCreateReply = async () => {
    if (!selectedPost) return;
    setReplyError(null);
    if (!replyBody.trim()) {
      setReplyError('A resposta não pode estar vazia.');
      return;
    }
    setSubmitting(true);
    try {
      await channelService.createReply(unitId, selectedPost.id, replyBody.trim());
      setReplyBody('');
      await loadPost(selectedPost.id);
    } catch (e: any) {
      setReplyError(e?.detail?.message || 'Erro ao enviar resposta.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSaveEditReply = async () => {
    if (!editingReplyId || !selectedPost) return;
    setSubmitting(true);
    try {
      await channelService.editReply(unitId, selectedPost.id, editingReplyId, editReplyBody.trim());
      setEditingReplyId(null);
      await loadPost(selectedPost.id);
    } catch (e: any) {
      setReplyError(e?.detail?.message || 'Erro ao editar resposta.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteReply = (replyId: string) => {
    if (!selectedPost) return;
    if (Platform.OS === 'web') {
      const reason = window.prompt('Motivo da remoção (obrigatório):');
      if (!reason || reason.trim().length < 3) return;
      channelService.deleteReply(unitId, selectedPost.id, replyId, reason.trim())
        .then(() => loadPost(selectedPost.id))
        .catch((e: any) => setReplyError(e?.detail?.message || 'Erro ao remover resposta.'));
    }
  };

  const handleTogglePin = async (postId: string) => {
    try {
      await channelService.togglePin(unitId, postId);
      await loadList();
    } catch (e: any) {
      setError(e?.detail?.message || 'Erro ao alterar pin.');
    }
  };

  const handleToggleHighlight = async (postId: string) => {
    try {
      await channelService.toggleHighlight(unitId, postId);
      await loadList();
    } catch (e: any) {
      setError(e?.detail?.message || 'Erro ao alterar destaque.');
    }
  };

  // ── Render helpers ──────────────────────────────────────────────────────────

  const renderPostActions = (post: ChannelPost) => {
    if (!settings) return null;
    const isAuthor = post.author_user_id === currentUserId;
    const canEdit = isAuthor || settings.can_moderate;
    const canDelete = settings.can_moderate;

    return (
      <View style={{ flexDirection: 'row', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
        {canEdit && (
          <Pressable
            onPress={() => { setEditingPostId(post.id); setEditTitle(post.title); setEditBody(post.body); }}
            style={{ paddingHorizontal: 10, paddingVertical: 4, backgroundColor: '#EDE9FE', borderRadius: 12 }}
          >
            <Text style={{ color: '#7C3AED', fontSize: 12 }}>Editar</Text>
          </Pressable>
        )}
        {settings.can_moderate && (
          <Pressable
            onPress={() => handleTogglePin(post.id)}
            style={{ paddingHorizontal: 10, paddingVertical: 4, backgroundColor: '#FEF9C3', borderRadius: 12 }}
          >
            <Text style={{ color: '#92400E', fontSize: 12 }}>{post.is_pinned ? 'Desafixar' : 'Fixar'}</Text>
          </Pressable>
        )}
        {/* Highlight — só exibido se admin: o backend rejeita para não-admins */}
        {settings.can_moderate && (
          <Pressable
            onPress={() => handleToggleHighlight(post.id)}
            style={{ paddingHorizontal: 10, paddingVertical: 4, backgroundColor: '#DBEAFE', borderRadius: 12 }}
          >
            <Text style={{ color: '#1D4ED8', fontSize: 12 }}>
              {post.is_institutional_highlight ? 'Remover destaque' : 'Destaque institucional'}
            </Text>
          </Pressable>
        )}
        {canDelete && (
          <Pressable
            onPress={() => handleDeletePost(post.id)}
            style={{ paddingHorizontal: 10, paddingVertical: 4, backgroundColor: '#FEE2E2', borderRadius: 12 }}
          >
            <Text style={{ color: '#DC2626', fontSize: 12 }}>Remover</Text>
          </Pressable>
        )}
      </View>
    );
  };

  const renderReplyActions = (reply: ChannelReply) => {
    if (!settings || !selectedPost) return null;
    const isAuthor = reply.author_user_id === currentUserId;
    const canEdit = isAuthor || settings.can_moderate;
    const canDelete = settings.can_moderate;

    return (
      <View style={{ flexDirection: 'row', gap: 6, marginTop: 4 }}>
        {canEdit && (
          <Pressable
            onPress={() => { setEditingReplyId(reply.id); setEditReplyBody(reply.body); }}
            style={{ paddingHorizontal: 8, paddingVertical: 2, backgroundColor: '#EDE9FE', borderRadius: 10 }}
          >
            <Text style={{ color: '#7C3AED', fontSize: 11 }}>Editar</Text>
          </Pressable>
        )}
        {canDelete && (
          <Pressable
            onPress={() => handleDeleteReply(reply.id)}
            style={{ paddingHorizontal: 8, paddingVertical: 2, backgroundColor: '#FEE2E2', borderRadius: 10 }}
          >
            <Text style={{ color: '#DC2626', fontSize: 11 }}>Remover</Text>
          </Pressable>
        )}
      </View>
    );
  };

  // ── Loading / Error states ──────────────────────────────────────────────────

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator color="#7C3AED" />
      </View>
    );
  }

  if (error && screen === 'list') {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 }}>
        <Text style={{ color: '#DC2626', textAlign: 'center', marginBottom: 16 }}>{error}</Text>
        <Pressable onPress={loadList}>
          <Text style={{ color: '#7C3AED' }}>Tentar novamente</Text>
        </Pressable>
      </View>
    );
  }

  // ── Post detail screen ──────────────────────────────────────────────────────

  if (screen === 'post') {
    if (!selectedPost) {
      return (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator color="#7C3AED" />
        </View>
      );
    }

    return (
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={{ padding: 16 }}>
          <Pressable onPress={() => { setScreen('list'); setSelectedPost(null); }} style={{ marginBottom: 12 }}>
            <Text style={{ color: '#7C3AED' }}>← Voltar</Text>
          </Pressable>

          {/* Badges de destaque / pin */}
          {selectedPost.is_institutional_highlight && (
            <View style={{ backgroundColor: '#DBEAFE', borderRadius: 6, padding: 6, marginBottom: 6 }}>
              <Text style={{ color: '#1D4ED8', fontSize: 12, fontWeight: '600' }}>⭐ Destaque Institucional</Text>
            </View>
          )}
          {selectedPost.is_pinned && !selectedPost.is_institutional_highlight && (
            <View style={{ backgroundColor: '#FEF9C3', borderRadius: 6, padding: 6, marginBottom: 6 }}>
              <Text style={{ color: '#92400E', fontSize: 12 }}>📌 Fixado</Text>
            </View>
          )}

          {/* Título e meta */}
          {editingPostId === selectedPost.id ? (
            <View>
              <TextInput
                value={editTitle}
                onChangeText={setEditTitle}
                style={{ borderWidth: 1, borderColor: '#D1D5DB', borderRadius: 8, padding: 8, marginBottom: 6, fontSize: 16, fontWeight: '600' }}
              />
              <TextInput
                value={editBody}
                onChangeText={setEditBody}
                multiline
                style={{ borderWidth: 1, borderColor: '#D1D5DB', borderRadius: 8, padding: 8, minHeight: 80, marginBottom: 8 }}
              />
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <Pressable onPress={() => setEditingPostId(null)} style={{ flex: 1, padding: 10, borderRadius: 8, borderWidth: 1, borderColor: '#D1D5DB', alignItems: 'center' }}>
                  <Text>Cancelar</Text>
                </Pressable>
                <Pressable onPress={handleSaveEditPost} disabled={submitting} style={{ flex: 1, padding: 10, borderRadius: 8, backgroundColor: '#7C3AED', alignItems: 'center' }}>
                  <Text style={{ color: '#fff' }}>{submitting ? 'Salvando...' : 'Salvar'}</Text>
                </Pressable>
              </View>
            </View>
          ) : (
            <View>
              <Text style={{ fontSize: 20, fontWeight: '700', marginBottom: 4 }}>{selectedPost.title}</Text>
              <Text style={{ color: '#6B7280', fontSize: 12, marginBottom: 4 }}>
                {selectedPost.author_name} · {new Date(selectedPost.created_at).toLocaleDateString('pt-BR')}
                {selectedPost.edited_at && ' · editado'}
              </Text>
              <Text style={{ fontSize: 15, lineHeight: 22, marginBottom: 8 }}>{selectedPost.body}</Text>
              {renderPostActions(selectedPost)}
            </View>
          )}

          <View style={{ height: 1, backgroundColor: '#E5E7EB', marginVertical: 16 }} />

          {/* Replies */}
          <Text style={{ fontWeight: '600', marginBottom: 12 }}>
            {selectedPost.replies.length} resposta{selectedPost.replies.length !== 1 ? 's' : ''}
          </Text>

          {selectedPost.replies.map((r) => (
            <View key={r.id} style={{ borderLeftWidth: 3, borderLeftColor: '#7C3AED', paddingLeft: 12, marginBottom: 16 }}>
              {editingReplyId === r.id ? (
                <View>
                  <TextInput
                    value={editReplyBody}
                    onChangeText={setEditReplyBody}
                    multiline
                    style={{ borderWidth: 1, borderColor: '#D1D5DB', borderRadius: 8, padding: 8, minHeight: 60, marginBottom: 6 }}
                  />
                  <View style={{ flexDirection: 'row', gap: 6 }}>
                    <Pressable onPress={() => setEditingReplyId(null)} style={{ padding: 6, borderRadius: 6, borderWidth: 1, borderColor: '#D1D5DB' }}>
                      <Text style={{ fontSize: 12 }}>Cancelar</Text>
                    </Pressable>
                    <Pressable onPress={handleSaveEditReply} disabled={submitting} style={{ padding: 6, borderRadius: 6, backgroundColor: '#7C3AED' }}>
                      <Text style={{ color: '#fff', fontSize: 12 }}>{submitting ? '...' : 'Salvar'}</Text>
                    </Pressable>
                  </View>
                </View>
              ) : (
                <View>
                  <Text style={{ fontWeight: '600', fontSize: 13 }}>{r.author_name}</Text>
                  <Text style={{ color: '#6B7280', fontSize: 11, marginBottom: 2 }}>
                    {new Date(r.created_at).toLocaleDateString('pt-BR')}
                    {r.edited_at && ' · editado'}
                  </Text>
                  <Text style={{ fontSize: 14 }}>{r.body}</Text>
                  {renderReplyActions(r)}
                </View>
              )}
            </View>
          ))}

          {replyError && (
            <View style={{ backgroundColor: '#FEE2E2', padding: 8, borderRadius: 6, marginBottom: 8 }}>
              <Text style={{ color: '#DC2626', fontSize: 13 }}>{replyError}</Text>
            </View>
          )}

          {/* Form reply */}
          <TextInput
            value={replyBody}
            onChangeText={setReplyBody}
            placeholder="Escreva uma resposta..."
            multiline
            style={{ borderWidth: 1, borderColor: '#D1D5DB', borderRadius: 8, padding: 10, minHeight: 80, fontSize: 14, marginBottom: 8 }}
          />
          <Pressable
            onPress={handleCreateReply}
            disabled={submitting}
            style={{ backgroundColor: submitting ? '#C4B5FD' : '#7C3AED', padding: 12, borderRadius: 8, alignItems: 'center', marginBottom: 32 }}
          >
            <Text style={{ color: '#fff', fontWeight: '600' }}>{submitting ? 'Enviando...' : 'Responder'}</Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    );
  }

  // ── Post list screen ────────────────────────────────────────────────────────

  return (
    <View style={{ flex: 1, backgroundColor: '#F9FAFB' }}>
      <FlatList
        data={posts}
        keyExtractor={(item) => item.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadList(); }} />}
        contentContainerStyle={{ padding: 16 }}
        ListEmptyComponent={
          <Text style={{ textAlign: 'center', color: '#9CA3AF', marginTop: 40 }}>
            Nenhum post ainda.
          </Text>
        }
        renderItem={({ item }) => (
          <Pressable
            onPress={() => openPost(item)}
            style={{
              backgroundColor: '#fff',
              borderRadius: 12,
              padding: 16,
              marginBottom: 12,
              shadowColor: '#000',
              shadowOpacity: 0.05,
              shadowRadius: 4,
              elevation: 2,
              borderLeftWidth: item.is_institutional_highlight ? 4 : 0,
              borderLeftColor: '#7C3AED',
            }}
          >
            {item.is_institutional_highlight && (
              <Text style={{ color: '#1D4ED8', fontSize: 11, fontWeight: '600', marginBottom: 4 }}>⭐ Destaque Institucional</Text>
            )}
            {item.is_pinned && !item.is_institutional_highlight && (
              <Text style={{ color: '#92400E', fontSize: 11, marginBottom: 4 }}>📌 Fixado</Text>
            )}
            <Text style={{ fontSize: 16, fontWeight: '600', marginBottom: 4 }}>{item.title}</Text>
            <Text style={{ color: '#6B7280', fontSize: 12 }}>
              {item.author_name} · {new Date(item.created_at).toLocaleDateString('pt-BR')} · {item.reply_count} resposta{item.reply_count !== 1 ? 's' : ''}
              {item.edited_at ? ' · editado' : ''}
            </Text>
          </Pressable>
        )}
      />

      {/* Form novo post */}
      {showNewPost && (
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={{ padding: 16, backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: '#E5E7EB' }}>
            {formError && (
              <View style={{ backgroundColor: '#FEE2E2', padding: 8, borderRadius: 6, marginBottom: 8 }}>
                <Text style={{ color: '#DC2626', fontSize: 13 }}>{formError}</Text>
              </View>
            )}
            <TextInput
              value={postTitle}
              onChangeText={setPostTitle}
              placeholder="Título"
              style={{ borderWidth: 1, borderColor: '#D1D5DB', borderRadius: 8, padding: 10, marginBottom: 8 }}
            />
            <TextInput
              value={postBody}
              onChangeText={setPostBody}
              placeholder="Mensagem..."
              multiline
              style={{ borderWidth: 1, borderColor: '#D1D5DB', borderRadius: 8, padding: 10, minHeight: 80, marginBottom: 8 }}
            />
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <Pressable
                onPress={() => { setShowNewPost(false); setFormError(null); setPostTitle(''); setPostBody(''); }}
                style={{ flex: 1, padding: 12, borderRadius: 8, borderWidth: 1, borderColor: '#D1D5DB', alignItems: 'center' }}
              >
                <Text>Cancelar</Text>
              </Pressable>
              <Pressable
                onPress={handleCreatePost}
                disabled={submitting}
                style={{ flex: 1, backgroundColor: submitting ? '#C4B5FD' : '#7C3AED', padding: 12, borderRadius: 8, alignItems: 'center' }}
              >
                <Text style={{ color: '#fff', fontWeight: '600' }}>{submitting ? 'Publicando...' : 'Publicar'}</Text>
              </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
      )}

      {/* FAB — só exibe se can_post */}
      {!showNewPost && settings?.can_post && (
        <Pressable
          onPress={() => setShowNewPost(true)}
          style={{
            position: 'absolute', bottom: 24, right: 24,
            backgroundColor: '#7C3AED', width: 56, height: 56,
            borderRadius: 28, alignItems: 'center', justifyContent: 'center',
            shadowColor: '#7C3AED', shadowOpacity: 0.4, shadowRadius: 8, elevation: 6,
          }}
        >
          <Text style={{ color: '#fff', fontSize: 28, lineHeight: 32 }}>+</Text>
        </Pressable>
      )}
    </View>
  );
}
```

- [ ] **Step 3: Registrar Stack em `lumen_mobile/app/_layout.tsx`**

```tsx
<Stack.Screen name="channel" options={{ headerShown: false }} />
```

- [ ] **Step 4: Commit**

```bash
git add lumen_mobile/app/channel/ lumen_mobile/app/_layout.tsx
git commit -m "feat(canal): tela completa — list, detail, edit, delete, pin, highlight, replies"
```

---

## Task 8: Botão Canal em members.tsx + Seletor no Admin

**Files:**
- Modify: `lumen_mobile/app/members.tsx`
- Modify: `lumen_mobile/app/admin/entities/index.tsx`

- [ ] **Step 1: Adicionar botão Canal em `members.tsx`**

```bash
grep -n "router\|useRouter\|unitId\|unit_id\|org_unit" lumen_mobile/app/members.tsx | head -15
```

Localizar o cabeçalho da tela e adicionar:

```tsx
import { useRouter } from 'expo-router';

// No componente:
const router = useRouter();

// No JSX, junto ao título da unidade:
<Pressable
  onPress={() => router.push(`/channel/${unitId}` as any)}
  style={{
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: '#EDE9FE', paddingHorizontal: 12, paddingVertical: 6,
    borderRadius: 20,
  }}
>
  <Text style={{ color: '#7C3AED', fontWeight: '600', fontSize: 13 }}>💬 Canal</Text>
</Pressable>
```

- [ ] **Step 2: Adicionar seletor de `channel_post_mode` em `entities/index.tsx`**

```bash
grep -n "edit\|Edit\|modal\|Modal\|update\|handleSave" lumen_mobile/app/admin/entities/index.tsx | head -15
```

No estado do form de edição de OrgUnit, adicionar:

```tsx
const [channelPostMode, setChannelPostMode] = useState<'COORDINATOR_ONLY' | 'ALL_MEMBERS'>(
  editingUnit?.channel_post_mode ?? 'COORDINATOR_ONLY'
);
```

No JSX do form de edição:

```tsx
<View style={{ marginBottom: 12 }}>
  <Text style={{ fontWeight: '600', marginBottom: 6, color: '#374151' }}>
    Quem pode criar posts no canal?
  </Text>
  {(['COORDINATOR_ONLY', 'ALL_MEMBERS'] as const).map((mode) => (
    <Pressable
      key={mode}
      onPress={() => setChannelPostMode(mode)}
      style={{
        flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8,
        padding: 12, borderRadius: 10,
        backgroundColor: channelPostMode === mode ? '#EDE9FE' : '#F9FAFB',
        borderWidth: 1,
        borderColor: channelPostMode === mode ? '#7C3AED' : '#E5E7EB',
      }}
    >
      <View style={{
        width: 18, height: 18, borderRadius: 9,
        borderWidth: 2, borderColor: channelPostMode === mode ? '#7C3AED' : '#9CA3AF',
        backgroundColor: channelPostMode === mode ? '#7C3AED' : 'transparent',
      }} />
      <View>
        <Text style={{ color: channelPostMode === mode ? '#7C3AED' : '#374151', fontWeight: '600', fontSize: 13 }}>
          {mode === 'COORDINATOR_ONLY' ? 'Somente coordenadores' : 'Todos os membros'}
        </Text>
        <Text style={{ color: '#6B7280', fontSize: 11 }}>
          {mode === 'COORDINATOR_ONLY'
            ? 'Membros só respondem; coordenadores postam'
            : 'Qualquer membro ativo pode criar posts'}
        </Text>
      </View>
    </Pressable>
  ))}
</View>
```

Incluir no payload do save/update:

```tsx
channel_post_mode: channelPostMode,
```

- [ ] **Step 3: Testar fluxo completo**

1. Entrar como ADMIN na tela de entidades do admin
2. Editar uma OrgUnit — verificar que o seletor aparece e pode ser alterado
3. Salvar — verificar que o backend aceita e persiste
4. Entrar na tela de membros de uma OrgUnit
5. Clicar em "Canal" — verificar navegação
6. Criar um post
7. Clicar no post, responder
8. Verificar botões de edição/remoção conforme role

- [ ] **Step 4: Commit final**

```bash
git add lumen_mobile/app/members.tsx lumen_mobile/app/admin/entities/index.tsx
git commit -m "feat(canal): botão Canal em members + seletor channel_post_mode no admin"
```
