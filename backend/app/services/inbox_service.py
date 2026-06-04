"""
Inbox Service
=============
Serviço para gerenciamento de avisos/inbox.
"""

from datetime import datetime, timedelta, timezone
from typing import Any
from uuid import UUID

from sqlalchemy import select, func, and_, update, text
from sqlalchemy.engine import CursorResult
from sqlalchemy.orm import Session, joinedload

from app.db.models import (
    InboxMessage,
    InboxMessageAudit,
    InboxApprovalStatus,
    InboxRecipient,
    InboxMessageType,
    User,
    UserProfile,
    UserPermission,
    ProfileCatalogItem,
    OrgUnit,
    OrgMembership,
    OrgRoleCode,
    MembershipStatus,
)
from app.schemas.inbox import InboxFilters


# Constantes
INBOX_EXPIRATION_DAYS = 30
PERMISSION_SEND_INBOX = "CAN_SEND_INBOX"


class InboxService:
    """Serviço para operações de inbox."""

    def __init__(self, db: Session):
        self.db = db

    # === AUDITORIA ===

    def _create_audit_entry(
        self,
        message_id: UUID,
        action: str,
        actor_user_id: UUID,
        old_title: str | None = None,
        old_message: str | None = None,
        new_title: str | None = None,
        new_message: str | None = None,
        note: str | None = None,
    ) -> None:
        """Registra uma entrada de auditoria para uma mensagem."""
        audit = InboxMessageAudit(
            message_id=message_id,
            action=action,
            actor_user_id=actor_user_id,
            old_title=old_title,
            old_message=old_message,
            new_title=new_title,
            new_message=new_message,
            note=note,
        )
        self.db.add(audit)

    # === PERMISSÕES ===

    def user_has_permission(self, user_id: UUID, permission_code: str) -> bool:
        """Verifica se usuário tem uma permissão específica."""
        result = self.db.execute(
            select(UserPermission).where(
                UserPermission.user_id == user_id, UserPermission.permission_code == permission_code
            )
        ).scalar_one_or_none()
        return result is not None

    def get_user_permissions(self, user_id: UUID) -> list[str]:
        """Retorna lista de permissões do usuário."""
        result = (
            self.db.execute(
                select(UserPermission.permission_code).where(UserPermission.user_id == user_id)
            )
            .scalars()
            .all()
        )
        return list(result)

    def grant_permission(
        self, user_id: UUID, permission_code: str, granted_by_user_id: UUID | None = None
    ) -> UserPermission:
        """Concede uma permissão a um usuário."""
        permission = UserPermission(
            user_id=user_id,
            permission_code=permission_code,
            granted_by_user_id=granted_by_user_id,
        )
        self.db.add(permission)
        self.db.commit()
        self.db.refresh(permission)
        return permission

    def user_can_send(self, user_id: UUID) -> bool:
        """Retorna True se o usuário pode enviar avisos (CAN_SEND_INBOX OU coordenador de alguma OrgUnit)."""
        if self.user_has_permission(user_id, PERMISSION_SEND_INBOX):
            return True
        return self._coordinator_org_units(user_id) != []

    def _coordinator_org_units(self, user_id: UUID) -> list[OrgUnit]:
        """Retorna OrgUnits onde o usuário é coordenador ativo."""
        rows = (
            self.db.execute(
                select(OrgUnit)
                .join(OrgMembership, OrgMembership.org_unit_id == OrgUnit.id)
                .where(
                    OrgMembership.user_id == user_id,
                    OrgMembership.role == OrgRoleCode.COORDINATOR,
                    OrgMembership.status == MembershipStatus.ACTIVE,
                    OrgUnit.is_active,
                )
                .order_by(OrgUnit.name)
            )
            .scalars()
            .all()
        )
        return list(rows)

    def _get_org_subtree_ids(self, org_unit_id: UUID) -> list[UUID]:
        """
        Retorna o ID da OrgUnit raiz e todos os IDs dos descendentes (recursivo).
        Usa recursive CTE para percorrer a árvore de org_units.
        """
        cte_sql = text("""
            WITH RECURSIVE subtree AS (
                SELECT id FROM org_units WHERE id = :root_id
                UNION ALL
                SELECT ou.id FROM org_units ou
                INNER JOIN subtree st ON ou.parent_id = st.id
            )
            SELECT id FROM subtree
        """)
        rows = self.db.execute(cte_sql, {"root_id": str(org_unit_id)}).fetchall()
        return [row[0] for row in rows]

    def get_sendable_scopes(self, user_id: UUID) -> dict[str, Any]:
        """
        Retorna os escopos disponíveis para envio de aviso:
        - can_send_to_all: True se tem CAN_SEND_INBOX
        - scopes: lista de OrgUnits onde é coordenador (com contagem de membros)
        """
        can_send_to_all = self.user_has_permission(user_id, PERMISSION_SEND_INBOX)
        coordinator_units = self._coordinator_org_units(user_id)

        scopes = []
        for unit in coordinator_units:
            member_count = (
                self.db.execute(
                    select(func.count())
                    .select_from(OrgMembership)
                    .where(
                        OrgMembership.org_unit_id == unit.id,
                        OrgMembership.status == MembershipStatus.ACTIVE,
                    )
                ).scalar()
                or 0
            )
            scopes.append(
                {
                    "id": unit.id,
                    "name": unit.name,
                    "type": unit.type.value,
                    "member_count": member_count,
                }
            )

        return {"can_send_to_all": can_send_to_all, "scopes": scopes}

    def revoke_permission(self, user_id: UUID, permission_code: str) -> bool:
        """Remove uma permissão de um usuário."""
        result = self.db.execute(
            select(UserPermission).where(
                UserPermission.user_id == user_id, UserPermission.permission_code == permission_code
            )
        ).scalar_one_or_none()

        if result:
            self.db.delete(result)
            self.db.commit()
            return True
        return False

    # === LEITURA DE INBOX ===

    def get_user_inbox(
        self, user_id: UUID, include_read: bool = True, limit: int = 50, offset: int = 0
    ) -> tuple[list[dict[str, Any]], int, int]:
        """
        Retorna mensagens do inbox do usuário.
        Returns: (messages, total, unread_count)
        """
        now = datetime.now(timezone.utc)

        # Filtro de status válidos para exibição ao usuário
        _visible_statuses = [InboxApprovalStatus.APPROVED, InboxApprovalStatus.AUTO_APPROVED]

        # Query base
        base_query = (
            select(InboxRecipient, InboxMessage)
            .join(InboxMessage, InboxRecipient.message_id == InboxMessage.id)
            .where(
                InboxRecipient.user_id == user_id,
                InboxMessage.expires_at > now,
                InboxMessage.approval_status.in_(_visible_statuses),
                InboxMessage.is_deleted.is_(False),
            )
        )

        if not include_read:
            base_query = base_query.where(InboxRecipient.read.is_(False))

        # Ordenar por não lidos primeiro, depois por data
        base_query = base_query.order_by(InboxRecipient.read.asc(), InboxMessage.created_at.desc())

        # Contar total
        count_query = (
            select(func.count())
            .select_from(InboxRecipient)
            .join(InboxMessage, InboxRecipient.message_id == InboxMessage.id)
            .where(
                InboxRecipient.user_id == user_id,
                InboxMessage.expires_at > now,
                InboxMessage.approval_status.in_(_visible_statuses),
                InboxMessage.is_deleted.is_(False),
            )
        )
        total = self.db.execute(count_query).scalar() or 0

        # Contar não lidos
        unread_query = count_query.where(InboxRecipient.read.is_(False))
        unread_count = self.db.execute(unread_query).scalar() or 0

        # Buscar mensagens
        results = self.db.execute(base_query.limit(limit).offset(offset)).all()

        # Bulk-fetch sender names em uma única query (evita N+1)
        sender_ids = {msg.created_by_user_id for _, msg in results if msg.created_by_user_id}
        sender_names: dict[UUID, str] = {}
        if sender_ids:
            name_rows = self.db.execute(
                select(UserProfile.user_id, UserProfile.full_name).where(
                    UserProfile.user_id.in_(sender_ids)
                )
            ).all()
            sender_names = {r.user_id: r.full_name for r in name_rows if r.full_name}

        messages = []
        for recipient, message in results:
            sender_name = sender_names.get(message.created_by_user_id) or "Lumen+"
            messages.append(
                {
                    "id": str(recipient.id),
                    "message_id": str(message.id),
                    "title": message.title,
                    "message": message.message,
                    "type": message.type.value,
                    "read": recipient.read,
                    "read_at": recipient.read_at,
                    "created_at": message.created_at,
                    "expires_at": message.expires_at,
                    "attachments": message.attachments,
                    "sender_name": sender_name,
                }
            )

        return messages, total, unread_count

    def get_unread_messages(self, user_id: UUID, limit: int = 10) -> list[dict[str, Any]]:
        """Retorna apenas mensagens não lidas."""
        messages, _, _ = self.get_user_inbox(user_id, include_read=False, limit=limit)
        return messages

    def mark_as_read(self, user_id: UUID, recipient_id: UUID) -> bool:
        """
        Marca uma mensagem como lida.

        Retorna:
          True  — recipient encontrado (marcado agora ou já estava lido)
          False — recipient não existe ou não pertence ao usuário

        Idempotente: chamar múltiplas vezes no mesmo recipient é seguro.
        """
        recipient = self.db.execute(
            select(InboxRecipient).where(
                InboxRecipient.id == recipient_id, InboxRecipient.user_id == user_id
            )
        ).scalar_one_or_none()

        if not recipient:
            return False  # genuinamente não encontrado

        if not recipient.read:
            recipient.read = True
            recipient.read_at = datetime.now(timezone.utc)
            self.db.commit()

        return True  # encontrado — já lido ou recém-marcado

    def mark_all_as_read(self, user_id: UUID) -> int:
        """
        Marca todas as mensagens não expiradas como lidas.
        Usa UPDATE bulk em vez de loop para evitar N queries individuais.
        Retorna a quantidade de registros atualizados.
        """
        now = datetime.now(timezone.utc)

        # Subquery: IDs dos InboxRecipient elegíveis (não lidos, não expirados)
        eligible_ids_subq = (
            select(InboxRecipient.id)
            .join(InboxMessage, InboxRecipient.message_id == InboxMessage.id)
            .where(
                InboxRecipient.user_id == user_id,
                InboxRecipient.read.is_(False),
                InboxMessage.expires_at > now,
            )
        )

        # UPDATE único — uma roundtrip ao banco independente do volume
        cursor_result: CursorResult[Any] = self.db.execute(
            update(InboxRecipient)
            .where(InboxRecipient.id.in_(eligible_ids_subq))
            .values(read=True, read_at=now)
            .execution_options(synchronize_session="fetch")
        )

        self.db.commit()
        return cursor_result.rowcount

    # === ENVIO DE AVISOS ===

    def get_filter_options(self) -> dict[str, Any]:
        """Retorna opções disponíveis para filtros de segmentação."""
        # Realidades vocacionais
        vocational = (
            self.db.execute(
                select(ProfileCatalogItem)
                .join(ProfileCatalogItem.catalog)
                .where(ProfileCatalogItem.catalog.has(code="VOCATIONAL_REALITY"))
                .where(ProfileCatalogItem.is_active)
                .order_by(ProfileCatalogItem.sort_order)
            )
            .scalars()
            .all()
        )

        # Estados de vida
        life_states = (
            self.db.execute(
                select(ProfileCatalogItem)
                .join(ProfileCatalogItem.catalog)
                .where(ProfileCatalogItem.catalog.has(code="LIFE_STATE"))
                .where(ProfileCatalogItem.is_active)
                .order_by(ProfileCatalogItem.sort_order)
            )
            .scalars()
            .all()
        )

        # Estados civis
        marital = (
            self.db.execute(
                select(ProfileCatalogItem)
                .join(ProfileCatalogItem.catalog)
                .where(ProfileCatalogItem.catalog.has(code="MARITAL_STATUS"))
                .where(ProfileCatalogItem.is_active)
                .order_by(ProfileCatalogItem.sort_order)
            )
            .scalars()
            .all()
        )

        # Estados brasileiros — lista fixa dos 27 estados + DF
        all_br_states = [
            "AC",
            "AL",
            "AP",
            "AM",
            "BA",
            "CE",
            "DF",
            "ES",
            "GO",
            "MA",
            "MT",
            "MS",
            "MG",
            "PA",
            "PB",
            "PR",
            "PE",
            "PI",
            "RJ",
            "RN",
            "RS",
            "RO",
            "RR",
            "SC",
            "SP",
            "SE",
            "TO",
        ]

        # Cidades únicas dos perfis já cadastrados (cresce conforme usuários se cadastram)
        cities = (
            self.db.execute(
                select(UserProfile.city)
                .where(UserProfile.city.isnot(None))
                .distinct()
                .order_by(UserProfile.city)
            )
            .scalars()
            .all()
        )

        return {
            "vocational_realities": [{"code": v.code, "label": v.label} for v in vocational],
            "life_states": [{"code": ls.code, "label": ls.label} for ls in life_states],
            "marital_statuses": [{"code": m.code, "label": m.label} for m in marital],
            "states": all_br_states,
            "cities": list(cities),
        }

    def _get_recipient_user_ids(
        self,
        send_to_all: bool,
        filters: InboxFilters | None,
        scope_org_unit_id: UUID | None = None,
    ) -> list[UUID]:
        """
        Retorna lista de user_ids baseado nos filtros e escopo.
        Prioridade de escopo:
          1. scope_org_unit_id → membros ativos da OrgUnit e seus descendentes
          2. send_to_all → todos os usuários ativos
          3. filters (perfil) → subconjunto filtrado
        Filtros de perfil são aplicados cumulativamente sobre o escopo.
        """
        conditions: list[Any] = [User.is_active]
        query = select(User.id).join(UserProfile, User.id == UserProfile.user_id, isouter=True)

        if scope_org_unit_id:
            # Escopo restrito: membros ativos de toda a subárvore da OrgUnit
            org_ids = self._get_org_subtree_ids(scope_org_unit_id)
            member_subq = select(OrgMembership.user_id).where(
                OrgMembership.org_unit_id.in_([str(oid) for oid in org_ids]),
                OrgMembership.status == MembershipStatus.ACTIVE,
            )
            conditions.append(User.id.in_(member_subq))
        elif send_to_all:
            pass  # apenas User.is_active == True já está nos conditions
        else:
            # Sem escopo e sem send_to_all → necessita filtros de perfil
            if not filters:
                return []

        # Filtros de perfil adicionais (aplicados sobre qualquer escopo)
        if filters:
            if filters.vocational_reality_codes:
                subq = select(ProfileCatalogItem.id).where(
                    ProfileCatalogItem.code.in_(filters.vocational_reality_codes)
                )
                conditions.append(UserProfile.vocational_reality_item_id.in_(subq))

            if filters.life_state_codes:
                subq = select(ProfileCatalogItem.id).where(
                    ProfileCatalogItem.code.in_(filters.life_state_codes)
                )
                conditions.append(UserProfile.life_state_item_id.in_(subq))

            if filters.marital_status_codes:
                subq = select(ProfileCatalogItem.id).where(
                    ProfileCatalogItem.code.in_(filters.marital_status_codes)
                )
                conditions.append(UserProfile.marital_status_item_id.in_(subq))

            if filters.states:
                conditions.append(UserProfile.state.in_(filters.states))

            if filters.cities:
                conditions.append(UserProfile.city.in_(filters.cities))

        query = query.where(and_(*conditions))
        return list(self.db.execute(query).scalars().all())

    def preview_send(
        self,
        send_to_all: bool,
        filters: InboxFilters | None,
        scope_org_unit_id: UUID | None = None,
    ) -> int:
        """Retorna quantos usuários receberão o aviso."""
        user_ids = self._get_recipient_user_ids(send_to_all, filters, scope_org_unit_id)
        return len(user_ids)

    def send_message(
        self,
        title: str,
        message: str,
        message_type: str,
        created_by_user_id: UUID,
        send_to_all: bool,
        filters: InboxFilters | None = None,
        attachments: list[dict[str, Any]] | None = None,
        scope_org_unit_id: UUID | None = None,
        requires_approval: bool = False,
        # Novos parâmetros
        category: str | None = None,
        deep_link: str | None = None,
        action_label: str | None = None,
        priority: str = "NORMAL",
        critical_reason: str | None = None,
    ) -> tuple[UUID, int]:
        """
        Envia uma mensagem para os destinatários.
        Se requires_approval=True, a mensagem fica PENDING_APPROVAL e os recipients
        não são criados até aprovação.
        Returns: (message_id, recipient_count)
        """
        # Converter tipo
        try:
            msg_type = InboxMessageType(message_type)
        except ValueError:
            msg_type = InboxMessageType.INFO

        # Determinar status de aprovação
        approval_status = (
            InboxApprovalStatus.PENDING_APPROVAL
            if requires_approval
            else InboxApprovalStatus.AUTO_APPROVED
        )

        # Criar mensagem
        inbox_message = InboxMessage(
            title=title,
            message=message,
            type=msg_type,
            created_by_user_id=created_by_user_id,
            expires_at=datetime.now(timezone.utc) + timedelta(days=INBOX_EXPIRATION_DAYS),
            attachments=attachments,
            filters=filters.model_dump() if filters else None,
            target_org_unit_id=scope_org_unit_id,
            approval_status=approval_status,
            # Novos campos
            category=category,
            deep_link=deep_link,
            action_label=action_label,
            priority=priority,
        )
        self.db.add(inbox_message)
        self.db.flush()  # Para obter o ID

        # Calcular destinatários (sempre, para preview mesmo que pending)
        user_ids = self._get_recipient_user_ids(send_to_all, filters, scope_org_unit_id)

        if not requires_approval:
            # Criar recipients imediatamente
            for user_id in user_ids:
                recipient = InboxRecipient(
                    message_id=inbox_message.id,
                    user_id=user_id,
                )
                self.db.add(recipient)

        # Registrar auditoria de criação
        self._create_audit_entry(
            inbox_message.id,
            "CREATED",
            created_by_user_id,
            new_title=title,
            new_message=message,
        )

        if priority == "CRITICAL":
            from app.audit.service import create_audit_log
            create_audit_log(
                self.db,
                action="inbox_critical_sent",
                actor_user_id=created_by_user_id,
                entity_type="inbox_message",
                entity_id=str(inbox_message.id),
                metadata={
                    "title": title,
                    "recipient_count": len(user_ids),
                    "critical_reason": critical_reason,
                },
            )

        self.db.commit()

        return inbox_message.id, len(user_ids)

    def get_sent_messages(self, user_id: UUID, limit: int = 20) -> list[dict[str, Any]]:
        """Retorna mensagens enviadas por um usuário."""
        messages = (
            self.db.execute(
                select(InboxMessage)
                .options(
                    joinedload(InboxMessage.created_by).joinedload(User.profile),
                    joinedload(InboxMessage.target_org_unit),
                )
                .where(InboxMessage.created_by_user_id == user_id)
                .order_by(InboxMessage.created_at.desc())
                .limit(limit)
            )
            .scalars()
            .unique()
            .all()
        )

        result = []
        for msg in messages:
            # Contar destinatários
            recipient_count = (
                self.db.execute(
                    select(func.count())
                    .select_from(InboxRecipient)
                    .where(InboxRecipient.message_id == msg.id)
                ).scalar()
                or 0
            )

            # Contar lidos
            read_count = (
                self.db.execute(
                    select(func.count())
                    .select_from(InboxRecipient)
                    .where(InboxRecipient.message_id == msg.id, InboxRecipient.read)
                ).scalar()
                or 0
            )

            # Destino
            has_scope = msg.target_org_unit_id is not None
            has_filters = bool(msg.filters)
            sent_to_all = not has_scope and not has_filters
            target_org_unit_name = (
                msg.target_org_unit.name if has_scope and msg.target_org_unit else None
            )

            # Remetente (full_name está em UserProfile, não em User)
            sender = msg.created_by
            created_by_name = (
                sender.profile.full_name
                if sender and sender.profile and sender.profile.full_name
                else None
            )

            result.append(
                {
                    "id": str(msg.id),
                    "title": msg.title,
                    "message": msg.message,
                    "type": msg.type.value,
                    "created_at": msg.created_at,
                    "expires_at": msg.expires_at,
                    "recipient_count": recipient_count,
                    "read_count": read_count,
                    "filters": msg.filters,
                    "sent_to_all": sent_to_all,
                    "target_org_unit_name": target_org_unit_name,
                    "created_by_name": created_by_name,
                    "approval_status": msg.approval_status.value,
                }
            )

        return result

    # === APROVAÇÃO ===

    def get_pending_approvals(self, approver_id: UUID) -> list[dict[str, Any]]:
        """Retorna avisos pendentes de aprovação."""
        messages = (
            self.db.execute(
                select(InboxMessage)
                .options(
                    joinedload(InboxMessage.created_by).joinedload(User.profile),
                    joinedload(InboxMessage.target_org_unit),
                )
                .where(
                    InboxMessage.approval_status == InboxApprovalStatus.PENDING_APPROVAL,
                    InboxMessage.is_deleted.is_(False),
                )
                .order_by(InboxMessage.created_at.asc())
            )
            .scalars()
            .unique()
            .all()
        )
        result = []
        for msg in messages:
            sender = msg.created_by
            created_by_name = (
                sender.profile.full_name
                if sender and sender.profile and sender.profile.full_name
                else None
            )
            target_org_unit_name = (
                msg.target_org_unit.name if msg.target_org_unit else None
            )
            result.append(
                {
                    "id": str(msg.id),
                    "title": msg.title,
                    "message": msg.message,
                    "type": msg.type.value,
                    "created_at": msg.created_at,
                    "created_by_name": created_by_name,
                    "target_org_unit_name": target_org_unit_name,
                    "approval_status": msg.approval_status.value,
                }
            )
        return result

    def approve_message(
        self, message_id: UUID, approver_id: UUID, note: str | None = None
    ) -> int:
        """
        Aprova um aviso pendente e dispara os recipients.
        Retorna a quantidade de destinatários criados.
        Retorna -1 se a mensagem não existe, -2 se não está pendente.
        """
        msg = self.db.get(InboxMessage, message_id)
        if not msg:
            return -1
        if msg.approval_status != InboxApprovalStatus.PENDING_APPROVAL:
            return -2

        now = datetime.now(timezone.utc)
        msg.approval_status = InboxApprovalStatus.APPROVED
        msg.approver_user_id = approver_id
        msg.approved_at = now
        msg.approval_note = note

        # Recalcular destinatários a partir dos filtros armazenados
        send_to_all = msg.filters is None and msg.target_org_unit_id is None
        filters = InboxFilters(**msg.filters) if msg.filters else None
        user_ids = self._get_recipient_user_ids(send_to_all, filters, msg.target_org_unit_id)

        for user_id in user_ids:
            recipient = InboxRecipient(
                message_id=msg.id,
                user_id=user_id,
            )
            self.db.add(recipient)

        self._create_audit_entry(message_id, "APPROVED", approver_id, note=note)
        self.db.commit()
        return len(user_ids)

    def reject_message(
        self, message_id: UUID, rejector_id: UUID, note: str | None = None
    ) -> bool:
        """Reprova um aviso pendente."""
        msg = self.db.get(InboxMessage, message_id)
        if not msg or msg.approval_status != InboxApprovalStatus.PENDING_APPROVAL:
            return False

        msg.approval_status = InboxApprovalStatus.REJECTED
        msg.approver_user_id = rejector_id
        msg.approved_at = datetime.now(timezone.utc)
        msg.approval_note = note

        self._create_audit_entry(message_id, "REJECTED", rejector_id, note=note)
        self.db.commit()
        return True

    def get_message_audit(self, message_id: UUID) -> list[dict[str, Any]]:
        """Retorna a trilha de auditoria de uma mensagem."""
        audits = (
            self.db.execute(
                select(InboxMessageAudit)
                .options(joinedload(InboxMessageAudit.actor).joinedload(User.profile))
                .where(InboxMessageAudit.message_id == message_id)
                .order_by(InboxMessageAudit.created_at.asc())
            )
            .scalars()
            .unique()
            .all()
        )
        result = []
        for a in audits:
            actor = a.actor
            actor_name = (
                actor.profile.full_name
                if actor and actor.profile and actor.profile.full_name
                else None
            )
            result.append(
                {
                    "id": str(a.id),
                    "action": a.action,
                    "actor_name": actor_name,
                    "created_at": a.created_at,
                    "old_title": a.old_title,
                    "old_message": a.old_message,
                    "new_title": a.new_title,
                    "new_message": a.new_message,
                    "note": a.note,
                }
            )
        return result

    # === LIMPEZA ===

    def cleanup_expired_messages(self) -> int:
        """Remove mensagens expiradas. Retorna quantidade removida."""
        now = datetime.now(timezone.utc)

        expired = (
            self.db.execute(select(InboxMessage).where(InboxMessage.expires_at < now))
            .scalars()
            .all()
        )

        count = len(expired)
        for msg in expired:
            self.db.delete(msg)

        self.db.commit()
        return count
