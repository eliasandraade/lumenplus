"""
Driver de carga HTTP REAL contra um alvo remoto — usado quando k6 não está
disponível no ambiente de execução. Mesmos perfis, gates e trava de produção
da suíte k6 (main.js), implementado com httpx/asyncio.

SEGURANÇA:
- Recusa qualquer alvo que case com padrão de PRODUÇÃO.
- Só usa endpoints/tokens fornecidos explicitamente.
- Não dispara e-mail, push, upload nem escrita destrutiva.

Uso:
  python http_load.py --base-url https://<staging> --vus 25 --duration 60 --profile open_app
  python http_load.py --base-url https://<staging> --ramp
"""

from __future__ import annotations

import argparse
import asyncio
import json
import re
import statistics
import sys
import time

import httpx

PRODUCTION_PATTERNS = [
    r"backend-production",
    r"lumenplus\.vercel\.app",
    r"(^|\.)lumenplus\.app",
    r"lumenserfeliz\.org",
]

# Perfis. Cada entrada: (nome, método, path, requer_auth)
PROFILES: dict[str, list[tuple[str, str, bool]]] = {
    # Abertura do app — parte NÃO autenticada (executável sem Firebase)
    "open_app_public": [
        ("GET", "/health", False),
        ("GET", "/legal/latest", False),
    ],
    # Abertura completa — exige token Firebase real
    "open_app_full": [
        ("GET", "/health", False),
        ("GET", "/auth/me", True),
        ("GET", "/legal/latest", False),
        ("GET", "/inbox/unread", True),
    ],
    "browse": [
        ("GET", "/auth/me", True),
        ("GET", "/retreats", True),
        ("GET", "/profile", True),
        ("GET", "/inbox", True),
    ],
}


def assert_not_production(url: str) -> None:
    for pat in PRODUCTION_PATTERNS:
        if re.search(pat, url, re.I):
            sys.exit(f"RECUSADO: '{url}' casa com padrao de PRODUCAO ({pat}). Abortando.")


def pct(values: list[float], p: float) -> float:
    if not values:
        return float("nan")
    k = sorted(values)
    idx = min(int(round(p / 100.0 * (len(k) - 1))), len(k) - 1)
    return k[idx]


class Stats:
    def __init__(self) -> None:
        self.lat: list[float] = []
        self.by_endpoint: dict[str, list[float]] = {}
        self.status: dict[int, int] = {}
        self.errors = 0
        self.exceptions: dict[str, int] = {}


async def _vu(client: httpx.AsyncClient, steps, tokens, stats: Stats, stop_at: float, idx: int):
    i = 0
    while time.monotonic() < stop_at:
        for method, path, needs_auth in steps:
            if time.monotonic() >= stop_at:
                break
            headers = {}
            if needs_auth:
                if not tokens:
                    continue  # sem token: pula rotas autenticadas
                headers["Authorization"] = f"Bearer {tokens[(idx + i) % len(tokens)]}"
            t0 = time.perf_counter()
            try:
                r = await client.request(method, path, headers=headers)
                dt = (time.perf_counter() - t0) * 1000
                stats.lat.append(dt)
                stats.by_endpoint.setdefault(path, []).append(dt)
                stats.status[r.status_code] = stats.status.get(r.status_code, 0) + 1
                if not (200 <= r.status_code < 400):
                    stats.errors += 1
            except Exception as exc:  # noqa: BLE001
                stats.errors += 1
                name = type(exc).__name__
                stats.exceptions[name] = stats.exceptions.get(name, 0) + 1
            i += 1
        await asyncio.sleep(0.05)  # think-time curto


