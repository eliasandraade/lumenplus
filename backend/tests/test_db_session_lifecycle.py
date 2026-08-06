"""
Regressão FUNCIONAL — uma sessão por request (lifecycle).

Mede quantas SESSÕES são criadas ao servir um request. Este é o sinal direto de
duplicação de dependency e NÃO depende de detalhes frágeis do pool (reuso de
conexão física). Antes do fix, /auth/me criava 2 sessões (deps.get_db +
session.get_db, callables distintos). Depois, cria 1.
"""

from __future__ import annotations

import threading
import uuid
from datetime import datetime, timezone

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, event
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
from sqlalchemy.dialects.sqlite.base import SQLiteTypeCompiler

SQLiteTypeCompiler.visit_UUID = lambda self, type_, **kw: "TEXT"
SQLiteTypeCompiler.visit_JSONB = lambda self, type_, **kw: "TEXT"
SQLiteTypeCompiler.visit_ARRAY = lambda self, type_, **kw: "TEXT"

from app.api.deps import get_db as deps_get_db
from app.db.models import Base, LegalDocument
from app.db.session import get_db as session_get_db
from app.main import app

TOKEN = {"Authorization": "Bearer dev:lifecycle-user:lifecycle@synthetic.invalid"}


@pytest.fixture()
def counting_client():
    """
    Client com engine próprio e um override de get_db que CONTA sessões criadas
    e rastreia checkouts/checkins do pool. Expõe os contadores para asserção.
    """
    # StaticPool: uma única conexão in-memory compartilhada entre as threads do
    # threadpool (rotas `def`). Sem isso, cada thread veria um banco vazio.
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(bind=engine)
    TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

    with TestingSessionLocal() as s:
        for t, v in (("TERMS", "1.0-life"), ("PRIVACY", "1.0-life")):
            s.add(LegalDocument(id=uuid.uuid4(), type=t, version=v, content="x",
                                published_at=datetime(2026, 1, 1, tzinfo=timezone.utc)))
        s.commit()

    state = {
        "sessions_created": 0,
        "checkouts": 0,
        "checkins": 0,
        "lock": threading.Lock(),
        "count_enabled": False,
    }

    @event.listens_for(engine, "checkout")
    def _co(*a):  # noqa: ANN001
        with state["lock"]:
            state["checkouts"] += 1

    @event.listens_for(engine, "checkin")
    def _ci(*a):  # noqa: ANN001
        with state["lock"]:
            state["checkins"] += 1

    def override_get_db():
        if state["count_enabled"]:
            with state["lock"]:
                state["sessions_created"] += 1
        db = TestingSessionLocal()
        try:
            yield db
        finally:
            db.close()

    # Chave dupla de propósito: se algum dia deps.get_db e session.get_db
    # voltarem a divergir, ambos os overrides continuam medindo.
    app.dependency_overrides[deps_get_db] = override_get_db
    app.dependency_overrides[session_get_db] = override_get_db

    with TestClient(app) as client:
        yield client, state

    app.dependency_overrides.clear()
    engine.dispose()


def _reset(state):
    with state["lock"]:
        state["sessions_created"] = 0
        state["count_enabled"] = True


def test_um_request_autenticado_cria_uma_unica_sessao(counting_client):
    client, state = counting_client
    # warm-up: provisiona o usuário (não medido)
    assert client.get("/auth/me", headers=TOKEN).status_code == 200

    _reset(state)
    r = client.get("/auth/me", headers=TOKEN)
    assert r.status_code == 200
    assert state["sessions_created"] == 1, (
        f"/auth/me criou {state['sessions_created']} sessoes; esperado 1. "
        f">1 significa que a duplicacao de dependency voltou."
    )


def test_nenhuma_conexao_vaza_apos_requests(counting_client):
    client, state = counting_client
    client.get("/auth/me", headers=TOKEN)  # warm-up

    for _ in range(20):
        client.get("/auth/me", headers=TOKEN)

    # Toda conexão retirada foi devolvida (sem vazamento).
    assert state["checkouts"] == state["checkins"], (
        f"vazamento: {state['checkouts']} checkouts x {state['checkins']} checkins"
    )


def test_dez_requests_concorrentes_uma_sessao_cada(counting_client):
    client, state = counting_client
    client.get("/auth/me", headers=TOKEN)  # warm-up provisiona o usuário

    results: list[int] = []
    lock = threading.Lock()

    def hit():
        r = client.get("/auth/me", headers=TOKEN)
        with lock:
            results.append(r.status_code)

    _reset(state)  # começa a contar sessões só a partir daqui
    threads = [threading.Thread(target=hit) for _ in range(10)]
    for t in threads:
        t.start()
    for t in threads:
        t.join()

    assert results == [200] * 10, f"nem todas OK: {results}"
    # Sinal ROBUSTO (thread-safe, independente de reuso de conexão física):
    # 10 requests => 10 sessões, uma por request. Se a duplicação voltar, seriam 20.
    assert state["sessions_created"] == 10, (
        f"10 requests criaram {state['sessions_created']} sessoes; esperado 10. "
        f"20 significaria duas sessoes por request (bug de volta)."
    )


def test_auth_invalida_nao_vaza_conexao(counting_client):
    client, state = counting_client
    r = client.get("/auth/me", headers={"Authorization": "Bearer lixo"})
    assert r.status_code == 401
    # Mesmo no caminho de erro, nada fica retido.
    assert state["checkouts"] == state["checkins"], (
        f"vazamento no caminho 401: {state['checkouts']} x {state['checkins']}"
    )
