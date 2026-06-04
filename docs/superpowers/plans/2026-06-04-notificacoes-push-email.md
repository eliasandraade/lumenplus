# Sistema de Notificações — Implementation Plan (v2)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **Revisão arquitetural:** `docs/superpowers/plans/2026-06-04-revisao-arquitetural.md`

**Goal:** Sistema oficial de comunicação da Obra — Web Push + e-mail (fallback), deep links, tipos de aviso semânticos, confirmação de leitura (já existe em InboxRecipient), delivery log para LGPD, lembrete mensal do Projeto de Vida com lock anti-duplicação multi-instância.

**Architecture:**
- `InboxMessage` ganha `category` (semântico) e `deep_link`
- `push_subscriptions` armazena subscriptions Web Push por usuário
- `notification_delivery_log` registra cada envio (canal, status, tipo) — auditoria LGPD
- `NotificationService` usa FastAPI `BackgroundTasks` → não bloqueia o HTTP
- APScheduler com `pg_try_advisory_lock` → safe em múltiplas instâncias Railway
- Frontend: card de permissão com ação explícita (não auto-request na montagem)
- E-mail envia apenas título + resumo (200 chars) + CTA — conteúdo completo fica no app

**Tech Stack:** FastAPI + APScheduler + pywebpush + SendGrid, PostgreSQL advisory lock, Service Worker (Expo web), AsyncStorage para persistir decisão do usuário sobre push.

---

## File Map

### Backend — novos
| Arquivo | Responsabilidade |
|---|---|
| `backend/app/api/push_routes.py` | VAPID public key, subscribe, unsubscribe |
| `backend/app/notifications/push_service.py` | Web Push via pywebpush |
| `backend/app/notifications/email_service.py` | SendGrid — título + resumo + CTA |
| `backend/app/notifications/notification_service.py` | Orquestra push+email + delivery log |
| `backend/app/notifications/scheduler.py` | APScheduler + pg_try_advisory_lock |
| `backend/alembic/versions/037_inbox_category_deeplink.py` | `category` + `deep_link` em inbox_messages |
| `backend/alembic/versions/038_push_notifications.py` | push_subscriptions + notification_delivery_log |

### Backend — modificados
| Arquivo | O que muda |
|---|---|
| `backend/app/db/models.py` | `PushSubscription`, `NotificationDeliveryLog`, campos em `InboxMessage` |
| `backend/app/settings.py` | VAPID + SendGrid settings |
| `backend/app/main.py` | push_router + scheduler start/stop |
| `backend/app/api/inbox_routes.py` | BackgroundTasks + deep_link + category no envio |
| `backend/app/db/session.py` | `get_db_session` context manager (se não existir) |

### Frontend — novos
| Arquivo | Responsabilidade |
|---|---|
| `lumen_mobile/public/sw.js` | Service Worker Web Push |
| `lumen_mobile/src/services/push.ts` | Permissão, registro, revogação |
| `lumen_mobile/src/components/PushPermissionCard.tsx` | Card de solicitação de permissão |

### Frontend — modificados
| Arquivo | O que muda |
|---|---|
| `lumen_mobile/app/(tabs)/home.tsx` | Exibe PushPermissionCard se necessário |
| `lumen_mobile/app/admin/create-aviso.tsx` | Seletor `category` + campo `deep_link` |

---

## Task 1: Settings — VAPID e SendGrid

**Files:**
- Modify: `backend/app/settings.py`

- [ ] **Step 1: Adicionar campos ao `Settings`**

No bloco `# INTEGRATIONS` de `backend/app/settings.py`, adicionar após `sentry_dsn`:

```python
# Web Push (VAPID)
vapid_private_key: str = Field(default="")
vapid_public_key: str = Field(default="")
vapid_email: str = Field(default="mailto:admin@example.com")

# E-mail transacional (SendGrid)
sendgrid_api_key: str = Field(default="")
sendgrid_from_email: str = Field(default="noreply@example.com")
sendgrid_from_name: str = Field(default="Lumen+")
```

- [ ] **Step 2: Gerar chaves VAPID localmente**

```bash
cd backend
pip install pywebpush
python -c "
from py_vapid import Vapid
v = Vapid()
v.generate_keys()
print('VAPID_PRIVATE_KEY=' + v.private_key_to_str())
print('VAPID_PUBLIC_KEY=' + v.public_key_str())
"
```

Expected: duas strings base64url. Salvar com segurança — a chave privada nunca vai para o repositório.

- [ ] **Step 3: Adicionar variáveis ao `.env` local e ao Railway**

No `backend/.env` (não commitar):
```
VAPID_PRIVATE_KEY=<gerada no step 2>
VAPID_PUBLIC_KEY=<gerada no step 2>
VAPID_EMAIL=mailto:oeliasandraade@gmail.com
SENDGRID_API_KEY=<do painel SendGrid — deixar vazio para usar mock>
SENDGRID_FROM_EMAIL=noreply@lumenmobile.vercel.app
SENDGRID_FROM_NAME=Lumen+
```

No Railway (produção): adicionar as mesmas variáveis via painel → serviço `backend` → Variables.

- [ ] **Step 4: Verificar que Settings carrega sem erros**

```bash
cd backend && python -c "from app.settings import settings; print('VAPID configurado:', bool(settings.vapid_public_key))"
```

- [ ] **Step 5: Commit**

```bash
git add backend/app/settings.py
git commit -m "feat(notif): adiciona VAPID e SendGrid settings"
```

---

## Task 2: Migration 037 — InboxMessage category e deep_link

**Files:**
- Create: `backend/alembic/versions/037_inbox_category_deeplink.py`

- [ ] **Step 1: Verificar o head atual**

```bash
cd backend && python -c "
from alembic.config import Config
from alembic.script import ScriptDirectory
cfg = Config('alembic.ini')
s = ScriptDirectory.from_config(cfg)
print('Head:', s.get_current_head())
"
```

Ajustar `down_revision` no arquivo abaixo conforme resultado.

- [ ] **Step 2: Criar a migration**

