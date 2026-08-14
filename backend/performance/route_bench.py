"""
Benchmark das ROTAS REAIS da aplicação FastAPI — Sprint 4.

Diferente de runtime_bench.py (que é um experimento sintético com rotas de
brinquedo), este script sobe a aplicação REAL, com o roteador real, as
dependencies reais e o ORM real, e mede as rotas de verdade.

AMBIENTE: SQLite em arquivo + in-process (ASGITransport). Isso **não é**
PostgreSQL no Railway. Todo resultado produzido aqui deve ser rotulado
"MEDIDA LOCALMENTE (SQLite, in-process)".

Por que existe `--db-latency-ms`: em SQLite local uma query custa microssegundos,
então o custo de bloquear o event loop fica invisível. Em Postgres remoto cada
query custa um round-trip de rede (tipicamente 1-15 ms no Railway). A flag
injeta latência artificial por query (via evento SQLAlchemy) para modelar esse
RTT e isolar a variável de runtime. Resultados com a flag são SIMULAÇÃO de
latência de rede — devem ser rotulados como tal, nunca como medição de produção.

Uso:
    python performance/route_bench.py --db-latency-ms 5 --out perf_main.json
    python performance/route_bench.py --concurrency 1,10,25,50,100 --rounds 5
"""

from __future__ import annotations

import argparse
import asyncio
import json
import os
import pathlib
import sys
import tempfile
import time
import uuid

# permite `python performance/route_bench.py` a partir de backend/
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent.parent))

# --- ambiente de teste ANTES de importar a app (mesmo contrato do conftest) ---
os.environ.setdefault("ENVIRONMENT", "test")
os.environ.setdefault("AUTH_MODE", "DEV")
os.environ.setdefault("ENABLE_DEV_ENDPOINTS", "true")
os.environ.setdefault("DATABASE_URL", "sqlite:///:memory:")
os.environ.setdefault("ENCRYPTION_KEY", "mpmaPE3k4WEOi1s3ICSai0dOBj04mnkwFXO+Isksys8=")
os.environ.setdefault("HMAC_PEPPER", "WWtxHP65cwXkDDXNsKILWTuA4LQNmrRaICQ3rgNsjfE=")
# O rate limiter é um ARTEFATO para este benchmark: com o limite padrão ele
# devolve 429 e passaríamos a medir o rate limiter em vez da rota (comprovado
# na primeira execução). Elevado apenas no processo de benchmark; produção
# não é afetada.
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

# Rotas medidas — escolhidas pelo ranking da Sprint 3 (backend-hot-paths.md)
TARGETS: list[tuple[str, str, bool]] = [
    ("GET", "/health", False),        # controle: rota sem banco
    ("GET", "/legal/latest", False),  # abertura do app
    ("GET", "/auth/me", True),        # #1 do ranking
    ("GET", "/inbox/unread", True),   # badge da home
    ("GET", "/inbox", True),          # notificações
    ("GET", "/profile", True),        # perfil (autenticada simples)
    ("GET", "/retreats", True),       # listagem de eventos (DB-bound pesada)
]

TOKEN = "Bearer dev:bench-user:bench@example.com"


def build_db(latency_ms: float):
    """Engine SQLite em arquivo + injeção opcional de latência por query."""
    fd = tempfile.NamedTemporaryFile(suffix=".db", delete=False)
    fd.close()
    engine = create_engine(f"sqlite:///{fd.name}", connect_args={"check_same_thread": False})

    if latency_ms > 0:
        secs = latency_ms / 1000.0

        @event.listens_for(engine, "before_cursor_execute")
        def _delay(conn, cursor, statement, params, context, executemany):  # noqa: ANN001
            time.sleep(secs)  # simula RTT de rede até um Postgres remoto

    Base.metadata.create_all(bind=engine)
    return engine, fd.name


def seed(engine) -> None:
    """Dados sintéticos mínimos e determinísticos. Nenhum dado real."""
    Session = sessionmaker(bind=engine)
    from datetime import datetime, timezone

    with Session() as s:
        for t, v in (("TERMS", "1.0-bench"), ("PRIVACY", "1.0-bench")):
            s.add(LegalDocument(
                id=uuid.uuid4(), type=t, version=v,
                content=f"conteudo sintetico {t}",
                published_at=datetime(2026, 1, 1, tzinfo=timezone.utc),
            ))
        s.commit()


