"""
Admin Routes
============
Endpoints administrativos.

SEGURANÇA: Toda visualização de CPF/RG é auditada obrigatoriamente.
"""

from datetime import datetime, timedelta, timezone
from typing import Any
from uuid import UUID

from fastapi import APIRouter, HTTPException, Query, Request
from pydantic import BaseModel
from sqlalchemy import select, or_, func, exists, nullslast, delete, desc, true
from sqlalchemy.orm import Session, aliased

from app.api.deps import CurrentUser, DBSession
from app.db.models import (
    UserProfile,
    User,
    UserIdentity,
    UserGlobalRole,
    GlobalRole,
    ProfileCatalogItem,
    ProfileCatalog,
    OrgMembership,
    MembershipStatus,
    OrgUnit,
    OrgUnitType,
    OrgInvite,
    InviteStatus,
    AuditLog,
    SensitiveAccessRequest,
    SensitiveAccessAudit,
)
from app.services.organization import (  # noqa: F401
    get_dev_user_ids,
    get_user_global_roles,
    is_conselho_geral_coordinator,
)

router = APIRouter(prefix="/admin", tags=["Admin"])


# =============================================================================
# HELPER — verifica acesso ao dashboard/analytics
# =============================================================================


def require_admin_or_analista(db: Session, user_id: UUID) -> None:
    roles = get_user_global_roles(db, user_id)
    if not any(r in roles for r in ["ADMIN", "DEV", "ANALISTA"]):
        raise HTTPException(
            status_code=403,
            detail={
                "error": "permission_denied",
                "message": "Acesso restrito a administradores e analistas",
            },
        )


# =============================================================================
# USERS — listagem administrativa
# =============================================================================


@router.get("/users/filter-options")
async def get_filter_options(
    current_user: CurrentUser,
    db: DBSession,
) -> Any:
    """
    Retorna as opções disponíveis para filtros de usuários:
    cidades, estados, realidades vocacionais, estados civis.
    Requer DEV, ADMIN ou SECRETARY.
    """
    global_roles = get_user_global_roles(db, current_user.id)
    if not any(r in global_roles for r in ["DEV", "ADMIN", "SECRETARY"]):
        raise HTTPException(status_code=403, detail={"error": "forbidden"})

    # Cidades distintas (não nulas, ordenadas)
    cidades = db.execute(
        select(UserProfile.city)
        .where(UserProfile.city.isnot(None), UserProfile.city != "")
        .distinct()
        .order_by(UserProfile.city)
    ).scalars().all()

    # Estados distintos
    estados = db.execute(
        select(UserProfile.state)
        .where(UserProfile.state.isnot(None), UserProfile.state != "")
        .distinct()
        .order_by(UserProfile.state)
    ).scalars().all()

    # Realidades vocacionais do catálogo (com contagem de usuários que as têm)
    voc_items = db.execute(
        select(ProfileCatalogItem.code, ProfileCatalogItem.label)
        .join(ProfileCatalog)
        .where(ProfileCatalog.code == "VOCATIONAL_REALITY")
        .order_by(ProfileCatalogItem.sort_order)
    ).all()

    # Estados civis do catálogo
    ec_items = db.execute(
        select(ProfileCatalogItem.code, ProfileCatalogItem.label)
        .join(ProfileCatalog)
        .where(ProfileCatalog.code == "MARITAL_STATUS")
        .order_by(ProfileCatalogItem.sort_order)
    ).all()

    return {
        "cidades": cidades,
        "estados": estados,
        "realidades_vocacionais": [{"code": r.code, "label": r.label} for r in voc_items],
        "estados_civis": [{"code": r.code, "label": r.label} for r in ec_items],
        "profile_status": [
            {"code": "COMPLETE", "label": "Completo"},
            {"code": "INCOMPLETE", "label": "Incompleto"},
        ],
    }


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

    # Join apenas com UserProfile (1-para-1) para evitar duplicatas.
    # Busca por email usa EXISTS → sem JOIN com UserIdentity na query principal.
    def _apply_search(stmt: Any, term: str) -> Any:
        email_match = exists().where(
            UserIdentity.user_id == User.id,
            UserIdentity.email.ilike(term),
        )
        return stmt.where(or_(UserProfile.full_name.ilike(term), email_match))

    base = (
        select(User)
        .join(UserProfile, UserProfile.user_id == User.id, isouter=True)
        .where(User.is_active == True)  # noqa: E712
    )

    if search.strip():
        base = _apply_search(base, f"%{search.strip()}%")

    # Filtros adicionais
    if cidade:
        base = base.where(UserProfile.city.ilike(f"%{cidade}%"))
    if estado:
        base = base.where(UserProfile.state.ilike(f"%{estado}%"))
    if profile_status:
        base = base.where(UserProfile.status == profile_status)

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
            base = base.where(UserProfile.vocational_reality_item_id == voc_item.id)
        else:
            return {"users": [], "total": 0, "limit": limit, "offset": offset}

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
            base = base.where(UserProfile.marital_status_item_id == ec_item.id)
        else:
            return {"users": [], "total": 0, "limit": limit, "offset": offset}

    if ministerio_id:
        try:
            from uuid import UUID as _UUID
            min_uuid = _UUID(ministerio_id)
            base = base.where(UserProfile.interested_ministry_id == min_uuid)
        except ValueError:
            return {"users": [], "total": 0, "limit": limit, "offset": offset}

    # Paginação
    stmt = base.order_by(nullslast(UserProfile.full_name.asc())).offset(offset).limit(limit)
    users = db.execute(stmt).scalars().all()

    # Contagem total
    total = db.execute(select(func.count()).select_from(base.subquery())).scalar() or 0

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

    return {"users": result, "total": total, "limit": limit, "offset": offset}


