# Spec — Exclusão de conta pelo painel admin (#8)

- **Data:** 2026-06-11
- **Status:** SPEC para aprovação. **Nenhum código** (backend ou frontend) será escrito antes do seu OK.
- **Origem:** pedido durante o ciclo Retiros — "não consigo excluir contas pelo painel admin, precisamos criar essa feature."
- **Natureza:** feature nova **full-stack + destrutiva (LGPD)**. Fora do escopo RC. Requer autorização explícita para mexer no backend.

## 1. Objetivo

Permitir que um administrador exclua a conta de **outro** usuário pelo painel (`/admin/users/[id]`), de forma segura, auditável e em conformidade com a LGPD.

## 2. Estado atual (verificado no código)

- **Auto-exclusão já existe:** `DELETE /auth/me` (`backend/app/api/routes/auth.py:307`) — o próprio usuário exclui a si mesmo.
  - Estratégia: **anonimização**, não remoção da linha `User` (LGPD art. 18, VI + retenção legal de 5 anos).
  - Remove: `UserProfile` (CPF/RG e dados pessoais), `UserPreferences`, `OrgMembership`, `UserGlobalRole`; anonimiza e-mail/`provider_uid` em `UserIdentity` (`deleted+<hex>@deleted.invalid`).
  - Retém: linha `User` (`is_active=False`), `UserConsent`, `AuditLog`.
  - Registra `account_deleted` no audit log.
- **NÃO existe** endpoint admin para excluir **outro** usuário. Confirmado: não há `DELETE /admin/users/{id}` em `admin_*` routes.
- Frontend: `app/admin/users/[id].tsx` mostra o perfil completo do usuário (sem ação de exclusão).

## 3. Design proposto

### 3.1 Backend (novo)

- **Endpoint:** `DELETE /admin/users/{user_id}` → `204 No Content`.
- **Estratégia:** **mesma anonimização** do `/auth/me` — extrair a lógica para uma função compartilhada `anonymize_user(db, target_user, actor_user_id, reason)` e reusar nos dois lugares (evita divergência). O self-delete passa a chamar a função com `reason="user_request"`; o admin com `reason="admin_action"`.
- **Auditoria:** `action="account_deleted"`, `actor_user_id = admin`, `entity_id = target`, `metadata={ reason: "admin_action", lgpd_art: "18_VI", actor_role: "ADMIN|DEV" }`.

### 3.2 Autorização e travas (crítico — feature destrutiva)

- **Quem pode:** apenas **DEV e ADMIN** (não SECRETARY). Espelha o gate de escrita de `/admin/users`.
- **Travas obrigatórias:**
  - **Não excluir a si mesmo** via endpoint admin (`target == actor` → 400; usar `/auth/me`).
  - **Não excluir DEV** (conta técnica/infra) → 403.
  - **ADMIN não exclui outro ADMIN** — só **DEV** pode excluir ADMIN (evita escalonamento lateral). ADMIN só exclui MEMBER/coordenadores comuns.
  - **Idempotência:** se já `is_active=False` → 200/204 sem reprocessar (ou 409, ver §8).
  - Alvo inexistente → 404.

### 3.3 Frontend (novo)

- Em `app/admin/users/[id].tsx`: **"Zona de perigo"** ao final, com botão *Excluir conta*.
- Confirmação forte e **cross-platform** (`showConfirm` do wrapper RC — já funciona na web):
  - Texto explica que é **irreversível** e descreve o que é anonimizado vs retido (LGPD).
  - **Opcional (decisão §8):** exigir digitar o nome do usuário para habilitar o botão (proteção anti-clique acidental).
- Chama `adminUserService.deleteUser(userId)` (novo método → `api.delete('/admin/users/${id}')`).
- Sucesso: toast `showAlert('Conta excluída')` + `router.back()` para a lista; a lista reflete `is_active=False`.
- Erros (403/400/404) exibidos via `showAlert` com a mensagem do backend (`parseApiError`).
- Botão só aparece se o admin tiver papel suficiente (DEV/ADMIN) — usar os papéis já carregados.

## 4. Conformidade LGPD

- Mantém a estratégia de **anonimização com retenção** já aprovada para o self-delete (consentimentos + audit por 5 anos).
- Exclusão por admin é um tratamento de dados → o `account_deleted` com `actor_user_id` garante rastreabilidade de **quem** excluiu.
- Sem novos dados pessoais em logs.

## 5. Arquivos afetados (quando aprovado)

**Backend:**
- `app/api/routes/auth.py` — extrair `anonymize_user(...)`; self-delete reusa.
- `app/api/...admin users route` — novo `DELETE /admin/users/{user_id}` com gate de papel + travas.
- Testes: `tests/test_admin_user_deletion.py` (autorização, travas self/DEV/ADMIN, anonimização, audit, idempotência).

**Frontend:**
- `src/services/index.ts` — `adminUserService.deleteUser(userId)`.
- `app/admin/users/[id].tsx` — zona de perigo + confirmação.

## 6. Critérios de aceite

1. ADMIN exclui MEMBER → conta anonimizada (`is_active=False`, perfil/CPF removidos), audit `account_deleted` com actor.
2. ADMIN tentando excluir a si mesmo, outro ADMIN ou DEV → bloqueado (400/403) com mensagem clara.
3. DEV pode excluir ADMIN.
4. SECRETARY/MEMBER não acessam o endpoint (403).
5. Frontend: confirmação aparece e **executa na web** (wrapper RC); cancelar não exclui.
6. Suíte backend verde; `tsc --noEmit` + `expo export` verdes.
7. Nenhuma regressão no `/auth/me` (continua funcionando via a função compartilhada).

## 7. Plano de testes

- Backend `pytest`: matriz de autorização (DEV/ADMIN/SECRETARY/MEMBER × alvos MEMBER/ADMIN/DEV/self), anonimização efetiva, audit log, idempotência.
- Frontend: `tsc` + `expo export`; smoke manual em prod (ADMIN exclui um usuário de teste; confirmar bloqueios).

## 8. Decisões pendentes (preciso do seu OK antes de implementar)

1. **Quem pode excluir quem:** confirma a matriz proposta (DEV exclui qualquer um exceto self; ADMIN exclui só MEMBER/coordenadores; ninguém exclui DEV; ninguém exclui a si pelo admin)?
2. **Soft (anonimização) vs hard delete:** recomendo **anonimização** (igual ao self-delete, LGPD). Confirma? (Hard delete quebraria FKs de audit/consent e a retenção legal.)
3. **Confirmação por digitação do nome** (anti-acidente): incluir ou basta o `showConfirm` de 2 botões?
4. **Captura de motivo** (campo opcional "motivo da exclusão" gravado no audit): incluir?
5. **Reativação:** fora de escopo agora (sem UI de "reativar conta")? 

## 9. Fora de escopo

- Reativação/restauração de contas anonimizadas.
- Exclusão em massa.
- Exportação de dados do usuário antes da exclusão (portabilidade LGPD) — feature separada.

---

*Próximo passo: você decide §8. Com o OK, implemento backend (com testes) + frontend num ciclo próprio, em checkpoints. Nada de backend antes disso.*
