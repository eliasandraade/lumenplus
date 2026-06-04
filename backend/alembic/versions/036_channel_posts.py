"""add channel posts, replies and org_unit channel_post_mode

Revision ID: 036
Revises: 035_seed_roles_exports
Create Date: 2026-06-04
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

revision = "036"
down_revision = "035_seed_roles_exports"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # campo em org_units
    op.add_column(
        "org_units",
        sa.Column(
            "channel_post_mode",
            sa.Text(),
            nullable=False,
            server_default="COORDINATOR_ONLY",
        ),
    )

    # channel_posts
    op.create_table(
        "channel_posts",
        sa.Column("id", UUID(as_uuid=True), primary_key=True,
                  server_default=sa.text("gen_random_uuid()")),
        sa.Column("org_unit_id", UUID(as_uuid=True),
                  sa.ForeignKey("org_units.id", ondelete="CASCADE"), nullable=False),
        sa.Column("author_user_id", UUID(as_uuid=True),
                  sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("title", sa.Text(), nullable=False),
        sa.Column("body", sa.Text(), nullable=False),
        sa.Column("is_pinned", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("is_institutional_highlight", sa.Boolean(), nullable=False,
                  server_default="false"),
        sa.Column("media_metadata", sa.JSON(), nullable=True),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("deleted_by_user_id", UUID(as_uuid=True),
                  sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("delete_reason", sa.Text(), nullable=True),
        sa.Column("edited_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True),
                  server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True),
                  server_default=sa.text("now()")),
    )
    op.create_index("idx_channel_posts_org_unit_id", "channel_posts", ["org_unit_id"])
    op.create_index("idx_channel_posts_created_at", "channel_posts", ["created_at"])
    op.create_index("idx_channel_posts_ordering", "channel_posts",
                    ["org_unit_id", "is_institutional_highlight", "is_pinned", "created_at"])

    # channel_replies
    op.create_table(
        "channel_replies",
        sa.Column("id", UUID(as_uuid=True), primary_key=True,
                  server_default=sa.text("gen_random_uuid()")),
        sa.Column("post_id", UUID(as_uuid=True),
                  sa.ForeignKey("channel_posts.id", ondelete="CASCADE"), nullable=False),
        sa.Column("author_user_id", UUID(as_uuid=True),
                  sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("body", sa.Text(), nullable=False),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("deleted_by_user_id", UUID(as_uuid=True),
                  sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("delete_reason", sa.Text(), nullable=True),
        sa.Column("edited_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True),
                  server_default=sa.text("now()")),
    )
    op.create_index("idx_channel_replies_post_id", "channel_replies", ["post_id"])


def downgrade() -> None:
    op.drop_table("channel_replies")
    op.drop_table("channel_posts")
    op.drop_column("org_units", "channel_post_mode")
