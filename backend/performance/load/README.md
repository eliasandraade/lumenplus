# Suíte de carga — Lumen+ (Sprint 5)

Suíte k6 para medir capacidade real do backend. **Não roda contra produção.**

## Segurança (leia primeiro)

- `config.js` e `seed_synthetic_users.py` **recusam** alvos que casem com padrões
  de produção (`backend-production`, `lumenplus.vercel.app`, `lumenplus.app`,
  `lumenserfeliz.org`). Existe override explícito — **não use nesta missão**.
- Usuários sintéticos usam o TLD reservado `.invalid` (RFC 2606), não roteável:
  é impossível enviar e-mail real para eles por acidente.
- Nenhum perfil dispara **push real**, **e-mail real**, **integração paga** ou
  escrita em dado real. O Perfil D usa apenas o aceite legal, que é idempotente.
- Inscrição de Push foi **deliberadamente deixada de fora** do Perfil D para
  eliminar qualquer chance de envio externo.

## Instalação

k6 é um binário único, sem dependências:

```bash
winget install k6 --source winget
```

```bash
choco install k6
```

Alternativa sem instalar (container):

```bash
docker run --rm -i -v "${PWD}:/src" grafana/k6 run /src/main.js
```

## Configuração por ambiente

| Variável | Obrigatória | Descrição |
|---|---|---|
| `BASE_URL` | sim | Backend alvo. **Nunca produção.** |
| `TOKENS` | sim | Lista separada por vírgula, vinda do seed. |
| `PROFILE` | não | `A`, `B`, `C` ou `D` (padrão `A`). |
| `VUS` / `DURATION` | não | Carga constante (padrão 10 / `1m`). |
| `RAMP` | não | `1` ativa o ramp de certificação 10→250. |
| `ENV_NAME` | não | Rótulo no relatório. |

## Passo 1 — seed

```bash
python seed_synthetic_users.py --base-url https://backend-staging.up.railway.app --count 50
```

Emite `TOKENS=dev:loadtest-0:...,...`.

> **Limitação real:** o seed só emite tokens sozinho se o alvo rodar
> `AUTH_MODE=DEV`. Com Firebase real, os tokens precisam vir do Firebase
> (`--tokens-file`). Isso é um **blocker humano legítimo** — exige credencial.

## Passo 2 — executar

```bash
k6 run -e BASE_URL=$BASE_URL -e TOKENS=$TOKENS -e PROFILE=A -e VUS=25 -e DURATION=2m --summary-export=out/A.json main.js
```

Ramp de certificação (10→25→50→100→150→200→250, com sustentação e recuperação):

```bash
k6 run -e BASE_URL=$BASE_URL -e TOKENS=$TOKENS -e PROFILE=A -e RAMP=1 --summary-export=out/ramp.json main.js
```

## Passo 3 — cleanup

```bash
python seed_synthetic_users.py --base-url $BASE_URL --count 50 --cleanup
```

## Perfis

| Perfil | Jornada | Rotas |
|---|---|---|
| **A** | abertura do app | `/health`, `/auth/me`, `/legal/latest`, `/inbox/unread` |
| **B** | navegação | `/auth/me`, `/retreats`, `/profile`, `/inbox` |
| **C** | rajada pós-Push | `/auth/me`, `/inbox/unread`, `/inbox` — **sem pausa entre requests** |
| **D** | escritas controladas | `/legal/latest` + `/legal/accept` (idempotente) |

## Thresholds e critérios de aborto

| Métrica | Limite | Aborta? |
|---|---|---|
| `http_req_failed` | `rate < 0.02` (2%) | **sim** |
| `http_req_duration` | `p95 < 2000 ms`, `p99 < 5000 ms` | não |
| `journey:open_app` | `p95 < 1500 ms` | não |
| `checks` | `rate > 0.98` | não |

Abortar manualmente também quando: pool exhaustion, timeouts generalizados,
CPU crítica sustentada, memória sem estabilização, worker morto, banco instável,
latência crescendo exponencialmente ou impacto em outro ambiente.

## Relatório

`--summary-export=out/<nome>.json` gera JSON por execução. Registre por estágio:
RPS, p50/p90/p95/p99, taxa de erro, CPU, memória, threads, workers, conexões,
pool wait, tempo de banco, event-loop lag e recuperação pós-rajada.

## O que a suíte NÃO resolve sozinha

- Não descobre `max_connections` do Postgres nem limites de CPU/memória do
  Railway — veja `docs/engineering/infra-discovery.md`.
- Não substitui observabilidade: sem métricas de pool e event-loop lag, um
  resultado ruim não diz **onde** está o gargalo.
