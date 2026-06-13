# Lumen+ — Arquitetura Técnica

**Versão da documentação:** 1.0  
**Data:** 2026-06-12  
**Audiência:** desenvolvedor, operador de deploy

---

## Visão Geral

O Lumen+ é uma aplicação cliente-servidor com três camadas principais:

1. **Frontend** — React Native / Expo, roda em web (Vercel) e mobile (iOS/Android via EAS)
2. **Backend** — FastAPI (Python), hospedado no Railway, com PostgreSQL como banco de dados
3. **Serviços externos** — Firebase Auth (identidade), Cloudinary (mídia), Sentry (erros), Vercel Analytics (métricas web)

O backend é a fonte de verdade para dados, permissões e regras de negócio. O frontend é responsável por apresentação e interação. Nenhuma decisão de segurança ou autorização é feita apenas no frontend.

---

## Diagrama de Arquitetura

```
┌─────────────────────────────────────────────────────────────────┐
│                        USUÁRIO FINAL                            │
└───────────────────────────┬─────────────────────────────────────┘
                            │
              ┌─────────────▼──────────────┐
              │         FRONTEND           │
              │   React Native / Expo      │
              │                            │
              │  ┌────────┐  ┌──────────┐  │
              │  │  Web   │  │  Mobile  │  │
              │  │Vercel  │  │ iOS/Andr │  │
              │  └────────┘  └──────────┘  │
              └──────────┬─────────────────┘
                         │ HTTPS / REST
              ┌──────────▼─────────────────┐
              │         BACKEND            │
              │    FastAPI (Python)        │
              │    Railway (produção)      │
              │                            │
              │  ┌─────────────────────┐   │
              │  │   API Routes        │   │
              │  │   Service Layer     │   │
              │  │   Alembic Schemas   │   │
              │  └──────────┬──────────┘   │
              └─────────────┼──────────────┘
                            │
              ┌─────────────▼──────────────┐
              │        PostgreSQL          │
              │    Railway (produção)      │
              └────────────────────────────┘

SERVIÇOS EXTERNOS
┌─────────────────┐  ┌────────────────┐  ┌─────────────────┐
│  Firebase Auth  │  │   Cloudinary   │  │     Sentry      │
│  (identidade)   │  │    (mídia)     │  │    (erros)      │
└────────┬────────┘  └───────┬────────┘  └────────┬────────┘
         │                   │                     │
         └───────── Frontend e Backend ────────────┘

┌─────────────────┐
│ Vercel Analytics│  ← somente web, client-side
└─────────────────┘
```

---

## Fluxo de Autenticação

O Lumen+ usa Firebase Auth como provedor de identidade e o backend como fonte de verdade para dados do usuário e permissões.

```
1. Usuário informa e-mail + senha na tela de login

2. Frontend chama Firebase Auth
   └── signInWithEmailAndPassword(auth, email, password)

3. Firebase valida credenciais e retorna um JWT (idToken)

4. Frontend armazena o token:
   ├── Web: via Firebase SDK (IndexedDB)
   └── Mobile: via AsyncStorage (react-native-async-storage)

5. Em cada requisição ao backend, o frontend envia:
   Authorization: Bearer <idToken Firebase>

6. Backend valida o token com Firebase Admin SDK
   └── Extrai o UID do usuário

7. Backend busca dados do usuário no PostgreSQL
   └── GET /auth/me → retorna user + perfil + papéis globais

8. Frontend armazena o resultado no authStore (Zustand)
   └── user, isAuthenticated, papéis disponíveis

9. Nas próximas aberturas do app:
   └── auth.authStateReady() resolve a sessão Firebase persistida
   └── authStore.initialize() busca /auth/me com o token válido
```

**Fail-fast em produção:** se o build de produção não tiver credenciais Firebase configuradas (`EXPO_PUBLIC_FIREBASE_API_KEY` ausente), o app exibe uma tela de erro de configuração (`MISCONFIGURED = true`) em vez de cair silenciosamente em modo mock.

**Modo DEV local:** quando `EXPO_PUBLIC_FIREBASE_API_KEY` está ausente em ambiente de desenvolvimento (`__DEV__ = true`), o app opera em modo mock com tokens armazenados no AsyncStorage. Isso permite desenvolvimento local sem credenciais Firebase.

