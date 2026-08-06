"""
Cache em processo do documento legal "mais recente" por tipo.

Motivação (perf): as rotas quentes ``GET /auth/me`` e ``GET /legal/latest``
consultam o documento legal mais recente (``ORDER BY published_at DESC LIMIT 1``)
a cada request — 2 queries cada, em todo carregamento do app.

Invalidação segura: uma nova versão só se torna a "latest" via migration Alembic,
executada no boot (``start.sh``), que **reinicia o processo** e limpa este cache
em memória. O TTL curto é defesa adicional contra inserções fora do fluxo padrão.
Portanto não há risco de servir consentimento/versão desatualizada por tempo
relevante. O snapshot é imutável e não depende de sessão (evita DetachedInstance).
"""
import time
from dataclasses import dataclass
from datetime import datetime
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.models import LegalDocument

_TTL_SECONDS = 300.0

# doc_type -> (monotonic_ts, snapshot | None)
_cache: dict[str, tuple[float, "LegalDocSnapshot | None"]] = {}


@dataclass(frozen=True)
class LegalDocSnapshot:
    id: Any
    type: str
    version: str
    content: str
    published_at: datetime


def get_latest_legal_document(db: Session, doc_type: str) -> "LegalDocSnapshot | None":
    """Retorna o documento legal mais recente do tipo, usando cache em processo."""
    now = time.monotonic()
    cached = _cache.get(doc_type)
    if cached is not None and (now - cached[0]) < _TTL_SECONDS:
        return cached[1]

    doc = db.scalars(
        select(LegalDocument)
        .where(LegalDocument.type == doc_type)
        .order_by(LegalDocument.published_at.desc())
        .limit(1)
    ).first()

    snap: "LegalDocSnapshot | None" = (
        LegalDocSnapshot(
            id=doc.id,
            type=doc.type,
            version=doc.version,
            content=doc.content,
            published_at=doc.published_at,
        )
        if doc is not None
        else None
    )
    _cache[doc_type] = (now, snap)
    return snap


def clear_legal_cache() -> None:
    """Limpa o cache. Usado em testes (isolamento) e disponível para invalidação manual."""
    _cache.clear()
