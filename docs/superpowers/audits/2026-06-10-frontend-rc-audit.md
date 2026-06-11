# Auditoria RC — Frontend Lumen+

- **Data:** 2026-06-11 (arquivo datado 2026-06-10 conforme solicitado)
- **Branch:** `main` · working tree limpo (só docs novos não-rastreados)
- **`git log origin/main..HEAD`:** vazio (HEAD = origin/main; nada pendente de push)
- **Escopo:** apenas auditoria. Nenhuma alteração de código nesta etapa.
- **Alvo:** `lumen_mobile/` (Expo Router · React Native Web · deploy web em Railway + Vercel)

## 0. Resultado dos checks executados

| Check | Comando | Resultado |
|---|---|---|
| Typecheck | `npx tsc --noEmit` | ✅ **Limpo (exit 0)** |
| Lint | `npm run lint` (`eslint .`) | ❌ **Quebrado** — "ESLint couldn't find a configuration file" (sem `.eslintrc`/`eslint.config.js`) |
| Build web | `npx expo export --platform web` | ✅ **OK (exit 0)** — `dist/`, bundle único `entry-*.js` **11,1 MB** |
| Testes frontend | — | ❌ **Inexistentes** (nenhum `*.test/*.spec` em `lumen_mobile/`) |
| Secrets no git | `git ls-files .env.local dist` | ✅ Não rastreados |

> **Stack:** Expo ~52, expo-router ~4, react-native 0.76.9, react-native-web 0.19, @tanstack/react-query, zustand, Firebase Auth, Sentry, Vercel Analytics. Deploy web: `expo export` → `dist/` servido por `server.js` (Railway) e Vercel (`vercel.json`).

---

## 1. Mapa completo de rotas

Roteamento por arquivos (Expo Router, `typedRoutes: true`). Gate de entrada em `app/index.tsx`.

### Grupo `(auth)` — sem header
| Rota | Tela |
|---|---|
| `(auth)/index` | Splash/redirect auth |
| `(auth)/login` | **Login** (Firebase + reset de senha) |
| `(auth)/register` | Cadastro |
| `(auth)/verify-email` | Verificação de e-mail |
| `(auth)/verify-phone` | Verificação de telefone (OTP) |

### Grupo `(onboarding)` — gating pós-login
| Rota | Tela |
|---|---|
| `(onboarding)/terms` | Aceite de termos/privacidade |
| `(onboarding)/complete-documents` | CPF/RG |
| `(onboarding)/profile` | Montagem inicial do perfil + foto |
| `(onboarding)/profile-update` | Atualização periódica (`profile_update_due`) |
| `(onboarding)/verify-phone` | Verificação de telefone (onboarding) |

### Grupo `(tabs)` — `CustomTabBar`
| Rota | Título exibido |
|---|---|
| `(tabs)/service` | **Orações** (devocional/terço/orações) |
| `(tabs)/community` | **Comunidade** |
| `(tabs)/home` | **Início** |
| `(tabs)/invites` | **Inbox** (avisos recebidos + aprovações) |
| `(tabs)/profile` | **Perfil** |

### Rotas standalone / áreas
| Rota | Área |
|---|---|
| `index` | Gate de redirect (logado → tabs/home; senão → auth/login) |
| `members` | **Membros** — gestão de membros de unidade (convidar, cargo, remover) |
| `channel/[unitId]`, `channel/components` | **Canal de Grupos** (posts, respostas, pin, destaque) |
| `coordinator/index` | Painel de coordenador |
| `vida/*` | **Projeto de Vida 2.0** — `index, wizard, ciclo, diario, exame, historico, revisao, semanal, semanal-view, unlock` |
| `biblia/*` | Bíblia (`index`, `reader`) — conteúdo local |
| `catecismo/*` | Catecismo (`index`, `reader`) — conteúdo local |
| `retreats/*` | **Retiros/Eventos** (`index`, `[id]`, `[id]/payment`) |
| `admin/*` | **Admin** (ver abaixo) |

