"""
Test Configuration
==================
Fixtures e configurações para pytest.
"""

import os
import tempfile
from typing import Generator

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker

# Configura ambiente de teste ANTES de importar app
os.environ["ENVIRONMENT"] = "test"
os.environ["AUTH_MODE"] = "DEV"
os.environ["ENABLE_DEV_ENDPOINTS"] = "true"
os.environ["DEBUG_VERIFICATION_CODE"] = "true"
os.environ["DATABASE_URL"] = "sqlite:///:memory:"
os.environ["ENCRYPTION_KEY"] = "mpmaPE3k4WEOi1s3ICSai0dOBj04mnkwFXO+Isksys8="  # 32 bytes base64
os.environ["HMAC_PEPPER"] = "WWtxHP65cwXkDDXNsKILWTuA4LQNmrRaICQ3rgNsjfE="  # 32 bytes base64

from app.api.deps import get_db as deps_get_db
from app.db.models import Base
from app.db.session import get_db as session_get_db
from app.main import app

# SQLite não suporta tipos específicos do PostgreSQL (UUID, JSONB, ARRAY).
# Este patch ensina o compilador SQLite a tratar todos como TEXT,
# permitindo que Base.metadata.create_all() funcione em testes.
from sqlalchemy.dialects.sqlite.base import SQLiteTypeCompiler  # noqa: E402

SQLiteTypeCompiler.visit_UUID = lambda self, type_, **kw: "TEXT"  # noqa: E305
SQLiteTypeCompiler.visit_JSONB = lambda self, type_, **kw: "TEXT"
SQLiteTypeCompiler.visit_ARRAY = lambda self, type_, **kw: "TEXT"


# =============================================================================
# DATABASE FIXTURES
# =============================================================================
@pytest.fixture(scope="function")
def db_engine():
    """Cria engine de teste com SQLite em arquivo temporário (thread-safe)."""
    with tempfile.NamedTemporaryFile(suffix=".db", delete=False) as f:
        db_path = f.name
    engine = create_engine(
        f"sqlite:///{db_path}",
        connect_args={"check_same_thread": False},
    )
    Base.metadata.create_all(bind=engine)
    yield engine
    engine.dispose()
    os.unlink(db_path)


@pytest.fixture(scope="function")
def db_session(db_engine) -> Generator[Session, None, None]:
    """Cria sessão de teste."""
    TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=db_engine)
    session = TestingSessionLocal()
    try:
        yield session
    finally:
        session.close()


@pytest.fixture(scope="function")
def client(db_engine) -> Generator[TestClient, None, None]:
    """Cliente de teste com banco isolado."""
    TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=db_engine)

    def override_get_db():
        db = TestingSessionLocal()
        try:
            yield db
        finally:
            db.close()

    app.dependency_overrides[deps_get_db] = override_get_db
    app.dependency_overrides[session_get_db] = override_get_db

    with TestClient(app) as test_client:
        yield test_client

    app.dependency_overrides.clear()


# =============================================================================
# TEST ISOLATION
# =============================================================================
@pytest.fixture(autouse=True)
def _reset_rate_limit_cache():
    """
    Isola o rate limiter entre testes (H6).

    RateLimitMiddleware usa um dict global de módulo (_fallback_cache) quando o
    Redis não está disponível — o caso dos testes. Sem reset, as contagens por
    token acumulam ao longo da sessão (que roda dentro da janela de 60s); tokens
    reutilizados (ex.: auth_headers) estouram rate_limit_requests_per_minute e
    geram 429 espúrios nos testes mais tardios (flakes dependentes de ordem).
    Limpar antes/depois de cada teste garante isolamento. NÃO desativa o rate
    limiting — comportamento de produção inalterado.
    """
    from app.middlewares import rate_limit as _rl

    _rl._fallback_cache.clear()
    yield
    _rl._fallback_cache.clear()


@pytest.fixture(autouse=True)
def _reset_legal_cache():
    """Isola o cache em processo de documentos legais entre testes.

    Cada teste usa um banco novo; sem reset, o snapshot cacheado de um teste
    vazaria para o próximo (que tem outro banco). Não altera comportamento de
    produção — apenas garante isolamento nos testes.
    """
    from app.services.legal_cache import clear_legal_cache

    clear_legal_cache()
    yield
    clear_legal_cache()


# =============================================================================
# AUTH FIXTURES
# =============================================================================
@pytest.fixture
def auth_headers() -> dict:
    """Headers de autenticação para usuário de teste."""
    return {"Authorization": "Bearer dev:test-user:test@example.com"}


@pytest.fixture
def admin_headers() -> dict:
    """Headers de autenticação para admin."""
    return {"Authorization": "Bearer dev:admin:admin@example.com"}


@pytest.fixture
def secretary_headers() -> dict:
    """Headers de autenticação para secretaria."""
    return {"Authorization": "Bearer dev:secretary:secretary@example.com"}


# =============================================================================
# DATA FIXTURES
# =============================================================================
@pytest.fixture
def seeded_db(client: TestClient, admin_headers: dict) -> None:
    """Popula banco com dados de seed."""
    response = client.post("/dev/seed", headers=admin_headers)
    assert response.status_code == 200


@pytest.fixture
def sample_profile_data() -> dict:
    """Dados de perfil para testes."""
    return {
        "full_name": "João da Silva",
        "birth_date": "1990-01-15",
        "cpf": "123.456.789-00",
        "rg": "12.345.678-9",
        "phone_e164": "+5511999999999",
        "city": "São Paulo",
        "state": "SP",
        "life_state_item_id": None,  # Será preenchido após seed
        "marital_status_item_id": None,
        "vocational_reality_item_id": None,
    }
