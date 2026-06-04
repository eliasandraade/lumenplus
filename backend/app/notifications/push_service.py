"""Web Push via pywebpush (VAPID)."""

import json
import structlog
from pywebpush import webpush, WebPushException
from app.settings import settings

logger = structlog.get_logger()


def send_web_push(endpoint: str, p256dh: str, auth: str, payload: dict) -> tuple[bool, str | None]:
    """
    Envia Web Push.
    Retorna (True, None) em sucesso.
    Retorna (False, error_detail) em falha.
    """
    if not settings.vapid_private_key:
        return False, "VAPID_PRIVATE_KEY not configured"

    try:
        webpush(
            subscription_info={"endpoint": endpoint, "keys": {"p256dh": p256dh, "auth": auth}},
            data=json.dumps(payload),
            vapid_private_key=settings.vapid_private_key,
            vapid_claims={"sub": settings.vapid_email},
        )
        return True, None
    except WebPushException as e:
        status = e.response.status_code if e.response else None
        detail = f"WebPushException status={status}"
        logger.warning("web_push_failed", endpoint=endpoint[:40], status=status)
        return False, detail
    except Exception as exc:
        detail = f"{type(exc).__name__}"
        logger.exception("web_push_unexpected_error", endpoint=endpoint[:40])
        return False, detail


def is_subscription_expired(error_detail: str | None) -> bool:
    """True se o erro indica subscription expirada (410 Gone)."""
    return error_detail is not None and "410" in error_detail
