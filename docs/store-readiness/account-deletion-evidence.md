# Exclusão de Conta — Evidência de Auditoria (Gate App Store / Google Play)

**Data da auditoria:** 2026-08-06
**Escopo:** `backend/` (FastAPI) + `lumen_mobile/` (Expo SDK 52 / expo-router)
**Branch auditada:** `main` (commit `7db785d`)
**Método:** leitura estática do código-fonte. Nenhum arquivo de código foi alterado.
**Convenção:** cada afirmação está marcada como **[COMPROVADO]** (li no código, com arquivo:linha) ou
**[INFERIDO]** (deduzi a partir do que li). Onde não foi possível concluir, está escrito
**NÃO DETERMINADO — motivo**.

> **Revisão adversarial (2026-08-06):** este documento passou por uma segunda leitura independente
> cujo objetivo era refutá-lo. As **duas conclusões-blocker foram confirmadas**, mas foram
> encontrados e **corrigidos** erros materiais: um erro de lógica sobre invalidação de sessão
> (§2.2, que se contradizia com §1.1), citações de linha erradas em `deps.py`, `auth.py` e
> `main.py`, um inventário incompleto da raiz do repositório, uma contagem de arquivos errada
> e uma severidade inflada em push. O registro completo está na **§9**. Todas as citações
> arquivo:linha abaixo já refletem o estado real do código em `main` (`7db785d`).

---

## 0. Veredito executivo

| Requisito de loja | Status | Severidade |
|---|---|---|
| Backend expõe endpoint de auto-exclusão | ✅ Existe (`DELETE /auth/me`) | — |
| App mobile tem tela/opção de excluir a conta | ❌ **NÃO EXISTE** | **BLOCKER** |
| Fluxo web público de solicitação de exclusão | ❌ **NÃO EXISTE** no repositório | **BLOCKER** |
| Exclusão remove dados pessoais do perfil | ✅ Sim (perfil, CPF/RG, prefs, vínculos) | — |
| Exclusão invalida sessões / bloqueia re-login | ❌ **Não invalida nada** — o 403 de conta inativa é inalcançável; a request seguinte re-provisiona uma conta nova (ver §2.2) | **critical** |
| Exclusão remove push subscriptions | ❌ Não (impacto limitado: push é Web-only) | medium |
| Exclusão trata inscrições em retiros | ❌ Não | high |
| Exclusão trata Projeto de Vida / diário espiritual | ❌ Não | **critical** |
| Retenção legal declarada bate com o código | ❌ Divergente (política: 30 dias / 2 anos; código: 5 anos) | medium |

**Conclusão:** o backend **tem o endpoint, mas não está pronto** — ele não apaga o dado mais
sensível do produto (Projeto de Vida) e não invalida a sessão (§2.2); e **o app não expõe o fluxo
ao usuário**. Nas regras das duas lojas, um app que cria conta precisa oferecer exclusão *dentro do
app* (Apple, App Review Guideline 5.1.1(v)) e um *link web público* de solicitação de exclusão
(Google Play Data deletion). Nenhum dos dois existe hoje. **Submissão bloqueada.**

> *A 1ª versão deste doc dizia "o backend está tecnicamente pronto". A revisão adversarial refutou
> essa frase — ver §9.2, itens C1 a C3.*

---

## 1. Backend — `DELETE /auth/me`

### 1.1 Rota

**Arquivo:** `backend/app/api/routes/auth.py:311-343` **[COMPROVADO]**

```python
@router.delete("/me", status_code=204)
async def delete_me(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> None:
    ...
    target = db.get(User, user.id)
    if target is not None:
        anonymize_user(db, target, actor_user_id=target.id, reason="user_request")
        db.commit()
```

- Requer autenticação (`Depends(get_current_user)`) — `backend/app/api/deps.py:43`. **[COMPROVADO]**
- Retorna `204 No Content`. **[COMPROVADO]**
- **Não há etapa de confirmação no backend** (sem senha, sem re-auth, sem token de confirmação,
  sem período de carência/undo). Uma única chamada autenticada anonimiza a conta. **[COMPROVADO]**
- **Não é idempotente, e a 2ª chamada faz algo pior do que repetir.**
  A rota não checa `is_active`. Uma 2ª chamada com **o mesmo token** não é barrada pelo `403` de
  conta inativa (`deps.py:110-115`) — esse ramo é inalcançável depois da anonimização, porque
  `anonymize_user` sobrescreve o `provider_uid` (`account_deletion.py:59`) e o lookup por
  `(provider, uid)` (`deps.py:94-102`) deixa de casar. O fluxo cai no ramo "provisionar novo
  usuário" (`deps.py:118-150`), **cria uma conta nova e vazia**, e então `delete_me` anonimiza
  *essa* conta nova, devolvendo `204`. **[COMPROVADO — leitura direta do fluxo; ver §2.2]**
  > **Correção da 1ª auditoria:** a versão anterior afirmava que "o `get_current_user` já barra o
  > usuário inativo com 403, então a 2ª chamada nunca alcança a rota". Isso está **errado** — ver §2.2.

### 1.2 Lógica compartilhada — `anonymize_user`

**Arquivo:** `backend/app/services/account_deletion.py:23-91` **[COMPROVADO]**

