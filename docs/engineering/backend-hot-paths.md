# Backend — Inventário de Rotas e Hot Paths (Sprint 3)

**Gerado por:** `backend/performance/route_inventory.py` + `gen_hot_paths_doc.py` (reproduzível: `python performance/route_inventory.py > performance/_inventory.json`).

## Método e limitações (ler antes de usar os números)

A classificação é **análise estática de AST com travessia de call graph de 2 níveis** (rota → service → helper). Não é perfilamento em produção.

**Limitações conhecidas e comprovadas:**

- `db_ops` é **contagem estática de chamadas no código**, não queries executadas em runtime. Um laço conta 1 estaticamente e N em execução.
- A primeira versão do detector produziu **falso-negativo comprovado**: as rotas `/inbox/*` foram classificadas como "sem banco" porque delegam 100% para `InboxService(db)`. Corrigido detectando instanciação de Service/Repository que recebe a sessão. **Podem restar outros falsos-negativos** — categoria D significa *"nenhum trabalho bloqueante detectado"*, não *"comprovadamente sem banco"*.
- **Frequência não vem de logs de produção** (não há logs acessíveis). É estimativa derivada da participação da rota nas jornadas do app — marcada como tal em cada linha.

## Resumo

- **Total de rotas:** 166
- **Categoria A** (DB-bound pesada / CPU-bound): 105
- **Categoria B** (DB-bound leve): 58
- **Categoria C** (integração externa síncrona): 1
- **Categoria D** (nenhum trabalho bloqueante detectado): 2
- **Já são `def`:** 63
- **`async def` sem `await` COM trabalho bloqueante (a converter):** 101

> **Correção de uma afirmação anterior:** o checkpoint pós-Sprint 4 disse que o problema era "app-wide" a partir de "104 de 105 rotas async sem await". O inventário completo mostra que o total real é 166 rotas, que **63 já eram `def`**, e que **2 rotas não têm trabalho bloqueante detectado** — converter essas não traz ganho. A generalização estava errada; o número correto de alvos é **101**.

## Jornadas reais mapeadas

- **J1 abertura do app** → `/auth/me`, `/legal/latest`, `/inbox/unread`, `/health`
- **J2 login e provisionamento** → `/auth/me`, `/auth/login`, `/auth/register`, `/auth/check-cpf`
- **J3 home** → `/inbox/unread`, `/inbox`, `/auth/me`, `/org/my-memberships`
- **J4 eventos (lista/detalhe)** → `/retreats`, `/retreats/{retreat_id}`
- **J5 notificações** → `/inbox`, `/inbox/unread`, `/inbox/{recipient_id}/read`, `/inbox/read-all`
- **J6 perfil** → `/profile`, `/profile/catalogs`, `/profile/sectors`, `/profile/missions`
- **J7 documentos legais** → `/legal/latest`, `/legal/accept`
- **J8 rajada pós-Push** → `/auth/me`, `/inbox/unread`, `/inbox`, `/legal/latest`
- **J9 administração** → `/admin/dashboard`, `/admin/users`, `/admin/audit-logs`

## Fórmula de ranking

```
impacto = frequência(estimada) × concorrência × custo_de_banco(db_ops estático)
```

`concorrência` = 3 para rotas de abertura/rajada pós-Push (acessos concentrados), 2 para rotas de jornada, 1 caso contrário.

## Top 20 hot paths por impacto

| # | Impacto | Método | Path | Cat | Tipo | db_ops | Freq (origem) | Jornadas | Recomendação |
|---|--------:|--------|------|-----|------|-------:|---------------|----------|--------------|
| 1 | 150 | GET | `/auth/me` | A | def | 5 | 10 (estimativa por jornada) | J1, J2, J3, J8 | ja e def |
| 2 | 120 | GET | `/retreats` | A | async def | 12 | 5 (estimativa por jornada) | J4 | CONVERTER para def |
| 3 | 96 | GET | `/retreats/{retreat_id}` | A | async def | 12 | 4 (estimativa por jornada) | J4 | CONVERTER para def |
| 4 | 90 | GET | `/inbox` | A | def | 5 | 6 (estimativa por jornada) | J3, J5, J8 | ja e def |
| 5 | 80 | GET | `/admin/dashboard` | A | async def | 20 | 2 (estimativa por jornada) | J9 | CONVERTER para def |
| 6 | 42 | GET | `/legal/latest` | B | def | 2 | 7 (estimativa por jornada) | J1, J7, J8 | ja e def |
| 7 | 40 | POST | `/legal/accept` | A | async def | 10 | 2 (estimativa por jornada) | J7 | CONVERTER para def |
| 8 | 27 | GET | `/health` | D | async def | 0 | 9 (estimativa por jornada) | J1 | def opcional (sem trabalho bloqueante) |
| 9 | 24 | DELETE | `/auth/me` | A | async def | 8 | 1 (estimativa por jornada) | J1, J2, J3, J8 | CONVERTER para def |
| 10 | 24 | GET | `/profile` | B | async def | 3 | 4 (estimativa por jornada) | J6 | CONVERTER para def |
| 11 | 24 | GET | `/inbox/unread` | B | def | 1 | 8 (estimativa por jornada) | J1, J3, J5, J8 | ja e def |
| 12 | 22 | POST | `/retreats/{retreat_id}/register` | A | async def | 22 | 1 (baseline (não está em jornada quente)) | — | CONVERTER para def |
| 13 | 18 | PUT | `/profile` | A | async def | 9 | 1 (baseline (não está em jornada quente)) | J6 | CONVERTER para def |
| 14 | 16 | PUT | `/projeto-vida-mensal/{projeto_id}` | A | def | 16 | 1 (baseline (não está em jornada quente)) | — | ja e def |
| 15 | 15 | PATCH | `/admin/retreats/{retreat_id}` | A | async def | 15 | 1 (baseline (não está em jornada quente)) | — | CONVERTER para def |
| 16 | 15 | POST | `/admin/retreats/{retreat_id}/publish` | A | async def | 15 | 1 (baseline (não está em jornada quente)) | — | CONVERTER para def |
| 17 | 14 | POST | `/admin/export/request` | A | async def | 14 | 1 (baseline (não está em jornada quente)) | — | CONVERTER para def |
| 18 | 13 | POST | `/org/root-unit` | A | async def | 13 | 1 (baseline (não está em jornada quente)) | — | CONVERTER para def |
| 19 | 12 | GET | `/admin/users` | A | async def | 6 | 1 (baseline (não está em jornada quente)) | J9 | CONVERTER para def |
| 20 | 12 | POST | `/auth/register` | A | async def | 6 | 1 (baseline (não está em jornada quente)) | J2 | CONVERTER para def |

