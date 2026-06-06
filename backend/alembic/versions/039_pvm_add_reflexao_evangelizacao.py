"""Projeto de Vida Mensal — ADD reflexao_evangelizacao

Revision ID: 039_pvm_add_reflexao_evangelizacao
Revises: 038
Create Date: 2026-06-06

Notas de segurança (pré-aplicação obrigatória):
  Antes de aplicar em produção, confirmar via query:
    SELECT COUNT(*) FROM projetos_vida_mensal WHERE tema IS NOT NULL;
    SELECT COUNT(*) FROM projetos_vida_mensal WHERE intencao IS NOT NULL;
  Resultado esperado: 0 (campos nunca expostos na API antes da Fase 0).

Esta migration é 100% aditiva:
  - NÃO altera `tema` (mantido como campo reservado, nullable)
  - NÃO altera `intencao` (exposto a partir da Fase 0, nullable)
  - NÃO remove, altera ou migra nenhum dado existente
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "039_pvm_add_reflexao_evangelizacao"
down_revision: Union[str, None] = "038"
branch_labels: Union[Sequence[str], None] = None
depends_on: Union[Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "projetos_vida_mensal",
        sa.Column("reflexao_evangelizacao", sa.Text(), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("projetos_vida_mensal", "reflexao_evangelizacao")
