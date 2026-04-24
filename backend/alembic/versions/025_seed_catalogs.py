"""Seed dos catálogos de perfil: Estado de Vida, Estado Civil, Realidade Vocacional

Banco novo — tabelas existem mas sem dados.
Mudanças no Estado de Vida: removidos Noviça, Religioso, Sacerdote Religioso e
Sacerdote Diocesano; adicionado Celibatário.
Estado Civil: adicionado Celibatário.
Realidade Vocacional: mantida sem alterações.

Revision ID: 025_seed_catalogs
Revises: 024_truncate_life_plan_data
Create Date: 2026-04-20
"""

from typing import Sequence, Union
from alembic import op

revision: str = "025_seed_catalogs"
down_revision: Union[str, None] = "024_truncate_life_plan_data"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ── 1. Inserir os 3 catálogos pai ────────────────────────────────────────
    op.execute("""
        INSERT INTO profile_catalogs (id, code, name)
        VALUES
            (gen_random_uuid(), 'LIFE_STATE',          'Estado de Vida'),
            (gen_random_uuid(), 'MARITAL_STATUS',      'Estado Civil'),
            (gen_random_uuid(), 'VOCATIONAL_REALITY',  'Realidade Vocacional')
        ON CONFLICT (code) DO NOTHING;
    """)

    # ── 2. ESTADO DE VIDA ─────────────────────────────────────────────────────
    # Leigo, Leigo Consagrado, Celibatário, Seminarista,
    # Diácono Permanente, Diácono, Sacerdote, Bispo
    op.execute("""
        INSERT INTO profile_catalog_items (id, catalog_id, code, label, sort_order)
        SELECT
            gen_random_uuid(),
            (SELECT id FROM profile_catalogs WHERE code = 'LIFE_STATE'),
            item.code,
            item.label,
            item.sort_order
        FROM (VALUES
            ('LEIGO',               'Leigo',               1),
            ('LEIGO_CONSAGRADO',    'Leigo Consagrado',    2),
            ('CELIBATARIO',         'Celibatário',         3),
            ('SEMINARISTA',         'Seminarista',         4),
            ('DIACONO_PERMANENTE',  'Diácono Permanente',  5),
            ('DIACONO',             'Diácono',             6),
            ('SACERDOTE',           'Sacerdote',           7),
            ('BISPO',               'Bispo',               8)
        ) AS item(code, label, sort_order)
        ON CONFLICT DO NOTHING;
    """)

    # ── 3. ESTADO CIVIL ───────────────────────────────────────────────────────
    # Solteiro, Noivo, Casado, Celibatário, Divorciado, Viúvo, União Estável
    op.execute("""
        INSERT INTO profile_catalog_items (id, catalog_id, code, label, sort_order)
        SELECT
            gen_random_uuid(),
            (SELECT id FROM profile_catalogs WHERE code = 'MARITAL_STATUS'),
            item.code,
            item.label,
            item.sort_order
        FROM (VALUES
            ('SOLTEIRO',       'Solteiro',       1),
            ('NOIVO',          'Noivo',          2),
            ('CASADO',         'Casado',         3),
            ('CELIBATARIO',    'Celibatário',    4),
            ('DIVORCIADO',     'Divorciado',     5),
            ('VIUVO',          'Viúvo',          6),
            ('UNIAO_ESTAVEL',  'União Estável',  7)
        ) AS item(code, label, sort_order)
        ON CONFLICT DO NOTHING;
    """)

    # ── 4. REALIDADE VOCACIONAL ───────────────────────────────────────────────
    # Mantida sem alterações
    op.execute("""
        INSERT INTO profile_catalog_items (id, catalog_id, code, label, sort_order)
        SELECT
            gen_random_uuid(),
            (SELECT id FROM profile_catalogs WHERE code = 'VOCATIONAL_REALITY'),
            item.code,
            item.label,
            item.sort_order
        FROM (VALUES
            ('MEMBRO_ACOLHIDA',          'Membro do Acolhida',          1),
            ('MEMBRO_APROFUNDAMENTO',    'Membro do Aprofundamento',    2),
            ('VOCACIONAL',               'Vocacional',                  3),
            ('POSTULANTE_PRIMEIRO_ANO',  'Postulante de Primeiro Ano',  4),
            ('POSTULANTE_SEGUNDO_ANO',   'Postulante de Segundo Ano',   5),
            ('DISCIPULO_VOCACIONAL',     'Discípulo Vocacional',        6),
            ('CONSAGRADO_FILHO_DA_LUZ',  'Consagrado Filho da Luz',     7)
        ) AS item(code, label, sort_order)
        ON CONFLICT DO NOTHING;
    """)


def downgrade() -> None:
    op.execute("""
        DELETE FROM profile_catalog_items
        WHERE catalog_id IN (
            SELECT id FROM profile_catalogs
            WHERE code IN ('LIFE_STATE', 'MARITAL_STATUS', 'VOCATIONAL_REALITY')
        );
    """)
    op.execute("""
        DELETE FROM profile_catalogs
        WHERE code IN ('LIFE_STATE', 'MARITAL_STATUS', 'VOCATIONAL_REALITY');
    """)
