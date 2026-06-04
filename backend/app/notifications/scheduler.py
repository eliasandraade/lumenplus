"""
Scheduler de notificações.
APScheduler + PostgreSQL advisory lock garante execução em apenas UMA instância.
"""

import structlog
from datetime import datetime, timezone
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger

logger = structlog.get_logger()

_scheduler: AsyncIOScheduler | None = None

# Chave estável para o advisory lock — não mudar após o deploy
REVISION_REMINDER_LOCK_KEY = 1_872_634_901


def _is_first_friday_of_month() -> bool:
    """True se hoje é a 1ª sexta-feira do mês (dia ≤ 7 e weekday == 4)."""
    now = datetime.now(timezone.utc)
    return now.weekday() == 4 and now.day <= 7


def _run_revision_reminder_job() -> None:
    if not _is_first_friday_of_month():
        return

    from sqlalchemy import text
    from app.db.session import get_db_session
    from app.notifications.notification_service import notify_revision_reminder

    with get_db_session() as db:
        acquired = db.scalar(
            text("SELECT pg_try_advisory_lock(:key)").bindparams(key=REVISION_REMINDER_LOCK_KEY)
        )
        if not acquired:
            logger.info("scheduler_revision_skipped", reason="advisory_lock_not_acquired")
            return

        try:
            logger.info("scheduler_revision_reminder_start")
            notify_revision_reminder()
            logger.info("scheduler_revision_reminder_done")
        finally:
            db.scalar(
                text("SELECT pg_advisory_unlock(:key)").bindparams(key=REVISION_REMINDER_LOCK_KEY)
            )


def start_scheduler() -> None:
    global _scheduler
    _scheduler = AsyncIOScheduler(timezone="America/Fortaleza")
    _scheduler.add_job(
        _run_revision_reminder_job,
        CronTrigger(day_of_week="fri", hour=8, minute=0),
        id="revision_reminder",
        replace_existing=True,
    )
    _scheduler.start()
    logger.info("notification_scheduler_started")


def stop_scheduler() -> None:
    global _scheduler
    if _scheduler and _scheduler.running:
        _scheduler.shutdown(wait=False)
        logger.info("notification_scheduler_stopped")
