# Lumen+ — Frontend

**Versão da documentação:** 1.0  
**Data:** 2026-06-12  
**Audiência:** desenvolvedor, designer

---

## Visão Geral

O frontend do Lumen+ é um aplicativo React Native construído com Expo. Um único codebase gera o app web (SPA hospedada na Vercel) e os apps mobile (iOS/Android via EAS Build). O roteamento é feito com Expo Router (file-based), o estado global de autenticação com Zustand, e a validação de formulários com React Hook Form + Zod.

**Estado:** RC Aprovado com Observações (jun/2026)  
**TypeScript:** sem erros (`npx tsc --noEmit` passa)  
**Build web:** funcional em produção

---

## Stack e Dependências Principais

| Pacote | Versão | Papel |
|--------|--------|-------|
| `expo` | ~52.0.0 | SDK base, ferramentas de build |
| `expo-router` | ~4.0.0 | Roteamento file-based |
| `react-native` | 0.76.9 | Runtime mobile |
| `react-native-web` | ~0.19.13 | Adapter web |
| `react` | 18.3.1 | Biblioteca de UI |
| `typescript` | ~5.3.3 | Type checking |
| `zustand` | ^4.4.7 | Estado global (authStore) |
| `firebase` | ^10.7.1 | Auth SDK |
| `react-hook-form` | ^7.49.3 | Formulários |
| `zod` | ^3.22.4 | Validação de schemas |
| `@tanstack/react-query` | ^5.17.0 | Cache e fetching de dados |
| `@sentry/react` | ^10.45.0 | Captura de erros |
| `@vercel/analytics` | ^2.0.1 | Métricas web (web only) |

---

## Estrutura de Diretórios

```
lumen_mobile/
├── app/                          # Rotas (Expo Router file-based)
│   ├── index.tsx                 # Redirect inicial (verifica sessão)
│   ├── (auth)/                   # Login, registro, recuperação de senha
│   │   ├── login.tsx
│   │   └── register.tsx
│   ├── (tabs)/                   # Tabs principais do app
│   │   ├── _layout.tsx           # Guard de onboarding; chama /auth/me
│   │   ├── home.tsx
│   │   ├── community.tsx
│   │   └── profile.tsx
│   ├── (onboarding)/             # Fluxo de onboarding step-by-step
│   │   ├── terms.tsx
│   │   ├── complete-documents.tsx
│   │   └── verify-phone.tsx
│   ├── admin/                    # Painel administrativo
│   │   ├── _layout.tsx
│   │   ├── index.tsx             # Menu admin; seleção por papel
│   │   ├── dashboard.tsx
│   │   ├── users/
│   │   ├── entities/
│   │   └── approvals/
│   ├── retreats/                 # Listagem, detalhe, inscrição
│   ├── vida/                     # Projeto de Vida (CP8)
│   ├── channel/[unitId].tsx      # Canal de posts da unidade
│   └── members.tsx               # Membros da unidade
├── src/
│   ├── config/
│   │   └── firebase.ts           # IS_DEV_AUTH, MISCONFIGURED, mockAuth
│   ├── services/
│   │   ├── api.ts                # API client (fetch + auth header)
│   │   └── authService.ts        # getMe(), registro, login
│   ├── stores/
│   │   ├── authStore.ts          # Zustand: user, isAuthenticated, isLoading
│   │   └── index.ts              # Re-exports
│   ├── theme/
│   │   └── tokens.ts             # Design system: primitives, lightTokens, darkTokens
│   ├── utils/
│   │   ├── alerts.ts             # showAlert, showConfirm (web/native)
│   │   └── error.ts              # parseApiError, isApiError, getApiErrorStatus
│   └── hooks/                    # Hooks customizados
├── vercel.json                   # Build config, rewrites SPA, CSP headers
├── package.json
└── tsconfig.json
```

---

## Roteamento

O Expo Router usa o sistema de arquivos `app/` como definição de rotas, similar ao Next.js App Router. Grupos de rotas entre parênteses `(grupo)` não aparecem na URL.

**Rotas principais:**

