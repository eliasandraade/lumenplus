"""Projeto de Vida — CREATE projetos_vida_intercessao

Revision ID: 043_pvm_intercessao
Revises: 042_pvm_semanal
Create Date: 2026-06-06

Cria a tabela da Intercessão (Fase 3 do Projeto de Vida 2.0).

A intercessão é a etapa final contemplativa do wizard de criação do ciclo.
Encerra o Projeto de Vida em oração com:
  - intencoes_pessoais: intenções pessoais do membro
  - intencoes_comunitarias: intenções pela comunidade
  - oferecimento: oferecimento do mês a Deus

Relação 1:1 com projetos_vida_mensal.
Nenhuma tabela existente é alterada por esta migration.
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "043_pvm_intercessao"
down_revision: Union[str, None] = "042_pvm_semanal"
branch_labels: Union[Sequence[str], None] = None
depends_on: Union[Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "projetos_vida_intercessao",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text("gen_random_uuid()"),
        ),
        sa.Column(
            "projeto_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("projetos_vida_mensal.id", ondelete="CASCADE"),
            nullable=False,
            unique=True,
        ),
        sa.Column("intencoes_pessoais", sa.Text(), nullable=True),
        sa.Column("intencoes_comunitarias", sa.Text(), nullable=True),
        sa.Column("oferecimento", sa.Text(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
    )


def downgrade() -> None:
    op.drop_table("projetos_vida_intercessao")
