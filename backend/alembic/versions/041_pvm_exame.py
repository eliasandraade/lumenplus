"""Projeto de Vida — CREATE projetos_vida_exame

Revision ID: 041_pvm_exame
Revises: 040_pvm_areas_mensais
Create Date: 2026-06-06

Cria a tabela do Exame de Consciência (Fase 2 do Projeto de Vida 2.0).

O exame é uma entidade SEPARADA da revisão mensal (projetos_vida_revisoes).
A revisão mensal continua existindo como "revisão de saída" do ciclo.
O exame é a "reflexão de entrada" — feito antes de criar um novo ciclo.

O exame é SUGERIDO, nunca obrigatório.
Nenhuma tabela existente é alterada por esta migration.
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "041_pvm_exame"
down_revision: Union[str, None] = "040_pvm_areas_mensais"
branch_labels: Union[Sequence[str], None] = None
depends_on: Union[Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "projetos_vida_exame",
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
        sa.Column("gracas_recebidas", sa.Text(), nullable=True),
        sa.Column("infidelidades", sa.Text(), nullable=True),
        sa.Column("dificuldades_espirituais", sa.Text(), nullable=True),
        sa.Column("jesus_abandonado", sa.Text(), nullable=True),
        sa.Column("onde_deixei_de_responder", sa.Text(), nullable=True),
        sa.Column("proposito_conversao", sa.Text(), nullable=True),
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
    op.drop_table("projetos_vida_exame")
