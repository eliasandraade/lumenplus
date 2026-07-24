# Benchmark das rotas reais — Sprint 4

**Ferramenta:** `backend/performance/route_bench.py` (reproduzível).
**Data da medição:** 2026-07-24.

## Classificação do ambiente (obrigatória)

> **MEDIDA LOCALMENTE** — SQLite em arquivo, in-process via `httpx ASGITransport`.
> **NÃO é PostgreSQL. NÃO é Railway. NÃO é medição de produção.**

Isto substitui o `runtime_bench.py`, que usava rotas de brinquedo. Aqui a
aplicação FastAPI **real** é carregada, com roteador, dependencies e ORM reais.

### Artefato encontrado e corrigido no próprio benchmark

A primeira execução media o **rate limiter**, não as rotas: o limite padrão
devolvia `429` sob concorrência e a latência parecia excelente. Duas correções:

1. `RATE_LIMIT_REQUESTS_PER_MINUTE` elevado **apenas no processo de benchmark**.
2. Contabilização de erro passou a considerar **qualquer não-2xx** (antes só
   `>= 500`, o que mascarava os 429).

Sem essas correções, todos os números abaixo estariam errados.

## Comparação A/B — `GET /auth/me`

Mesmo commit base, mesmos dados sintéticos, mesma autenticação, mesmo banco,
mesma configuração. 2 rodadas por nível, com warm-up não medido.

| Concorrência | `main` (`async def` + banco síncrono) | Convertido (`def` → threadpool) |
|---|---|---|
| 1 | 149,9 rps · p50 **6,51 ms** · p95 6,75 ms · 0 erros | 141,7 rps · p50 **6,86 ms** · p95 7,18 ms · 0 erros |
| 10 | **NÃO CONCLUIU em 240 s** | 152,8 rps · p50 **57,61 ms** · p95 64,73 ms · **0 erros** |
| 25 | **NÃO CONCLUIU em 600 s** | 0,8 rps · p50 30.076 ms · **43 erros de 50** |

### Leitura honesta

- **c=1: sem diferença relevante.** A conversão **não** introduziu regressão no
  caso serial (6,51 → 6,86 ms está dentro do ruído). Isso é importante: o ganho
  não vem de a rota ficar "mais rápida", e sim de ela deixar de **serializar**.
- **c=10: a diferença é qualitativa, não percentual.** O estado `main` não
  completou 20 requests em 4 minutos; o convertido completou com **0 erros**.
  Não expresso isso como "N× mais rápido" porque o baseline não terminou — não
  há denominador legítimo.
- **c=25: ambos falham.** O convertido ao menos devolve alguns `200`; o `main`
  não conclui.

### Por que o `main` trava (hipótese com mecanismo, não certeza)

Com `async def` + I/O síncrono, a chamada bloqueante ocupa o event loop. Se essa
chamada espera um lock de banco que só pode ser liberado por outra request em
voo, essa outra request **não consegue ser agendada** — o loop está bloqueado.
Isso é um deadlock estrutural, não lentidão.

**Não comprovado em PostgreSQL.** O SQLite tem lock global de escrita, o que
torna o cenário mais fácil de disparar. **NÃO MEDIDA — blocker:** exige Postgres
real para confirmar se o mesmo deadlock ocorre.

### Por que c=25 falha mesmo convertido — investigado, não assumido

Sinais coletados na mesma execução, com as **outras** rotas autenticadas
(todas passando pela mesma dependency `get_current_user` no threadpool):

| Rota (c=25) | rps | p50 | erros |
|---|---:|---:|---:|
| `GET /retreats` | 308,9 | 63,08 ms | 0 |
| `GET /profile` | 246,8 | 70,98 ms | 0 |
| `GET /inbox/unread` | 216,9 | 95,48 ms | 0 |
| `GET /inbox` | 193,6 | 106,57 ms | 0 |
| `GET /legal/latest` | 323,8 | 61,47 ms | 0 |
| `GET /auth/me` | **0,8** | **30.076 ms** | **43** |

Como o threadpool + a dependency de auth funcionam a c=25 em **cinco** outras
rotas, a falha é específica de `/auth/me`, que é a rota com maior número de
queries (acessa `identities`, `profile`, `memberships`, `global_roles` — cada
relacionamento lazy vira query). A explicação mais consistente é **contenção de
lock do SQLite amplificada pelo número de queries** — um artefato do banco de
teste.

> **Não afirmo que `/auth/me` quebra em produção.** Também **não** afirmo que
> está seguro. **NÃO MEDIDA — blocker:** reproduzir contra PostgreSQL.
> Este é o item de maior prioridade da suíte de carga (Sprint 5/7).

## Rotas medidas