## Seleção justificada das rotas da Sprint 4

Convertidas no PR #21 (primeiro lote, deliberadamente pequeno):

| Alvo | Justificativa |
|------|---------------|
| `get_current_user` (dependency) | Não é rota: é a dependency de **toda** rota autenticada. Era `async def` sem `await` executando verificação de token + I/O de banco. Enquanto ela bloqueasse o loop, converter rotas isoladas não produziria ganho. **Maior alavancagem do projeto.** |
| `GET /auth/me` | Maior impacto do ranking (frequência 10 × concorrência 3). |
| `GET /legal/latest` | Jornada de abertura + rajada pós-Push. |

## Risco de N+1 remanescente (queries dentro de laço)

| Método | Path | db_ops | Observação |
|--------|------|-------:|------------|
| POST | `/retreats/{retreat_id}/register` | 22 | query dentro de laço — candidato a `joinedload`/`selectinload` |
| PUT | `/projeto-vida-mensal/{projeto_id}` | 16 | query dentro de laço — candidato a `joinedload`/`selectinload` |
| PATCH | `/admin/retreats/{retreat_id}` | 15 | query dentro de laço — candidato a `joinedload`/`selectinload` |
| POST | `/admin/retreats/{retreat_id}/publish` | 15 | query dentro de laço — candidato a `joinedload`/`selectinload` |
| POST | `/admin/export/request` | 14 | query dentro de laço — candidato a `joinedload`/`selectinload` |
| POST | `/org/root-unit` | 13 | query dentro de laço — candidato a `joinedload`/`selectinload` |
| GET | `/retreats` | 12 | query dentro de laço — candidato a `joinedload`/`selectinload` |
| GET | `/retreats/{retreat_id}` | 12 | query dentro de laço — candidato a `joinedload`/`selectinload` |
| POST | `/admin/retreats/{retreat_id}/fee-types` | 10 | query dentro de laço — candidato a `joinedload`/`selectinload` |
| POST | `/org/units/{parent_id}/children` | 10 | query dentro de laço — candidato a `joinedload`/`selectinload` |
| POST | `/admin/retreats` | 9 | query dentro de laço — candidato a `joinedload`/`selectinload` |
| DELETE | `/admin/users/{user_id}` | 9 | query dentro de laço — candidato a `joinedload`/`selectinload` |
| POST | `/dev/seed` | 9 | query dentro de laço — candidato a `joinedload`/`selectinload` |
| GET | `/admin/retreats/{retreat_id}/export` | 8 | query dentro de laço — candidato a `joinedload`/`selectinload` |
| GET | `/admin/retreats/{retreat_id}/registrations` | 8 | query dentro de laço — candidato a `joinedload`/`selectinload` |

## Integrações externas síncronas (categoria C)

- `POST /retreats/{retreat_id}/my-registration/payment` → Cloudinary

## Inventário completo

