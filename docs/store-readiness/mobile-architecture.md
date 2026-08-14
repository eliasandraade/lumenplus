# Lumen+ Mobile — Arquitetura Real (auditoria para publicação nas lojas)

> ## ⚠️ ATUALIZAÇÃO — pontos superados
>
> Documento levantado com o app em **Expo SDK 52**. Desde então, na branch
> `mobile/upgrade-expo-store-toolchain` (PR #34): **Expo 54.0.36 / React Native
> 0.81.5 / React 19.1.0 / expo-router 6.0.24**.
>
> Também superado neste documento:
>
> - "scaffold Flutter em `ios/` e `android/`" — removido; `expo prebuild` gera os projetos nativos.
> - "não está pronto para build nativo de loja" — o Android **compila em release**; APK e AAB gerados e auditados com `aapt2` e `bundletool`.
> - `@vercel/analytics` — **removido** do `package.json`, junto com os dois componentes stub que retornavam `null`. A conclusão de "dependência morta / nenhum analytics ativo" estava correta e a ação foi executada.
>
> **iOS continua NÃO compilado.** O Expo não gera o projeto iOS no Windows; a
> verificação depende do job `macos-26` do CI.
>
> O texto original e preservado como registro da auditoria de 2026-08-06.

- **Data da auditoria:** 2026-08-06
- **Escopo:** `lumen_mobile/` no branch `main` (commit `7db785d`)
- **Método:** leitura direta de arquivos-fonte + `git ls-files` + execução do script de validação de assets já existente no repo. Nenhum arquivo de código foi alterado.
- **Convenção:** cada afirmação é marcada como **[COMPROVADO]** (li no arquivo citado) ou **[INFERIDO]** (dedução a partir da evidência). O que não pôde ser determinado está marcado como **NÃO DETERMINADO**.
- **Revisão adversarial (2026-08-06):** este documento passou por uma segunda passagem de verificação linha-a-linha contra o código. As correções aplicadas estão consolidadas em **§17**. Achados estruturais sobreviveram; erros de citação e duas afirmações factualmente incorretas foram corrigidos no corpo do texto.

---

## 0. Sumário executivo

O `lumen_mobile/` **é um projeto Expo SDK 52 em managed workflow**, mas **não está pronto para build nativo de loja**. Três achados dominam o quadro:

1. As pastas `android/` e `ios/` commitadas **não são prebuild do Expo — são scaffolding do Flutter** (arquivos `Runner.xcodeproj`, `FlutterAppDelegate`, `dev.flutter.flutter-gradle-plugin`, `applicationId = com.example.lumen_mobile`). Também são leftovers Flutter as pastas `web/` (index.html com `flutter_bootstrap.js`) e `web/manifest.json` ("A new Flutter project"). Isso quebra o EAS Build, que detecta essas pastas e assume bare workflow.
2. O app hoje é **entregue como SPA web** (Railway/Vercel), não como app de loja. `npm start` = `node server.js`; CI só roda `expo export --platform web`. Nunca houve build EAS em CI.
3. Vários subsistemas são **web-only** e não funcionam em iOS/Android nativo: push (Service Worker + VAPID), Sentry (`@sentry/react`, SDK web), analytics (stub que retorna `null`).

Além disso os assets de loja estão em 192×192 (requerido 1024×1024), e `expo-secure-store` é declarado como plugin mas nunca usado — tokens e preferências ficam em AsyncStorage não criptografado.

**Resultado da revisão adversarial:** os três achados dominantes acima **sobreviveram integralmente à verificação**, assim como todos os blockers B1–B8, B10, B11, B16–B18. Foram corrigidos: uma afirmação factualmente falsa (B13 — a rota `(auth)/index` **não** está morta), uma omissão de evidência material (B9 — `api.lumenplus.app` **consta** do CSP), a contagem de rotas (61 → 63), um item que estava "NÃO DETERMINADO" e é na verdade determinável e **pior** que o suposto (B14 — são 5 rotas fantasma, não 1), e ~20 âncoras `arquivo:linha` erradas. Detalhamento em **§17**.

---

## 1. Workflow: managed vs prebuild vs bare

| Pergunta | Resposta | Evidência | Status |
|---|---|---|---|
| Existe `android/` e `ios/` commitados? | Sim — 19 arquivos em `android/`, 39 em `ios/` | `git ls-files lumen_mobile/android \| wc -l` → 19; `lumen_mobile/ios` → 39 | COMPROVADO |
| Estão no `.gitignore`? | **Não.** Nem no `.gitignore` raiz nem em `lumen_mobile/.gitignore` | `.gitignore:1-80` (seção EXPO/REACT NATIVE ignora só `.expo/` e `web-build/`); `lumen_mobile/.gitignore:1-13` | COMPROVADO |
| São prebuild do Expo? | **Não. São scaffolding do Flutter.** | ver tabela abaixo | COMPROVADO |
| Qual o workflow real do código JS? | Managed (Expo Router + `expo export`) | `package.json:4` (`"main": "expo-router/entry"`), `package.json:12` (`"build": "expo export --platform web"`) | COMPROVADO |

### 1.1 Prova de que `android/` e `ios/` são Flutter, não Expo

| Arquivo:linha | Conteúdo que prova | Implicação |
|---|---|---|
| `lumen_mobile/android/app/build.gradle.kts:5` | `id("dev.flutter.flutter-gradle-plugin")` | plugin Gradle do Flutter |
| `lumen_mobile/android/app/build.gradle.kts:9` | `namespace = "com.example.lumen_mobile"` | namespace placeholder, ≠ `com.lumenchristi.lumenplus` |
| `lumen_mobile/android/app/build.gradle.kts:24` | `applicationId = "com.example.lumen_mobile"` | **package errado** — não é o package declarado em `app.json:25` |
| `lumen_mobile/android/app/build.gradle.kts:23` | `// TODO: Specify your own unique Application ID` | TODO original do template Flutter, nunca resolvido |
| `lumen_mobile/android/app/build.gradle.kts:33-39` | `release { signingConfig = signingConfigs.getByName("debug") }` (linha 37) | release assinado com chave de debug |
| `lumen_mobile/android/app/build.gradle.kts:42-44` | `flutter { source = "../.." }` | aponta para raiz Flutter inexistente |
| `lumen_mobile/android/settings.gradle.kts:2-9` | exige `flutter.sdk` em `local.properties` (linha 7: `require(flutterSdkPath != null)`) | build falha sem SDK Flutter |
| `lumen_mobile/android/app/src/main/kotlin/com/example/lumen_mobile/MainActivity.kt:3-5` | `class MainActivity : FlutterActivity()` | Activity do Flutter |
| `lumen_mobile/android/app/src/main/AndroidManifest.xml:3` | `android:label="lumen_mobile"` | label placeholder |
| `lumen_mobile/android/app/src/main/AndroidManifest.xml:30-32` | `<meta-data android:name="flutterEmbedding" android:value="2" />` | embedding Flutter v2 |
| `lumen_mobile/ios/Runner/AppDelegate.swift:1-5` | `import Flutter` / `class AppDelegate: FlutterAppDelegate` | AppDelegate do Flutter |
| `lumen_mobile/ios/` (estrutura) | `Flutter/`, `Runner.xcodeproj`, `Runner.xcworkspace`, `RunnerTests/` | projeto Xcode gerado pelo `flutter create` |
| `lumen_mobile/web/index.html:17,36` | `<base href="$FLUTTER_BASE_HREF">` e `<script src="flutter_bootstrap.js">` | shell HTML do Flutter |
| `lumen_mobile/web/manifest.json:2,8` | `"name": "lumen_mobile"`, `"description": "A new Flutter project."` | manifest do template Flutter |

> **Correção da revisão adversarial:** `lumen_mobile/web/` tem **7 arquivos versionados**, não 2 — `index.html`, `manifest.json`, `favicon.png` e `icons/Icon-{192,512}.png` + `icons/Icon-maskable-{192,512}.png` (todos ativos do template Flutter). `git ls-files lumen_mobile/web`. **[COMPROVADO]**

Histórico: essas pastas entraram no repo no commit inicial e não foram tocadas desde — `git log --oneline -- lumen_mobile/android lumen_mobile/ios` → `41ef0f3` e `4aac3f0 Initial commit (clean slate)`. **[COMPROVADO]**

**Consequência prática [INFERIDO, mas com alta confiança]:** ao rodar `eas build -p android` ou `-p ios`, o EAS detecta as pastas nativas e escolhe o fluxo bare/local — resultado será falha de build (Gradle exige `flutter.sdk`) ou, na melhor hipótese, um binário com `applicationId = com.example.lumen_mobile`. A `app.json` (`ios.bundleIdentifier` / `android.package` = `com.lumenchristi.lumenplus`) **não será respeitada** enquanto essas pastas existirem. Isso é um blocker de publicação.

> Nota: `dist/index.html` (build web gerado) tem `<title>Lumen+</title>` e `<div id="root">` do Expo, **não** o shell Flutter — ou seja, o `web/index.html` já é código morto para o build atual. (`lumen_mobile/dist/index.html:7,29`)
>
> **Ressalva da revisão adversarial:** `dist/` **não é versionado** — está coberto por `.gitignore:52` (`dist/`) e `git ls-files lumen_mobile/dist` retorna **0 arquivos**. A evidência acima vem de um build local presente na máquina do auditor, não do repositório. A conclusão (o Expo gera o próprio `index.html` e ignora `web/`) continua válida por construção do `expo export`, mas o rótulo correto é **[INFERIDO a partir de artefato local não versionado]**, não [COMPROVADO no repo].

---

## 2. Versões (as instaladas em `node_modules`, não só as declaradas)

| Item | Declarado (`package.json`) | Instalado (`node_modules/*/package.json`) | Status |
|---|---|---|---|
| Expo SDK | `~52.0.0` (`package.json:24`) | **52.0.48** | COMPROVADO |
| React Native | `0.76.9` (`package.json:40`) | **0.76.9** | COMPROVADO |
| React | `18.3.1` (`package.json:38`) | **18.3.1** | COMPROVADO |
| TypeScript | `~5.3.3` (`package.json:60`) | **5.3.3** | COMPROVADO |
| expo-router | `~4.0.0` (`package.json:32`) | **4.0.22** | COMPROVADO |
| Firebase JS SDK | `^10.7.1` (`package.json:37`) | **10.14.1** | COMPROVADO |
| Sentry | `@sentry/react ^10.45.0` (`package.json:21`) | **10.45.0** (SDK **web**) | COMPROVADO |
| TanStack Query | `^5.17.0` (`package.json:22`) | 5.90.20 | COMPROVADO |
| Zustand | `^4.4.7` (`package.json:48`) | 4.5.7 | COMPROVADO |
| New Architecture | `"newArchEnabled": true` (`app.json:10`) | — | COMPROVADO |
| Reanimated | `~3.16.1` (`package.json:42`) + plugin Babel (`babel.config.js:6`) | — | COMPROVADO |

> **Correção da revisão adversarial:** todas as referências `package.json:<linha>` da versão anterior deste documento estavam erradas (deslocamento de 1 a 6 linhas — ex.: Sentry citado em `:15`, que na verdade é a abertura do bloco `"dependencies": {`). Os **valores** conferidos estavam corretos; apenas as âncoras de linha foram corrigidas acima. O mesmo deslocamento foi corrigido nas demais seções (`expo-secure-store` → `package.json:33`, `expo-linking` → `:31`, `expo-web-browser` → `:36`, `@vercel/analytics` → `:23`, `expo-file-system` → `:28`, `expo-auth-session` → `:26`).

---

## 3. Roteamento — expo-router file-based

**[COMPROVADO]** Roteamento é 100% file-based via expo-router 4. Entry point: `package.json:4` → `expo-router/entry`. Plugin declarado em `app.json:28`. `typedRoutes: true` em `app.json:31-33`.

Stack raiz declara os grupos em `app/_layout.tsx:127-138`.

### 3.1 Inventário completo de rotas (63 arquivos em `app/`)

> **Correção da revisão adversarial:** a contagem anterior dizia **61**. `find app -type f` retorna **63** (todos `.tsx`; não há arquivos não-`.tsx` dentro de `app/`). Número corrigido aqui e no rodapé da seção.

#### Raiz
| Rota | Arquivo | Função | Notas |
|---|---|---|---|
| `/` | `app/index.tsx` | Splash/redirect: logado → `/(tabs)/home`, senão → `/(auth)/login` | `app/index.tsx:41-45` |
| — | `app/_layout.tsx` | Stack raiz: Sentry.init, QueryClientProvider, ThemeProvider, UnlockedCyclesProvider, SafeAreaProvider, fontes Nunito, splash | 180 linhas |
| `/members` | `app/members.tsx` | Gestão de membros de uma unidade organizacional (convidar/promover/remover) | — |

#### `(auth)` — 5 arquivos
| Rota | Arquivo | Função |
|---|---|---|
| — | `app/(auth)/_layout.tsx` | Layout de auth |
| `/(auth)` | `app/(auth)/index.tsx` | **Rota VIVA e funcional** — `export default function AuthIndex()` retorna `<Redirect href="/(auth)/login" />` (`app/(auth)/index.tsx:172-176`). Precedida por **164 linhas de código morto comentado** (`:1-164`), a antiga "Welcome Screen". |
| `/(auth)/login` | `app/(auth)/login.tsx` | Login (Firebase) |
| `/(auth)/register` | `app/(auth)/register.tsx` | Cadastro em 4 passos |
| `/(auth)/verify-email` | `app/(auth)/verify-email.tsx` | Verificação de e-mail por token |
| `/(auth)/verify-phone` | `app/(auth)/verify-phone.tsx` | Verificação de telefone (WhatsApp/SMS) |

#### `(onboarding)` — 5 telas
| Rota | Arquivo | Função |
|---|---|---|
| — | `app/(onboarding)/_layout.tsx` | Layout |
| `/(onboarding)/terms` | `terms.tsx` | Aceite de Termos e Privacidade (LGPD) |
| `/(onboarding)/profile` | `profile.tsx` | Formulário completo de perfil — usa ImagePicker (galeria + câmera) |
| `/(onboarding)/complete-documents` | `complete-documents.tsx` | CPF e RG pendentes |
| `/(onboarding)/profile-update` | `profile-update.tsx` | Gate semestral de revisão de dados |
| `/(onboarding)/verify-phone` | `verify-phone.tsx` | Verificação de telefone (duplicada de `(auth)`) |

#### `(tabs)` — 5 abas
| Rota | Arquivo | Título da aba | Função |
|---|---|---|---|
| — | `app/(tabs)/_layout.tsx` | — | `CustomTabBar`; gate de onboarding (`_layout.tsx:18-39`): termos pendentes → `/terms`; sem documentos → `/complete-documents`; `profile_update_due` → `/profile-update` |
| `/(tabs)/service` | `service.tsx` | Orações | Liturgia diária, Terço, orações fixas |
| `/(tabs)/community` | `community.tsx` | Comunidade | **Bug semântico documentado no próprio arquivo** (`community.tsx:6-9`): a tela chama `inviteService.getMyInvites()`, não é comunidade |
| `/(tabs)/home` | `home.tsx` | Início | Dashboard; renderiza `PushPermissionCard` só se `Platform.OS === 'web'` (`home.tsx:50,170`) |
| `/(tabs)/invites` | `invites.tsx` | Inbox | Avisos/comunicações (30 dias) |
| `/(tabs)/profile` | `profile.tsx` | Perfil | Perfil completo editável |

#### `admin/` — 13 arquivos (área administrativa)
| Rota | Arquivo | Função |
|---|---|---|
| — | `admin/_layout.tsx` | **Guard de role client-side** (`admin/_layout.tsx:16,29-42`): `/auth/me` → exige `DEV`, `ADMIN` ou `ANALISTA`; backend é a barreira real (403) |
| `/admin` | `admin/index.tsx` | Menu administrativo |
| `/admin/dashboard` | `admin/dashboard.tsx` | Métricas de governança |
| `/admin/audit-logs` | `admin/audit-logs.tsx` | Logs de auditoria |
| `/admin/create-aviso` | `admin/create-aviso.tsx` | Criar/enviar avisos |
| `/admin/sent-avisos` | `admin/sent-avisos.tsx` | Histórico de avisos enviados |
| `/admin/approvals` | `admin/approvals/index.tsx` | Fila de aprovação de exportações |
| `/admin/entities` | `admin/entities/index.tsx` (+ `_layout.tsx`) | Estrutura organizacional |
| `/admin/users` | `admin/users/index.tsx` (+ `_layout.tsx`) | Lista de usuários |
| `/admin/users/[id]` | `admin/users/[id].tsx` | Perfil completo com **RG/CPF com toggle de visibilidade** — dado sensível |
| `/admin/users/export` | `admin/users/export.tsx` | Exportação CSV de usuários |
| `/admin/retreats` | `admin/retreats/index.tsx` | Lista de retiros |
| `/admin/retreats/create` | `admin/retreats/create.tsx` | Criar retiro |
| `/admin/retreats/[id]` | `admin/retreats/[id].tsx` | Gestão do retiro: casas, taxas, inscrições, **confirmar/rejeitar pagamento** (`[id].tsx:585-620`) |

#### `biblia/` e `catecismo/` — conteúdo offline
| Rota | Arquivo | Função |
|---|---|---|
| `/biblia` | `biblia/index.tsx` (+ `_layout.tsx`) | 73 livros, Bíblia Ave Maria |
| `/biblia/reader` | `biblia/reader.tsx` | Leitor de capítulo |
| `/catecismo` | `catecismo/index.tsx` (+ `_layout.tsx`) | Catecismo — 3 modos |
| `/catecismo/reader` | `catecismo/reader.tsx` | Leitor de parágrafo |

#### `retreats/` — 4 arquivos
| Rota | Arquivo | Função |
|---|---|---|
| `/retreats` | `retreats/index.tsx` (+ `_layout.tsx`) | Lista de retiros do usuário |
| `/retreats/[id]` | `retreats/[id].tsx` | Detalhe, modalidades, inscrição/cancelamento |
| `/retreats/[id]/payment` | `retreats/[id]/payment.tsx` | **Upload de comprovante de pagamento** (foto/galeria) |

#### `vida/` — Projeto de Vida (11 arquivos)
| Rota | Arquivo | Função |
|---|---|---|
| `/vida` | `vida/index.tsx` (+ `_layout.tsx`) | Hub |
| `/vida/wizard` | `vida/wizard.tsx` | Wizard de 11 passos (inclui definição de PIN) |
| `/vida/ciclo` | `vida/ciclo.tsx` | Visualização do ciclo mensal |
| `/vida/semanal` | `vida/semanal.tsx` | Wizard semanal de 4 passos |
| `/vida/semanal-view` | `vida/semanal-view.tsx` | Visualização do semanal |
| `/vida/diario` | `vida/diario.tsx` | "Amanhã com o Emanuel" — preparação do dia |
| `/vida/exame` | `vida/exame.tsx` | Exame de consciência |
| `/vida/revisao` | `vida/revisao.tsx` | Revisão mensal (3 passos) |
| `/vida/historico` | `vida/historico.tsx` | Histórico de ciclos |
| `/vida/unlock` | `vida/unlock.tsx` | Desbloqueio por PIN |

#### `channel/` e `coordinator/`
| Rota | Arquivo | Função |
|---|---|---|
| `/channel/[unitId]` | `channel/[unitId].tsx` (+ `_layout.tsx`) | **Canal da unidade — conteúdo gerado por usuário** (posts + respostas) |
| `/channel/components` | `channel/components.tsx` | Arquivo de componentes auxiliares **que o expo-router registra como rota** — confirmado na revisão adversarial (ver §11.5). Sem `export default` → rota quebrada. |
| `/coordinator` | `coordinator/index.tsx` (+ `_layout.tsx`) | Painel do coordenador |

**Total: 63 arquivos `.tsx` em `app/`** (contagem via `find app -type f` → 63). **[COMPROVADO]**

---

## 4. Estado, data fetching, storage, cache, offline

| Área | Implementação real | Evidência | Observação |
|---|---|---|---|
| Estado global | **Zustand** — `authStore` e `onboardingStore` | `src/stores/authStore.ts:32` (`create<AuthState>`) | COMPROVADO |
| Data fetching | **`fetch` nativo** encapsulado em classe `ApiClient` — sem axios | `src/services/api.ts:47-171` | COMPROVADO |
| TanStack Query | Instalado e Provider montado, **mas `useQuery`/`useMutation` não são usados em lugar nenhum** | `app/_layout.tsx:41-48,169`; grep por `useQuery\|useMutation` em `app/` e `src/` → **0 resultados, em nenhum arquivo**. O único vestígio do pacote é o import de `QueryClient, QueryClientProvider` em `app/_layout.tsx:11` | COMPROVADO — dependência morta |
| Cache | `staleTime: 60s`, `retry: 2` configurados no QueryClient, mas sem consumidores | `app/_layout.tsx:42-47` | COMPROVADO |
| Offline (rede) | **Nenhum** — sem persister de query, sem detecção de conectividade, sem fila offline | ausência de `@tanstack/react-query-persist-client`, `NetInfo`, `expo-network` em `package.json` | COMPROVADO (por ausência) |
| Offline (conteúdo) | Bíblia e Catecismo são **bundled** e funcionam offline | `src/services/bible.ts:9` (`require('../../assets/biblia.json')`), `src/services/catecismo.ts:9` | COMPROVADO |
| Peso do bundle offline | `assets/biblia.json` **5.442.856 B (5,19 MiB)** + `assets/catecismo.json` **1.885.846 B (1,80 MiB)** = **~7,0 MiB / 7,33 MB** carregados **sincronamente** no import | `ls -la assets/` | COMPROVADO — impacto direto no tamanho do IPA/AAB e no tempo de startup |
| Storage de token | **AsyncStorage** (não criptografado) | `src/services/api.ts:13` (`DEV_TOKEN_KEY = 'lumen_dev_token'`) + helpers em `:18-27` | COMPROVADO |
| Persistência Firebase Auth | `getReactNativePersistence(AsyncStorage)` em nativo; `getAuth` na web | `src/config/firebase.ts:49-60` | COMPROVADO |
| Preferência de tema | AsyncStorage (`lumen_theme_preference`) | `src/theme/ThemeContext.tsx:16` (`THEME_STORAGE_KEY`) | COMPROVADO |
| Decisão de push | AsyncStorage (`lumen_push_decision`) | `src/services/push.ts:6,9,13` | COMPROVADO |
| **SecureStore** | Declarado como plugin (`app.json:29`) e dependência (`package.json:33`), **nunca importado em nenhum arquivo de `app/` ou `src/`** | grep por `expo-secure-store\|SecureStore` em `app/` e `src/` → **0 resultados** | COMPROVADO — plugin sem uso; tokens ficam em storage não criptografado |
| PIN do Projeto de Vida | Verificado **no backend** (`POST /projeto-vida-mensal/{id}/pin/verificar`); estado de desbloqueio só em memória com TTL 15 min, limpo ao voltar do background | `src/services/projetoVidaMensal.ts:316-317`; `src/contexts/UnlockedCyclesContext.tsx:4,24-37` | COMPROVADO — desenho correto |

### 4.1 Base URL da API

`src/services/api.ts:32-45`:
1. `EXPO_PUBLIC_API_URL` se definida (dev ou prod);
2. senão, se `!__DEV__` → `https://api.lumenplus.app` **(hardcoded)**;
3. senão Android → `http://10.0.2.2:8000`; demais → `http://localhost:8000`.

**Risco [INFERIDO]:** um build de loja sem `EXPO_PUBLIC_API_URL` aponta para `https://api.lumenplus.app`, cuja existência/resolução **NÃO FOI DETERMINADA** nesta auditoria (não há verificação de rede no escopo read-only de código).

> **Correção da revisão adversarial — evidência omitida na versão anterior:** era falso afirmar que `api.lumenplus.app` "não aparece em nenhuma outra config". O `connect-src` do CSP em `lumen_mobile/vercel.json:17` **lista explicitamente `https://api.lumenplus.app`**, lado a lado com `https://backend-production-6efc.up.railway.app` e `https://backend-staging-staging-3d47.up.railway.app`. Ou seja: o domínio é um **destino de produção intencional e pré-autorizado**, não uma string órfã ou typo. Isso **reduz** a hipótese de erro de digitação e **muda a natureza do risco**: não é "fallback aponta para lugar nenhum", é "fallback aponta para um domínio planejado cuja provisão ainda não foi confirmada". Severidade reclassificada de **Crítico → Alto** (ver B9).

Os três hosts efetivamente referenciados no repo:
| Host | Onde aparece | Papel |
|---|---|---|
| `https://backend-staging-staging-3d47.up.railway.app` | `.github/workflows/build.yml:40`, `.github/workflows/ci.yml:39`, CSP `vercel.json:17` | staging (usado pelo CI) |
| `https://backend-production-6efc.up.railway.app` | CSP `vercel.json:17` | produção Railway |
| `https://api.lumenplus.app` | `src/services/api.ts:38` (fallback), CSP `vercel.json:17` | domínio próprio pretendido — **provisão não confirmada** |

---

## 5. Firebase

| Item | Situação | Evidência |
|---|---|---|
| SDK | **Firebase JS SDK v10** (`firebase` npm), **não** `@react-native-firebase/*` | `package.json:35`; `src/config/firebase.ts:15-16` |
| Serviços usados | **Apenas Auth** (`firebase/app` + `firebase/auth`) | `src/config/firebase.ts:15-16`; único outro import de firebase é `signOut` em `src/services/api.ts:10` |
| Firestore / Storage / FCM / Analytics | **Não usados** | grep — nenhum import de `firebase/firestore`, `firebase/storage`, `firebase/messaging`, `firebase/analytics` |
| `google-services.json` / `GoogleService-Info.plist` | **Ausentes do repo** | `git ls-files lumen_mobile` não lista nenhum dos dois |
| Config via env | 7 vars `EXPO_PUBLIC_FIREBASE_*` | `src/config/firebase.ts:38-44`; `.env.example:6-12` |
| Modo DEV mock | `IS_DEV_AUTH = !EXPO_PUBLIC_FIREBASE_API_KEY` → auth mock | `src/config/firebase.ts:19,30-34,65-67` |
| Trava de produção | `MISCONFIGURED = !__DEV__ && IS_DEV_AUTH` → tela `ConfigError` bloqueia o app | `src/config/firebase.ts:27`; `app/_layout.tsx:165` |

**Implicação para lojas [INFERIDO]:** por usar o SDK JS (não nativo), **não há dependência de `google-services.json`/`GoogleService-Info.plist`** para o Auth funcionar — o que simplifica o build. Em contrapartida, **não há FCM/APNs**, logo não existe caminho de push nativo (ver §6).

**Nenhum secret hardcoded foi encontrado** em `app/`, `src/`, `public/`, `web/`, `*.js`, `*.json` do `lumen_mobile/` (busca por padrões `AIza…`, `sk_live`, `sk_test`, `-----BEGIN`, JWT). O arquivo `lumen_mobile/.env.local` existe no disco mas **não está versionado** — confirmado por `git ls-files` (só `.env.example` aparece) e por `git check-ignore` (`lumen_mobile/.gitignore:10`). Seu conteúdo não foi lido nem reproduzido.

---

## 6. Push notifications

| Item | Situação | Evidência |
|---|---|---|
| `expo-notifications` | **Não instalado, não usado** | ausente de `package.json`; grep em `app/`+`src/` → 0 |
| FCM / APNs | **Não configurados** | sem `@react-native-firebase/messaging`, sem `google-services.json`, sem entitlement de push em `app.json` |
| Implementação real | **Web Push (Service Worker + VAPID)** — `navigator.serviceWorker.register('/sw.js')` + `pushManager.subscribe` | `src/services/push.ts:16-51` |
| Guard de plataforma | `if (!('serviceWorker' in navigator) \|\| !('PushManager' in window)) return false` | `src/services/push.ts:17-19` |
| Chave VAPID | Obtida do backend em `GET /push/vapid-public-key` | `src/services/push.ts:23` |
| Registro no backend | `POST /push/subscribe` com `endpoint`, `p256dh`, `auth`, `user_agent` | `src/services/push.ts:42-47` |
| Service Worker | `lumen_mobile/public/sw.js` — handlers `push` e `notificationclick` | `public/sw.js:2,16` |
| UI de consentimento | `PushPermissionCard`, renderizado **apenas na web** | `app/(tabs)/home.tsx:50` (`if (Platform.OS !== 'web') return;`) e `:170` |

**Conclusão [COMPROVADO]: em builds iOS/Android nativos, o app não tem notificações push de espécie alguma.** Qualquer promessa de "avisos/notificações" na descrição de loja seria falsa para o binário nativo. Se push nativo for requisito de lançamento, é trabalho novo (instalar `expo-notifications`, configurar FCM + APNs key, adicionar endpoint de token no backend).

---

## 7. Observabilidade e analytics

| Item | Situação | Evidência | Problema |
|---|---|---|---|
| Sentry | `@sentry/react` **10.45.0 — SDK de browser** | `package.json:15`; `app/_layout.tsx:8,29-39` | **Não é `@sentry/react-native`.** Sem captura de crash nativo, sem symbolication de stack traces nativos, sem sessão/ANR. Em RN nativo o funcionamento é parcial/não suportado. **[INFERIDO com alta confiança]** |
| Sentry config | `sendDefaultPii: false`, `tracesSampleRate: 0.1`, `enabled: !!DSN` | `app/_layout.tsx:34,36,38` | Bom para LGPD |
| ErrorBoundary | `Sentry.ErrorBoundary` com fallback `CrashFallback` | `app/_layout.tsx:168` | COMPROVADO |
| Drift de documentação | `lumen_mobile/README.md:13` diz **"Sentry React Native"** — falso | `README.md:13` | Doc incorreta |
| Vercel Analytics | `@vercel/analytics` na `package.json:17`, mas **ambos os componentes retornam `null`** | `src/components/VercelAnalytics.tsx:2-4`; `src/components/VercelAnalytics.web.tsx:3-5` | Dependência morta; **nenhum analytics ativo em nenhuma plataforma** |
| Console logs | `no-console: 'warn'` — CI não bloqueia | `.eslintrc.js:18` | — |

---

## 8. Deep links, scheme, universal links, app links

| Item | Situação | Evidência |
|---|---|---|
| URL scheme | `"scheme": "lumenplus"` declarado | `app.json:8` |
| Uso do scheme no código | **Nenhum** — grep por `lumenplus://` em `app/`, `src/`, `app.json`, `web/`, `public/` → 0 resultados | COMPROVADO |
| `expo-linking` | Instalado (`package.json:30`) mas **nunca importado** em `app/` ou `src/` | COMPROVADO |
| Universal Links (iOS) | **Não configurado** — sem `ios.associatedDomains` em `app.json` | `app.json:16-19` |
| App Links (Android) | **Não configurado** — sem `android.intentFilters` em `app.json` | `app.json:20-26` |
| `apple-app-site-association` / `assetlinks.json` | **Ausentes** — `public/` contém só `sw.js` | `ls public/` |
| `Linking.openURL` | Usado em 2 pontos (export de retiro e abrir comprovante) — saída para o browser, não entrada | `app/admin/retreats/[id].tsx:718,1046` |
| `expo-auth-session` / `expo-web-browser` | Instalados (`package.json:26,34`) mas **nunca importados** | COMPROVADO |

**Conclusão:** existe scheme declarado, mas **nenhum handler de deep link implementado**. Fluxos que tipicamente precisam disso (verificação de e-mail, reset de senha, convite por link) hoje não têm caminho de retorno para o app nativo. **[INFERIDO]**

---

## 9. Capacidades de dispositivo

| Capacidade | Usada? | Evidência | Permissão declarada em `app.json`? |
|---|---|---|---|
| Galeria de fotos | **Sim** — `ImagePicker.launchImageLibraryAsync` | `app/(onboarding)/profile.tsx:316`; `app/retreats/[id]/payment.tsx:41` | **Não** — sem `NSPhotoLibraryUsageDescription` |
| Câmera | **Sim** — `ImagePicker.launchCameraAsync` | `app/(onboarding)/profile.tsx:331`; `app/retreats/[id]/payment.tsx:58` | **Não** — sem `NSCameraUsageDescription` |
| Solicitação de permissão em runtime | Sim, ambas | `profile.tsx:311,326`; `payment.tsx:36,53` | — |
| Config plugin do image-picker | **Ausente** de `app.json:27-30` | `app.json` lista só `expo-router` e `expo-secure-store` | **Blocker iOS** |
| Upload | `multipart/form-data` via `postForm`, com branch web (Blob) e nativo (`{uri,name,type}`) | `src/services/api.ts:150-167`; `app/retreats/[id]/payment.tsx:73-90` | — |
| Localização | **Não** — sem `expo-location` | grep → 0 | — |
| Biometria | **Não** — sem `expo-local-authentication` | grep → 0 | — |
| Background tasks | **Não** — sem `expo-task-manager`/`expo-background-fetch` | grep → 0 | — |
| WebView | **Não** — sem `react-native-webview`, sem `<iframe>` | grep → 0 | — |
| Arquivos | `expo-file-system` instalado (`package.json:28`) mas **nunca importado** | grep → 0 | — |
| Áudio/vídeo | Não | sem `expo-av` | — |

**Blocker de submissão iOS [COMPROVADO por ausência]:** o app chama câmera e galeria mas `app.json` **não declara** `ios.infoPlist.NSCameraUsageDescription` nem `NSPhotoLibraryUsageDescription`, e o config plugin `expo-image-picker` não está na lista de plugins. App Store Review rejeita binários que acessam câmera/fotos sem purpose string.

---

## 10. Pagamentos e conteúdo gerado por usuário (UGC)

### 10.1 Pagamentos
| Item | Situação | Evidência |
|---|---|---|
| IAP / StoreKit / Google Play Billing | **Não existe** | sem `expo-in-app-purchases`, `react-native-iap`, `react-native-purchases` (RevenueCat) em `package.json` |
| Stripe / gateway | **Não existe** | grep por `stripe` em `app/`+`src/` → 0 |
| Fluxo real | Pagamento de retiro **fora do app** (Pix/transferência) + **upload de comprovante** + confirmação manual por admin | `app/retreats/[id]/payment.tsx:119` ("Tire uma foto ou selecione da galeria o comprovante do pagamento (Pix, transferência, etc.)"); `app/admin/retreats/[id].tsx:586-620` (`handleConfirmPayment` / `handleRejectPayment`) |
| Estados | `PENDING_PAYMENT` → `PAYMENT_SUBMITTED` → confirmado/rejeitado | `app/retreats/index.tsx:38-39`; `app/admin/retreats/[id].tsx:31-32` |

**Nota de política de loja [INFERIDO — requer decisão humana/jurídica]:** retiros são bens/serviços do mundo físico, o que normalmente os coloca fora da obrigatoriedade de IAP (Apple 3.1.3 / Google Play). Mas o app **exibe instrução de pagamento externo e coleta comprovante dentro do app**, o que historicamente atrai escrutínio da revisão. Isso não é um veredito jurídico — é um ponto que precisa de decisão explícita antes da submissão.

### 10.2 UGC
| Item | Situação | Evidência |
|---|---|---|
| Existe UGC? | **Sim** — canal por unidade com posts e respostas | `src/services/channel.ts:18-41` (`ChannelPost`, `ChannelReply`); `app/channel/[unitId].tsx` |
| Quem posta | Controlado por `channel_post_mode`: `COORDINATOR_ONLY` ou `ALL_MEMBERS` | `src/services/channel.ts:5,45` |
| Moderação | Existe flag `can_moderate` — moderador pode editar/excluir posts e respostas | `src/services/channel.ts:47`; `app/channel/[unitId].tsx:365,484,503,573`; `app/channel/components.tsx:185,296` |
| Soft delete | `is_deleted` em post e reply | `src/services/channel.ts:15,31` |
| **Denunciar conteúdo** | **Não existe** | grep por `denunc\|report\|reportar` em `app/`+`src/` → 0 resultados relevantes |
| **Bloquear usuário** | **Não existe** | grep por `bloquear\|block_user\|blockUser` → 0 resultados relevantes |
| EULA / termos anti-abuso | Existe aceite de termos em `app/(onboarding)/terms.tsx`; o **conteúdo** dos termos não foi auditado aqui | — |

**Blocker de submissão iOS [COMPROVADO por ausência]:** App Store Guideline 1.2 (UGC) exige, cumulativamente: filtro de conteúdo ofensivo, **mecanismo de denúncia**, **mecanismo de bloqueio de usuários abusivos**, e contato de suporte publicado. O app tem apenas moderação por coordenador. **Faltam denúncia e bloqueio.** Google Play tem exigência equivalente (Política de UGC).

---

## 11. Módulos nativos e config plugins

### 11.1 Config plugins declarados (`app.json:27-30`)
| Plugin | Situação |
|---|---|
| `expo-router` | Usado — COMPROVADO |
| `expo-secure-store` | **Declarado mas o módulo nunca é importado** — plugin inútil |

### 11.2 Plugins que deveriam estar e não estão
| Módulo instalado | Precisa de plugin/permissão | Declarado? |
|---|---|---|
| `expo-image-picker` | `NSCameraUsageDescription`, `NSPhotoLibraryUsageDescription`, `CAMERA`/`READ_MEDIA_IMAGES` | **Não** |
| `expo-splash-screen` | plugin recomendado no SDK 52 | **Não** (usa a chave legada `splash` em `app.json:11-15`) |
| `expo-font` | plugin opcional (fontes carregadas em runtime via `useFonts`) | Não — aceitável (`app/_layout.tsx:145-151`) |

### 11.3 Dependências instaladas e **não utilizadas** (candidatas a remoção)

> **Correção da revisão adversarial:** a versão anterior afirmava que **todas** estavam "ausentes de qualquer `import` em `app/` ou `src/`" — falso para `@tanstack/react-query` e enganoso para `serve`. Lista reclassificada:

| Pacote | Situação real | Evidência |
|---|---|---|
| `expo-secure-store` (`package.json:33`) | **0 imports** | grep `expo-secure-store\|SecureStore` → 0 |
| `expo-linking` (`:31`) | **0 imports** | grep → 0 |
| `expo-auth-session` (`:26`) | **0 imports** | grep → 0 |
| `expo-web-browser` (`:36`) | **0 imports** | grep → 0 |
| `expo-file-system` (`:28`) | **0 imports** | grep → 0 |
| `expo-asset` (`:25`) | **0 imports** | grep → 0 |
| `expo-constants` (`:27`) | **0 imports** | grep → 0 |
| `@vercel/analytics` (`:23`) | **0 imports do pacote npm** — o componente local `@/components/VercelAnalytics` é importado em `app/_layout.tsx:14`, mas ambas as implementações são stubs que retornam `null` | grep `@vercel/analytics` em `app/`+`src/` → 0 |
| `@tanstack/react-query` (`:22`) | **IMPORTADO** em `app/_layout.tsx:11` (`QueryClient, QueryClientProvider`) — o Provider é montado de verdade. O que não existe é consumo (`useQuery`/`useMutation` → 0) | `app/_layout.tsx:11,41-48,169` |
| `serve` (`:46`) | Binário de CLI, **nunca importável por design** — listá-lo como "sem import" era categoria errada. Ainda assim é redundante: o serving em produção é feito por `server.js` próprio, e nenhum script do `package.json` invoca `serve` | `package.json:5-13` |

**[COMPROVADO]**

### 11.4 Módulos nativos efetivamente exercitados
`react-native-reanimated` (`babel.config.js:6` + 5 arquivos em `src/`), `react-native-screens`, `react-native-safe-area-context`, `react-native-gesture-handler` (transitivo via expo-router), `@react-native-async-storage/async-storage`, `@react-native-picker/picker` (`app/(onboarding)/profile.tsx:34`), `expo-image-picker`, `expo-font`, `expo-splash-screen`. **[COMPROVADO]**

### 11.5 Rotas fantasma — **RESOLVIDO na revisão adversarial (era NÃO DETERMINADO)**

A versão anterior deixou em aberto se `app/channel/components.tsx` vira rota. **O artefato gerado `.expo/types/router.d.ts` responde: sim.**

**[COMPROVADO]** `.expo/types/router.d.ts:9-11` lista `/channel/components` entre os `pathname` tipados válidos (`{ pathname: \`/channel/components\`; params?: Router.UnknownInputParams; }`). O arquivo exporta **apenas nomeados** (`AvatarInitial`, `StatusBadge`, `AuthorRow`, `SectionHeader`, `EmptyFeed`, `ChannelSkeleton`, `ReplyItem`, `HighlightCard`, `PostCard` + 2 types) e **nenhum `export default`** — logo a rota existe no grafo mas não renderiza tela.

**Achado NOVO que a auditoria anterior não capturou:** o mesmo `router.d.ts` registra **mais quatro rotas que escapam de `app/`**:

| Rota tipada gerada | Módulo real | `export default`? |
|---|---|---|
| `/../src/data/conteudoVocacional` | `src/data/conteudoVocacional.ts` | **não** |
| `/../src/contexts/UnlockedCyclesContext` | `src/contexts/UnlockedCyclesContext.tsx` | **não** |
| `/../src/components/ui/HorarioInput` | `src/components/ui/HorarioInput.tsx` | **não** |
| `/../src/components/ui/CalendarPicker` | `src/components/ui/CalendarPicker.tsx` | **não** |

São **5 rotas fantasma** no total, não 1. Nenhuma delas tem componente default; todas são poluição do `_sitemap` e do grafo de navegação tipado.

**Ressalvas honestas sobre esta evidência:**
- `.expo/` é **gitignored** (`.gitignore:58`) — `router.d.ts` é artefato local gerado, com data de **2026-06-06** (≈2 meses de defasagem em relação a esta auditoria). Ele reflete o estado do momento da geração, não necessariamente o HEAD atual.
- A rota `/channel/components` **é consistente com o HEAD atual** (o arquivo existe hoje, sem default export), então esse item é sólido.
- O **mecanismo** que produz os caminhos `/../src/...` **NÃO FOI DETERMINADO** — não há symlinks em `app/` (`find app -type l` → vazio) e esses módulos vivem fora de `app/`. Pode ser comportamento do gerador de `typedRoutes` do expo-router 4.0.22 sobre módulos alcançados pelo `require.context`, ou resíduo de um estado anterior da árvore. **Exige `expo start` para regenerar e reconfirmar.**
- Ação recomendada continua a mesma e é barata: renomear `components.tsx` → `+components.tsx` (ou movê-lo para `src/components/channel/`) e regenerar os tipos.

---

## 12. Build, deploy e CI — realidade atual

| Item | Situação | Evidência |
|---|---|---|
| `npm start` | `node server.js` — **serve `dist/` estático**, não inicia Expo | `package.json:6`; `server.js:1-5` |
| `npm run dev` | `expo start` | `package.json:10` |
| `npm run build` | `expo export --platform web` | `package.json:12` |
| CI (`build.yml`) | `tsc --noEmit` → `npm run lint` → `expo export --platform web` com `EXPO_PUBLIC_API_URL` de **staging** | `.github/workflows/build.yml:31-40` |
| **Build EAS em CI** | **Nunca configurado** — nenhum workflow chama `eas build` | `ls .github/workflows` → `build.yml`, `ci.yml`, `discord-log.yml`; nenhum menciona EAS |
| Deploy web | Railway (`railway.toml:1-9`, `node server.js`) e/ou Vercel (`vercel.json`) | COMPROVADO |
| `eas.json` | 3 perfis (development/preview/production); `submit.production` **vazio** | `eas.json:5-31` |
| `extra.eas.projectId` | **Ausente** de `app.json` | `app.json:1-35` |
| `owner` (conta EAS) | **Ausente** de `app.json` | `app.json:1-35` |
| `ios.buildNumber` | **Ausente** (há `autoIncrement: true` em `eas.json:23`, que cobre) | — |
| `android.versionCode` | **Ausente** (idem) | — |
| PWA manifest em produção | `dist/` contém `index.html`, `sw.js`, `_expo/`, `assets/`, `metadata.json` — **sem `manifest.json`** | `ls dist/` |

---

## 13. Assets de loja — reprovados

Execução do script já existente no repo (`node scripts/check-assets.mjs`, exit code **1**):

```
FALHA     assets/icon.png: 192x192 (requerido 1024x1024)
FALHA     assets/adaptive-icon.png: 192x192 (requerido 1024x1024)
FALHA     assets/splash.png: 192x192 (requerido >=1024x1024)
FALTA     assets/favicon.png
4 asset(s) fora de especificacao
```

**[COMPROVADO]** Os três PNGs têm 1.328 bytes cada e 192×192 px — são placeholders. Existe um `assets/icon.svg` de 775 KB que pode servir de fonte para regeneração, mas isso não foi validado visualmente. App Store exige ícone 1024×1024 sem alpha; Play Store exige 512×512 para a ficha.

---

## 14. Matriz de blockers para publicação

| # | Blocker | Severidade | Evidência | Tipo |
|---|---|---|---|---|
| B1 | `android/` e `ios/` são scaffolding Flutter commitado; `applicationId = com.example.lumen_mobile` | **Blocker** | `android/app/build.gradle.kts:9,23`; `ios/Runner/AppDelegate.swift:1-5` | Código |
| B2 | Assets de ícone/splash em 192×192 (requerido 1024×1024) | **Blocker** | `node scripts/check-assets.mjs` → exit 1 | Código/Design |
| B3 | Sem `NSCameraUsageDescription` / `NSPhotoLibraryUsageDescription`; sem plugin `expo-image-picker` | **Blocker** (iOS) | `app.json:16-19,27-30` vs `profile.tsx:326`, `payment.tsx:53` | Código |
| B4 | UGC sem "denunciar conteúdo" e sem "bloquear usuário" (Apple 1.2 / Play UGC) | **Blocker** | grep denúncia/bloqueio → 0; `src/services/channel.ts:18-41` | Código |
| B5 | Sem `extra.eas.projectId` e sem `owner` em `app.json` | **Blocker** | `app.json:1-35` | Humano (criar projeto EAS) |
| B6 | `submit.production` vazio em `eas.json` — sem Apple Team ID, ASC App ID, service account key do Play | **Blocker** | `eas.json:29-31` | Humano |
| B7 | Push inexistente em nativo (só Web Push/SW) | **Crítico** | `src/services/push.ts:16-19`; sem `expo-notifications` | Produto/Código |
| B8 | Sentry é SDK web (`@sentry/react`), não `@sentry/react-native` | **Crítico** | `package.json:15`; `app/_layout.tsx:8` | Código |
| B9 | Fallback de API em produção `https://api.lumenplus.app` — domínio **pré-autorizado no CSP** mas com provisão não confirmada | **Alto** (rebaixado de Crítico na revisão adversarial — o domínio consta do `connect-src` em `vercel.json:17`, logo é destino intencional, não string órfã) | `src/services/api.ts:38`; `vercel.json:17`; `build.yml:40` | Humano (confirmar DNS/provisão) |
| B10 | Tokens em AsyncStorage não criptografado; `expo-secure-store` instalado e não usado | **Alto** | `src/services/api.ts:18-27`; grep secure-store → 0 | Código |
| B11 | Nenhum build EAS jamais executado em CI | **Alto** | `.github/workflows/*` | Processo |
| B12 | `web/` é lixo commitado do Flutter — **7 arquivos**: `index.html`, `manifest.json`, `favicon.png`, `icons/Icon-{192,512}.png`, `icons/Icon-maskable-{192,512}.png` | **Médio** | `web/index.html:17,36`; `web/manifest.json:8`; `git ls-files lumen_mobile/web` | Código |
| B13 | `app/(auth)/index.tsx`: **164 linhas de código morto comentado** precedendo um `AuthIndex` funcional que redireciona para `/(auth)/login` | **Baixo** (rebaixado de Médio na revisão adversarial — a versão anterior afirmava, incorretamente, que a tela inteira estava comentada e a rota morta; ela **funciona**) | `app/(auth)/index.tsx:1-164` (comentado) vs `:172-176` (código vivo) | Código (higiene) |
| B14 | **5 rotas fantasma** registradas pelo expo-router sem `export default`: `/channel/components` + 4 caminhos `/../src/...` | **Médio** (confirmado — não é mais NÃO DETERMINADO) | `.expo/types/router.d.ts:9-11`; `app/channel/components.tsx` (só exports nomeados) | Código |
| B15 | ~7,33 MB (7,0 MiB) de JSON bundled carregados sincronamente | **Médio** | `assets/biblia.json` 5.442.856 B; `assets/catecismo.json` 1.885.846 B | Performance |
| B16 | Deep links: scheme declarado, zero handlers; sem Universal Links / App Links | **Médio** | `app.json:8`; grep `lumenplus://` → 0 | Código |
| B17 | `README.md:13` afirma "Sentry React Native" (falso) | **Baixo** | `README.md:13` | Doc |
| B18 | `dist/` sem `manifest.json` → PWA não instalável | **Baixo** | `ls dist/` | Web |

---

## 15. Itens NÃO DETERMINADOS

| Item | Motivo |
|---|---|
| ~~Se `app/channel/components.tsx` gera rota navegável~~ | **RESOLVIDO na revisão adversarial: sim.** `.expo/types/router.d.ts:9-11` lista `/channel/components`. Ver §11.5 |
| Por que o gerador de `typedRoutes` registra 4 caminhos `/../src/...` como rotas | Não há symlinks em `app/` (`find app -type l` → vazio) e os módulos vivem fora de `app/`. Mecanismo desconhecido; exige `expo start` para regenerar os tipos e reconfirmar |
| Se `.expo/types/router.d.ts` (datado 2026-06-06, gitignored) ainda reflete o HEAD atual | Artefato local não versionado com ~2 meses de defasagem; o item `/channel/components` foi reconferido contra o HEAD e confere, os demais não |
| Se `https://api.lumenplus.app` existe/responde | Requer chamada de rede; não foi feita. **Consta do `connect-src` do CSP (`vercel.json:17`)**, logo é destino intencional — falta apenas confirmar provisão |
| Existência de conta/projeto EAS (`expo.dev`) para o slug `lumen-plus` | Requer acesso autenticado ao painel Expo |
| Existência de App Store Connect app record e Google Play Console app record | Requer acesso às contas de desenvolvedor |
| Se o conteúdo de `app/(onboarding)/terms.tsx` cobre exigências anti-abuso de UGC | Não auditei o texto legal renderizado (vem do backend via `LatestLegal`) |
| Qual `EXPO_PUBLIC_API_URL` está configurada no ambiente real de produção | Só o `.env.local` local teria isso, e ele não foi lido por política de secrets |
| Se o `assets/icon.svg` (775 KB) é a arte final aprovada | Requer validação visual/design |
| Se o backend expõe endpoints de push nativo (FCM/APNs token) | Auditoria restrita ao mobile; `push.ts` só usa `/push/vapid-public-key` e `/push/subscribe` (Web Push) |

---

## 16. Ações humanas necessárias (não automatizáveis)

Ver campo `human_blockers` da saída estruturada. Em resumo: criar/vincular o projeto EAS e obter o `projectId`; criar os registros de app na App Store Connect e no Google Play Console; gerar as credenciais de submit (Apple Team ID + ASC App ID + App-Specific Password ou API Key; Google Play service account JSON); decidir e confirmar o domínio de API de produção; decidir se push nativo entra no escopo de lançamento; aprovar a arte final do ícone em 1024×1024; e decidir juridicamente sobre o fluxo de pagamento externo de retiros frente às políticas de IAP.

---

## 17. Revisão adversarial — registro de verificação (2026-08-06)

Segunda passagem independente, com tentativa explícita de **refutar** cada achado da versão anterior. Método: releitura de todos os arquivos citados, reconferência de cada `arquivo:linha`, reexecução dos greps e do `check-assets.mjs`, e varredura de secrets no repo **e no próprio documento**.

### 17.1 Achados CONFIRMADOS (sobreviveram sem alteração de substância)

| # | Achado | Como foi reconferido |
|---|---|---|
| B1 | `android/`/`ios/` são scaffolding Flutter | `build.gradle.kts` relido integralmente: `dev.flutter.flutter-gradle-plugin` (:5), `namespace`/`applicationId = com.example.lumen_mobile` (:9,:24), release com chave de debug (:37), `flutter { source = "../.." }` (:42-44). `settings.gradle.kts:7` exige `flutter.sdk`. `MainActivity.kt:5` = `FlutterActivity()`. `AppDelegate.swift:5` = `FlutterAppDelegate`. `git ls-files` → 19 + 39 arquivos. Nenhuma entrada em `.gitignore` (raiz nem `lumen_mobile/`). **CONFIRMADO** |
| B2 | Assets 192×192 | `node scripts/check-assets.mjs` reexecutado → exit **1**, saída idêntica à documentada, 4 assets fora de spec. 3 PNGs com 1.328 B. **CONFIRMADO ao byte** |
| B3 | Sem purpose strings iOS | `app.json` tem 35 linhas; `ios` (:16-19) contém só `supportsTablet` e `bundleIdentifier` — sem `infoPlist`. `plugins` (:27-30) = apenas `expo-router` e `expo-secure-store`. `ImagePicker.launchCameraAsync` em `profile.tsx:331` e `payment.tsx:58`; `launchImageLibraryAsync` em `profile.tsx:316` e `payment.tsx:41`. **CONFIRMADO — todas as linhas conferem** |
| B4 | UGC sem denunciar/bloquear | grep `denunc\|reportar\|report_\|reportPost\|reportContent` → 0. grep `bloquear\|block_user\|blockUser\|blockedUsers` → só 4 falsos-positivos ("Desbloquear projeto" do PIN, "Não bloquear o fluxo"). `channel.ts` tem `can_moderate` (:47) e `is_deleted` (:15,:31), nada de denúncia. **CONFIRMADO** |
| B5/B6 | Sem `projectId`/`owner`; `submit.production` vazio | `app.json` inteiro relido (35 linhas, sem `extra`). `eas.json:29-31` = `"submit": { "production": {} }`. **CONFIRMADO** |
| B7 | Push só web | `push.ts` relido (73 linhas): guard `serviceWorker`/`PushManager` (:17-19), VAPID (:23), `/push/subscribe` (:42-47). `home.tsx:50` = `if (Platform.OS !== 'web') return;`, `:170` = `{Platform.OS === 'web' && showPushCard && (`. `expo-notifications` ausente de `package.json` e com 0 imports. **CONFIRMADO — todas as linhas conferem** |
| B8 | Sentry é SDK web | `package.json:21` = `"@sentry/react": "^10.45.0"`; `app/_layout.tsx:8` = `import * as Sentry from '@sentry/react'`. Nenhum `@sentry/react-native`. **CONFIRMADO** |
| B10 | Tokens em AsyncStorage | `api.ts:13` `DEV_TOKEN_KEY`, helpers `:20-27` sobre AsyncStorage; `firebase.ts:53-56` persistência via AsyncStorage. grep SecureStore → 0. **CONFIRMADO** |
| B11 | Nenhum EAS em CI | `.github/workflows/` = `build.yml`, `ci.yml`, `discord-log.yml`. `grep -rn "eas "` → 0. `build.yml` faz tsc (:32) → lint (:35) → `expo export --platform web` (:38). **CONFIRMADO** |
| B16 | Deep links não implementados | grep `lumenplus://` → 0; `associatedDomains`/`intentFilters` → 0; `expo-linking` → 0 imports; `public/` = só `sw.js`. **CONFIRMADO** |
| B17 | README diz "Sentry React Native" | `README.md:13` = `- **Sentry React Native** (monitoramento de erros)`. **CONFIRMADO na linha exata** |
| B18 | `dist/` sem `manifest.json` | `ls dist/` = `_expo`, `assets`, `index.html`, `metadata.json`, `sw.js`. **CONFIRMADO** (ressalva: `dist/` é artefato local, gitignored) |
| — | Nenhum secret hardcoded | `git grep -E "AIza[0-9A-Za-z_-]{20,}\|sk_live_\|sk_test_\|BEGIN .*PRIVATE KEY\|eyJ…\.…"` sobre arquivos versionados de `lumen_mobile` → **0 resultados**. `git ls-files` só lista `.env.example` (todos os valores vazios). `.env.local` ignorado por `lumen_mobile/.gitignore:10`; conteúdo **não lido**. **CONFIRMADO** |
| — | Este documento não vaza secrets | Mesma varredura de padrões aplicada ao próprio `.md` → **0 resultados**. Os únicos identificadores presentes são hosts públicos e nomes de variáveis de ambiente (sem valores). **CONFIRMADO** |

### 17.2 Correções aplicadas

| Onde | Afirmação anterior | Realidade | Impacto |
|---|---|---|---|
| §3.1 (auth), B13 | "`app/(auth)/index.tsx` **inteira comentada**, 175 linhas, **rota morta**" | **Falso.** Linhas 166-176 são código vivo: `import { Redirect } from 'expo-router'` + `export default function AuthIndex() { return <Redirect href="/(auth)/login" />; }`. Só `:1-164` está comentado | **Alto** — invertia o comportamento de uma rota de autenticação. Severidade B13: Médio → **Baixo** |
| §11.5, B14 | "**NÃO DETERMINADO** se `channel/components.tsx` vira rota" | **Determinável e pior.** `.expo/types/router.d.ts:9-11` lista `/channel/components` **e mais 4 rotas** `/../src/...`, todas sem `export default`. São **5 rotas fantasma** | **Médio** — resolve um "não determinado" e amplia o achado 5× |
| §4.1, B9 | "`api.lumenplus.app` … nenhum dos dois [hosts conhecidos] é `api.lumenplus.app`" (implicando domínio órfão) | **Omissão material.** O `connect-src` do CSP em `vercel.json:17` **lista `https://api.lumenplus.app` explicitamente**. É destino intencional pré-autorizado | **Médio** — muda a natureza do risco. Severidade B9: Crítico → **Alto** |
| §3.1 | "61 arquivos em `app/`" (2×) | `find app -type f` → **63** | Baixo |
| §4 | "grep `useQuery\|useMutation` retorna **apenas as linhas do `_layout.tsx`**" | **Falso.** Retorna **0 em todo o projeto**. `_layout.tsx:11` importa `QueryClient`/`QueryClientProvider`, não os hooks | Baixo (conclusão fica **mais forte**) |
| §11.3 | "**todas** ausentes de qualquer `import` em `app/` ou `src/`" | **Falso para `@tanstack/react-query`** (importado em `_layout.tsx:11`) e categoria errada para `serve` (binário de CLI) | Baixo |
| §1.1 | `dist/index.html` citado como **[COMPROVADO]** | `dist/` é **gitignored** (`.gitignore:52`) e untracked (`git ls-files lumen_mobile/dist` → 0). É artefato local, não evidência de repositório | Baixo — rótulo corrigido para [INFERIDO a partir de artefato local] |
| §1.1 | "`web/` = index.html + manifest.json" | São **7 arquivos versionados** (inclui `favicon.png` e 4 ícones do template Flutter) | Baixo |
| §2 e outras | ~15 âncoras `package.json:<linha>` | Todas deslocadas em 1–6 linhas (Sentry citado em `:15` = abertura de `"dependencies"`; real `:21`) | Baixo — valores corretos, âncoras erradas |
| §1.1 | `build.gradle.kts:4,23,21-22,41-43`; `AndroidManifest.xml:4,29-31` | Deslocamento de 1–2 linhas em cada | Baixo |
| §4 | `bible.ts:8`, `catecismo.ts:8`, `ThemeContext.tsx:17`, `api.ts:18-27` (para `DEV_TOKEN_KEY`) | Reais: `:9`, `:9`, `:16`, `:13` | Baixo |

### 17.3 Achados anteriores que a revisão **não** conseguiu refutar em nenhum ponto

B1, B2, B3, B4, B5, B6, B7, B8, B10, B11, B16, B17, B18, o item de pagamentos externos (§10.1) e a ausência de secrets. Nenhuma funcionalidade declarada como existente deixou de ser encontrada; nenhuma severidade estava subestimada; nenhum secret vazou para o documento.

### 17.4 Citações menores com deslocamento residual (não corrigidas no corpo, registradas aqui)

`community.tsx:6-9` → o comentário BUG-SEMÂNTICO está em `:7-9`. `admin/_layout.tsx:29-42` → o `useEffect` do guard vai de `:30` a `:43`. `ci.yml:29-30` cobre só o passo de TypeScript; o lint está em `:32-33`. `payment.tsx:73-95` → o bloco de `FormData` vai de `:74` a `:91`. Nenhum altera a substância dos achados.
