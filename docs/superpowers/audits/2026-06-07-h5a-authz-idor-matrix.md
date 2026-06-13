# H5A — Matriz de Autorização / IDOR (auditoria read-only)

- **Data da auditoria:** 2026-06-08
- **Escopo:** autorização e IDOR nos routers backend wired em `app/main.py` + módulo de authz compartilhado. Read-only. Nenhum código/teste/env/header/rate-limit/upload/parseApiError alterado.
- **Método:** leitura endpoint-por-endpoint com o rigor do CSO Phase 9 / OWASP A01 (Broken Access Control). Toda evidência cita a linha de código que motiva o veredito (pre-emit gate). Vereditos: **OK** / **SUSPEITO** / **FALHA**.
- **Não auditados (note-and-skip, decisão do usuário):** `app/api/routes.py`, `app/api/membership_routes.py`, `app/api/dev_routes.py` — órfãos, não incluídos em `main.py`, sem superfície de ataque hoje. Recomenda-se remoção em fase futura (dead code).

## Modelo de autorização (base)

- **Autenticação:** `CurrentUser` / `get_current_user` em [deps.py:34](backend/app/api/deps.py:34). Todo endpoint que recebe `CurrentUser`/`Depends(get_current_user)` exige `Bearer` válido (Firebase em prod, `dev:<id>:<email>` em DEV). Não há dependência de role no `deps.py` — **role e ownership são verificados em cada router/service.**
- **Roles globais:** `DEV`, `ADMIN`, `SECRETARY`, `AVISOS`, `ANALISTA`, `COUNCIL_GENERAL` (via [role_service.py](backend/app/services/role_service.py) e helpers locais).
- **Identificadores:** todos os recursos usam **UUID** (não sequenciais). Isso reduz a explorabilidade de IDORs de leitura por enumeração (CSO precedente #2), mas **não** substitui checagem de ownership — várias rotas a fazem corretamente via `WHERE ... user_id == current_user.id` ou JOIN ao recurso pai.
- **Acesso a dados sensíveis (CPF/RG):** desenhado com fluxo de solicitação → aprovação → janela de expiração → auditoria em [admin_routes.py](backend/app/api/admin_routes.py). Ver achado 🟠 H5A-01 sobre um caminho paralelo que contorna esse fluxo.

---

## Resumo executivo dos achados

| ID | Sev | Conf | Status | Categoria | Endpoint | Arquivo:linha |
|----|-----|------|--------|-----------|----------|---------------|
| H5A-01 | 🟠 Alto | 9/10 | FALHA | A01 Broken Access Control | `GET /admin/users/{user_id}/profile` devolve CPF/RG descriptografados contornando o workflow de acesso sensível | [routes/admin.py:242](backend/app/api/routes/admin.py:242) |
| H5A-02 | 🟠 Alto | 8/10 | FALHA | A01 IDOR / escopo cruzado | `PATCH`/`DELETE /channel/{org_unit_id}/posts/{post_id}/replies/{reply_id}` não amarra a reply ao `org_unit_id` | [channel_routes.py:382](backend/app/api/channel_routes.py:382), [:402](backend/app/api/channel_routes.py:402) |
| H5A-03 | 🟡 Médio | 8/10 | SUSPEITO | A01 / info disclosure | `GET /org/units/{org_unit_id}` sem checar visibilidade/membership (vaza metadados de unidade RESTRICTED) | [routes/organization.py:341](backend/app/api/routes/organization.py:341) |
| H5A-04 | 🟡 Médio | 8/10 | SUSPEITO | Separação de deveres | `POST /admin/export/{export_id}/approve` sem guard de auto-aprovação | [routes/export.py:457](backend/app/api/routes/export.py:457) |
| H5A-05 | 🟡 Médio | 7/10 | SUSPEITO | Privilege escalation (defesa em profundidade) | `/dev/*` self-escalation só protegido por `enable_dev_endpoints` | [routes/dev.py:256](backend/app/api/routes/dev.py:256) |
| H5A-06 | 🟢 Baixo | 7/10 | SUSPEITO | Info disclosure (UUID-gated) | `vocational_accompanist_user_id` ecoa `full_name` de qualquer usuário | [profile_routes.py:550](backend/app/api/profile_routes.py:550) |
| H5A-07 | 🟢 Baixo | 7/10 | SUSPEITO | IDOR write (endpoint secreto) | `POST /push/subscribe` reatribui subscription por `endpoint` sem checar dono | [push_routes.py:49](backend/app/api/push_routes.py:49) |
| H5A-08 | 🟢 Baixo | 8/10 | OK (nota de design) | Escopo de aprovação | Qualquer aprovador full-access aprova/audita qualquer aviso pendente | [inbox_routes.py:409](backend/app/api/inbox_routes.py:409) |

**Nenhum 🔴 Crítico** (acesso/escrita de dados de outro usuário sem qualquer autorização) foi confirmado. Os dois 🟠 Alto exigem uma role/posição elevada para serem explorados, mas representam falhas reais de controle de acesso.

---

## Matriz por router

Legenda colunas: **Auth** = exige login · **Role** = exige papel/permissão · **Owner** = checa propriedade/escopo do recurso · **Sens.** = manipula objeto sensível (PII/CPF/RG/sigilo espiritual) · **IDOR** = risco de acesso indevido por ID.

### 1. `routes/auth.py` — `/auth`

| Método Path | Handler | Auth | Role | Owner | Sens. | IDOR | Veredito | Evidência |
|---|---|---|---|---|---|---|---|---|
| POST /auth/check-cpf | check_cpf_availability | ✅ | — | n/a | médio | não | **OK** | exige `CurrentUser` p/ impedir enumeração pública [auth.py:60](backend/app/api/routes/auth.py:60) |
| POST /auth/register | register | público | — | n/a | baixo | não | **OK** | bloqueado fora de DEV (501) [auth.py:88](backend/app/api/routes/auth.py:88) |
| POST /auth/login | login | público | — | n/a | baixo | não | **OK** (DEV-only) | 501 em prod [auth.py:138](backend/app/api/routes/auth.py:138); TODO senha só em DEV |
| GET /auth/me | get_me | ✅ | — | self | médio | não | **OK** | usa `user` autenticado [auth.py:168](backend/app/api/routes/auth.py:168) |
| DELETE /auth/me | delete_me | ✅ | — | self | alto | não | **OK** | anonimiza o próprio user [auth.py:333](backend/app/api/routes/auth.py:333) |

### 2. `profile_routes.py` — `/profile`

| Método Path | Handler | Auth | Role | Owner | Sens. | IDOR | Veredito | Evidência |
|---|---|---|---|---|---|---|---|---|
| GET /profile/catalogs | get_catalogs | ✅ | — | n/a | baixo | não | **OK** | dados de catálogo [profile_routes.py:109](backend/app/api/profile_routes.py:109) |
| GET /profile/sectors | get_sectors | ✅ | — | n/a | baixo | não | **OK** | [profile_routes.py:147](backend/app/api/profile_routes.py:147) |
| GET /profile/missions | get_missions | ✅ | — | n/a | baixo | não | **OK** | [profile_routes.py:159](backend/app/api/profile_routes.py:159) |
| GET /profile | get_profile | ✅ | — | self | alto | não | **OK** | `WHERE user_id == current_user.id` [profile_routes.py:183](backend/app/api/profile_routes.py:183) |
| PUT /profile | update_profile | ✅ | — | self | alto | não | **OK** | escopo self; CPF/RG criptografados [profile_routes.py:221](backend/app/api/profile_routes.py:221) |
| POST /profile/me/confirm | confirm_profile | ✅ | — | self | baixo | não | **OK** | [profile_routes.py:269](backend/app/api/profile_routes.py:269) |
| POST /profile/emergency-contact | create_emergency_contact | ✅ | — | self | médio | não | **OK** | escopo self [profile_routes.py:289](backend/app/api/profile_routes.py:289) |
| GET /profile/emergency-contacts | list_emergency_contacts | ✅ | — | self | médio | não | **OK** | [profile_routes.py:336](backend/app/api/profile_routes.py:336) |

> 🟢 **H5A-06 (SUSPEITO):** `update_profile` aceita `vocational_accompanist_user_id` arbitrário e [profile_routes.py:550-554](backend/app/api/profile_routes.py:550) resolve e devolve o `full_name` desse usuário em `vocational_accompanist_display_name`. Permite a um autenticado obter o nome de qualquer `user_id` que conheça. Mitigado por UUID não-enumerável; severidade baixa.

### 3. `routes/organization.py` — `/org` (authz no service [organization.py](backend/app/services/organization.py))

| Método Path | Handler | Auth | Role/Owner enforcement | IDOR | Veredito | Evidência |
|---|---|---|---|---|---|---|
| POST /org/root-unit | create_root_unit | ✅ | DEV/ADMIN | não | **OK** | [organization.py(routes):100](backend/app/api/routes/organization.py:100) |
| GET /org/ministries | list_ministries | ✅ | — (lista pública de ministérios ativos) | não | **OK** | [organization.py(routes):156](backend/app/api/routes/organization.py:156) |
| GET /org/tree | get_organization_tree | ✅ | filtra RESTRICTED p/ não-membros | não | **OK** | `can_view_unit` [organization.py(routes):227](backend/app/api/routes/organization.py:227) |
| POST /org/units/{parent_id}/children | create_child_unit | ✅ | coordenador do parent (`can_user_create_child`) | não | **OK** | [organization.py(svc):204](backend/app/services/organization.py:204) |
| **GET /org/units/{org_unit_id}** | get_org_unit | ✅ | **nenhuma checagem de visibilidade/membership** | **leitura metadados** | **SUSPEITO** | sem `can_view` [organization.py(routes):341](backend/app/api/routes/organization.py:341) |
| GET /org/units/{id}/members | list_members | ✅ | RESTRICTED → 403; email mascarado p/ não-membro | leve | **OK** | `get_org_unit_members` [organization.py(svc):554](backend/app/services/organization.py:554) |
| POST /org/units/{id}/invites | send_member_invite | ✅ | coordenador (+ regra p/ promover COORDINATOR) | não | **OK** | `send_invite` [organization.py(svc):372](backend/app/services/organization.py:372) |
| GET /org/units/{id}/invites/pending | list_pending_invites | ✅ | só coordenador | não | **OK** | [organization.py(svc):511](backend/app/services/organization.py:511) |
| POST /org/invites/{invite_id}/accept | accept_invite | ✅ | **owner do convite** | não | **OK** | `invite.invited_user_id != user_id` [organization.py(svc):445](backend/app/services/organization.py:445) |
| POST /org/invites/{invite_id}/reject | reject_invite | ✅ | owner do convite | não | **OK** | mesma checagem [organization.py(svc):445](backend/app/services/organization.py:445) |
| GET /org/my/invites | get_my_pending_invites | ✅ | self | não | **OK** | [organization.py(svc):496](backend/app/services/organization.py:496) |
| GET /org/my/memberships | get_my_memberships | ✅ | self | não | **OK** | [organization.py(routes):583](backend/app/api/routes/organization.py:583) |
| GET /org/units/{id}/search-users | search_users_to_invite | ✅ | só coordenador; email mascarado | leve | **OK** | [organization.py(svc):614](backend/app/services/organization.py:614) |
| PUT /org/units/{id}/members/{member_user_id}/role | update_member_role_endpoint | ✅ | coordenador + guard de promoção | não | **OK** | `update_member_role` [organization.py(svc):677](backend/app/services/organization.py:677) |
| DELETE /org/units/{id}/members/{member_user_id} | remove_member_endpoint | ✅ | self/coord/parent-coord + guard último coord | não | **OK** | `remove_member` [organization.py(svc):785](backend/app/services/organization.py:785) |
| POST /org/units/{id}/leave | leave_unit | ✅ | self (remove a si) | não | **OK** | [organization.py(routes):699](backend/app/api/routes/organization.py:699) |
| GET /org/units/{id}/permissions | get_unit_permissions | ✅ | retorna permissões do próprio user | não | **OK** | [organization.py(svc):828](backend/app/services/organization.py:828) |
| PATCH /org/units/{unit_id} | update_org_unit_endpoint | ✅ | `can_edit_unit` (hierarquia) | não | **OK** | [organization.py(svc):81](backend/app/services/organization.py:81) |
| PATCH /org/units/{unit_id}/retreat-scope | set_retreat_scope | ✅ | ADMIN/DEV | não | **OK** | [organization.py(routes):785](backend/app/api/routes/organization.py:785) |

> 🟡 **H5A-03 (SUSPEITO):** `get_org_unit` lê a unidade por ID e devolve nome/descrição/visibilidade/slug **sem** checar se o usuário pode vê-la. As demais rotas (tree, members) escondem unidades RESTRICTED de não-membros; esta não. Vazamento de metadados de grupos privados. Recomenda-se aplicar a mesma regra de `get_user_permissions.can_view`.

### 4. `routes/admin.py` — `/admin` (users / dashboard / audit)

| Método Path | Handler | Auth | Role | Owner | Sens. | Veredito | Evidência |
|---|---|---|---|---|---|---|---|
| GET /admin/users/filter-options | get_filter_options | ✅ | DEV/ADMIN/SECRETARY | n/a | médio | **OK** | [routes/admin.py:72](backend/app/api/routes/admin.py:72) |
| GET /admin/users | list_users | ✅ | DEV/ADMIN/SECRETARY ou coord. Conselho Geral | n/a | médio | **OK** | [routes/admin.py:139](backend/app/api/routes/admin.py:139) |
| **GET /admin/users/{user_id}/profile** | get_user_full_profile | ✅ | DEV/ADMIN/SECRETARY | — (qualquer alvo) | **CPF/RG em claro** | **FALHA** | [routes/admin.py:255](backend/app/api/routes/admin.py:255) |
| PATCH /admin/users/{user_id} | update_user | ✅ | DEV/ADMIN | — | edita roles | **OK** | allow-list de roles [routes/admin.py:351](backend/app/api/routes/admin.py:351) |
| POST /admin/users/{user_id}/toggle-avisos | toggle_avisos_role | ✅ | DEV/ADMIN ou coord. Conselho Geral | — | concede role | **OK** | [routes/admin.py:427](backend/app/api/routes/admin.py:427) |
| GET /admin/dashboard | get_dashboard | ✅ | ADMIN/DEV/ANALISTA | n/a | agregados | **OK** | [routes/admin.py:542](backend/app/api/routes/admin.py:542) |
| GET /admin/audit-logs | get_audit_logs | ✅ | ADMIN/DEV/ANALISTA | n/a | logs | **OK** | [routes/admin.py:790](backend/app/api/routes/admin.py:790) |

> 🟠 **H5A-01 (FALHA — alerta):** `get_user_full_profile` descriptografa e devolve **CPF e RG** de qualquer `user_id` apenas com role `DEV/ADMIN/SECRETARY` ([routes/admin.py:267-281](backend/app/api/routes/admin.py:267)). Isso **contorna** o controle desenhado em `admin_routes.py` (`get_user_documents`), que para não-DEV exige `SensitiveAccessRequest` **aprovado**, com expiração de 30 min e separação de deveres. Pelo `role_service`, `SECRETARY` deveria apenas **solicitar** acesso (aprovação do `COUNCIL_GENERAL`); aqui obtém leitura direta. `ADMIN` sequer faz parte do modelo de acesso sensível e ainda assim lê CPF/RG. Há AuditLog (`VIEW_FULL_PROFILE`), mas o fluxo de aprovação é ignorado. Dado RESTRICTED (LGPD).

### 5. `admin_routes.py` — `/admin` (acesso sensível CPF/RG)

| Método Path | Handler | Auth | Role | Owner/Escopo | Veredito | Evidência |
|---|---|---|---|---|---|---|
| POST /admin/sensitive-access/request | request_sensitive_access | ✅ | SECRETARY/DEV | escopo (requester,target) | **OK** | [admin_routes.py:49](backend/app/api/admin_routes.py:49) |
| GET /admin/sensitive-access/pending | get_pending_access_requests | ✅ | ADMIN/DEV | n/a | **OK** | [admin_routes.py:114](backend/app/api/admin_routes.py:114) |
| POST /admin/sensitive-access/{request_id}/approve | approve_sensitive_access | ✅ | ADMIN/DEV | **proíbe auto-aprovação** | **OK** | [admin_routes.py:157](backend/app/api/admin_routes.py:157) |
| POST /admin/sensitive-access/{request_id}/reject | reject_sensitive_access | ✅ | ADMIN/DEV | proíbe auto-rejeição | **OK** | [admin_routes.py:222](backend/app/api/admin_routes.py:222) |
| GET /admin/users/{user_id}/documents | get_user_documents | ✅ | DEV bypass OU request aprovado + não-expirado | escopo (requester,target) + audit | **OK** | [admin_routes.py:268](backend/app/api/admin_routes.py:268) |

> Este router é o **modelo correto** de controle de acesso sensível. H5A-01 existe porque o caminho de `routes/admin.py` não segue este desenho. Ambos montam prefixo `/admin` (ver H5A-09).

### 6. `admin_retreat_routes.py` — `/admin/retreats`

Padrão uniforme: **todo** endpoint chama `_require_retreat_manager(db, current_user.id, retreat_id)` ([admin_retreat_routes.py:125](backend/app/api/admin_retreat_routes.py:125)) antes de qualquer operação; sub-recursos validam pertencimento ao retiro (`house.retreat_id != retreat_id`, `reg.retreat_id != retreat_id`, `team.retreat_id != retreat_id`, `member.team_id != team_id`).

| Método Path | Handler | Authz | Owner sub-recurso | Veredito | Evidência |
|---|---|---|---|---|---|
| POST /admin/retreats | create_retreat | gestor global | — | **OK** | [:444](backend/app/api/admin_retreat_routes.py:444) |
| GET /admin/retreats | list_retreats | gestor global vê todos; coord vê os seus | escopo coord | **OK** | [:491](backend/app/api/admin_retreat_routes.py:491) |
| GET /admin/retreats/{id} | get_retreat | gestor/coord do retiro | — | **OK** | [:518](backend/app/api/admin_retreat_routes.py:518) |
| PATCH /admin/retreats/{id} | update_retreat | gestor/coord | — | **OK** | [:531](backend/app/api/admin_retreat_routes.py:531) |
| POST /admin/retreats/{id}/publish·close·cancel | publish/close/cancel | gestor/coord | — | **OK** | [:621](backend/app/api/admin_retreat_routes.py:621) |
| POST·PUT·DELETE /admin/retreats/{id}/houses[/{house_id}] | add/update/delete_house | gestor/coord | `house.retreat_id == retreat_id` | **OK** | [:728](backend/app/api/admin_retreat_routes.py:728) |
| POST·DELETE /admin/retreats/{id}/eligibility-rules[/{rule_id}] | add/delete_eligibility_rule | gestor/coord | `rule.retreat_id == retreat_id` | **OK** | [:824](backend/app/api/admin_retreat_routes.py:824) |
| POST /admin/retreats/{id}/fee-types | set_fee_types | gestor/coord | valida categorias | **OK** | [:843](backend/app/api/admin_retreat_routes.py:843) |
| GET /admin/retreats/{id}/registrations | list_registrations | gestor/coord | scope por retiro | **OK** | [:901](backend/app/api/admin_retreat_routes.py:901) |
| POST /admin/retreats/{id}/registrations/{reg}/confirm·reject | confirm/reject_payment | gestor/coord | `reg.retreat_id == retreat_id` | **OK** | [:971](backend/app/api/admin_retreat_routes.py:971) |
| PATCH /admin/retreats/{id}/registrations/{reg}/house·role | assign_house / set_role | gestor/coord | `reg.retreat_id == retreat_id`; house validada | **OK** | [:1035](backend/app/api/admin_retreat_routes.py:1035) |
| POST·GET·PUT·DELETE /admin/retreats/{id}/service-teams[/{team_id}] | CRUD service teams | gestor/coord | `team.retreat_id == retreat_id` | **OK** | [:1191](backend/app/api/admin_retreat_routes.py:1191) |
| POST·PATCH·DELETE .../service-teams/{team_id}/members[/{member_id}] | assign/patch/remove member | gestor/coord | `member.team_id == team_id`; reg/house validadas | **OK** | [:1239](backend/app/api/admin_retreat_routes.py:1239) |
| GET·POST·DELETE /admin/retreats/{id}/coordinators[/{coordinator_id}] | list/add/remove coordinator | list: gestor/coord; **add/remove: gestor GLOBAL** | `coord.retreat_id == retreat_id` | **OK** | [:1403](backend/app/api/admin_retreat_routes.py:1403) |
| GET /admin/retreats/{id}/export | export_registrations_csv | gestor/coord | scope por retiro | **OK** | [:1489](backend/app/api/admin_retreat_routes.py:1489) |

### 7. `retreat_routes.py` — `/retreats` (área do membro)

| Método Path | Handler | Auth | Owner/Escopo | Sens. | IDOR | Veredito | Evidência |
|---|---|---|---|---|---|---|---|
| GET /retreats | list_retreats | ✅ | filtra por elegibilidade do user | baixo | não | **OK** | [retreat_routes.py:367](backend/app/api/retreat_routes.py:367) |
| GET /retreats/{id} | get_retreat | ✅ | 403 se não elegível; só PUBLISHED/CLOSED | baixo | não | **OK** | [retreat_routes.py:394](backend/app/api/retreat_routes.py:394) |
| GET /retreats/{id}/service-teams | list_retreat_service_teams | ✅ | retiro publicado | baixo | não | **OK** | [retreat_routes.py:417](backend/app/api/retreat_routes.py:417) |
| POST /retreats/{id}/register | register_for_retreat | ✅ | elegibilidade + `team.retreat_id == retreat_id` | médio | não | **OK** | [retreat_routes.py:459](backend/app/api/retreat_routes.py:459) |
| DELETE /retreats/{id}/my-registration | cancel_my_registration | ✅ | `reg.user_id == current_user.id` | médio | não | **OK** | [retreat_routes.py:613](backend/app/api/retreat_routes.py:613) |
| POST /retreats/{id}/my-registration/payment | submit_payment_proof | ✅ | `reg.user_id == current_user.id`; upload validado | médio | não | **OK** | [retreat_routes.py:642](backend/app/api/retreat_routes.py:642) |

### 8. `inbox_routes.py` — `/inbox`

| Método Path | Handler | Auth | Role/Owner | IDOR | Veredito | Evidência |
|---|---|---|---|---|---|---|
| GET /inbox | get_inbox | ✅ | `recipient.user_id == user_id` (service) | não | **OK** | [inbox_service.py:213](backend/app/services/inbox_service.py:213) |
| GET /inbox/unread | get_unread_messages | ✅ | self (service) | não | **OK** | [inbox_service.py:280](backend/app/services/inbox_service.py:280) |
| PATCH /inbox/read-all | mark_all_as_read | ✅ | self (UPDATE scoped) | não | **OK** | [inbox_service.py:320](backend/app/services/inbox_service.py:320) |
| PATCH /inbox/{recipient_id}/read | mark_as_read | ✅ | `recipient.id == id AND user_id == user_id` | não | **OK** | [inbox_service.py:295](backend/app/services/inbox_service.py:295) |
| GET /inbox/permissions | get_my_permissions | ✅ | self | não | **OK** | [inbox_routes.py:165](backend/app/api/inbox_routes.py:165) |
| GET /inbox/send/scopes·filters | get_send_scopes/filters | ✅ | `_check_send_permission` | não | **OK** | [inbox_routes.py:219](backend/app/api/inbox_routes.py:219) |
| POST /inbox/send/preview | preview_send | ✅ | send perm; global exige perm explícita | não | **OK** | [inbox_routes.py:250](backend/app/api/inbox_routes.py:250) |
| POST /inbox/send | send_message | ✅ | send perm + escopo coord + guard CRITICAL(DEV/ADMIN) | não | **OK** | [inbox_routes.py:270](backend/app/api/inbox_routes.py:270) |
| GET /inbox/sent | get_sent_messages | ✅ | `created_by_user_id == user_id` | não | **OK** | [inbox_service.py:612](backend/app/services/inbox_service.py:612) |
| GET /inbox/approval/pending | get_pending_approvals | ✅ | `_has_full_send_access` | n/a | **OK** | [inbox_routes.py:396](backend/app/api/inbox_routes.py:396) |
| POST /inbox/approval/{message_id}/approve·reject | approve/reject_message | ✅ | `_has_full_send_access` (qualquer aprovador) | escopo amplo | **OK** (nota H5A-08) | [inbox_routes.py:417](backend/app/api/inbox_routes.py:417) |
| GET /inbox/{message_id}/audit | get_message_audit | ✅ | `_has_full_send_access` | escopo amplo | **OK** (nota H5A-08) | [inbox_routes.py:467](backend/app/api/inbox_routes.py:467) |

> 🟢 **H5A-08 (OK / nota de design):** aprovar/rejeitar/auditar aviso só exige ser aprovador full-access (DEV/ADMIN/AVISOS/SECRETARY/coord. Conselho Geral), sem amarrar ao escopo do aviso. Não é auto-aprovação (quem tem full-access nunca cai em `requires_approval`). Coarse, porém intencional; documentar.

### 9. `verification_routes.py` — `/verify`

| Método Path | Handler | Auth | Owner | IDOR | Veredito | Evidência |
|---|---|---|---|---|---|---|
| POST /verify/phone/start | start_phone_verification | ✅ | self; rate-limit/hora | não | **OK** | [verification_routes.py:102](backend/app/api/verification_routes.py:102) |
| POST /verify/phone/confirm | confirm_phone_verification | ✅ | `id == verification_id AND user_id == current_user.id`; máx 3 tentativas | não | **OK** | [verification_routes.py:205](backend/app/api/verification_routes.py:205) |
| POST /verify/email/start | start_email_verification | ✅ | email pertence à identidade do user | não | **OK** | [verification_routes.py:297](backend/app/api/verification_routes.py:297) |
| POST /verify/email/confirm | confirm_email_verification | ✅ | `token_hash AND user_id == current_user.id` | não | **OK** | [verification_routes.py:366](backend/app/api/verification_routes.py:366) |

### 10. `legal_routes.py` — `/legal`

| Método Path | Handler | Auth | Owner | Veredito | Evidência |
|---|---|---|---|---|---|
| GET /legal/latest | get_latest_legal | público (sem `CurrentUser`) | n/a | **OK** (documentos públicos por design) | [legal_routes.py:44](backend/app/api/legal_routes.py:44) |
| POST /legal/accept | accept_legal | ✅ | self (`UserConsent.user_id == current_user.id`) | **OK** | [legal_routes.py:127](backend/app/api/legal_routes.py:127) |

### 11. `life_plan_routes.py` — `/life-plan` (dado sensível — sigilo espiritual)

Padrão: ownership por `LifePlanCycle.user_id == user.id`, direto (`_load_cycle_full`) ou via JOIN para sub-recursos (goal/action/diagnosis/core/routine/review).

| Método Path | Handler | Owner | Veredito | Evidência |
|---|---|---|---|---|
| GET /life-plan/me/active | get_active_cycle | self | **OK** | [life_plan_routes.py:81](backend/app/api/life_plan_routes.py:81) |
| POST /life-plan/cycles | create_cycle | self | **OK** | [life_plan_routes.py:108](backend/app/api/life_plan_routes.py:108) |
| PATCH /life-plan/cycles/{cycle_id}/wizard-progress | update_wizard_progress | `_load_cycle_full` (user_id) | **OK** | [life_plan_routes.py:137](backend/app/api/life_plan_routes.py:137) |
| POST /life-plan/cycles/{cycle_id}/activate | activate_cycle | `_load_cycle_full` | **OK** | [life_plan_routes.py:147](backend/app/api/life_plan_routes.py:147) |
| GET /life-plan/history | get_history | self | **OK** | [life_plan_routes.py:166](backend/app/api/life_plan_routes.py:166) |
| GET /life-plan/cycles/{cycle_id} | get_cycle | `_load_cycle_full` | **OK** | [life_plan_routes.py:200](backend/app/api/life_plan_routes.py:200) |
| POST /life-plan/cycles/{cycle_id}/diagnoses·core·routine·reviews | upsert/create | `cycle.user_id == user.id` antes de gravar | **OK** | [life_plan_routes.py:212](backend/app/api/life_plan_routes.py:212) |
| GET /life-plan/cycles/{cycle_id}/reviews | get_reviews | `cycle.user_id == user.id` | **OK** | [life_plan_routes.py:544](backend/app/api/life_plan_routes.py:544) |
| POST /life-plan/cycles/{cycle_id}/goals | create_goal | `cycle.user_id == user.id` | **OK** | [life_plan_routes.py:289](backend/app/api/life_plan_routes.py:289) |
| PATCH·DELETE /life-plan/goals/{goal_id} | update/delete_goal | JOIN `LifePlanCycle.user_id == user.id` | **OK** | [life_plan_routes.py:349](backend/app/api/life_plan_routes.py:349), [:370](backend/app/api/life_plan_routes.py:370) |
| POST /life-plan/goals/{goal_id}/actions | create_action | JOIN cycle.user_id | **OK** | [life_plan_routes.py:389](backend/app/api/life_plan_routes.py:389) |
| PATCH·DELETE /life-plan/actions/{action_id} | update/delete_action | JOIN goal→cycle.user_id | **OK** | [life_plan_routes.py:409](backend/app/api/life_plan_routes.py:409), [:431](backend/app/api/life_plan_routes.py:431) |

### 12. `projeto_vida_mensal_routes.py` — `/projeto-vida-mensal` (dado sensível)

Padrão: `_load(projeto_id, user.id)` ou subselect explícito `WHERE id == projeto_id AND user_id == user.id`. PIN é screen-lock local (documentado), não controle server-side.

| Método Path | Handler | Owner | Veredito | Evidência |
|---|---|---|---|---|
| GET /projeto-vida-mensal/atual | get_atual | `user_id == user.id` | **OK** | [projeto_vida_mensal_routes.py:169](backend/app/api/projeto_vida_mensal_routes.py:169) |
| GET /projeto-vida-mensal/historico | get_historico | self | **OK** | [projeto_vida_mensal_routes.py:183](backend/app/api/projeto_vida_mensal_routes.py:183) |
| GET /projeto-vida-mensal/contexto-vocacional | get_contexto_vocacional | self | **OK** | [projeto_vida_mensal_routes.py:207](backend/app/api/projeto_vida_mensal_routes.py:207) |
| POST /projeto-vida-mensal | criar_projeto | self (user.id) | **OK** | [projeto_vida_mensal_routes.py:256](backend/app/api/projeto_vida_mensal_routes.py:256) |
| GET /projeto-vida-mensal/{projeto_id} | get_projeto | `_load` user.id | **OK** | [projeto_vida_mensal_routes.py:290](backend/app/api/projeto_vida_mensal_routes.py:290) |
| GET·PUT /projeto-vida-mensal/{projeto_id}/exame | get/upsert_exame | subselect user.id | **OK** | [projeto_vida_mensal_routes.py:301](backend/app/api/projeto_vida_mensal_routes.py:301) |
| GET·PUT /projeto-vida-mensal/{projeto_id}/intercessao | get/upsert_intercessao | subselect user.id | **OK** | [projeto_vida_mensal_routes.py:355](backend/app/api/projeto_vida_mensal_routes.py:355) |
| PUT /projeto-vida-mensal/{projeto_id} | update_projeto | `_load` user.id | **OK** | [projeto_vida_mensal_routes.py:414](backend/app/api/projeto_vida_mensal_routes.py:414) |
| PUT /projeto-vida-mensal/{projeto_id}/revisao | upsert_revisao | `_load` user.id | **OK** | [projeto_vida_mensal_routes.py:517](backend/app/api/projeto_vida_mensal_routes.py:517) |
| POST /projeto-vida-mensal/{projeto_id}/pin/verificar | verificar_pin | `user_id == user.id` + lockout | **OK** | [projeto_vida_mensal_routes.py:547](backend/app/api/projeto_vida_mensal_routes.py:547) |
| GET·POST /projeto-vida-mensal/{projeto_id}/semanal | list/create_semanal | subselect user.id | **OK** | [projeto_vida_mensal_routes.py:594](backend/app/api/projeto_vida_mensal_routes.py:594) |

### 13. `projeto_vida_semanal_routes.py` — `/projeto-vida-semanal` (dado sensível)

| Método Path | Handler | Owner | Veredito | Evidência |
|---|---|---|---|---|
| GET /projeto-vida-semanal/{semanal_id} | get_semanal | JOIN `ProjetoVidaMensal.user_id == user_id` | **OK** | `_load_semanal` [projeto_vida_semanal_routes.py:24](backend/app/api/projeto_vida_semanal_routes.py:24) |
| PUT /projeto-vida-semanal/{semanal_id} | update_semanal | `_load_semanal` | **OK** | [projeto_vida_semanal_routes.py:57](backend/app/api/projeto_vida_semanal_routes.py:57) |

### 14. `routes/export.py` — `/admin/export`

| Método Path | Handler | Auth | Role | Owner | Veredito | Evidência |
|---|---|---|---|---|---|---|
| POST /admin/export/request | create_export_request | ✅ | DEV/ADMIN/SECRETARY; CPF/RG → PENDING + aprovação | requester | **OK** | [routes/export.py:317](backend/app/api/routes/export.py:317) |
| GET /admin/export/requests | list_export_requests | ✅ | DEV/ADMIN/COUNCIL veem tudo; outros só os próprios | self/role | **OK** | [routes/export.py:433](backend/app/api/routes/export.py:433) |
| POST /admin/export/{export_id}/approve | approve_export | ✅ | COUNCIL/DEV/ADMIN | **sem guard de auto-aprovação** | **SUSPEITO** | [routes/export.py:464](backend/app/api/routes/export.py:464) |
| POST /admin/export/{export_id}/reject | reject_export | ✅ | COUNCIL/DEV/ADMIN | — | **OK** | [routes/export.py:520](backend/app/api/routes/export.py:520) |
| GET /admin/export/{export_id}/download | download_export | ✅ | `requested_by == current_user.id OR DEV/ADMIN`; TTL 24h + audit | owner/admin | **OK** | [routes/export.py:559](backend/app/api/routes/export.py:559) |

> 🟡 **H5A-04 (SUSPEITO):** `approve_export` não impede que o solicitante aprove a própria exportação sensível (não há `export_req.requested_by != current_user.id`). Um `COUNCIL_GENERAL`/`ADMIN` que solicita uma exportação com CPF/RG pode aprová-la sozinho — inconsistente com `approve_sensitive_access` ([admin_routes.py:157](backend/app/api/admin_routes.py:157)), que proíbe auto-aprovação. Impacto limitado porque DEV/ADMIN já têm outros caminhos a CPF/RG, mas quebra o dual-control desenhado.

### 15. `channel_routes.py` — `/channel`

Padrão (posts): `_require_active_member(org_unit_id)` + post buscado com `ChannelPost.org_unit_id == org_unit_id`.

| Método Path | Handler | Auth | Member/Role | Owner pós/reply ↔ unit | Veredito | Evidência |
|---|---|---|---|---|---|---|
| GET /channel/{id}/settings | get_channel_settings | ✅ | membro ativo | n/a | **OK** | [channel_routes.py:200](backend/app/api/channel_routes.py:200) |
| GET /channel/{id}/posts | list_posts | ✅ | membro ativo | scope por unit | **OK** | [channel_routes.py:219](backend/app/api/channel_routes.py:219) |
| GET /channel/{id}/posts/{post_id} | get_post | ✅ | membro ativo | `post.org_unit_id == org_unit_id` | **OK** | [channel_routes.py:238](backend/app/api/channel_routes.py:238) |
| POST /channel/{id}/posts | create_post | ✅ | membro + `_resolve_can_post` | autor = self | **OK** | [channel_routes.py:267](backend/app/api/channel_routes.py:267) |
| PATCH /channel/{id}/posts/{post_id} | edit_post | ✅ | autor/coord/admin | `post.org_unit_id == org_unit_id` ✅ | **OK** | [channel_routes.py:290](backend/app/api/channel_routes.py:290) |
| DELETE /channel/{id}/posts/{post_id} | delete_post | ✅ | coord/admin | `post.org_unit_id == org_unit_id` ✅ | **OK** | [channel_routes.py:312](backend/app/api/channel_routes.py:312) |
| PATCH /channel/{id}/posts/{post_id}/pin | toggle_pin | ✅ | coord/admin | `post.org_unit_id == org_unit_id` ✅ | **OK** | [channel_routes.py:334](backend/app/api/channel_routes.py:334) |
| PATCH /channel/{id}/posts/{post_id}/highlight | toggle_institutional_highlight | ✅ | **admin global** | `post.org_unit_id == org_unit_id` ✅ | **OK** | [channel_routes.py:347](backend/app/api/channel_routes.py:347) |
| POST /channel/{id}/posts/{post_id}/replies | create_reply | ✅ | membro ativo | `post.org_unit_id == org_unit_id` ✅ | **OK** | [channel_routes.py:364](backend/app/api/channel_routes.py:364) |
| **PATCH /channel/{id}/posts/{post_id}/replies/{reply_id}** | edit_reply | ✅ | autor/coord/admin do **org_unit_id da rota** | **reply NÃO amarrada à unit** ❌ | **FALHA** | [channel_routes.py:382](backend/app/api/channel_routes.py:382) |
| **DELETE /channel/{id}/posts/{post_id}/replies/{reply_id}** | delete_reply | ✅ | coord/admin do **org_unit_id da rota** | **reply NÃO amarrada à unit** ❌ | **FALHA** | [channel_routes.py:402](backend/app/api/channel_routes.py:402) |

> 🟠 **H5A-02 (FALHA):** em `edit_reply`/`delete_reply` a reply é buscada apenas por `ChannelReply.id == reply_id AND ChannelReply.post_id == post_id` ([channel_routes.py:382](backend/app/api/channel_routes.py:382), [:402](backend/app/api/channel_routes.py:402)) — **sem** confirmar que o post pertence ao `org_unit_id` da rota. O membership/role é checado contra o `org_unit_id` da rota (controlado pelo atacante). Resultado: **um coordenador da unidade A pode editar/apagar respostas de qualquer unidade B**, bastando conhecer `post_id`+`reply_id` de B (ex.: um membro comum de B que seja coordenador de A). As rotas de post (`edit_post`/`delete_post`/`pin`) já amarram corretamente `post.org_unit_id == org_unit_id` — as de reply não.

### 16. `push_routes.py` — `/push`

| Método Path | Handler | Auth | Owner | Veredito | Evidência |
|---|---|---|---|---|---|
| GET /push/vapid-public-key | get_vapid_public_key | público | n/a | **OK** (por design) | [push_routes.py:33](backend/app/api/push_routes.py:33) |
| POST /push/subscribe | subscribe | ✅ | reatribui por `endpoint` sem checar dono atual | **SUSPEITO** | [push_routes.py:49](backend/app/api/push_routes.py:49) |
| DELETE /push/unsubscribe | unsubscribe | ✅ | `user_id == current_user.id AND endpoint` | **OK** | [push_routes.py:71](backend/app/api/push_routes.py:71) |

> 🟢 **H5A-07 (SUSPEITO):** `subscribe` faz `existing.user_id = current_user.id` quando há subscription com o mesmo `endpoint` ([push_routes.py:49-54](backend/app/api/push_routes.py:49)), sem checar o dono anterior. Mitigado: `endpoint` é uma URL secreta gerada pelo navegador (não enumerável). Severidade baixa.

### 17. `routes/dev.py` — `/dev` (condicional a `settings.enable_dev_endpoints`)

| Método Path | Handler | Auth | Role | Veredito | Evidência |
|---|---|---|---|---|---|
| POST /dev/seed | seed_database | ✅ | qualquer autenticado | **SUSPEITO** (H5A-05) | [routes/dev.py:36](backend/app/api/routes/dev.py:36) |
| POST /dev/create-conselho-geral | create_conselho_geral | ✅ | DEV | **OK** | [routes/dev.py:154](backend/app/api/routes/dev.py:154) |
| POST /dev/assign-global-role | assign_global_role | ✅ | DEV | **OK** | [routes/dev.py:215](backend/app/api/routes/dev.py:215) |
| POST /dev/make-me-dev | make_me_dev | ✅ | bootstrap: bloqueia se já existe DEV | **SUSPEITO** (H5A-05) | [routes/dev.py:273](backend/app/api/routes/dev.py:273) |
| POST /dev/grant-inbox-permission | grant_inbox_permission | ✅ | self-grant | **SUSPEITO** (H5A-05) | [routes/dev.py:307](backend/app/api/routes/dev.py:307) |
| DELETE /dev/revoke-inbox-permission | revoke_inbox_permission | ✅ | self | **OK** | [routes/dev.py:342](backend/app/api/routes/dev.py:342) |

> 🟡 **H5A-05 (SUSPEITO):** `make_me_dev` (auto-DEV no primeiro bootstrap), `grant_inbox_permission` (self-grant de envio de avisos) e `seed_database` (qualquer autenticado) são escaláveis por qualquer usuário **se o router /dev estiver ligado**. A única proteção é `settings.enable_dev_endpoints` (com warning em [main.py:329](backend/app/main.py:329)). `make_me_dev` tem guard interno (bloqueia se já existe DEV), mas `grant_inbox_permission`/`seed` não. Defesa em profundidade: estes endpoints deveriam também assertar `not settings.is_production`. Verificar nas envs de produção que `enable_dev_endpoints=false` (fora do escopo H5A, mas crítico operacionalmente).

---

## Classificação consolidada

### ✅ OK confirmado
- **Projeto de Vida mensal e semanal** — ownership por `user_id` em 100% dos endpoints (direto ou JOIN ao pai).
- **Life Plan** — idem (cycle/goal/action/diagnosis/core/routine/review todos amarrados a `LifePlanCycle.user_id`).
- **Retiros (membro)** — inscrição/cancelamento/pagamento sempre `reg.user_id == current_user.id`; elegibilidade aplicada na leitura.
- **Admin de retiros** — `_require_retreat_manager` + validação `*.retreat_id == retreat_id` em todos os sub-recursos; add/remove coordenador exige gestor global.
- **Acesso sensível CPF/RG (`admin_routes.py`)** — request→approve→expiração→audit com separação de deveres (modelo correto).
- **Organização (mutações)** — convites, criação de filhos, edição de unidade, gestão de membros: todas com checagem de coordenador/hierarquia no service; `respond_to_invite` valida owner do convite.
- **Inbox (usuário)** — leitura/marcação sempre escopadas a `recipient.user_id`; envio com permissão+escopo; guard CRITICAL.
- **Verificação telefone/e-mail** — escopo self, rate-limit, hash de OTP/token, tentativas limitadas.
- **Auth, Legal, Export (request/download), Channels (nível post)** — autorização adequada.

### ⚠️ Suspeitos que precisam de teste (H5D)
- **H5A-03** `GET /org/units/{id}` — testar leitura de unidade RESTRICTED por não-membro.
- **H5A-04** `approve_export` — testar auto-aprovação de exportação sensível pelo próprio solicitante (COUNCIL/ADMIN).
- **H5A-05** `/dev/*` — confirmar `enable_dev_endpoints=false` em prod; testar self-escalation com flag ligada.
- **H5A-06** `vocational_accompanist_user_id` — testar disclosure de `full_name` de terceiro.
- **H5A-07** `push/subscribe` — testar takeover de subscription por `endpoint`.

### ❌ Falhas confirmadas
- **H5A-01 (🟠 Alto)** `GET /admin/users/{user_id}/profile` devolve CPF/RG em claro a DEV/ADMIN/SECRETARY, contornando o workflow de acesso sensível (aprovação + expiração + separação de deveres). `ADMIN`/`SECRETARY` obtêm leitura direta que o modelo de `admin_routes.py` deliberadamente restringe.
- **H5A-02 (🟠 Alto)** `edit_reply`/`delete_reply` de canal não amarram a reply ao `org_unit_id` da rota → moderação/edição cruzada entre unidades por coordenador de outra unidade.

### 🔧 Correções recomendadas para H5B (não aplicar em H5A)
1. **H5A-01:** unificar o acesso a CPF/RG num único controle. Opções: (a) `get_user_full_profile` deixa de descriptografar CPF/RG e passa a exigir `SensitiveAccessRequest` aprovado como `get_user_documents`; ou (b) remover a duplicação e o front consome só `admin_routes.py`. Remover `ADMIN` do caminho direto a CPF/RG salvo passar pelo fluxo de aprovação.
2. **H5A-02:** em `edit_reply`/`delete_reply`, buscar a reply com JOIN ao post garantindo `ChannelPost.org_unit_id == org_unit_id` (espelhar o padrão já usado em `edit_post`/`delete_post`).
3. **H5A-03:** aplicar checagem de visibilidade em `get_org_unit` (PUBLIC, ou membro, ou admin) — reutilizar `get_user_permissions.can_view`.
4. **H5A-04:** adicionar guard `export_req.requested_by != current_user.id` em `approve_export` (espelhar `approve_sensitive_access`).
5. **H5A-05:** adicionar assert `not settings.is_production` nos endpoints `/dev/*` de escalonamento (defesa em profundidade além do flag).
6. **H5A-06 / H5A-07 (baixo):** validar que `vocational_accompanist_user_id` referencia um acompanhador legítimo antes de ecoar nome; em `push/subscribe`, exigir que `endpoint` órfão pertença ao usuário ou recriar em vez de reatribuir.
7. **H5A-09 (organização):** `routes/admin.py` e `admin_routes.py` ambos montam prefixo `/admin` com responsabilidades sensíveis sobrepostas e modelos de controle divergentes. Consolidar para evitar futuras divergências de authz (relacionado a H5A-01).

### 🧪 Testes recomendados para H5D
- **IDOR negativo (deve dar 404/403):** usuário B tentando `GET/PUT` projeto-vida, life-plan cycle/goal/action, inscrição de retiro, recipient de inbox, semanal — todos de A.
- **H5A-01:** usuário SECRETARY sem request aprovado chamando `GET /admin/users/{id}/profile` → hoje 200 (deve falhar após H5B).
- **H5A-02:** coordenador de A apagando reply de B via rota com `org_unit_id=A` → hoje 200 (deve dar 403/404 após H5B).
- **H5A-03:** não-membro lendo unidade RESTRICTED via `GET /org/units/{id}`.
- **H5A-04:** COUNCIL_GENERAL aprovando a própria exportação sensível.
- **Separação de deveres (regressão):** `approve_sensitive_access` continua rejeitando auto-aprovação.
- **Escopo de role:** ANALISTA não acessa `get_user_full_profile`; AVISOS não acessa rotas admin de usuários; coordenador não promove a COORDINATOR sem autoridade superior.

---

## Cobertura

- **Routers wired auditados:** 16/16 + `routes/dev.py` (condicional). Services de authz lidos: `organization.py`, `inbox_service.py`, `role_service.py`. `deps.py` (autenticação).
- **Endpoints inspecionados:** ~140.
- **Não auditados (decisão):** 3 routers órfãos (note-and-skip).

> **Disclaimer:** auditoria assistida por IA focada em padrões de Broken Access Control / IDOR. Não substitui pentest profissional; pode haver falsos negativos em fluxos de autorização complexos. Para H5B/H5D, validar cada item com teste dirigido antes de considerar resolvido.
