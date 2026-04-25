"""Adiciona tipo MISSAO às unidades organizacionais

Revision ID: 031_add_missao_org_unit
Revises: 030_inbox_approval_audit
Create Date: 2026-04-25

Adiciona:
  - Valor MISSAO ao enum org_unit_type
  - Coluna mission_types (JSON) em org_units para armazenar ["VIDA", "ALIANCA"]
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "031_add_missao_org_unit"
down_revision: Union[str, None] = "030_inbox_approval_audit"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Adiciona o valor MISSAO ao enum org_unit_type no PostgreSQL
    op.execute("ALTER TYPE org_unit_type ADD VALUE IF NOT EXISTS 'MISSAO'")

    # Adiciona coluna mission_types (JSON) em org_units
    op.add_column(
        "org_units",
        sa.Column("mission_types", sa.JSON(), nullable=True),
    )


def downgrade() -> None:
    # Remove a coluna mission_types
    op.drop_column("org_units", "mission_types")

    # Nota: PostgreSQL não suporta remover valores de enum diretamente.
    # Para reverter completamente, seria necessário recriar o enum sem MISSAO.
