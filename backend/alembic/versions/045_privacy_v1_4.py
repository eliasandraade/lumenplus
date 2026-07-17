"""Política de Privacidade v1.4 — Encarregado (DPO) atualizado

Revision ID: 045_privacy_v1_4
Revises: 044_pvm_evangelizacao_acoes
Create Date: 2026-07-17

Mudança em relação à v1.3:
  - Encarregado (DPO): Elias Sales de Freitas -> Felipe Rocha Pinheiro Bastos
  - Canal de contato do DPO: e-mail pessoal anterior -> canal institucional
    lgpd@lumenserfeliz.org (seções 13 e 15)

Aprovada pelo Encarregado em 2026-07-16 (LGPD-02 / LGPD-06). Apenas a Política de
Privacidade muda; os Termos de Uso permanecem. Ao aplicar, todos os usuários serão
solicitados a re-aceitar a Política no próximo /auth/me (pending_privacy=true).

ATENÇÃO (deploy humano/gated): rodar esta migration em PRODUÇÃO força TODOS os
usuários a re-aceitar a Política e desloga quem recusar. Confirmar vigência,
janela e comunicação antes de deployar (Deploy Seguro — CLAUDE.md).
"""

import uuid
from datetime import datetime, timezone
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

from app.legal_content import PRIVACY_V1_4

revision: str = "045_privacy_v1_4"
down_revision: Union[str, None] = "044_pvm_evangelizacao_acoes"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

# Deve ser mais recente que a v1.3 (2026-03-20) para se tornar a "latest".
PUBLISHED_AT = datetime(2026, 7, 17, 0, 0, 0, tzinfo=timezone.utc)


def upgrade() -> None:
    conn = op.get_bind()

    existing = conn.execute(
        sa.text("SELECT id FROM legal_documents WHERE type = 'PRIVACY' AND version = '1.4'")
    ).fetchone()

    if existing:
        conn.execute(
            sa.text(
                "UPDATE legal_documents SET content = :c WHERE type = 'PRIVACY' AND version = '1.4'"
            ),
            {"c": PRIVACY_V1_4},
        )
    else:
        conn.execute(
            sa.text(
                "INSERT INTO legal_documents (id, type, version, content, published_at) "
                "VALUES (:id, :type, :version, :content, :published_at)"
            ),
            {
                "id": str(uuid.uuid4()),
                "type": "PRIVACY",
                "version": "1.4",
                "content": PRIVACY_V1_4,
                "published_at": PUBLISHED_AT,
            },
        )


def downgrade() -> None:
    op.execute("DELETE FROM legal_documents WHERE version = '1.4' AND type = 'PRIVACY'")