```python
# backend/alembic/versions/037_inbox_category_deeplink.py
"""add category and deep_link to inbox_messages

Revision ID: 037
Revises: 036
Create Date: 2026-06-04
"""

from alembic import op
import sqlalchemy as sa

revision = "037"
down_revision = "036"
branch_labels = None
depends_on = None

# Valores válidos para category:
# GENERAL, EVENT, RETREAT, FORMATION, SURVEY, ALERT
# Mantidos como Text para facilitar extensão futura sem migration.


def upgrade() -> None:
    op.add_column(
        "inbox_messages",
        sa.Column(
            "category",
            sa.Text(),
            nullable=True,  # nullable: mensagens antigas ficam sem categoria
        ),
    )
    op.add_column(
        "inbox_messages",
        sa.Column(
            "deep_link",
            sa.Text(),
            nullable=True,
            comment="Deep link interno no app, ex: /retreats/123, /vida, /channel/abc",
        ),
    )
    op.add_column(
        "inbox_messages",
        sa.Column(
            "action_label",
            sa.Text(),
            nullable=True,
            comment="Texto do CTA contextualizado, ex: 'Inscrever-se', 'Abrir Canal'. None -> 'Ver mais'",
        ),
    )
    # priority: estratégia de entrega (independente de type e category)
    # LOW=somente email | NORMAL=push+email fallback | HIGH=push+email sempre | CRITICAL=bypass opt-in+email sempre
    op.add_column(
        "inbox_messages",
        sa.Column(
            "priority",
            sa.Text(),
            nullable=False,
            server_default="NORMAL",
        ),
    )
    # Indexes para futuras queries por categoria e prioridade
    op.create_index("idx_inbox_messages_category", "inbox_messages", ["category"])
    op.create_index("idx_inbox_messages_priority", "inbox_messages", ["priority"])


def downgrade() -> None:
    op.drop_index("idx_inbox_messages_priority", table_name="inbox_messages")
    op.drop_index("idx_inbox_messages_category", table_name="inbox_messages")
    op.drop_column("inbox_messages", "priority")
    op.drop_column("inbox_messages", "action_label")
    op.drop_column("inbox_messages", "deep_link")
    op.drop_column("inbox_messages", "category")
```

- [ ] **Step 3: Rodar a migration**

```bash
cd backend && alembic upgrade head
```

Expected: `Running upgrade 036 -> 037, add category and deep_link to inbox_messages`

- [ ] **Step 4: Commit**

```bash
git add backend/alembic/versions/037_inbox_category_deeplink.py
git commit -m "feat(notif): migration 037 — category e deep_link em inbox_messages"
```

---

## Task 3: Migration 038 — push_subscriptions e notification_delivery_log

**Files:**
- Create: `backend/alembic/versions/038_push_notifications.py`

- [ ] **Step 1: Criar a migration**

```python
# backend/alembic/versions/038_push_notifications.py
"""add push_subscriptions and notification_delivery_log

Revision ID: 038
Revises: 037
Create Date: 2026-06-04
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

revision = "038"
down_revision = "037"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ── push_subscriptions ────────────────────────────────────────────────────
    op.create_table(
        "push_subscriptions",
        sa.Column("id", UUID(as_uuid=True), primary_key=True,
                  server_default=sa.text("gen_random_uuid()")),
        sa.Column("user_id", UUID(as_uuid=True),
                  sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("endpoint", sa.Text(), nullable=False),
        sa.Column("p256dh", sa.Text(), nullable=False),
        sa.Column("auth", sa.Text(), nullable=False),
        sa.Column("user_agent", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True),
                  server_default=sa.text("now()")),
    )
    op.create_index("idx_push_subscriptions_user_id", "push_subscriptions", ["user_id"])
    op.create_unique_constraint("uq_push_subscriptions_endpoint", "push_subscriptions", ["endpoint"])

    # ── notification_delivery_log ─────────────────────────────────────────────
    # Registra cada tentativa de entrega para auditoria LGPD.
    # notification_type: INBOX_NEW | REVISION_REMINDER | CYCLE_STARTED | CYCLE_ENDING_SOON | ...
    # channel: PUSH | EMAIL
    # status: SENT | FAILED
    op.create_table(
        "notification_delivery_log",
        sa.Column("id", UUID(as_uuid=True), primary_key=True,
                  server_default=sa.text("gen_random_uuid()")),
        sa.Column("user_id", UUID(as_uuid=True),
                  sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("notification_type", sa.Text(), nullable=False),
        sa.Column("channel", sa.Text(), nullable=False),  # PUSH | EMAIL
        sa.Column("status", sa.Text(), nullable=False),   # SENT | FAILED
        sa.Column("inbox_message_id", UUID(as_uuid=True),
                  sa.ForeignKey("inbox_messages.id", ondelete="SET NULL"), nullable=True),
        sa.Column("deep_link", sa.Text(), nullable=True),
        sa.Column("error_detail", sa.Text(), nullable=True),
        sa.Column("sent_at", sa.DateTime(timezone=True),
                  server_default=sa.text("now()")),
    )
    op.create_index("idx_notif_delivery_user_id", "notification_delivery_log", ["user_id"])
    op.create_index("idx_notif_delivery_sent_at", "notification_delivery_log", ["sent_at"])
    op.create_index("idx_notif_delivery_inbox_msg", "notification_delivery_log", ["inbox_message_id"])


def downgrade() -> None:
    op.drop_table("notification_delivery_log")
    op.drop_table("push_subscriptions")
```

- [ ] **Step 2: Rodar a migration**

```bash
cd backend && alembic upgrade head
```

Expected: `Running upgrade 037 -> 038, add push_subscriptions and notification_delivery_log`

- [ ] **Step 3: Commit**

```bash
git add backend/alembic/versions/038_push_notifications.py
git commit -m "feat(notif): migration 038 — push_subscriptions + notification_delivery_log"
```

---

## Task 4: Modelos SQLAlchemy

**Files:**
- Modify: `backend/app/db/models.py`

- [ ] **Step 1: Adicionar campos em `InboxMessage`**

Localizar a classe `InboxMessage` (linha ~732) e adicionar após o campo `attachments`:

```python
    category: Mapped[str | None] = mapped_column(Text, nullable=True)
    # GENERAL, EVENT, RETREAT, FORMATION, SURVEY, ALERT — None = GENERAL para msgs antigas
    deep_link: Mapped[str | None] = mapped_column(Text, nullable=True)
    # Deep link interno no app, ex: /retreats/123, /vida, /channel/abc
    action_label: Mapped[str | None] = mapped_column(Text, nullable=True)
    # Texto do CTA: "Inscrever-se", "Abrir Canal", "Responder Enquete". None → frontend usa "Ver mais"
    priority: Mapped[str] = mapped_column(Text, nullable=False, server_default="NORMAL")
    # LOW=somente email | NORMAL=push+email fallback | HIGH=push+email sempre | CRITICAL=bypass opt-in+email sempre
```

- [ ] **Step 2: Adicionar modelo `PushSubscription`**

