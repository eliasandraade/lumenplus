"""
Regressão de N+1 em GET /retreats.

Antes do fix, a rota fazia ~6 queries por retiro publicado (305 para 50 retiros).
O fix (eager-load de houses/eligibility_rules + hoist da realidade vocacional
para fora do laço) baixou para ~3 queries/retiro. Este teste trava o slope: se
alguém reintroduzir lazy-loads no laço, o crescimento por retiro estoura o limite.

Conta QUERIES (before_cursor_execute) — independe do banco.
"""

from __future__ import annotations

from datetime import datetime, timezone


from fastapi.testclient import TestClient
from sqlalchemy import create_engine, event
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
from sqlalchemy.dialects.sqlite.base import SQLiteTypeCompiler

SQLiteTypeCompiler.visit_UUID = lambda self, type_, **kw: "TEXT"
SQLiteTypeCompiler.visit_JSONB = lambda self, type_, **kw: "TEXT"
SQLiteTypeCompiler.visit_ARRAY = lambda self, type_, **kw: "TEXT"

from app.api.deps import get_db as deps_get_db
from app.db import models as M
from app.db.models import Base
from app.db.session import get_db as session_get_db
from app.main import app

HDR = {"Authorization": "Bearer dev:retreat-perf:retreat-perf@synthetic.invalid"}
_q = {"n": 0}


def _seed(SL, n_retreats: int):
    with SL() as db:
        u = M.User(is_active=True)
        db.add(u)
        db.flush()
        db.add(M.UserIdentity(user_id=u.id, provider="firebase", provider_uid="retreat-perf",
                              email="retreat-perf@synthetic.invalid"))
        db.add(M.UserProfile(user_id=u.id, status="COMPLETE"))
        role = M.GlobalRole(code="ADMIN", name="ADMIN")
        db.add(role)
        db.flush()
        db.add(M.UserGlobalRole(user_id=u.id, global_role_id=role.id))
        for i in range(n_retreats):
            db.add(M.Retreat(
                title=f"R{i}", retreat_type=M.RetreatType.WEEKEND,
                status=M.RetreatStatus.PUBLISHED, visibility_type=M.RetreatVisibilityType.ALL,
                start_date=datetime(2026, 12, 1, tzinfo=timezone.utc),
                end_date=datetime(2026, 12, 3, tzinfo=timezone.utc),
            ))
        db.commit()


def test_retreats_por_retiro_abaixo_do_limite():
    """Slope de queries por retiro <= 4 (pós-fix ~3; pré-fix era ~6)."""
    def measure(n):
        engine = create_engine("sqlite://", connect_args={"check_same_thread": False},
                               poolclass=StaticPool)
        Base.metadata.create_all(bind=engine)
        SL = sessionmaker(autocommit=False, autoflush=False, bind=engine)

        @event.listens_for(engine, "before_cursor_execute")
        def _c(conn, cursor, statement, params, context, executemany):  # noqa: ANN001
            _q["n"] += 1

        def override():
            db = SL()
            try:
                yield db
            finally:
                db.close()

        app.dependency_overrides[deps_get_db] = override
        app.dependency_overrides[session_get_db] = override
        with TestClient(app) as client:
            _seed(SL, n)
            client.get("/auth/me", headers=HDR)
            _q["n"] = 0
            r = client.get("/retreats", headers=HDR)
            assert r.status_code == 200
            q = _q["n"]
        app.dependency_overrides.clear()
        engine.dispose()
        return q

    q1 = measure(1)
    q10 = measure(10)
    slope = (q10 - q1) / 9
    assert slope <= 4, (
        f"queries/retiro = {slope:.1f} (q1={q1}, q10={q10}); esperado <= 4. "
        f"Pre-fix era ~6 — provavel reintroducao de lazy-load no laco."
    )
