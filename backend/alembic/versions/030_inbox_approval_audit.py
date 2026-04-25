"""Inbox: fluxo de aprovação e auditoria de mensagens

Revision ID: 030_inbox_approval_audit
Revises: 029_terms_v1_4_retiros
Create Date: 2026-04-24

Adiciona:
  - Colunas de aprovação em inbox_messages:
      approval_status, approver_user_id, approved_at, approval_note
  - Colunas de soft delete em inbox_messages:
      is_deleted, deleted_at, deleted_by_user_id
  - Nova tabela inbox_message_audits
"""

from typing import Sequence, Union

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql
from alembic import op

revision: str = "030_inbox_approval_audit"
down_revision: Union[str, None] = "029_terms_v1_4_retiros"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Colunas de aprovação em inbox_messages (usando TEXT para evitar DDL de enum)
    op.add_column(
        "inbox_messages",
        sa.Column(
            "approval_status",
            sa.Text(),
            nullable=False,
            server_default="AUTO_APPROVED",
        ),
    )
    op.add_column(
        "inbox_messages",
        sa.Column(
            "approver_user_id",
            postgresql.UUID(as_uuid=True),
            nullable=True,
        ),
    )
    op.add_column(
        "inbox_messages",
        sa.Column("approved_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.add_column(
        "inbox_messages",
        sa.Column("approval_note", sa.Text(), nullable=True),
    )

    # 2. Colunas de soft delete em inbox_messages
    op.add_column(
        "inbox_messages",
        sa.Column(
            "is_deleted",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("false"),
        ),
    )
    op.add_column(
        "inbox_messages",
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.add_column(
        "inbox_messages",
        sa.Column(
            "deleted_by_user_id",
            postgresql.UUID(as_uuid=True),
            nullable=True,
        ),
    )

    # 3. FK constraints para as novas colunas UUID
    op.create_foreign_key(
        "fk_inbox_messages_approver",
        "inbox_messages",
        "users",
        ["approver_user_id"],
        ["id"],
        ondelete="SET NULL",
    )
    op.create_foreign_key(
        "fk_inbox_messages_deleted_by",
        "inbox_messages",
        "users",
        ["deleted_by_user_id"],
        ["id"],
        ondelete="SET NULL",
    )

    # 4. Tabela de auditoria
    op.create_table(
        "inbox_message_audits",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text("gen_random_uuid()"),
        ),
        sa.Column(
            "message_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("inbox_messages.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("action", sa.Text(), nullable=False),
        sa.Column(
            "actor_user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
        ),
        sa.Column("old_title", sa.Text(), nullable=True),
        sa.Column("old_message", sa.Text(), nullable=True),
        sa.Column("new_title", sa.Text(), nullable=True),
        sa.Column("new_message", sa.Text(), nullable=True),
        sa.Column("note", sa.Text(), nullable=True),
    )
    op.create_index("ix_inbox_audit_message_id", "inbox_message_audits", ["message_id"])
    op.create_index("ix_inbox_audit_actor_id", "inbox_message_audits", ["actor_user_id"])


def downgrade() -> None:
    op.drop_index("ix_inbox_audit_actor_id", table_name="inbox_message_audits")
    op.drop_index("ix_inbox_audit_message_id", table_name="inbox_message_audits")
    op.drop_table("inbox_message_audits")
    op.drop_constraint("fk_inbox_messages_approver", "inbox_messages", type_="foreignkey")
    op.drop_constraint("fk_inbox_messages_deleted_by", "inbox_messages", type_="foreignkey")
    for col in [
        "approval_status",
        "approver_user_id",
        "approved_at",
        "approval_note",
        "is_deleted",
        "deleted_at",
        "deleted_by_user_id",
    ]:
        op.drop_column("inbox_messages", col)