### Subárea `admin/`
`dashboard` · `approvals/index` · `audit-logs` · `create-aviso` · `sent-avisos` · `entities/index` · `users/index` · `users/[id]` · `users/export` · `retreats/index` · `retreats/[id]` · `retreats/create` · `index`

---

## 2. Mapa de fluxos críticos

1. **Autenticação:** `index` (gate) → `(auth)/login` (Firebase ou DEV token) → `authStore.initialize()` → `GET /auth/me`.
2. **Onboarding gating** (`(tabs)/_layout`): `pending_terms/pending_privacy` → terms; `!has_documents` → complete-documents; `profile_update_due` → profile-update.
3. **Avisos / Inbox:** receber (`invites` tab, `/inbox`) → criar (`admin/create-aviso`, `/inbox/send`) → **aprovação** (`admin/approvals`, `/inbox/approval/*`).
4. **Canal de Grupos:** `channel/[unitId]` → `/channel/{id}/posts`, replies, pin, highlight.
5. **Membros:** `members.tsx` → convidar, alterar cargo (`PUT .../role`), remover (`DELETE .../members/{id}`).
6. **Projeto de Vida:** `wizard` → ciclo ativo → diário/exame/semanal/revisão; `unlock` por PIN (`/projeto-vida-mensal/{id}/pin/verificar`).
7. **Admin/Usuários:** lista (`/admin/users`) → perfil completo → **export com aprovação** (`/admin/export/*`, dados sensíveis exigem approve).
8. **Retiros:** lista → detalhe → pagamento (upload de comprovante via `postForm` multipart).
9. **Push:** `push.ts` (VAPID) + `PushPermissionCard`.

---

## 3. Estado atual de cada área (escopo mínimo RC)

| Área | Estado | Observação |
|---|---|---|
| Login | ✅ Funcional | Reset de senha desabilitado em modo DEV (msg inline) |
| Home | ✅ Funcional | Lista avisos não lidos |
| Tabbar | ✅ Funcional | `CustomTabBar` (5 tabs) |
| Perfil | ✅ Funcional | Logout **tem** branch web (`window.confirm`) |
| Comunidade | ⚠️ Web | Aceitar/recusar convite usa `Alert.alert` (recusa **morre na web**) |
| Membros | ⚠️ Web | Cargo/remover via `Alert.alert` sem fallback web |
| Canal de Grupos | ✅ Funcional | — |
| Avisos/Inbox | ✅ Funcional | — |
| Notificações (push) | ⚠️ Verificar | VAPID/permissão dependem de env + HTTPS |
| Projeto de Vida | ✅ Funcional | Maior superfície; revalidar fluxos longos |
| Admin (dashboard) | ✅ Funcional | Auditoria separada já existe (jun/2026) |
| Entidades | ✅ Funcional | — |
| Usuários | ✅ Funcional | Export sensível exige aprovação |
| Logs (audit) | ✅ Funcional | Muitas cores hardcoded (tema) |
| Aprovações | ⚠️ Web | Aprovar/reprovar via `Alert.alert` sem fallback web |
| Retiros/Eventos | ⚠️ Web | Confirmações + `placeholderTextColor` hardcoded |
| Tema claro/escuro | ⚠️ Parcial | Tokens light já revertidos p/ navy original; telas com hex hardcoded fogem do tema |
| Responsividade web | ⚠️ Verificar | Layout RN; bundle 11 MB |
| Navegação mobile | ✅ Funcional | typedRoutes ok |
| Erro de API | ⚠️ Web | `parseApiError` ok, mas exibido via `Alert` (silencioso na web) |
| Loading/empty/error | ✅ Em geral | `Loading`, `SkeletonLoader` presentes |

---

## 4. Lista de achados classificados

### 🔴 BLOCKER

