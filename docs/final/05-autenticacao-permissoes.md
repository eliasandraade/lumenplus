# Lumen+ — Autenticação e Permissões

**Versão da documentação:** 1.0  
**Data:** 2026-06-12  
**Audiência:** desenvolvedor, operador de segurança

---

## Visão Geral

O Lumen+ separa **identidade** de **dados e permissões**:

- **Firebase Auth** cuida da identidade: e-mail, senha, tokens JWT (idToken), persistência de sessão
- **Backend (FastAPI)** cuida dos dados do usuário, papéis globais, papéis por unidade e regras de negócio

Nenhuma decisão de segurança ou autorização ocorre apenas no frontend. O backend valida todo token e toda regra de acesso em cada requisição.

---

## Modelo de Autenticação

### Firebase Auth

O app usa Firebase Auth (SDK `firebase@10.7.1`) com o provedor email/senha.

Após login bem-sucedido, o Firebase retorna um **idToken JWT** com prazo de validade. O frontend envia esse token no header de cada requisição ao backend:

```
Authorization: Bearer <firebase-idToken>
```

O backend valida o token contra a chave pública do Firebase usando `FIREBASE_PROJECT_ID`. A validação é feita em `backend/app/auth/firebase.py` e injetada em todas as rotas protegidas via a dependência `CurrentUser` em `backend/app/api/deps.py`.

### Modo de Desenvolvimento Local

Quando `EXPO_PUBLIC_FIREBASE_API_KEY` está ausente do ambiente de desenvolvimento (`__DEV__ = true`), o app opera em modo mock:

```typescript
// lumen_mobile/src/config/firebase.ts
export const IS_DEV_AUTH = !process.env.EXPO_PUBLIC_FIREBASE_API_KEY;
export const MISCONFIGURED = !__DEV__ && IS_DEV_AUTH;
export const auth: Auth = IS_DEV_AUTH ? mockAuth : firebase!.auth;
```

Em modo mock, o `mockAuth` é um objeto no-op com `authStateReady` que resolve imediatamente e `currentUser = null`. O token é armazenado no AsyncStorage com o formato:

```
Bearer dev:<user-uid>:<email>
```

O backend em modo `AUTH_MODE=DEV` aceita esse token sem validar contra o Firebase.

**Fail-fast em produção:** se o build de produção não tiver `EXPO_PUBLIC_FIREBASE_API_KEY`, `MISCONFIGURED = true` e o app exibe uma tela de erro de configuração em vez de cair silenciosamente em modo mock.

---

## Fluxo de Autenticação

### Login

```
1. Usuário informa e-mail + senha

2. Frontend: signInWithEmailAndPassword(auth, email, password)
   └── Firebase valida e retorna idToken JWT

3. Frontend armazena a sessão:
   ├── Web: Firebase SDK persiste em IndexedDB
   └── Mobile: via AsyncStorage (react-native-async-storage)

4. authStore.initialize() é chamado:
   ├── api.getToken() obtém o idToken do Firebase (ou AsyncStorage em DEV)
   └── authService.getMe() chama GET /auth/me com o token

5. Backend /auth/me:
   ├── Valida token Firebase (extrai UID)
   ├── Busca User no PostgreSQL por firebase_uid
   └── Retorna: user + perfil + global_roles + memberships + pending_invites

6. authStore armazena: { user, isAuthenticated: true, isLoading: false }
```

### Reabertura do App

```
1. app/index.tsx chama auth.authStateReady()
   └── Resolve com sessão Firebase persistida (ou null se não houver)

2. Se !!auth.currentUser:
   └── authStore.initialize() → GET /auth/me → dados frescos do servidor

3. Redireciona para /(tabs)/home ou /(auth)/login
```

### Logout

```
1. authStore.logout() é chamado
2. signOut(auth) — limpa sessão Firebase
3. Redirect para /(auth)/login
4. authStore zera: { user: null, isAuthenticated: false }
```

### Tratamento de Token Inválido

Se qualquer requisição retorna HTTP 401, o API client (`src/services/api.ts`) executa automaticamente:

```
401 recebido → signOut(auth) → redirect para /login
```

---

## Endpoint /auth/me

`GET /auth/me` é o endpoint canônico que retorna o estado completo do usuário autenticado. É chamado:

- Ao inicializar o app (após sessão Firebase ser resolvida)
- Após operações que mudam papéis ou perfil (`authStore.refreshUser()`)
- Em telas que precisam verificar permissões (padrão recomendado)