Estratégia declarada no próprio docstring (linhas 1-12): **anonimização, não exclusão da linha
`User`**, "para preservar os registros de auditoria e os consentimentos aceitos, conforme obrigação
legal de retenção de 5 anos declarada na Política de Privacidade".

#### O que é APAGADO (linha removida do banco)

| Dado | Tabela | Evidência |
|---|---|---|
| Perfil completo (nome, CPF, RG, telefone, nascimento, cidade/UF, dados vocacionais, foto) | `user_profiles` | `account_deletion.py:53-54` (`db.delete(user.profile)`) |
| Contatos de emergência | `user_emergency_contacts` | cascade ORM `all, delete-orphan` em `models.py:290-292` — apagados junto com o perfil **[INFERIDO do cascade]** |
| Vínculos organizacionais | `org_memberships` | `account_deletion.py:64-65` |
| Papéis globais (ADMIN/DEV/etc.) | `user_global_roles` | `account_deletion.py:66-67` |
| Preferências (inclui `push_opt_in`) | `user_preferences` | `account_deletion.py:70-74` |

#### O que é ANONIMIZADO (linha permanece, campos sobrescritos)

**Arquivo:** `backend/app/services/account_deletion.py:56-61` **[COMPROVADO]**

| Campo | Novo valor |
|---|---|
| `user_identities.email` | `deleted+<user_id.hex>@deleted.invalid` |
| `user_identities.provider_uid` | `deleted+<user_id.hex>@deleted.invalid` |
| `user_identities.email_verified` | `False` |
| `users.is_active` | `False` (linha 77) |

#### O que é RETIDO — e por quê

| Dado | Tabela | Justificativa declarada no código |
|---|---|---|
| Linha `User` (`is_active=False`) | `users` | Âncora para logs de auditoria (`account_deletion.py:40-42`) |
| Aceites de termos/privacidade | `user_consents` | "evidência legal de aceite dos termos (5 anos)" (`auth.py:332`) |
| Log de auditoria | `audit_log` | "rastreabilidade de segurança (5 anos)" (`auth.py:333`) |

Registro da exclusão em auditoria: `account_deletion.py:84-91`, `action="account_deleted"`,
`metadata={"reason": ..., "lgpd_art": "18_VI"}`, **sem dados pessoais**. **[COMPROVADO]**

---

## 2. Backend — o que a exclusão NÃO trata

Este é o achado técnico mais relevante do backend.

**Mecanismo:** como a linha `users` **não é deletada** (`account_deletion.py:77` só faz
`is_active = False`), **nenhum `ON DELETE CASCADE` dispara**. Todas as tabelas com FK
`users.id ON DELETE CASCADE` continuam com as linhas intactas e ainda ligadas ao `user_id` real.
**[INFERIDO — dedução direta do mecanismo de FK do Postgres, alta confiança]**

Tabelas ligadas a `users.id` que **não** são tocadas por `anonymize_user`
(inventário extraído de `backend/app/db/models.py`; há **41** declarações
`ForeignKey("users.id", ...)` no arquivo) **[COMPROVADO]**:

| Tabela | Conteúdo pessoal remanescente | Severidade |
|---|---|---|
| `push_subscriptions` (`models.py:740-756`, FK direta `:748` CASCADE) | endpoint + chaves p256dh/auth do dispositivo | medium (ver §2.1 — push é Web-only) |
| `retreat_registrations` (`models.py:1284-1310`, FK direta `:1296` CASCADE) | inscrições, status de pagamento, casa atribuída | **high** |
| `retreat_coordinators` (`models.py:1522`, FK direta `:1534` CASCADE) | vínculo de coordenação em retiro | medium |
| `retreat_service_team_members` (`models.py:1437`), `retreat_team_preferences` (`models.py:1480`) — **FK para `retreat_registrations.id`, não para `users.id`**; ligação ao usuário é **transitiva** | equipes de serviço e preferências | medium |
| `life_plan_cycles` (FK direta `models.py:1577` CASCADE) + filhas `life_plan_diagnoses`/`cores`/`goals`/`actions`/`spiritual_routines`/`monthly_reviews` (`models.py:1564-1792`, ligadas via `cycle_id`) | **diagnóstico espiritual íntimo** (`abandonar`, `melhorar`, `deus_pede` — `models.py:1634-1636`; defeito dominante e diretor espiritual em `life_plan_cores`) | **critical** |
| `projetos_vida_mensal` (FK direta `models.py:1803` CASCADE) + `projetos_vida_exame` (`models.py:2053-2078`, ligada via `projetos_vida_mensal`) | **exame de consciência** (`gracas_recebidas`, `infidelidades`, `dificuldades_espirituais`, `jesus_abandonado`, `proposito_conversao`) | **critical** |
| `projetos_vida_comunidade/cuidado/compromissos/praticas/revisoes/areas_mensais/intercessao/semanal` | diário espiritual mensal e semanal | **critical** |
| `channel_posts` (`models.py:485`, FK `:501`), `channel_replies` (`models.py:527`, FK `:538`) | textos publicados pelo usuário | medium |
| `inbox_recipients` (`models.py:953`, FK `:965`), `inbox_message_audits` (`models.py:987`, FK `:1003`) | histórico de leitura de mensagens | low |
| `inbox_messages` (`models.py:867`, FK `:906` CASCADE) — **omitida na 1ª versão deste doc** | mensagens enviadas pelo usuário | low |
| `notification_delivery_log` (`models.py:758`, FK `:770`) | histórico de entrega de notificações | low |
| `phone_verifications` (`models.py:648`, FK `:657`), `email_verifications` (`models.py:669`, FK `:678`) | telefone e e-mail em claro nos registros de verificação | **high** |
| `org_invites` (`models.py:596`, FKs `:608` e `:611`) | convites enviados/recebidos | low |
| `user_permissions` (`models.py:1032`), `sensitive_access_requests` (`models.py:1066`), `sensitive_access_audit` (`models.py:1099`) | permissões e trilha de acesso sensível | medium |
| `data_export_requests` (`models.py:806`, FK `:815`) | pedidos de exportação | low |

