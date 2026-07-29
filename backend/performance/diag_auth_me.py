"""
Diagnóstico do travamento de /auth/me — investigação da anomalia do benchmark.

MOTIVO: no route_bench.py, /auth/me com c=10 não concluiu em 240s enquanto a
mesma rota custa ~6,5ms serial. Serialização pura daria ~65ms. O fator de
~3.700x indica travamento (deadlock, exaustão de pool ou lock de banco), não
"serialização". Este script existe para descobrir QUAL — sem adivinhar.

Instrumentação: timeout por request e por rodada, timestamps, exceção completa,
thread id, task id, espera por conexão, tempo de SQL, contagem de queries,
checkout/checkin do pool, status do pool, limiter do AnyIO, dump de threads,
dump de tasks asyncio pendentes e faulthandler.

Uso:
    python performance/diag_auth_me.py --concurrency 10 --deadline 45
"""

from __future__ import annotations

import argparse
import asyncio
import faulthandler
import os
import pathlib
import sys
import tempfile
import threading
import time
import traceback
import uuid
from collections import Counter

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent.parent))

os.environ.setdefault("ENVIRONMENT", "test")
os.environ.setdefault("AUTH_MODE", "DEV")
os.environ.setdefault("ENABLE_DEV_ENDPOINTS", "true")
os.environ.setdefault("DATABASE_URL", "sqlite:///:memory:")
os.environ.setdefault("ENCRYPTION_KEY", "mpmaPE3k4WEOi1s3ICSai0dOBj04mnkwFXO+Isksys8=")
os.environ.setdefault("HMAC_PEPPER", "WWtxHP65cwXkDDXNsKILWTuA4LQNmrRaICQ3rgNsjfE=")
os.environ.setdefault("RATE_LIMIT_REQUESTS_PER_MINUTE", "1000000")
os.environ.setdefault("LOG_LEVEL", "ERROR")

import httpx  # noqa: E402
from httpx import ASGITransport  # noqa: E402
from sqlalchemy import create_engine, event  # noqa: E402
from sqlalchemy.orm import sessionmaker  # noqa: E402
from sqlalchemy.dialects.sqlite.base import SQLiteTypeCompiler  # noqa: E402

SQLiteTypeCompiler.visit_UUID = lambda self, type_, **kw: "TEXT"
SQLiteTypeCompiler.visit_JSONB = lambda self, type_, **kw: "TEXT"
SQLiteTypeCompiler.visit_ARRAY = lambda self, type_, **kw: "TEXT"

from app.api.deps import get_db as deps_get_db  # noqa: E402
from app.db.models import Base, LegalDocument  # noqa: E402
from app.db.session import get_db as session_get_db  # noqa: E402
from app.main import app  # noqa: E402

TOKEN = "Bearer dev:diag-user:diag@synthetic.invalid"

# --- contadores globais de instrumentação -----------------------------------
sql_count = Counter()
sql_time = Counter()
pool_events: Counter = Counter()
checkout_waits: list[float] = []
_lock = threading.Lock()


def instrument(engine) -> None:
    @event.listens_for(engine, "before_cursor_execute")
    def _before(conn, cursor, statement, params, context, executemany):  # noqa: ANN001
        context._diag_t0 = time.perf_counter()

    @event.listens_for(engine, "after_cursor_execute")
    def _after(conn, cursor, statement, params, context, executemany):  # noqa: ANN001
        dt = time.perf_counter() - getattr(context, "_diag_t0", time.perf_counter())
        with _lock:
            sql_count["queries"] += 1
            sql_time["seconds"] += dt

    @event.listens_for(engine, "checkout")
    def _checkout(dbapi_conn, conn_record, conn_proxy):  # noqa: ANN001
        with _lock:
            pool_events["checkout"] += 1
        conn_record._diag_checkout_t = time.perf_counter()

    @event.listens_for(engine, "checkin")
    def _checkin(dbapi_conn, conn_record):  # noqa: ANN001
        with _lock:
            pool_events["checkin"] += 1
            t0 = getattr(conn_record, "_diag_checkout_t", None)
            if t0:
                checkout_waits.append(time.perf_counter() - t0)

    @event.listens_for(engine, "connect")
    def _connect(dbapi_conn, conn_record):  # noqa: ANN001
        with _lock:
            pool_events["connect"] += 1


def anyio_limiter_state() -> str:
    """Tokens totais/ativos do threadpool do AnyIO (usado pelas rotas `def`)."""
    try:
        from anyio import to_thread
        lim = to_thread.current_default_thread_limiter()
        return f"total_tokens={lim.total_tokens} borrowed={lim.borrowed_tokens}"
    except Exception as exc:
        return f"indisponivel ({type(exc).__name__}: {exc})"


def dump_state(engine, tag: str) -> None:
    print(f"\n===== ESTADO [{tag}] =====")
    try:
        print(f"  pool.status() = {engine.pool.status()}")
    except Exception as exc:
        print(f"  pool.status() indisponivel: {exc}")
    print(f"  pool events = {dict(pool_events)}")
    print(f"  queries={sql_count['queries']} tempo_sql={sql_time['seconds']:.3f}s")
    print(f"  anyio limiter: {anyio_limiter_state()}")
    print(f"  threads ativas = {threading.active_count()}")
    for t in threading.enumerate()[:12]:
        print(f"    - {t.name} alive={t.is_alive()} daemon={t.daemon}")
    try:
        tasks = [t for t in asyncio.all_tasks() if not t.done()]
        print(f"  tasks asyncio pendentes = {len(tasks)}")
        for t in tasks[:8]:
            coro = t.get_coro()
            print(f"    - {t.get_name()} {getattr(coro, '__qualname__', coro)}")
    except RuntimeError:
        print("  (sem loop asyncio corrente)")