Adicionar após a classe `UserPreferences` (linha ~653):

```python
class PushSubscription(Base):
    __tablename__ = "push_subscriptions"
    __table_args__ = (Index("idx_push_subscriptions_user_id", "user_id"),)

    id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True), primary_key=True,
        default=_uuid_mod.uuid4, server_default=func.gen_random_uuid()
    )
    user_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    endpoint: Mapped[str] = mapped_column(Text, nullable=False, unique=True)
    p256dh: Mapped[str] = mapped_column(Text, nullable=False)
    auth: Mapped[str] = mapped_column(Text, nullable=False)
    user_agent: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
```

- [ ] **Step 3: Adicionar modelo `NotificationDeliveryLog`**

Adicionar após `PushSubscription`:

```python
class NotificationDeliveryLog(Base):
    __tablename__ = "notification_delivery_log"
    __table_args__ = (
        Index("idx_notif_delivery_user_id", "user_id"),
        Index("idx_notif_delivery_sent_at", "sent_at"),
        Index("idx_notif_delivery_inbox_msg", "inbox_message_id"),
    )

    id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True), primary_key=True,
        default=_uuid_mod.uuid4, server_default=func.gen_random_uuid()
    )
    user_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    notification_type: Mapped[str] = mapped_column(Text, nullable=False)
    channel: Mapped[str] = mapped_column(Text, nullable=False)   # PUSH | EMAIL
    status: Mapped[str] = mapped_column(Text, nullable=False)    # SENT | FAILED
    inbox_message_id: Mapped[UUID | None] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("inbox_messages.id", ondelete="SET NULL"), nullable=True
    )
    deep_link: Mapped[str | None] = mapped_column(Text, nullable=True)
    error_detail: Mapped[str | None] = mapped_column(Text, nullable=True)
    sent_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
```

- [ ] **Step 4: Verificar importações**

```bash
cd backend && python -c "
from app.db.models import PushSubscription, NotificationDeliveryLog, InboxMessage
cols = [c.key for c in InboxMessage.__table__.columns]
for f in ['category', 'deep_link', 'action_label', 'priority']:
    print(f, f in cols)
print('OK')
"
```

Expected: cada campo imprime `True`, depois `OK`

- [ ] **Step 5: Commit**

```bash
git add backend/app/db/models.py
git commit -m "feat(notif): modelos PushSubscription, NotificationDeliveryLog + campos em InboxMessage"
```

---

## Task 5: Serviço Web Push

**Files:**
- Create: `backend/app/notifications/push_service.py`

- [ ] **Step 1: Instalar dependência**

```bash
cd backend && pip install pywebpush>=2.0.0
```

Adicionar a `requirements.txt` ou `pyproject.toml`:
```
pywebpush>=2.0.0
```

- [ ] **Step 2: Criar o serviço**

```python
# backend/app/notifications/push_service.py
"""Web Push via pywebpush (VAPID)."""

import json
import structlog
from pywebpush import webpush, WebPushException
from app.settings import settings

logger = structlog.get_logger()

PUSH_GONE_STATUS = 410  # browser removeu a subscription


def send_web_push(endpoint: str, p256dh: str, auth: str, payload: dict) -> tuple[bool, str | None]:
    """
    Envia Web Push.
    Retorna (True, None) em sucesso.
    Retorna (False, error_detail) em falha.
    Caller deve remover subscription do banco se status == 410.
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
    """Verifica se o erro indica subscription expirada (410 Gone)."""
    return error_detail is not None and "410" in error_detail
```

- [ ] **Step 3: Commit**

```bash
git add backend/app/notifications/push_service.py
git commit -m "feat(notif): push_service — Web Push via pywebpush com diagnóstico de erro"
```

---

## Task 6: Serviço de E-mail

**Files:**
- Create: `backend/app/notifications/email_service.py`

- [ ] **Step 1: Instalar dependência**

```bash
cd backend && pip install sendgrid>=6.11.0
```

Adicionar ao `requirements.txt` ou `pyproject.toml`:
```
sendgrid>=6.11.0
```

- [ ] **Step 2: Criar o serviço**

```python
# backend/app/notifications/email_service.py
"""E-mail transacional via SendGrid.
POLÍTICA: e-mails contêm apenas título + resumo (200 chars) + CTA.
Conteúdo completo permanece dentro do Lumen+.
"""

import structlog
from sendgrid import SendGridAPIClient
from sendgrid.helpers.mail import Mail
from app.settings import settings

logger = structlog.get_logger()

APP_URL = "https://lumenmobile.vercel.app"


def send_email(to_email: str, subject: str, html_content: str) -> tuple[bool, str | None]:
    """
    Envia e-mail via SendGrid.
    Retorna (True, None) em sucesso; (False, error_detail) em falha.
    Se SENDGRID_API_KEY vazio, retorna (False, 'not_configured') — mock seguro.
    """
    if not settings.sendgrid_api_key:
        logger.warning("email_skipped", reason="SENDGRID_API_KEY not configured", to=to_email[:10] + "***")
        return False, "not_configured"

    message = Mail(
        from_email=(settings.sendgrid_from_email, settings.sendgrid_from_name),
        to_emails=to_email,
        subject=subject,
        html_content=html_content,
    )
    try:
        sg = SendGridAPIClient(settings.sendgrid_api_key)
        response = sg.send(message)
        ok = response.status_code in (200, 202)
        if not ok:
            return False, f"sendgrid_status={response.status_code}"
        return True, None
    except Exception as exc:
        logger.exception("email_send_error", error_type=type(exc).__name__)
        return False, type(exc).__name__


def _base_template(header_color: str, icon: str, header_text: str, body_html: str, cta_url: str, cta_text: str) -> str:
    return f"""
<html>
<body style="margin:0;padding:0;background:#F3F4F6;font-family:sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0">
    <tr><td align="center" style="padding:32px 16px;">
      <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">
        <tr><td style="background:{header_color};padding:20px 24px;border-radius:12px 12px 0 0;">
          <p style="margin:0;color:#fff;font-size:18px;font-weight:700;">{icon} {header_text}</p>
        </td></tr>
        <tr><td style="background:#fff;padding:24px;border-radius:0 0 12px 12px;">
          {body_html}
          <p style="margin:24px 0 0;">
            <a href="{cta_url}" style="display:inline-block;background:{header_color};color:#fff;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:600;">{cta_text}</a>
          </p>
          <hr style="border:none;border-top:1px solid #E5E7EB;margin:24px 0 16px;">
          <p style="color:#9CA3AF;font-size:11px;margin:0;">
            Você recebe este e-mail porque é membro da Obra Lumen de Evangelização.<br>
            Para cancelar notificações, acesse suas preferências no aplicativo.
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>"""


def build_inbox_email(
    title: str,
    message: str,
    deep_link: str | None = None,
    cta_text: str = "Ver mais",
) -> str:
    # Resumo: máximo 200 caracteres — conteúdo completo fica no app
    summary = message[:200] + ("..." if len(message) > 200 else "")
    cta_url = (APP_URL + deep_link) if deep_link else APP_URL
    body = f"""
      <p style="color:#374151;font-size:16px;font-weight:700;margin:0 0 8px;">{title}</p>
      <p style="color:#6B7280;font-size:14px;line-height:1.6;margin:0 0 16px;">{summary}</p>
      <p style="color:#9CA3AF;font-size:12px;margin:0;">
        Acesse o aplicativo para ler o aviso completo.
      </p>"""
    return _base_template(
        header_color="#7C3AED",
        icon="📢",
        header_text="Novo aviso — Lumen+",
        body_html=body,
        cta_url=cta_url,
        cta_text=cta_text,  # usa action_label quando fornecido
    )


def build_revision_reminder_email() -> str:
    body = """
      <p style="color:#374151;font-size:15px;line-height:1.6;margin:0 0 12px;">
        Este é o seu lembrete mensal para fazer a <strong>revisão do Projeto de Vida</strong>.
      </p>
      <p style="color:#6B7280;font-size:14px;line-height:1.6;margin:0;">
        Reserve um momento de oração e reflexão para avaliar seu progresso,
        rotina espiritual e metas do ciclo atual.
      </p>"""
    return _base_template(
        header_color="#7C3AED",
        icon="🙏",
        header_text="Revisão Mensal do Projeto de Vida",
        body_html=body,
        cta_url=APP_URL + "/vida",
        cta_text="Acessar Projeto de Vida",
    )
```

