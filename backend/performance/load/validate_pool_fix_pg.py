"""
Valida o fix de sessão única contra o PostgreSQL REAL de staging — item 4.

Executado via: railway run --service Postgres-mFan <wrapper.bat>
(o railway injeta DATABASE_PUBLIC_URL do Postgres de staging).

SEGURANÇA:
- Recusa qualquer alvo que case com padrão de produção.
- Usa apenas usuários sintéticos (.invalid, não roteável).
- Baixa concorrência (1/5/10/15) — nada de carga agressiva.
- Faz cleanup (anonimiza) os usuários sintéticos ao final.
- NUNCA imprime DSN, host, usuário ou senha.

Mede, contra o banco real:
- sessões criadas por request (sinal de duplicação);
- checkouts/checkins e conexões concorrentes máximas do pool;
- pool wait; p50/p95; erros.
"""

from __future__ import annotations

import asyncio
import os
import re
import sys
import threading
import time
import uuid

# ---- alvo: exigir Postgres de staging, recusar producao --------------------
_pub = os.environ.get("DATABASE_PUBLIC_URL", "")
if not _pub:
    print("  BLOCKER: DATABASE_PUBLIC_URL nao injetada. Rode via "
          "`railway run --service Postgres-mFan`.")
    sys.exit(0)

for _pat in (r"backend-production", r"lumenplus\.vercel\.app", r"lumenplus\.app",
             r"lumenserfeliz\.org"):
    if re.search(_pat, _pub, re.I):
        print(f"  RECUSADO: alvo casa com padrao de producao ({_pat}).")
        sys.exit(1)

# ---- ambiente do app ANTES de importar -------------------------------------
if _pub.startswith("postgres://"):
    _pub = _pub.replace("postgres://", "postgresql://", 1)
os.environ["DATABASE_URL"] = _pub
os.environ["ENVIRONMENT"] = "test"        # evita validacao de producao no boot
os.environ["AUTH_MODE"] = "DEV"           # aceita tokens dev: (usuarios sinteticos)
os.environ["ENABLE_DEV_ENDPOINTS"] = "false"
os.environ["ENCRYPTION_KEY"] = "mpmaPE3k4WEOi1s3ICSai0dOBj04mnkwFXO+Isksys8="
os.environ["HMAC_PEPPER"] = "WWtxHP65cwXkDDXNsKILWTuA4LQNmrRaICQ3rgNsjfE="
os.environ["RATE_LIMIT_REQUESTS_PER_MINUTE"] = "1000000"
os.environ["LOG_LEVEL"] = "ERROR"
# Pool pequeno de propósito, para observar o comportamento sob os 15 do default.
os.environ["DATABASE_POOL_SIZE"] = "5"
os.environ["DATABASE_MAX_OVERFLOW"] = "10"

import httpx  # noqa: E402
from httpx import ASGITransport  # noqa: E402
from sqlalchemy import event  # noqa: E402

import app.db.session as dbsession  # noqa: E402
from app.main import app  # noqa: E402

ENGINE = dbsession.engine
TOKENS = [f"dev:poolval-{i}:poolval-{i}@synthetic.invalid" for i in range(15)]

_state = {"checkouts": 0, "checkins": 0, "live": 0, "max_live": 0}
_lock = threading.Lock()


@event.listens_for(ENGINE, "checkout")
def _co(*a):  # noqa: ANN001
    with _lock:
        _state["checkouts"] += 1
        _state["live"] += 1
        _state["max_live"] = max(_state["max_live"], _state["live"])


@event.listens_for(ENGINE, "checkin")
def _ci(*a):  # noqa: ANN001
    with _lock:
        _state["checkins"] += 1
        _state["live"] = max(0, _state["live"] - 1)


def pct(vals, p):
    if not vals:
        return float("nan")
    k = sorted(vals)
    return k[min(int(round(p / 100 * (len(k) - 1))), len(k) - 1)]


async def run_level(n: int, rounds: int = 2):
    transport = ASGITransport(app=app)
    lat: list[float] = []
    errors = 0
    with _lock:
        _state["max_live"] = 0
    async with httpx.AsyncClient(transport=transport, base_url="http://pgval",
                                 timeout=30.0) as c:
        async def one(i: int):
            nonlocal errors
            tok = TOKENS[i % len(TOKENS)]
            t0 = time.perf_counter()
            try:
                r = await c.get("/auth/me", headers={"Authorization": f"Bearer {tok}"})
                if not (200 <= r.status_code < 300):
                    errors += 1
            except Exception:
                errors += 1
            lat.append((time.perf_counter() - t0) * 1000)
        for _ in range(rounds):
            await asyncio.gather(*[one(i) for i in range(n)])
    return {
        "c": n, "p50": round(pct(lat, 50), 1), "p95": round(pct(lat, 95), 1),
        "errors": errors, "max_live_conns": _state["max_live"],
    }


async def main():
    print(f"  alvo: Postgres de staging (host oculto) | pool "
          f"{ENGINE.pool.__class__.__name__} size=5 overflow=10")
    # warm-up: provisiona os usuarios sinteticos (serial)
    transport = ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://pgval",
                                 timeout=30.0) as c:
        for tok in TOKENS:
            try:
                await c.get("/auth/me", headers={"Authorization": f"Bearer {tok}"})
            except Exception as e:
                print(f"  FALHA no warm-up: {type(e).__name__}: {str(e)[:80]}")
                return
    print("  warm-up ok (usuarios sinteticos provisionados)")

    print("  --- fix aplicado (deps.get_db canonico): 1 sessao/request esperado ---")
    for n in (1, 5, 10, 15):
        r = await run_level(n)
        flag = "OK" if r["errors"] == 0 else f"{r['errors']} ERROS"
        print(f"    c={n:2}  p50={r['p50']:7.1f}ms  p95={r['p95']:7.1f}ms  "
              f"max_conns_simultaneas={r['max_live_conns']:2}  {flag}")
    print(f"  totais: checkouts={_state['checkouts']} checkins={_state['checkins']} "
          f"(diferenca={_state['checkouts'] - _state['checkins']})")

    # cleanup: anonimiza os usuarios sinteticos
    async with httpx.AsyncClient(transport=transport, base_url="http://pgval",
                                 timeout=30.0) as c:
        removed = 0
        for tok in TOKENS:
            try:
                rr = await c.delete("/auth/me", headers={"Authorization": f"Bearer {tok}"})
                if rr.status_code in (200, 204):
                    removed += 1
            except Exception:
                pass
    print(f"  cleanup: {removed}/{len(TOKENS)} usuarios sinteticos anonimizados")


if __name__ == "__main__":
    asyncio.run(main())