**Resposta (resumida):**

```json
{
  "user_id": "uuid",
  "firebase_uid": "firebase-uid",
  "email": "email@exemplo.com",
  "display_name": "Nome",
  "profile": { "..." },
  "global_roles": ["ADMIN"],
  "memberships": [
    {
      "org_unit_id": "uuid",
      "org_unit_name": "Setor Norte",
      "role": "COORDINATOR"
    }
  ],
  "pending_terms": false,
  "has_documents": true,
  "profile_update_due": false,
  "pending_invites": []
}
```

---

## Papéis Globais

Papéis globais determinam o que o usuário pode fazer na plataforma como um todo. Um usuário pode ter zero ou mais papéis globais.

| Papel | Acesso |
|-------|--------|
| `DEV` | Acesso completo a tudo, incluindo endpoints `/dev/*` e bypass de fluxos de aprovação |
| `ADMIN` | Gerencia usuários, unidades, retiros, avisos, logs de auditoria |
| `ANALISTA` | Acesso somente ao Dashboard de métricas no painel Admin |
| `SECRETARY` | Pode solicitar acesso a documentos sensíveis (CPF/RG) — requer aprovação |
| `AVISOS` | Pode enviar avisos (inbox) sem moderação |
| `COUNCIL_GENERAL` | Papel organizacional do Conselho Geral; pode ver membros e aprovar certas operações |
| (nenhum) | Membro regular: acesso a funcionalidades do app sem admin |

### Verificação de Papéis no Frontend

O padrão correto para telas que tomam decisões baseadas em papel é fazer uma chamada fresca a `/auth/me`, não ler do `authStore.user.global_roles`:

```typescript
// Padrão correto
useEffect(() => {
  authService.getMe()
    .then((me) => setRoles(me.global_roles))
    .catch(() => setRoles([]))
    .finally(() => setLoadingRoles(false));
}, []);

// Evitar: authStore pode estar desatualizado em refresh/deep link
const { user } = useAuthStore(); // user?.global_roles pode ser null
```

**Por que:** o `authStore` é inicializado de forma assíncrona. Em web (refresh de página, acesso por URL direta), o store começa como `{ user: null }` até o hydration completar. Qualquer lógica condicional baseada em `user?.global_roles` durante esse gap usa o fallback vazio.

O padrão já está correto nas telas críticas: `home.tsx`, `invites.tsx`, `admin/users/index.tsx`, `admin/users/[id].tsx`, `(tabs)/_layout.tsx`. O achado RC-FE-AUTH-01 (auditoria de jun/2026) corrigiu a última tela crítica com esse problema.

### Quando usar authStore para papéis é aceitável

- Exibir nome/avatar do usuário logado (dado cosmético — falha é apenas visual)
- Ações de autenticação: `refreshUser()`, `logout()` (operações, não leituras de papel)
- Telas dentro de fluxo garantidamente pós-login onde o store já está hidratado

---

## Papéis por Unidade

Além dos papéis globais, cada usuário pode ter papéis dentro de unidades organizacionais específicas.

| Papel na unidade | Acesso dentro da unidade |
|-----------------|--------------------------|
| `COORDINATOR` | Gerencia membros, convida, posta no canal, modera |
| `MEMBER` | Participação simples; lê canal, recebe avisos |

Um usuário pode ser coordenador em uma unidade e membro simples em outra. Os papéis por unidade são retornados no array `memberships` de `/auth/me`.

O frontend obtém permissões detalhadas por unidade via:
```
GET /inbox/permissions     → permissões de envio de avisos
GET /org/units/{id}/permissions  → permissões de coordenador na unidade
```

---

## Fluxo de Onboarding

Após o login, o app verifica automaticamente se o usuário tem pendências de onboarding. A lógica está em `app/(tabs)/_layout.tsx`, que chama `authService.getMe()` e redireciona conforme:

```
pending_terms = true       → /onboarding/terms
has_documents = false      → /onboarding/complete-documents
profile_update_due = true  → /onboarding/profile (atualização periódica)
```

O onboarding é bloqueante: o usuário não acessa as tabs principais enquanto houver pendências. Cada etapa concluída chama `authStore.refreshUser()` para atualizar o estado e prosseguir.

---

## Autorização no Backend

### Dependência CurrentUser

