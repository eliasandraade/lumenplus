# RC-FE-AUTH-01 — Auditoria de dependências de `authStore.user` no frontend

**Data:** 2026-06-11
**Autor:** Claude (auditoria automatizada)
**Ticket:** RC-FE-AUTH-01
**Escopo:** `lumen_mobile/` — telas mobile e web (Expo)
**Restrições:** apenas auditoria e documentação; nenhum código foi alterado

---

## 1. Resumo Executivo

A auditoria mapeou **8 arquivos** que importam `useAuthStore` ou `authStore`. Desses, apenas **2 usam `authStore.user` para lógica sensível** (controle de navegação ou acesso visual). Os demais usam ações do store (`refreshUser`, `logout`) ou a própria identidade do usuário logado para operações sem impacto de segurança.

A boa notícia: a maioria das telas críticas já adota o padrão correto de buscar permissões diretamente via API (`/inbox/permissions`, `authService.getMe()`), sem depender do store. A correção pontual feita em `admin/users/[id].tsx` foi o modelo certo.

**Um achado MAJOR** foi identificado: `app/admin/index.tsx` usa `authStore.user?.global_roles` para filtrar as seções do menu administrativo, criando uma inconsistência de UX em reload/deep link (ANALISTA vê botões que não deveria). Não há risco de segurança real porque o backend aplica autorização em cada endpoint.

Veredito: **correção pontual necessária** em um arquivo.

---

## 2. Mapa de Usos do Auth Store

### 2.1 Arquivos que importam `useAuthStore` / `authStore`

| Arquivo | O que usa | Finalidade |
|---|---|---|
| `src/stores/authStore.ts` | — | Definição do store |
| `src/stores/index.ts` | — | Re-exportação |
| `app/admin/index.tsx` | `user?.global_roles` | Filtra seções do menu admin |
| `app/admin/dashboard.tsx` | importa, não usa | Import stale (lint warning) |
| `app/admin/users/[id].tsx` | não usa (já corrigido) | Usa `authService.getMe()` direto |
| `app/(onboarding)/verify-phone.tsx` | `user`, `refreshUser` | `refreshUser` após verificação; `user` destruturado mas não usado em lógica sensível |
| `app/(onboarding)/terms.tsx` | `refreshUser`, `logout` | Ações pós-aceite de termos |
| `app/channel/[unitId].tsx` | `user?.user_id` | Identifica se o usuário logado é autor de post/reply |

### 2.2 Arquivos que usam roles/permissões mas NÃO usam authStore

Esses arquivos já estão no padrão correto:

| Arquivo | Padrão |
|---|---|
| `app/(tabs)/_layout.tsx` | `authService.getMe()` direto |
| `app/(tabs)/home.tsx` | `GET /inbox/permissions` direto |
| `app/(tabs)/invites.tsx` | `inboxService.getMyPermissions()` direto |
| `app/admin/users/index.tsx` | `GET /inbox/permissions` direto |
| `app/admin/entities/index.tsx` | `GET /inbox/permissions` direto |
| `app/admin/users/[id].tsx` | `authService.getMe()` direto ✓ (corrigido) |

---

## 3. Tabela por Arquivo/Tela

| Arquivo | Uso do store | Categoria de uso | Risco UX | Risco Seg. | Cenário crítico |
|---|---|---|---|---|---|
| `admin/index.tsx` | `user?.global_roles` → `isAnalista` | Controle de acesso visual | MÉDIO | NENHUM | Refresh / deep link |
| `admin/dashboard.tsx` | import stale | — | NENHUM | NENHUM | — |
| `admin/users/[id].tsx` | nenhum (corrigido) | — | — | — | — |
| `channel/[unitId].tsx` | `user?.user_id` | Controle de ação visual | BAIXO | NENHUM | Refresh |
| `(onboarding)/verify-phone.tsx` | `refreshUser` | Ação | NENHUM | NENHUM | — |
| `(onboarding)/terms.tsx` | `refreshUser`, `logout` | Ações | NENHUM | NENHUM | — |

---

## 4. Análise por Cenário

### 4.1 `app/admin/index.tsx` — Menu Administrativo

**O que faz:**
```ts
const { user } = useAuthStore();
const globalRoles = user?.global_roles ?? [];
const isAnalista =
  globalRoles.includes('ANALISTA') &&
  !globalRoles.includes('ADMIN') &&
  !globalRoles.includes('DEV');
const sectionsToShow = isAnalista ? [dashboardSection] : [dashboardSection, ...adminOnlySections];
```

**Cenário 1 — Navegação normal após login:** OK. O store está hidratado pelo fluxo de login/onboarding.

