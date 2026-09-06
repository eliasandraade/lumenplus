"""
Testes da camada de Web Push.
- send_web_push: sucesso / 410 / 404 / falha genérica / chave ausente (pywebpush mockado)
- notification_service._send_push_to_user: log SENT / remoção em 410 / sem subs
"""
import json

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.models import NotificationDeliveryLog, PushSubscription, User
from app.notifications import notification_service as ns
from app.notifications import push_service
from app.notifications.push_service import WebPushException


class _FakeResponse:
    def __init__(self, status_code: int) -> None:
        self.status_code = status_code


# ── send_web_push ───────────────────────────────────────────────────────────
def test_send_web_push_success(monkeypatch) -> None:
    monkeypatch.setattr(push_service.settings, "vapid_private_key", "PRIVATEKEY")
    captured: dict = {}

    def fake_webpush(**kwargs):
        captured.update(kwargs)
        return object()

    monkeypatch.setattr(push_service, "webpush", fake_webpush)

    ok, detail = push_service.send_web_push(
        "https://push.example.com/ep", "p256dh-key", "auth-key", {"title": "Hi"}
    )

    assert ok is True
    assert detail is None
    assert captured["data"] == json.dumps({"title": "Hi"})
    assert captured["subscription_info"] == {
        "endpoint": "https://push.example.com/ep",
        "keys": {"p256dh": "p256dh-key", "auth": "auth-key"},
    }
    assert captured["vapid_private_key"] == "PRIVATEKEY"


def test_send_web_push_410_marks_subscription_expired(monkeypatch) -> None:
    monkeypatch.setattr(push_service.settings, "vapid_private_key", "PRIVATEKEY")

    def fake_webpush(**kwargs):
        raise WebPushException("gone", response=_FakeResponse(410))

    monkeypatch.setattr(push_service, "webpush", fake_webpush)

    ok, detail = push_service.send_web_push("https://push.example.com/ep", "p", "a", {"x": 1})

    assert ok is False
    assert "410" in detail
    assert push_service.is_subscription_expired(detail) is True


def test_send_web_push_404_marks_subscription_expired(monkeypatch) -> None:
    # BUG-1: 404 também deve ser tratado como subscription removida.
    monkeypatch.setattr(push_service.settings, "vapid_private_key", "PRIVATEKEY")

    def fake_webpush(**kwargs):
        raise WebPushException("not found", response=_FakeResponse(404))

    monkeypatch.setattr(push_service, "webpush", fake_webpush)

    ok, detail = push_service.send_web_push("https://push.example.com/ep", "p", "a", {"x": 1})

    assert ok is False
    assert "404" in detail
    assert push_service.is_subscription_expired(detail) is True


def test_send_web_push_generic_failure_does_not_crash(monkeypatch) -> None:
    monkeypatch.setattr(push_service.settings, "vapid_private_key", "PRIVATEKEY")

    def fake_webpush(**kwargs):
        raise RuntimeError("boom")

    monkeypatch.setattr(push_service, "webpush", fake_webpush)

    ok, detail = push_service.send_web_push("https://push.example.com/ep", "p", "a", {"x": 1})

    assert ok is False
    assert detail == "RuntimeError"
    assert push_service.is_subscription_expired(detail) is False


def test_send_web_push_returns_error_when_private_key_missing(monkeypatch) -> None:
    monkeypatch.setattr(push_service.settings, "vapid_private_key", "")
    ok, detail = push_service.send_web_push("https://push.example.com/ep", "p", "a", {"x": 1})
    assert ok is False
    assert detail == "VAPID_PRIVATE_KEY not configured"


# ── notification_service._send_push_to_user ─────────────────────────────────
def test_send_push_to_user_success_logs_sent(db_session: Session, monkeypatch) -> None:
    user = User(is_active=True)
    db_session.add(user)
    db_session.flush()
    db_session.add(
        PushSubscription(user_id=user.id, endpoint="https://push/ok", p256dh="p", auth="a")
    )
    db_session.commit()

    monkeypatch.setattr(ns, "send_web_push", lambda *a, **k: (True, None))

    delivered = ns._send_push_to_user(
        db_session, user.id, {"url": "/y"}, notification_type="INBOX_NEW"
    )

    assert delivered is True
    remaining = db_session.scalars(
        select(PushSubscription).where(PushSubscription.user_id == user.id)
    ).all()
    assert len(remaining) == 1
    logs = db_session.scalars(
        select(NotificationDeliveryLog).where(NotificationDeliveryLog.user_id == user.id)
    ).all()
    assert len(logs) == 1
    assert logs[0].status == "SENT"
    assert logs[0].channel == "PUSH"
    assert logs[0].deep_link == "/y"


def test_send_push_to_user_410_removes_subscription_and_logs_failed(
    db_session: Session, monkeypatch
) -> None:
    user = User(is_active=True)
    db_session.add(user)
    db_session.flush()
    db_session.add(
        PushSubscription(user_id=user.id, endpoint="https://push/expired", p256dh="p", auth="a")
    )
    db_session.commit()

    monkeypatch.setattr(ns, "send_web_push", lambda *a, **k: (False, "WebPushException status=410"))

    delivered = ns._send_push_to_user(
        db_session, user.id, {"url": "/x"}, notification_type="INBOX_NEW"
    )

    assert delivered is False
    remaining = db_session.scalars(
        select(PushSubscription).where(PushSubscription.user_id == user.id)
    ).all()
    assert remaining == []
    logs = db_session.scalars(
        select(NotificationDeliveryLog).where(NotificationDeliveryLog.user_id == user.id)
    ).all()
    assert len(logs) == 1
    assert logs[0].status == "FAILED"


def test_send_push_to_user_404_removes_subscription(db_session: Session, monkeypatch) -> None:
    # BUG-1: 404 remove a subscription (não só 410).
    user = User(is_active=True)
    db_session.add(user)
    db_session.flush()
    db_session.add(
        PushSubscription(user_id=user.id, endpoint="https://push/gone404", p256dh="p", auth="a")
    )
    db_session.commit()

    monkeypatch.setattr(ns, "send_web_push", lambda *a, **k: (False, "WebPushException status=404"))

    delivered = ns._send_push_to_user(
        db_session, user.id, {"url": "/x"}, notification_type="INBOX_NEW"
    )

    assert delivered is False
    remaining = db_session.scalars(
        select(PushSubscription).where(PushSubscription.user_id == user.id)
    ).all()
    assert remaining == []


def test_send_push_to_user_no_subscriptions_returns_false(db_session: Session) -> None:
    user = User(is_active=True)
    db_session.add(user)
    db_session.flush()
    db_session.commit()

    delivered = ns._send_push_to_user(
        db_session, user.id, {"url": "/z"}, notification_type="INBOX_NEW"
    )

    assert delivered is False
    logs = db_session.scalars(
        select(NotificationDeliveryLog).where(NotificationDeliveryLog.user_id == user.id)
    ).all()
    assert logs == []
