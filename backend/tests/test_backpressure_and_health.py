"""
Testes de backpressure (503 + Retry-After) e health checks (liveness/readiness).
"""

from __future__ import annotations

import pytest
from sqlalchemy.exc import OperationalError, TimeoutError as SATimeoutError
from starlette.requests import Request

from app.api.backpressure import operational_error_handler, pool_timeout_handler


def _fake_request(path: str = "/x") -> Request:
    return Request({
        "type": "http", "method": "GET", "path": path,
        "headers": [], "query_string": b"", "client": ("1.2.3.4", 0),
    })


@pytest.mark.asyncio
async def test_pool_timeout_vira_503_com_retry_after():
    exc = SATimeoutError("QueuePool limit ... connection SELECT senha=segredo")
    resp = await pool_timeout_handler(_fake_request(), exc)
    assert resp.status_code == 503
    assert resp.headers["Retry-After"] == "3"
    body = resp.body.decode()
    assert "DATABASE_BUSY" in body
    # NÃO pode vazar SQL, senha, nem o texto da exceção.
    assert "senha" not in body and "SELECT" not in body and "QueuePool" not in body


@pytest.mark.asyncio
async def test_operational_error_vira_503():
    exc = OperationalError("SELECT 1", {}, Exception("could not connect to host db.internal"))
    resp = await operational_error_handler(_fake_request(), exc)
    assert resp.status_code == 503
    assert resp.headers["Retry-After"] == "3"
    body = resp.body.decode()
    assert "DATABASE_UNAVAILABLE" in body
    assert "db.internal" not in body and "SELECT" not in body


def test_health_live_nao_toca_banco(client):
    r = client.get("/health/live")
    assert r.status_code == 200
    assert r.json()["status"] == "alive"


def test_health_ready_ok_quando_banco_responde(client):
    r = client.get("/health/ready")
    assert r.status_code == 200
    assert r.json()["database"] == "ok"


def test_health_ready_503_quando_banco_cai(client, monkeypatch):
    """Se o SELECT 1 falha, readiness devolve 503 sem vazar detalhes."""
    import app.db.session as sess

    class _BoomEngine:
        def connect(self):
            raise OperationalError("SELECT 1", {}, Exception("connection refused to secret-host"))

    monkeypatch.setattr(sess, "engine", _BoomEngine())
    r = client.get("/health/ready")
    assert r.status_code == 503
    body = r.json()
    assert body["status"] == "not_ready"
    assert "secret-host" not in r.text


# ---------------------------------------------------------------------------
# Integração END-TO-END: esgotamento de pool → 503 → recuperação (item 6.1)
# ---------------------------------------------------------------------------
def test_pool_exhaustion_end_to_end_503_e_recuperacao():
    """
    Esgota um pool de 1 conexão segurando-a, faz uma request autenticada (que
    precisa de conexão), e confirma que o backpressure devolve 503 controlado —
    depois libera a conexão e confirma a RECUPERAÇÃO.
    """
    import tempfile
    import uuid
    from datetime import datetime, timezone

    from fastapi.testclient import TestClient
    from sqlalchemy import create_engine
    from sqlalchemy.orm import sessionmaker
    from sqlalchemy.pool import QueuePool
    from sqlalchemy.dialects.sqlite.base import SQLiteTypeCompiler

    SQLiteTypeCompiler.visit_UUID = lambda self, type_, **kw: "TEXT"
    SQLiteTypeCompiler.visit_JSONB = lambda self, type_, **kw: "TEXT"
    SQLiteTypeCompiler.visit_ARRAY = lambda self, type_, **kw: "TEXT"

    from app.api.deps import get_db as deps_get_db
    from app.db.models import Base, LegalDocument
    from app.db.session import get_db as session_get_db
    from app.main import app

    fd = tempfile.NamedTemporaryFile(suffix=".db", delete=False)
    fd.close()
    # Pool minúsculo: 1 conexão, sem overflow, timeout curto — para esgotar rápido.
    engine = create_engine(
        f"sqlite:///{fd.name}",
        connect_args={"check_same_thread": False},
        poolclass=QueuePool,
        pool_size=1,
        max_overflow=0,
        pool_timeout=1,
    )
    Base.metadata.create_all(bind=engine)
    SL = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    with SL() as s:
        for t, v in (("TERMS", "1"), ("PRIVACY", "1")):
            s.add(LegalDocument(id=uuid.uuid4(), type=t, version=v, content="x",
                                published_at=datetime(2026, 1, 1, tzinfo=timezone.utc)))
        s.commit()

    def override():
        db = SL()
        try:
            yield db
        finally:
            db.close()

    app.dependency_overrides[deps_get_db] = override
    app.dependency_overrides[session_get_db] = override
    # Usamos /legal/latest de propósito: é uma rota que usa UMA sessão por
    # request (dependency DBSession, sem CurrentUser), então o teste isola o
    # backpressure de qualquer variação de nº de conexões por request.
    try:
        with TestClient(app) as client:
            # baseline: com a conexão livre, a rota funciona
            assert client.get("/legal/latest").status_code == 200

            # SEGURA a única conexão do pool
            held = engine.connect()
            try:
                r = client.get("/legal/latest")
                # backpressure: 503 controlado (não 500), com Retry-After e código
                assert r.status_code == 503, f"esperava 503, veio {r.status_code}"
                assert r.headers.get("Retry-After") == "3"
                assert r.json()["detail"]["error"] == "DATABASE_BUSY"
                # não vaza SQL/driver/host
                assert "sqlite" not in r.text.lower() and "SELECT" not in r.text
            finally:
                held.close()  # libera a conexão

            # RECUPERAÇÃO: com a conexão de volta, a próxima request funciona
            assert client.get("/legal/latest").status_code == 200
            # liveness nunca dependeu do banco
            assert client.get("/health/live").status_code == 200
    finally:
        app.dependency_overrides.clear()
        engine.dispose()
        import os
        try:
            os.unlink(fd.name)
        except OSError:
            pass