- **B1 — `Alert.alert` é no-op no react-native-web.**
  Verificado no fonte: `node_modules/react-native-web/.../Alert/index.js` → `class Alert { static alert() {} }`.
  Há **37 chamadas `Alert.alert` em 10 telas**; **apenas `profile.tsx` (logout)** tem fallback web (`window.confirm`).
  Consequência na web:
  - **Confirmações cuja ação está no `onPress` do botão não executam**: recusar convite (`community`), **aprovar/reprovar aviso** (`invites`, `admin/approvals`), **remover membro / alterar cargo** (`members`), confirmações de **exportação** (`admin/users/export`), escolha de fonte de foto (`onboarding/profile`).
  - **Moderação administrativa fica inoperante na web** nesses pontos.
  *Correção sugerida (mínima):* wrapper `confirmAsync()`/`notify()` que usa `window.confirm`/UI custom na web e `Alert` no nativo; aplicar nos sites com ação destrutiva.

### 🟠 MAJOR

- **M1 — Feedback de erro silencioso na web.** Os `Alert.alert('Erro', …)` informativos não aparecem na web → usuário não recebe retorno de falhas (perfil, membros, export, etc.). Mesma raiz de B1.
- **M2 — Check de lint inexistente.** Não há config ESLint; `npm run lint` falha. O `CLAUDE.md` define lint como check obrigatório e cita que erros de lint já bloquearam deploys — hoje esse gate **não roda**.
- **M3 — Zero testes automatizados de frontend.** Nenhum `*.test/*.spec`. RC sem rede de segurança de regressão no app.
- **M4 — Risco de auth em produção via `IS_DEV_AUTH`.** `IS_DEV_AUTH = !EXPO_PUBLIC_FIREBASE_API_KEY`. Se o build de produção (Railway/Vercel) **não** tiver `EXPO_PUBLIC_FIREBASE_API_KEY`, o app entra **silenciosamente em modo DEV** (mock auth + token AsyncStorage) → login real quebrado. Confirmar env vars na plataforma.
- **M5 — Telas fora do design system (tema).** Cores hex/rgb hardcoded fora dos tokens em volume: `register` (40), `audit-logs` (36), `retreats/[id]` (34), `profile` (31), `service` (25), `login` (20), `retreats/index` (16). Risco de inconsistência no **dark mode** dessas telas (446 ocorrências em 47 arquivos).

### 🟡 MINOR

- **m1 — `placeholderTextColor="#9ca3af"` hardcoded** em `retreats/[id].tsx` e paleta fixa `C` em `login`/`register` (telas de marca, aceitável, mas não reativas ao tema).
- **m2 — CSP apenas `Report-Only`** no `vercel.json`; **nenhum header de segurança no Railway** (`server.js` não envia X-Frame-Options/CSP). Endurecer headers do `server.js`.
- **m3 — `TODO` real único:** `src/data/oracoes.ts:52` "Adicionar orações personalizadas da Obra Lumen" (conteúdo, não bloqueia).
- **m4 — Reset de senha** desabilitado em modo DEV (mensagem clara; ok em produção com Firebase).

### 🔵 POST-RC (documentar, não implementar)

- Code-splitting / redução do bundle web (11,1 MB num único JS).
- Adotar config ESLint + suíte mínima de testes (Jest/RTL ou Playwright web).
- Migração completa de cores hardcoded → tokens (auditoria de tema dedicada).
- Substituir o padrão `Alert` por componente cross-platform de confirmação/toast em todo o app.

---

## 5. Riscos web

1. **`Alert.alert` no-op (B1/M1)** — o maior risco; quebra confirmações e feedback de erro na web.
2. **Bundle 11 MB único** — TTI lento em conexões ruins; sem code-splitting.
3. **Componentes RN em layout web** — revalidar responsividade (largura, scroll, modais) nas telas densas (`profile`, `admin/*`, `vida/*`).
4. **Push/Notifications** — exige HTTPS + Service Worker + permissão; validar no domínio de produção.
5. **Headers de segurança ausentes no Railway** (m2).

## 6. Riscos mobile

1. Persistência de auth nativa via `initializeAuth + AsyncStorage` — validar reabertura do app já logado (iOS/Android).
2. `Alert.alert` funciona no nativo (não afetado por B1) — comportamento divergente web×nativo a ser unificado.
3. Upload de comprovante (`postForm` multipart) + `expo-image-picker` — validar permissões câmera/galeria em device real.
4. `newArchEnabled: true` — confirmar libs compatíveis com a New Architecture no build EAS.