- [ ] **Step 3: Commit**

```bash
git add backend/app/notifications/email_service.py
git commit -m "feat(notif): email_service — SendGrid com template resumo (200 chars, sem conteúdo completo)"
```

---

## Task 7: NotificationService — orquestrador

**Files:**
- Create: `backend/app/notifications/notification_service.py`

- [ ] **Step 1: Criar o orquestrador**

```python
# backend/app/notifications/notification_service.py
"""
NotificationService
===================
Orquestra Web Push + e-mail com delivery log.
IMPORTANTE: todas as funções públicas abrem sua própria sessão DB
para serem seguras como BackgroundTask (sessão original já pode estar fechada).
"""

import structlog
from uuid import UUID

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

# Constantes de tipos — sem migration (notification_delivery_log.notification_type é Text)
class NotificationType:
    # Inbox
    INBOX_NEW = "INBOX_NEW"
    # Projeto de Vida
    REVISION_REMINDER = "REVISION_REMINDER"
    CYCLE_STARTED = "CYCLE_STARTED"
    CYCLE_ENDING_SOON = "CYCLE_ENDING_SOON"
    CYCLE_ARCHIVED = "CYCLE_ARCHIVED"
    GOAL_EXPIRING = "GOAL_EXPIRING"
    SEMESTER_REVIEW = "SEMESTER_REVIEW"
    # Canal de Ministérios (definidos agora, disparo implementado futuramente)
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
    LOW = "LOW"          # somente Inbox; sem push, sem e-mail (evita fadiga de comunicação)
    NORMAL = "NORMAL"    # push se subscription existe; e-mail como fallback
    HIGH = "HIGH"        # push se subscription existe; e-mail sempre (não só fallback)
    CRITICAL = "CRITICAL"  # push bypass opt-in; e-mail sempre; critical_reason obrigatório


def _should_send_push(priority: str, push_opted_in: bool) -> bool:
    """CRITICAL bypassa opt-in; LOW nunca envia push."""
    if priority == NotificationPriority.CRITICAL:
        return True
    if priority == NotificationPriority.LOW:
        return False
    return push_opted_in  # NORMAL e HIGH respeitam opt-in


def _should_send_email(priority: str, push_delivered: bool) -> bool:
    """LOW nunca envia e-mail. HIGH/CRITICAL sempre enviam. NORMAL só se push falhou."""
    if priority == NotificationPriority.LOW:
        return False  # LOW = somente Inbox; sem ruído externo
    if priority in (NotificationPriority.HIGH, NotificationPriority.CRITICAL):
        return True
    return not push_delivered  # NORMAL: e-mail somente como fallback


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
    # Não comita aqui — caller comita


def _get_user_email(db, user_id) -> str | None:
    from sqlalchemy import select
    identity = db.scalars(
        select(UserIdentity).where(UserIdentity.user_id == user_id)
    ).first()
    return identity.email if identity and hasattr(identity, "email") else None


def _push_opted_in(db, user_id) -> bool:
    from sqlalchemy import select
    prefs = db.scalars(
        select(UserPreferences).where(UserPreferences.user_id == user_id)
    ).first()
    return prefs.push_opt_in if prefs else True


def _send_push_to_user(db, user_id, payload: dict, notification_type: str,
                       inbox_message_id=None) -> bool:
    """Envia push a todas as subscriptions do usuário. Retorna True se ao menos uma entregue."""
    from sqlalchemy import select

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
    Estratégia de entrega determinada por `priority`:
      LOW      → somente Inbox; sem push, sem e-mail
      NORMAL   → push; e-mail se push falhou
      HIGH     → push; e-mail sempre
      CRITICAL → push (ignora opt-in); e-mail sempre
    """
    push_payload = {
        "type": NotificationType.INBOX_NEW,
        "title": f"📢 {title}",
        "body": message[:120] + ("..." if len(message) > 120 else ""),
        "url": deep_link or "/",
        "action": action_label,  # disponível no payload para futura expansão
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

                logger.info(
                    "notify_inbox_sent",
                    user_id=str(user_id),
                    priority=priority,
                    pushed=pushed,
                )
            except Exception:
                logger.exception("notify_inbox_user_error", user_id=str(user_id))


def notify_revision_reminder() -> None:
    """
    Chamado pelo scheduler na 1ª sexta-feira do mês.
    Abre sua própria sessão DB.
    """
    from sqlalchemy import select
    from app.db.models import LifePlanCycle

    push_payload = {
        "type": NotificationType.REVISION_REMINDER,
        "title": "🙏 Revisão Mensal do Projeto de Vida",
        "body": "É hora de fazer sua revisão mensal. Toque para acessar.",
        "url": "/vida",
    }
    email_html = build_revision_reminder_email()

    with get_db_session() as db:
        cycles = db.scalars(
            select(LifePlanCycle).where(LifePlanCycle.status == "ACTIVE")
        ).all()

        # Revisão mensal tem prioridade NORMAL — push se subscription existe; e-mail como fallback
        priority = NotificationPriority.NORMAL

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
```