**Cenário 2 — Refresh da página web / acesso por URL direta `/admin`:**
- O store começa como `{ user: null, isLoading: true }`.
- `user` é `null` → `globalRoles = []` → `isAnalista = false`.
- **Resultado:** ANALISTA vê TODAS as seções (comunicações, eventos, estrutura, pessoas, segurança) em vez de apenas o Dashboard.
- O backend rejeita as chamadas de API quando o ANALISTA tenta acessar cada endpoint restrito — então não há vazamento de dados.
- O impacto é de UX: botões aparecem que não deveriam, levando a erros 403 confusos.

**Cenário 3 — Store hidratado mas lento (web, conexão ruim):**
- Mesmo problema acima enquanto `isLoading: true`.

**Cenário 4 — Mobile:** Baixíssimo risco. O app mobile raramente faz deep link direto para `/admin` sem navegação pelo app, então o store geralmente está hidratado.

**Cenário 5 — Produção Vercel:** Afetado. Qualquer admin com papel ANALISTA que acesse `/admin` diretamente via URL vê o menu completo até o store carregar (frações de segundo a vários segundos dependendo de rede).

### 4.2 `app/channel/[unitId].tsx` — Canal de Grupo

**O que faz:**
```ts
const { user } = useAuthStore();
const currentUserId = user?.user_id ?? '';
// ...
const isAuthorPost = selectedPost.author_user_id === currentUserId;
```

**Cenário — Refresh / deep link:** `user` é `null` → `currentUserId = ''` → botões de editar/deletar do próprio post do usuário ficam escondidos. O usuário tem que navegar novamente para vê-los. UX ruim mas não é risco de segurança: o backend rejeita edições não autorizadas de qualquer forma.

### 4.3 `app/(onboarding)/verify-phone.tsx`

Usa `user` e `refreshUser`. O `user` é destrutado mas não parece ser usado em lógica de autorização — o fluxo é de verificação de telefone, controlado por `step` local. O `refreshUser` é chamado após verificação bem-sucedida. Sem risco relevante.

### 4.4 `app/(onboarding)/terms.tsx`

Usa apenas `refreshUser` e `logout` — ações, não dados de papéis. Sem risco.

### 4.5 `app/admin/dashboard.tsx`

Importa `useAuthStore` mas **não chama o hook** no componente. É um import não utilizado (stale). Não causa problema funcional, apenas warning de lint (`no-unused-vars`).

---

## 5. Achados por Severidade

### MAJOR — `admin/index.tsx`

**Descrição:** Menu administrativo usa `authStore.user?.global_roles` para filtrar seções. Em refresh/deep link, o store inicia como `null`, resultando em `isAnalista = false`, e o ANALISTA vê todas as seções do menu admin mesmo sem ter acesso real a elas.

**Impacto:** UX — botões aparecem indevidamente. Segurança: nenhuma (backend bloqueia as APIs).

**Correção recomendada:** Usar `GET /auth/me` ou `GET /inbox/permissions` diretamente, da mesma forma que `admin/users/index.tsx` e `admin/users/[id].tsx` já fazem.

---

### MINOR — `channel/[unitId].tsx`

**Descrição:** `user?.user_id` via store. Se o store não estiver hidratado, os botões de editar/deletar do próprio post ficam escondidos.

**Impacto:** UX menor — raro na prática (o canal de grupo é acessado via navegação do app). Segurança: nenhuma.

**Correção recomendada:** Buscar `user_id` via `authService.getMe()` no `useEffect` inicial da tela, igual ao padrão de `[id].tsx`.

---

### POST-RC — `admin/dashboard.tsx`

**Descrição:** Import stale de `useAuthStore` que não é usado.

**Impacto:** Warning de lint; pode bloquear lint CI dependendo da config.

**Correção recomendada:** Remover o import.

---

### SEM AÇÃO — `(onboarding)/verify-phone.tsx`, `(onboarding)/terms.tsx`

Uso de ações do store (`refreshUser`, `logout`), não de dados de papéis. Padrão correto.

---

## 6. Respostas às Perguntas do Ticket

**1. Quais telas dependem de `authStore.user`?**
- `admin/index.tsx` (para roles)
- `channel/[unitId].tsx` (para user_id)
- `(onboarding)/verify-phone.tsx` (desestrutura mas não usa em lógica sensível)

**2. Quais telas deveriam chamar `/auth/me` diretamente?**
- `admin/index.tsx` — deveria buscar roles via `/auth/me` no mount, como `admin/users/[id].tsx`.

**3. Quais telas podem continuar usando store sem risco?**
- `(onboarding)/terms.tsx` — usa apenas `logout`/`refreshUser`.
- `(onboarding)/verify-phone.tsx` — usa apenas `refreshUser`.