Toda rota protegida usa a dependência `CurrentUser` (alias de `Depends(get_current_user)`) de `backend/app/api/deps.py`. Ela valida o token Bearer e retorna o objeto `User` completo do banco.

```python
@router.get("/minha-rota")
async def rota(current_user: CurrentUser, db: DBSession):
    # current_user é o User do banco, não apenas o JWT
    ...
```

### Verificação de Papel (Role Check)

Papéis são verificados em cada router, não na dependência base. Não existe um middleware de role genérico — cada endpoint é explícito:

```python
# Exemplo: rota só para ADMIN ou DEV
if not any(r.name in ['ADMIN', 'DEV'] for r in current_user.global_roles):
    raise HTTPException(status_code=403)
```

### Verificação de Ownership (IDOR)

Recursos pertencentes ao usuário (perfil, projeto de vida, inscrições) são sempre buscados com filtro `WHERE user_id = current_user.id`. O hardening H5A (jun/2026) auditou ~140 endpoints e confirmou ownership check em 100% dos endpoints de dados sensíveis.

As falhas identificadas no H5A (H5A-01 e H5A-02) foram corrigidas em H5B e estão em produção:

- **H5A-01 (corrigido):** `GET /admin/users/{id}/profile` agora retorna `cpf=null, rg=null` para ADMIN/SECRETARY sem `SensitiveAccessRequest` aprovada. Apenas DEV tem bypass direto.
- **H5A-02 (corrigido):** `edit_reply` e `delete_reply` do canal agora amarram a reply ao `org_unit_id` da rota via JOIN com `ChannelPost`, eliminando a possibilidade de moderação cruzada entre unidades.

### Princípio de Separação

O frontend **nunca** é fonte de verdade para permissões. Se um usuário acessa diretamente uma rota de admin sem o papel adequado:
- O frontend pode não exibir o link (controle de UX)
- O backend rejeita a chamada com 403 (controle real)

---

## Segurança de Autenticação

| Camada | Mecanismo |
|--------|-----------|
| Tokens | Firebase idToken JWT com expiração automática |
| Validação | Chave pública Firebase em produção (`AUTH_MODE=PROD`) |
| Modo DEV | Token `dev:<uid>:<email>` — nunca ativo em produção |
| MISCONFIGURED | Tela de erro em produção sem credenciais Firebase |
| 401 automático | `signOut` + redirect ao detectar token inválido |
| CORS | Origens configuradas via `CORS_ORIGINS` no backend |
| Rate limit | Por IP via Redis (limites por minuto e por hora) |
| Audit log | Ações sensíveis registradas em `audit_logs` com IP e user-agent |

---

## Exclusão de Conta

Existem dois caminhos de exclusão, ambos usando o serviço `app.services.account_deletion.anonymize_user`:

### Auto-exclusão (`DELETE /auth/me`)

O próprio usuário autenticado solicita a exclusão do seu perfil. A estratégia é anonimização (não remoção da linha `User`) para preservar os registros de auditoria e consentimentos, conforme obrigação legal de retenção de 5 anos (LGPD art. 18, VI).

O que é removido imediatamente: `UserProfile` (CPF, RG, dados pessoais), `UserPreferences`, `OrgMembership`, `UserGlobalRole`. O e-mail em `UserIdentity` é anonimizado.

O que é retido: a linha `User` (`is_active=False`), `UserConsent` e `AuditLog`.

### Exclusão via Admin (`DELETE /admin/users/{id}`)

Administradores podem excluir contas de outros usuários via painel admin. Usa o mesmo `anonymize_user`, com `reason="admin_action"` e campo livre de justificativa.

**Regras de autorização:**

| Ator | Pode excluir |
|------|-------------|
| DEV | Qualquer conta, exceto a si mesmo e outras contas DEV |
| ADMIN | Contas sem papel DEV ou ADMIN |
| Nenhum | A própria conta por este endpoint (usar `DELETE /auth/me`) |

O endpoint é idempotente: contas já inativas (`is_active=False`) retornam 204 sem reprocessar. Todas as exclusões são registradas em `audit_logs` com `actor_user_id` e justificativa.

---

## Próxima leitura

- **Backend em detalhe (estrutura, endpoints, segurança):** `03-backend.md`
- **Frontend em detalhe (routing, design system, API client):** `04-frontend.md`
- **Segurança e hardening completo:** `11-seguranca-hardening.md`
- **LGPD e dados sensíveis:** `13-lgpd-dados-sensiveis.md`
