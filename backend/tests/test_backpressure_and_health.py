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
