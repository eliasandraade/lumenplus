"""
Moderação de conteúdo gerado por usuário (UGC)
==============================================
POST   /moderation/reports              — denunciar post, resposta ou usuário
GET    /moderation/reports              — fila de denúncias (coordenador/admin)
PATCH  /moderation/reports/{id}         — resolver denúncia (coordenador/admin)
POST   /moderation/blocks               — bloquear usuário
DELETE /moderation/blocks/{user_id}     — desbloquear
GET    /moderation/blocks               — meus bloqueios

Requisito das lojas: Apple App Store Review Guideline 1.2 e a política de UGC do
Google Play exigem que o usuário possa DENUNCIAR conteúdo e BLOQUEAR outro
usuário em apps com conteúdo gerado por usuários.
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any
from uuid import UUID

from fastapi import APIRouter, HTTPException, Query, Response, status
from pydantic import BaseModel, Field
from sqlalchemy import select

from app.api.deps import CurrentUser, DBSession
from app.audit.service import create_audit_log
from app.db.models import (
    ChannelPost,
    ChannelReply,
    ContentReport,
    ContentReportReason,
    ContentReportStatus,
    ContentReportTargetType,
    GlobalRole,
    MembershipStatus,
    OrgMembership,
    OrgRoleCode,
    User,
    UserBlock,
    UserGlobalRole,
    UserProfile,
)

router = APIRouter(prefix="/moderation", tags=["Moderação"])

# Limite de denúncias abertas por usuário — trava simples anti-flood, além da
# constraint que impede denunciar o mesmo alvo duas vezes.
MAX_OPEN_REPORTS_PER_USER = 50


# =============================================================================
# Schemas
# =============================================================================
class CreateReportRequest(BaseModel):
    target_type: ContentReportTargetType
    target_id: UUID
    reason: ContentReportReason
    details: str | None = Field(default=None, max_length=2000)


class ReportResponse(BaseModel):
    id: UUID
    target_type: str
    target_id: UUID
    reason: str
    status: str
    details: str | None
    created_at: datetime


class ResolveReportRequest(BaseModel):
    status: ContentReportStatus
    resolution_note: str | None = Field(default=None, max_length=2000)
    remove_content: bool = False


class BlockRequest(BaseModel):
    user_id: UUID


class BlockedUserResponse(BaseModel):
    user_id: UUID
    name: str | None
    created_at: datetime


# =============================================================================
# Helpers
# =============================================================================
def _is_admin(db: Any, user_id: UUID) -> bool:
    roles = (
        db.execute(
            select(GlobalRole.code)
            .join(UserGlobalRole, UserGlobalRole.global_role_id == GlobalRole.id)
            .where(UserGlobalRole.user_id == user_id)
        )
        .scalars()
        .all()
    )
    return any(r in ("ADMIN", "DEV") for r in roles)


def _moderated_unit_ids(db: Any, user_id: UUID) -> list[UUID]:
    """Unidades onde o usuário é COORDINATOR — pode moderar."""
    rows = (
        db.execute(
            select(OrgMembership.org_unit_id).where(
                OrgMembership.user_id == user_id,
                OrgMembership.status == MembershipStatus.ACTIVE,
                OrgMembership.role == OrgRoleCode.COORDINATOR,
            )
        )
        .scalars()
        .all()
    )
    return list(rows)


def _resolve_target(db: Any, target_type: ContentReportTargetType, target_id: UUID):
    """
    Localiza o alvo da denúncia e devolve (autor_id, org_unit_id, snapshot).
    404 se não existir — sem revelar nada além disso.
    """
    if target_type == ContentReportTargetType.POST:
        post = db.get(ChannelPost, target_id)
        if not post or post.deleted_at is not None:
            raise HTTPException(status_code=404, detail={"error": "not_found",
                                                         "message": "Conteúdo não encontrado"})
        return post.author_user_id, post.org_unit_id, f"{post.title}\n\n{post.body}"[:4000]

    if target_type == ContentReportTargetType.REPLY:
        reply = db.get(ChannelReply, target_id)
        if not reply or reply.deleted_at is not None:
            raise HTTPException(status_code=404, detail={"error": "not_found",
                                                         "message": "Conteúdo não encontrado"})
        parent = db.get(ChannelPost, reply.post_id)
        return reply.author_user_id, (parent.org_unit_id if parent else None), reply.body[:4000]

    # USER
    target_user = db.get(User, target_id)
    if not target_user:
        raise HTTPException(status_code=404, detail={"error": "not_found",
                                                     "message": "Usuário não encontrado"})
    return target_user.id, None, None


def blocked_user_ids(db: Any, user_id: UUID) -> set[UUID]:
    """
    IDs cujo conteúdo NÃO deve aparecer para `user_id`.

    O bloqueio é SIMÉTRICO na visibilidade: entram tanto quem eu bloqueei
    quanto quem me bloqueou. Assim o bloqueado não percebe o bloqueio por
    ausência unilateral, e o contato é cortado dos dois lados.
    """
    a = db.execute(
        select(UserBlock.blocked_user_id).where(UserBlock.blocker_user_id == user_id)
    ).scalars().all()
    b = db.execute(
        select(UserBlock.blocker_user_id).where(UserBlock.blocked_user_id == user_id)
    ).scalars().all()
    return set(a) | set(b)


# =============================================================================
# Denúncias
# =============================================================================
@router.post("/reports", status_code=status.HTTP_201_CREATED, response_model=ReportResponse)
def create_report(
    body: CreateReportRequest, current_user: CurrentUser, db: DBSession
) -> Any:
    """Denuncia um post, uma resposta ou um usuário."""
    author_id, org_unit_id, snapshot = _resolve_target(db, body.target_type, body.target_id)

    if author_id == current_user.id:
        raise HTTPException(
            status_code=400,
            detail={"error": "invalid_target", "message": "Você não pode denunciar a si mesmo"},
        )

    open_count = db.execute(
        select(ContentReport).where(
            ContentReport.reporter_user_id == current_user.id,
            ContentReport.status.in_([ContentReportStatus.OPEN, ContentReportStatus.REVIEWING]),
        )
    ).scalars().all()
    if len(open_count) >= MAX_OPEN_REPORTS_PER_USER:
        raise HTTPException(
            status_code=429,
            detail={"error": "too_many_reports",
                    "message": "Você tem muitas denúncias em análise. Aguarde a revisão."},
        )

    # Idempotente: denunciar o mesmo alvo de novo devolve a denúncia existente
    # (a constraint única já impediria, mas assim o app não vê erro).
    existing = db.execute(
        select(ContentReport).where(
            ContentReport.reporter_user_id == current_user.id,
            ContentReport.target_type == body.target_type,
            ContentReport.target_id == body.target_id,
        )
    ).scalar_one_or_none()
    if existing:
        return existing

    report = ContentReport(
        reporter_user_id=current_user.id,
        target_type=body.target_type,
        target_id=body.target_id,
        org_unit_id=org_unit_id,
        reason=body.reason,
        details=body.details,
        content_snapshot=snapshot,
        status=ContentReportStatus.OPEN,
    )
    db.add(report)
    create_audit_log(
        db=db,
        actor_user_id=current_user.id,
        action="content_reported",
        entity_type="content_report",
        entity_id=str(body.target_id),
        metadata={"target_type": body.target_type.value, "reason": body.reason.value},
    )
    db.commit()
    db.refresh(report)
    return report


@router.get("/reports")
def list_reports(
    current_user: CurrentUser,
    db: DBSession,
    status_filter: ContentReportStatus | None = Query(default=None, alias="status"),
    limit: int = Query(default=50, le=200),
) -> Any:
    """Fila de moderação. Admin vê tudo; coordenador vê só as suas unidades."""
    is_admin = _is_admin(db, current_user.id)
    unit_ids = _moderated_unit_ids(db, current_user.id)
    if not is_admin and not unit_ids:
        raise HTTPException(
            status_code=403,
            detail={"error": "forbidden", "message": "Você não modera nenhuma unidade"},
        )

    stmt = select(ContentReport)
    if not is_admin:
        stmt = stmt.where(ContentReport.org_unit_id.in_(unit_ids))
    if status_filter:
        stmt = stmt.where(ContentReport.status == status_filter)
    stmt = stmt.order_by(ContentReport.created_at.desc()).limit(limit)

    reports = db.execute(stmt).scalars().all()

    # Nomes dos envolvidos em BATCH (sem N+1).
    user_ids = {r.reporter_user_id for r in reports}
    names: dict[UUID, str | None] = {}
    if user_ids:
        for prof in db.execute(
            select(UserProfile).where(UserProfile.user_id.in_(user_ids))
        ).scalars().all():
            names[prof.user_id] = prof.full_name

    return {
        "total": len(reports),
        "reports": [
            {
                "id": str(r.id),
                "target_type": r.target_type.value,
                "target_id": str(r.target_id),
                "org_unit_id": str(r.org_unit_id) if r.org_unit_id else None,
                "reason": r.reason.value,
                "details": r.details,
                "status": r.status.value,
                "content_snapshot": r.content_snapshot,
                "reporter_name": names.get(r.reporter_user_id),
                "created_at": r.created_at.isoformat(),
                "reviewed_at": r.reviewed_at.isoformat() if r.reviewed_at else None,
                "resolution_note": r.resolution_note,
            }
            for r in reports
        ],
    }


@router.patch("/reports/{report_id}")
def resolve_report(
    report_id: UUID, body: ResolveReportRequest, current_user: CurrentUser, db: DBSession
) -> Any:
    """Resolve uma denúncia; opcionalmente remove o conteúdo denunciado."""
    report = db.get(ContentReport, report_id)
    if not report:
        raise HTTPException(status_code=404, detail={"error": "not_found",
                                                     "message": "Denúncia não encontrada"})

    is_admin = _is_admin(db, current_user.id)
    if not is_admin and report.org_unit_id not in _moderated_unit_ids(db, current_user.id):
        raise HTTPException(
            status_code=403,
            detail={"error": "forbidden", "message": "Você não modera esta unidade"},
        )

    if body.remove_content:
        now = datetime.now(timezone.utc)
        if report.target_type == ContentReportTargetType.POST:
            post = db.get(ChannelPost, report.target_id)
            if post and post.deleted_at is None:
                post.deleted_at = now
                post.deleted_by_user_id = current_user.id
                post.delete_reason = f"Moderação: {report.reason.value}"
        elif report.target_type == ContentReportTargetType.REPLY:
            reply = db.get(ChannelReply, report.target_id)
            if reply and reply.deleted_at is None:
                reply.deleted_at = now
                reply.deleted_by_user_id = current_user.id
                reply.delete_reason = f"Moderação: {report.reason.value}"

    report.status = body.status
    report.resolution_note = body.resolution_note
    report.reviewed_by_user_id = current_user.id
    report.reviewed_at = datetime.now(timezone.utc)

    create_audit_log(
        db=db,
        actor_user_id=current_user.id,
        action="content_report_resolved",
        entity_type="content_report",
        entity_id=str(report.id),
        metadata={"status": body.status.value, "removed": body.remove_content},
    )
    db.commit()
    return {"id": str(report.id), "status": report.status.value}


# =============================================================================
# Bloqueios
# =============================================================================
@router.post("/blocks", status_code=status.HTTP_201_CREATED)
def block_user(body: BlockRequest, current_user: CurrentUser, db: DBSession) -> Any:
    """Bloqueia um usuário. Idempotente."""
    if body.user_id == current_user.id:
        raise HTTPException(
            status_code=400,
            detail={"error": "invalid_target", "message": "Você não pode bloquear a si mesmo"},
        )
    if not db.get(User, body.user_id):
        raise HTTPException(status_code=404, detail={"error": "not_found",
                                                     "message": "Usuário não encontrado"})

    existing = db.execute(
        select(UserBlock).where(
            UserBlock.blocker_user_id == current_user.id,
            UserBlock.blocked_user_id == body.user_id,
        )
    ).scalar_one_or_none()
    if existing:
        return {"blocked": True, "already": True}

    db.add(UserBlock(blocker_user_id=current_user.id, blocked_user_id=body.user_id))
    create_audit_log(
        db=db,
        actor_user_id=current_user.id,
        action="user_blocked",
        entity_type="user_block",
        entity_id=str(body.user_id),
    )
    db.commit()
    return {"blocked": True, "already": False}


# response_class=Response é obrigatório aqui, não é estilo. No FastAPI 0.109
# (a versão pinada em requirements.txt, que é a que vai para produção) a
# anotação `-> None` ainda gera um campo de resposta, e o construtor da rota
# aborta com "Status code 204 must not have a response body". Versões mais
# novas tratam None como caso especial e não reclamam — por isso o erro só
# aparecia no CI. Declarar a response_class resolve nas duas.
@router.delete(
    "/blocks/{user_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    response_class=Response,
)
def unblock_user(user_id: UUID, current_user: CurrentUser, db: DBSession) -> None:
    """Desbloqueia. Idempotente — 204 mesmo se não havia bloqueio."""
    block = db.execute(
        select(UserBlock).where(
            UserBlock.blocker_user_id == current_user.id,
            UserBlock.blocked_user_id == user_id,
        )
    ).scalar_one_or_none()
    if block:
        db.delete(block)
        create_audit_log(
            db=db,
            actor_user_id=current_user.id,
            action="user_unblocked",
            entity_type="user_block",
            entity_id=str(user_id),
        )
        db.commit()


@router.get("/blocks")
def list_blocks(current_user: CurrentUser, db: DBSession) -> Any:
    """Usuários que EU bloqueei (não expõe quem me bloqueou)."""
    blocks = db.execute(
        select(UserBlock).where(UserBlock.blocker_user_id == current_user.id)
        .order_by(UserBlock.created_at.desc())
    ).scalars().all()

    ids = {b.blocked_user_id for b in blocks}
    names: dict[UUID, str | None] = {}
    if ids:
        for prof in db.execute(
            select(UserProfile).where(UserProfile.user_id.in_(ids))
        ).scalars().all():
            names[prof.user_id] = prof.full_name

    return {
        "total": len(blocks),
        "blocks": [
            {
                "user_id": str(b.blocked_user_id),
                "name": names.get(b.blocked_user_id),
                "created_at": b.created_at.isoformat(),
            }
            for b in blocks
        ],
    }