---

## Fluxo de uma Chamada Típica

Exemplo: membro abre a lista de retiros disponíveis.

```
1. Tela: app/retreats/index.tsx
   └── useFocusEffect → chama api.get('/retreats')

2. API Client: src/services/api.ts
   ├── Obtém token do Firebase (ou AsyncStorage em modo DEV)
   ├── Adiciona header Authorization: Bearer <token>
   └── fetch('https://backend-production-6efc.up.railway.app/retreats')

3. Backend: FastAPI route /retreats
   ├── Middleware valida token Firebase
   ├── Identifica current_user via UID
   └── Chama service layer

4. Service Layer
   ├── Aplica filtros (status = PUBLISHED, permissões do usuário)
   └── Consulta PostgreSQL

5. Banco de Dados
   └── Retorna registros da tabela retreats + registrations

6. Backend serializa com Pydantic e retorna JSON
   └── HTTP 200 com lista de retiros

7. Frontend trata a resposta
   ├── setState com os dados
   ├── Renderiza FlatList
   └── Se erro: exibe estado de erro com mensagem

8. Tratamento de erro (se 401):
   └── api.ts chama signOut(auth) e redireciona para /login
```

Respostas `204 No Content` (sem corpo) são tratadas explicitamente — o cliente não tenta parsear JSON de resposta vazia.

---

## Separação de Responsabilidades

| Camada | Responsável por |
|--------|----------------|
| **Frontend** | Apresentação, navegação, estado local de UI, validações de formulário, experiência do usuário |
| **Backend** | Autorização real, regras de negócio, integridade dos dados, auditoria, queries ao banco |
| **Banco de dados** | Persistência, integridade referencial, soft deletes, timestamps |
| **Firebase Auth** | Autenticação de identidade (e-mail/senha), tokens JWT, persistência de sessão |
| **Cloudinary** | Armazenamento e entrega de imagens (fotos de perfil, assets) |
| **Sentry** | Captura de erros em produção (frontend e backend), alertas de crash |
| **Vercel Analytics** | Métricas de acesso web (page views, performance) — apenas no build web |

**Princípio crítico:** o frontend nunca é fonte de verdade para permissões. Se um membro tenta acessar `/admin/dashboard` sem papel de ADMIN, o backend rejeita a requisição com 403, independente do que o frontend mostre ou oculte. O backend passou por hardening H5A (autorização IDOR) que garante essa separação.

---

## Ambientes

| Ambiente | Frontend | Backend | Banco |
|---------|---------|---------|-------|
| **Desenvolvimento local** | `expo start --web` (localhost:8081) | `uvicorn` (localhost:8000) | PostgreSQL local (recomendado) |
| **Produção** | Vercel (`lumenplus` project) | Railway (`backend-production-6efc`) | PostgreSQL Railway |
| **Mobile** | EAS Build (iOS/Android) | Mesmo backend de produção | Mesmo banco de produção |

Não existe ambiente de staging formal documentado.

O desenvolvimento local deve ocorrer contra um banco PostgreSQL local ou um ambiente de desenvolvimento dedicado. O banco de produção Railway não deve ser usado como ambiente de desenvolvimento — apenas para validação controlada e com autorização explícita.

A variável `EXPO_PUBLIC_API_URL` define qual backend o frontend acessa. Em produção Vercel, aponta para `https://backend-production-6efc.up.railway.app`.

---

## Decisões Arquiteturais Importantes

### Backend como fonte de verdade de permissões

O frontend exibe ou oculta elementos de UI com base no papel do usuário, mas nunca depende disso para segurança real. Toda operação sensível é validada no backend. Isso significa que um papel mal exibido no frontend não abre uma brecha — o backend rejeita a chamada de qualquer forma.

### Projeto de Vida fora do Admin

O conteúdo do Projeto de Vida de um membro (diário, exame, compromissos pessoais) não é acessível pelo painel Admin nem por qualquer API administrativa. O isolamento é estrutural: as rotas de admin não importam nem chamam nenhum endpoint de `/vida`.

