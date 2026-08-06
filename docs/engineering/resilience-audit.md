# Auditoria de resiliência das integrações (Sprint 8, item 9)

**Data:** 2026-07-24. Auditoria completa por integração: chamadas, sync/async,
**dentro de transação/conexão?**, timeout, retry, backoff, idempotência, fallback,
circuit breaker, observabilidade.

## Matriz

| Integração | Chamada em | Sync | Em transação/conexão DB? | Timeout | Retry | Idempotência | Fallback | Circuit breaker | Observab. |
|---|---|---|---|---|---|---|---|---|---|
| **Firebase** (JWKS) | `auth/firebase.py:148` | sim | não | **10s** | não | n/a | 401 controlado | não | log |
| **Redis** (rate limit) | `middlewares/rate_limit.py` | sim | não | **1s** | não | n/a | **fail-open** | não | log |
| **Web Push** | `notifications/push_service.py` | sim | **SIM (batch)** ⚠️ | **10s** | não | 410/404 limpa sub | marca falha, segue | não | log |
| **SendGrid** | `notifications/email_service.py` | sim | **SIM (batch)** ⚠️ | default SDK ⚠️ | não | — | erro controlado | não | log |
| **Cloudinary** | `retreat_routes.py:721` | sim | **SIM (request)** ⚠️ | **15s** | não | overwrite=true | erro controlado | não | log |
| **Sentry** | init | async | não | SDK | SDK | n/a | silencioso | n/a | — |
| **BrasilAPI/Liturgia** | — | — | — | — | — | — | — | — | não chamadas no backend |

## Achados críticos (chamada externa segurando conexão DB)

### A1 — `notify_new_inbox` segura a conexão durante o batch de Push/e-mail ⚠️
`notification_service.notify_new_inbox` abre `with get_db_session() as db:` e,
**dentro** do laço por usuário, chama `_send_push_to_user` (Web Push) e
`send_email` (SendGrid) — **segurando a conexão** por todo o batch.

- **Impacto:** uma conexão do pool fica retida por `N × (latência externa)`.
  Com push timeout 10s e e-mail sem timeout, um batch grande pode reter a conexão
  por muito tempo. **É background** (scheduler/BackgroundTasks), não bloqueia um
  request diretamente, mas consome uma conexão do pool de 15.
- **Severidade:** MÉDIA (background + timeouts limitam o pior caso; ainda assim
  contraria a regra "não segurar conexão durante I/O externo").
- **Fix recomendado (não aplicado — exige cuidado com a lógica de notificação):**
  padrão **fetch → send → record**:
  1. Sessão curta: coletar `opted_in`, e-mails e subscriptions em estruturas
     simples; fechar a sessão.
  2. Fazer os envios externos **sem** conexão.
  3. Sessão curta: registrar resultados / limpar subscriptions expiradas.
  Registrado como tarefa dedicada — a refatoração toca a lógica de envio e merece
  seu próprio PR + testes, não um patch apressado nesta sprint.

### A2 — Cloudinary upload dentro do request (segura a sessão do request)
`POST /retreats/{id}/my-registration/payment` faz `cloudinary.uploader.upload`
com a `DBSession` do request ativa → a conexão do request fica retida durante o
upload. **Mitigado** com `timeout=15` (pior caso limitado). Fix ideal: fazer o
upload **antes** de abrir trabalho de banco, ou mover para background. MÉDIA.

## Correções já aplicadas (PR #26)
- **Web Push** e **Cloudinary** ganharam timeout (antes: nenhum). Eram os dois
  sem bound — o Push é o mais grave por ser em lote.

## Gaps registrados (não corrigidos — decisão/escopo)
- **SendGrid sem timeout explícito:** o `SendGridAPIClient` não expõe timeout
  trivial; envolver em thread com timeout ou trocar por `httpx` é mudança maior.
  MÉDIA (e-mail é background, não hot path).
- **Sem retry/backoff** em nenhuma integração. Aceitável hoje (todas falham
  controladamente); Push/e-mail se beneficiariam de retry + fila. Exige infra.
- **Sem circuit breaker.** Timeout + fail-open cobrem o volume atual.
- **A1 (Push/e-mail segurando conexão):** fix documentado, tarefa dedicada.

## Testes de falha/recuperação
- Pool exhaustion → 503 + recuperação: `test_pool_exhaustion_end_to_end` (#26).
- Banco indisponível: readiness 503, liveness 200 (#26).
- Web Push 410/404 → limpa subscription: testes de push (PR #9).
- Redis indisponível → fail-open: comportamento do rate limiter (conftest roda sem Redis).

## Conclusão
Nenhuma integração faz **retry infinito** nem **retry de operação não
idempotente**. As duas que **seguram conexão durante I/O externo** (Push/e-mail no
batch, Cloudinary no request) estão identificadas e **bounded por timeout**; a de
maior impacto (A1) tem fix desenhado e tarefa dedicada. Firebase e Redis, os dois
no caminho de request, **não** seguram conexão e têm timeout.
