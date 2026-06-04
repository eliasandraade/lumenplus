"""
NotificationService
===================
Orquestra Web Push + e-mail com delivery log.
Estratégia de entrega determinada por priority:
  LOW      → somente Inbox; sem push, sem e-mail
  NORMAL   → push; e-mail se push falhou
  HIGH     → push; e-mail sempre
  CRITICAL → push (ignora opt-in); e-mail sempre
"""

import structlog
from sqlalchemy import select

from app.db.session import get_db_session
from app.db.models import (
    NotificationDeliveryLog,
    PushSubscription,
    UserIdentity,
    UserPreferences,
)
from app.notifications.push_service import send_web_push, is_subscription_expired
from app.notifications.email_service import (
    send_email,
    build_inbox_email,
    build_revision_reminder_email,
)

logger = structlog.get_logger()


class NotificationType:
    INBOX_NEW = "INBOX_NEW"
    REVISION_REMINDER = "REVISION_REMINDER"
    CYCLE_STARTED = "CYCLE_STARTED"
    CYCLE_ENDING_SOON = "CYCLE_ENDING_SOON"
    CYCLE_ARCHIVED = "CYCLE_ARCHIVED"
    GOAL_EXPIRING = "GOAL_EXPIRING"
    SEMESTER_REVIEW = "SEMESTER_REVIEW"
    CHANNEL_NEW_POST = "CHANNEL_NEW_POST"
    CHANNEL_NEW_REPLY = "CHANNEL_NEW_REPLY"
    CHANNEL_MENTION = "CHANNEL_MENTION"


class NotificationChannel:
    PUSH = "PUSH"
    EMAIL = "EMAIL"


class NotificationStatus:
    SENT = "SENT"
    FAILED = "FAILED"


class NotificationPriority:
    LOW = "LOW"
    NORMAL = "NORMAL"
    HIGH = "HIGH"
    CRITICAL = "CRITICAL"


def _should_send_push(priority: str, push_opted_in: bool) -> bool:
    """CRITICAL bypassa opt-in; LOW nunca envia push."""
    if priority == NotificationPriority.CRITICAL:
        return True
    if priority == NotificationPriority.LOW:
        return False
    return push_opted_in


def _should_send_email(priority: str, push_delivered: bool) -> bool:
    """LOW nunca envia e-mail. HIGH/CRITICAL sempre enviam. NORMAL só se push falhou."""
    if priority == NotificationPriority.LOW:
        return False
    if priority in (NotificationPriority.HIGH, NotificationPriority.CRITICAL):
        return True
    return not push_delivered


def _log_delivery(db, user_id, notification_type: str, channel: str, status: str,
                  inbox_message_id=None, deep_link=None, error_detail=None) -> None:
    log = NotificationDeliveryLog(
        user_id=user_id,
        notification_type=notification_type,
        channel=channel,
        status=status,
        inbox_message_id=inbox_message_id,
        deep_link=deep_link,
        error_detail=error_detail,
    )
    db.add(log)


def _get_user_email(db, user_id) -> str | None:
    identity = db.scalars(
        select(UserIdentity).where(UserIdentity.user_id == user_id)
    ).first()
    if identity and hasattr(identity, "email"):
        return identity.email
    return None


def _push_opted_in(db, user_id) -> bool:
    prefs = db.scalars(
        select(UserPreferences).where(UserPreferences.user_id == user_id)
    ).first()
    return prefs.push_opt_in if prefs else True


def _send_push_to_user(db, user_id, payload: dict, notification_type: str,
                       inbox_message_id=None) -> bool:
    """Envia push a todas as subscriptions do usuário. Retorna True se ao menos uma entregue."""
    subs = db.scalars(
        select(PushSubscription).where(PushSubscription.user_id == user_id)
    ).all()
    if not subs:
        return False

    delivered = False
    for sub in subs:
        ok, error_detail = send_web_push(sub.endpoint, sub.p256dh, sub.auth, payload)
        _log_delivery(
            db, user_id,
            notification_type=notification_type,
            channel=NotificationChannel.PUSH,
            status=NotificationStatus.SENT if ok else NotificationStatus.FAILED,
            inbox_message_id=inbox_message_id,
            deep_link=payload.get("url"),
            error_detail=error_detail,
        )
        if ok:
            delivered = True
        elif is_subscription_expired(error_detail):
            db.delete(sub)

    db.commit()
    return delivered


