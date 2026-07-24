"""Database session management."""

from collections.abc import Generator
from contextlib import contextmanager

from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker

from app.settings import settings

# SQLite (usado nos testes) não suporta pool_size/max_overflow.
# Para qualquer outro banco (PostgreSQL em dev/prod) os parâmetros são aplicados.
_is_sqlite = settings.database_url.startswith("sqlite")


def _pg_options() -> dict:
    """
    Backpressure aplicado por conexão (PostgreSQL).

    Medido em 2026-07-24 no Postgres de staging: `statement_timeout` e
    `idle_in_transaction_session_timeout` estavam ambos em 0 (desabilitados).
    Sem eles, uma query patológica roda para sempre e uma transação ociosa
    vaza a conexão — em ambos os casos o pool esgota e a saturação vira
    indisponibilidade em vez de lentidão.

    Definidos via `options` do libpq, então valem só para as conexões desta
    aplicação: migrations e jobs que usem outra conexão não são afetados.
    """
    opts = (
        f"-c statement_timeout={settings.database_statement_timeout_ms} "
        f"-c idle_in_transaction_session_timeout={settings.database_idle_tx_timeout_ms}"
    )
    return {"options": opts}


engine = create_engine(
    settings.database_url,
    pool_pre_ping=not _is_sqlite,
    **(
        {}
        if _is_sqlite
        else {
            "pool_size": settings.database_pool_size,
            "max_overflow": settings.database_max_overflow,
            # Falha rápido em vez de enfileirar 30s (default do SQLAlchemy)
            # quando o pool está saturado.
            "pool_timeout": settings.database_pool_timeout,
            "pool_recycle": settings.database_pool_recycle,
            "connect_args": _pg_options(),
        }
    ),
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def get_db() -> Generator[Session, None, None]:
    """Dependency para obter sessão do banco."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


@contextmanager
def get_db_session() -> Generator[Session, None, None]:
    """Context manager para sessões independentes (ex: BackgroundTasks, scheduler)."""
    db = SessionLocal()
    try:
        yield db
        db.commit()
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()