**4. Existe algum botão sensível que pode sumir indevidamente?**
- Sim: botões de editar/deletar posts em `channel/[unitId].tsx` somem se o store não estiver hidratado.

**5. Existe algum botão sensível que pode aparecer indevidamente?**
- Sim: seções do menu admin (comunicações, retiros, entidades, usuários, logs, aprovações) aparecem para ANALISTA em reload/deep link enquanto o store carrega.

**6. Existe algum risco real de segurança ou apenas UX?**
- **Apenas UX.** O backend aplica RBAC em todos os endpoints. Nenhuma tela entrega dados sem validação server-side.

**7. Qual padrão devemos adotar?**
→ Ver seção 7.

---

## 7. Recomendação de Padrão

### Regra geral

| Situação | Padrão recomendado |
|---|---|
| Ação de autenticação (logout, refresh) | `useAuthStore()` ✓ |
| Exibir nome/avatar do usuário logado | `useAuthStore()` ✓ (dados cosméticos, falha é visual) |
| Controlar seções/ações baseadas em papel | `GET /auth/me` ou `GET /inbox/permissions` no `useEffect` |
| Identificar autoria de post (user_id) | `GET /auth/me` no `useEffect` da tela |

### Por que não usar `authStore` para roles?

O `authStore` é inicializado assincronamente. No ciclo de vida web (refresh, deep link), ele começa como `{ user: null, isLoading: true }`. Qualquer lógica condicional baseada em `user?.global_roles` durante esse gap vai usar o fallback (`[]`), renderizando o estado errado até o hydration completar.

### Padrão recomendado para telas com controle de acesso visual

```ts
// Em vez de:
const { user } = useAuthStore();
const isAnalista = user?.global_roles.includes('ANALISTA') ?? false;

// Use:
const [roles, setRoles] = useState<string[]>([]);
const [loadingRoles, setLoadingRoles] = useState(true);

useEffect(() => {
  authService.getMe()
    .then((me) => setRoles(me.global_roles))
    .catch(() => setRoles([]))
    .finally(() => setLoadingRoles(false));
}, []);
```

### Hook próprio `useCurrentUser` (recomendado a médio prazo)

Para evitar duplicação, criar um hook centralizado:

```ts
// src/hooks/useCurrentUser.ts
export function useCurrentUser() {
  const [me, setMe] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    authService.getMe()
      .then(setMe)
      .catch(() => setMe(null))
      .finally(() => setLoading(false));
  }, []);

  return { me, loading };
}
```

Esse hook:
- Sempre reflete o estado real do servidor
- Funciona em deep link, refresh e acesso direto por URL
- Centraliza o tratamento de loading e erro
- Não duplica a chamada por tela

### Quando usar `authStore.user` (casos válidos)

- Ações: `refreshUser()`, `logout()` — são operações, não leituras de estado
- Dado cosmético opcional: nome de exibição no header, fallback aceitável se null
- Contexto já garantidamente hidratado (ex: telas dentro do onboarding flow, pós-login)

### Como tratar loading

Durante o fetch de `/auth/me`, a tela deve:
1. Mostrar `ActivityIndicator` ou skeleton, **não** renderizar condicionalmente com dados incompletos
2. Em caso de erro, tratar como "sem permissão" (default deny visual)

---

## 8. Plano de Correção

| Prioridade | Arquivo | Ação | Esforço |
|---|---|---|---|
| 1 | `app/admin/index.tsx` | Substituir `useAuthStore()` por fetch de `/auth/me` no mount | ~30 min |
| 2 | `app/channel/[unitId].tsx` | Substituir `user?.user_id` por fetch de `/auth/me` no mount | ~20 min |
| 3 | `app/admin/dashboard.tsx` | Remover import stale de `useAuthStore` | ~5 min |
| 4 (futuro) | Criar `useCurrentUser` hook | Centralizar padrão para evitar divergência futura | ~1h |

---

## 9. Veredito

**Correção pontual necessária.**

Dois arquivos requerem ajuste: `admin/index.tsx` (MAJOR — UX incorreta para ANALISTA em reload) e `channel/[unitId].tsx` (MINOR — botões de edição somem em reload). Ambos são corrigíveis em menos de 1h sem risco de regressão.

Não há risco de segurança real: o backend aplica RBAC em todos os endpoints e nenhum dado é exposto sem validação server-side.

O padrão correto já está implementado nas telas mais críticas (`home.tsx`, `invites.tsx`, `admin/users/index.tsx`, `admin/users/[id].tsx`, `(tabs)/_layout.tsx`). A correção das duas telas restantes uniformiza o padrão em todo o frontend.