| Arquivo | URL | Descrição |
|---------|-----|-----------|
| `app/index.tsx` | `/` | Redireciona para `/home` ou `/login` |
| `app/(auth)/login.tsx` | `/login` | Tela de login |
| `app/(tabs)/home.tsx` | `/home` | Home do membro |
| `app/(tabs)/community.tsx` | `/community` | Comunidade |
| `app/admin/index.tsx` | `/admin` | Menu do painel admin |
| `app/admin/dashboard.tsx` | `/admin/dashboard` | Dashboard de métricas |
| `app/retreats/[id].tsx` | `/retreats/:id` | Detalhe de retiro |
| `app/channel/[unitId].tsx` | `/channel/:unitId` | Canal da unidade |

**Guard de onboarding** (`app/(tabs)/_layout.tsx`): chama `authService.getMe()` em cada foco de tela e redireciona automaticamente se houver pendências (`pending_terms`, `has_documents`, `profile_update_due`).

**Guard de autenticação** (`app/index.tsx`): verifica `auth.authStateReady()` e a presença de `auth.currentUser` antes de decidir o destino.

---

## API Client

O cliente de API está em `src/services/api.ts` e é o único ponto de saída de requisições HTTP para o backend.

**Funcionamento:**

```
1. Obtém token:
   ├── Produção: auth.currentUser.getIdToken()
   └── DEV: AsyncStorage (token dev:uid:email)

2. Adiciona header:
   Authorization: Bearer <token>

3. Executa fetch para EXPO_PUBLIC_API_URL

4. Trata resposta:
   ├── 204 No Content → retorna null (sem tentar parsear JSON)
   ├── 2xx → parseia JSON e retorna
   ├── 401 → signOut(auth) + redirect para /login
   └── 4xx/5xx → throw { response: { status, data } }
```

**Tratamento de erros:**

O backend retorna erros no formato:
```json
{ "detail": { "error": "string", "message": "string", "field": "optional" } }
```

O helper `parseApiError(error, fallback)` em `src/utils/error.ts` extrai a mensagem legível e suporta os três formatos de erro do backend (detalhe de objeto, detalhe de array Pydantic, e string genérica).

> **Nota POST-RC:** 26 arquivos ainda acessam `err.response?.data?.detail` diretamente em vez de usar `parseApiError`. Funcional mas inconsistente. Refatoração documentada como dívida técnica.

---

## Design System

### Tokens

O design system está centralizado em `src/theme/tokens.ts`. A estrutura é:

```
primitives         → valores brutos de cor (navyBrand, blue, gray, etc.)
lightTokens        → mapa semântico para o tema claro
darkTokens         → mapa semântico para o tema escuro
```

**Paleta principal:**

```typescript
primitives.navyBrand[800] = '#1a365d'   // primary do tema claro
primitives.blue[950] = '#0d1a2e'        // bg.screen do tema escuro
```

**Como usar:**

```typescript
import { lightTokens, darkTokens } from '@/src/theme/tokens';
const theme = colorScheme === 'dark' ? darkTokens : lightTokens;
// theme.brand.primary, theme.bg.screen, theme.text.primary, etc.
```

**Não usar cores hex diretamente** fora dos tokens. O design system foi parcialmente migrado; 585 ocorrências de cores hardcoded ainda existem no codebase (dívida técnica pós-RC).

### Alertas e Diálogos

`Alert.alert` do React Native é silencioso na web (no-op). Para compatibilidade cross-platform, use sempre os helpers de `src/utils/alerts.ts`:

```typescript
import { showAlert, showConfirm } from '@/src/utils/alerts';

// Exibe alerta (web: window.alert; native: Alert.alert)
showAlert('Título', 'Mensagem', () => { /* onClose */ });

// Diálogo de confirmação async (web: window.confirm; native: Alert.alert com 2 botões)
const ok = await showConfirm({ title: 'Confirmar?', message: 'Tem certeza?' });
```

---

## Comportamentos Específicos de Plataforma

O código usa `Platform.OS === 'web'` para adaptar comportamentos que diferem entre web e mobile.

