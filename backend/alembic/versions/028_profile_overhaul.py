"""Profile overhaul — Fase 1A + 1B

Revision ID: 028_profile_overhaul
Revises: 027_terms_v1_3_contato
Create Date: 2026-04-24

Mudanças:
  - Novas colunas em user_profiles: country, spouse_in_community,
    realidade_atual, ministry_sector_ids, accommodation_options,
    mission_org_unit_id, last_profile_confirmed_at
  - Catalog LIFE_STATE: simplificado para 3 opções
    (LEIGO, RELIGIOSO novo, SACERDOTE); demais desativados
  - Catalog MARITAL_STATUS: NOIVO e CELIBATARIO desativados
  - Novo catalog REALIDADE_ATUAL com 7 items
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "028_profile_overhaul"
down_revision: Union[str, None] = "027_terms_v1_3_contato"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    conn = op.get_bind()

    # ── 1. Novas colunas em user_profiles ─────────────────────────────────────
    op.add_column("user_profiles", sa.Column("country", sa.Text(), nullable=True))
    op.add_column("user_profiles", sa.Column("spouse_in_community", sa.Boolean(), nullable=True))
    op.add_column("user_profiles", sa.Column("realidade_atual", sa.Text(), nullable=True))
    op.add_column("user_profiles", sa.Column("ministry_sector_ids", sa.Text(), nullable=True))
    op.add_column("user_profiles", sa.Column("accommodation_options", sa.Text(), nullable=True))
    op.add_column(
        "user_profiles",
        sa.Column(
            "mission_org_unit_id",
            sa.dialects.postgresql.UUID(as_uuid=True),
            sa.ForeignKey("org_units.id", ondelete="SET NULL"),
            nullable=True,
        ),
    )
    op.add_column(
        "user_profiles",
        sa.Column(
            "last_profile_confirmed_at",
            sa.DateTime(timezone=True),
            nullable=True,
        ),
    )

    # ── 2. LIFE_STATE — desativar 6 itens, manter LEIGO e SACERDOTE ──────────
    conn.execute(
        sa.text("""
            UPDATE profile_catalog_items
            SET is_active = false
            WHERE catalog_id = (SELECT id FROM profile_catalogs WHERE code = 'LIFE_STATE')
              AND code IN (
                'LEIGO_CONSAGRADO',
                'CELIBATARIO',
                'SEMINARISTA',
                'DIACONO_PERMANENTE',
                'DIACONO',
                'BISPO'
              )
        """)
    )

    # Inserir RELIGIOSO (sort_order = 2, entre LEIGO=1 e SACERDOTE=7)
    conn.execute(
        sa.text("""
            INSERT INTO profile_catalog_items (id, catalog_id, code, label, sort_order)
            SELECT
                gen_random_uuid(),
                (SELECT id FROM profile_catalogs WHERE code = 'LIFE_STATE'),
                'RELIGIOSO',
                'Religioso',
                2
            ON CONFLICT (catalog_id, code) DO NOTHING
        """)
    )

    # ── 3. MARITAL_STATUS — desativar NOIVO e CELIBATARIO ────────────────────
    conn.execute(
        sa.text("""
            UPDATE profile_catalog_items
            SET is_active = false
            WHERE catalog_id = (SELECT id FROM profile_catalogs WHERE code = 'MARITAL_STATUS')
              AND code IN ('NOIVO', 'CELIBATARIO')
        """)
    )

    # ── 4. Criar catalog REALIDADE_ATUAL ─────────────────────────────────────
    conn.execute(
        sa.text("""
            INSERT INTO profile_catalogs (id, code, name)
            VALUES (gen_random_uuid(), 'REALIDADE_ATUAL', 'Realidade Atual')
            ON CONFLICT (code) DO NOTHING
        """)
    )

    conn.execute(
        sa.text("""
            INSERT INTO profile_catalog_items (id, catalog_id, code, label, sort_order)
            SELECT
                gen_random_uuid(),
                (SELECT id FROM profile_catalogs WHERE code = 'REALIDADE_ATUAL'),
                item.code,
                item.label,
                item.sort_order
            FROM (VALUES
                ('CELIBATARIO',        'Celibatário',         1),
                ('COMUNIDADE_VIDA',    'Comunidade de Vida',  2),
                ('COMUNIDADE_ALIANCA', 'Comunidade Aliança',  3),
                ('SEMINARISTA',        'Seminarista',         4),
                ('DIACONO',            'Diácono',             5),
                ('SACERDOTE',          'Sacerdote',           6),
                ('BISPO',              'Bispo',               7)
            ) AS item(code, label, sort_order)
            ON CONFLICT (catalog_id, code) DO NOTHING
        """)
    )


def downgrade() -> None:
    conn = op.get_bind()

    # Remover colunas novas
    op.drop_column("user_profiles", "last_profile_confirmed_at")
    op.drop_column("user_profiles", "mission_org_unit_id")
    op.drop_column("user_profiles", "accommodation_options")
    op.drop_column("user_profiles", "ministry_sector_ids")
    op.drop_column("user_profiles", "realidade_atual")
    op.drop_column("user_profiles", "spouse_in_community")
    op.drop_column("user_profiles", "country")

    # Reativar itens desativados em LIFE_STATE
    conn.execute(
        sa.text("""
            UPDATE profile_catalog_items
            SET is_active = true
            WHERE catalog_id = (SELECT id FROM profile_catalogs WHERE code = 'LIFE_STATE')
              AND code IN (
                'LEIGO_CONSAGRADO',
                'CELIBATARIO',
                'SEMINARISTA',
                'DIACONO_PERMANENTE',
                'DIACONO',
                'BISPO'
              )
        """)
    )

    # Remover RELIGIOSO (inserido nesta migration)
    conn.execute(
        sa.text("""
            DELETE FROM profile_catalog_items
            WHERE catalog_id = (SELECT id FROM profile_catalogs WHERE code = 'LIFE_STATE')
              AND code = 'RELIGIOSO'
        """)
    )

    # Reativar itens desativados em MARITAL_STATUS
    conn.execute(
        sa.text("""
            UPDATE profile_catalog_items
            SET is_active = true
            WHERE catalog_id = (SELECT id FROM profile_catalogs WHERE code = 'MARITAL_STATUS')
              AND code IN ('NOIVO', 'CELIBATARIO')
        """)
    )

    # Remover catalog REALIDADE_ATUAL e seus itens (CASCADE)
    conn.execute(
        sa.text("""
            DELETE FROM profile_catalogs WHERE code = 'REALIDADE_ATUAL'
        """)
    )