**Impacto concreto:** o dado mais sensível do produto — o Projeto de Vida (exame de consciência,
infidelidades, dificuldades espirituais) — **permanece no banco indefinidamente após a "exclusão"**,
ligado ao `user_id`. É dado de convicção religiosa, classificado como **sensível** pela LGPD
(art. 5º, II). Isso contradiz a Política de Privacidade e é exatamente o tipo de dado que a
"Data safety" do Google Play exige que seja deletável.

### 2.1 Push notifications após exclusão

**Arquivo:** `backend/app/notifications/notification_service.py:113-115` (dentro de
`_send_push_to_user`, definida em `:110`) **[COMPROVADO]**

```python
subs = db.scalars(
    select(PushSubscription).where(PushSubscription.user_id == user_id)
).all()
```

A seleção de subscriptions **não filtra `User.is_active`**. Como `user_preferences` foi deletado,
`_push_opted_in` (`:103-107`) retorna `True` por default (`return prefs.push_opt_in if prefs
else True`). **[COMPROVADO]**

> **Correção de severidade (revisão adversarial): high → medium.**
> O push deste produto é **exclusivamente Web Push (VAPID + Service Worker)** — os builds nativos
> iOS/Android **nunca criam uma `PushSubscription`**:
> - `lumen_mobile/src/services/push.ts:17` — `registerPushSubscription` retorna `false` de saída se
>   não houver `'serviceWorker' in navigator` e `'PushManager' in window` (falso em React Native).
> - `lumen_mobile/app/(tabs)/home.tsx:50` — o card de permissão é gateado por `Platform.OS !== 'web' → return`.
> - `expo-notifications` **não está** em `lumen_mobile/package.json` (grep = zero).
>
> Logo, a frase original — "uma conta excluída pode continuar recebendo push **no dispositivo**" —
> **não se aplica ao app das lojas**. O que permanece verdadeiro e continua sendo um problema de
> LGPD é a **retenção** de `endpoint`, `p256dh` e `auth` (dados do navegador do titular) após a
> exclusão, e o fato de o envio não filtrar contas inativas — impacto real limitado ao build web.
> **[COMPROVADO]**

### 2.2 Sessões e re-login — **CORRIGIDO na revisão adversarial**

> A 1ª versão deste documento afirmava que "sessões existentes ficam inutilizáveis na prática"
> por causa do `403` de conta inativa, e ao mesmo tempo afirmava (4º bullet) que o lookup por
> `provider_uid` falha depois da anonimização. **As duas afirmações são incompatíveis.**
> A leitura correta é a segunda: **não existe invalidação de sessão nenhuma.**

**Cadeia de evidência [COMPROVADO]:**

1. `anonymize_user` sobrescreve `identity.provider_uid = "deleted+<hex>@deleted.invalid"`
   (`account_deletion.py:57-61`) **e** marca `user.is_active = False` (`:77`) — **sempre juntos**.
2. `is_active = False` é atribuído em **exatamente um lugar em todo o backend**:
   `account_deletion.py:77` (grep por `is_active = False` / `is_active=False` em `backend/app/`
   retorna só esse ponto + 3 menções em docstrings/comentário). Não há rota de "desativar usuário"
   separada.
3. Portanto, para qualquer conta anonimizada, o lookup primário
   `UserIdentity.provider == "firebase" AND provider_uid == payload.uid` (`deps.py:94-102`)
   **nunca volta a casar** — o `uid` do token Firebase continua o original, a linha foi reescrita.
4. Logo o ramo do `403 "Conta de usuário desativada"` (`deps.py:110-115`) só é alcançável a partir
   de uma identidade encontrada — o que não acontece mais. **Esse `403` é código morto para contas
   excluídas.**
5. O fallback por e-mail existe **somente em DEV** (`deps.py:104-108`) e também falha, pois o
   `email` foi reescrito para o mesmo valor anônimo (`account_deletion.py:59`).
6. O fluxo cai no ramo "provisionar novo usuário" (`deps.py:118-150`), que cria `User(is_active=True)`,
   um `UserProfile` novo com `status="INCOMPLETE"`, uma `UserIdentity` nova com o `uid` real,
   grava `audit_log action="user_provisioned"` e **dá `db.commit()`** (`deps.py:147`).

**Consequências corrigidas:**

- **Não há invalidação de sessão.** O token Firebase que o app já tem continua funcionando; a
  **próxima request autenticada qualquer** (não só um re-login) já ressuscita o usuário como uma
  **conta nova e vazia**, silenciosamente. Severidade: **critical** (era descrita como "parcial/high").
- **Não é um "lockout permanente"** como dizia a 1ª versão — é o oposto: **acesso continua**, só que
  contra um registro novo. O usuário não é bloqueado; ele é *reiniciado*.