## 7. Riscos de tema claro/escuro

1. Tokens `light` já apontam para a **paleta navy original** (`navyBrand`/`neutralGray`, comentados como "anterior ao CP3") → revert do redesign **parece feito na fonte**; **falta validação visual** tela a tela.
2. Telas com hex hardcoded (M5) não reagem ao toggle → **inconsistência garantida no dark mode** nessas telas.
3. `login`/`register` usam paleta teal fixa (marca) — decidir se permanecem fora do tema.
4. **Pendência de decisão:** confirmar que o light theme aprovado é o navy (não o teal do redesign).

## 8. Riscos de integração com backend

1. **`IS_DEV_AUTH` (M4)** — fallback silencioso para modo DEV se faltar a API key Firebase no build de produção.
2. **Base URL** via `EXPO_PUBLIC_API_URL` (hoje aponta p/ `backend-production-6efc.up.railway.app`); produção deve fixar a URL correta no painel da plataforma, não depender de `.env.local`.
3. **Contrato de erro** — `parseApiError` cobre 3 formatos (`{error,message}`, lista Pydantic, string). Mudanças no backend nesse shape quebram mensagens (não mexer no backend neste ciclo).
4. **CSP `connect-src`** lista os domínios do backend; novos hosts exigem atualizar `vercel.json`.

---

## 9. O que precisa ser corrigido **antes** do RC

| # | Item | Classe | Esforço |
|---|---|---|---|
| 1 | Wrapper cross-platform p/ `Alert` (confirmação + erro) e aplicar nas telas de moderação/erro web | BLOCKER (B1)/M1 | Médio |
| 2 | Confirmar env vars de produção (`EXPO_PUBLIC_FIREBASE_*`, `EXPO_PUBLIC_API_URL`) no Railway/Vercel — descartar modo DEV acidental | MAJOR (M4) | Baixo |
| 3 | Validação visual light/dark nas telas com hex hardcoded (M5) — ao menos confirmar legibilidade no dark | MAJOR (M5) | Médio |
| 4 | Decidir o gate de lint: criar config ESLint mínima **ou** remover a obrigatoriedade do `CLAUDE.md` | MAJOR (M2) | Baixo |
| 5 | Smoke test manual dos fluxos críticos na **web** e em **um device** (login → onboarding → home → inbox → aprovação → membros → vida → admin) | — | Médio |

## 10. O que pode ficar para **pós-RC**

- Code-splitting / otimização de bundle web.
- Suíte de testes automatizados de frontend (M3).
- Migração 100% de cores hardcoded → tokens.
- Endurecer headers de segurança no `server.js` (Railway) e promover CSP de `Report-Only` → enforced.
- Conteúdo: orações personalizadas (`oracoes.ts` TODO).

---

## 11. Recomendação final

> ## ⚠️ RC viável **após correções**

**Justificativa:** as fundações estão sólidas — typecheck limpo, build web OK, rotas e fluxos completos e integrados ao backend, gating de onboarding e auth coerentes, design tokens com light revertido para a paleta original. **Não é prematuro.**

Porém **não é "RC agora"** por causa de **B1 (`Alert.alert` no-op na web)**, que quebra confirmações e feedback de erro em fluxos reais (moderação de avisos, membros, export) no alvo web — um dos alvos de deploy. Somado a **M4** (risco de modo DEV em produção) e ao gate de lint inoperante (**M2**), o RC deve aguardar:

1. Correção de B1/M1 (wrapper de Alert) + smoke test web;
2. Confirmação das env vars de produção (M4);
3. Validação visual light/dark das telas com hardcoded (M5);
4. Decisão sobre o gate de lint (M2).

Resolvidos esses itens, o frontend está apto a **Release Candidate** e à documentação final.

---

### Anexo — Próximo passo sugerido
Aprovar o conjunto **B1 + M4 + M5 + M2** como escopo de estabilização RC. Posso, no próximo ciclo, implementar o wrapper de `Alert` (correção mínima e isolada) e produzir um checklist de smoke test web/mobile. Nada será alterado sem aprovação explícita.
