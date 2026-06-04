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

    op.create_table(
        "notification_delivery_log",
        sa.Column("id", UUID(as_uuid=True), primary_key=True,
                  server_default=sa.text("gen_random_uuid()")),
        sa.Column("user_id", UUID(as_uuid=True),
                  sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("notification_type", sa.Text(), nullable=False),
        sa.Column("channel", sa.Text(), nullable=False),
        sa.Column("status", sa.Text(), nullable=False),
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