- [ ] **Step 2: Verificar que `get_db_session` existe como context manager**

```bash
grep -n "get_db_session\|contextmanager" backend/app/db/session.py | head -10
```

Se não existir, adicionar ao final de `backend/app/db/session.py`:

```python
from contextlib import contextmanager
from typing import Generator
from sqlalchemy.orm import Session

@contextmanager
def get_db_session() -> Generator[Session, None, None]:
    db = SessionLocal()
    try:
        yield db
        db.commit()
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()
```

Onde `SessionLocal` é o nome da sessão factory usada no projeto (verificar o nome com `grep -n "SessionLocal\|session_factory\|Session()" backend/app/db/session.py | head -5`).

- [ ] **Step 3: Commit**

```bash
git add backend/app/notifications/notification_service.py backend/app/db/session.py
git commit -m "feat(notif): notification_service — BackgroundTask-safe + delivery log + fallback email"
```

---

## Task 8: Scheduler com pg_try_advisory_lock

**Files:**
- Create: `backend/app/notifications/scheduler.py`
- Modify: `backend/app/main.py`

- [ ] **Step 1: Instalar APScheduler**

```bash
cd backend && pip install "apscheduler>=3.10.0"
```

Adicionar ao `requirements.txt` ou `pyproject.toml`:
```
apscheduler>=3.10.0
```

- [ ] **Step 2: Criar o scheduler**

```python
# backend/app/notifications/scheduler.py
"""
Scheduler de notificações.
Usa APScheduler (AsyncIOScheduler) + PostgreSQL advisory lock para garantir
que apenas UMA instância executa o job, mesmo com múltiplos processos no Railway.
"""

import structlog
from datetime import datetime, timezone
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger

logger = structlog.get_logger()

_scheduler: AsyncIOScheduler | None = None

# Chave arbitrária e estável para o advisory lock.
# Qualquer inteiro positivo que não conflite com outros locks do sistema.
REVISION_REMINDER_LOCK_KEY = 1_872_634_901


def _is_first_friday_of_month() -> bool:
    """True se hoje é a 1ª sexta-feira do mês (dia ≤ 7 e weekday == 4)."""
    now = datetime.now(timezone.utc)
    return now.weekday() == 4 and now.day <= 7


def _run_revision_reminder_job() -> None:
    if not _is_first_friday_of_month():
        return

    from sqlalchemy import select, text
    from app.db.session import get_db_session
    from app.notifications.notification_service import notify_revision_reminder

    with get_db_session() as db:
        # Tenta adquirir advisory lock (não-bloqueante).
        # Se outra instância já tem o lock, retorna False imediatamente.
        acquired = db.scalar(
            text("SELECT pg_try_advisory_lock(:key)").bindparams(key=REVISION_REMINDER_LOCK_KEY)
        )
        if not acquired:
            logger.info(
                "scheduler_revision_skipped",
                reason="advisory_lock_not_acquired",
            )
            return

        try:
            logger.info("scheduler_revision_reminder_start")
            notify_revision_reminder()
            logger.info("scheduler_revision_reminder_done")
        finally:
            # Libera o lock independente de sucesso/falha
            db.scalar(
                text("SELECT pg_advisory_unlock(:key)").bindparams(key=REVISION_REMINDER_LOCK_KEY)
            )


def start_scheduler() -> None:
    global _scheduler
    _scheduler = AsyncIOScheduler(timezone="America/Fortaleza")
    # Toda sexta-feira às 08:00 (Fortaleza).
    # A função verifica internamente se é a 1ª do mês.
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
```

- [ ] **Step 3: Integrar scheduler no lifespan de `backend/app/main.py`**

Localizar `@asynccontextmanager async def lifespan` e adicionar inicialização/parada do scheduler:

```python
@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    logger.info(
        "application_startup", environment=settings.environment, version=settings.app_version
    )

    errors = settings.validate_production_settings()
    if errors:
        for err in errors:
            logger.error("config_error", message=err)
        if settings.is_production:
            raise RuntimeError(
                f"[SEGURANÇA] Configuração inválida para produção. "
                f"Corrija as variáveis de ambiente antes de subir: {errors}"
            )

    # Scheduler de notificações
    from app.notifications.scheduler import start_scheduler, stop_scheduler
    start_scheduler()

    yield

    stop_scheduler()
    logger.info("application_shutdown")
```

- [ ] **Step 4: Verificar startup**

```bash
cd backend && uvicorn app.main:app --reload --port 8000
```

Verificar no log: `notification_scheduler_started`

- [ ] **Step 5: Commit**

```bash
git add backend/app/notifications/scheduler.py backend/app/main.py
git commit -m "feat(notif): APScheduler + pg_try_advisory_lock — safe em múltiplas instâncias"
```

---

## Task 9: Endpoints de Push Subscription

**Files:**
- Create: `backend/app/api/push_routes.py`
- Modify: `backend/app/main.py`

- [ ] **Step 1: Criar os endpoints**

