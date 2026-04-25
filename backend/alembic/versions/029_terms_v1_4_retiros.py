"""Termos de Uso v1.4 — nova cláusula 7-A: dados históricos de retiros

Revision ID: 029_terms_v1_4_retiros
Revises: 028_profile_overhaul
Create Date: 2026-04-24

Mudança em relação à v1.3:
  - Nova cláusula 7-A: autorização expressa para tratamento de dados históricos
    de participação em retiros anteriores ao Lumen+ (e-mail, data de inscrição,
    data do retiro, forma de pagamento, valor pago). Base legal: LGPD art. 7º, I.

Apenas os Termos de Uso mudam; a Política de Privacidade permanece em v1.3.
Todos os usuários serão solicitados a aceitar os novos Termos de Uso.
"""

import uuid
from datetime import datetime, timezone
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

from app.legal_content import TERMS_V1_4

revision: str = "029_terms_v1_4_retiros"
down_revision: Union[str, None] = "028_profile_overhaul"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

PUBLISHED_AT = datetime(2026, 4, 24, 0, 0, 0, tzinfo=timezone.utc)


def upgrade() -> None:
    conn = op.get_bind()

    existing = conn.execute(
        sa.text("SELECT id FROM legal_documents WHERE type = 'TERMS' AND version = '1.4'")
    ).fetchone()

    if existing:
        conn.execute(
            sa.text(
                "UPDATE legal_documents SET content = :c WHERE type = 'TERMS' AND version = '1.4'"
            ),
            {"c": TERMS_V1_4},
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
                "version": "1.4",
                "content": TERMS_V1_4,
                "published_at": PUBLISHED_AT,
            },
        )


def downgrade() -> None:
    op.execute("DELETE FROM legal_documents WHERE version = '1.4' AND type = 'TERMS'")
