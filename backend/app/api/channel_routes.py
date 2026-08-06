"""
Canal de Grupos por Ministério
==============================
Endpoints:
  GET    /{org_unit_id}/settings
  GET    /{org_unit_id}/posts
  GET    /{org_unit_id}/posts/{post_id}
  POST   /{org_unit_id}/posts
  PATCH  /{org_unit_id}/posts/{post_id}
  DELETE /{org_unit_id}/posts/{post_id}
  PATCH  /{org_unit_id}/posts/{post_id}/pin
  PATCH  /{org_unit_id}/posts/{post_id}/highlight
  POST   /{org_unit_id}/posts/{post_id}/replies
  PATCH  /{org_unit_id}/posts/{post_id}/replies/{reply_id}
  DELETE /{org_unit_id}/posts/{post_id}/replies/{reply_id}
"""

from datetime import datetime, timezone
from uuid import UUID

from fastapi import HTTPException
from fastapi.routing import APIRouter
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.api.deps import CurrentUser, DBSession
from app.api.moderation_routes import blocked_user_ids
from app.services.content_filter import FilterVerdict, check_content
from app.audit.service import create_audit_log
from app.db.models import (
    ContentReport,
    ContentReportReason,
    ContentReportStatus,
    ContentReportTargetType,
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


def _reply_count_subquery():
    return (
        select(
            ChannelReply.post_id,
            func.count(ChannelReply.id).label("reply_count"),
        )
        .where(ChannelReply.deleted_at.is_(None))
        .group_by(ChannelReply.post_id)
        .subquery()
    )


def _build_post_list(db: Session, org_unit_id: UUID, offset: int, limit: int,
                     hidden_author_ids: set | None = None):
    """
    Lista posts do canal.

    `hidden_author_ids`: autores cujo conteudo NAO deve aparecer para quem esta
    lendo (bloqueio mutuo). Exigencia das lojas: bloquear um usuario precisa
    realmente ocultar o conteudo dele — nao basta um botao na interface.
    """
    reply_count_sq = _reply_count_subquery()
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
            *(
                [ChannelPost.author_user_id.notin_(hidden_author_ids)]
                if hidden_author_ids
                else []
            ),
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
    rows = db.execute(
        select(ChannelReply, UserProfile.full_name.label("author_name"))
        .outerjoin(UserProfile, UserProfile.user_id == ChannelReply.author_user_id)
        .where(ChannelReply.post_id == post_id, ChannelReply.deleted_at.is_(None))
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


def _post_with_count(db: Session, post_id: UUID):
    return db.execute(
        select(
            ChannelPost,
            UserProfile.full_name.label("author_name"),
            func.coalesce(
                select(func.count(ChannelReply.id))
                .where(ChannelReply.post_id == post_id, ChannelReply.deleted_at.is_(None))
                .scalar_subquery(),
                0,
            ).label("reply_count"),
        )
        .outerjoin(UserProfile, UserProfile.user_id == ChannelPost.author_user_id)
        .where(ChannelPost.id == post_id)
    ).first()


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
    # Conteudo de usuarios bloqueados (nos dois sentidos) nao aparece no feed
    # NEM entra na contagem — senao a paginacao mostraria "buracos".
    hidden = blocked_user_ids(db, current_user.id)
    total = db.scalar(
        select(func.count()).where(
            ChannelPost.org_unit_id == org_unit_id,
            ChannelPost.deleted_at.is_(None),
            *([ChannelPost.author_user_id.notin_(hidden)] if hidden else []),
        )
    ) or 0
    rows = _build_post_list(db, org_unit_id, offset, limit, hidden)
    return ChannelPostListResponse(posts=[_row_to_post_response(r) for r in rows], total=total)


@router.get("/{org_unit_id}/posts/{post_id}", response_model=ChannelPostDetailResponse)
def get_post(
    org_unit_id: UUID, post_id: UUID, db: DBSession, current_user: CurrentUser
) -> ChannelPostDetailResponse:
    _require_active_member(db, current_user.id, org_unit_id)
    row = db.execute(
        select(ChannelPost, UserProfile.full_name.label("author_name"))
        .outerjoin(UserProfile, UserProfile.user_id == ChannelPost.author_user_id)
        .where(
            ChannelPost.id == post_id,
            ChannelPost.org_unit_id == org_unit_id,
            ChannelPost.deleted_at.is_(None),
        )
    ).first()
    if not row:
        raise HTTPException(status_code=404, detail={"error": "not_found", "message": "Post não encontrado"})
    post: ChannelPost = row[0]
    reply_count = db.scalar(
        select(func.count()).where(ChannelReply.post_id == post_id, ChannelReply.deleted_at.is_(None))
    ) or 0
    replies = _build_reply_list(db, post_id)
    base = ChannelPostResponse(
        id=post.id, org_unit_id=post.org_unit_id, author_user_id=post.author_user_id,
        author_name=row[1] or "Membro", title=post.title, body=post.body,
        is_pinned=post.is_pinned, is_institutional_highlight=post.is_institutional_highlight,
        reply_count=reply_count, edited_at=post.edited_at, created_at=post.created_at,
        updated_at=post.updated_at, is_deleted=False,
    )
    return ChannelPostDetailResponse(**base.model_dump(), replies=replies)


@router.post("/{org_unit_id}/posts", response_model=ChannelPostResponse, status_code=201)
def create_post(
    org_unit_id: UUID, body: CreatePostRequest, db: DBSession, current_user: CurrentUser
) -> ChannelPostResponse:
    membership = _require_active_member(db, current_user.id, org_unit_id)
    unit = _require_org_unit(db, org_unit_id)
    if not _resolve_can_post(membership, unit):
        raise HTTPException(status_code=403, detail={"error": "forbidden", "message": "Apenas coordenadores podem criar posts neste canal"})
    # FILTRO PRE-PUBLICACAO (Apple G1.2, 1a das 4 salvaguardas de UGC).
    # Conservador: BLOQUEIA so o inequivocamente abusivo; o duvidoso e publicado
    # e cai na fila de moderacao humana — um filtro agressivo produziria falsos
    # positivos em conversas legitimas sobre luto, vicio ou conflito.
    verdict = check_content(body.title + chr(10) + body.body)
    if verdict.verdict is FilterVerdict.BLOCK:
        raise HTTPException(
            status_code=422,
            detail={"error": "content_blocked", "message":
                    "Sua publicacao nao pode ser enviada porque viola a politica "
                    "de conteudo da comunidade."},
        )

    post = ChannelPost(org_unit_id=org_unit_id, author_user_id=current_user.id, title=body.title, body=body.body)
    db.add(post)
    db.flush()

    if verdict.verdict is FilterVerdict.FLAG:
        # Publica, mas abre denuncia automatica para revisao humana.
        db.add(ContentReport(
            reporter_user_id=current_user.id,
            target_type=ContentReportTargetType.POST,
            target_id=post.id,
            org_unit_id=org_unit_id,
            reason=ContentReportReason.OTHER,
            details=f"Sinalizado automaticamente: {verdict.reason}",
            content_snapshot=(body.title + chr(10) * 2 + body.body)[:4000],
            status=ContentReportStatus.OPEN,
        ))
    create_audit_log(db, action="channel_post_created", actor_user_id=current_user.id, entity_type="channel_post", entity_id=str(post.id), metadata={"org_unit_id": str(org_unit_id), "title": body.title})
    db.commit()
    db.refresh(post)
    author_name = db.scalars(select(UserProfile.full_name).where(UserProfile.user_id == current_user.id)).first() or "Membro"
    return ChannelPostResponse(
        id=post.id, org_unit_id=post.org_unit_id, author_user_id=post.author_user_id,
        author_name=author_name, title=post.title, body=post.body,
        is_pinned=post.is_pinned, is_institutional_highlight=post.is_institutional_highlight,
        reply_count=0, edited_at=None, created_at=post.created_at, updated_at=post.updated_at, is_deleted=False,
    )


@router.patch("/{org_unit_id}/posts/{post_id}", response_model=ChannelPostResponse)
def edit_post(
    org_unit_id: UUID, post_id: UUID, body: EditPostRequest, db: DBSession, current_user: CurrentUser
) -> ChannelPostResponse:
    membership = _require_active_member(db, current_user.id, org_unit_id)
    is_admin = _is_global_admin(db, current_user.id)
    post = db.scalars(select(ChannelPost).where(ChannelPost.id == post_id, ChannelPost.org_unit_id == org_unit_id, ChannelPost.deleted_at.is_(None))).first()
    if not post:
        raise HTTPException(status_code=404, detail={"error": "not_found", "message": "Post não encontrado"})
    can_edit = post.author_user_id == current_user.id or membership.role == OrgRoleCode.COORDINATOR or is_admin
    if not can_edit:
        raise HTTPException(status_code=403, detail={"error": "forbidden", "message": "Sem permissão para editar este post"})
    if body.title is not None:
        post.title = body.title
    if body.body is not None:
        post.body = body.body
    post.edited_at = datetime.now(timezone.utc)
    create_audit_log(db, action="channel_post_edited", actor_user_id=current_user.id, entity_type="channel_post", entity_id=str(post.id), metadata={"fields_changed": [k for k, v in body.model_dump().items() if v is not None]})
    db.commit()
    return _row_to_post_response(_post_with_count(db, post_id))


@router.delete("/{org_unit_id}/posts/{post_id}", status_code=200)
def delete_post(
    org_unit_id: UUID, post_id: UUID, body: DeleteContentRequest, db: DBSession, current_user: CurrentUser
) -> dict:
    membership = _require_active_member(db, current_user.id, org_unit_id)
    is_admin = _is_global_admin(db, current_user.id)
    post = db.scalars(select(ChannelPost).where(ChannelPost.id == post_id, ChannelPost.org_unit_id == org_unit_id, ChannelPost.deleted_at.is_(None))).first()
    if not post:
        raise HTTPException(status_code=404, detail={"error": "not_found", "message": "Post não encontrado"})
    if not (membership.role == OrgRoleCode.COORDINATOR or is_admin):
        raise HTTPException(status_code=403, detail={"error": "forbidden", "message": "Apenas coordenadores podem remover posts"})
    now = datetime.now(timezone.utc)
    post.deleted_at = now
    post.deleted_by_user_id = current_user.id
    post.delete_reason = body.reason
    create_audit_log(db, action="channel_post_deleted", actor_user_id=current_user.id, entity_type="channel_post", entity_id=str(post.id), metadata={"reason": body.reason, "org_unit_id": str(org_unit_id)})
    db.commit()
    return {"status": "deleted"}


@router.patch("/{org_unit_id}/posts/{post_id}/pin", response_model=ChannelPostResponse)
def toggle_pin(
    org_unit_id: UUID, post_id: UUID, db: DBSession, current_user: CurrentUser
) -> ChannelPostResponse:
    membership = _require_active_member(db, current_user.id, org_unit_id)
    is_admin = _is_global_admin(db, current_user.id)
    if membership.role != OrgRoleCode.COORDINATOR and not is_admin:
        raise HTTPException(status_code=403, detail={"error": "forbidden", "message": "Apenas coordenadores podem fixar posts"})
    post = db.scalars(select(ChannelPost).where(ChannelPost.id == post_id, ChannelPost.org_unit_id == org_unit_id, ChannelPost.deleted_at.is_(None))).first()
    if not post:
        raise HTTPException(status_code=404, detail={"error": "not_found", "message": "Post não encontrado"})
    post.is_pinned = not post.is_pinned
    db.commit()
    return _row_to_post_response(_post_with_count(db, post_id))


@router.patch("/{org_unit_id}/posts/{post_id}/highlight", response_model=ChannelPostResponse)
def toggle_institutional_highlight(
    org_unit_id: UUID, post_id: UUID, db: DBSession, current_user: CurrentUser
) -> ChannelPostResponse:
    """Apenas admins globais (DEV, ADMIN) podem definir destaque institucional."""
    if not _is_global_admin(db, current_user.id):
        raise HTTPException(status_code=403, detail={"error": "forbidden", "message": "Apenas administradores podem definir destaque institucional"})
    _require_active_member(db, current_user.id, org_unit_id)
    post = db.scalars(select(ChannelPost).where(ChannelPost.id == post_id, ChannelPost.org_unit_id == org_unit_id, ChannelPost.deleted_at.is_(None))).first()
    if not post:
        raise HTTPException(status_code=404, detail={"error": "not_found", "message": "Post não encontrado"})
    post.is_institutional_highlight = not post.is_institutional_highlight
    create_audit_log(db, action="channel_post_highlight_toggled", actor_user_id=current_user.id, entity_type="channel_post", entity_id=str(post.id), metadata={"is_institutional_highlight": post.is_institutional_highlight})
    db.commit()
    return _row_to_post_response(_post_with_count(db, post_id))


@router.post("/{org_unit_id}/posts/{post_id}/replies", response_model=ChannelReplyResponse, status_code=201)
def create_reply(
    org_unit_id: UUID, post_id: UUID, body: CreateReplyRequest, db: DBSession, current_user: CurrentUser
) -> ChannelReplyResponse:
    _require_active_member(db, current_user.id, org_unit_id)
    post = db.scalars(select(ChannelPost).where(ChannelPost.id == post_id, ChannelPost.org_unit_id == org_unit_id, ChannelPost.deleted_at.is_(None))).first()
    if not post:
        raise HTTPException(status_code=404, detail={"error": "not_found", "message": "Post não encontrado"})
    reply = ChannelReply(post_id=post_id, author_user_id=current_user.id, body=body.body)
    db.add(reply)
    db.flush()
    create_audit_log(db, action="channel_reply_created", actor_user_id=current_user.id, entity_type="channel_reply", entity_id=str(reply.id), metadata={"post_id": str(post_id)})
    db.commit()
    author_name = db.scalars(select(UserProfile.full_name).where(UserProfile.user_id == current_user.id)).first() or "Membro"
    return ChannelReplyResponse(id=reply.id, post_id=reply.post_id, author_user_id=reply.author_user_id, author_name=author_name, body=reply.body, edited_at=None, created_at=reply.created_at, is_deleted=False)


@router.patch("/{org_unit_id}/posts/{post_id}/replies/{reply_id}", response_model=ChannelReplyResponse)
def edit_reply(
    org_unit_id: UUID, post_id: UUID, reply_id: UUID, body: EditReplyRequest, db: DBSession, current_user: CurrentUser
) -> ChannelReplyResponse:
    membership = _require_active_member(db, current_user.id, org_unit_id)
    is_admin = _is_global_admin(db, current_user.id)
    reply = db.scalars(
        select(ChannelReply)
        .join(ChannelPost, ChannelPost.id == ChannelReply.post_id)
        .where(
            ChannelReply.id == reply_id,
            ChannelReply.post_id == post_id,
            ChannelPost.org_unit_id == org_unit_id,
            ChannelReply.deleted_at.is_(None),
        )
    ).first()
    if not reply:
        raise HTTPException(status_code=404, detail={"error": "not_found", "message": "Resposta não encontrada"})
    can_edit = reply.author_user_id == current_user.id or membership.role == OrgRoleCode.COORDINATOR or is_admin
    if not can_edit:
        raise HTTPException(status_code=403, detail={"error": "forbidden", "message": "Sem permissão para editar esta resposta"})
    reply.body = body.body
    reply.edited_at = datetime.now(timezone.utc)
    create_audit_log(db, action="channel_reply_edited", actor_user_id=current_user.id, entity_type="channel_reply", entity_id=str(reply.id), metadata={"fields_changed": ["body"]})
    db.commit()
    author_name = db.scalars(select(UserProfile.full_name).where(UserProfile.user_id == reply.author_user_id)).first() or "Membro"
    return ChannelReplyResponse(id=reply.id, post_id=reply.post_id, author_user_id=reply.author_user_id, author_name=author_name, body=reply.body, edited_at=reply.edited_at, created_at=reply.created_at, is_deleted=False)


@router.delete("/{org_unit_id}/posts/{post_id}/replies/{reply_id}", status_code=200)
def delete_reply(
    org_unit_id: UUID, post_id: UUID, reply_id: UUID, body: DeleteContentRequest, db: DBSession, current_user: CurrentUser
) -> dict:
    membership = _require_active_member(db, current_user.id, org_unit_id)
    is_admin = _is_global_admin(db, current_user.id)
    reply = db.scalars(
        select(ChannelReply)
        .join(ChannelPost, ChannelPost.id == ChannelReply.post_id)
        .where(
            ChannelReply.id == reply_id,
            ChannelReply.post_id == post_id,
            ChannelPost.org_unit_id == org_unit_id,
            ChannelReply.deleted_at.is_(None),
        )
    ).first()
    if not reply:
        raise HTTPException(status_code=404, detail={"error": "not_found", "message": "Resposta não encontrada"})
    if not (membership.role == OrgRoleCode.COORDINATOR or is_admin):
        raise HTTPException(status_code=403, detail={"error": "forbidden", "message": "Apenas coordenadores podem remover respostas"})
    now = datetime.now(timezone.utc)
    reply.deleted_at = now
    reply.deleted_by_user_id = current_user.id
    reply.delete_reason = body.reason
    create_audit_log(db, action="channel_reply_deleted", actor_user_id=current_user.id, entity_type="channel_reply", entity_id=str(reply.id), metadata={"reason": body.reason})
    db.commit()
    return {"status": "deleted"}
