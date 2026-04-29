"""Projeto de Vida Mensal — criar 6 tabelas

Revision ID: 032_projeto_vida_mensal
Revises: 031_add_missao_org_unit
Create Date: 2026-04-29
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "032_projeto_vida_mensal"
down_revision: Union[str, None] = "031_add_missao_org_unit"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "projetos_vida_mensal",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True,
                  server_default=sa.text("gen_random_uuid()")),
        sa.Column("user_id", postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("mes", sa.Integer(), nullable=False),
        sa.Column("ano", sa.Integer(), nullable=False),
        sa.Column("tema", sa.Text(), nullable=True),
        sa.Column("intencao", sa.Text(), nullable=True),
        sa.Column("pin_hash", sa.Text(), nullable=True),
        sa.Column("concluido", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("observacoes_mes", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True),
                  server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True),
                  server_default=sa.func.now(), nullable=False),
        sa.UniqueConstraint("user_id", "mes", "ano",
                            name="uq_projeto_vida_mensal_user_mes_ano"),
    )
    op.create_index("ix_projetos_vida_mensal_user_id", "projetos_vida_mensal", ["user_id"])

    op.create_table(
        "projetos_vida_comunidade",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True,
                  server_default=sa.text("gen_random_uuid()")),
        sa.Column("projeto_id", postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("projetos_vida_mensal.id", ondelete="CASCADE"),
                  nullable=False, unique=True),
        sa.Column("partilha_acompanhador", sa.Text(), nullable=True),
        sa.Column("encontro_familia", sa.Text(), nullable=True),
        sa.Column("dias_grupo", sa.Text(), nullable=True),
        sa.Column("outros", sa.Text(), nullable=True),
    )

    op.create_table(
        "projetos_vida_cuidado",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True,
                  server_default=sa.text("gen_random_uuid()")),
        sa.Column("projeto_id", postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("projetos_vida_mensal.id", ondelete="CASCADE"),
                  nullable=False, unique=True),
        sa.Column("consultas", sa.Text(), nullable=True),
        sa.Column("exames", sa.Text(), nullable=True),
        sa.Column("descanso", sa.Text(), nullable=True),
        sa.Column("outros", sa.Text(), nullable=True),
    )

    op.create_table(
        "projetos_vida_compromissos",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True,
                  server_default=sa.text("gen_random_uuid()")),
        sa.Column("projeto_id", postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("projetos_vida_mensal.id", ondelete="CASCADE"),
                  nullable=False),
        sa.Column("semana", sa.String(3), nullable=False),
        sa.Column("titulo", sa.String(200), nullable=True),
        sa.Column("dia", sa.String(50), nullable=True),
        sa.Column("horario", sa.String(50), nullable=True),
        sa.Column("obs", sa.Text(), nullable=True),
        sa.Column("ordem", sa.Integer(), nullable=False, server_default="0"),
    )
    op.create_index("ix_projetos_vida_compromissos_projeto_id",
                    "projetos_vida_compromissos", ["projeto_id"])

    op.create_table(
        "projetos_vida_praticas",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True,
                  server_default=sa.text("gen_random_uuid()")),
        sa.Column("projeto_id", postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("projetos_vida_mensal.id", ondelete="CASCADE"),
                  nullable=False),
        sa.Column("dia_semana", sa.String(3), nullable=False),
        sa.Column("tipo", sa.String(100), nullable=False),
        sa.Column("horario", sa.String(50), nullable=True),
        sa.Column("duracao", sa.String(50), nullable=True),
        sa.Column("obs", sa.Text(), nullable=True),
        sa.Column("ordem", sa.Integer(), nullable=False, server_default="0"),
    )
    op.create_index("ix_projetos_vida_praticas_projeto_id",
                    "projetos_vida_praticas", ["projeto_id"])

    op.create_table(
        "projetos_vida_revisoes",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True,
                  server_default=sa.text("gen_random_uuid()")),
        sa.Column("projeto_id", postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("projetos_vida_mensal.id", ondelete="CASCADE"),
                  nullable=False, unique=True),
        sa.Column("graca", sa.Text(), nullable=True),
        sa.Column("fidelidade", sa.Text(), nullable=True),
        sa.Column("falhas", sa.Text(), nullable=True),
        sa.Column("ordenar", sa.Text(), nullable=True),
        sa.Column("passo", sa.Text(), nullable=True),
        sa.Column("decisao", sa.Text(), nullable=True),
        sa.Column("virtude", sa.Text(), nullable=True),
        sa.Column("conversao", sa.Text(), nullable=True),
        sa.Column("passo_proximo", sa.Text(), nullable=True),
    )


def downgrade() -> None:
    op.drop_table("projetos_vida_revisoes")
    op.drop_index("ix_projetos_vida_praticas_projeto_id", "projetos_vida_praticas")
    op.drop_table("projetos_vida_praticas")
    op.drop_index("ix_projetos_vida_compromissos_projeto_id", "projetos_vida_compromissos")
    op.drop_table("projetos_vida_compromissos")
    op.drop_table("projetos_vida_cuidado")
    op.drop_table("projetos_vida_comunidade")
    op.drop_index("ix_projetos_vida_mensal_user_id", "projetos_vida_mensal")
    op.drop_table("projetos_vida_mensal")