O acesso do próprio usuário ao conteúdo do ciclo passa por um fluxo de desbloqueio com PIN dentro do módulo. O modelo completo de proteção e o fluxo de unlock serão detalhados em `07-projeto-de-vida.md`.

### Admin Dashboard usa dados agregados

O Dashboard do Admin exibe métricas operacionais (totais, crescimento, distribuição por estado de vida). Não exibe conteúdo individual de membros. A separação entre "o admin sabe que existem N membros no Setor X" e "o admin sabe o que cada membro escreveu no seu diário" é intencional e estrutural.

### Analytics Missionais é fundação futura

A arquitetura de dados para Analytics Missionais avançados foi documentada como roadmap. O dashboard atual não implementa essas métricas. Não há decisão tomada sobre o produto final de analytics — apenas a fundação de dados está definida.

### Frontend React Native Web com código único

Existe um único codebase para web e mobile. Diferenças de plataforma são tratadas dentro do código com `Platform.OS === 'web'` — por exemplo, diálogos de confirmação usam `window.confirm` na web e `Alert.alert` no mobile. Essa decisão reduz manutenção mas gera um bundle web maior (11.1 MB), pois carrega dependências de ambas as plataformas.

### Autenticação desacoplada do backend

Firebase Auth cuida da identidade (e-mail, senha, tokens). O backend cuida dos dados do usuário, papéis e regras de negócio. Essa separação permite que o backend seja substituído sem impacto na camada de identidade, e vice-versa.

---

## Riscos Conhecidos e Mitigados

| Risco | Problema | Mitigação aplicada |
|-------|---------|-------------------|
| `Alert.alert` no web | `Alert.alert` do React Native Web é no-op silencioso | `src/utils/alerts.ts` usa `window.alert`/`window.confirm` na web |
| Firebase env ausente em produção | App caía silenciosamente em modo mock com auth falsa | `MISCONFIGURED = !__DEV__ && IS_DEV_AUTH` exibe erro claro |
| Auth store com papel stale | Role lido do store poderia estar desatualizado após mudança de papel | Papel sempre lido de `me.global_roles` via API call fresco (RC-FE-AUTH-01) |
| Resposta 204 sem corpo | Cliente tentava parsear JSON de resposta vazia e quebrava | Tratamento explícito de 204 no API client |
| Autorização IDOR no backend | Endpoint podia retornar dados de outro membro | Hardening H5A: todos os endpoints verificam `current_user.id` |
| Auditoria de ações admin | Ações sensíveis sem rastreabilidade | H6: AuditLog registra operações críticas |
| Credenciais expostas em código | Secrets hardcoded no repositório | Toda configuração via variáveis de ambiente; `.env.local` no `.gitignore` |

---

## Riscos POST-RC

Estes riscos existem, são conhecidos e foram aceitos formalmente como dívida técnica a resolver no próximo ciclo.

| Risco | Descrição | Impacto |
|-------|-----------|---------|
| Bundle web 11.1 MB | JavaScript único sem code splitting | Carregamento mais lento em conexões lentas; funcional em produção |
| ESLint inoperante | `.eslintrc` ausente; `npm run lint` sai com exit 0 sem lint real | Bug de lint pode passar desapercebido; TypeScript compensa parcialmente |
| Hardcoded colors (585 ocorrências) | Cores hex diretas em vez de tokens do design system | Inconsistência visual potencial; não afeta funcionalidade |
| Role guard no admin layout | `app/admin/_layout.tsx` não protege rotas admin por role | URL direta acessível; backend rejeita chamadas sem permissão (proteção real) |
| Service Worker não auditado | `dist/sw.js` presente mas comportamento de cache não verificado | Cache stale possível após deploy; mitigado pelo hash de bundle |

---

## Próxima leitura

- **Backend em detalhe:** `03-backend.md`
- **Frontend em detalhe:** `04-frontend.md`
- **Autenticação e permissões completas:** `05-autenticacao-permissoes.md`
- **Deploy e variáveis de ambiente:** `12-deploy-ambientes.md`
- **Segurança e hardening:** `11-seguranca-hardening.md`
