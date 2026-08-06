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

from datetime import datetime, timezone
from typing import Any
from uuid import UUID

from sqlalchemy import delete as sa_delete, select, update as sa_update
from sqlalchemy.orm import Session

from app.db.models import (
    ChannelPost,
    ChannelReply,
    DataExportRequest,
    EmailVerification,
    LifePlanCycle,
    PhoneVerification,
    ProjetoVidaMensal,
    PushSubscription,
    User,
    UserBlock,
    UserPermission,
    UserPreferences,
)

# MATRIZ DE DADOS — derivada das 45 FKs que apontam para users.id.
#
# Tabelas cujas linhas são APAGADAS: contêm dado pessoal e não têm base legal
# de retenção. Cada uma está aqui por um motivo concreto:
#   phone_verifications  → guarda o telefone em claro (phone_e164)
#   email_verifications  → guarda o e-mail em claro
#   push_subscriptions   → sem isto a conta excluída CONTINUA recebendo push
#   life_plan_cycles     → realidade vocacional
#   projetos_vida_mensal → tema e intenções espirituais do usuário
#   user_blocks          → bloqueios referenciando conta inexistente
#   user_permissions     → autoridade residual numa conta excluída
#   data_export_requests → aponta para arquivos de exportação com PII
_PURGE = (
    (PhoneVerification, PhoneVerification.user_id),
    (EmailVerification, EmailVerification.user_id),
    (PushSubscription, PushSubscription.user_id),
    (LifePlanCycle, LifePlanCycle.user_id),
    (ProjetoVidaMensal, ProjetoVidaMensal.user_id),
    (UserPermission, UserPermission.user_id),
    (DataExportRequest, DataExportRequest.requested_by),
)


def anonymize_user(
    db: Session,
    user: User,
    actor_user_id: UUID,
    reason: str,
    extra_metadata: dict[str, Any] | None = None,
) -> None:
    """
    Anonimiza a conta ``user`` preservando a âncora de auditoria.

    APAGA:
    - ``UserProfile`` (CPF, RG e todos os dados biográficos)
    - ``UserPreferences``
    - ``OrgMembership`` e ``UserGlobalRole``
    - ``PhoneVerification`` (telefone em claro) e ``EmailVerification``
    - ``PushSubscription`` — senão a conta excluída continua recebendo push
    - ``LifePlanCycle`` e ``ProjetoVidaMensal`` (intenções espirituais)
    - ``UserPermission`` (autoridade residual)
    - ``UserBlock`` nas duas direções
    - ``DataExportRequest`` (aponta para arquivos de exportação com PII)

    OCULTA (soft delete, para não quebrar threads de terceiros):
    - ``ChannelPost`` e ``ChannelReply`` de autoria do usuário

    ANONIMIZA:
    - ``UserIdentity``: e-mail e ``provider_uid`` — o login deixa de resolver
      para esta conta, então não há como reentrar nela

    RETÉM (obrigação legal, 5 anos, declarado na Política de Privacidade):
    - Linha ``User`` (``is_active=False``) — âncora de integridade referencial
    - ``UserConsent`` — a evidência de aceite é ela própria registro legal
    - ``audit_log`` — rastreabilidade de segurança
    - ``RetreatRegistration`` — registro financeiro//de pagamento. Fica órfã de
      PII: o perfil que a identificava foi apagado.

    .. warning::
       ``DataExportRequest.file_path`` é removido do banco, mas o ARQUIVO em
       si vive fora da transação. A remoção do arquivo é tarefa operacional —
       ver ``docs/store-readiness/account-deletion-data-map.md``.

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

    # 4a. Dados pessoais que sobreviviam à exclusão. Sem isto o telefone
    # (phone_verifications.phone_e164) e o e-mail (email_verifications.email)
    # permaneciam em claro depois de o titular pedir a eliminação, e a conta
    # excluída continuava recebendo notificação push.
    for model, column in _PURGE:
        db.execute(sa_delete(model).where(column == user_id))

    # 4b. Bloqueios nas DUAS direções — a linha é irrelevante depois que uma
    # das pontas deixa de existir, e manter só um lado deixaria bloqueio órfão.
    db.execute(
        sa_delete(UserBlock).where(
            (UserBlock.blocker_user_id == user_id) | (UserBlock.blocked_user_id == user_id)
        )
    )

    # 4c. UGC — App Store 5.1.1(v) espera que o conteúdo da conta saia do ar.
    # Soft delete (e não DELETE) para não quebrar threads de terceiros: as
    # respostas de outros membros continuam existindo e legíveis no contexto.
    now = datetime.now(timezone.utc)
    for model in (ChannelPost, ChannelReply):
        db.execute(
            sa_update(model)
            .where(model.author_user_id == user_id, model.deleted_at.is_(None))
            .values(deleted_at=now, delete_reason="account_deleted")
        )

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