| Método | Path | Arquivo | Tipo | await | Deps | Banco | db_ops | N+1? | Externa | CPU | Cat | Recomendação |
|--------|------|---------|------|-------|------|-------|-------:|------|---------|-----|-----|--------------|
| GET | `/admin/audit-logs` | `routes/admin.py` | async def | não | CurrentUser, DBSession | sim | 4 | SIM | — | — | A | CONVERTER para def |
| GET | `/admin/dashboard` | `routes/admin.py` | async def | não | CurrentUser, DBSession | sim | 20 | — | — | — | A | CONVERTER para def |
| POST | `/admin/export/request` | `routes/export.py` | async def | não | CurrentUser, DBSession | sim | 14 | SIM | — | sim | A | CONVERTER para def |
| POST | `/admin/export/{export_id}/approve` | `routes/export.py` | async def | não | CurrentUser, DBSession | sim | 7 | — | — | — | A | CONVERTER para def |
| GET | `/admin/export/{export_id}/download` | `routes/export.py` | async def | não | CurrentUser, DBSession | sim | 8 | — | — | sim | A | CONVERTER para def |
| POST | `/admin/export/{export_id}/reject` | `routes/export.py` | async def | não | CurrentUser, DBSession | sim | 4 | — | — | — | A | CONVERTER para def |
| POST | `/admin/retreats` | `admin_retreat_routes.py` | async def | não | CurrentUser, DBSession | sim | 9 | SIM | — | — | A | CONVERTER para def |
| GET | `/admin/retreats` | `admin_retreat_routes.py` | async def | não | CurrentUser, DBSession | sim | 6 | — | — | — | A | CONVERTER para def |
| PATCH | `/admin/retreats/{retreat_id}` | `admin_retreat_routes.py` | async def | não | CurrentUser, DBSession | sim | 15 | SIM | — | — | A | CONVERTER para def |
| GET | `/admin/retreats/{retreat_id}` | `admin_retreat_routes.py` | async def | não | CurrentUser, DBSession | sim | 5 | — | — | — | A | CONVERTER para def |
| POST | `/admin/retreats/{retreat_id}/cancel` | `admin_retreat_routes.py` | async def | não | CurrentUser, DBSession | sim | 6 | — | — | — | A | CONVERTER para def |
| POST | `/admin/retreats/{retreat_id}/close` | `admin_retreat_routes.py` | async def | não | CurrentUser, DBSession | sim | 6 | — | — | — | A | CONVERTER para def |
| POST | `/admin/retreats/{retreat_id}/coordinators` | `admin_retreat_routes.py` | async def | não | CurrentUser, DBSession | sim | 10 | — | — | — | A | CONVERTER para def |
| GET | `/admin/retreats/{retreat_id}/coordinators` | `admin_retreat_routes.py` | async def | não | CurrentUser, DBSession | sim | 5 | — | — | — | A | CONVERTER para def |
| DELETE | `/admin/retreats/{retreat_id}/coordinators/{coordinator_id}` | `admin_retreat_routes.py` | async def | não | CurrentUser, DBSession | sim | 6 | — | — | — | A | CONVERTER para def |
| POST | `/admin/retreats/{retreat_id}/eligibility-rules` | `admin_retreat_routes.py` | async def | não | CurrentUser, DBSession | sim | 8 | — | — | — | A | CONVERTER para def |
| DELETE | `/admin/retreats/{retreat_id}/eligibility-rules/{rule_id}` | `admin_retreat_routes.py` | async def | não | CurrentUser, DBSession | sim | 7 | — | — | — | A | CONVERTER para def |
| GET | `/admin/retreats/{retreat_id}/export` | `admin_retreat_routes.py` | async def | não | CurrentUser, DBSession | sim | 8 | SIM | — | sim | A | CONVERTER para def |
| POST | `/admin/retreats/{retreat_id}/fee-types` | `admin_retreat_routes.py` | async def | não | CurrentUser, DBSession | sim | 10 | SIM | — | — | A | CONVERTER para def |
| POST | `/admin/retreats/{retreat_id}/houses` | `admin_retreat_routes.py` | async def | não | CurrentUser, DBSession | sim | 8 | — | — | — | A | CONVERTER para def |
| PUT | `/admin/retreats/{retreat_id}/houses/{house_id}` | `admin_retreat_routes.py` | async def | não | CurrentUser, DBSession | sim | 7 | — | — | — | A | CONVERTER para def |
| DELETE | `/admin/retreats/{retreat_id}/houses/{house_id}` | `admin_retreat_routes.py` | async def | não | CurrentUser, DBSession | sim | 7 | — | — | — | A | CONVERTER para def |
| POST | `/admin/retreats/{retreat_id}/publish` | `admin_retreat_routes.py` | async def | não | CurrentUser, DBSession | sim | 15 | SIM | — | — | A | CONVERTER para def |
| GET | `/admin/retreats/{retreat_id}/registrations` | `admin_retreat_routes.py` | async def | não | CurrentUser, DBSession | sim | 8 | SIM | — | — | A | CONVERTER para def |
| POST | `/admin/retreats/{retreat_id}/registrations/{registration_id}/confirm` | `admin_retreat_routes.py` | async def | não | CurrentUser, DBSession | sim | 6 | — | — | — | A | CONVERTER para def |
| PATCH | `/admin/retreats/{retreat_id}/registrations/{registration_id}/house` | `admin_retreat_routes.py` | async def | não | CurrentUser, DBSession | sim | 7 | — | — | — | A | CONVERTER para def |
| POST | `/admin/retreats/{retreat_id}/registrations/{registration_id}/reject` | `admin_retreat_routes.py` | async def | não | CurrentUser, DBSession | sim | 6 | — | — | — | A | CONVERTER para def |
| PATCH | `/admin/retreats/{retreat_id}/registrations/{registration_id}/role` | `admin_retreat_routes.py` | async def | não | CurrentUser, DBSession | sim | 8 | — | — | — | A | CONVERTER para def |
| POST | `/admin/retreats/{retreat_id}/service-teams` | `admin_retreat_routes.py` | async def | não | CurrentUser, DBSession | sim | 8 | — | — | — | A | CONVERTER para def |
| GET | `/admin/retreats/{retreat_id}/service-teams` | `admin_retreat_routes.py` | async def | não | CurrentUser, DBSession | sim | 6 | — | — | — | A | CONVERTER para def |
| PUT | `/admin/retreats/{retreat_id}/service-teams/{team_id}` | `admin_retreat_routes.py` | async def | não | CurrentUser, DBSession | sim | 7 | — | — | — | A | CONVERTER para def |
| DELETE | `/admin/retreats/{retreat_id}/service-teams/{team_id}` | `admin_retreat_routes.py` | async def | não | CurrentUser, DBSession | sim | 7 | — | — | — | A | CONVERTER para def |
| POST | `/admin/retreats/{retreat_id}/service-teams/{team_id}/members` | `admin_retreat_routes.py` | async def | não | CurrentUser, DBSession | sim | 11 | — | — | — | A | CONVERTER para def |
| PATCH | `/admin/retreats/{retreat_id}/service-teams/{team_id}/members/{member_id}` | `admin_retreat_routes.py` | async def | não | CurrentUser, DBSession | sim | 8 | — | — | — | A | CONVERTER para def |
| DELETE | `/admin/retreats/{retreat_id}/service-teams/{team_id}/members/{member_id}` | `admin_retreat_routes.py` | async def | não | CurrentUser, DBSession | sim | 8 | — | — | — | A | CONVERTER para def |
| POST | `/admin/sensitive-access/request` | `admin_routes.py` | async def | não | CurrentUser, DBSession | sim | 7 | — | — | — | A | CONVERTER para def |
| POST | `/admin/sensitive-access/{request_id}/approve` | `admin_routes.py` | async def | não | CurrentUser, DBSession | sim | 5 | — | — | — | A | CONVERTER para def |
| POST | `/admin/sensitive-access/{request_id}/reject` | `admin_routes.py` | async def | não | CurrentUser, DBSession | sim | 5 | — | — | — | A | CONVERTER para def |
| GET | `/admin/users` | `routes/admin.py` | async def | não | CurrentUser, DBSession | sim | 6 | — | — | — | A | CONVERTER para def |
| GET | `/admin/users/filter-options` | `routes/admin.py` | async def | não | CurrentUser, DBSession | sim | 5 | — | — | — | A | CONVERTER para def |
| DELETE | `/admin/users/{user_id}` | `routes/admin.py` | async def | não | CurrentUser, DBSession | sim | 9 | SIM | — | — | A | CONVERTER para def |
| PATCH | `/admin/users/{user_id}` | `routes/admin.py` | async def | não | CurrentUser, DBSession | sim | 8 | SIM | — | — | A | CONVERTER para def |
| GET | `/admin/users/{user_id}/documents` | `admin_routes.py` | async def | não | CurrentUser, DBSession | sim | 6 | — | — | sim | A | CONVERTER para def |
| GET | `/admin/users/{user_id}/profile` | `routes/admin.py` | async def | não | CurrentUser, DBSession | sim | 7 | — | — | sim | A | CONVERTER para def |
| POST | `/admin/users/{user_id}/toggle-avisos` | `routes/admin.py` | async def | não | CurrentUser, DBSession | sim | 10 | — | — | — | A | CONVERTER para def |
| DELETE | `/auth/me` | `routes/auth.py` | async def | não | get_current_user, get_db | sim | 8 | SIM | — | — | A | CONVERTER para def |
| GET | `/auth/me` | `routes/auth.py` | def | não | get_current_user, get_db | sim | 5 | SIM | — | — | A | ja e def |
| POST | `/auth/register` | `routes/auth.py` | async def | não | get_db | sim | 6 | — | — | — | A | CONVERTER para def |
| POST | `/channel/{org_unit_id}/posts` | `channel_routes.py` | def | não | DBSession, CurrentUser | sim | 8 | — | — | — | A | ja e def |
| PATCH | `/channel/{org_unit_id}/posts/{post_id}` | `channel_routes.py` | def | não | DBSession, CurrentUser | sim | 6 | — | — | — | A | ja e def |
| DELETE | `/channel/{org_unit_id}/posts/{post_id}` | `channel_routes.py` | def | não | DBSession, CurrentUser | sim | 5 | — | — | — | A | ja e def |
| PATCH | `/channel/{org_unit_id}/posts/{post_id}/highlight` | `channel_routes.py` | def | não | DBSession, CurrentUser | sim | 6 | — | — | — | A | ja e def |
| PATCH | `/channel/{org_unit_id}/posts/{post_id}/pin` | `channel_routes.py` | def | não | DBSession, CurrentUser | sim | 5 | — | — | — | A | ja e def |
| POST | `/channel/{org_unit_id}/posts/{post_id}/replies` | `channel_routes.py` | def | não | DBSession, CurrentUser | sim | 7 | — | — | — | A | ja e def |
| PATCH | `/channel/{org_unit_id}/posts/{post_id}/replies/{reply_id}` | `channel_routes.py` | def | não | DBSession, CurrentUser | sim | 6 | — | — | — | A | ja e def |
| DELETE | `/channel/{org_unit_id}/posts/{post_id}/replies/{reply_id}` | `channel_routes.py` | def | não | DBSession, CurrentUser | sim | 5 | — | — | — | A | ja e def |
| POST | `/dev/assign-global-role` | `routes/dev.py` | async def | não | get_current_user, get_db | sim | 5 | — | — | — | A | CONVERTER para def |
| POST | `/dev/create-conselho-geral` | `routes/dev.py` | async def | não | get_current_user, get_db | sim | 6 | — | — | — | A | CONVERTER para def |
| POST | `/dev/make-me-dev` | `routes/dev.py` | async def | não | get_current_user, get_db | sim | 7 | — | — | — | A | CONVERTER para def |
| POST | `/dev/seed` | `routes/dev.py` | async def | não | get_current_user, get_db | sim | 9 | SIM | — | — | A | CONVERTER para def |
| GET | `/inbox` | `inbox_routes.py` | def | não | DBSession, CurrentUser | sim | 5 | — | — | — | A | ja e def |
| GET | `/inbox/permissions` | `inbox_routes.py` | def | não | DBSession, CurrentUser | sim | 8 | — | — | — | A | ja e def |
| POST | `/inbox/send` | `inbox_routes.py` | def | não | DBSession, CurrentUser | sim | 8 | — | — | — | A | ja e def |
| POST | `/inbox/send/preview` | `inbox_routes.py` | def | não | DBSession, CurrentUser | sim | 4 | — | — | — | A | ja e def |
| GET | `/inbox/send/scopes` | `inbox_routes.py` | def | não | DBSession, CurrentUser | sim | 7 | — | — | — | A | ja e def |
| POST | `/legal/accept` | `legal_routes.py` | async def | não | CurrentUser, DBSession | sim | 10 | — | — | — | A | CONVERTER para def |
| POST | `/life-plan/cycles` | `life_plan_routes.py` | def | não | CurrentUser, DBSession | sim | 4 | — | — | — | A | ja e def |
| POST | `/life-plan/cycles/{cycle_id}/core` | `life_plan_routes.py` | def | não | CurrentUser, DBSession | sim | 7 | — | — | — | A | ja e def |
| POST | `/life-plan/cycles/{cycle_id}/diagnoses` | `life_plan_routes.py` | def | não | CurrentUser, DBSession | sim | 7 | — | — | — | A | ja e def |
| POST | `/life-plan/cycles/{cycle_id}/goals` | `life_plan_routes.py` | def | não | CurrentUser, DBSession | sim | 8 | SIM | — | — | A | ja e def |
| POST | `/life-plan/cycles/{cycle_id}/reviews` | `life_plan_routes.py` | def | não | CurrentUser, DBSession | sim | 5 | — | — | — | A | ja e def |
| POST | `/life-plan/cycles/{cycle_id}/routine` | `life_plan_routes.py` | def | não | CurrentUser, DBSession | sim | 7 | — | — | — | A | ja e def |
| POST | `/life-plan/goals/{goal_id}/actions` | `life_plan_routes.py` | def | não | CurrentUser, DBSession | sim | 4 | — | — | — | A | ja e def |
| GET | `/me` | `routes.py` | async def | não | CurrentUser, DBSession | sim | 4 | SIM | — | — | A | CONVERTER para def |
| POST | `/org-memberships/request` | `membership_routes.py` | async def | não | CurrentUser, DBSession | sim | 6 | — | — | — | A | CONVERTER para def |
| POST | `/org-memberships/{membership_id}/approve` | `membership_routes.py` | async def | não | CurrentUser, DBSession | sim | 6 | — | — | — | A | CONVERTER para def |
| POST | `/org-memberships/{membership_id}/reject` | `membership_routes.py` | async def | não | CurrentUser, DBSession | sim | 6 | — | — | — | A | CONVERTER para def |
| POST | `/org/invites/{invite_id}/accept` | `routes/organization.py` | async def | não | CurrentUser, DBSession | sim | 6 | — | — | — | A | CONVERTER para def |
| POST | `/org/invites/{invite_id}/reject` | `routes/organization.py` | async def | não | CurrentUser, DBSession | sim | 6 | — | — | — | A | CONVERTER para def |
| POST | `/org/root-unit` | `routes/organization.py` | async def | não | CurrentUser, DBSession | sim | 13 | SIM | — | — | A | CONVERTER para def |
| GET | `/org/tree` | `routes/organization.py` | async def | não | CurrentUser, DBSession | sim | 4 | — | — | — | A | CONVERTER para def |
| POST | `/org/units/{org_unit_id}/invites` | `routes/organization.py` | async def | não | CurrentUser, DBSession | sim | 9 | — | — | — | A | CONVERTER para def |
| POST | `/org/units/{org_unit_id}/leave` | `routes/organization.py` | async def | não | CurrentUser, DBSession | sim | 6 | — | — | — | A | CONVERTER para def |
| GET | `/org/units/{org_unit_id}/members` | `routes/organization.py` | async def | não | CurrentUser, DBSession | sim | 6 | — | — | — | A | CONVERTER para def |
| DELETE | `/org/units/{org_unit_id}/members/{member_user_id}` | `routes/organization.py` | async def | não | CurrentUser, DBSession | sim | 6 | — | — | — | A | CONVERTER para def |
| PUT | `/org/units/{org_unit_id}/members/{member_user_id}/role` | `routes/organization.py` | async def | não | CurrentUser, DBSession | sim | 8 | — | — | — | A | CONVERTER para def |
| GET | `/org/units/{org_unit_id}/search-users` | `routes/organization.py` | async def | não | CurrentUser, DBSession | sim | 4 | — | — | — | A | CONVERTER para def |
| POST | `/org/units/{parent_id}/children` | `routes/organization.py` | async def | não | CurrentUser, DBSession | sim | 10 | SIM | — | — | A | CONVERTER para def |
| PATCH | `/org/units/{unit_id}` | `routes/organization.py` | async def | não | CurrentUser, DBSession | sim | 8 | — | — | — | A | CONVERTER para def |
| PUT | `/profile` | `profile_routes.py` | async def | não | CurrentUser, DBSession | sim | 9 | — | — | sim | A | CONVERTER para def |
| POST | `/profile/emergency-contact` | `profile_routes.py` | async def | não | CurrentUser, DBSession | sim | 5 | — | — | — | A | CONVERTER para def |
| POST | `/projeto-vida-mensal/` | `projeto_vida_mensal_routes.py` | def | não | CurrentUser, DBSession | sim | 7 | — | — | sim | A | ja e def |
| GET | `/projeto-vida-mensal/contexto-vocacional` | `projeto_vida_mensal_routes.py` | def | não | CurrentUser, DBSession | sim | 4 | — | — | — | A | ja e def |
| PUT | `/projeto-vida-mensal/{projeto_id}` | `projeto_vida_mensal_routes.py` | def | não | CurrentUser, DBSession | sim | 16 | SIM | — | — | A | ja e def |
| PUT | `/projeto-vida-mensal/{projeto_id}/exame` | `projeto_vida_mensal_routes.py` | def | não | CurrentUser, DBSession | sim | 5 | — | — | — | A | ja e def |
| PUT | `/projeto-vida-mensal/{projeto_id}/intercessao` | `projeto_vida_mensal_routes.py` | def | não | CurrentUser, DBSession | sim | 5 | — | — | — | A | ja e def |
| PUT | `/projeto-vida-mensal/{projeto_id}/revisao` | `projeto_vida_mensal_routes.py` | def | não | CurrentUser, DBSession | sim | 5 | — | — | — | A | ja e def |
| POST | `/projeto-vida-mensal/{projeto_id}/semanal` | `projeto_vida_mensal_routes.py` | def | não | CurrentUser, DBSession | sim | 5 | — | — | — | A | ja e def |
| GET | `/retreats` | `retreat_routes.py` | async def | não | CurrentUser, DBSession | sim | 12 | SIM | — | — | A | CONVERTER para def |
| GET | `/retreats/{retreat_id}` | `retreat_routes.py` | async def | não | CurrentUser, DBSession | sim | 12 | SIM | — | — | A | CONVERTER para def |
| POST | `/retreats/{retreat_id}/register` | `retreat_routes.py` | async def | não | CurrentUser, DBSession | sim | 22 | SIM | — | — | A | CONVERTER para def |
| POST | `/verify/email/confirm` | `verification_routes.py` | async def | não | CurrentUser, DBSession | sim | 4 | — | — | sim | A | CONVERTER para def |
| POST | `/verify/email/start` | `verification_routes.py` | async def | não | CurrentUser, DBSession | sim | 5 | — | — | sim | A | CONVERTER para def |
| POST | `/verify/phone/confirm` | `verification_routes.py` | async def | não | CurrentUser, DBSession | sim | 5 | — | — | sim | A | CONVERTER para def |
| POST | `/verify/phone/start` | `verification_routes.py` | async def | não | CurrentUser, DBSession | sim | 9 | — | — | sim | A | CONVERTER para def |
| GET | `/admin/export/requests` | `routes/export.py` | async def | não | CurrentUser, DBSession | sim | 2 | — | — | — | B | CONVERTER para def |
| GET | `/admin/sensitive-access/pending` | `admin_routes.py` | async def | não | CurrentUser, DBSession | sim | 2 | — | — | — | B | CONVERTER para def |
| POST | `/auth/check-cpf` | `routes/auth.py` | async def | não | CurrentUser, get_db | sim | 1 | — | — | sim | B | CONVERTER para def |
| POST | `/auth/login` | `routes/auth.py` | async def | não | get_db | sim | 1 | — | — | — | B | CONVERTER para def |
| GET | `/channel/{org_unit_id}/posts` | `channel_routes.py` | def | não | DBSession, CurrentUser | sim | 2 | — | — | — | B | ja e def |
| GET | `/channel/{org_unit_id}/posts/{post_id}` | `channel_routes.py` | def | não | DBSession, CurrentUser | sim | 3 | — | — | — | B | ja e def |
| GET | `/channel/{org_unit_id}/settings` | `channel_routes.py` | def | não | DBSession, CurrentUser | sim | 3 | — | — | — | B | ja e def |
| POST | `/dev/grant-inbox-permission` | `routes/dev.py` | async def | não | get_db, get_current_user | sim | 3 | — | — | — | B | CONVERTER para def |
| DELETE | `/dev/revoke-inbox-permission` | `routes/dev.py` | async def | não | get_db, get_current_user | sim | 3 | — | — | — | B | CONVERTER para def |
| GET | `/inbox/approval/pending` | `inbox_routes.py` | def | não | DBSession, CurrentUser | sim | 3 | — | — | — | B | ja e def |
| POST | `/inbox/approval/{message_id}/approve` | `inbox_routes.py` | def | não | DBSession, CurrentUser | sim | 3 | — | — | — | B | ja e def |
| POST | `/inbox/approval/{message_id}/reject` | `inbox_routes.py` | def | não | DBSession, CurrentUser | sim | 3 | — | — | — | B | ja e def |
| PATCH | `/inbox/read-all` | `inbox_routes.py` | def | não | DBSession, CurrentUser | sim | 1 | — | — | — | B | ja e def |
| GET | `/inbox/send/filters` | `inbox_routes.py` | def | não | DBSession, CurrentUser | sim | 2 | — | — | — | B | ja e def |
| GET | `/inbox/sent` | `inbox_routes.py` | def | não | DBSession, CurrentUser | sim | 2 | — | — | — | B | ja e def |
| GET | `/inbox/unread` | `inbox_routes.py` | def | não | DBSession, CurrentUser | sim | 1 | — | — | — | B | ja e def |
| GET | `/inbox/{message_id}/audit` | `inbox_routes.py` | def | não | DBSession, CurrentUser | sim | 3 | — | — | — | B | ja e def |
| PATCH | `/inbox/{recipient_id}/read` | `inbox_routes.py` | def | não | DBSession, CurrentUser | sim | 1 | — | — | — | B | ja e def |
| GET | `/legal/latest` | `legal_routes.py` | def | não | DBSession | sim | 2 | — | — | — | B | ja e def |
| PATCH | `/life-plan/actions/{action_id}` | `life_plan_routes.py` | def | não | CurrentUser, DBSession | sim | 3 | — | — | — | B | ja e def |
| DELETE | `/life-plan/actions/{action_id}` | `life_plan_routes.py` | def | não | CurrentUser, DBSession | sim | 3 | — | — | — | B | ja e def |
| GET | `/life-plan/cycles/{cycle_id}` | `life_plan_routes.py` | def | não | CurrentUser, DBSession | sim | 1 | — | — | — | B | ja e def |
| POST | `/life-plan/cycles/{cycle_id}/activate` | `life_plan_routes.py` | def | não | CurrentUser, DBSession | sim | 3 | — | — | — | B | ja e def |
| GET | `/life-plan/cycles/{cycle_id}/reviews` | `life_plan_routes.py` | def | não | CurrentUser, DBSession | sim | 2 | — | — | — | B | ja e def |
| PATCH | `/life-plan/cycles/{cycle_id}/wizard-progress` | `life_plan_routes.py` | def | não | CurrentUser, DBSession | sim | 3 | — | — | — | B | ja e def |
| PATCH | `/life-plan/goals/{goal_id}` | `life_plan_routes.py` | def | não | CurrentUser, DBSession | sim | 3 | — | — | — | B | ja e def |
| DELETE | `/life-plan/goals/{goal_id}` | `life_plan_routes.py` | def | não | CurrentUser, DBSession | sim | 3 | — | — | — | B | ja e def |
| GET | `/life-plan/history` | `life_plan_routes.py` | def | não | CurrentUser, DBSession | sim | 1 | — | — | — | B | ja e def |
| GET | `/life-plan/me/active` | `life_plan_routes.py` | def | não | CurrentUser, DBSession | sim | 1 | — | — | — | B | ja e def |
| GET | `/org-memberships/my` | `membership_routes.py` | async def | não | CurrentUser, DBSession | sim | 1 | — | — | — | B | CONVERTER para def |
| GET | `/org-memberships/{org_unit_id}/pending` | `membership_routes.py` | async def | não | CurrentUser, DBSession | sim | 3 | — | — | — | B | CONVERTER para def |
| GET | `/org-units/tree` | `routes.py` | async def | não | DBSession | sim | 3 | — | — | — | B | CONVERTER para def |
| GET | `/org/ministries` | `routes/organization.py` | async def | não | CurrentUser, DBSession | sim | 1 | — | — | — | B | CONVERTER para def |
| GET | `/org/my/invites` | `routes/organization.py` | async def | não | CurrentUser, DBSession | sim | 1 | — | — | — | B | CONVERTER para def |
| GET | `/org/my/memberships` | `routes/organization.py` | async def | não | CurrentUser, DBSession | sim | 1 | — | — | — | B | CONVERTER para def |
| GET | `/org/units/{org_unit_id}` | `routes/organization.py` | async def | não | CurrentUser, DBSession | sim | 2 | — | — | — | B | CONVERTER para def |
| GET | `/org/units/{org_unit_id}/invites/pending` | `routes/organization.py` | async def | não | CurrentUser, DBSession | sim | 2 | — | — | — | B | CONVERTER para def |
| GET | `/org/units/{org_unit_id}/permissions` | `routes/organization.py` | async def | não | CurrentUser, DBSession | sim | 1 | — | — | — | B | CONVERTER para def |
| PATCH | `/org/units/{unit_id}/retreat-scope` | `routes/organization.py` | async def | não | CurrentUser, DBSession | sim | 3 | — | — | — | B | CONVERTER para def |
| GET | `/profile` | `profile_routes.py` | async def | não | CurrentUser, DBSession | sim | 3 | — | — | — | B | CONVERTER para def |
| GET | `/profile/catalogs` | `profile_routes.py` | async def | não | DBSession | sim | 2 | SIM | — | — | B | CONVERTER para def |
| GET | `/profile/emergency-contacts` | `profile_routes.py` | async def | não | CurrentUser, DBSession | sim | 1 | — | — | — | B | CONVERTER para def |
| POST | `/profile/me/confirm` | `profile_routes.py` | async def | não | CurrentUser, DBSession | sim | 2 | — | — | — | B | CONVERTER para def |
| GET | `/profile/missions` | `profile_routes.py` | async def | não | DBSession | sim | 2 | — | — | — | B | CONVERTER para def |
| GET | `/profile/sectors` | `profile_routes.py` | async def | não | DBSession | sim | 1 | — | — | — | B | CONVERTER para def |
| GET | `/projeto-vida-mensal/atual` | `projeto_vida_mensal_routes.py` | def | não | CurrentUser, DBSession | sim | 2 | — | — | — | B | ja e def |
| GET | `/projeto-vida-mensal/historico` | `projeto_vida_mensal_routes.py` | def | não | CurrentUser, DBSession | sim | 1 | — | — | — | B | ja e def |
| GET | `/projeto-vida-mensal/{projeto_id}` | `projeto_vida_mensal_routes.py` | def | não | CurrentUser, DBSession | sim | 1 | — | — | — | B | ja e def |
| GET | `/projeto-vida-mensal/{projeto_id}/exame` | `projeto_vida_mensal_routes.py` | def | não | CurrentUser, DBSession | sim | 2 | — | — | — | B | ja e def |
| GET | `/projeto-vida-mensal/{projeto_id}/intercessao` | `projeto_vida_mensal_routes.py` | def | não | CurrentUser, DBSession | sim | 2 | — | — | — | B | ja e def |
| POST | `/projeto-vida-mensal/{projeto_id}/pin/verificar` | `projeto_vida_mensal_routes.py` | def | não | CurrentUser, DBSession | sim | 2 | — | — | sim | B | ja e def |
| GET | `/projeto-vida-mensal/{projeto_id}/semanal` | `projeto_vida_mensal_routes.py` | def | não | CurrentUser, DBSession | sim | 2 | — | — | — | B | ja e def |
| PUT | `/projeto-vida-semanal/{semanal_id}` | `projeto_vida_semanal_routes.py` | def | não | CurrentUser, DBSession | sim | 3 | — | — | — | B | ja e def |
| GET | `/projeto-vida-semanal/{semanal_id}` | `projeto_vida_semanal_routes.py` | def | não | CurrentUser, DBSession | sim | 1 | — | — | — | B | ja e def |
| POST | `/push/subscribe` | `push_routes.py` | def | não | DBSession, CurrentUser | sim | 3 | — | — | — | B | ja e def |
| DELETE | `/push/unsubscribe` | `push_routes.py` | def | não | DBSession, CurrentUser | sim | 3 | — | — | — | B | ja e def |
| DELETE | `/retreats/{retreat_id}/my-registration` | `retreat_routes.py` | async def | não | CurrentUser, DBSession | sim | 2 | — | — | — | B | CONVERTER para def |
| GET | `/retreats/{retreat_id}/service-teams` | `retreat_routes.py` | async def | não | CurrentUser, DBSession | sim | 2 | — | — | — | B | CONVERTER para def |
| POST | `/retreats/{retreat_id}/my-registration/payment` | `retreat_routes.py` | async def | sim | CurrentUser, DBSession | sim | 2 | — | Cloudinary | — | C | manter async (tem await) |
| GET | `/health` | `routes.py` | async def | não | — | não det. | 0 | — | — | — | D | def opcional (sem trabalho bloqueante) |
| GET | `/push/vapid-public-key` | `push_routes.py` | def | não | — | não det. | 0 | — | — | — | D | ja e def |



