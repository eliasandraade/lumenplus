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
from datetime import datetime, timedelta, timezone
from typing import Any
from uuid import UUID

from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from sqlalchemy import select

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
    """Gera CSV em memória com os usuários."""
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

    invalid = set(body.fields) - ALLOWED_FIELDS
    if invalid:
        raise HTTPException(
            status_code=422,
            detail={"error": "invalid_fields", "fields": list(invalid)},
        )

    has_sensitive = bool(set(body.fields) & SENSITIVE_FIELDS)

    export_req = DataExportRequest(
        requested_by=current_user.id,
        status="PENDING",
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
    requester = db.execute(select(User).where(User.id == requester_id)).scalar_one_or_none()
    requester_name = requester.profile.full_name if requester and requester.profile else "Alguém"
    fields_str = ", ".join(export_req.fields_requested)

    council_user_ids = db.execute(
        select(UserGlobalRole.user_id)
        .join(GlobalRole)
        .where(GlobalRole.code == "COUNCIL_GENERAL")
    ).scalars().all()

    if not council_user_ids:
        return

    from app.db.models import InboxApprovalStatus, InboxMessage, InboxMessageType, InboxRecipient

    inbox_msg = InboxMessage(
        title="Aprovação necessária: Exportação de dados sensíveis",
        message=(
            f"{requester_name} solicitou uma exportação de dados que inclui informações sensíveis "
            f"(campos: {fields_str}). Acesse a área de Aprovações no painel admin para aprovar ou rejeitar."
        ),
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
    """Lista solicitações. DEV/ADMIN/COUNCIL_GENERAL veem todas; outros veem as próprias."""
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

    _notify_requester_approved(db, export_req, current_user.id)
    db.commit()
    return {"id": str(export_req.id), "status": export_req.status}


def _notify_requester_approved(db, export_req: DataExportRequest, approver_id: UUID) -> None:
    from app.db.models import InboxApprovalStatus, InboxMessage, InboxMessageType, InboxRecipient

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