async def main_async(args) -> None:
    fd = tempfile.NamedTemporaryFile(suffix=".db", delete=False)
    fd.close()
    engine = create_engine(f"sqlite:///{fd.name}", connect_args={"check_same_thread": False})
    instrument(engine)
    Base.metadata.create_all(bind=engine)

    SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    from datetime import datetime, timezone
    with SessionLocal() as s:
        for t, v in (("TERMS", "1.0-diag"), ("PRIVACY", "1.0-diag")):
            s.add(LegalDocument(id=uuid.uuid4(), type=t, version=v, content="x",
                                published_at=datetime(2026, 1, 1, tzinfo=timezone.utc)))
        s.commit()

    def override_get_db():
        db = SessionLocal()
        try:
            yield db
        finally:
            db.close()

    app.dependency_overrides[deps_get_db] = override_get_db
    app.dependency_overrides[session_get_db] = override_get_db

    print(f"# diagnostico /auth/me | c={args.concurrency} | deadline={args.deadline}s")
    print(f"# pool default do engine: {engine.pool.__class__.__name__} "
          f"size={getattr(engine.pool, '_pool', None) and engine.pool.size()} "
          f"timeout={getattr(engine.pool, '_timeout', 'n/a')}")

    transport = ASGITransport(app=app)
    headers = {"Authorization": TOKEN}

    async with httpx.AsyncClient(transport=transport, base_url="http://diag",
                                 headers=headers, timeout=args.req_timeout) as c:
        # warm-up serial: provisiona o usuario e aquece
        print("\n--- warm-up serial (3 requests) ---")
        for i in range(3):
            t0 = time.perf_counter()
            try:
                r = await c.get("/auth/me")
                print(f"  warmup[{i}] status={r.status_code} {(time.perf_counter()-t0)*1000:.1f}ms")
            except Exception as exc:
                print(f"  warmup[{i}] EXCECAO {type(exc).__name__}: {exc}")
        dump_state(engine, "apos warm-up")

        # dump automatico de stacks se a rodada travar
        faulthandler.dump_traceback_later(args.deadline // 2, repeat=True, exit=False)

        results: list[dict] = []

        async def one(i: int) -> None:
            rec = {"i": i, "start": time.perf_counter(), "thread": threading.get_ident()}
            try:
                r = await c.get("/auth/me")
                rec["status"] = r.status_code
            except Exception as exc:
                rec["status"] = None
                rec["exc"] = f"{type(exc).__name__}: {str(exc)[:120]}"
                rec["tb"] = traceback.format_exc(limit=3)
            rec["end"] = time.perf_counter()
            rec["ms"] = (rec["end"] - rec["start"]) * 1000
            results.append(rec)

        print(f"\n--- rodada concorrente c={args.concurrency} ---")
        t0 = time.perf_counter()
        try:
            await asyncio.wait_for(
                asyncio.gather(*[one(i) for i in range(args.concurrency)]),
                timeout=args.deadline,
            )
            print(f"  rodada CONCLUIU em {time.perf_counter()-t0:.2f}s")
        except asyncio.TimeoutError:
            print(f"  rodada ESTOUROU o deadline de {args.deadline}s")
            dump_state(engine, "DURANTE O TRAVAMENTO")
        finally:
            faulthandler.cancel_dump_traceback_later()

        ok = sum(1 for r in results if r.get("status") == 200)
        print(f"\n  concluidas={len(results)}/{args.concurrency} ok={ok}")
        for r in sorted(results, key=lambda x: x["ms"])[:6]:
            print(f"    req[{r['i']}] status={r.get('status')} {r['ms']:.1f}ms "
                  f"{r.get('exc','')}")
        errs = Counter(r.get("exc", "").split(":")[0] for r in results if r.get("exc"))
        if errs:
            print(f"  excecoes por tipo: {dict(errs)}")
            first = next(r for r in results if r.get("tb"))
            print("  primeiro traceback:\n" + "\n".join(
                "    " + ln for ln in first["tb"].splitlines()[-6:]))

    dump_state(engine, "final")
    if checkout_waits:
        avg = sum(checkout_waits) / len(checkout_waits)
        print(f"  tempo medio de posse de conexao = {avg*1000:.1f}ms "
              f"(max {max(checkout_waits)*1000:.1f}ms)")

    app.dependency_overrides.clear()
    engine.dispose()
    try:
        os.unlink(fd.name)
    except OSError:
        pass


def main() -> None:
    p = argparse.ArgumentParser()
    p.add_argument("--concurrency", type=int, default=10)
    p.add_argument("--deadline", type=int, default=45, help="timeout global da rodada (s)")
    p.add_argument("--req-timeout", type=float, default=20.0, help="timeout por request (s)")
    a = p.parse_args()
    asyncio.run(main_async(a))


if __name__ == "__main__":
    main()
