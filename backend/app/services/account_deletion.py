"""
Anonimização de conta (LGPD art. 18, VI)
========================================
Lógica compartilhada entre a auto-exclusão (``DELETE /auth/me``) e a exclusão
administrativa (``DELETE /admin/users/{id}``).

Estratégia: anonimização (não exclusão da linha ``User``) para preservar os
registros de auditoria e os consentimentos aceitos, conforme obrigação legal de
retenção de 5 anos declarada na Política de Privacidade.

A função **não faz commit** — o chamador controla a transação.
"""

from typing import Any
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.models import User, UserPreferences


def anonymize_user(
    db: Session,
    user: User,
    actor_user_id: UUID,
    reason: str,
    extra_metadata: dict[str, Any] | None = None,
) -> None:
    """
    Anonimiza a conta ``user`` preservando a âncora de auditoria.

    Remove imediatamente:
    - ``UserProfile`` (CPF, RG e todos os dados pessoais)
    - ``UserPreferences``
    - ``OrgMembership`` e ``UserGlobalRole``
    - E-mail/``provider_uid`` anonimizados em ``UserIdentity``

    Retém (obrigação legal):
    - Linha ``User`` (``is_active=False``) — âncora para logs de auditoria
    - ``UserConsent`` — evidência de aceite dos termos (5 anos)
    - ``AuditLog`` — rastreabilidade de segurança (5 anos)

    :param actor_user_id: quem executou a exclusão (o próprio usuário ou um admin).
    :param reason: motivo curto/código (ex.: ``"user_request"`` ou ``"admin_action"``).
    :param extra_metadata: campos extras para o metadata do audit log.
    """
    from app.audit.service import create_audit_log

    user_id = user.id

    # 1. Perfil (CPF/RG criptografados e dados biográficos)
    if user.profile:
        db.delete(user.profile)

    # 2. Anonimiza identidades (user_id.hex garante unicidade entre usuários)
    anon = f"deleted+{user_id.hex}@deleted.invalid"
    for identity in user.identities:
        identity.email = anon
        identity.provider_uid = anon
        identity.email_verified = False

    # 3. Memberships e global roles
    for m in list(user.memberships):
        db.delete(m)
    for ugr in list(user.global_roles):
        db.delete(ugr)

    # 4. Preferências
    prefs = db.execute(
        select(UserPreferences).where(UserPreferences.user_id == user_id)
    ).scalar_one_or_none()
    if prefs:
        db.delete(prefs)

    # 5. Desativa conta
    user.is_active = False

    # 6. Registra a exclusão no audit log (sem dados pessoais)
    metadata: dict[str, Any] = {"reason": reason, "lgpd_art": "18_VI"}
    if extra_metadata:
        metadata.update(extra_metadata)

    create_audit_log(
        db=db,
        actor_user_id=actor_user_id,
        action="account_deleted",
        entity_type="user",
        entity_id=str(user_id),
        metadata=metadata,
    )
