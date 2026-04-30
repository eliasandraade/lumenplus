"""Projeto de Vida Mensal — comunidade/cuidado → JSONB; revisao → 4 perguntas v2

Revision ID: 034_pvm_json_fields_revisao_v2
Revises: 033_pvm_pin_ratelimit
Create Date: 2026-04-30
"""

from alembic import op
import sqlalchemy as sa

revision = "034_pvm_json_fields_revisao_v2"
down_revision = "033_pvm_pin_ratelimit"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ── comunidade: Text → JSONB (dados existentes → array vazio) ──────────
    for col in ("partilha_acompanhador", "encontro_familia", "dias_grupo", "outros"):
        op.execute(
            f"ALTER TABLE projetos_vida_comunidade "
            f"ALTER COLUMN {col} TYPE jsonb "
            f"USING '[]'::jsonb"
        )

    # ── cuidado: Text → JSONB ───────────────────────────────────────────────
    for col in ("consultas", "exames", "descanso", "outros"):
        op.execute(
            f"ALTER TABLE projetos_vida_cuidado "
            f"ALTER COLUMN {col} TYPE jsonb "
            f"USING '[]'::jsonb"
        )

    # ── revisao: dropar campos antigos, adicionar 4 novos ──────────────────
    old_cols = [
        "graca", "fidelidade", "falhas", "ordenar", "passo",
        "decisao", "virtude", "conversao", "passo_proximo",
    ]
    for col in old_cols:
        op.drop_column("projetos_vida_revisoes", col)

    for col in ("pratica_melhorar", "taticas_vigilancia", "rotina_evangelizacao", "outra_area_atencao"):
        op.add_column(
            "projetos_vida_revisoes",
            sa.Column(col, sa.Text, nullable=True),
        )


def downgrade() -> None:
    # ── revisao: restaurar campos antigos, dropar novos ────────────────────
    for col in ("pratica_melhorar", "taticas_vigilancia", "rotina_evangelizacao", "outra_area_atencao"):
        op.drop_column("projetos_vida_revisoes", col)

    old_cols = [
        "graca", "fidelidade", "falhas", "ordenar", "passo",
        "decisao", "virtude", "conversao", "passo_proximo",
    ]
    for col in old_cols:
        op.add_column(
            "projetos_vida_revisoes",
            sa.Column(col, sa.Text, nullable=True),
        )

    # ── cuidado: JSONB → Text ───────────────────────────────────────────────
    for col in ("consultas", "exames", "descanso", "outros"):
        op.execute(
            f"ALTER TABLE projetos_vida_cuidado "
            f"ALTER COLUMN {col} TYPE text "
            f"USING NULL"
        )

    # ── comunidade: JSONB → Text ────────────────────────────────────────────
    for col in ("partilha_acompanhador", "encontro_familia", "dias_grupo", "outros"):
        op.execute(
            f"ALTER TABLE projetos_vida_comunidade "
            f"ALTER COLUMN {col} TYPE text "
            f"USING NULL"
        )
