"""
Mede query count por CARDINALIDADE nas rotas read-path — auditoria de N+1.

Para cada rota, semeia 0/1/10/50 entidades e conta as queries executadas
(listener before_cursor_execute). Uma rota cujo count CRESCE com a cardinalidade
tem N+1; uma que fica CONSTANTE, não.

Ambiente: SQLite in-memory (StaticPool). É contagem de QUERIES, não latência —
o número de queries independe do banco, então isto vale para PostgreSQL também.

Uso: python performance/nplus1_probe.py
"""

from __future__ import annotations

import os
import uuid
from datetime import date, datetime, timezone

os.environ.setdefault("ENVIRONMENT", "test")
os.environ.setdefault("AUTH_MODE", "DEV")
os.environ.setdefault("ENABLE_DEV_ENDPOINTS", "true")
os.environ.setdefault("DATABASE_URL", "sqlite://")
os.environ.setdefault("ENCRYPTION_KEY", "mpmaPE3k4WEOi1s3ICSai0dOBj04mnkwFXO+Isksys8=")
os.environ.setdefault("HMAC_PEPPER", "WWtxHP65cwXkDDXNsKILWTuA4LQNmrRaICQ3rgNsjfE=")
os.environ.setdefault("RATE_LIMIT_REQUESTS_PER_MINUTE", "1000000")
os.environ.setdefault("LOG_LEVEL", "ERROR")

import sys
import pathlib
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent.parent))

from fastapi.testclient import TestClient  # noqa: E402
from sqlalchemy import create_engine, event  # noqa: E402
from sqlalchemy.orm import sessionmaker  # noqa: E402
from sqlalchemy.pool import StaticPool  # noqa: E402
from sqlalchemy.dialects.sqlite.base import SQLiteTypeCompiler  # noqa: E402

SQLiteTypeCompiler.visit_UUID = lambda self, type_, **kw: "TEXT"
SQLiteTypeCompiler.visit_JSONB = lambda self, type_, **kw: "TEXT"
SQLiteTypeCompiler.visit_ARRAY = lambda self, type_, **kw: "TEXT"

from app.api.deps import get_db as deps_get_db  # noqa: E402
from app.db import models as M  # noqa: E402
from app.db.models import Base  # noqa: E402
from app.db.session import get_db as session_get_db  # noqa: E402
from app.main import app  # noqa: E402

_q = {"n": 0}


def _reset():
    _q["n"] = 0


class Harness:
    def __init__(self):
        self.engine = create_engine("sqlite://", connect_args={"check_same_thread": False},
                                    poolclass=StaticPool)
        Base.metadata.create_all(bind=self.engine)
        self.SL = sessionmaker(autocommit=False, autoflush=False, bind=self.engine)

        @event.listens_for(self.engine, "before_cursor_execute")
        def _count(conn, cursor, statement, params, context, executemany):  # noqa: ANN001
            _q["n"] += 1

        def override():
            db = self.SL()
            try:
                yield db
            finally:
                db.close()

        app.dependency_overrides[deps_get_db] = override
        app.dependency_overrides[session_get_db] = override
        self.client = TestClient(app)

    def close(self):
        app.dependency_overrides.clear()
        self.engine.dispose()

    def session(self):
        return self.SL()


def mk_admin(db):
    u = M.User(is_active=True)
    db.add(u)
    db.flush()
    db.add(M.UserIdentity(user_id=u.id, provider="firebase", provider_uid="np-admin",
                          email="np-admin@synthetic.invalid"))
    db.add(M.UserProfile(user_id=u.id, status="COMPLETE", full_name="NP Admin",
                         birth_date=date(1990, 1, 1)))
    role = M.GlobalRole(code="ADMIN", name="ADMIN")
    db.add(role)
    db.flush()
    db.add(M.UserGlobalRole(user_id=u.id, global_role_id=role.id))
    db.flush()
    return u


ADMIN_HDR = {"Authorization": "Bearer dev:np-admin:np-admin@synthetic.invalid"}


def measure(client, method, path, headers):
    _reset()
    r = client.request(method, path, headers=headers)
    return _q["n"], r.status_code


# ---------------------------------------------------------------------------
# Probe 1 — GET /auth/me por nº de memberships (verifica o fix de #20)
# ---------------------------------------------------------------------------
def probe_auth_me():
    print("\n## GET /auth/me — por nº de memberships (deve ser CONSTANTE após #20)")
    print("| memberships | queries | status |")
    print("|---|---|---|")
    counts = {}
    for n in (0, 1, 10, 50):
        h = Harness()
        with h.session() as db:
            u = M.User(is_active=True)
            db.add(u)
            db.flush()
            db.add(M.UserIdentity(user_id=u.id, provider="firebase", provider_uid="np-me",
                                  email="np-me@synthetic.invalid"))
            db.add(M.UserProfile(user_id=u.id, status="COMPLETE"))
            for i in range(n):
                unit = M.OrgUnit(type=M.OrgUnitType.MINISTERIO, name=f"U{i}", slug=f"u{i}")
                db.add(unit)
                db.flush()
                db.add(M.OrgMembership(user_id=u.id, org_unit_id=unit.id,
                                       role=M.OrgRoleCode.MEMBER, status=M.MembershipStatus.ACTIVE))
            db.commit()
        # warm-up (provisiona nada; usuario ja existe) + medida
        h.client.get("/auth/me", headers={"Authorization": "Bearer dev:np-me:np-me@synthetic.invalid"})
        q, st = measure(h.client, "GET", "/auth/me",
                        {"Authorization": "Bearer dev:np-me:np-me@synthetic.invalid"})
        counts[n] = q
        print(f"| {n} | {q} | {st} |")
        h.close()
    grows = counts[50] - counts[0] > 2
    print(f"\n**Veredicto:** {'N+1 (CRESCE)' if grows else 'CONSTANTE — sem N+1'} "
          f"(delta 0->50 = {counts[50]-counts[0]})")
    return counts