- **A UX depois de "Excluir minha conta" é indefinida:** se a tela de exclusão for implementada e
  não fizer `signOut(auth)` local + descarte de token, o app volta ao onboarding de perfil
  incompleto em vez de à tela de login. **[INFERIDO — alta confiança; não validado em runtime]**
- **Revogação de token:** **não há**. Grep em `backend/app/` por `revoke_refresh_tokens`,
  `firebase_admin`, `auth.delete_user` retorna **zero** ocorrências relacionadas a auth (os únicos
  hits de `revoke` são `revoke_inbox_permission` em `dev.py:362` e `revoke_permission` em
  `inbox_service.py:181`, ambos sobre permissões de inbox). Evidência adicional: o SDK
  **`firebase-admin` está comentado** em `backend/requirements.txt:18` — a revogação não é apenas
  "não implementada", ela é **impossível sem adicionar a dependência**. **[COMPROVADO]**
- **Conta Firebase Auth:** **não é excluída**. O usuário do Firebase (com e-mail/telefone reais)
  permanece no projeto Firebase. **[COMPROVADO por ausência de qualquer chamada de deleção]**

---

## 3. Backend — exclusão administrativa (comparação)

**Arquivo:** `backend/app/api/routes/admin.py:454-514` **[COMPROVADO]**

`DELETE /admin/users/{user_id}` usa a **mesma** `anonymize_user`. Regras:
- DEV exclui qualquer conta, exceto a própria (`:481-488`) e outras DEV (`:501-507`).
- ADMIN não exclui DEV nem outro ADMIN (linhas 509-513).
- Auto-exclusão por essa rota é rejeitada com `400` e a mensagem:
  **"Para excluir sua própria conta, use a opção no Perfil"** (`admin.py:486`).

> **Achado direto:** a mensagem de erro do backend instrui o usuário a usar "a opção no Perfil".
> **Essa opção não existe** (ver seção 4). O backend documenta um fluxo que o app não implementa.

### 3.1 Cobertura de testes

**Arquivo:** `backend/tests/test_admin_user_deletion.py` **[COMPROVADO]**

11 testes (contagem verificada). Cobrem a matriz de autorização admin, idempotência
(`test_delete_already_inactive_is_idempotent`, linhas 178-185) e o self-delete
(`test_self_delete_me_still_anonymizes`, linhas 191-216) — que valida `is_active=False`, remoção do
`UserProfile` e o `AuditLog` com `reason="user_request"`.

**Nenhum teste valida** remoção de push subscriptions, inscrições em retiros, Projeto de Vida,
verificações de telefone/e-mail ou revogação de sessão. **[COMPROVADO por ausência]**

> **Lacuna adicional identificada na revisão adversarial:** o teste de idempotência
> (`:178-185`) usa **as credenciais do admin** para as duas chamadas — ele **não** exercita o
> caminho descrito na §2.2. **Nenhum teste faz uma 2ª request com o token do próprio usuário
> excluído**, que é exatamente o caso em que o backend re-provisiona uma conta nova. A cobertura
> de teste, portanto, **mascara** o bug de sessão em vez de detectá-lo. **[COMPROVADO]**

---

## 4. Mobile — TELA DE EXCLUSÃO DE CONTA

### 4.1 Existe uma tela de exclusão no app?

# ❌ NÃO. — BLOCKER CRÍTICO DE SUBMISSÃO

**Evidência (buscas exaustivas, todas negativas):**

1. **Nenhuma rota de exclusão.** Listagem completa de `lumen_mobile/app/**/*.tsx` —
   **63 arquivos** (`find lumen_mobile/app -name "*.tsx" | wc -l` = 63; zero `.ts` em `app/`).
   Não há `delete-account.tsx`, `excluir-conta.tsx`, `account-deletion.tsx` nem equivalente.
   **[COMPROVADO]**
   *(A 1ª versão dizia "61 arquivos" — contagem errada, conclusão inalterada.)*

2. **Nenhuma chamada `DELETE /auth/me` no cliente.** Grep por `/auth/me` em `app/` e `src/` retorna
   11 ocorrências; as únicas que são chamadas de rede são **`GET`**:
   - `src/services/index.ts:57` → `getMe: () => api.get<User>('/auth/me')`
   - `app/admin/_layout.tsx:30` → `api.get<MeResponse>('/auth/me')`
   - `app/admin/users/[id].tsx:69-70` → `authService.getMe()` (que resolve no `GET` acima).
     *(A 1ª versão citava `[id].tsx:60`, que é apenas um **comentário** mencionando `/auth/me`.)*

   As demais ocorrências são comentários e tipos (`src/stores/authStore.ts:9`,
   `src/services/index.ts:55,135,155`, `src/types/index.ts:9,240,256`).
   Não existe nenhum `api.delete('/auth/me')` no repositório. **[COMPROVADO]**