async def run_level(base_url: str, profile: str, vus: int, duration: float, tokens: list[str]) -> dict:
    steps = PROFILES[profile]
    stats = Stats()
    limits = httpx.Limits(max_connections=vus * 2, max_keepalive_connections=vus)
    timeout = httpx.Timeout(30.0, connect=15.0)
    t_start = time.monotonic()
    stop_at = t_start + duration
    async with httpx.AsyncClient(base_url=base_url, limits=limits, timeout=timeout,
                                 follow_redirects=False) as client:
        await asyncio.gather(*[_vu(client, steps, tokens, stats, stop_at, i) for i in range(vus)])
    wall = time.monotonic() - t_start
    total = len(stats.lat)
    return {
        "vus": vus,
        "duration_s": round(wall, 1),
        "requests": total,
        "rps": round(total / wall, 1) if wall > 0 else 0,
        "p50_ms": round(pct(stats.lat, 50), 1),
        "p90_ms": round(pct(stats.lat, 90), 1),
        "p95_ms": round(pct(stats.lat, 95), 1),
        "p99_ms": round(pct(stats.lat, 99), 1) if total >= 100 else None,
        "max_ms": round(max(stats.lat), 1) if stats.lat else None,
        "mean_ms": round(statistics.mean(stats.lat), 1) if stats.lat else None,
        "errors": stats.errors,
        "error_rate": round(stats.errors / total, 4) if total else 0,
        "status": dict(sorted(stats.status.items())),
        "exceptions": stats.exceptions,
        "per_endpoint": {
            p: {"n": len(v), "p50": round(pct(v, 50), 1), "p95": round(pct(v, 95), 1)}
            for p, v in stats.by_endpoint.items()
        },
    }


# Gate por nível (mesmos thresholds da suíte k6)
def gate(res: dict) -> tuple[bool, str]:
    if res["error_rate"] >= 0.02:
        return False, f"erro {res['error_rate']*100:.1f}% >= 2%"
    if res["p95_ms"] and res["p95_ms"] >= 2000:
        return False, f"p95 {res['p95_ms']}ms >= 2000ms"
    return True, "ok"


async def main_async(args) -> None:
    base = args.base_url.rstrip("/")
    assert_not_production(base)
    tokens = []
    if args.tokens:
        tokens = [t.strip() for t in args.tokens.split(",") if t.strip()]

    print(f"# alvo={base} perfil={args.profile} tokens={len(tokens)}")
    # smoke de saúde antes de qualquer carga
    async with httpx.AsyncClient(base_url=base, timeout=20.0) as c:
        r = await c.get("/health")
        if r.status_code != 200:
            sys.exit(f"ABORTADO: /health devolveu {r.status_code}")
    print("  /health OK — iniciando")

    levels = [int(x) for x in args.levels.split(",")]
    out = {"base_url": base, "profile": args.profile, "levels": []}
    print(f"\n{'VUs':>5} {'RPS':>8} {'p50':>8} {'p90':>8} {'p95':>9} {'p99':>9} {'err':>7}  gate")
    for vus in levels:
        res = await run_level(base, args.profile, vus, args.duration, tokens)
        ok, why = gate(res)
        res["gate_pass"] = ok
        res["gate_reason"] = why
        out["levels"].append(res)
        p99 = f"{res['p99_ms']}" if res["p99_ms"] else "-"
        print(f"{vus:>5} {res['rps']:>8} {res['p50_ms']:>8} {res['p90_ms']:>8} "
              f"{res['p95_ms']:>9} {p99:>9} {res['error_rate']*100:>6.2f}%  "
              f"{'PASS' if ok else 'FAIL: ' + why}")
        if not ok:
            print(f"  ABORT: gate falhou em {vus} VUs — nao escalando alem disso.")
            break
        await asyncio.sleep(args.cooldown)

    if args.out:
        with open(args.out, "w", encoding="utf-8") as f:
            json.dump(out, f, indent=1)
        print(f"\n-> {args.out}")


def main() -> None:
    p = argparse.ArgumentParser()
    p.add_argument("--base-url", required=True)
    p.add_argument("--profile", default="open_app_public", choices=list(PROFILES))
    p.add_argument("--levels", default="10,25,50,100,150,200,250")
    p.add_argument("--duration", type=float, default=30.0, help="segundos por nivel")
    p.add_argument("--cooldown", type=float, default=5.0)
    p.add_argument("--tokens", default="", help="tokens separados por virgula (rotas autenticadas)")
    p.add_argument("--out", default="")
    asyncio.run(main_async(p.parse_args()))


if __name__ == "__main__":
    main()
