"""Limpa e reinsere catálogos de perfil com as opções corretas

Remove itens legados (Noviça, Religioso, Sacerdote Religioso, Sacerdote Diocesano)
e garante que apenas os itens corretos existam, sem duplicatas.

Estado de Vida (8): Leigo, Leigo Consagrado, Celibatário, Seminarista,
  Diácono Permanente, Diácono, Sacerdote, Bispo

Estado Civil (7): Solteiro, Noivo, Casado, Celibatário, Divorciado, Viúvo,
  União Estável

Realidade Vocacional (7): sem alterações

Revision ID: 026_fix_catalog_items
Revises: 025_seed_catalogs
Create Date: 2026-04-20
"""

from typing import Sequence, Union
from alembic import op

revision: str = "026_fix_catalog_items"
down_revision: Union[str, None] = "025_seed_catalogs"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ── Limpa tudo dos três catálogos e reinsere do zero ─────────────────────
    op.execute("""
        DELETE FROM profile_catalog_items
        WHERE catalog_id IN (
            SELECT id FROM profile_catalogs
            WHERE code IN ('LIFE_STATE', 'MARITAL_STATUS', 'VOCATIONAL_REALITY')
        );
    """)

    # ── ESTADO DE VIDA (8 itens) ──────────────────────────────────────────────
    op.execute("""
        INSERT INTO profile_catalog_items (id, catalog_id, code, label, sort_order)
        SELECT
            gen_random_uuid(),
            (SELECT id FROM profile_catalogs WHERE code = 'LIFE_STATE'),
            item.code,
            item.label,
            item.sort_order
        FROM (VALUES
            ('LEIGO',              'Leigo',              1),
            ('LEIGO_CONSAGRADO',   'Leigo Consagrado',   2),
            ('CELIBATARIO',        'Celibatário',        3),
            ('SEMINARISTA',        'Seminarista',        4),
            ('DIACONO_PERMANENTE', 'Diácono Permanente', 5),
            ('DIACONO',            'Diácono',            6),
            ('SACERDOTE',          'Sacerdote',          7),
            ('BISPO',              'Bispo',              8)
        ) AS item(code, label, sort_order);
    """)

    # ── ESTADO CIVIL (7 itens) ────────────────────────────────────────────────
    op.execute("""
        INSERT INTO profile_catalog_items (id, catalog_id, code, label, sort_order)
        SELECT
            gen_random_uuid(),
            (SELECT id FROM profile_catalogs WHERE code = 'MARITAL_STATUS'),
            item.code,
            item.label,
            item.sort_order
        FROM (VALUES
            ('SOLTEIRO',      'Solteiro',      1),
            ('NOIVO',         'Noivo',         2),
            ('CASADO',        'Casado',        3),
            ('CELIBATARIO',   'Celibatário',   4),
            ('DIVORCIADO',    'Divorciado',    5),
            ('VIUVO',         'Viúvo',         6),
            ('UNIAO_ESTAVEL', 'União Estável', 7)
        ) AS item(code, label, sort_order);
    """)

    # ── REALIDADE VOCACIONAL (7 itens) ────────────────────────────────────────
    op.execute("""
        INSERT INTO profile_catalog_items (id, catalog_id, code, label, sort_order)
        SELECT
            gen_random_uuid(),
            (SELECT id FROM profile_catalogs WHERE code = 'VOCATIONAL_REALITY'),
            item.code,
            item.label,
            item.sort_order
        FROM (VALUES
            ('MEMBRO_ACOLHIDA',         'Membro do Acolhida',         1),
            ('MEMBRO_APROFUNDAMENTO',   'Membro do Aprofundamento',   2),
            ('VOCACIONAL',              'Vocacional',                 3),
            ('POSTULANTE_PRIMEIRO_ANO', 'Postulante de Primeiro Ano', 4),
            ('POSTULANTE_SEGUNDO_ANO',  'Postulante de Segundo Ano',  5),
            ('DISCIPULO_VOCACIONAL',    'Discípulo Vocacional',       6),
            ('CONSAGRADO_FILHO_DA_LUZ', 'Consagrado Filho da Luz',    7)
        ) AS item(code, label, sort_order);
    """)


def downgrade() -> None:
    # Sem downgrade seguro — dados anteriores eram inválidos
    pass