3. **Inventário completo de `api.delete(...)` no mobile** (11 chamadas) — nenhum é auto-exclusão:
   `src/services/index.ts:282` (remover membro de unidade), `:343` (`adminApi.deleteUser`),
   `src/services/lifePlan.ts:209,219`, `app/admin/retreats/[id].tsx:322,464,493,525,575`,
   `app/members.tsx:456`, `app/retreats/[id].tsx:212` (cancelar inscrição em retiro).
   **[COMPROVADO]**

   **Complemento da revisão adversarial:** grep por `api.delete` **não é suficiente** — existe um
   helper que emite `DELETE` por `fetch` cru, fora do wrapper `api`:
   `lumen_mobile/src/services/channel.ts:52-79` (`deleteWithBody`, `method: 'DELETE'` na linha 71).
   **Verificado: ele só é usado para endpoints de canal, não para exclusão de conta** — a conclusão
   do achado se mantém, agora sem esse ponto cego. **[COMPROVADO]**

4. **A aba Perfil não oferece exclusão.** `lumen_mobile/app/(tabs)/profile.tsx` termina em:
   seção "Aparência" (tema claro/escuro, linhas 577-621) → **"Sair da Conta"** (linhas 624-628,
   apenas `signOut(auth)` + `router.replace('/(auth)/login')`, linha 391) → texto de versão
   (linha 629). **Não há "Zona de perigo", nem "Excluir conta".** **[COMPROVADO]**

5. **Grep por strings de UI** (`excluir conta`, `apagar conta`, `deletar conta`, `delete account`,
   `encerrar conta`, `remover conta`, case-insensitive) em `lumen_mobile/` retorna **apenas 2
   ocorrências, ambas no painel administrativo**: `app/admin/users/[id].tsx:222` (texto do botão)
   e `:237` (título do modal). *(A 1ª versão dizia "3 ocorrências" e incluía `:209` — essa linha é
   o comentário `{/* Zona de perigo — exclusão de conta */}`, que **não casa** com o padrão
   declarado; ela só aparece se "zona de perigo"/"exclusão de conta" for adicionado à busca.
   Contagem corrigida; substância inalterada.)*
   Esse fluxo é para um **ADMIN excluir a conta de OUTRA pessoa** — está atrás do guard de role em
   `app/admin/_layout.tsx` e chama `DELETE /admin/users/{id}`, não `DELETE /auth/me`.
   **[COMPROVADO]**

6. **Confirmação cruzada independente.** Dois documentos de metadados de loja já registram
   exatamente este bloqueio, com a mesma evidência:
   `store-metadata/apple/pt-BR.md:198` (Guideline 5.1.1(v)) e
   `store-metadata/google-play/pt-BR.md:205`. **[COMPROVADO]**

### 4.2 Respostas às perguntas do checklist de loja

| Pergunta | Resposta | Evidência |
|---|---|---|
| Existe tela de exclusão no app? | **NÃO** | seção 4.1 |
| Caminho/arquivo | **N/A — não existe** | — |
| Quantos toques a partir do Perfil? | **Impossível — não há caminho** | — |
| Informa consequências? | **N/A** | — |
| Pede confirmação? | **N/A** | — |
| Permite cancelar? | **N/A** | — |
| Chama `DELETE /auth/me`? | **NÃO — nenhum código cliente chama esse endpoint** | seção 4.1, itens 2-3 |

### 4.3 O que existe (fluxo admin) — só como referência de UX

