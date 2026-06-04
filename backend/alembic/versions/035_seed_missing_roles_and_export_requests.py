"""Seed missing global roles + create data_export_requests table

Revision ID: 035_seed_missing_roles_and_export_requests
Revises: 034_pvm_json_fields_revisao_v2
Create Date: 2026-06-03
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "035_seed_roles_exports"
down_revision: Union[str, None] = "034_pvm_json_fields_revisao_v2"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ── 1. Seed de todos os roles globais (idempotente) ────────────────────
    roles = [
        ("DEV", "Desenvolvedor"),
        ("ADMIN", "Administrador"),
        ("SECRETARY", "Secretário Geral"),
        ("AVISOS", "Avisos"),
        ("COUNCIL_GENERAL", "Conselho Geral"),
        ("ANALISTA", "Analista"),
    ]
    for code, name in roles:
        op.execute(
            sa.text(
                "INSERT INTO global_roles (id, code, name) "
                "VALUES (gen_random_uuid(), :code, :name) "
                "ON CONFLICT (code) DO NOTHING"
            ).bindparams(code=code, name=name)
        )

    # ── 2. Tabela data_export_requests ─────────────────────────────────────
    op.create_table(
        "data_export_requests",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            nullable=False,
            server_default=sa.text("gen_random_uuid()"),
        ),
        sa.Column(
            "requested_by",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "status",
            sa.Text(),
            nullable=False,
            server_default="PENDING",
        ),
        sa.Column("fields_requested", postgresql.ARRAY(sa.Text()), nullable=False),
        sa.Column("filters_json", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("has_sensitive", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column(
            "approved_by",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("approved_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("file_path", sa.Text(), nullable=True),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_export_requests_requested_by",
        "data_export_requests",
        ["requested_by"],
    )
    op.create_index(
        "ix_export_requests_status",
        "data_export_requests",
        ["status"],
    )


def downgrade() -> None:
    # Roles globais não são removidos no downgrade: podem ter sido criados manualmente
    # antes desta migration (seeds idempotentes), e removê-los poderia revogar
    # permissões de usuários reais em produção de forma destrutiva.
    op.drop_index("ix_export_requests_status", table_name="data_export_requests")
    op.drop_index("ix_export_requests_requested_by", table_name="data_export_requests")
    op.drop_table("data_export_requests")
