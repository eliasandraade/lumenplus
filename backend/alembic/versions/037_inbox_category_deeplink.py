"""add category, deep_link, action_label, priority to inbox_messages

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


def upgrade() -> None:
    op.add_column(
        "inbox_messages",
        sa.Column("category", sa.Text(), nullable=True),
    )
    op.add_column(
        "inbox_messages",
        sa.Column("deep_link", sa.Text(), nullable=True),
    )
    op.add_column(
        "inbox_messages",
        sa.Column("action_label", sa.Text(), nullable=True),
    )
    op.add_column(
        "inbox_messages",
        sa.Column(
            "priority",
            sa.Text(),
            nullable=False,
            server_default="NORMAL",
        ),
    )
    op.create_index("idx_inbox_messages_category", "inbox_messages", ["category"])
    op.create_index("idx_inbox_messages_priority", "inbox_messages", ["priority"])


def downgrade() -> None:
    op.drop_index("idx_inbox_messages_priority", table_name="inbox_messages")
    op.drop_index("idx_inbox_messages_category", table_name="inbox_messages")
    op.drop_column("inbox_messages", "priority")
    op.drop_column("inbox_messages", "action_label")
    op.drop_column("inbox_messages", "deep_link")
    op.drop_column("inbox_messages", "category")