# ---------------------------------------------------------------------------
# Probe 2 — GET /retreats por nº de retiros publicados
# ---------------------------------------------------------------------------
def probe_retreats():
    print("\n## GET /retreats — por nº de retiros publicados")
    print("| retiros | queries | status |")
    print("|---|---|---|")
    counts = {}
    for n in (0, 1, 10, 50):
        h = Harness()
        with h.session() as db:
            mk_admin(db)
            for i in range(n):
                r = M.Retreat(
                    title=f"Retiro {i}",
                    retreat_type=M.RetreatType.WEEKEND,
                    status=M.RetreatStatus.PUBLISHED,
                    visibility_type=M.RetreatVisibilityType.ALL,
                    start_date=datetime(2026, 12, 1, tzinfo=timezone.utc),
                    end_date=datetime(2026, 12, 3, tzinfo=timezone.utc),
                )
                db.add(r)
            db.commit()
        h.client.get("/auth/me", headers=ADMIN_HDR)  # provisiona/aquece
        q, st = measure(h.client, "GET", "/retreats", ADMIN_HDR)
        counts[n] = q
        print(f"| {n} | {q} | {st} |")
        h.close()
    delta = counts[50] - counts[0]
    grows = delta > 2
    per = (counts[50] - counts[1]) / 49 if counts[50] > counts[1] else 0
    print(f"\n**Veredicto:** {'N+1 (CRESCE ~%.1f queries/retiro)' % per if grows else 'CONSTANTE'} "
          f"(delta 0->50 = {delta})")
    return counts


# ---------------------------------------------------------------------------
# Probe 3 — GET /inbox por nº de mensagens
# ---------------------------------------------------------------------------
def probe_inbox():
    print("\n## GET /inbox — por nº de mensagens recebidas")
    print("| mensagens | queries | status |")
    print("|---|---|---|")
    counts = {}
    ok = True
    for n in (0, 1, 10, 50):
        h = Harness()
        try:
            with h.session() as db:
                u = mk_admin(db)
                for i in range(n):
                    msg = M.InboxMessage(
                        title=f"M{i}", message="x", type=M.InboxMessageType.INFO,
                        created_by_user_id=u.id, approval_status=M.InboxApprovalStatus.APPROVED,
                        expires_at=datetime(2027, 1, 1, tzinfo=timezone.utc),
                    )
                    db.add(msg)
                    db.flush()
                    db.add(M.InboxRecipient(message_id=msg.id, user_id=u.id))
                db.commit()
            h.client.get("/auth/me", headers=ADMIN_HDR)
            q, st = measure(h.client, "GET", "/inbox", ADMIN_HDR)
            counts[n] = q
            print(f"| {n} | {q} | {st} |")
        except Exception as e:
            print(f"| {n} | (erro de seed: {type(e).__name__}: {str(e)[:60]}) | - |")
            ok = False
        h.close()
    if ok and len(counts) == 4:
        delta = counts[50] - counts[0]
        print(f"\n**Veredicto:** {'N+1 (CRESCE)' if delta > 2 else 'CONSTANTE'} (delta 0->50 = {delta})")
    return counts


def probe_dashboard():
    print("\n## GET /admin/dashboard — por nº de usuários/unidades (agrega vários domínios)")
    print("| entidades | queries | status |")
    print("|---|---|---|")
    counts = {}
    for n in (0, 1, 10, 50):
        h = Harness()
        with h.session() as db:
            mk_admin(db)
            for i in range(n):
                unit = M.OrgUnit(type=M.OrgUnitType.MINISTERIO, name=f"D{i}", slug=f"d{i}")
                db.add(unit)
                db.flush()
                usr = M.User(is_active=True)
                db.add(usr)
                db.flush()
                db.add(M.UserProfile(user_id=usr.id, status="COMPLETE",
                                     birth_date=date(1990, 1, 1)))
                db.add(M.OrgMembership(user_id=usr.id, org_unit_id=unit.id,
                                       role=M.OrgRoleCode.MEMBER, status=M.MembershipStatus.ACTIVE))
            db.commit()
        h.client.get("/auth/me", headers=ADMIN_HDR)
        q, st = measure(h.client, "GET", "/admin/dashboard", ADMIN_HDR)
        counts[n] = q
        print(f"| {n} | {q} | {st} |")
        h.close()
    delta = counts.get(50, 0) - counts.get(0, 0)
    print(f"\n**Veredicto:** {'CRESCE' if delta > 4 else 'quase-constante'} (delta 0->50 = {delta})")
    return counts


if __name__ == "__main__":
    print("# Auditoria de N+1 — query count por cardinalidade")
    print("(SQLite in-memory; contagem de QUERIES, independe do banco)")
    probe_auth_me()
    probe_retreats()
    probe_inbox()
    probe_dashboard()