```python
# backend/app/api/push_routes.py
"""
Push Subscription Endpoints
============================
GET  /push/vapid-public-key  → chave pública VAPID (sem auth)
POST /push/subscribe         → salva/atualiza subscription
DELETE /push/unsubscribe     → remove subscription do usuário atual
"""

from fastapi import HTTPException
from fastapi.routing import APIRouter
from pydantic import BaseModel
from sqlalchemy import select

from app.api.deps import CurrentUser, DBSession
from app.db.models import PushSubscription
from app.settings import settings

router = APIRouter(prefix="/push", tags=["push"])


class SubscribeRequest(BaseModel):
    endpoint: str
    p256dh: str
    auth: str
    user_agent: str | None = None


class VapidKeyResponse(BaseModel):
    public_key: str


@router.get("/vapid-public-key", response_model=VapidKeyResponse)
def get_vapid_public_key() -> VapidKeyResponse:
    if not settings.vapid_public_key:
        raise HTTPException(
            status_code=503,
            detail={"error": "not_configured", "message": "Web Push não configurado"},
        )
    return VapidKeyResponse(public_key=settings.vapid_public_key)


@router.post("/subscribe", status_code=201)
def subscribe(body: SubscribeRequest, db: DBSession, current_user: CurrentUser) -> dict:
    existing = db.scalars(
        select(PushSubscription).where(PushSubscription.endpoint == body.endpoint)
    ).first()

    if existing:
        # Atualiza keys (podem ter rotacionado) e garante que pertence ao user atual
        existing.user_id = current_user.id
        existing.p256dh = body.p256dh
        existing.auth = body.auth
        if body.user_agent:
            existing.user_agent = body.user_agent
    else:
        sub = PushSubscription(
            user_id=current_user.id,
            endpoint=body.endpoint,
            p256dh=body.p256dh,
            auth=body.auth,
            user_agent=body.user_agent,
        )
        db.add(sub)

    db.commit()
    return {"status": "subscribed"}


@router.delete("/unsubscribe")
def unsubscribe(db: DBSession, current_user: CurrentUser, endpoint: str) -> dict:
    # Filtra por current_user.id — usuário não pode remover subscription de outro
    sub = db.scalars(
        select(PushSubscription).where(
            PushSubscription.user_id == current_user.id,
            PushSubscription.endpoint == endpoint,
        )
    ).first()
    if sub:
        db.delete(sub)
        db.commit()
    return {"status": "unsubscribed"}
```

- [ ] **Step 2: Registrar em `backend/app/main.py`**

Após os outros imports de router:
```python
from app.api.push_routes import router as push_router  # noqa: E402
```

Após os `include_router` existentes:
```python
app.include_router(push_router)
```

- [ ] **Step 3: Commit**

```bash
git add backend/app/api/push_routes.py backend/app/main.py
git commit -m "feat(notif): endpoints push — vapid-public-key, subscribe, unsubscribe"
```

---

## Task 10: Hook de Notificação no Inbox (BackgroundTasks)

**Files:**
- Modify: `backend/app/api/inbox_routes.py`

- [ ] **Step 1: Localizar o endpoint de envio e como os destinatários são obtidos**

```bash
grep -n "def.*send\|recipient\|user_ids\|InboxRecipient\|db.add\|db.commit" backend/app/api/inbox_routes.py | head -30
```

- [ ] **Step 2: Adicionar `category` e `deep_link` ao schema de request**

Localizar o schema `InboxSendRequest` em `backend/app/schemas/inbox.py`:

```bash
grep -n "class InboxSendRequest\|title\|message\|category\|deep_link" backend/app/schemas/inbox.py | head -15
```

Adicionar ao schema `InboxSendRequest`:

```python
category: str | None = None       # GENERAL, EVENT, RETREAT, FORMATION, SURVEY, ALERT
deep_link: str | None = None      # ex: /retreats/123
action_label: str | None = None   # texto do CTA: "Inscrever-se", "Abrir Canal" etc.
priority: str = "NORMAL"          # LOW | NORMAL | HIGH | CRITICAL
critical_reason: str | None = None  # obrigatório (min 10 chars) quando priority == CRITICAL

# Adicionar ao schema o validator condicional de critical_reason:
# from pydantic import model_validator
#
# @model_validator(mode='after')
# def validate_critical_reason(self) -> 'InboxSendRequest':
#     if self.priority == 'CRITICAL':
#         if not self.critical_reason or len(self.critical_reason.strip()) < 10:
#             raise ValueError('critical_reason obrigatório (min 10 chars) quando priority=CRITICAL')
#     return self
```

- [ ] **Step 3: Persistir `category` e `deep_link` ao criar o `InboxMessage`**

Localizar onde `InboxMessage(...)` é instanciado e adicionar:

```python
message = InboxMessage(
    # ... campos existentes ...
    category=body.category,
    deep_link=body.deep_link,
    action_label=body.action_label,
    priority=body.priority,
)
```

- [ ] **Step 4: Adicionar BackgroundTasks e disparo de notificação**

No endpoint de envio, adicionar o parâmetro `background_tasks: BackgroundTasks` e o disparo:

```python
from fastapi import BackgroundTasks
from app.notifications.notification_service import notify_new_inbox

# Após db.commit() e antes do return:
background_tasks.add_task(
    notify_new_inbox,
    user_ids=[str(r.user_id) for r in recipients],  # ajustar ao nome da variável real
    title=message.title,
    message=message.message,
    inbox_message_id=str(message.id),
    deep_link=message.deep_link,
    action_label=message.action_label,
    priority=message.priority,
)
```

`background_tasks` deve ser adicionado como parâmetro da função do endpoint:

```python
def send_inbox_message(
    ...,
    background_tasks: BackgroundTasks,
    ...
):
```

- [ ] **Step 5: Verificar campos reais do modelo InboxMessage**

```bash
grep -n "title\|message\|content\|body" backend/app/db/models.py | grep -A1 "class InboxMessage" | head -10
```

Ajustar `message.title` e `message.message` para os campos reais.

- [ ] **Step 6: Commit**

```bash
git add backend/app/api/inbox_routes.py backend/app/schemas/inbox.py
git commit -m "feat(notif): inbox — BackgroundTask push+email + campos category e deep_link"
```

---

## Task 11: Service Worker e Frontend Push

**Files:**
- Create: `lumen_mobile/public/sw.js`
- Create: `lumen_mobile/src/services/push.ts`
- Create: `lumen_mobile/src/components/PushPermissionCard.tsx`
- Modify: `lumen_mobile/app/(tabs)/home.tsx`

- [ ] **Step 1: Verificar pasta estática do Expo web**

```bash
ls lumen_mobile/public 2>/dev/null && echo "existe" || echo "criar"
ls lumen_mobile/web 2>/dev/null | head -5 || true
```

Se não existir `public/`:
```bash
mkdir -p lumen_mobile/public
```

- [ ] **Step 2: Criar Service Worker**

```javascript
// lumen_mobile/public/sw.js
self.addEventListener('push', function (event) {
  const data = event.data ? event.data.json() : {};
  const title = data.title || 'Lumen+';
  const options = {
    body: data.body || '',
    icon: '/icon.png',
    badge: '/icon.png',
    tag: data.type || 'default',       // agrupa notificações do mesmo tipo
    renotify: false,                    // não re-notifica se já houver do mesmo tag
    data: { url: data.url || '/' },
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', function (event) {
  event.notification.close();
  const url = event.notification.data?.url || '/';
  event.waitUntil(
    clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then(function (clientList) {
        for (const client of clientList) {
          if (client.url.includes(self.location.origin) && 'focus' in client) {
            client.navigate(url);
            return client.focus();
          }
        }
        if (clients.openWindow) return clients.openWindow(url);
      })
  );
});
```

