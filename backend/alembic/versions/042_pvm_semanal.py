"""Projeto de Vida — CREATE projetos_vida_semanal

Revision ID: 042_pvm_semanal
Revises: 041_pvm_exame
Create Date: 2026-06-06

Cria a tabela do Projeto Semanal (Fase 4 do Projeto de Vida 2.0).

O semanal armazena:
  - dever_estado: compromissos vocacionais da semana (JSONB)
  - vida_interior: planejamento de práticas espirituais (JSONB)
  - evangelizacao_disposicao: disposição espiritual para evangelizar (TEXT)
  - evangelizacao_momentos: momentos relacionais planejados (JSONB, sem métricas)
  - plano_diario: planejamento "Amanhã com o Emanuel" para cada dia (JSONB)

O plano_diario é um objeto JSON keyed por dia (seg/ter/qua/qui/sex/sab/dom).
Atualizações do plano_diario usam merge parcial — cada dia é independente.

Nenhuma tabela existente é alterada por esta migration.
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "042_pvm_semanal"
down_revision: Union[str, None] = "041_pvm_exame"
branch_labels: Union[Sequence[str], None] = None
depends_on: Union[Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "projetos_vida_semanal",
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
        sa.Column(
            "numero_semana",
            sa.Integer(),
            nullable=False,
        ),
        sa.Column(
            "dever_estado",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=True,
        ),
        sa.Column(
            "vida_interior",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=True,
        ),
        sa.Column(
            "evangelizacao_disposicao",
            sa.Text(),
            nullable=True,
        ),
        sa.Column(
            "evangelizacao_momentos",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=True,
            server_default=sa.text("'[]'::jsonb"),
        ),
        sa.Column(
            "plano_diario",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=True,
            server_default=sa.text("'{}'::jsonb"),
        ),
        sa.Column(
            "observacoes",
            sa.Text(),
            nullable=True,
        ),
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
            "numero_semana",
            name="uq_pv_semanal_projeto_semana",
        ),
        sa.CheckConstraint(
            "numero_semana >= 1 AND numero_semana <= 5",
            name="ck_pv_semanal_numero_semana",
        ),
    )
    op.create_index(
        "ix_pv_semanal_projeto_id",
        "projetos_vida_semanal",
        ["projeto_id"],
    )


def downgrade() -> None:
    op.drop_index("ix_pv_semanal_projeto_id", "projetos_vida_semanal")
    op.drop_table("projetos_vida_semanal")