def notify_new_inbox(
    user_ids: list,
    title: str,
    message: str,
    inbox_message_id: str | None = None,
    deep_link: str | None = None,
    action_label: str | None = None,
    priority: str = NotificationPriority.NORMAL,
) -> None:
    """
    Chamado como BackgroundTask — abre sua própria sessão DB.
    LOW → somente Inbox (sem push, sem e-mail).
    """
    push_payload = {
        "type": NotificationType.INBOX_NEW,
        "title": f"📢 {title}",
        "body": message[:120] + ("..." if len(message) > 120 else ""),
        "url": deep_link or "/",
        "action": action_label,
    }
    cta_text = action_label or "Ver mais"
    email_html = build_inbox_email(title, message, deep_link, cta_text=cta_text)

    with get_db_session() as db:
        for user_id in user_ids:
            try:
                opted_in = _push_opted_in(db, user_id)
                should_push = _should_send_push(priority, opted_in)

                pushed = False
                if should_push:
                    pushed = _send_push_to_user(
                        db, user_id, push_payload,
                        notification_type=NotificationType.INBOX_NEW,
                        inbox_message_id=inbox_message_id,
                    )

                if _should_send_email(priority, pushed):
                    email = _get_user_email(db, user_id)
                    if email:
                        ok, error_detail = send_email(email, f"📢 {title}", email_html)
                        _log_delivery(
                            db, user_id,
                            notification_type=NotificationType.INBOX_NEW,
                            channel=NotificationChannel.EMAIL,
                            status=NotificationStatus.SENT if ok else NotificationStatus.FAILED,
                            inbox_message_id=inbox_message_id,
                            deep_link=deep_link,
                            error_detail=error_detail,
                        )
                        db.commit()

                logger.info("notify_inbox_sent", user_id=str(user_id), priority=priority, pushed=pushed)
            except Exception:
                logger.exception("notify_inbox_user_error", user_id=str(user_id))


def notify_revision_reminder() -> None:
    """
    Chamado pelo scheduler na 1ª sexta-feira do mês.
    Abre sua própria sessão DB.
    """
    from app.db.models import LifePlanCycle

    push_payload = {
        "type": NotificationType.REVISION_REMINDER,
        "title": "🙏 Revisão Mensal do Projeto de Vida",
        "body": "É hora de fazer sua revisão mensal. Toque para acessar.",
        "url": "/vida",
        "action": None,
    }
    email_html = build_revision_reminder_email()
    priority = NotificationPriority.NORMAL

    with get_db_session() as db:
        cycles = db.scalars(
            select(LifePlanCycle).where(LifePlanCycle.status == "ACTIVE")
        ).all()

        for cycle in cycles:
            user_id = cycle.user_id
            try:
                opted_in = _push_opted_in(db, user_id)
                should_push = _should_send_push(priority, opted_in)

                pushed = False
                if should_push:
                    pushed = _send_push_to_user(
                        db, user_id, push_payload,
                        notification_type=NotificationType.REVISION_REMINDER,
                    )

                if _should_send_email(priority, pushed):
                    email = _get_user_email(db, user_id)
                    if email:
                        ok, error_detail = send_email(
                            email, "🙏 Lembrete: Revisão Mensal do Projeto de Vida", email_html
                        )
                        _log_delivery(
                            db, user_id,
                            notification_type=NotificationType.REVISION_REMINDER,
                            channel=NotificationChannel.EMAIL,
                            status=NotificationStatus.SENT if ok else NotificationStatus.FAILED,
                            deep_link="/vida",
                            error_detail=error_detail,
                        )
                        db.commit()

                logger.info("notify_revision_sent", user_id=str(user_id), pushed=pushed)
            except Exception:
                logger.exception("notify_revision_user_error", user_id=str(user_id))