---

# Atualização (2026-07-24) — após o fix de pool, a auditoria de N+1 e o benchmark corrigido

Esta seção corrige e enriquece o ranking acima com o que foi **medido depois** de
ele ter sido escrito.

## Correção do "teto de ~7 requests concorrentes"

O documento de baseline dizia que o pool de 15 limitava a ~15 (e o benchmark
sugeria colapso ainda antes). **A causa real era um bug**: `deps.py` tinha um
`get_db` duplicado e cada request autenticado segurava **2 conexões** — teto
efetivo ~7. Corrigido no **PR #24** (uma conexão por request, provado). Portanto:

- **Sessões por request:** agora **1** (era 2 nas 11 rotas afetadas). Regressão
  em `test_arch_db_session.py` / `test_db_session_lifecycle.py`.
- O "teto de ~7" **não é inerente** — era o bug. O teto real de concorrência
  passa a ser governado pelo pool (15 no default) e pelos workers.

## Coluna nova: risco de N+1 e estado da correção (medido)

| Rota | Sessões/req | N+1 medido | Estado |
|------|:-----------:|------------|--------|
| `GET /auth/me` | 1 (pós #24) | memberships: 60 queries @ 50 mbrs | **corrigido no #20** (`joinedload`) → constante |
| `GET /retreats` | 1 (pós #24) | ~6 queries/retiro (305 @ 50) | **corrigido no #25** (`selectinload` + hoist voc_code) → ~3/retiro |
| `GET /inbox` | 1 (pós #24) | inconclusivo (seed a corrigir) | **a medir** |
| `GET /admin/dashboard` | 1 (pós #24) | 20 ops estáticos; slope não medido | **a medir** (baixa freq.) |
| demais (writes) | 1 | cardinalidade fixa | baixo risco de N+1-sob-carga |

Detalhes em `nplus1-audit.md`.

## Benchmark de runtime — número corrigido

O ganho da migração `async def`→`def` foi **refeito sem o bug de pool** e com RTT
de Postgres modelado: **~7×** (não os 20,1× do benchmark sintético), e **~0** em
SQLite puro. Ver `backend-route-benchmark.md`.

## Classificação de frequência (reafirmando o rótulo)

Toda a coluna "Freq" do ranking é **DERIVADA DE JORNADA / ESTIMADA** — **não há
tráfego OBSERVADO** de produção (sem logs acessíveis). Nenhuma linha deve ser lida
como medição de volume real. Marcadores: OBSERVADA (nenhuma), DERIVADA DE JORNADA
(as de jornada), ESTIMADA (baseline), DESCONHECIDA (o resto).
