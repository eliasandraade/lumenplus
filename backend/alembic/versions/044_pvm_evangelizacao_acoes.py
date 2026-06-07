"""Projeto de Vida — ADD evangelizacao_acoes to projetos_vida_mensal

Revision ID: 044_pvm_evangelizacao_acoes
Revises: 043_pvm_intercessao
Create Date: 2026-06-06

Adiciona coluna JSONB nullable `evangelizacao_acoes` à tabela
`projetos_vida_mensal`. Projetos existentes recebem NULL automaticamente.
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "044_pvm_evangelizacao_acoes"
down_revision: Union[str, None] = "043_pvm_intercessao"
branch_labels: Union[Sequence[str], None] = None
depends_on: Union[Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "projetos_vida_mensal",
        sa.Column(
            "evangelizacao_acoes",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=True,
        ),
    )


def downgrade() -> None:
    op.drop_column("projetos_vida_mensal", "evangelizacao_acoes")
