"""
Experimento controlado de RUNTIME (não é teste de carga de produção).

Isola o efeito de `async def` + chamada bloqueante (== SQLAlchemy síncrono dentro
de rota async) VS `def` (que o FastAPI executa no threadpool). Simula a latência
de uma query/round-trip com time.sleep e mede o wall-clock de N requests
concorrentes IN-PROCESS via httpx ASGITransport (exercita o event loop real).

Uso:  python performance/runtime_bench.py
Requer: httpx, fastapi (já presentes no venv de dev/test).

Resultado observado (2026-07-18, N=40, latência simulada 30 ms/req):
    async def + bloqueante : 1.252 s  (serial ~1.20 s)
    def (threadpool)       : 0.062 s
    speedup                : 20.1x
"""
import asyncio
import time

import httpx
from fastapi import FastAPI
from httpx import ASGITransport

LAT = 0.03   # 30 ms — simula 1 query/round-trip a um Postgres remoto
N = 40       # requests concorrentes

app = FastAPI()


@app.get("/async-blocking")
async def async_blocking():
    time.sleep(LAT)          # BLOQUEIA o event loop (== SQLAlchemy sync em async def)
    return {"ok": True}


@app.get("/sync-threadpool")
def sync_threadpool():
    time.sleep(LAT)          # roda no threadpool do FastAPI -> concorrente
    return {"ok": True}


async def bench(path: str, n: int) -> float:
    async with httpx.AsyncClient(transport=ASGITransport(app=app), base_url="http://t") as c:
        start = time.perf_counter()
        await asyncio.gather(*[c.get(path) for _ in range(n)])
        return time.perf_counter() - start


def main() -> None:
    a = asyncio.run(bench("/async-blocking", N))
    s = asyncio.run(bench("/sync-threadpool", N))
    print(f"N={N} requests concorrentes, latencia simulada={LAT*1000:.0f}ms/req")
    print(f"  async def + chamada bloqueante : {a:.3f}s  (serial esperado ~{N*LAT:.2f}s)")
    print(f"  def (threadpool)               : {s:.3f}s")
    print(f"  speedup do threadpool          : {a/s:.1f}x")


if __name__ == "__main__":
    main()