`lumen_mobile/app/admin/users/[id].tsx:209-280` **[COMPROVADO]** — para **outro** usuário, o admin
tem: card "Zona de perigo" com texto explicativo ("Excluir anonimiza permanentemente os dados
pessoais desta conta (LGPD). Logs de auditoria e consentimentos são retidos por obrigação legal."),
modal com aviso "Esta ação é irreversível", **confirmação por digitação do nome do alvo**, campo de
motivo opcional e botão **Cancelar**.

> A UX de confirmação já está escrita e é adequada. Falta apenas a versão auto-serviço na aba Perfil,
> ligada a `DELETE /auth/me`.

---

## 5. Fluxo WEB público de solicitação de exclusão (exigência do Google Play)

### ❌ NÃO EXISTE NO REPOSITÓRIO — BLOCKER

**Evidências:**

1. **Nenhuma rota web pública.** Grep repo-wide por `excluir-conta`, `account-deletion`,
   `delete-account`, `exclusao-de-conta`, `solicitar exclus` retorna **zero arquivos de código** —
   os únicos hits hoje são as duas linhas **deste próprio documento** que citam os termos buscados.
   **[COMPROVADO]**

2. **O backend não serve páginas.** Grep em `backend/app/main.py` por `StaticFiles`, `HTMLResponse`,
   `templates`, `.mount(` e `Jinja` retorna **zero**. Só há registro de routers de API JSON —
   bloco `include_router` em **`main.py:432-453`**. **[COMPROVADO]**
   *(A 1ª versão citava `main.py:307-328` para esse bloco — linha errada; o fato em si se confirma.)*

3. **Não há projeto web/landing no repositório.** Inventário **completo** da raiz:
   `backend/`, `lumen_mobile/`, `strapi/`, `docs/`, `scripts/`, **`store-metadata/`**,
   `docker-compose.yml`, `docker-compose.override.yml`, `README.md`, `CLAUDE.md`, `estrutura.txt`.
   Nenhum deles é um projeto web servível. **[COMPROVADO]**
   *(A 1ª versão dizia "raiz contém apenas backend/, lumen_mobile/, strapi/, docs/, scripts/ e
   arquivos de compose" — inventário incompleto. A omissão mais relevante era `store-metadata/`,
   que é diretamente pertinente a esta auditoria e já documenta o mesmo bloqueio — ver §4.1, item 6.
   A conclusão "não existe projeto web" **se mantém**.)*

4. **O canal existente é manual, por e-mail.** `docs/ops/lgpd/titular-requests.md:11` define
   `lgpd@lumenserfeliz.org` como canal oficial, com prazo de 15 dias. Isso satisfaz a LGPD, mas
   **não** satisfaz o requisito do Google Play, que exige uma **URL pública dedicada** de
   solicitação de exclusão, informada no formulário de Data Safety. **[COMPROVADO]**

5. **Procedimento documentado está desatualizado.** `docs/ops/lgpd/titular-requests.md:64` descreve
   o processo como *"Admin acessa Railway → psql → executa exclusão suave (marcar `deleted_at`)"*.
   **A coluna `deleted_at` não existe** — o modelo `User` (`backend/app/db/models.py:93-107`) tem
   apenas `id`, `is_active`, `created_at`, `updated_at`. O procedimento real hoje é
   `DELETE /admin/users/{id}`. Documentação divergente do código. **[COMPROVADO]**
   Divergência adicional no mesmo bloco (`titular-requests.md:68`): ele descreve
   `DELETE /me` como **"processo futuro"** e prevê `AuditLog` com
   `action = "user_deletion_requested"` / `"user_deleted"` — mas o endpoint **já existe** e a ação
   realmente gravada é `action="account_deleted"` (`account_deletion.py:87`). **[COMPROVADO]**

6. **Contexto útil para o bloqueador humano:** já existe uma URL pública *planejada* para a política
   de privacidade — `https://lumenplus.app/privacidade`, registrada como **"URL pública futura"** em
   `docs/ops/lgpd/politica-privacidade-draft.md:7`, com "publicação user-facing pendente". Ela **não**
   é uma página de solicitação de exclusão, mas indica que a decisão de domínio/hospedagem já está
   parcialmente tomada. **[COMPROVADO]**

---

## 6. Divergência entre Política de Privacidade e código

**Arquivo:** `docs/ops/lgpd/politica-privacidade-draft.md:105-113` **[COMPROVADO]**

| Item | Política declara | Código faz | Divergência |
|---|---|---|---|
| Dados de conta | "ativa + 30 dias após exclusão solicitada" | `users` retido **indefinidamente** (`is_active=False`) | ❌ |
| Logs de auditoria interna | **2 anos** | docstrings citam **5 anos** (`account_deletion.py:42`, `auth.py:333`) | ❌ |
| Registros de aceite de termos | "enquanto necessário" | **5 anos** (`auth.py:332`) | ⚠️ vago |
| Dados espirituais/missionários | "[prazo a definir pelo DPO — LGPD-01]" | **nunca apagados** na exclusão | ❌ **critical** |

O docstring do código afirma que a retenção de 5 anos está "declarada na Política de Privacidade"
(`account_deletion.py:8-9`) — **a política em `docs/` não declara 5 anos em lugar nenhum**.
**[COMPROVADO]** Não foi possível verificar se o texto legal vigente em produção (servido via
`legal_router` / tabela `legal_documents`) difere do draft em `docs/`.
**NÃO DETERMINADO — o conteúdo real dos `legal_documents` está no banco, não no repositório.**

---

## 7. Ações necessárias para desbloquear a submissão

### Bloqueadores de engenharia (código — fora do escopo desta auditoria read-only)

1. **[BLOCKER]** Criar tela de exclusão de conta no app, acessível a partir da aba Perfil
   (recomendado: ≤2 toques — Perfil → "Excluir minha conta" → modal de confirmação).
   Deve listar consequências, exigir confirmação explícita, permitir cancelar e chamar
   `DELETE /auth/me`. A UX de `app/admin/users/[id].tsx:227-280` serve de base.
2. **[BLOCKER]** Publicar página web pública de solicitação de exclusão (URL estável, sem login),
   para informar no Data Safety do Google Play.
3. **[CRITICAL]** Estender `anonymize_user` para apagar/anonimizar Projeto de Vida
   (`life_plan_*`, `projetos_vida_*`) — dado sensível de convicção religiosa.
4. **[CRITICAL — reclassificado na revisão adversarial; era "MEDIUM/revogar tokens"]**
   Corrigir a **ressurreição silenciosa de conta** descrita na §2.2. Depois de `DELETE /auth/me`,
   a próxima request com o mesmo token cria uma conta nova e vazia (`deps.py:118-150`), em vez de
   ser rejeitada. Opções mínimas, não excludentes:
   (a) manter uma tabela/flag de `provider_uid` excluídos e recusar o provisionamento;
   (b) **não** sobrescrever o `provider_uid` (só o e-mail), preservando o `403` de `is_active=False`
   em `deps.py:110-115` — hoje esse ramo é código morto;
   (c) descomentar `firebase-admin` (`backend/requirements.txt:18`) e usar `revoke_refresh_tokens`
   + decidir sobre `auth.delete_user`.
   Sem isso, "excluir a conta" não encerra a sessão nem impede o acesso.
5. **[HIGH]** Apagar `phone_verifications` e `email_verifications` (telefone/e-mail em claro) na
   exclusão.
6. **[HIGH]** Definir e implementar o tratamento de `retreat_registrations` (obrigação
   contábil/pagamento vs. eliminação) e documentar a base legal da retenção.
7. **[MEDIUM]** Apagar `push_subscriptions` na exclusão e filtrar `User.is_active` no envio
   (`notification_service.py:113-115`). *(Severidade rebaixada de HIGH: push é Web-only — §2.1.)*
8. **[MEDIUM]** Decidir a política sobre a conta Firebase Auth (excluir vs. manter) — hoje o
   e-mail real permanece no Firebase após a "exclusão".
9. **[MEDIUM]** Corrigir a divergência de prazos entre política e código; corrigir
   `docs/ops/lgpd/titular-requests.md:64` (referência a `deleted_at` inexistente) e `:68`
   (`DELETE /me` descrito como "futuro"; nomes de `action` divergentes).
10. **[MEDIUM]** Adicionar testes de regressão para tudo acima — em especial **um teste que reusa o
    token do próprio usuário depois do self-delete**, que é a lacuna que hoje mascara o item 4.

### Bloqueadores humanos (não podem ser resolvidos por código)

| Plataforma | Ação humana necessária | Por quê |
|---|---|---|
| Google Play Console | Definir e publicar a **URL pública** de solicitação de exclusão e preenchê-la em *Data safety → Account deletion* | Exigência de política; URL não existe e não pode ser inventada |
| Hospedagem da página web | Decidir **onde** a página pública será hospedada (domínio, provedor) | Não há projeto web no repositório; decisão de infra/domínio. Existe um domínio já previsto — `https://lumenplus.app/privacidade` como "URL pública futura" (`politica-privacidade-draft.md:7`) — mas nada publicado |
| DPO / Encarregado | Aprovar os **prazos de retenção reais** (conta, dados espirituais, auditoria, consentimentos) | `politica-privacidade-draft.md:113` marca o prazo como "[a definir pelo DPO — LGPD-01]" |
| DPO / Jurídico | Definir a **base legal** para reter `retreat_registrations` (dado financeiro) após exclusão | Decisão jurídica, não técnica |
| App Store Connect | Confirmar no formulário de review que o app oferece exclusão in-app | Só pode ser marcado depois que a tela existir |

---

## 8. Limitações desta auditoria

- Auditoria **100% estática**. Nada foi executado contra o backend de staging
  (`https://backend-staging-staging-3d47.up.railway.app`) nem contra o banco.
- Não foi verificado o conteúdo real da Política de Privacidade **vigente em produção**
  (armazenada na tabela `legal_documents`, servida por `legal_router`).
  **NÃO DETERMINADO — dado está no banco, não no repositório.**
- Não foi rastreado exaustivamente todo caminho que resolve destinatários de push; a conclusão da
  §2.1 se apoia em `notification_service.py:113-115` e nos gates de plataforma em
  `lumen_mobile/src/services/push.ts:17` e `app/(tabs)/home.tsx:50`.
- Não foi verificado se existe alguma página web de exclusão publicada **fora** deste repositório.
  **NÃO DETERMINADO — só o repositório foi auditado.**
- O comportamento de re-provisionamento descrito na §2.2 foi derivado por **leitura do fluxo**
  (`deps.py:94-150` + `account_deletion.py:57-77`) e pela prova de que `is_active = False` só é
  atribuído em um ponto do backend. **Não foi executado contra staging nem contra o banco** — a
  validação em runtime continua pendente e é o primeiro teste a escrever.

---

## 9. Revisão adversarial — registro de correções (2026-08-06)

Segunda leitura independente, com o objetivo explícito de refutar a 1ª versão.

### 9.1 Conclusões CONFIRMADAS (resistiram à tentativa de refutação)

| # | Achado | Como foi reconfirmado |
|---|---|---|
| 1 | **Não existe tela de exclusão no app mobile** — BLOCKER | 63 rotas `.tsx` listadas; grep de UI = 2 hits, ambos no admin; `profile.tsx:625-629` termina em "Sair da Conta" + versão. Corroborado de forma independente por `store-metadata/apple/pt-BR.md:198` e `store-metadata/google-play/pt-BR.md:205` |
| 2 | **Nenhum código cliente chama `DELETE /auth/me`** — BLOCKER | 11 `api.delete` inventariados + o `fetch` cru de `channel.ts:52-79` conferido; todos os `/auth/me` do mobile são `GET` |
| 3 | **Não existe fluxo web público de exclusão** — BLOCKER | Grep repo-wide = zero código; `main.py` sem `StaticFiles`/`HTMLResponse`/`mount`; inventário completo da raiz sem projeto web |
| 4 | **Projeto de Vida não é apagado** — CRITICAL | `anonymize_user` (`account_deletion.py:23-91`) não referencia `life_plan_*` nem `projetos_vida_*`; FKs diretas confirmadas em `models.py:1577` e `:1803` |
| 5 | **`phone_verifications`/`email_verifications`/`retreat_registrations` retidos** — HIGH | FKs confirmadas (`models.py:657`, `:678`, `:1296`), ausência total em `account_deletion.py` |
| 6 | **Backend instrui um fluxo inexistente** ("use a opção no Perfil") | `admin.py:486` vs `profile.tsx:624-629` |
| 7 | **Política declara 30 dias/2 anos, código declara 5 anos** | Tabela em `politica-privacidade-draft.md:105-113`; grep por "5 anos"/"cinco anos" na política = **zero** |
| 8 | **`titular-requests.md:64` cita `deleted_at` inexistente** | Modelo `User` em `models.py:93-107` tem só `id`, `is_active`, `created_at`, `updated_at` |
| 9 | **Sem revogação de token / sem exclusão da conta Firebase** | Reforçado: `firebase-admin` está **comentado** em `requirements.txt:18` |
| 10 | **Baseline do que a exclusão faz certo** | `account_deletion.py:52-91` conferido linha a linha |

### 9.2 Erros ENCONTRADOS e CORRIGIDOS

| # | Tipo | Erro na 1ª versão | Correção |
|---|---|---|---|
| C1 | **Erro de lógica (material)** | §2.2 afirmava que o `403` de conta inativa torna "sessões existentes inutilizáveis" — contradizendo o próprio 4º bullet da mesma seção | O `403` (`deps.py:110-115`) é **inalcançável** para contas anonimizadas, porque `provider_uid` é reescrito. **Não há invalidação de sessão nenhuma**; a request seguinte re-provisiona conta nova. §2.2 reescrita |
| C2 | **Erro de lógica (material)** | §1.1 afirmava que a 2ª chamada de `DELETE /auth/me` "nunca alcança a rota" por causa do `403` | A 2ª chamada **alcança a rota**, provisiona um usuário novo e anonimiza esse novo; devolve `204` |
| C3 | **Severidade subestimada** | "Exclusão invalida sessões" = ⚠️ Parcial / high | Elevado a **critical** e promovido a item 4 do plano de ação |
| C4 | **Severidade inflada** | Push = **high**, com a frase "conta excluída pode continuar recebendo push **no dispositivo**" | Push é **Web-only** (`push.ts:17`, `home.tsx:50`, sem `expo-notifications`): builds nativos nunca criam `PushSubscription`. Rebaixado a **medium**; a retenção de `endpoint`/`p256dh`/`auth` continua sendo problema de LGPD |
| C5 | **Citação errada** | Rota em `auth.py:306-338`; retenção em `auth.py:327-328` | `auth.py:311-343`; `:332-333` |
| C6 | **Citação errada** | `deps.py:34` (dep), `:80-87` (lookup), `:98-102` (fallback DEV), `:104-109` (403), `:112-128` (provisiona) | `deps.py:43`, `:94-102`, `:104-108`, `:110-115`, `:118-150` |
| C7 | **Citação errada** | Routers em `main.py:307-328` | `main.py:432-453` (o fato — backend não serve HTML — se confirma) |
| C8 | **Contagem errada** | "61 arquivos `.tsx`" | **63** |
| C9 | **Contagem errada** | "3 ocorrências" no grep de UI | **2** — a linha `:209` é um comentário que não casa com o padrão declarado |
| C10 | **Inventário incompleto** | "Raiz contém apenas backend/, lumen_mobile/, strapi/, docs/, scripts/, compose" | Faltavam **`store-metadata/`** (diretamente relevante — já documenta o mesmo bloqueio), `README.md`, `CLAUDE.md`, `estrutura.txt` |
| C11 | **Classificação imprecisa** | `retreat_service_team_members` e `retreat_team_preferences` listadas como "FK para `users.id`" | FK é para `retreat_registrations.id` (`models.py:1437`, `:1480`) — ligação **transitiva** |
| C12 | **Omissão** | Tabela de dados retidos não listava `inbox_messages` | Adicionada (`models.py:867`, FK `:906`) |
| C13 | **Ponto cego de método** | Inventário de DELETE baseado só em `api.delete` | Complementado com o `fetch` cru de `channel.ts:52-79`; verificado que não é exclusão de conta |
| C14 | **Imprecisão** | `[id].tsx:60` citada como chamada `GET /auth/me` | `:60` é comentário; a chamada é `authService.getMe()` em `:69-70` |
| C15 | **Imprecisão** | "grep de `revoke` retornou zero fora do nome da rota admin" | Os hits reais são `revoke_inbox_permission` (`dev.py:362`) e `revoke_permission` (`inbox_service.py:181`), nada ligado a auth |
| C16 | **Lacuna não notada** | Cobertura de testes descrita como "parcial" | Adicionado: o teste de idempotência usa credenciais **do admin**, então **nenhum teste** exercita o token do usuário excluído — a suíte *mascara* C1/C2 |

### 9.3 Varredura de secrets

Grep no documento por `api_key`, `secret`, `token`, `password`, `senha`, `BEGIN ... PRIVATE KEY`,
`postgres://`, `postgresql://`, `redis://`, `AIza`, `sk_live`, `sk_test`, `Bearer <valor>`, `VAPID`:
**nenhum valor de credencial presente**. Os hits são todos prosa ("token Firebase não revogado",
"sem senha, sem re-auth"). O único host que aparece é o de staging já fornecido no escopo, e o
único e-mail é `lgpd@lumenserfeliz.org`, que é o canal público de LGPD já publicado em
`docs/ops/lgpd/titular-requests.md:11`. **Nenhum secret vazado.** **[COMPROVADO]**

### 9.4 Veredito da revisão

**CORRIGIDO.** As três conclusões-blocker da 1ª versão são **sólidas e ficam de pé**: submissão nas
duas lojas continua bloqueada. Mas o documento continha um erro de lógica material (C1/C2) que
**subestimava** a gravidade do problema de sessão, uma severidade inflada (C4) e uma dezena de
citações/contagens erradas que comprometiam a auditabilidade. Todos foram corrigidos acima.