Escolhidas pelo ranking da Sprint 3 (`backend-hot-paths.md`): `/health`
(controle, sem banco), `/legal/latest`, `/auth/me`, `/inbox/unread`, `/inbox`,
`/profile`, `/retreats`.

## Como reproduzir

```bash
cd backend
python performance/route_bench.py --concurrency 1,10,25,50,100 --rounds 5 --out bench.json
python performance/route_bench.py --only "auth/me" --db-latency-ms 5   # simula RTT de Postgres
```

`--db-latency-ms` injeta latência por query para modelar round-trip de rede.
Resultados com essa flag são **simulação**, nunca medição de produção.

## O que este benchmark NÃO prova

- Não prova capacidade de 100, 200 ou 250 usuários.
- Não prova comportamento em PostgreSQL nem no Railway.
- Não mede CPU, memória, pool wait nem event-loop lag.
- Não substitui a suíte de carga (Sprint 5).

---

# CORREÇÃO (2026-07-24) — a anomalia tinha causa real, e não era o runtime

A seção acima registrou que `/auth/me` "não concluía" e colapsava em c=25, e eu
levantei a hipótese de contenção de SQLite. **A hipótese estava errada.** A
investigação com harness instrumentado (`performance/diag_auth_me.py`) achou a
causa real.

## Como foi encontrada

`faulthandler` + dump de threads durante o travamento mostrou **todas** as
threads paradas no mesmo ponto:

```
sqlalchemy/pool/impl.py:156  in _do_get      <- QueuePool esperando conexão
sqlalchemy/pool/base.py:711  in checkout
sqlalchemy/engine/base.py:3309 in raw_connection
```

Estado do pool no momento do travamento: `connect: 15` — exatamente
`pool_size(5) + max_overflow(10)`. O pool estava **esgotado**.

## Causa-raiz: duas conexões por request

`app/api/deps.py` definia seu **próprio** `get_db`, duplicando o de
`app/db/session.py`. O FastAPI faz cache de dependência **pelo callable**: como
eram dois objetos distintos, um handler que usasse `CurrentUser` (que depende do
`get_db` de `deps`) **e** `Depends(get_db)` de `app.db.session` abria **duas
sessões** e segurava **duas conexões simultâneas** por request.

- Handlers afetados: **11** — incluindo `GET /auth/me`, o #1 do ranking.
- Com 15 conexões no pool, o teto real era **~7 requests concorrentes**, não 15.
- 10 requests concorrentes precisavam de 20 conexões → esgotamento → threads
  presas até o `pool_timeout` (30 s no default do SQLAlchemy).

**Isto é um defeito de capacidade da aplicação, não artefato do banco de teste.**
Vale igualmente em PostgreSQL: o pool é da aplicação, não do SQLite.

## Correção

`app/api/deps.py` passou a **reexportar** o `get_db` canônico de
`app/db/session.py`. Mesmo callable → o cache de dependência do FastAPI resolve
uma vez → **uma conexão por request**.

## Prova (mesmo teste, mesmo harness, c=10)

| | conexões físicas criadas | resultado |
|---|---|---|
| Antes (dois `get_db`) | **15 (pool esgotado)** | **estourou 40 s · 0/10 concluídas** |
| Depois (um `get_db`) | 10 (1 por request) | **0,07 s · 10/10 · todas 200** |

## Benchmark corrigido de `GET /auth/me`

| c | rps | p50 | p95 | erros |
|---:|---:|---:|---:|---:|
| 1 | 149,5 | 6,51 ms | 6,95 ms | 0 |
| 10 | 170,1 | 52,42 ms | 62,58 ms | 0 |
| 25 | 163,5 | 117,19 ms | 152,62 ms | 0 |
| 50 | 170,5 | 202,90 ms | 277,70 ms | 0 |

Comportamento agora é o esperado: throughput satura (~170 rps) e a latência
cresce proporcionalmente à concorrência, **com zero erros**. O colapso
(0,8 rps / 30 s / 43 erros) desapareceu.

## O que isso invalida do que eu disse antes

- **Invalidado:** "o `main` não conclui em 240 s porque `async def` + I/O
  síncrono causa deadlock de event loop". O travamento era **esgotamento de
  pool** por conexão duplicada. Rotas `async def` continuam serializando o
  loop — isso segue valendo — mas **não era a causa deste travamento**.
- **Invalidado:** a hipótese de contenção de lock do SQLite.
- **Continua válido:** a conversão para `def` não introduziu regressão em c=1.
- **Ainda NÃO MEDIDO:** o ganho da conversão sob carga real em PostgreSQL. Com
  o gargalo de pool removido, o A/B de runtime precisa ser **refeito** — os
  números anteriores mediam o bug, não o runtime.
