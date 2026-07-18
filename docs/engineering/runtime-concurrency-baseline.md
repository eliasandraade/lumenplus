# Runtime, Concorrência e Capacidade — Baseline (Sprint)

**Data:** 2026-07-18 · **Meta de produto:** ~2.000 cadastrados, picos de **200–250 simultâneos**.

> **Escopo de honestidade:** medi **query count** (reprodutível) e um **micro-benchmark de runtime controlado** (in-process, latência simulada). **NÃO** rodei teste de carga contra o Railway/Postgres real (250 simultâneos) — isso exige staging + k6/Locust + `max_connections` do Postgres, que não tenho nesta sprint. Onde não medi, digo claramente.

---

## 1. Arquitetura atual (fatos confirmados)
- **Uvicorn `--workers 1`** (`start.sh`) — um único processo/event loop.
- **SQLAlchemy síncrono** dentro de rotas **`async def`** (`db.execute`/`db.query`, sem `await`).
- **Pool:** `pool_size=5` + `max_overflow=10` = **15 conexões** (1 worker) = **15 conexões DB no total**.
- **Redis** para rate-limit (fail-open se cair) — fallback em memória por processo.
- **Fórmula:** `instâncias × workers × (pool + overflow)` = 1 × 1 × 15 = **15**.

## 2. Bloqueio do event loop (MEDIDO)
Micro-benchmark controlado (`backend/performance/runtime_bench.py`), 40 requests concorrentes, 30 ms de latência simulada por request:

| Runtime | Tempo (40 req concorrentes) | |
|---|---|---|
| `async def` + chamada **bloqueante** (== estado atual) | **1.252 s** | serializa (~40×30 ms) |
| `def` (FastAPI threadpool) | **0.062 s** | concorrente |
| **Speedup** | **20.1×** | |

**Conclusão medida:** com `async def` + SQLAlchemy síncrono + 1 worker, requisições DB-bound **serializam** no event loop. Rotas `def` (threadpool) recuperam concorrência **sem mudar a camada de DB**.

## 3. Query count (MEDIDO — PR #20)
- `/health` **0** · `/legal/latest` **2 → 0** (cache) · `/auth/me` **10 → 8**.
- **N+1 de memberships corrigido e provado:** `/auth/me` = `{0:8, 1:8, 10:8, 50:8}` queries — **constante** (era base + N). Fix = `joinedload(org_unit)`.

---

## 4. Matriz de arquiteturas (A–F)

| Arq. | Descrição | Concorrência DB efetiva | Complexidade | Risco | Evidência |
|------|-----------|------------------------|--------------|-------|-----------|
| **A** (atual) | `async def` + sync DB, 1 worker | **~1** (serializa) | — | — | medido: serializa |
| **B** | rotas DB → `def` (threadpool), 1 worker | ~min(threadpool≈40, pool 15) = **~15** | **baixa** (tirar `async`) | baixo | micro-bench 20× |
| **C** | `def` + 2–4 workers, pool redimensionado | ~workers×15 (limitado por Postgres) | média | médio (pool math) | não medido |
| **D** | `async def` + `run_in_threadpool` explícito | ~15 | média (verboso) | médio | não medido |
| **E** | AsyncSession + asyncpg (async ponta a ponta) | alta | **alta** (migração ampla) | alto | não medido |
| **F** | escala horizontal (N instâncias) | N×(pool) | alta (infra) | médio | não medido |

**Recomendação (baseada no que foi medido):** **Arquitetura B** primeiro — maior ganho por menor risco/complexidade: converter as rotas DB-bound de `async def` para `def` (mantendo SQLAlchemy síncrono), incrementalmente, começando pelas quentes (`/auth/me`, `/legal/latest`, home, eventos, notificações). **Não** migrar para async SQLAlchemy (E) sem experimento — o ganho de B já é 20× e resolve o gargalo real.

> **Teto de B:** o threadpool (~40) fica limitado pelo **pool de 15 conexões** → concorrência DB real ≈ **15 simultâneas**. Para 250 usuários com think-time (não 250 queries simultâneas), 15 pode bastar, mas **precisa de load test** para confirmar. Se saturar, subir pool (ex.: 15+15=30) respeitando `max_connections` do Postgres, e/ou 2 workers.

---

## 5. 250 simultâneos — o backend suporta hoje?
**NÃO comprovado (e provavelmente NÃO na arquitetura A).** Motivo medido: A **serializa** DB-bound no 1 worker; sob 250 usuários com rajadas (pós-notificação), a fila cresceria e a latência degradaria. **Não é um palpite sobre número — é o comportamento de runtime medido (20× de diferença).**

**Caminho para 250 com margem (a validar por load test):**
1. **Arquitetura B** (rotas DB → `def`) — destrava concorrência (medido 20× no runtime).
2. **Pool/threadpool:** confirmar `max_connections` do Postgres do Railway; dimensionar pool e `anyio` threadpool coerentes (não passar de ~80% de `max_connections`).
3. **Load test em staging** (k6/Locust): ramp 10→50→100→150→200→250, perfis mistos (`/auth/me`, home, eventos, legal, notificações), medir p95/p99/erros/pool wait/CPU/memória e recuperação pós-rajada.

## 6. Configuração recomendada para produção (hipótese a validar por carga)
- **workers:** 1–2 (depende de CPU da instância Railway — verificar);
- **rotas DB-bound como `def`** (threadpool);
- **pool:** 10–15 + overflow, com `pool_pre_ping=True` e `pool_recycle` (~1800 s) — **verificar se já configurados**;
- **`max_connections` do Postgres:** confirmar e manter `workers × (pool+overflow) ≤ 0.8 × max_connections`;
- **Redis** para rate-limit (já é), cache legal por processo (ok — TTL+restart);
- **backpressure:** manter rate-limit + timeouts; considerar 503/retry-after sob saturação.

## 7. E 500 simultâneos (o dobro)?
Sem mudanças, **colapsa** (arquitetura A serializa). Mesmo com B, o teto de 15 conexões seria o gargalo → filas/timeouts. Para 500 exigiria: B + pool maior + 2–4 workers (ou horizontal) + Postgres dimensionado + cache de catálogos + **load test**. **Não suportar 500 agora é aceitável** (meta é 250), mas o comportamento sob 500 = degradação por fila no pool, não corrupção.

---

## Pendências para comprovar capacidade (blockers de infra, não de código)
- Suíte de carga (k6/Locust) em **staging** (não produção).
- `max_connections` do Postgres do Railway + CPU/memória da instância.
- Execução incremental de B (PR próprio) + medição antes/depois sob carga.
