"""Projeto de Vida Mensal — CREATE projetos_vida_areas_mensais

Revision ID: 040_pvm_areas_mensais
Revises: 039_pvm_add_reflexao_evangelizacao
Create Date: 2026-06-06

Cria a tabela de áreas mensais estruturadas (Fase 1 do Projeto de Vida 2.0).
Substitui a estrutura de comunidade/cuidado para novos ciclos.
Ciclos históricos continuam lendo das tabelas projetos_vida_comunidade e
projetos_vida_cuidado — nenhuma tabela histórica é alterada.
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "040_pvm_areas_mensais"
down_revision: Union[str, None] = "039_pvm_add_reflexao_evangelizacao"
branch_labels: Union[Sequence[str], None] = None
depends_on: Union[Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "projetos_vida_areas_mensais",
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
        ),
        sa.Column("tipo_area", sa.String(50), nullable=False),
        sa.Column("objetivo", sa.Text(), nullable=True),
        sa.Column(
            "compromissos",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=True,
            server_default=sa.text("'[]'::jsonb"),
        ),
        sa.Column("observacoes", sa.Text(), nullable=True),
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
        sa.UniqueConstraint(
            "projeto_id",
            "tipo_area",
            name="uq_pv_areas_mensais_projeto_tipo",
        ),
    )
    op.create_index(
        "ix_pv_areas_mensais_projeto_id",
        "projetos_vida_areas_mensais",
        ["projeto_id"],
    )


def downgrade() -> None:
    op.drop_index("ix_pv_areas_mensais_projeto_id", "projetos_vida_areas_mensais")
    op.drop_table("projetos_vida_areas_mensais")