- [ ] **Step 3: Criar serviço de push**

```typescript
// lumen_mobile/src/services/push.ts
import AsyncStorage from '@react-native-async-storage/async-storage';
import api from './api';

const PUSH_DECISION_KEY = 'lumen_push_decision'; // 'granted' | 'denied' | 'later'

export async function getPushDecision(): Promise<string | null> {
  return AsyncStorage.getItem(PUSH_DECISION_KEY);
}

export async function savePushDecision(decision: 'granted' | 'denied' | 'later'): Promise<void> {
  return AsyncStorage.setItem(PUSH_DECISION_KEY, decision);
}

export async function registerPushSubscription(): Promise<boolean> {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    return false;
  }

  let vapidPublicKey: string;
  try {
    const res = await api.get<{ public_key: string }>('/push/vapid-public-key');
    vapidPublicKey = res.public_key;
  } catch {
    return false;
  }

  const registration = await navigator.serviceWorker.register('/sw.js');
  await navigator.serviceWorker.ready;

  const subscription = await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
  });

  const { endpoint, keys } = subscription.toJSON() as {
    endpoint: string;
    keys: { p256dh: string; auth: string };
  };

  await api.post('/push/subscribe', {
    endpoint,
    p256dh: keys.p256dh,
    auth: keys.auth,
    user_agent: navigator.userAgent,
  });

  await savePushDecision('granted');
  return true;
}

export async function requestAndRegisterPush(): Promise<'granted' | 'denied' | 'error'> {
  try {
    const permission = await Notification.requestPermission();
    if (permission === 'granted') {
      const ok = await registerPushSubscription();
      return ok ? 'granted' : 'error';
    }
    await savePushDecision('denied');
    return 'denied';
  } catch {
    return 'error';
  }
}

export async function unregisterPushSubscription(): Promise<void> {
  if (!('serviceWorker' in navigator)) return;
  const reg = await navigator.serviceWorker.getRegistration('/sw.js');
  if (!reg) return;
  const sub = await reg.pushManager.getSubscription();
  if (!sub) return;
  const { endpoint } = sub;
  await sub.unsubscribe();
  try {
    // api.delete com query param — endpoint como URL encoded param
    await fetch(
      `/push/unsubscribe?endpoint=${encodeURIComponent(endpoint)}`,
      { method: 'DELETE', headers: { Authorization: `Bearer ${await getToken()}` } }
    );
  } catch { /* best-effort */ }
  await savePushDecision('denied');
}

// Obtém o token de auth para a chamada manual acima
async function getToken(): Promise<string> {
  try {
    const { auth } = await import('@/config/firebase');
    return (await auth.currentUser?.getIdToken()) || '';
  } catch { return ''; }
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)));
}
```

- [ ] **Step 4: Criar o card de permissão**

```typescript
// lumen_mobile/src/components/PushPermissionCard.tsx
import React, { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { requestAndRegisterPush, savePushDecision } from '@/src/services/push';

interface Props {
  onDismiss: () => void;
}

export function PushPermissionCard({ onDismiss }: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleAllow = async () => {
    setLoading(true);
    setError(null);
    const result = await requestAndRegisterPush();
    setLoading(false);
    if (result === 'granted') {
      onDismiss();
    } else if (result === 'denied') {
      onDismiss(); // usuário negou no browser — aceitar a decisão
    } else {
      setError('Não foi possível ativar as notificações. Tente novamente.');
    }
  };

  const handleLater = async () => {
    await savePushDecision('later');
    onDismiss();
  };

  return (
    <View
      style={{
        backgroundColor: '#EDE9FE',
        borderRadius: 12,
        padding: 16,
        marginHorizontal: 16,
        marginBottom: 16,
        borderLeftWidth: 4,
        borderLeftColor: '#7C3AED',
      }}
    >
      <Text style={{ fontWeight: '700', fontSize: 15, color: '#1F2937', marginBottom: 4 }}>
        🔔 Receber avisos importantes?
      </Text>
      <Text style={{ color: '#374151', fontSize: 13, lineHeight: 20, marginBottom: 12 }}>
        Ative as notificações para receber avisos da Obra Lumen diretamente no seu navegador,
        mesmo quando o aplicativo estiver fechado.
      </Text>

      {error && (
        <View style={{ backgroundColor: '#FEE2E2', padding: 8, borderRadius: 6, marginBottom: 8 }}>
          <Text style={{ color: '#DC2626', fontSize: 12 }}>{error}</Text>
        </View>
      )}

      <View style={{ flexDirection: 'row', gap: 8 }}>
        <Pressable
          onPress={handleLater}
          disabled={loading}
          style={{
            flex: 1, padding: 10, borderRadius: 8,
            borderWidth: 1, borderColor: '#C4B5FD',
            alignItems: 'center',
          }}
        >
          <Text style={{ color: '#7C3AED', fontSize: 13 }}>Agora não</Text>
        </Pressable>
        <Pressable
          onPress={handleAllow}
          disabled={loading}
          style={{
            flex: 1, padding: 10, borderRadius: 8,
            backgroundColor: loading ? '#C4B5FD' : '#7C3AED',
            alignItems: 'center',
          }}
        >
          <Text style={{ color: '#fff', fontWeight: '600', fontSize: 13 }}>
            {loading ? 'Ativando...' : 'Permitir'}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}
```

- [ ] **Step 5: Integrar card na home**

Em `lumen_mobile/app/(tabs)/home.tsx`, adicionar:

```typescript
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { PushPermissionCard } from '@/src/components/PushPermissionCard';
import { getPushDecision } from '@/src/services/push';

// No componente, adicionar estado:
const [showPushCard, setShowPushCard] = useState(false);

// No useEffect de montagem, verificar se deve exibir o card:
useEffect(() => {
  if (Platform.OS !== 'web') return;
  if (!('Notification' in window)) return;
  // Só exibe se ainda não há decisão salva e se o browser não bloqueou definitivamente
  if (Notification.permission === 'denied') return;

  getPushDecision().then((decision) => {
    if (!decision || decision === 'later') {
      setShowPushCard(true);
    }
  });
}, []);

// No JSX, adicionar o card ANTES do conteúdo principal (mas DEPOIS do header):
{showPushCard && (
  <PushPermissionCard onDismiss={() => setShowPushCard(false)} />
)}
```

- [ ] **Step 6: Testar o fluxo completo**

