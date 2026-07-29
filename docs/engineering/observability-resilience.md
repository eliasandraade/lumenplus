# Observabilidade e resiliência — Sprint 8

**Data:** 2026-07-24. Estado do que foi **implementado** vs **pendente** (honesto).

## 1. Health checks — liveness vs readiness (IMPLEMENTADO)

| Endpoint | Verifica | Uso pelo orquestrador | Toca banco? |
|---|---|---|---|
| `/health` | processo vivo (compat retro) | — | não |
| `/health/live` | processo responde | decidir **reiniciar** container | **não** |
| `/health/ready` | `SELECT 1` no banco | decidir **rotear** tráfego | sim (curto) |

Separar os dois evita o anti-padrão em que uma lentidão de banco derruba a
liveness e dispara **restarts em cascata** sob carga. `/health/ready` devolve
**503** se o banco cai — sem vazar host/driver. Testes:
`test_backpressure_and_health.py`.

### Ação de operador (Railway)
Configurar o healthcheck do serviço para **`/health/live`** (não `/health/ready`),
para que um blip de banco não reinicie o container. Readiness fica para o
loadbalancer/roteamento.

## 2. Backpressure a nível de app (IMPLEMENTADO)

`app/api/backpressure.py` converte saturação/indisponibilidade de banco em
resposta **controlada**:

| Exceção | HTTP | Código interno | Retry-After |
|---|---|---|---|
| `sqlalchemy.exc.TimeoutError` (pool esgotado) | **503** | `DATABASE_BUSY` | 3 s |
| `sqlalchemy.exc.OperationalError` (indisponível / `statement_timeout`) | **503** | `DATABASE_UNAVAILABLE` | 3 s |

Antes, ambos caíam no handler genérico → **500** com aparência de bug. Agora o
cliente/loadbalancer recebe 503 + `Retry-After` e o log registra **só o tipo**
da exceção (nunca `str(exc)`, que pode citar SQL/host). Testes cobrem o não-vazamento.

