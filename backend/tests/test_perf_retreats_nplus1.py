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
    q50 = measure(50)
    slope = (q50 - q10) / 40
    # Pós-batch completo, /retreats é CONSTANTE: query count independe do nº de
    # retiros (medido: 12 em 1, 10 e 50). Exigimos slope ~0 entre 10 e 50 — a
    # faixa onde qualquer lazy-load remanescente apareceria. Pré-fix era ~6/retiro
    # (305 queries em 50); um slope > 0.2 sinaliza reintrodução de N+1.
    assert slope <= 0.2, (
        f"queries/retiro (10->50) = {slope:.2f} (q1={q1}, q10={q10}, q50={q50}); "
        f"esperado ~0 (constante). Pre-fix era ~6 — N+1 reintroduzido."
    )
    # E o count absoluto não pode explodir (guarda contra multiplicação de linhas
    # que vire muitas queries): 50 retiros devem custar o mesmo que 10.
    assert q50 <= q10 + 2, f"q50={q50} vs q10={q10}: /retreats deixou de ser constante."


def test_retreats_batch_preserva_taxa_e_inscricao():
    """
    O batch de fee_types/registrations deve devolver EXATAMENTE os mesmos dados
    que o acesso por-retiro devolvia: categoria/valor de taxa e status de inscrição.
    """
    engine = create_engine("sqlite://", connect_args={"check_same_thread": False},
                           poolclass=StaticPool)
    Base.metadata.create_all(bind=engine)
    SL = sessionmaker(autocommit=False, autoflush=False, bind=engine)

    def override():
        db = SL()
        try:
            yield db
        finally:
            db.close()

    app.dependency_overrides[deps_get_db] = override
    app.dependency_overrides[session_get_db] = override
    try:
        with SL() as db:
            u = M.User(is_active=True)
            db.add(u)
            db.flush()
            db.add(M.UserIdentity(user_id=u.id, provider="firebase", provider_uid="retreat-perf",
                                  email="retreat-perf@synthetic.invalid"))
            db.add(M.UserProfile(user_id=u.id, status="COMPLETE"))  # sem voc → PARTICIPANTE
            r = M.Retreat(
                title="Com taxa", retreat_type=M.RetreatType.WEEKEND,
                status=M.RetreatStatus.PUBLISHED, visibility_type=M.RetreatVisibilityType.ALL,
                start_date=datetime(2026, 12, 1, tzinfo=timezone.utc),
                end_date=datetime(2026, 12, 3, tzinfo=timezone.utc),
            )
            db.add(r)
            db.flush()
            # taxa PARTICIPANTE = 150; inscrição existente do usuário
            db.add(M.RetreatFeeType(retreat_id=r.id, fee_category="PARTICIPANTE", amount_brl="150"))
            db.add(M.RetreatRegistration(retreat_id=r.id, user_id=u.id,
                                         status=M.RegistrationStatus.PENDING_PAYMENT))
            db.commit()

        with TestClient(app) as client:
            client.get("/auth/me", headers=HDR)
            resp = client.get("/retreats", headers=HDR)
            assert resp.status_code == 200, resp.text
            retreats = resp.json()["retreats"]
            assert len(retreats) == 1, retreats
            item = retreats[0]
            # Taxa correta (categoria + valor do batch)
            assert item["my_fee"]["fee_category"] == "PARTICIPANTE"
            assert item["my_fee"]["amount_brl"] == "150"
            # Inscrição refletida (o batch de registrations achou a do usuário)
            assert item.get("my_registration") is not None, f"inscrição não refletida: {item}"
            assert item["my_registration"]["status"] == "PENDING_PAYMENT"
    finally:
        app.dependency_overrides.clear()
        engine.dispose()
