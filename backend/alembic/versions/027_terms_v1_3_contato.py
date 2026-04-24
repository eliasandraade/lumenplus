"""Termos de Uso v1.3 — atualiza email de contato da seção 15

Revision ID: 027_terms_v1_3_contato
Revises: 026_fix_catalog_items
Create Date: 2026-04-23

Mudança em relação à v1.2:
  - Seção 15 (CONTATO): juridico@obralumen.org.br → comunicacao@lumenserfeliz.org

Apenas os Termos de Uso mudam; a Política de Privacidade permanece em v1.3.
Todos os usuários serão solicitados a aceitar os novos Termos de Uso.
"""

import uuid
from datetime import datetime, timezone
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

from app.legal_content import TERMS_V1_3

revision: str = "027_terms_v1_3_contato"
down_revision: Union[str, None] = "026_fix_catalog_items"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

PUBLISHED_AT = datetime(2026, 4, 23, 0, 0, 0, tzinfo=timezone.utc)


def upgrade() -> None:
    conn = op.get_bind()

    existing = conn.execute(
        sa.text("SELECT id FROM legal_documents WHERE type = 'TERMS' AND version = '1.3'")
    ).fetchone()

    if existing:
        conn.execute(
            sa.text(
                "UPDATE legal_documents SET content = :c WHERE type = 'TERMS' AND version = '1.3'"
            ),
            {"c": TERMS_V1_3},
        )
    else:
        conn.execute(
            sa.text(
                "INSERT INTO legal_documents (id, type, version, content, published_at) "
                "VALUES (:id, :type, :version, :content, :published_at)"
            ),
            {
                "id": str(uuid.uuid4()),
                "type": "TERMS",
                "version": "1.3",
                "content": TERMS_V1_3,
                "published_at": PUBLISHED_AT,
            },
        )


def downgrade() -> None:
    op.execute("DELETE FROM legal_documents WHERE version = '1.3' AND type = 'TERMS'")
