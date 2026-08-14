# Backend Performance — Baseline & Sprint 1 (medido)

**Data:** 2026-07-17 · **HEAD inicial:** `7db785d`
**Stack:** FastAPI 0.115 · SQLAlchemy 2.0.36 · Alembic 1.14 · Pydantic 2.10 · Python 3.14 · 44 migrations
**Método:** contagem de queries via evento SQLAlchemy `before_cursor_execute` (independente do dialeto — SQLite/Postgres emitem o mesmo nº de statements pelo ORM). Instrumentação em `backend/tests/test_perf_query_count.py`.

> Escopo desta medição: **contagem de queries e N+1** (100% reprodutível no banco de teste). Latência real (p50/p95/p99) e planos de query (`EXPLAIN ANALYZE`) exigem Postgres/staging e **não** foram medidos aqui — não afirmo números de latência.

---

## Baseline medido (queries por request, warm)

| Endpoint | Método | Auth | Queries (antes) | Observação |
|----------|--------|------|-----------------|------------|
| `/health` | GET | não | **0** | não toca o banco ✓ |
| `/push/vapid-public-key` | GET | não | **0** | 503 sem VAPID (config), sem query |
| `/legal/latest` | GET | não | **2** | 2× `latest legal doc` (`ORDER BY published_at DESC LIMIT 1`) |
| `/auth/me` | GET | sim | **10** | 8 legítimas + **2** legal-doc + **1 redundante** (identities 2×) |

### Trace do `/auth/me` (10 SELECTs)
1. `user_identities` (dep de auth resolve o token → usuário)
2. `users`
3. `user_identities` **(de novo — redundante; a dep já carregou)**
4. `user_profiles`
5. `legal_documents` (latest TERMS) ← cacheável
6. `legal_documents` (latest PRIVACY) ← cacheável
7. `user_consents`
8. `org_memberships`
9. `org_invites`
10. `user_global_roles`

---

## Correção 1 — cache de documento legal (IMPLEMENTADA, com prova)

**Problema:** `/auth/me` e `/legal/latest` consultam o documento legal "mais recente" a cada request. É o endpoint chamado em **todo carregamento do app**.

**Causa:** `SELECT ... ORDER BY published_at DESC LIMIT 1` por tipo, em 2 lugares.

**Solução:** `app/services/legal_cache.py` — cache em processo (snapshot imutável, sem dependência de sessão) com **TTL 300s**. **Invalidação segura:** uma nova versão só vira "latest" via migration Alembic no boot (`start.sh`), que reinicia o processo e limpa o cache. TTL é defesa extra. Isolamento nos testes via fixture autouse em `conftest.py`.

**Resultado (medido, antes → depois):**

| Endpoint | Antes | Depois | Δ |
|----------|-------|--------|---|
| `/legal/latest` (warm) | 2 | **0** | −2 (100%) |
| `/auth/me` (warm) | 10 | **8** | −2 (−20%) |

Comportamento preservado (ambos HTTP 200). Suíte: **193 passed**. Guard de regressão em `test_perf_query_count.py`.

---

## Achados medidos AINDA NÃO corrigidos (próximo PR: `perf/backend-n-plus-one`)

1. **N+1 em `/auth/me` — memberships (P1).** `auth.py` faz `for m in user.memberships: m.org_unit.name, m.org_unit.type` — `m.org_unit` é lazy-loaded **por item** → 1 query extra por membership. Não apareceu no baseline porque o usuário de teste tinha 0 memberships. **Repro:** semear usuário com N memberships e medir crescimento linear de queries. **Fix:** eager-load `org_unit` (selectinload) na leitura das memberships.
2. **Query redundante de identities (P2).** `user_identities` é consultada 2× em `/auth/me` (dep de auth + handler). Reusar a instância já carregada remove 1 query.

---

## Itens ainda NÃO medidos (honestidade)
- Latência real p50/p95/p99 (precisa staging/Postgres + carga).
- Índices ausentes confirmados por `EXPLAIN` (precisa Postgres).
- Pool sob concorrência real (precisa load test em staging).

Cada um é um PR/loop próprio com baseline→medição→antes/depois.
