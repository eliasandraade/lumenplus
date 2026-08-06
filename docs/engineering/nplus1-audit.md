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


---

# FASE 2 (2026-07-24) — /retreats: de mitigação parcial a CONSTANTE

A Fase 1 baixou de ~6 para ~3 queries/retiro (mitigação parcial, como corrigido
no feedback). A Fase 2 elimina o crescimento: **query count CONSTANTE**.

## Origem das queries por retiro (instrumentado)

| Origem | Antes (por retiro) | Invariante? | Batch? | Estratégia aplicada |
|--------|:------------------:|-------------|--------|---------------------|
| `retreat.houses` (lazy) | 1 | não | sim | `selectinload(houses)` |
| `retreat.eligibility_rules` (lazy) | 1 | não | sim | `selectinload(eligibility_rules)` |
| `retreat.fee_types` (lazy, em `_retreat_to_dict`) | 1 | não | sim | `selectinload(fee_types)` |
| `retreat.registrations` (lazy, contagem de inscritos) | 1 | não | sim | `selectinload(registrations)` |
| `RetreatRegistration` do usuário | 1 | por (retiro,user) | sim | 1 query `retreat_id.in_(ids)` → mapa |
| `RetreatFeeType` (via `_get_user_fee_info`) | 1 | **fee_cat é invariante** (voc_code) | sim | 1 query `retreat_id.in_(ids)` + `fee_category==fee_cat` → mapa |
| `_get_user_voc_code` | 1 | **invariante** | — | hoist p/ fora do laço (Fase 1) |

## Resultado medido (query count por nº de retiros PUBLICADOS)

| retiros | 0 | 1 | 10 | 50 |
|---|---|---|---|---|
| original | 3 | 11 | 65 | **305** |
| Fase 1 (selectinload+hoist) | 4 | 11 | 38 | 158 |
| **Fase 2 (batch completo)** | 4 | 12 | **12** | **12** |

**Slope 10→50 = 0.0.** `/retreats` agora custa **12 queries independente do nº de
retiros** — N+1 **eliminado**, não apenas mitigado.

## Semântica preservada (testes)
- `test_retreats_por_retiro_abaixo_do_limite`: slope 10→50 ≤ 0.2 e `q50 ≤ q10+2`.
- `test_retreats_batch_preserva_taxa_e_inscricao`: retiro com `RetreatFeeType`
  (PARTICIPANTE=150) + inscrição PENDING_PAYMENT → o batch devolve a **taxa
  correta** (`my_fee.amount_brl==150`) e a **inscrição** (`my_registration.status`).

## Sem multiplicação de linhas
`selectinload(registrations)` carrega as mesmas linhas que o acesso lazy anterior
já carregava (usadas só para CONTAR inscritos ativos) — não há aumento de payload
no retorno (a resposta expõe contagem/capacidade, não a lista de inscrições).

**Reclassificação:** PR #25 deixa de ser "mitigação parcial" e passa a
**"N+1 de /retreats eliminado (constante)"**.


---

# CLASSIFICAÇÃO COMPLETA DOS CANDIDATOS (2026-07-24)

O detector estático marcou **22 rotas** com "query dentro de laço". Cada uma tem
agora uma conclusão EXPLÍCITA. READ-paths que crescem com os dados foram MEDIDOS
(cardinalidade 0/1/10/50); writes foram classificados pela natureza do laço
(itera entrada do request / entidade única) — confirmado por leitura do código,
não superficial.

## Read-paths (risco real de N+1-sob-carga) — MEDIDOS

| # | Rota | Q0 | Q1 | Q10 | Q50 | Cresce? | Status |
|---|------|---:|---:|----:|----:|---------|--------|
| 1 | `GET /retreats` | 4 | 12 | 12 | 12 | **não** | **corrigido** (constante) |
| 2 | `GET /auth/me` | 10 | 11 | 20 | 60 | sim | **corrigido no #20** → constante |
| 3 | `GET /admin/retreats/{id}/registrations` | 7 | 10 | 10 | 10 | **não** | **corrigido aqui** (batch profiles/houses + selectinload) |
| 4 | `GET /inbox` | 5 | 6 | 6 | 6 | não | **CONSTANTE** (InboxService agrega) |
| 5 | `GET /admin/dashboard` | 23 | 23 | 23 | 23 | não | **fixo** (23 agregações, não cresce) |
| 6 | `GET /retreats/{id}` | — | — | — | — | não | **cardinalidade 1** (1 retiro; mesmos helpers já batcháveis, mas N=1) |
| 7 | `GET /admin/retreats/{id}/export` | — | — | — | — | provável | **mesmo padrão de registrations** — CSV itera inscrições; herda o fix se usar a mesma query, senão pendente (admin, baixa freq.) |
| 8 | `GET /admin/audit-logs` | — | — | — | — | não | **paginado** (LIMIT) — cresce com a página, não com o total |
| 9 | `GET /me` (routes.py legado) | — | — | — | — | = /auth/me | **duplicata legada** — mesma correção do #20 |
| 10 | `GET /profile/catalogs` | — | — | — | — | não | **catálogo fixo** (itens de catálogo, cardinalidade estável) |

## Writes (POST/PATCH/DELETE) — classificados por natureza do laço

Nenhum itera uma coleção que cresce com o volume TOTAL do banco; iteram a
**entrada do request** (listas enviadas pelo admin) ou as linhas relacionadas de
**uma entidade** (cascata de delete). O `db_ops` alto reflete a complexidade da
transação, não N+1-sob-carga.

| Rota | Laço sobre | Conclusão |
|------|-----------|-----------|
| `POST /retreats/{id}/register` | regras/casas do retiro (1 retiro) | cardinalidade fixa por retiro |
| `PUT /projeto-vida-mensal/{id}` | itens do request | bounded por payload |
| `PATCH /admin/retreats/{id}` | campos/regras do request | bounded por payload |
| `POST /admin/retreats/{id}/publish` | validações do retiro | fixa por retiro |
| `POST /admin/export/request` | filtros do request | bounded por payload |
| `POST /org/root-unit` | permissões default | fixa |
| `POST /admin/retreats/{id}/fee-types` | lista de taxas do request | bounded por payload |
| `POST /org/units/{parent}/children` | herança de permissões | bounded (profundidade da árvore) |
| `POST /admin/retreats` | setup inicial | fixa |
| `DELETE /admin/users/{id}` | cascata de anonimização (1 user) | fixa por usuário |
| `PATCH /admin/users/{id}` | roles do request | bounded por payload |
| `DELETE /auth/me` | cascata de anonimização (1 user) | fixa por usuário |
| `POST /life-plan/cycles/{id}/goals` | metas do request | bounded por payload |
| `POST /dev/seed` | seed (dev-only) | irrelevante (não-prod) |

## Correções aplicadas nesta auditoria

| Rota | Antes | Depois |
|------|-------|--------|
| `GET /retreats` | 305 q @ 50 | **12 q constante** |
| `GET /admin/retreats/{id}/registrations` | 59 q @ 50 | **10 q constante** |

`/auth/me` (memberships) já é corrigido no #20. Nenhum candidato permanece sem
conclusão. O único item com medição pendente é `/admin/retreats/{id}/export`
(admin, baixa freq.) — marcado explicitamente; se compartilhar a query de
registrations, já está coberto.
