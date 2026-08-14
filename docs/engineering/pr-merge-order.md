# Ordem de merge dos PRs — auditada pelo grafo e pela semântica

**Data:** 2026-07-24.

## Ordem final

| # | PR | Base | Por quê nesta posição |
|---|----|------|------------------------|
| 1 | **#24** `fix/db-pool-single-session` | **main** | Defeito de capacidade mais fundamental (esgotamento de pool por sessão duplicada). **Independente** de tudo — provado com `get_current_user` ainda `async`. Necessário para qualquer benchmark confiável. |
| 2 | **#20** `perf/backend-legal-cache-and-nplus1` | main | Cache de doc legal + N+1 de memberships. Independente; reduz queries de `/auth/me`. Adiciona 2 testes. |
| 3 | **#21** `perf/runtime-hot-path-migration` | main | Migração de runtime (auth dep + hot paths → `def`). Só mostra ganho **depois** do #24 (sem o fix de pool, o gargalo mascarava o runtime). |
| 4 | **#22** `perf/sprint3-hot-path-inventory` | #21 | Tooling (inventário, benchmark, k6), descoberta de infra, backpressure e docs. É o topo da pilha. |

**#23 — FECHADO.** Continha o fix de pool, que foi rebaseado limpo para `main`
no #24. As correções do doc de benchmark foram consolidadas no #22. Nenhum
commit duplicado; nenhum histórico perdido.

## Como a ordem foi determinada (não aceita automaticamente)

- **Bases reais:** #20 e #21 saem de `main` (independentes); #22 empilha em #21;
  #23 empilhava em #22.
- **#24 pode ir direto sobre main?** SIM — comprovado: o fix em `deps.py` **não
  toca** `get_current_user`, então é ortogonal ao async→def do #21. Cherry-pick
  aplicou limpo em `main`; suíte 200 passed; e o diagnóstico mostrou c=10 →
  0,07 s / 10/10 com `get_current_user` ainda `async`.
- **Sem diffs duplicados:** o fix de pool vive só no #24; o doc de A/B vive só no
  #22. #21 não toca o bloco `get_db`, então quando mergear depois do #24 a
  remoção do `get_db` duplicado (feita pelo #24) prevalece no 3-way merge — o
  duplicado **não** ressuscita (e a regressão de arquitetura pegaria se ressuscitasse).

## Reconciliação de contagem de testes (192 vs 194 vs 200)

| Estado | Coletados | Δ vs main |
|---|---|---|
| main | 192 | — |
| #20 | 194 | **+2** — `tests/test_perf_query_count.py`: `test_auth_me_membership_query_count_is_constant`, `test_measure_key_endpoints` |
| #21 | 192 | 0 — só corrige o teste flaky de data; não adiciona casos |
| #22 | 192 | 0 |
| #24 | 200 | +8 — `test_arch_db_session.py` (4) + `test_db_session_lifecycle.py` (4) |

O "194 do estado combinado #20+#21" era exatamente **192 + os 2 testes de
query-count do #20**. Não havia mistério nem teste sumido. Estado final com tudo
mergeado: **192 + 2 (#20) + 8 (#24) = 202**.

## CI por PR

O CI roda a suíte por PR isoladamente (cada branch). Como cada PR mantém a suíte
verde no seu próprio estado, e a ordem acima respeita as dependências
semânticas, não há merge que quebre `main`.