Combina com os timeouts de banco versionados (PR #22): `statement_timeout=15s`,
`idle_in_transaction_session_timeout=30s`, `pool_timeout=10s`.

## 3. Matriz de resiliência das integrações (AUDITADO + correções)

| Integração | Sync/async | Timeout | Retry | Idempotência | Circuit breaker | Fallback | Observab. | Estado |
|---|---|---|---|---|---|---|---|---|
| **Redis** (rate limit) | sync | **1 s** (connect+socket) | não | n/a | não | **fail-open** (permite request) | log | **OK** |
| **Firebase** (JWKS certs) | sync | **10 s** (httpx) | não | n/a | não | erro 401 controlado | log | **OK** |
| **Web Push** (pywebpush) | sync | **10 s** ⟵ *adicionado* | não | 410/404 → limpa sub | não | marca falha, segue o batch | log | **corrigido** |
| **Cloudinary** (upload) | sync | **15 s** ⟵ *adicionado* | não | overwrite=true (idempotente) | não | erro controlado | log | **corrigido** |
| **SendGrid** (e-mail) | sync | default do SDK | não | — | não | erro controlado | log | **a revisar** |
| **Sentry** | async | SDK | SDK | n/a | n/a | silencioso | — | OK |

### Correções aplicadas nesta sprint
- **Web Push sem timeout** → `timeout=10`. Era o mais grave: o envio é **em lote**
  (um POST por subscription), então um único endpoint pendurado **segurava o
  batch inteiro** indefinidamente.
- **Cloudinary upload sem timeout** → `timeout=15`. Sem bound, um Cloudinary lento
  segurava a request **e a conexão de banco do request**.

### Gaps registrados (não corrigidos — exigem decisão/mais análise)
- **SendGrid**: o `SendGridAPIClient` não expõe timeout trivialmente; envolver numa
  thread com timeout ou trocar por chamada `httpx` direta é mudança maior.
  **Prioridade média** — e-mail transacional não está no hot path de request.
- **Sem retry/backoff** em nenhuma integração. Aceitável hoje (todas falham de
  forma controlada), mas Push e e-mail se beneficiariam de retry com backoff +
  fila. **Não implementado** — exige infra de fila.
- **Sem circuit breaker.** Para o volume atual, timeout + fail-open cobre. Revisitar
  se uma integração começar a falhar em massa.

## 4. Métricas (PARCIAL — honesto)

**NÃO implementado um backend de métricas** (Prometheus/OTel). O que existe:
- Logs estruturados (`structlog`) com `request_id`, path, método, status.
- Sentry para erros e traces (10% em produção).
- `/health/ready` para readiness ativa.

**Falta** (requer decisão de infra):
- Exposição de métricas de **pool** (checkout, wait, conexões ativas),
  **event-loop lag**, **in-flight requests**, **duração por rota normalizada**.
- Dashboards e alertas (erro por rota, p95, pool exhaustion, readiness).

> **Por que não implementei o `/metrics` agora:** sem um coletor (Prometheus) e
> uma regra clara de **baixa cardinalidade** de labels (nunca user_id, e-mail,
> CPF, querystring), um endpoint de métricas caseiro vira mais risco (vazamento
> de PII em labels) do que valor. Registrado como próximo passo com contrato
> explícito de labels seguros. As métricas de pool já são **observáveis sob
> demanda** via `engine.pool.status()` (usado nos harness de diagnóstico).

## 5. Resumo do que esta sprint entregou

- ✅ Liveness/readiness distintos + testes.
- ✅ Backpressure 503 + Retry-After + testes de não-vazamento.
- ✅ Timeout em Web Push e Cloudinary (as duas integrações sem bound).
- ✅ Matriz de resiliência auditada.
- ⚠️ Métricas/dashboards: documentado o contrato, **não implementado** (infra).
- ⚠️ SendGrid timeout, retry/backoff, circuit breaker: registrados como pendências.


---

# Backpressure validado END-TO-END (2026-07-24, item 6)

## 6.1 Esgotamento de pool → 503 → recuperação (TESTE DE INTEGRAÇÃO)

`tests/test_backpressure_and_health.py::test_pool_exhaustion_end_to_end_503_e_recuperacao`:
engine com `pool_size=1, max_overflow=0, pool_timeout=1`; segura a única conexão;
faz uma request que precisa do banco; confirma:

- **503** (não 500);
- `Retry-After: 3`;
- código `DATABASE_BUSY`;
- **sem vazamento** de SQL/driver/host no corpo;
- **recuperação**: ao liberar a conexão, a próxima request volta a **200**;
- `/health/live` responde 200 o tempo todo (liveness independe do banco).

## 6.2 Banco indisponível
`test_health_ready_503_quando_banco_cai`: `/health/ready` → 503 sem vazar host;
`/health/live` continua 200. `OperationalError` → 503 `DATABASE_UNAVAILABLE`
(`test_operational_error_vira_503`).

## 6.3 Statement timeout
O `statement_timeout=15s` foi **provado aplicado no PostgreSQL real** (staging)
antes do logout do Railway (`verify_backpressure.py`: query longa ABORTADA →
`OperationalError`), e o handler converte `OperationalError` → 503. O teste de
integração ponta-a-ponta do abort exige PostgreSQL (SQLite não tem
`statement_timeout`) — **NÃO MEDIDA localmente; blocker: PostgreSQL + railway**.
Cobertura atual: config provada no PG real + handler testado em unidade.

## 6.4 Configuração separada por contexto (migrations vs web vs jobs)

| Contexto | Engine | `statement_timeout` aplicado? |
|----------|--------|-------------------------------|
| Web (requests) | `app.db.session.engine` | **sim** (15s) — via `connect_args` |
| Migrations (Alembic) | `engine_from_config` em `alembic/env.py` — **engine separado** | **não** — migrations podem rodar longas sem serem abortadas |
| Jobs/scheduler | `get_db_session()` → **mesmo `SessionLocal`/engine do web** | **sim** (15s) |

- **Migrations: OK** — usam engine próprio, não herdam o timeout do web. É o caso
  crítico (uma migration não pode ser abortada aos 15s) e já está correto.
- **Jobs: consideração registrada** — o scheduler compartilha o engine web, então
  uma operação de job > 15s seria abortada. Para os jobs atuais (notificações
  curtas) isso é aceitável. **Se um job passar a fazer operação longa** (import,
  agregação pesada), deve usar um engine dedicado com timeout próprio. Documentado
  como follow-up; não implementado agora para não introduzir um segundo engine
  sem necessidade comprovada.