| Comportamento | Web | Mobile (iOS/Android) |
|-------------|-----|---------------------|
| Alertas | `window.alert` / `window.confirm` | `Alert.alert` |
| Camera/galeria | Não disponível (expo-image-picker) | Disponível via permissão |
| Push notifications | Web Push API | FCM (Firebase Cloud Messaging) |
| Armazenamento local | IndexedDB (Firebase) | AsyncStorage |
| Navegação | URL do browser | Stack navigation |

---

## Web (Vercel)

O build web é gerado com:

```bash
expo export --platform web
```

Produz um bundle estático em `dist/`. O Vercel serve como SPA com rewrite:

```json
{ "source": "/(.*)", "destination": "/index.html" }
```

**Configuração do Vercel (`vercel.json`):**

```json
{
  "buildCommand": "npm run build",
  "outputDirectory": "dist",
  "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }],
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        { "key": "Content-Security-Policy", "value": "..." },
        { "key": "X-Frame-Options", "value": "DENY" },
        { "key": "X-Content-Type-Options", "value": "nosniff" },
        { "key": "Referrer-Policy", "value": "strict-origin-when-cross-origin" }
      ]
    }
  ]
}
```

**Bundle web:** 11.1 MB (JavaScript único, sem code splitting). Funcional em produção, mas lento em conexões lentas. Code splitting é dívida técnica pós-RC — requer atualização do Expo SDK (breaking).

**Vercel Analytics** (`@vercel/analytics`) está configurado apenas no build web. Não é incluído no app mobile.

---

## Mobile (EAS Build)

O codebase suporta build mobile via EAS (Expo Application Services):

```bash
eas build --platform ios
eas build --platform android
```

A distribuição em App Store (iOS) e Google Play (Android) não foi auditada nesta documentação. Para o estado atual das distribuições mobile, consultar a equipe responsável pelo processo EAS.

---

## Estado dos Checks (jun/2026)

| Check | Comando | Status |
|-------|---------|--------|
| TypeScript | `npx tsc --noEmit` | ✅ Passa sem erros |
| Build web | `expo export --platform web` | ✅ Funcional |
| ESLint | `npm run lint` | ⚠️ Exit 0 mas sem lint real (`.eslintrc` ausente) |
| Testes unitários | — | Não configurados no frontend |

**ESLint inoperante (dívida pós-RC):** o script `npm run lint` invoca `eslint .` mas não há arquivo `.eslintrc` ou `eslint.config.js` no projeto. O ESLint sai com código 0 sem inspecionar nenhum arquivo. Erros de lint podem passar desapercebidos. O TypeScript compensa parcialmente (type errors são capturados pelo `tsc`).

---

## authStore (Zustand)

O store global de autenticação está em `src/stores/authStore.ts`.

**Estado:**

```typescript
interface AuthStore {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  initialize: () => Promise<void>;
  refreshUser: () => Promise<void>;
  logout: () => Promise<void>;
}
```

**`initialize()`**: chamado na abertura do app. Obtém token do Firebase, chama `authService.getMe()`, popula `user` e seta `isAuthenticated`.

**`refreshUser()`**: chama `getMe()` novamente e atualiza o store. Usado após operações que mudam perfil ou papéis.

**Regra de uso:** o authStore é confiável para ações (`logout`, `refreshUser`) e para dados cosméticos (nome, foto). **Não** usar `authStore.user.global_roles` para tomar decisões de acesso — o store pode estar desatualizado em web (refresh/deep link). Usar `authService.getMe()` diretamente nesse caso. Ver `05-autenticacao-permissoes.md` para detalhes.

---

## Sentry

`@sentry/react` captura erros em produção. Configuração:

- `sendDefaultPii: false` — não envia dados pessoais por padrão
- Integrado com Expo Router para capturar erros de navegação
- Disponível em web e mobile

---

## Próxima leitura

- **Autenticação e permissões:** `05-autenticacao-permissoes.md`
- **Admin Dashboard:** `06-admin.md`
- **Projeto de Vida:** `07-projeto-de-vida.md`
- **Deploy e variáveis de ambiente:** `12-deploy-ambientes.md`
