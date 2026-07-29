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