def pct(values: list[float], p: float) -> float:
    if not values:
        return float("nan")
    k = sorted(values)
    idx = min(int(round(p / 100.0 * (len(k) - 1))), len(k) - 1)
    return k[idx]


async def run_level(method: str, path: str, auth: bool, n: int, rounds: int) -> dict:
    transport = ASGITransport(app=app)
    headers = {"Authorization": TOKEN} if auth else {}
    lat: list[float] = []
    errors = 0
    statuses: dict[int, int] = {}

    async with httpx.AsyncClient(transport=transport, base_url="http://bench",
                                 headers=headers, timeout=60.0) as c:
        # warm-up (não medido): provisiona usuário, aquece cache e conexões
        for _ in range(3):
            try:
                await c.request(method, path)
            except Exception:
                pass

        wall_total = 0.0
        for _ in range(rounds):
            async def one() -> None:
                nonlocal errors
                t0 = time.perf_counter()
                try:
                    r = await c.request(method, path)
                    statuses[r.status_code] = statuses.get(r.status_code, 0) + 1
                    # QUALQUER não-2xx conta como erro. Contar só >=500 mascarava
                    # os 429 do rate limiter e faria a latência parecer ótima.
                    if not (200 <= r.status_code < 300):
                        errors += 1
                except Exception:
                    errors += 1
                lat.append((time.perf_counter() - t0) * 1000.0)

            t0 = time.perf_counter()
            await asyncio.gather(*[one() for _ in range(n)])
            wall_total += time.perf_counter() - t0

    total_reqs = n * rounds
    return {
        "concurrency": n,
        "requests": total_reqs,
        "wall_s": round(wall_total, 4),
        "rps": round(total_reqs / wall_total, 1) if wall_total > 0 else None,
        "p50_ms": round(pct(lat, 50), 2),
        "p90_ms": round(pct(lat, 90), 2),
        "p95_ms": round(pct(lat, 95), 2),
        # p99 só quando a amostra comporta (>=100 medições)
        "p99_ms": round(pct(lat, 99), 2) if len(lat) >= 100 else None,
        "errors": errors,
        "statuses": statuses,
    }


async def main_async(args) -> None:
    engine, dbfile = build_db(args.db_latency_ms)
    seed(engine)
    SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

    def override_get_db():
        db = SessionLocal()
        try:
            yield db
        finally:
            db.close()

    app.dependency_overrides[deps_get_db] = override_get_db
    app.dependency_overrides[session_get_db] = override_get_db

    levels = [int(x) for x in args.concurrency.split(",")]
    out: dict = {
        "environment": "MEDIDA LOCALMENTE (SQLite em arquivo, in-process ASGITransport)",
        "db_latency_injected_ms": args.db_latency_ms,
        "note": ("db_latency_injected_ms > 0 significa latência de rede SIMULADA por query "
                 "para modelar RTT de Postgres remoto. NÃO é medição de produção."),
        "rounds": args.rounds,
        "results": {},
    }

    targets = TARGETS
    if args.only:
        targets = [t for t in TARGETS if args.only in f"{t[0]} {t[1]}"]

    for method, path, auth in targets:
        key = f"{method} {path}"
        out["results"][key] = []
        for n in levels:
            r = await run_level(method, path, auth, n, args.rounds)
            out["results"][key].append(r)
            print(f"  {key:22} c={n:4}  rps={str(r['rps']):>8}  "
                  f"p50={r['p50_ms']:8.2f}ms  p95={r['p95_ms']:8.2f}ms  err={r['errors']}")

    app.dependency_overrides.clear()
    engine.dispose()
    try:
        os.unlink(dbfile)
    except OSError:
        pass

    if args.out:
        with open(args.out, "w", encoding="utf-8") as f:
            json.dump(out, f, indent=1, ensure_ascii=False)
        print(f"\n-> {args.out}")


def main() -> None:
    p = argparse.ArgumentParser()
    p.add_argument("--concurrency", default="1,10,25,50,100")
    p.add_argument("--rounds", type=int, default=5)
    p.add_argument("--db-latency-ms", type=float, default=0.0,
                   help="latência simulada por query (modela RTT de Postgres remoto)")
    p.add_argument("--out", default="")
    p.add_argument("--only", default="", help="filtra rotas (substring), ex: /auth/me")
    args = p.parse_args()
    print(f"# benchmark de rotas reais | latencia injetada={args.db_latency_ms}ms "
          f"| rounds={args.rounds}")
    asyncio.run(main_async(args))


if __name__ == "__main__":
    main()
