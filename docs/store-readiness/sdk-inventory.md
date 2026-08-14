# Inventário de SDKs de Terceiros — Lumen+

> ## ⚠️ ATUALIZAÇÃO — este documento foi parcialmente superado
>
> Levantado quando o app estava em **Expo SDK 52** e a pasta nativa ainda era
> um scaffold Flutter. Desde então, na branch
> `mobile/upgrade-expo-store-toolchain` (PR #34):
>
> | O que o texto abaixo diz | Situação atual |
> |---|---|
> | Expo SDK 52.0.48 / RN 0.76.9 / expo-router 4.x | **Expo 54.0.36 / RN 0.81.5 / React 19.1.0 / expo-router 6.0.24** |
> | `ios/` e `android/` são scaffold Flutter | **superado** — scaffold removido; `expo prebuild` gera os projetos |
> | "Não existe `PrivacyInfo.xcprivacy` em lugar algum" | **superado** — declarado via `ios.privacyManifests` (4 categorias de Required Reason API) |
> | `applicationId = com.example.lumen_mobile` | **superado** — `com.lumenchristi.lumenplus`, confirmado por `aapt2` no APK |
> | `@vercel/analytics` presente (stub no-op) | **REMOVIDO do `package.json`**, junto com os dois componentes stub |
>
> Versões resolvidas hoje: `firebase 10.14.1` · `@sentry/react 10.69.0` ·
> `expo-image-picker 17.0.11` · `async-storage 2.2.0` · `expo-secure-store 15.0.8` ·
> `expo-file-system 19.0.23` · `react-native-reanimated 4.1.7` (+ `react-native-worklets 0.5.1`).
>
> **O que continua válido:** a conclusão central — a superfície de terceiros é
> pequena e **não há nenhum SDK de publicidade, atribuição ou tracking**. Os
> únicos que enviam dados para fora seguem sendo Firebase Auth e Sentry
> (condicional, sem PII). Com a remoção do `@vercel/analytics`, a superfície
> ficou **menor** do que a descrita abaixo.
>
> O texto original é preservado como registro da auditoria de 2026-08-06.

> **Escopo**: SDKs declarados em `lumen_mobile/package.json` e `backend/requirements.txt`, com uso real verificado por leitura do código.
> **Data da auditoria**: 2026-08-06
> **Branch**: `main` (commit `7db785d`)
> **Plataforma alvo**: Expo SDK 52.0.48 / React Native 0.76.9 / expo-router 4.x
> **Identificadores** (`lumen_mobile/app.json:23,27`): bundle iOS e package Android `com.lumenchristi.lumenplus`, slug `lumen-plus`
>
> **Convenção de confiança:** **[COMPROVADO]** = li a linha (evidência `arquivo:linha`) · **[INFERIDO]** = deduzido, base declarada · **[NÃO DETERMINADO]** = não concluído, motivo declarado.
>
> **Nenhum valor de chave, token, senha ou DSN foi lido, copiado ou reproduzido neste documento.**

---

## 0. Sumário executivo

**[COMPROVADO] Achado estrutural que precede toda a discussão de SDKs:** as pastas `lumen_mobile/ios/` e `lumen_mobile/android/` **não são um prebuild Expo — são um scaffold Flutter**. Consequentemente:

- Não existe `Podfile` nem `Podfile.lock` — nenhum pod nativo está resolvido.
- Não existe `PrivacyInfo.xcprivacy` em lugar algum do repositório.
- O `Info.plist` presente é o template Flutter, sem nenhuma `*UsageDescription`.
- `applicationId = "com.example.lumen_mobile"` no Android, divergindo do `app.json`.

Isso significa que **a camada nativa dos SDKs nunca foi gerada**. Toda a análise de privacy manifest abaixo descreve o que *será* exigido quando o `expo prebuild` correto for executado.

**Boa notícia para a ficha de privacidade das lojas:** a superfície de SDKs de terceiros é pequena e **não há nenhum SDK de publicidade, atribuição ou tracking**. Os únicos SDKs que enviam dados para fora são Firebase Auth e Sentry (este último, condicional e sem PII).

---

## 1. Dependências mobile — visão consolidada

Versões resolvidas lidas de `lumen_mobile/node_modules/<pkg>/package.json`. "Uso real" = contagem de arquivos em `app/` + `src/` que referenciam o pacote.

| SDK | Declarado | Instalado | Uso real | Envia dados p/ terceiro? |
|---|---|---|---|---|
| `firebase` | `^10.7.1` | **10.14.1** | 4 arquivos | **Sim — Google** |
| `@sentry/react` | `^10.45.0` | **10.45.0** | 1 arquivo | **Sim — Sentry (condicional)** |
| `expo` | `~52.0.0` | **52.0.48** | núcleo | Não |
| `react-native` | `0.76.9` | **0.76.9** | núcleo | Não |
| `expo-image-picker` | `~16.0.6` | **16.0.6** | 2 arquivos | Não (local) |
| `@react-native-async-storage/async-storage` | `1.23.1` | **1.23.1** | 4 arquivos | Não (local) |
| `expo-router` | `~4.0.0` | — | núcleo | Não |
| `expo-font` | `~13.0.0` | — | 1 arquivo | Não |
| `expo-splash-screen` | `~0.29.0` | — | 1 arquivo | Não |
| `expo-status-bar` | `~2.0.0` | — | 1 arquivo | Não |
| `@expo-google-fonts/nunito` | `^0.4.2` | — | 1 arquivo | Não (fontes empacotadas) |
| `@expo/vector-icons` | `^14.0.4` | — | vários | Não |
| `react-native-reanimated` | `~3.16.1` | — | 5 arquivos | Não |
| `react-native-safe-area-context` | `4.12.0` | — | vários | Não |
| `@react-native-picker/picker` | `2.9.0` | — | 1 arquivo | Não |
| `@tanstack/react-query` | `^5.17.0` | — | vários | Não (só chama a própria API) |
| `zustand` | `^4.4.7` | — | 2 stores | Não |
| `zod` / `react-hook-form` | `^3.22.4` / `^7.49.3` | — | validação | Não |
| **`@vercel/analytics`** | `^2.0.1` | **2.0.1** | **0 — stub no-op** | **Não** |
| **`expo-secure-store`** | `~14.0.0` | **14.0.1** | **0 imports** | Não |
| **`expo-file-system`** | `~18.0.12` | **18.0.12** | **0 imports** | Não |
| **`expo-auth-session`** | `~6.0.0` | **6.0.3** | **0 imports** | Não |
| **`expo-web-browser`** | `~14.0.0` | **14.0.2** | **0 imports** | Não |
| **`expo-constants`** | `~17.0.0` | **17.0.8** | 0 diretos (peer do router) | Não |
| **`expo-linking`** | `~7.0.0` | **7.0.5** | 0 diretos (peer do router) | Não |
| **`expo-asset`** | `~11.0.5` | — | **0 imports** | Não |
| `react-native-gesture-handler` | `~2.20.2` | — | 0 diretos (peer do router) | Não |
| `react-native-screens` | `~4.4.0` | — | 0 diretos (peer do router) | Não |
| `react-native-web` | `~0.19.13` | — | build web | Não |
| **`serve`** | `^14.2.6` | — | `server.js` | Não |
| `@hookform/resolvers` | `^3.3.4` | — | **0 imports** | Não |

Método de verificação de uso: `grep -rl "<pkg>" app src server.js`.

---

## 2. SDKs que transmitem dados — detalhamento

### 2.1. Firebase JS SDK — `firebase@10.14.1`

| Campo | Valor |
|---|---|
| **Finalidade** | Autenticação de usuários (e-mail/senha) |
| **Módulos importados** | `firebase/app` e `firebase/auth` **apenas** — `lumen_mobile/src/config/firebase.ts:15-16` |
| **Dados acessados/enviados** | E-mail, senha, ID token / refresh token, `displayName` (via `updateProfile`) |
| **Destino** | Google (`identitytoolkit.googleapis.com`) |
| **Privacy manifest exigido?** | **[INFERIDO] Não para este pacote.** É o SDK **JavaScript**, não `@react-native-firebase/*`. Não há binário nativo distribuído, portanto não se enquadra na lista de SDKs que a Apple exige manifesto assinado. |
| **Required Reason APIs** | Nenhuma diretamente. **Mas** a persistência usa `AsyncStorage` → ver §2.3 |

**[COMPROVADO] Configuração via env, sem secret hardcoded** — `lumen_mobile/src/config/firebase.ts:38-44` lê sete variáveis `EXPO_PUBLIC_FIREBASE_*`. Nenhum valor literal no código.

**[COMPROVADO] Trava de segurança contra fallback silencioso**: `MISCONFIGURED = !__DEV__ && IS_DEV_AUTH` (`firebase.ts:27`) — em build de produção sem credenciais, o app exibe tela de erro de configuração (`app/_layout.tsx:165`) em vez de cair no mock auth. Boa prática confirmada.

**[COMPROVADO] Firebase Analytics NÃO é usado.** `measurementId` é lido (`firebase.ts:44`) e passado a `initializeApp`, mas `firebase/analytics` nunca é importado e `getAnalytics()` nunca é chamado. `[INFERIDO]` Nenhum evento de analytics é coletado.

**Fichas das lojas** — declarar: *Contact Info → Email Address* e *Identifiers → User ID*, ambos **linked to user**, finalidade **App Functionality**, **não** usados para tracking.

---

### 2.2. Sentry — `@sentry/react@10.45.0`

| Campo | Valor |
|---|---|
| **Finalidade** | Captura de erros e ~10% de traces de performance |
| **Ativação** | **Condicional**: `enabled: !!process.env.EXPO_PUBLIC_SENTRY_DSN` — `lumen_mobile/app/_layout.tsx:38` |
| **Dados enviados** | Stack traces, mensagem de erro, `environment`, `release`. **`sendDefaultPii: false`** (`_layout.tsx:34`) → não anexa IP nem identidade do usuário automaticamente |
| **Amostragem** | `tracesSampleRate: 0.1` — `_layout.tsx:36` |
| **Privacy manifest exigido?** | **[INFERIDO] Não para este pacote** — `@sentry/react` é puro JS/web. **`@sentry/react-native` estaria** na lista de SDKs que a Apple exige com manifesto assinado |

> **[COMPROVADO] Achado importante: o pacote instalado é `@sentry/react`, o SDK WEB — não `@sentry/react-native`.**
> Evidência: `lumen_mobile/package.json:21` declara `"@sentry/react": "^10.45.0"`; `app/_layout.tsx:8` importa `import * as Sentry from '@sentry/react'`. Não há `@sentry/react-native` em `package.json`.
>
> **Consequências [INFERIDO]:**
> - `Sentry.ErrorBoundary` (`_layout.tsx:168`) funciona, pois é um componente React puro — erros de render JS **são** capturados.
> - **Crashes nativos (iOS/Android) NÃO são capturados** — não há camada nativa.
> - Não há captura de ANR, OOM, nem contexto de dispositivo nativo.
> - **Efeito colateral positivo para privacidade:** menos dados de dispositivo coletados.
>
> Se a intenção era observabilidade mobile real, a troca para `@sentry/react-native` **passa a exigir privacy manifest** e traz Required Reason APIs adicionais. Decisão de produto.

**Fichas das lojas** — se o DSN for configurado em produção, declarar *Diagnostics → Crash Data* e *Performance Data*, **not linked to user** (justificável por `sendDefaultPii: false`), finalidade **App Functionality**.

---

### 2.3. AsyncStorage — `@react-native-async-storage/async-storage@1.23.1`

| Campo | Valor |
|---|---|
| **Finalidade** | Persistência local de token de sessão, decisão de push e tema |
| **Dados armazenados** | Token dev (`api.ts:13`), **persistência do Firebase Auth** (`firebase.ts:53-56`), `lumen_push_decision` (`push.ts:6`), tema (`ThemeContext.tsx:13`) |
| **Envia dados p/ terceiro?** | **Não** — armazenamento estritamente local |
| **Privacy manifest exigido?** | **[INFERIDO] Sim, entrada de Required Reason API.** No iOS, AsyncStorage é implementado sobre `NSUserDefaults` |
| **Required Reason API** | `NSPrivacyAccessedAPICategoryUserDefaults` — motivo típico **`CA92.1`** (acesso restrito ao próprio app) |

**[COMPROVADO] Risco de segurança — credenciais em armazenamento não criptografado.**
`expo-secure-store@14.0.1` está instalado e **declarado em `app.json:29`** (`plugins`), mas **`grep -rn "expo-secure-store" app src` retorna zero imports**. Todo o token de sessão vai para `AsyncStorage`, que grava em SharedPreferences (Android) e em arquivo do sandbox (iOS) — **não no Keychain**.

`[INFERIDO]` A presença do plugin no `app.json` indica que a migração para SecureStore foi planejada e não concluída.

---

### 2.4. expo-image-picker — `16.0.6`

| Campo | Valor |
|---|---|
| **Finalidade** | Foto de perfil e comprovante de pagamento |
| **Onde é usado** | `app/(onboarding)/profile.tsx:36,311-331`; `app/retreats/[id]/payment.tsx:13,36-58` |
| **Permissões solicitadas** | `requestMediaLibraryPermissionsAsync()` **e** `requestCameraPermissionsAsync()` — ambas, nos dois arquivos |
| **Dados acessados** | Câmera e biblioteca de fotos |
| **Envia dados p/ terceiro?** | Não diretamente. O comprovante segue do backend para o **Cloudinary** (`backend/app/api/retreat_routes.py:721`) |
| **Privacy manifest exigido?** | **[INFERIDO] Sim** — Apple exige declaração de acesso a câmera e fotos |
| **Required Reason APIs** | `NSPrivacyAccessedAPICategoryFileTimestamp` (**`C617.1`** / **`0A2A.1`**) — o módulo lê metadados de arquivos de imagem |

> **[COMPROVADO] Blocker B4 — strings de permissão ausentes.**
> `grep -rn "NSCameraUsageDescription\|NSPhotoLibraryUsageDescription\|infoPlist"` em `lumen_mobile/` (excluindo `node_modules/` e `dist/`) **não retorna nenhuma ocorrência em arquivo de configuração**. O único hit é código minificado dentro de `dist/`, irrelevante.
>
> Agravantes:
> - `app.json:27-30` lista apenas `"expo-router"` e `"expo-secure-store"` no array `plugins` — **`expo-image-picker` não está declarado**, então seu config plugin não roda no prebuild e não injeta as usage descriptions.
> - Não há bloco `ios.infoPlist` em `app.json:20-23`.
> - O `Info.plist` existente (`ios/Runner/Info.plist`) é o template Flutter, sem nenhuma `*UsageDescription`.
>
> **Consequência:** no iOS, chamar a câmera sem `NSCameraUsageDescription` causa **crash imediato do processo**, e a App Store rejeita o binário na validação.

---

### 2.5. Vercel Analytics — `@vercel/analytics@2.0.1` — **INATIVO**

**[COMPROVADO] O pacote está declarado (`package.json:23`) e instalado, mas ambas as implementações são stubs que retornam `null`:**

- `lumen_mobile/src/components/VercelAnalytics.tsx:2-4` — *"Stub para iOS/Android — Vercel Analytics não existe fora da web"*
- `lumen_mobile/src/components/VercelAnalytics.web.tsx:4-6` — *"desativado no Railway (só funciona em deploys Vercel)"*

**[COMPROVADO]** `grep -rl "@vercel/analytics" app src` retorna **0 arquivos** — o pacote real nunca é importado. O componente montado em `app/_layout.tsx:139` é o stub.

**Conclusão:** **nenhum dado é coletado**. É uma dependência morta. Recomenda-se remover para reduzir superfície de auditoria e evitar que um revisor de loja assuma coleta de analytics que não ocorre.

---

## 3. Dependências declaradas sem uso direto

| Pacote | Versão | Status | Observação |
|---|---|---|---|
| `expo-secure-store` | 14.0.1 | **0 imports** | Declarado em `app.json:29`; deveria guardar o token — ver §2.3 |
| `expo-file-system` | 18.0.12 | **0 imports** | Se ativado, traria `NSPrivacyAccessedAPICategoryFileTimestamp` |
| `expo-auth-session` | 6.0.3 | **0 imports** | Login social não implementado; auth é e-mail/senha via Firebase |
| `expo-web-browser` | 14.0.2 | **0 imports** | Peer de `expo-auth-session` |
| `expo-asset` | — | **0 imports** | — |
| `@hookform/resolvers` | — | **0 imports** | `react-hook-form` + `zod` usados sem o bridge |
| `@vercel/analytics` | 2.0.1 | **stub no-op** | Ver §2.5 |
| `serve` | 14.2.6 | usado em `server.js` | **Servidor web em `dependencies`** — entra no bundle mobile sem necessidade |

**Peers legítimos do expo-router** (0 imports diretos, mas necessários em runtime — **não remover**): `expo-linking`, `expo-constants`, `react-native-screens`, `react-native-gesture-handler`, `react-native-safe-area-context`.

`[INFERIDO]` `serve` em `dependencies` (não `devDependencies`) é consequência do deploy web via `lumen_mobile/server.js`. Não afeta privacidade, mas infla o bundle e a superfície de `npm audit`.

---

## 4. Privacy Manifest da Apple — situação atual

**[COMPROVADO] Não existe `PrivacyInfo.xcprivacy` em nenhum lugar do repositório.**
Verificação: `find lumen_mobile/ios -name "PrivacyInfo.xcprivacy"` → vazio.

Obrigatório desde **1º de maio de 2024** para toda submissão à App Store.

### 4.1. Required Reason APIs previstas

`[INFERIDO]` a partir dos módulos efetivamente em uso. A lista definitiva só pode ser fechada após o `expo prebuild` correto, quando as dependências nativas forem resolvidas.

| Categoria | Motivo típico | Origem no projeto | Evidência |
|---|---|---|---|
| `NSPrivacyAccessedAPICategoryUserDefaults` | `CA92.1` | AsyncStorage (token, tema, push) | `src/config/firebase.ts:53`; `src/services/api.ts:24` |
| `NSPrivacyAccessedAPICategoryFileTimestamp` | `C617.1` / `0A2A.1` | expo-image-picker; expo-file-system se ativado | `app/(onboarding)/profile.tsx:316` |
| `NSPrivacyAccessedAPICategoryDiskSpace` | `E174.1` | `[NÃO DETERMINADO]` — depende dos módulos Expo linkados no prebuild | — |
| `NSPrivacyAccessedAPICategorySystemBootTime` | `35F9.1` | `[NÃO DETERMINADO]` — comum em SDKs de crash reporting; não se aplica ao `@sentry/react` puro JS | — |

### 4.2. Usage descriptions faltantes no `Info.plist`

| Chave | Necessária porque | Presente? |
|---|---|---|
| `NSCameraUsageDescription` | `requestCameraPermissionsAsync()` | **NÃO** |
| `NSPhotoLibraryUsageDescription` | `requestMediaLibraryPermissionsAsync()` | **NÃO** |
| `NSPhotoLibraryAddUsageDescription` | `[NÃO DETERMINADO]` — só se o app salvar imagens na galeria; não encontrei chamada de salvamento | N/A |

### 4.3. SDKs de terceiros que exigem manifesto assinado

`[INFERIDO]` **Nenhum dos SDKs atualmente usados está na lista da Apple**, porque Firebase e Sentry aqui são **JavaScript puro**, sem binário nativo distribuído.

Isso **muda imediatamente** se o projeto adotar `@react-native-firebase/*` ou `@sentry/react-native` — ambos constam da lista de SDKs que exigem manifesto de privacidade assinado.

---

## 5. Android — situação atual

**[COMPROVADO] O `AndroidManifest.xml` é o template Flutter** (`lumen_mobile/android/app/src/main/AndroidManifest.xml`):
- `android:label="lumen_mobile"` — nome errado (deveria ser "Lumen+")
- `<meta-data android:name="flutterEmbedding" android:value="2" />` — embedding Flutter
- Activity `io.flutter.*` referenciada via `NormalTheme`
- **Nenhuma permissão declarada** — sem `CAMERA`, sem `READ_MEDIA_IMAGES`, sem `INTERNET`
- `<queries>` para `PROCESS_TEXT` do engine Flutter

**[COMPROVADO] `applicationId` e `namespace` inválidos** — `lumen_mobile/android/app/build.gradle.kts:9,24`:

```kotlin
namespace = "com.example.lumen_mobile"
applicationId = "com.example.lumen_mobile"
```

**Google Play rejeita explicitamente pacotes com prefixo `com.example.`**. Além disso, diverge do `app.json:27` (`com.lumenchristi.lumenplus`).

**[COMPROVADO] Esses arquivos estão versionados no git** — `git ls-files android` retorna `android/app/build.gradle.kts`, os três `AndroidManifest.xml` e `android/app/src/main/kotlin/com/example/lumen_mobile/MainActivity.kt`. Não são artefatos locais ignorados: fazem parte do repositório e **vão colidir com `expo prebuild`**.

### Data Safety do Google Play — declaração prevista

`[INFERIDO]` com base no inventário de dados (ver `data-inventory.md`):

| Categoria | Coletado | Compartilhado | Obrigatório | Finalidade |
|---|---|---|---|---|
| Nome | Sim | Não | Sim | Funcionalidade |
| E-mail | Sim | Não | Sim | Funcionalidade, Autenticação |
| Telefone | Sim | Não | Sim | Funcionalidade |
| **ID governamental (CPF/RG)** | Sim | Não | Opcional | Funcionalidade |
| Fotos | Sim | Não | Opcional | Funcionalidade |
| **Info de saúde** | Sim | Não | Opcional | Funcionalidade |
| **Outras infos pessoais** (convicção religiosa) | Sim | Não | Sim | Funcionalidade |
| Logs de falha / diagnóstico | Sim (se Sentry ativo) | Sim (Sentry) | Opcional | Diagnóstico |
| Cidade/UF aproximada | Sim | Não | Sim | Funcionalidade |

**Práticas de segurança a declarar:** dados criptografados em trânsito (**sim**, HTTPS); usuário pode solicitar exclusão (**hoje, apenas por e-mail — ver blocker B2 no data-inventory**).

---

## 6. Backend — `backend/requirements.txt`

| Pacote | Versão | Finalidade | Dados que processa | Terceiro? |
|---|---|---|---|---|
| `fastapi` / `uvicorn` | 0.109.0 / 0.27.0 | Framework HTTP | Todos em trânsito | Não |
| `sqlalchemy` / `psycopg` / `alembic` | 2.0.25 / 3.2.3 / 1.13.1 | ORM, driver, migrations | Todos persistidos | Não |
| `pydantic` / `pydantic-settings` | 2.5.3 / 2.1.0 | Validação e config | Payloads de entrada | Não |
| **`cryptography`** | 42.0.2 | **AES-256-GCM de CPF/RG** | CPF, RG | Não |
| `python-jose[cryptography]` | 3.3.0 | Verificação de JWT | Tokens de auth | Não |
| `cachetools` | 5.3.2 | Cache de chaves/JWKS | — | Não |
| `redis` | 5.0.1 | Cache e rate limiting | `[NÃO DETERMINADO]` — não auditei o que é cacheado | Não (self-hosted) |
| `python-multipart` | 0.0.6 | Upload multipart | Imagem de comprovante | Não |
| `structlog` | 24.1.0 | Logging estruturado | Logs sanitizados | Não |
| **`cloudinary`** | 1.40.0 | **Upload de imagem** | **Comprovante de pagamento** | **SIM** |
| `openpyxl` | 3.1.2 | Geração de XLSX | Exportações de dados pessoais | Não |
| **`pywebpush`** | >=2.0.0 | Web Push | Endpoint, chaves p256dh/auth, payload | **SIM** (serviço de push do navegador) |
| **`sendgrid`** | >=6.11.0 | **E-mail transacional** | **E-mail e corpo da mensagem** | **SIM** (Twilio) |
| `apscheduler` | >=3.10.0 | Agendamento | — | Não |
| **`sentry-sdk[fastapi]`** | 2.19.2 | Monitoramento de erros | Stack traces; `send_default_pii=False` | **SIM** |
| `pytest` / `pytest-asyncio` / `httpx` | — | Testes (dev) | — | Não |

**[COMPROVADO] `firebase-admin` está COMENTADO** — `backend/requirements.txt:23`:

```
# Auth (quando implementar Firebase)
# firebase-admin==6.3.0
```

`[INFERIDO]` A verificação de tokens Firebase no backend é feita com `python-jose` (`requirements.txt:27`) + `cachetools` (JWKS). A auditoria da corretude dessa verificação está **fora do escopo deste inventário** e merece revisão de segurança dedicada — validação manual de JWT do Firebase exige checar assinatura, `iss`, `aud`, `exp` e o certificado x509 rotativo do Google.

**[COMPROVADO] Configuração de operadores via env, sem secret hardcoded** — `backend/app/settings.py:76-84` declara `sendgrid_api_key`, `cloudinary_cloud_name`, `cloudinary_api_key`, `cloudinary_api_secret`, todos com `Field(default="")`. Nenhum valor literal.

**[COMPROVADO] Sentry backend com PII desligado** — `backend/app/main.py:36`: `send_default_pii=False`; `traces_sample_rate` 0.1 em produção, 0.0 fora (`main.py:38`).

---

## 7. Achados consolidados

### Blockers

| # | Achado | Evidência |
|---|---|---|
| **B1** | `ios/` e `android/` são scaffold **Flutter**, não prebuild Expo. Sem `Podfile`, sem pods resolvidos | `lumen_mobile/ios/Runner/Info.plist` (usa `$(FLUTTER_BUILD_NAME)`); `android/app/src/main/AndroidManifest.xml` (`flutterEmbedding`) |
| **B1a** | `applicationId = "com.example.lumen_mobile"` — prefixo banido pelo Google Play, divergente do `app.json` | `lumen_mobile/android/app/build.gradle.kts:9,24` vs. `app.json:27` |
| **B3** | Nenhum `PrivacyInfo.xcprivacy` no repositório | `find lumen_mobile/ios -name "PrivacyInfo.xcprivacy"` → vazio |
| **B4** | Sem `NSCameraUsageDescription` / `NSPhotoLibraryUsageDescription`, embora ambas as permissões sejam pedidas | `app/(onboarding)/profile.tsx:311,326`; `app/retreats/[id]/payment.tsx:36,53`; `app.json:27-30` sem `expo-image-picker` |

### Riscos altos

| # | Achado | Evidência |
|---|---|---|
| **B5** | Token de sessão em `AsyncStorage` não criptografado; `expo-secure-store` declarado em `app.json:29` mas com **0 imports** | `src/config/firebase.ts:53-56`; `src/services/api.ts:24` |
| **S1** | `@sentry/react` (SDK web) em vez de `@sentry/react-native` → **crashes nativos não são capturados** | `package.json:21`; `app/_layout.tsx:8` |
| **S2** | `app.json` não declara `expo-image-picker` em `plugins` → config plugin não roda no prebuild | `app.json:27-30` |

### Médios / higiene

| # | Achado | Evidência |
|---|---|---|
| **M1** | `@vercel/analytics` declarado e instalado, mas ambas as implementações são stubs no-op | `src/components/VercelAnalytics.tsx:2-4`; `.web.tsx:4-6` |
| **M2** | 7 dependências com 0 imports: `expo-file-system`, `expo-auth-session`, `expo-web-browser`, `expo-asset`, `@hookform/resolvers`, `expo-secure-store`, `@vercel/analytics` | `grep -rl` em `app/` + `src/` |
| **M3** | `serve@14.2.6` (servidor web) em `dependencies`, não `devDependencies` | `package.json:46` |
| **M4** | `android:label="lumen_mobile"` — nome de app errado | `android/app/src/main/AndroidManifest.xml:3` |
| **M5** | `firebase-admin` comentado; verificação de JWT via `python-jose` não auditada | `backend/requirements.txt:23,27` |

### Pontos fortes confirmados

- **Zero SDKs de publicidade, atribuição ou tracking** — sem AppsFlyer, Adjust, Branch, Facebook SDK, AdMob, GA4, Amplitude, Mixpanel.
- **Sem IDFA/AAID** e sem `expo-location` — nenhuma coleta de identificador publicitário ou geolocalização precisa.
- `sendDefaultPii: false` no Sentry cliente e servidor — `app/_layout.tsx:34`; `backend/app/main.py:36`.
- Sentry só ativa com DSN presente — `app/_layout.tsx:38`.
- Nenhum secret hardcoded: todas as credenciais vêm de env — `src/config/firebase.ts:38-44`; `backend/app/settings.py:76-84`.
- `.env.local` gitignored e não rastreado — `lumen_mobile/.gitignore:10`; `git ls-files` não o retorna.
- Trava contra fallback silencioso de auth em produção — `src/config/firebase.ts:27`; `app/_layout.tsx:165`.
- Superfície de terceiros pequena e auditável: 2 SDKs mobile transmitem dados; 4 serviços no backend.

---

## 8. Itens NÃO DETERMINADOS

| Item | Motivo |
|---|---|
| Lista final e exata de Required Reason APIs | Só é determinável após `expo prebuild` correto, quando as dependências nativas forem resolvidas. A projeção em §4.1 é `[INFERIDO]` |
| Pods nativos e suas versões | Não existe `Podfile`/`Podfile.lock` — o `ios/` é Flutter |
| Se algum SDK transitivo exige manifesto assinado | Exige a árvore nativa resolvida |
| O que exatamente é cacheado no Redis | Não auditei os call sites de cache |
| Região de processamento de Cloudinary, SendGrid, Sentry e Firebase | Configuração de painel de cada serviço, fora do código |
| Corretude da validação de JWT do Firebase via `python-jose` | Fora do escopo deste inventário; requer revisão de segurança dedicada |
| Vulnerabilidades conhecidas (CVE) das versões instaladas | Não executei `npm audit` / `pip-audit` (tarefa é read-only e offline) |

---

## 9. Ações humanas necessárias

Ver `human_blockers` no relatório estruturado. Resumo:

1. **Eng/Decisão** — definir o destino do scaffold Flutter em `lumen_mobile/ios/` e `android/` (remover e rodar `expo prebuild --clean`, ou manter e assumir build manual). **Nada de store readiness avança antes disso.**
2. **Eng** — adicionar `expo-image-picker` ao array `plugins` do `app.json` com as usage descriptions em pt-BR, ou declarar `ios.infoPlist` manualmente.
3. **Produto/Eng** — decidir entre manter `@sentry/react` (sem crashes nativos) ou migrar para `@sentry/react-native` (exige privacy manifest).
4. **Eng** — migrar a persistência de token de `AsyncStorage` para `expo-secure-store`, que já está instalado e declarado.
5. **DPO/Jurídico** — preencher as fichas de privacidade (App Privacy da Apple e Data Safety do Google) declarando **convicção religiosa** e **dados de saúde** como categorias especiais.

---

*Documento gerado por auditoria estática read-only. Nenhum arquivo de código foi modificado. Nenhum valor de chave, token ou senha foi lido ou reproduzido.*
