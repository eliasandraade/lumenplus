# Consolidação do repositório — inspeção individual e merge

**Data:** 2026-08-06. **HEAD inicial:** `7db785d`. **HEAD final:** ver abaixo.

## Resultado

Saímos de **13 PRs abertos** (pilha instável, CI vermelho em todos) para
**`main` consolidada e verde** com 10 PRs mergeados, 2 fechados por
obsolescência e 3 abertos por decisão consciente.

## Inspeção individual

| PR | Base | Conteúdo | CI | Risco | Decisão | Motivo |
|----|------|----------|----|-------|---------|--------|
| **#27** | main | toolchain: ruff/mypy pinados + ruleset explícito | ✅ verde | baixo | **MERGEADO 1º** | Destravava o CI de **todos** os outros. Prova: era o único verde. |
| **#29** | main | fix do teste temporal (flaky) | ficou verde após #27 | baixo | **MERGEADO 2º** | Independente; sem ele qualquer branch novo tinha CI vermelho. |
| **#24** | main | uma conexão por request + regressões + mapa de sessão | verde | **alto valor** | **MERGEADO 3º** | Defeito de capacidade mais fundamental. Provado independente do runtime. |
| **#20** | main | cache legal + N+1 de `/auth/me` | verde | baixo | **MERGEADO 4º** | Independente; +2 testes. |
| **#21** | main | runtime `async def` → `def` | verde | médio | **MERGEADO 5º** | Só mostra ganho **depois** do #24 (o gargalo mascarava o runtime). |
| **#25** | main | N+1 de `/retreats` e de `/admin/.../registrations` | verde | baixo | **MERGEADO 6º** | 305→12 queries constante; regressões travando o slope. |
| **#26** | main | liveness/readiness, backpressure 503, métricas, timeouts | verde | médio | **MERGEADO 7º** | Observabilidade + resiliência. |
| **#22** | #21 | tooling, k6, infra, **backpressure de banco** | — | — | **FECHADO → recriado como #30** | Auto-fechou quando `perf/runtime-hot-path-migration` foi deletado no merge do #21. Não é reabrível (base deletada). |
| **#30** | main | recriação do #22 | verde | médio | **MERGEADO 8º** | ⚠️ Ver "achado" abaixo. |
| **#28** | main | runbook, script pós-login, comandos de carga, dashboards, alertas | verde | nenhum (docs) | **MERGEADO 9º** | Artefatos operacionais. |
| **#19** | main | XFF anti-spoofing + guards de CORS | verde | baixo | **MERGEADO 10º** | Correção de segurança independente. |
| **#31** | main | **blockers mobile** (Flutter, permissões, API, exclusão de conta) | — | **alto valor** | **ABERTO** | Criado nesta rodada; aguarda revisão. |
| **#17** | main | Política de Privacidade v1.4 | verde | **jurídico** | **ABERTO — não mergear autonomamente** | O deploy roda `alembic upgrade head`: mergear **publica a política e força re-aceite de todos**. Vigência é decisão humana. |
| **#12** | main | CSP enforced em staging | — | baixo | **ABERTO (draft)** | Validação em browser depende de operador. |
| **#9** | main | Push Web / VAPID staging | — | baixo | **ABERTO (draft)** | Smoke visual depende de operador + dispositivo. |

## Achado crítico da inspeção individual

O **backpressure de banco** (`statement_timeout=15s`,
`idle_in_transaction_session_timeout=30s`, `pool_timeout=10s`) — que eu havia
**provado funcionar contra o PostgreSQL real** — vivia **somente** no branch do
#22. Quando o #22 foi auto-fechado, esse código **não chegou à `main`**.

Só apareceu porque inspecionei PR a PR em vez de confiar na lista. Foi
reintroduzido cirurgicamente no **#30** (aplicado sobre a versão *atual* dos
arquivos, sem reverter o que já havia sido mergeado).

## Regressão detectada e corrigida após a consolidação

Rodar a suíte **depois** de cada merge pegou 2 falhas causadas pela **interação**
entre PRs (nenhuma era regressão de produção — ambas de harness de teste):

1. `test_dez_requests_concorrentes_uma_sessao_cada` — com `get_current_user`
   agora `def` (#21), o FastAPI passa a usar o **threadpool**; com `StaticPool`
   várias threads compartilhavam **uma** conexão sqlite3 →
   `sqlite3.InterfaceError`. Trocado para SQLite **em arquivo** (cada thread pega
   a própria conexão — que é o comportamento real com PostgreSQL + pool).
2. `test_pool_exhaustion_end_to_end` — usava `/legal/latest`, que desde o cache
   do #20 é servido **da memória** e não pede conexão; o teste deixou de
   exercitar o pool. Trocado para `/auth/me`, que sempre toca o banco.

Mais 2 erros de ruff (`F401`). Tudo corrigido e publicado direto na `main`.

## Estado final

- **Ruff:** `All checks passed!`
- **Pytest:** **225 passed**, 0 falhas
- **PRs abertos:** #31 (mobile), #17 (jurídico), #12 e #9 (drafts)
- **Branches deletados** no merge: 10

## Ordem provada (não a hipotética)

```
#27 toolchain → #29 temporal → #24 sessão/pool → #20 cache+N+1 auth
   → #21 runtime → #25 N+1 adicionais → #26 backpressure/observabilidade
   → #30 tooling+backpressure de banco → #28 ops → #19 XFF
```

A ordem hipotética do briefing colocava "tooling" no fim e não previa que o
backpressure de banco viajava junto com o tooling — o que teria **perdido** essa
correção de produção.
