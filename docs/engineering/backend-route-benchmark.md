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