1. Subir backend com VAPID configurado: `cd backend && uvicorn app.main:app --reload`
2. Abrir `http://localhost:8081` (expo web) no Chrome
3. Fazer login
4. Verificar que o card aparece na home
5. Clicar "Permitir" → browser solicita permissão → aceitar
6. Verificar: `SELECT endpoint FROM push_subscriptions WHERE user_id = '<id>';`
7. Publicar um aviso via admin
8. Verificar notificação no browser + registro no `notification_delivery_log`

- [ ] **Step 7: Commit**

```bash
git add lumen_mobile/public/sw.js lumen_mobile/src/services/push.ts lumen_mobile/src/components/PushPermissionCard.tsx lumen_mobile/app/(tabs)/home.tsx
git commit -m "feat(notif): Service Worker + push service + PushPermissionCard contextual na home"
```

---

## Task 12: Seletores category e deep_link no Admin (criar aviso)

**Files:**
- Modify: `lumen_mobile/app/admin/create-aviso.tsx`

- [ ] **Step 1: Localizar o formulário de criação de aviso**

```bash
grep -n "title\|message\|type\|useState\|handleSubmit\|send" lumen_mobile/app/admin/create-aviso.tsx | head -20
```

- [ ] **Step 2: Adicionar states e UI para category, priority, deep_link e action_label**

```tsx
const CATEGORIES = [
  { value: 'GENERAL', label: 'Geral' },
  { value: 'EVENT', label: 'Evento' },
  { value: 'RETREAT', label: 'Retiro' },
  { value: 'FORMATION', label: 'Formação' },
  { value: 'ALERT', label: 'Alerta' },
] as const;

const PRIORITIES = [
  { value: 'LOW', label: 'Baixa', description: 'Somente e-mail', color: '#6B7280' },
  { value: 'NORMAL', label: 'Normal', description: 'Push + e-mail fallback', color: '#2563EB' },
  { value: 'HIGH', label: 'Alta', description: 'Push + e-mail sempre', color: '#D97706' },
  { value: 'CRITICAL', label: 'Urgente', description: 'Entrega imediata a todos', color: '#DC2626' },
] as const;

// State:
const [category, setCategory] = useState<string>('GENERAL');
const [priority, setPriority] = useState<string>('NORMAL');
const [deepLink, setDeepLink] = useState<string>('');
const [actionLabel, setActionLabel] = useState<string>('');

// JSX — adicionar ao formulário (após o campo de mensagem):

{/* Categoria */}
<View style={{ marginBottom: 16 }}>
  <Text style={{ fontWeight: '600', marginBottom: 8, color: '#374151' }}>Categoria</Text>
  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
    {CATEGORIES.map((cat) => (
      <Pressable
        key={cat.value}
        onPress={() => setCategory(cat.value)}
        style={{
          paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20,
          backgroundColor: category === cat.value ? '#7C3AED' : '#F3F4F6',
          borderWidth: 1, borderColor: category === cat.value ? '#7C3AED' : '#E5E7EB',
        }}
      >
        <Text style={{ color: category === cat.value ? '#fff' : '#374151', fontSize: 13 }}>
          {cat.label}
        </Text>
      </Pressable>
    ))}
  </View>
</View>

{/* Prioridade de entrega */}
<View style={{ marginBottom: 16 }}>
  <Text style={{ fontWeight: '600', marginBottom: 8, color: '#374151' }}>
    Prioridade de Entrega
  </Text>
  {PRIORITIES.map((p) => (
    <Pressable
      key={p.value}
      onPress={() => setPriority(p.value)}
      style={{
        flexDirection: 'row', alignItems: 'center', gap: 10,
        padding: 10, borderRadius: 8, marginBottom: 6,
        backgroundColor: priority === p.value ? '#F9FAFB' : '#fff',
        borderWidth: 1,
        borderColor: priority === p.value ? p.color : '#E5E7EB',
      }}
    >
      <View style={{
        width: 16, height: 16, borderRadius: 8,
        backgroundColor: priority === p.value ? p.color : 'transparent',
        borderWidth: 2, borderColor: priority === p.value ? p.color : '#9CA3AF',
      }} />
      <View style={{ flex: 1 }}>
        <Text style={{ fontWeight: '600', fontSize: 13, color: priority === p.value ? p.color : '#374151' }}>
          {p.label}
        </Text>
        <Text style={{ fontSize: 11, color: '#6B7280' }}>{p.description}</Text>
      </View>
    </Pressable>
  ))}
  {priority === 'CRITICAL' && (
    <View style={{ backgroundColor: '#FEF2F2', padding: 8, borderRadius: 6, marginTop: 4 }}>
      <Text style={{ color: '#DC2626', fontSize: 12 }}>
        ⚠️ Urgente ignora preferências de notificação. Use apenas para comunicados institucionais críticos.
      </Text>
    </View>
  )}
</View>

{/* Deep Link */}
<View style={{ marginBottom: 12 }}>
  <Text style={{ fontWeight: '600', marginBottom: 6, color: '#374151' }}>
    Deep Link (opcional)
  </Text>
  <TextInput
    value={deepLink}
    onChangeText={setDeepLink}
    placeholder="Ex: /retreats/abc, /vida, /channel/xyz"
    style={{ borderWidth: 1, borderColor: '#D1D5DB', borderRadius: 8, padding: 10 }}
  />
  <Text style={{ color: '#9CA3AF', fontSize: 11, marginTop: 4 }}>
    Rota interna do app para a qual o aviso deve levar o usuário.
  </Text>
</View>

{/* Action Label */}
<View style={{ marginBottom: 16 }}>
  <Text style={{ fontWeight: '600', marginBottom: 6, color: '#374151' }}>
    Texto do Botão (opcional)
  </Text>
  <TextInput
    value={actionLabel}
    onChangeText={setActionLabel}
    placeholder='Ex: "Inscrever-se", "Abrir Canal", "Ver Programação"'
    style={{ borderWidth: 1, borderColor: '#D1D5DB', borderRadius: 8, padding: 10 }}
  />
  <Text style={{ color: '#9CA3AF', fontSize: 11, marginTop: 4 }}>
    Se vazio, o botão exibirá "Ver mais".
  </Text>
</View>
```

- [ ] **Step 3: Incluir todos os campos novos no payload de envio**

No handler de envio, adicionar aos campos existentes:

```tsx
category: category,
priority: priority,
deep_link: deepLink.trim() || null,
action_label: actionLabel.trim() || null,
```

- [ ] **Step 4: Commit**

```bash
git add lumen_mobile/app/admin/create-aviso.tsx
git commit -m "feat(notif): seletores category e deep_link na criação de aviso"
```
