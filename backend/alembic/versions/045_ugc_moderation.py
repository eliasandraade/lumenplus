"""UGC: denuncia de conteudo e bloqueio de usuario

Requisito das lojas (Apple Guideline 1.2 e politica de UGC do Google Play):
apps com conteudo gerado por usuario precisam oferecer DENUNCIA e BLOQUEIO.
No Lumen+, membros ativos publicam posts e respostas nos canais das unidades,
visiveis a outros membros — logo o requisito se aplica.

Revision ID: 045_ugc_moderation
Revises: 044_pvm_evangelizacao_acoes
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "045_ugc_moderation"
down_revision = "044_pvm_evangelizacao_acoes"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # --- content_reports ---------------------------------------------------
    op.create_table(
        "content_reports",
        sa.Column(
            "id", postgresql.UUID(as_uuid=True), primary_key=True,
            server_default=sa.text("gen_random_uuid()"),
        ),
        sa.Column(
            "reporter_user_id", postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False,
        ),
        sa.Column("target_type", sa.String(length=10), nullable=False),
        sa.Column("target_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column(
            "org_unit_id", postgresql.UUID(as_uuid=True),
            sa.ForeignKey("org_units.id", ondelete="CASCADE"), nullable=True,
        ),
        sa.Column("reason", sa.String(length=20), nullable=False),
        sa.Column("details", sa.Text(), nullable=True),
        sa.Column("status", sa.String(length=20), nullable=False, server_default="OPEN"),
        sa.Column("content_snapshot", sa.Text(), nullable=True),
        sa.Column(
            "reviewed_by_user_id", postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True,
        ),
        sa.Column("reviewed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("resolution_note", sa.Text(), nullable=True),
        sa.Column(
            "created_at", sa.DateTime(timezone=True),
            server_default=sa.func.now(), nullable=False,
        ),
        # Um denunciante nao abre duas denuncias do mesmo alvo (anti-flood).
        sa.UniqueConstraint(
            "reporter_user_id", "target_type", "target_id",
            name="uq_content_report_reporter_target",
        ),
    )
    op.create_index("idx_content_reports_status", "content_reports", ["status"])
    op.create_index(
        "idx_content_reports_target", "content_reports", ["target_type", "target_id"]
    )
    op.create_index("idx_content_reports_org_unit", "content_reports", ["org_unit_id"])

    # --- user_blocks -------------------------------------------------------
    op.create_table(
        "user_blocks",
        sa.Column(
            "id", postgresql.UUID(as_uuid=True), primary_key=True,
            server_default=sa.text("gen_random_uuid()"),
        ),
        sa.Column(
            "blocker_user_id", postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False,
        ),
        sa.Column(
            "blocked_user_id", postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False,
        ),
        sa.Column(
            "created_at", sa.DateTime(timezone=True),
            server_default=sa.func.now(), nullable=False,
        ),
        sa.UniqueConstraint("blocker_user_id", "blocked_user_id", name="uq_user_block_pair"),
        sa.CheckConstraint("blocker_user_id <> blocked_user_id", name="ck_user_block_not_self"),
    )
    op.create_index("idx_user_blocks_blocker", "user_blocks", ["blocker_user_id"])
    op.create_index("idx_user_blocks_blocked", "user_blocks", ["blocked_user_id"])


def downgrade() -> None:
    op.drop_index("idx_user_blocks_blocked", table_name="user_blocks")
    op.drop_index("idx_user_blocks_blocker", table_name="user_blocks")
    op.drop_table("user_blocks")
    op.drop_index("idx_content_reports_org_unit", table_name="content_reports")
    op.drop_index("idx_content_reports_target", table_name="content_reports")
    op.drop_index("idx_content_reports_status", table_name="content_reports")
    op.drop_table("content_reports")
