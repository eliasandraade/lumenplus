# Auditoria de N+1 — read-path (Sprint 5, item de continuação)

**Data:** 2026-07-24. **Ferramenta:** `backend/performance/nplus1_probe.py`
(semeia cardinalidade 0/1/10/50 e conta queries via `before_cursor_execute`).
Contagem de **queries** — independe do banco, vale para PostgreSQL.

## Método

Os 15 candidatos vieram do inventário estático (query dentro de laço,
`route_inventory.py`). A maioria é **write** (POST/PATCH) de **cardinalidade
fixa** — não sofre N+1-sob-carga (não iteram uma lista que cresce com os dados).
As rotas **read-path** que crescem com a cardinalidade são as de risco real e
foram medidas.

## Resultados medidos

| Rota | Relação/laço | Q0 | Q1 | Q10 | Q50 | Cresce? | Status | Correção | Resultado |
|------|--------------|---:|---:|----:|----:|---------|--------|----------|-----------|
| `GET /auth/me` | memberships → `org_unit` (lazy) | 10 | 11 | 20 | 60 | **SIM** (~1/mbr) | **corrigido no #20** | `joinedload(OrgMembership.org_unit)` | constante (8) após #20 |
| `GET /retreats` | por retiro: `houses`, `eligibility_rules` (lazy) + voc_code + fee + reg | 3 | 11 | 65 | 305 | **SIM** (~6/retiro) | **corrigido aqui** | `selectinload(houses, eligibility_rules)` + hoist de `voc_code` p/ fora do laço | **~3/retiro** (158 em 50) — metade |
| `GET /inbox` | `InboxService` (delegado) | 5 | — | — | — | inconclusivo | **a investigar** | — | seed sintético falhou (schema de `InboxMessage`); mede 5 a vazio |

## Análise por rota

### `GET /auth/me` — memberships (CONFIRMADO, corrigido no #20)
Cada membership ativa acessava `m.org_unit.name`/`.type` (lazy) → 1 query por
membership. Medido sem #20: 60 queries com 50 memberships. #20 aplica
`joinedload(OrgMembership.org_unit)` → constante. **Impacto real:** bounded pelo
nº de ministérios de uma pessoa (poucos), mas 100% no hot path da abertura.

### `GET /retreats` — eligibility/fee/houses (CONFIRMADO, corrigido aqui)
Mesmo com `visibility_type=ALL` (elegibilidade retorna cedo), cada retiro no laço
disparava:
- `retreat.houses` (lazy) — em `_available_modalities` e `_retreat_to_dict`;
- `retreat.eligibility_rules` (lazy) — em `_user_eligible_as_service`;
- `_get_user_voc_code` — **perfil do usuário, invariante entre retiros**;
- `fee_type` e `registration` — por (retiro, usuário).

**Correção (comportamento preservado):**
1. `selectinload(Retreat.houses, Retreat.eligibility_rules)` na query da lista —
   1 query por relação para o conjunto todo, mesmos dados.
2. **Hoist** de `_get_user_voc_code` para **fora** do laço (valor idêntico para
   todos os retiros do mesmo usuário), passado a `_get_user_fee_info`.

Resultado medido: **305 → 158 queries** com 50 retiros (~6 → ~3 por retiro).
Regressão: `tests/test_perf_retreats_nplus1.py` trava o slope em ≤ 4/retiro.

**Não fui além** (batch de `registration`/`fee_type` numa query só): exigiria
reescrever a montagem do dict e o ganho marginal é baixo — o nº de retiros
PUBLICADOS simultâneos é pequeno neste domínio. Registrado como melhoria futura,
não como crítico. **Não usei `joinedload` indiscriminado** (houses e
eligibility_rules são to-many → `selectinload`, não `joinedload`, para não
multiplicar linhas).

### `GET /inbox` — delegado a `InboxService` (INCONCLUSIVO)
A rota delega 100% para `InboxService(db)`. O probe não conseguiu semear
`InboxMessage` (nomes de coluna divergem do palpite). A vazio são 5 queries.
**Ação:** medir com seed correto do `InboxService` numa próxima passada — não
classifico sem medir. Não é write, então tem risco real se o serviço iterar
mensagens com lazy-load.

## Candidatos NÃO medidos (write, cardinalidade fixa) — baixo risco de N+1-sob-carga

`POST /retreats/{id}/register`, `PUT /projeto-vida-mensal/{id}`,
`PATCH/POST /admin/retreats/*`, `POST /admin/export/request`,
`POST /org/root-unit`, `POST /org/units/{parent}/children`,
`DELETE /admin/users/{id}`. São operações de escrita com nº de queries
proporcional a uma entrada de tamanho fixo (não a uma lista que cresce com os
dados). O `db_ops` alto do inventário reflete a complexidade da transação, não
um N+1 clássico. Reavaliar caso vire hot path de escrita sob carga.

## Pendências honestas

- `GET /inbox`: **NÃO MEDIDO** com dados — seed sintético a corrigir.
- `GET /admin/dashboard` (20 ops estáticos): agrega muitos dados; medir slope por
  nº de usuários/unidades numa próxima passada. Baixa frequência (poucos admins),
  mas custo por chamada alto.
- Batch de registration/fee em `/retreats`: melhoria futura, não crítico.
