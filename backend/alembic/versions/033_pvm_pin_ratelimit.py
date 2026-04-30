"""Add PIN rate-limit columns to projetos_vida_mensal

Revision ID: 033_pvm_pin_ratelimit
Revises: 032_projeto_vida_mensal
Create Date: 2026-04-29
"""

from alembic import op
import sqlalchemy as sa

revision = "033_pvm_pin_ratelimit"
down_revision = "032_projeto_vida_mensal"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "projetos_vida_mensal",
        sa.Column("pin_falhas_consecutivas", sa.Integer(), nullable=False, server_default="0"),
    )
    op.add_column(
        "projetos_vida_mensal",
        sa.Column("pin_bloqueado_ate", sa.DateTime(timezone=True), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("projetos_vida_mensal", "pin_bloqueado_ate")
    op.drop_column("projetos_vida_mensal", "pin_falhas_consecutivas")