# =============================================================================
# USERS — perfil completo
# =============================================================================


@router.get("/users/{user_id}/profile")
async def get_user_full_profile(
    request: Request,
    user_id: UUID,
    current_user: CurrentUser,
    db: DBSession,
) -> Any:
    """
    Retorna perfil completo de um usuário e histórico de auditoria.
    Requer DEV, ADMIN ou SECRETARY para os campos não-sensíveis.

    SEGURANÇA (H5A-01): CPF/RG só são descriptografados/retornados com bypass DEV
    ou uma SensitiveAccessRequest APROVADA e não expirada para (solicitante, alvo) —
    mesmo controle de `get_user_documents` (separação de deveres + expiração + audit).
    ADMIN/SECRETARY sem aprovação recebem cpf=rg=None e devem usar o fluxo
    /admin/sensitive-access.
    """
    from app.crypto.service import crypto_service

    caller_roles = get_user_global_roles(db, current_user.id)
    if not any(r in caller_roles for r in ["DEV", "ADMIN", "SECRETARY"]):
        raise HTTPException(status_code=403, detail={"error": "forbidden"})

    target = db.execute(select(User).where(User.id == user_id)).scalar_one_or_none()
    if not target:
        raise HTTPException(status_code=404, detail={"error": "not_found"})

    profile = target.profile
    email = target.identities[0].email if target.identities else None
    user_roles = get_user_global_roles(db, user_id)

    # SEGURANÇA: CPF/RG exigem bypass DEV ou SensitiveAccessRequest aprovada e válida.
    is_dev = "DEV" in caller_roles
    sensitive_access = None
    if not is_dev:
        sensitive_access = (
            db.query(SensitiveAccessRequest)
            .filter(
                SensitiveAccessRequest.requester_user_id == current_user.id,
                SensitiveAccessRequest.target_user_id == user_id,
                SensitiveAccessRequest.status == "APPROVED",
                SensitiveAccessRequest.expires_at > datetime.now(timezone.utc),
            )
            .first()
        )
    can_view_documents = is_dev or sensitive_access is not None

    # Descriptografar RG e CPF — somente quando autorizado
    cpf_plain = None
    rg_plain = None
    if can_view_documents and profile:
        crypto = crypto_service
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

    documents_disclosed = cpf_plain is not None or rg_plain is not None

    # Auditoria — registrar acesso ao perfil
    db.add(
        AuditLog(
            actor_user_id=current_user.id,
            action="VIEW_FULL_PROFILE",
            entity_type="USER",
            entity_id=str(user_id),
            extra_data={"caller_email": email, "documents_disclosed": documents_disclosed},
        )
    )
    # Auditoria sensível dedicada quando CPF/RG forem efetivamente revelados
    if documents_disclosed:
        db.add(
            SensitiveAccessAudit(
                request_id=sensitive_access.id if sensitive_access else None,
                viewer_user_id=current_user.id,
                target_user_id=user_id,
                action="VIEW_CPF_RG",
                ip=request.client.host if request.client else None,
                user_agent=request.headers.get("user-agent"),
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


# =============================================================================
# USERS — edição administrativa
# =============================================================================


class UpdateUserRequest(BaseModel):
    full_name: str | None = None
    global_roles: list[str] | None = None  # Ex: ["DEV", "ADMIN"]


@router.patch("/users/{user_id}")
async def update_user(
    user_id: UUID,
    data: UpdateUserRequest,
    current_user: CurrentUser,
    db: DBSession,
) -> Any:
    """
    Edita nome e/ou roles globais de um usuário.
    Requer DEV ou ADMIN.
    """
    global_roles = get_user_global_roles(db, current_user.id)
    if not any(r in global_roles for r in ["DEV", "ADMIN"]):
        raise HTTPException(
            status_code=403,
            detail={"error": "forbidden", "message": "Sem permissão para editar usuários"},
        )

    target = db.get(User, user_id)
    if not target or not target.is_active:
        raise HTTPException(
            status_code=404,
            detail={"error": "not_found", "message": "Usuário não encontrado"},
        )

    # Atualiza nome no perfil
    if data.full_name is not None:
        profile = target.profile
        if profile is None:
            profile = UserProfile(user_id=user_id, status="INCOMPLETE")
            db.add(profile)
        profile.full_name = data.full_name.strip() or None

    # Atualiza roles globais (substitui completamente)
    if data.global_roles is not None:
        # Remove todas as roles atuais
        db.execute(delete(UserGlobalRole).where(UserGlobalRole.user_id == user_id))
        # Insere as novas
        allowed_roles = {"DEV", "ADMIN", "SECRETARY", "AVISOS"}
        for role_code in data.global_roles:
            role_code = role_code.upper().strip()
            if role_code not in allowed_roles:
                continue
            role = db.execute(
                select(GlobalRole).where(GlobalRole.code == role_code)
            ).scalar_one_or_none()
            if role:
                db.add(UserGlobalRole(user_id=user_id, global_role_id=role.id))

    db.commit()
    db.refresh(target)

    profile = target.profile
    email = target.identities[0].email if target.identities else None
    updated_roles = get_user_global_roles(db, user_id)

    return {
        "id": str(target.id),
        "name": profile.full_name if profile else None,
        "email": email,
        "photo_url": profile.photo_url if profile else None,
        "profile_status": profile.status if profile else "INCOMPLETE",
        "global_roles": updated_roles,
        "created_at": target.created_at.isoformat(),
    }


# =============================================================================
# USERS — exclusão (anonimização) de conta pelo admin
# =============================================================================


@router.delete("/users/{user_id}", status_code=204)
async def delete_user_account(
    user_id: UUID,
    current_user: CurrentUser,
    db: DBSession,
    reason: str | None = Query(None, max_length=500),
) -> None:
    """
    Exclui (anonimiza) a conta de outro usuário. LGPD art. 18, VI.

    Autorização:
    - DEV pode excluir qualquer conta, exceto a si mesmo e outras contas DEV.
    - ADMIN pode excluir apenas contas que não sejam DEV nem ADMIN.
    - Ninguém exclui a própria conta por aqui (usar ``DELETE /auth/me``).

    Estratégia: anonimização compartilhada com o self-delete
    (``app.services.account_deletion.anonymize_user``).
    """
    caller_roles = get_user_global_roles(db, current_user.id)
    is_dev = "DEV" in caller_roles
    is_admin = "ADMIN" in caller_roles
    if not (is_dev or is_admin):
        raise HTTPException(
            status_code=403,
            detail={"error": "forbidden", "message": "Sem permissão para excluir usuários"},
        )

    if user_id == current_user.id:
        raise HTTPException(
            status_code=400,
            detail={
                "error": "self_delete_forbidden",
                "message": "Para excluir sua própria conta, use a opção no Perfil",
            },
        )

    target = db.get(User, user_id)
    if not target or not target.is_active:
        raise HTTPException(
            status_code=404,
            detail={"error": "not_found", "message": "Usuário não encontrado"},
        )

    target_roles = get_user_global_roles(db, user_id)
    # Contas DEV (técnicas/infra) nunca podem ser excluídas pelo painel.
    if "DEV" in target_roles:
        raise HTTPException(
            status_code=403,
            detail={"error": "forbidden", "message": "Contas DEV não podem ser excluídas"},
        )
    # ADMIN não exclui outro ADMIN — só DEV pode (evita escalonamento lateral).
    if "ADMIN" in target_roles and not is_dev:
        raise HTTPException(
            status_code=403,
            detail={"error": "forbidden", "message": "Apenas DEV pode excluir contas ADMIN"},
        )

    from app.services.account_deletion import anonymize_user

    reason_text = reason.strip() if reason else None
    anonymize_user(
        db,
        target,
        actor_user_id=current_user.id,
        reason="admin_action",
        extra_metadata={"admin_reason": reason_text},
    )
    db.commit()


# =============================================================================
# USERS — concessão/revogação do cargo AVISOS
# =============================================================================


class ToggleAvisosRequest(BaseModel):
    grant: bool  # True = conceder, False = revogar


@router.post("/users/{user_id}/toggle-avisos")
async def toggle_avisos_role(
    user_id: UUID,
    data: ToggleAvisosRequest,
    current_user: CurrentUser,
    db: DBSession,
) -> Any:
    """
    Concede ou revoga o cargo AVISOS de um usuário.
    Requer DEV, ADMIN ou ser coordenador do Conselho Geral.
    """
    global_roles = get_user_global_roles(db, current_user.id)
    if not any(r in global_roles for r in ["DEV", "ADMIN"]):
        if not is_conselho_geral_coordinator(db, current_user.id):
            raise HTTPException(
                status_code=403,
                detail={
                    "error": "forbidden",
                    "message": "Sem permissão para gerenciar o cargo Avisos",
                },
            )

    target = db.get(User, user_id)
    if not target or not target.is_active:
        raise HTTPException(
            status_code=404,
            detail={"error": "not_found", "message": "Usuário não encontrado"},
        )

    avisos_role = db.execute(
        select(GlobalRole).where(GlobalRole.code == "AVISOS")
    ).scalar_one_or_none()
    if not avisos_role:
        raise HTTPException(
            status_code=500,
            detail={
                "error": "config_error",
                "message": "Cargo AVISOS não configurado. Execute o seed novamente.",
            },
        )

    existing = db.execute(
        select(UserGlobalRole).where(
            UserGlobalRole.user_id == user_id,
            UserGlobalRole.global_role_id == avisos_role.id,
        )
    ).scalar_one_or_none()

    if data.grant and not existing:
        db.add(UserGlobalRole(user_id=user_id, global_role_id=avisos_role.id))
        db.commit()
    elif not data.grant and existing:
        db.delete(existing)
        db.commit()

    db.refresh(target)
    profile = target.profile
    email = target.identities[0].email if target.identities else None
    updated_roles = get_user_global_roles(db, user_id)

    return {
        "id": str(target.id),
        "name": profile.full_name if profile else None,
        "email": email,
        "photo_url": profile.photo_url if profile else None,
        "profile_status": profile.status if profile else "INCOMPLETE",
        "global_roles": updated_roles,
        "created_at": target.created_at.isoformat(),
    }


# =============================================================================
# DASHBOARD — métricas de governança
# =============================================================================


def _calc_age_ranges(birth_dates: list[Any]) -> list[dict[str, Any]]:
    """Agrupa datas de nascimento em faixas etárias."""
    today = datetime.now(timezone.utc).date()
    buckets: dict[str, int] = {
        "< 18": 0,
        "18-25": 0,
        "26-35": 0,
        "36-45": 0,
        "46-60": 0,
        "> 60": 0,
        "Não informado": 0,
    }
    for bd in birth_dates:
        if bd is None:
            buckets["Não informado"] += 1
            continue
        # Idade civil: ano a ano, descontando 1 se ainda não fez aniversário
        # (evita o erro de borda do antigo //365 com anos bissextos).
        age = today.year - bd.year - ((today.month, today.day) < (bd.month, bd.day))
        if age < 18:
            buckets["< 18"] += 1
        elif age <= 25:
            buckets["18-25"] += 1
        elif age <= 35:
            buckets["26-35"] += 1
        elif age <= 45:
            buckets["36-45"] += 1
        elif age <= 60:
            buckets["46-60"] += 1
        else:
            buckets["> 60"] += 1
    return [{"range": k, "count": v} for k, v in buckets.items()]


_UNIT_TYPE_LABELS = {
    "CONSELHO_GERAL": "Conselho Geral",
    "CONSELHO_EXECUTIVO": "Conselho Executivo",
    "SETOR": "Setor",
    "MINISTERIO": "Ministério",
    "GRUPO": "Grupo",
    "MISSAO": "Missão",
}

# k-anonimato da geografia: cidades com contagem abaixo deste limiar são
# agregadas numa linha "Outras (n cidades)" para não identificar indivíduos.
DASHBOARD_CITY_K_MIN = 3

_CITY_LOWER_WORDS = {"de", "da", "do", "das", "dos", "e"}


def _format_city(raw: str) -> str:
    """Capitaliza nome de cidade normalizado, mantendo conectivos em minúsculas."""
    words = raw.strip().split()
    out: list[str] = []
    for i, w in enumerate(words):
        lw = w.lower()
        out.append(lw if i > 0 and lw in _CITY_LOWER_WORDS else lw.capitalize())
    return " ".join(out)


@router.get("/dashboard")
async def get_dashboard(
    current_user: CurrentUser,
    db: DBSession,
) -> Any:
    """
    Retorna métricas consolidadas do aplicativo.
    Requer ADMIN, DEV ou ANALISTA.
    """
    require_admin_or_analista(db, current_user.id)

    now = datetime.now(timezone.utc)
    cutoff_7d = now - timedelta(days=7)
    cutoff_30d = now - timedelta(days=30)

    # Fase 1.1 (B/C): DEV é conta técnica → excluída de TODO o dashboard
    # (membros + métricas globais de usuário/perfil). Convites ficam de fora
    # da exclusão (são fluxo, não população). `_not_dev(col)` devolve o filtro
    # NOT IN (dev_ids); quando não há DEV, vira `true()` (no-op, sem warning).
    dev_ids = get_dev_user_ids(db)

    def _not_dev(col: Any) -> Any:
        return col.notin_(dev_ids) if dev_ids else true()

    # --- Usuários ---
    total_users = (
        db.execute(
            select(func.count(User.id)).where(
                User.is_active == True,  # noqa: E712
                _not_dev(User.id),
            )
        ).scalar()
        or 0
    )

    # Base alinhada com total_users: só perfis de usuários ativos,
    # para que a UI possa exibir "X de {total} (Z%)" com denominador coerente.
    complete_profiles = (
        db.execute(
            select(func.count(UserProfile.user_id))
            .join(User, UserProfile.user_id == User.id)
            .where(
                UserProfile.status == "COMPLETE",
                User.is_active == True,  # noqa: E712
                _not_dev(UserProfile.user_id),
            )
        ).scalar()
        or 0
    )

    new_7d = (
        db.execute(
            select(func.count(User.id)).where(
                User.is_active == True,  # noqa: E712
                User.created_at >= cutoff_7d,
                _not_dev(User.id),
            )
        ).scalar()
        or 0
    )

    new_30d = (
        db.execute(
            select(func.count(User.id)).where(
                User.is_active == True,  # noqa: E712
                User.created_at >= cutoff_30d,
                _not_dev(User.id),
            )
        ).scalar()
        or 0
    )

    # --- Faixas etárias ---
    birth_dates = (
        db.execute(select(UserProfile.birth_date).where(_not_dev(UserProfile.user_id)))
        .scalars()
        .all()
    )
    age_ranges = _calc_age_ranges(list(birth_dates))

    # --- Geografia ---
    # Normalização: agrupa por lower(trim(city)) para fundir variantes de
    # caixa/espaço; exclui NULL e string vazia. Supressão k-anonimato: cidades
    # com contagem < DASHBOARD_CITY_K_MIN viram uma linha agregada "Outras".
    city_norm = func.lower(func.trim(UserProfile.city))
    city_rows = db.execute(
        select(city_norm.label("city_key"), func.count(UserProfile.user_id).label("cnt"))
        .where(
            UserProfile.city.isnot(None),
            func.trim(UserProfile.city) != "",
            _not_dev(UserProfile.user_id),
        )
        .group_by(city_norm)
        .order_by(desc("cnt"))
    ).all()

    visible_cities = [r for r in city_rows if r[1] >= DASHBOARD_CITY_K_MIN][:10]
    suppressed_cities = [r for r in city_rows if r[1] < DASHBOARD_CITY_K_MIN]
    by_city = [{"city": _format_city(r[0]), "count": r[1]} for r in visible_cities]
    if suppressed_cities:
        n_suppressed = len(suppressed_cities)
        by_city.append(
            {
                "city": f"Outras ({n_suppressed} cidade{'s' if n_suppressed != 1 else ''})",
                "count": sum(r[1] for r in suppressed_cities),
            }
        )

    state_norm = func.upper(func.trim(UserProfile.state))
    state_rows = db.execute(
        select(state_norm.label("uf"), func.count(UserProfile.user_id).label("cnt"))
        .where(
            UserProfile.state.isnot(None),
            func.trim(UserProfile.state) != "",
            _not_dev(UserProfile.user_id),
        )
        .group_by(state_norm)
        .order_by(desc("cnt"))
        .limit(10)
    ).all()
    by_state = [{"state": r[0], "count": r[1]} for r in state_rows]

    # --- Catálogos ---
    def _catalog_breakdown(catalog_code: str, fk_col: Any) -> list[dict[str, Any]]:
        rows = db.execute(
            select(ProfileCatalogItem.label, func.count(fk_col).label("cnt"))
            .join(
                ProfileCatalog,
                ProfileCatalogItem.catalog_id == ProfileCatalog.id,
            )
            .join(
                UserProfile,
                fk_col == ProfileCatalogItem.id,
            )
            .where(ProfileCatalog.code == catalog_code, _not_dev(UserProfile.user_id))
            .group_by(ProfileCatalogItem.label)
            .order_by(desc("cnt"))
        ).all()
        return [{"label": r[0], "count": r[1]} for r in rows]

    by_life_state = _catalog_breakdown("LIFE_STATE", UserProfile.life_state_item_id)
    by_marital_status = _catalog_breakdown("MARITAL_STATUS", UserProfile.marital_status_item_id)
    by_vocational_reality = _catalog_breakdown(
        "VOCATIONAL_REALITY", UserProfile.vocational_reality_item_id
    )

    with_voc = (
        db.execute(
            select(func.count(UserProfile.user_id)).where(
                UserProfile.has_vocational_accompaniment == True,  # noqa: E712
                _not_dev(UserProfile.user_id),
            )
        ).scalar()
        or 0
    )

    without_voc = (
        db.execute(
            select(func.count(UserProfile.user_id)).where(
                UserProfile.has_vocational_accompaniment == False,  # noqa: E712
                _not_dev(UserProfile.user_id),
            )
        ).scalar()
        or 0
    )

    interested_ministry_count = (
        db.execute(
            select(func.count(UserProfile.user_id)).where(
                UserProfile.interested_in_ministry == True,  # noqa: E712
                _not_dev(UserProfile.user_id),
            )
        ).scalar()
        or 0
    )

    from_mission_count = (
        db.execute(
            select(func.count(UserProfile.user_id)).where(
                UserProfile.is_from_mission == True,  # noqa: E712
                _not_dev(UserProfile.user_id),
            )
        ).scalar()
        or 0
    )

    # --- Memberships --- (Fase 1.1 B3–B5: DEV não é membro real)
    total_active_memberships = (
        db.execute(
            select(func.count(OrgMembership.id)).where(
                OrgMembership.status == MembershipStatus.ACTIVE,
                _not_dev(OrgMembership.user_id),
            )
        ).scalar()
        or 0
    )

    # Pessoas distintas com vínculo ativo (≠ vínculos: uma pessoa em 3
    # unidades conta 1 aqui e 3 em total_active).
    people_active = (
        db.execute(
            select(func.count(func.distinct(OrgMembership.user_id))).where(
                OrgMembership.status == MembershipStatus.ACTIVE,
                _not_dev(OrgMembership.user_id),
            )
        ).scalar()
        or 0
    )

    unit_type_rows = db.execute(
        select(OrgUnit.type, func.count(OrgMembership.id).label("cnt"))
        .join(OrgUnit, OrgMembership.org_unit_id == OrgUnit.id)
        .where(
            OrgMembership.status == MembershipStatus.ACTIVE,
            _not_dev(OrgMembership.user_id),
        )
        .group_by(OrgUnit.type)
        .order_by(desc("cnt"))
    ).all()
    by_unit_type = [
        {
            "type": r[0].value,
            "label": _UNIT_TYPE_LABELS.get(r[0].value, r[0].value),
            "count": r[1],
        }
        for r in unit_type_rows
    ]

    # --- Convites ---
    # Todos os status num único GROUP BY; a taxa de aceitação é calculada
    # sobre RESOLVIDOS (aceitos + recusados) — pendentes/expirados/cancelados
    # não diluem a conversão real.
    invite_rows = db.execute(
        select(OrgInvite.status, func.count(OrgInvite.id)).group_by(OrgInvite.status)
    ).all()
    invite_counts = {row[0]: row[1] for row in invite_rows}
    accepted_invites = invite_counts.get(InviteStatus.ACCEPTED, 0)
    pending_invites = invite_counts.get(InviteStatus.PENDING, 0)
    declined_invites = invite_counts.get(InviteStatus.REJECTED, 0)
    expired_invites = invite_counts.get(InviteStatus.EXPIRED, 0)
    cancelled_invites = invite_counts.get(InviteStatus.CANCELLED, 0)
    total_invites = sum(invite_counts.values())
    resolved_invites = accepted_invites + declined_invites
    acceptance_rate = (
        round(accepted_invites / resolved_invites * 100, 1) if resolved_invites > 0 else 0.0
    )

    # --- Top ministérios ---
    # GROUP BY id (não name): ministérios homônimos em setores diferentes não
    # se fundem. sector_name (unidade pai) desambigua na UI. member_count
    # conta PESSOAS distintas, não vínculos.
    parent_unit = aliased(OrgUnit)
    top_ministry_rows = db.execute(
        select(
            OrgUnit.id,
            OrgUnit.name,
            parent_unit.name.label("sector_name"),
            func.count(func.distinct(OrgMembership.user_id)).label("cnt"),
        )
        .select_from(OrgMembership)
        .join(OrgUnit, OrgMembership.org_unit_id == OrgUnit.id)
        .join(parent_unit, OrgUnit.parent_id == parent_unit.id, isouter=True)
        .where(
            OrgUnit.type == OrgUnitType.MINISTERIO,
            OrgMembership.status == MembershipStatus.ACTIVE,
            _not_dev(OrgMembership.user_id),
        )
        .group_by(OrgUnit.id, OrgUnit.name, parent_unit.name)
        .order_by(desc("cnt"))
        .limit(10)
    ).all()
    top_ministries = [
        {"id": str(r[0]), "name": r[1], "sector_name": r[2], "member_count": r[3]}
        for r in top_ministry_rows
    ]

    return {
        "users": {
            "total": total_users,
            "complete_profiles": complete_profiles,
            "new_last_7d": new_7d,
            "new_last_30d": new_30d,
        },
        "age_ranges": age_ranges,
        "geography": {
            "by_city": by_city,
            "by_state": by_state,
        },
        "profile_breakdown": {
            "by_life_state": by_life_state,
            "by_marital_status": by_marital_status,
            "by_vocational_reality": by_vocational_reality,
            "with_vocational_accompaniment": with_voc,
            "without_vocational_accompaniment": without_voc,
            "interested_in_ministry": interested_ministry_count,
            "from_mission": from_mission_count,
        },
        "memberships": {
            "total_active": total_active_memberships,
            "people_active": people_active,
            "by_unit_type": by_unit_type,
        },
        "invites": {
            "total": total_invites,
            "accepted": accepted_invites,
            "pending": pending_invites,
            "declined": declined_invites,
            "expired": expired_invites,
            "cancelled": cancelled_invites,
            "acceptance_rate": acceptance_rate,
        },
        "top_ministries": top_ministries,
    }


# =============================================================================
# AUDIT LOGS
# =============================================================================


@router.get("/audit-logs")
async def get_audit_logs(
    current_user: CurrentUser,
    db: DBSession,
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    action: str = Query(default=None),
    actor_user_id: str = Query(default=None),
) -> Any:
    """
    Lista logs de auditoria com paginação.
    Requer ADMIN, DEV ou ANALISTA.
    """
    require_admin_or_analista(db, current_user.id)

    base = select(AuditLog)

    if action:
        base = base.where(AuditLog.action == action)
    if actor_user_id:
        try:
            parsed_id = UUID(actor_user_id)
        except ValueError:
            raise HTTPException(
                status_code=400,
                detail={"error": "invalid_param", "message": "actor_user_id inválido"},
            )
        base = base.where(AuditLog.actor_user_id == parsed_id)

    total = db.execute(select(func.count()).select_from(base.subquery())).scalar() or 0

    offset_val = (page - 1) * page_size
    rows = (
        db.execute(base.order_by(desc(AuditLog.created_at)).offset(offset_val).limit(page_size))
        .scalars()
        .all()
    )

    items = []
    for log in rows:
        actor_name: str | None = None
        if log.actor_user_id:
            actor_profile = db.execute(
                select(UserProfile).where(UserProfile.user_id == log.actor_user_id)
            ).scalar_one_or_none()
            actor_name = actor_profile.full_name if actor_profile else None

        items.append(
            {
                "id": str(log.id),
                "action": log.action,
                "actor_name": actor_name,
                "entity_type": log.entity_type,
                "entity_id": log.entity_id,
                "extra_data": log.extra_data,
                "created_at": log.created_at.isoformat(),
            }
        )

    return {
        "total": total,
        "page": page,
        "page_size": page_size,
        "items": items,
    }
