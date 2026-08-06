# Auditoria de Permissões — Lumen+ Mobile

> ## ⚠️ ATUALIZAÇÃO — pontos superados
>
> Documento levantado com o app em **Expo SDK 52**. Desde então, na branch
> `mobile/upgrade-expo-store-toolchain` (PR #34): **Expo 54.0.36 / React Native
> 0.81.5 / React 19.1.0 / expo-router 6.0.24**.
>
> As permissões em si foram **confirmadas no artefato empacotado** (não só na
> configuração), com `aapt2 dump badging` sobre o `app-release.apk`:
>
> `CAMERA · INTERNET · READ_EXTERNAL_STORAGE · READ_MEDIA_IMAGES · VIBRATE ·
> WRITE_EXTERNAL_STORAGE · USE_BIOMETRIC · USE_FINGERPRINT`
>
> Nenhuma das bloqueadas (`RECORD_AUDIO`, `ACCESS_*_LOCATION`,
> `SYSTEM_ALERT_WINDOW`) aparece. O CI passou a falhar se alguma surgir no
> manifest mesclado.
>
> O texto original e preservado como registro da auditoria de 2026-08-06.

**Data:** 2026-08-06
**Revisão adversarial:** 2026-08-06 — segundo agente reverificou cada achado contra o código. Correções aplicadas estão marcadas com **[CORRIGIDO NA REVISÃO]**. Ver §13 para o log completo.
**Escopo:** `lumen_mobile/` (Expo SDK 52.0.48 / RN 0.76.9 / expo-router)
**Bundle iOS / package Android alvo:** `com.lumenchristi.lumenplus` (declarado em `app.json`)
**Método:** leitura estática do repositório + inspeção dos config plugins em `node_modules`. Nenhum build foi executado.
**Convenção:** cada afirmação está marcada como **COMPROVADO** (li no arquivo citado) ou **INFERIDO** (deduzi de comportamento documentado de ferramenta, sem executar).

---

## 0. TL;DR

| # | Achado | Severidade |
|---|---|---|
| B1 | `lumen_mobile/android/` e `lumen_mobile/ios/` **não são um prebuild Expo — são scaffolding Flutter morto**. Nenhuma permissão do app real está declarada neles. | **BLOCKER** |
| B2 | `ios/Runner/Info.plist` tem **zero** `NS*UsageDescription`, mas o código chama câmera e galeria → crash no iOS + rejeição na App Store. | **BLOCKER** |
| B3 | `android/app/src/main/AndroidManifest.xml` tem **zero** `uses-permission` — nem `INTERNET`. | **BLOCKER** |
| A1 | Se o prebuild for regenerado, os textos de justificativa gerados são os **defaults em inglês** do `node_modules` (app é 100% pt-BR). | **CRÍTICO** |
| A2 | Permissões **órfãs** que seriam injetadas: `RECORD_AUDIO` / `NSMicrophoneUsageDescription` (nunca grava áudio) e `NSFaceIDUsageDescription` (SecureStore nunca usado). | **ALTO** |
| A5 | **[CORRIGIDO NA REVISÃO]** O template bare do Expo declara `SYSTEM_ALERT_WINDOW` e `VIBRATE` no manifesto **main** (não só em debug). Num prebuild regenerado elas entram no **release** sem uso correspondente. `SYSTEM_ALERT_WINDOW` ("sobrepor a outros apps") é sensível na revisão do Play. | **ALTO** |
| A3 | `expo-file-system` e `expo-secure-store` são dependências **não importadas** que arrastam permissões Android. **[CORRIGIDO NA REVISÃO]** `expo-file-system` **não pode ser removido** — é dependência do próprio pacote `expo`. Só `blockedPermissions` mitiga. | **MÉDIO** |
| A4 | Negação de permissão não oferece caminho de recuperação (sem deep link para Ajustes). | **MÉDIO** |

---

## 1. Estado atual das declarações (o que está no repo hoje)

### 1.1 `lumen_mobile/app.json` — COMPROVADO

| Campo esperado | Situação | Evidência |
|---|---|---|
| `expo.ios.infoPlist` | **AUSENTE** | `lumen_mobile/app.json:16-19` — o bloco `ios` contém apenas `supportsTablet` e `bundleIdentifier` |
| `expo.android.permissions` | **AUSENTE** | `lumen_mobile/app.json:20-26` — o bloco `android` contém apenas `adaptiveIcon` e `package` |
| `expo.android.blockedPermissions` | **AUSENTE** | idem |
| `expo.plugins` | `["expo-router", "expo-secure-store"]` | `lumen_mobile/app.json:27-30` |

Ou seja: **o projeto não declara explicitamente nenhuma permissão nem nenhum texto de justificativa.** Tudo depende do que os config plugins e o merge de manifest de bibliotecas injetarem.

Não existe `app.config.js` / `app.config.ts` (COMPROVADO: `ls app.config.*` sem resultado), então `app.json` é a única fonte de configuração Expo.

### 1.2 `lumen_mobile/android/app/src/main/AndroidManifest.xml` — COMPROVADO

**Zero elementos `<uses-permission>`.** O arquivo tem 45 linhas e nenhuma delas declara permissão. Nem `android.permission.INTERNET`.

A única declaração de `INTERNET` do projeto está no manifesto de **debug**:
- `lumen_mobile/android/app/src/debug/AndroidManifest.xml:6` → `<uses-permission android:name="android.permission.INTERNET"/>`, com comentário explicando que é para hot reload do **Flutter tool**.

### 1.3 `lumen_mobile/ios/Runner/Info.plist` — COMPROVADO

**Zero chaves `NS*UsageDescription`.** O arquivo tem 49 linhas e contém apenas: `CFBundleDevelopmentRegion`, `CFBundleDisplayName` (= `Lumen Mobile`), `CFBundleExecutable`, `CFBundleIdentifier`, `CFBundleInfoDictionaryVersion`, `CFBundleName`, `CFBundlePackageType`, `CFBundleShortVersionString`, `CFBundleSignature`, `CFBundleVersion`, `LSRequiresIPhoneOS`, `UILaunchStoryboardName`, `UIMainStoryboardFile`, `UISupportedInterfaceOrientations`, `UISupportedInterfaceOrientations~ipad`, `CADisableMinimumFrameDurationOnPhone`, `UIApplicationSupportsIndirectInputEvents`. Nada de câmera, fotos, microfone, Face ID ou notificações.

---

## 2. BLOCKER B1 — `android/` e `ios/` são scaffolding Flutter, não prebuild Expo

Este é o achado que invalida qualquer leitura ingênua dos manifestos nativos. **COMPROVADO** por múltiplas evidências independentes:

| Evidência | Arquivo:linha |
|---|---|
| `meta-data io.flutter.embedding.android.NormalTheme` | `lumen_mobile/android/app/src/main/AndroidManifest.xml:20` |
| `meta-data flutterEmbedding = 2` | `lumen_mobile/android/app/src/main/AndroidManifest.xml:31` |
| `android:label="lumen_mobile"` (não "Lumen+") | `lumen_mobile/android/app/src/main/AndroidManifest.xml:3` |
| Comentário "used by the Flutter tool to generate GeneratedPluginRegistrant.java" | `lumen_mobile/android/app/src/main/AndroidManifest.xml:28-29` |
| Comentário "visible to the user while the Flutter UI initializes" | `lumen_mobile/android/app/src/main/AndroidManifest.xml:15-18` |
| `id("dev.flutter.flutter-gradle-plugin")` | `lumen_mobile/android/app/build.gradle.kts:5` |
| `namespace = "com.example.lumen_mobile"` | `lumen_mobile/android/app/build.gradle.kts:9` |
| `applicationId = "com.example.lumen_mobile"` + `// TODO: Specify your own unique Application ID` | `lumen_mobile/android/app/build.gradle.kts:23-24` |
| `versionCode = flutter.versionCode` | `lumen_mobile/android/app/build.gradle.kts:29` |
| `class MainActivity : FlutterActivity()` | `lumen_mobile/android/app/src/main/kotlin/com/example/lumen_mobile/MainActivity.kt:3-5` |
| `require(flutterSdkPath != null) { "flutter.sdk not set in local.properties" }` | `lumen_mobile/android/settings.gradle.kts:7` |
| `flutter { source = "../.." }` | `lumen_mobile/android/app/build.gradle.kts:42-44` |
| `CFBundleName = lumen_mobile` | `lumen_mobile/ios/Runner/Info.plist:16` |
| `CFBundleShortVersionString = $(FLUTTER_BUILD_NAME)` | `lumen_mobile/ios/Runner/Info.plist:20` |
| `CFBundleVersion = $(FLUTTER_BUILD_NUMBER)` | `lumen_mobile/ios/Runner/Info.plist:24` |
| Existência de `ios/Flutter/AppFrameworkInfo.plist`, `ios/Flutter/Debug.xcconfig`, `ios/Flutter/Release.xcconfig`, `ios/Runner.xcworkspace/`, `ios/RunnerTests/` | listagem de `lumen_mobile/ios/` |
| `"description": "A new Flutter project."` | `lumen_mobile/web/manifest.json:8` |

**Além disso: nem projeto Flutter válido é.** Não existe `lumen_mobile/pubspec.yaml` nem `lumen_mobile/lib/` (COMPROVADO). É scaffolding gerado por `flutter create` e depois abandonado, com o app Expo escrito por cima.

**Estão versionados no git:** 58 arquivos rastreados sob `lumen_mobile/android` + `lumen_mobile/ios` (COMPROVADO via `git ls-files`), adicionados no commit `4aac3f0 Initial commit (clean slate)`. Não há `.easignore` no projeto (COMPROVADO).

### Consequência para permissões

- **INFERIDO (comportamento documentado do EAS Build):** o EAS decide o *workflow* por plataforma pela presença dos diretórios `android/` e `ios/` no upload. Com ambos presentes e versionados, o build roda em modo **bare** e **não executa `expo prebuild`**. Sem prebuild, **nenhum config plugin roda** → nenhuma `NS*UsageDescription` é gerada → e o `AndroidManifest.xml` usado é o Flutter, sem permissões.
- **INFERIDO:** antes mesmo disso, o build Android falharia em `settings.gradle.kts:1-11`, que exige `flutter.sdk` em `local.properties` (arquivo inexistente e não versionável).
- Também há **descasamento de identidade**: `applicationId` Flutter `com.example.lumen_mobile` vs. `com.lumenchristi.lumenplus` de `app.json:25`. Um AAB publicado com `com.example.*` é **rejeitado pelo Google Play** (prefixo reservado/proibido). — INFERIDO (política de loja), COMPROVADO quanto ao valor no arquivo.

> **Ação necessária (não executada — sou read-only):** remover `lumen_mobile/android/` e `lumen_mobile/ios/` do repositório, ou substituí-los por um prebuild Expo real (`npx expo prebuild --clean`) já com as permissões corretas. Enquanto isso não for resolvido, **toda a seção 4 é hipotética.**

---

## 3. Uso real de permissões no código (a verdade funcional)

Levantado por varredura em `lumen_mobile/app`, `lumen_mobile/src`, `lumen_mobile/components` (excluindo `node_modules/` e `dist/`). **COMPROVADO.**

### 3.1 Módulos Expo importados no código-fonte

Grep de todos os `from 'expo-*'` retornou **apenas**: `expo-font`, `expo-image-picker`, `expo-router`, `expo-splash-screen`, `expo-status-bar`.

> **[CORRIGIDO NA REVISÃO]** A versão original desta lista incluía `expo-linear-gradient`. Isso estava **errado**: a única ocorrência é um import **comentado** — `lumen_mobile/app/(auth)/index.tsx:9` → `// import { LinearGradient } from 'expo-linear-gradient';`. O pacote não está em `lumen_mobile/package.json` nem instalado em `node_modules/`. Não é um módulo em uso e não tem efeito sobre permissões (o correto igualmente: `expo-linear-gradient` não declara nenhuma).

**Nenhum uso de:** `expo-camera`, `expo-location`, `expo-notifications`, `expo-media-library`, `expo-av`, `expo-contacts`, `expo-calendar`, `expo-sensors`, `expo-local-authentication`, `expo-tracking-transparency`, `expo-document-picker`, `expo-secure-store`, `expo-file-system`.

### 3.2 Call sites de permissão

| # | API de permissão | Arquivo:linha | Funcionalidade |
|---|---|---|---|
| 1 | `ImagePicker.requestMediaLibraryPermissionsAsync()` | `lumen_mobile/app/(onboarding)/profile.tsx:311` | Escolher **foto de perfil** na galeria (onboarding) |
| 2 | `ImagePicker.launchImageLibraryAsync({ mediaTypes: Images })` | `lumen_mobile/app/(onboarding)/profile.tsx:316-321` | idem |
| 3 | `ImagePicker.requestCameraPermissionsAsync()` | `lumen_mobile/app/(onboarding)/profile.tsx:326` | Tirar **foto de perfil** com a câmera |
| 4 | `ImagePicker.launchCameraAsync()` | `lumen_mobile/app/(onboarding)/profile.tsx:331-335` | idem |
| 5 | `ImagePicker.requestMediaLibraryPermissionsAsync()` | `lumen_mobile/app/retreats/[id]/payment.tsx:36` | Enviar **comprovante de pagamento** de retiro (galeria) |
| 6 | `ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'] })` | `lumen_mobile/app/retreats/[id]/payment.tsx:41-45` | idem |
| 7 | `ImagePicker.requestCameraPermissionsAsync()` | `lumen_mobile/app/retreats/[id]/payment.tsx:53` | Fotografar **comprovante de pagamento** |
| 8 | `ImagePicker.launchCameraAsync()` | `lumen_mobile/app/retreats/[id]/payment.tsx:58-61` | idem |
| 9 | `Notification.requestPermission()` (Web Push API) | `lumen_mobile/src/services/push.ts:55` | Push **somente web/PWA** |
| 10 | `registration.pushManager.subscribe(...)` | `lumen_mobile/src/services/push.ts:32-35` | Assinatura Web Push (VAPID) |

Ponto 9/10 é **exclusivamente web**: `lumen_mobile/app/(tabs)/home.tsx:50` faz `if (Platform.OS !== 'web') return;` antes de qualquer coisa de push, e `push.ts:17` exige `'serviceWorker' in navigator`. **Não há push nativo iOS/Android no app** — não existe `expo-notifications` no `package.json` (COMPROVADO: `lumen_mobile/package.json:15-49`).

**Conclusão factual:** as únicas permissões de sistema operacional realmente exercidas pelo app nativo são **CÂMERA** e **GALERIA DE FOTOS (leitura)**. Nada mais.

---

## 4. O que seria gerado num prebuild correto (cenário pós-correção do B1)

**COMPROVADO** que `expo-image-picker` é auto-aplicado mesmo sem estar em `app.json.plugins`:
`lumen_mobile/node_modules/@expo/prebuild-config/build/plugins/withDefaultPlugins.js:204` — a lista `legacyExpoPlugins` inclui `'expo-image-picker'` **e `'expo-file-system'`**.

**[CORRIGIDO NA REVISÃO]** A cadeia de aplicação estava descrita de forma imprecisa. `getAutoPlugins()` (linha 195) é apenas um helper de listagem. Quem de fato aplica durante o prebuild é `withLegacyExpoPlugins()` — `withDefaultPlugins.js:224` — chamado por `@expo/prebuild-config/build/getPrebuildConfig.js:59`. Há ainda um filtro: `withOptionalLegacyPlugins` pula o plugin se o pacote não estiver autolinkado (`shouldSkipAutoPlugin`, `withDefaultPlugins.js:211`). Como `expo-image-picker` e `expo-file-system` **estão** instalados e autolinkados, ambos os plugins rodam — a conclusão original se mantém.

**COMPROVADO** que os defaults são aplicados a **todas** as chaves, não só às customizadas:
`lumen_mobile/node_modules/@expo/config-plugins/build/ios/Permissions.js:24-38` — `applyPermissions()` itera `Object.entries(defaults)` e faz `infoPlist[permission] = permissions[permission] || infoPlist[permission] || description`. Só omite se o valor for explicitamente `false`.

### 4.1 iOS — `NS*UsageDescription` que seriam injetadas

| Chave | Texto que seria gerado | Origem (arquivo:linha) | Português? | Específico? | Usada de fato? |
|---|---|---|---|---|---|
| `NSCameraUsageDescription` | `Allow $(PRODUCT_NAME) to access your camera` | `node_modules/expo-image-picker/plugin/build/withImagePicker.js:6` | ❌ **Inglês** | ❌ genérico | ✅ Sim — `profile.tsx:331`, `payment.tsx:58` |
| `NSPhotoLibraryUsageDescription` | `Allow $(PRODUCT_NAME) to access your photos` | `node_modules/expo-image-picker/plugin/build/withImagePicker.js:8` | ❌ **Inglês** | ❌ genérico | ✅ Sim — `profile.tsx:316`, `payment.tsx:41` |
| `NSMicrophoneUsageDescription` | `Allow $(PRODUCT_NAME) to access your microphone` | `node_modules/expo-image-picker/plugin/build/withImagePicker.js:7` | ❌ **Inglês** | ❌ genérico | ❌ **ÓRFÃ** |
| `NSFaceIDUsageDescription` | `Allow $(PRODUCT_NAME) to access your Face ID biometric data.` | `node_modules/expo-secure-store/plugin/build/withSecureStore.js:7` (plugin listado em `app.json:29`) | ❌ **Inglês** | ❌ genérico | ❌ **ÓRFÃ** |

Nenhum texto customizado em pt-BR existe no repositório. **COMPROVADO** — não há `infoPlist` em `app.json` nem opções de plugin (`app.json:27-30` lista os plugins como strings simples, sem array `[nome, opções]`).

### 4.2 Android — `uses-permission` que seriam mescladas

| Permissão | Origem (arquivo:linha) | Mecanismo | Usada de fato? |
|---|---|---|---|
| `android.permission.INTERNET` | **[CORRIGIDO]** `@expo/config-plugins/build/plugins/withAndroidBaseMods.js:62` — template bare do Expo. Também por `expo-file-system` (manifesto `:2` e plugin `withFileSystem.ts:9`) | template do prebuild + merge | ✅ necessária (app é 100% API-driven) |
| `android.permission.SYSTEM_ALERT_WINDOW` | **[CORRIGIDO]** `@expo/config-plugins/build/plugins/withAndroidBaseMods.js:64` — template bare do Expo, manifesto **main** | template do prebuild | ❌ **ÓRFÃ — entra no RELEASE** |
| `android.permission.VIBRATE` | **[CORRIGIDO]** `@expo/config-plugins/build/plugins/withAndroidBaseMods.js:65` — template bare do Expo, manifesto **main** | template do prebuild | ❌ **ÓRFÃ — entra no RELEASE** |
| `android.permission.CAMERA` | `node_modules/expo-image-picker/android/src/main/AndroidManifest.xml:4` | merge de manifest de biblioteca (automático) | ✅ Sim |
| `android.permission.WRITE_EXTERNAL_STORAGE` | `expo-image-picker/android/src/main/AndroidManifest.xml:7`; `expo-file-system/android/src/main/AndroidManifest.xml:3` e `withFileSystem.ts:8`; **e o template bare** (`withAndroidBaseMods.js:68`) | merge + template | ⚠️ legado (ignorada em API ≥ 29/30) |
| `android.permission.READ_EXTERNAL_STORAGE` | `expo-image-picker/android/src/main/AndroidManifest.xml:8`; `expo-file-system/android/src/main/AndroidManifest.xml:4` e `withFileSystem.ts:7`; **e o template bare** (`withAndroidBaseMods.js:67`) | merge + template | ⚠️ legado (substituída por Photo Picker em API ≥ 33) |
| `android.permission.RECORD_AUDIO` | **[CORRIGIDO]** `node_modules/expo-image-picker/plugin/build/withImagePicker.js:34-35` (`withPermissions`, pois `microphonePermission !== false`) | config plugin | ❌ **ÓRFÃ** |
| `android.permission.SYSTEM_ALERT_WINDOW` (debug) | `node_modules/react-native/ReactAndroid/src/debug/AndroidManifest.xml:8` | merge de manifest **apenas em debug** | ✅ ok em si — mas ver a linha do template acima |

> **[CORRIGIDO NA REVISÃO] — duas afirmações da versão original estavam erradas nesta tabela:**
>
> 1. **`INTERNET` não depende do `expo-file-system`.** O template `AndroidManifest.xml` que o `expo prebuild` escreve já declara `INTERNET`. **COMPROVADO** em `lumen_mobile/node_modules/@expo/config-plugins/build/plugins/withAndroidBaseMods.js:56-69` — a função `getAndroidManifestTemplate()` carrega o comentário `Keep in sync with .../templates/expo-template-bare-minimum/android/app/src/main/AndroidManifest.xml` e declara, no manifesto **main**: `INTERNET`, `SYSTEM_ALERT_WINDOW`, `VIBRATE`, `READ_EXTERNAL_STORAGE`, `WRITE_EXTERNAL_STORAGE`. Portanto a ressalva original de §5 ("se remover `expo-file-system`, `INTERNET` precisa ser declarada explicitamente") era **falso alarme**.
> 2. **`SYSTEM_ALERT_WINDOW` NÃO fica restrita ao debug.** A versão original marcava "✅ ok (não entra no release)" com base apenas no manifesto de debug do react-native. O template bare a coloca — junto com `VIBRATE` — no manifesto **main**, logo **entra no release** de um prebuild regenerado. `SYSTEM_ALERT_WINDOW` ("Exibir sobre outros apps") sem funcionalidade correspondente é item de atenção na revisão do Google Play. **Ambas devem entrar em `android.blockedPermissions`** (ver §9).
>
> **Nuance de rigor:** `getAndroidManifestTemplate()` é lida em modo *introspect*, quando o arquivo ainda não existe (`withAndroidBaseMods.js:156-164`). O pacote `expo-template-bare-minimum` **não está instalado** neste repositório, então o conteúdo exato que o prebuild escreveria não pôde ser lido diretamente. Classificação honesta: **COMPROVADO** que o `@expo/config-plugins` instalado declara esse conjunto como o template; **INFERIDO** (a partir do comentário de sincronização) que o prebuild real produz o mesmo conjunto. **Confirmar no manifesto gerado após o primeiro `expo prebuild`.**

**COMPROVADO** por varredura de **todos** os `AndroidManifest.xml` sob `lumen_mobile/node_modules/` (excluindo diretórios `build/`): as **únicas** ocorrências de `uses-permission` são `expo-file-system` (3), `expo-image-picker` (3) e `react-native/ReactAndroid/src/debug` (1). Nenhum outro pacote — `expo`, `expo-modules-core`, `expo-web-browser`, `expo-linking`, `expo-constants`, `expo-asset`, `expo-font`, `expo-splash-screen`, `expo-secure-store`, `expo-auth-session`, `react-native-screens`, `react-native-gesture-handler`, `react-native-reanimated`, `react-native-safe-area-context`, `@react-native-async-storage/async-storage`, `@react-native-picker/picker` — declara permissão.

**[RESOLVIDO NA REVISÃO — era "NÃO DETERMINADO"]** `android.permission.READ_MEDIA_IMAGES` **NÃO** é injetada pelo `expo-image-picker` 16.0.6. **COMPROVADO** por três evidências independentes:
1. `node_modules/expo-image-picker/CHANGELOG.md:46`, sob a seção `## 16.0.0 — 2024-10-22` (linha 42): *"Remove `READ_MEDIA_IMAGES` and `READ_MEDIA_VIDEO` permissions."* (PR expo/expo#31902). A versão instalada é **16.0.6** (`node_modules/expo-image-picker/package.json`), posterior à remoção.
2. O módulo é distribuído como **código-fonte Kotlin**, não como AAR — `find node_modules/expo-image-picker -name '*.aar' -o -name '*.jar'` retorna **vazio**; `android/` contém apenas `build.gradle` e `src/`. Logo `android/src/main/AndroidManifest.xml` é a fonte completa da verdade, sem artefato compilado escondendo permissões. Isso elimina o motivo original da indeterminação.
3. A única referência a `READ_MEDIA_*` no código do módulo é uma **leitura**, não uma declaração: `android/src/main/java/expo/modules/imagepicker/ImagePickerModule.kt:181` faz `checkSelfPermission(..., READ_MEDIA_VISUAL_USER_SELECTED)` para detectar acesso parcial concedido pelo Photo Picker do sistema. Permissão consultada não é permissão requisitada.

**Consequência:** a **Photo and Video Permissions Declaration** do Play Console **não é acionada** por esta dependência. (Reconfirmar no manifesto mesclado após o primeiro build, por higiene.)

---

## 5. Permissões DECLARADAS MAS NÃO USADAS (remover)

| Permissão | Onde nasce | Por que é órfã (evidência) | Como remover |
|---|---|---|---|
| `NSMicrophoneUsageDescription` (iOS) | `node_modules/expo-image-picker/plugin/build/withImagePicker.js:7` | Nenhum call site grava áudio. Ambos os `launchCameraAsync` são só foto e nenhum `launchImageLibraryAsync` pede vídeo — `lumen_mobile/app/(onboarding)/profile.tsx:317` (`mediaTypes: ImagePicker.MediaTypeOptions.Images`) e `lumen_mobile/app/retreats/[id]/payment.tsx:42` (`mediaTypes: ['images'] as any`). Nenhum `videoMaxDuration` / `Videos` no repo. | Em `app.json`, trocar por `["expo-image-picker", { "microphonePermission": false, ... }]` |
| `android.permission.RECORD_AUDIO` (Android) | **[CORRIGIDO]** `node_modules/expo-image-picker/plugin/build/withImagePicker.js:34-35` | idem acima | idem — `microphonePermission: false` também aciona `withBlockedPermissions` (**[CORRIGIDO]** `withImagePicker.js:39-42`) |
| `NSFaceIDUsageDescription` (iOS) | `node_modules/expo-secure-store/plugin/build/withSecureStore.js:7`, ativado por `lumen_mobile/app.json:29` | `expo-secure-store` **nunca é importado**: grep por `SecureStore` / `expo-secure-store` em `app/`, `src/`, `components/` retornou **zero** ocorrências. O armazenamento local usado é `@react-native-async-storage/async-storage` (`lumen_mobile/src/services/push.ts:4`). Nenhuma autenticação biométrica no app. | Remover `"expo-secure-store"` de `app.json:29` **e** a dependência de `lumen_mobile/package.json:33`. **Verificado na revisão:** nenhum outro pacote instalado depende de `expo-secure-store`, então a remoção é segura |
| `android.permission.READ_EXTERNAL_STORAGE` + `WRITE_EXTERNAL_STORAGE` vindas do `expo-file-system` | `node_modules/expo-file-system/android/src/main/AndroidManifest.xml:3-4` e o config plugin `expo-file-system/plugin/src/withFileSystem.ts:6-10` | `expo-file-system` está em `lumen_mobile/package.json:28` mas **nunca é importado** (grep sem ocorrências em `app/`, `src/`, `components/`). Uploads usam `FormData` + `fetch` — `lumen_mobile/app/retreats/[id]/payment.tsx:74-80`. | **[CORRIGIDO — a remediação original não funciona]** ver bloco abaixo |
| **[NOVO NA REVISÃO]** `android.permission.SYSTEM_ALERT_WINDOW` + `android.permission.VIBRATE` | `@expo/config-plugins/build/plugins/withAndroidBaseMods.js:64-65` (template bare do Expo, manifesto **main**) | O app não desenha sobre outros apps nem vibra: grep por `Vibration`, `expo-haptics`, `SYSTEM_ALERT_WINDOW` em `app/`, `src/`, `components/` retorna zero. Entram no **release**. | Adicionar ambas a `android.blockedPermissions` em `app.json` (§9) |
| `WRITE_EXTERNAL_STORAGE` do `expo-image-picker` | `node_modules/expo-image-picker/android/src/main/AndroidManifest.xml:7` | O app nunca escreve na galeria; não há `expo-media-library` nem `saveToLibraryAsync`. | `android.blockedPermissions` em `app.json`. Baixo risco isolado — ignorada em API ≥ 29 |

> **[CORRIGIDO NA REVISÃO] — `expo-file-system` não pode ser removido do projeto.**
>
> A versão original recomendava "remover `expo-file-system` de `package.json`". Isso **não tem o efeito pretendido**. **COMPROVADO:** o próprio pacote `expo@52.0.48` declara `"expo-file-system": "~18.0.12"` em suas `dependencies` (`lumen_mobile/node_modules/expo/package.json`). Tirar a linha 28 de `lumen_mobile/package.json` apenas remove a declaração **direta** — o pacote continua instalado como dependência transitiva de `expo`, continua autolinkado, seu `AndroidManifest.xml` continua sendo mesclado e seu config plugin (que está em `legacyExpoPlugins`) continua rodando `withPermissions([READ_EXTERNAL_STORAGE, WRITE_EXTERNAL_STORAGE, INTERNET])`.
>
> **Remediação correta:** manter a dependência (ou removê-la apenas por higiene de `package.json`) e neutralizar via `android.blockedPermissions` — o único mecanismo que efetivamente remove a permissão do manifesto mesclado. E, como corrigido em §4.2, **não** há risco de perder `INTERNET`: ela vem do template bare do Expo independentemente.

---

## 6. Permissões USADAS MAS NÃO DECLARADAS (quebram em runtime)

**Estas são avaliadas contra o estado ATUAL do repositório** (`ios/Runner/Info.plist` e `android/.../AndroidManifest.xml` Flutter, seção 1).

| Permissão faltante | Chamada que a exige | Consequência |
|---|---|---|
| `NSCameraUsageDescription` — ausente em `lumen_mobile/ios/Runner/Info.plist` (arquivo inteiro, 49 linhas, sem nenhuma chave `NS*`) | `ImagePicker.launchCameraAsync()` — `lumen_mobile/app/(onboarding)/profile.tsx:331` e `lumen_mobile/app/retreats/[id]/payment.tsx:58` | **Crash imediato** do app iOS ao abrir a câmera (iOS mata o processo quando falta purpose string). Antes disso, rejeição automática no upload: **ITMS-90683 / Guideline 5.1.1**. — INFERIDO (comportamento de plataforma), COMPROVADO quanto à ausência da chave |
| `NSPhotoLibraryUsageDescription` — ausente no mesmo arquivo | `ImagePicker.launchImageLibraryAsync()` — `lumen_mobile/app/(onboarding)/profile.tsx:316` e `lumen_mobile/app/retreats/[id]/payment.tsx:41` | Idem: crash + ITMS-90683 |
| `android.permission.CAMERA` — ausente em `lumen_mobile/android/app/src/main/AndroidManifest.xml` (zero `uses-permission` no arquivo) | `ImagePicker.requestCameraPermissionsAsync()` — `profile.tsx:326`, `payment.tsx:53` | `SecurityException` / permissão negada permanentemente. Viria pelo merge do `expo-image-picker` **se** o build fosse Expo — mas o manifesto atual é Flutter e o módulo nem está linkado |
| `android.permission.INTERNET` — ausente do manifesto **main**; presente só no manifesto de **debug** (`lumen_mobile/android/app/src/debug/AndroidManifest.xml:6`) | Todo o app: `lumen_mobile/src/services/api.ts`, Firebase Auth (`lumen_mobile/src/config/firebase.ts:15-16`) | Build de **release** sem rede: nenhuma chamada de API, login impossível. App inteiramente inoperante |

> **[NOTA DA REVISÃO — sobre a alcançabilidade destes quatro itens]** Os quatro são reais e verificados no estado atual do repositório, mas **nenhum deles é independentemente alcançável hoje**, porque o diretório `android/` sequer compila: `lumen_mobile/android/settings.gradle.kts:5-7` faz `file("local.properties").inputStream()` e exige `flutter.sdk`, e `local.properties` não existe nem é versionável. Ou seja, B2/B3 não são "bugs de um app que hoje builda mal" — são consequências diretas de B1, e o app nativo aparentemente **nunca foi buildado a partir destes diretórios**. Isso **não reduz** a severidade (corrigir B1 sem tratar §5/§6 reintroduz os problemas), mas significa que **B1 é o único item que precisa ser priorizado primeiro**; B2/B3 desaparecem ou se transformam ao ser resolvido.

> Observação: `NSPhotoLibraryAddUsageDescription` **não** é necessária — o app não salva imagens na galeria (nenhum `expo-media-library` / `saveToLibraryAsync` no repo). COMPROVADO.

---

## 7. Comportamento quando a permissão é negada

| Fluxo | Tratamento | Evidência | Avaliação |
|---|---|---|---|
| Galeria — foto de perfil | `showAlert('Permissão necessária', 'Precisamos de acesso às suas fotos')` + `return` | `lumen_mobile/app/(onboarding)/profile.tsx:312-315` | Não quebra. **Sem deep link para Ajustes** → usuário que negou definitivamente fica sem saída in-app |
| Câmera — foto de perfil | `showAlert('Permissão necessária', 'Precisamos de acesso à câmera')` + `return` | `lumen_mobile/app/(onboarding)/profile.tsx:327-330` | Idem |
| Galeria — comprovante | `setError('Permissão para acessar a galeria negada')` (mensagem inline) | `lumen_mobile/app/retreats/[id]/payment.tsx:37-40` | Idem. Bloqueia um fluxo **financeiro** (envio de comprovante de retiro) |
| Câmera — comprovante | `setError('Permissão para usar a câmera negada')` | `lumen_mobile/app/retreats/[id]/payment.tsx:54-57` | Idem |
| Push web negado | `savePushDecision('denied')` em AsyncStorage; o card não reaparece | `lumen_mobile/src/services/push.ts:60-61` + `lumen_mobile/app/(tabs)/home.tsx:52-59` | Correto para web. Sem recuperação in-app após negar |
| Falha genérica de push | Retorna `'error'` silenciosamente | `lumen_mobile/src/services/push.ts:62-63` | Usuário não sabe por que não recebe notificação |

**Ponto positivo (COMPROVADO):** as mensagens de negação estão **em português** e o app **degrada sem crash** — os quatro fluxos fazem `return` antes de chamar o picker. Isso satisfaz o requisito de "graceful degradation" das lojas.

**Ponto positivo (COMPROVADO):** `showAlert` tem fallback web funcional (`lumen_mobile/src/utils/alerts.ts:22-29`), então o aviso de permissão aparece também na build web — o `Alert.alert` do react-native-web seria no-op.

**Gap (COMPROVADO por ausência):** nenhuma chamada a `Linking.openSettings()` em nenhum dos quatro fluxos. Recomendado adicionar quando `canAskAgain === false`.

---

## 8. Permissões sensíveis / declarações especiais nas lojas

| Permissão | Apple App Store | Google Play |
|---|---|---|
| **Câmera** | Purpose string obrigatória (Guideline 5.1.1). Em **App Privacy** deve constar coleta de "Fotos ou Vídeos". | Permissão de runtime (dangerous). Deve constar no **Data safety form** |
| **Fotos / galeria (leitura)** | Purpose string obrigatória. App Privacy: "Fotos ou Vídeos" | **[ATUALIZADO NA REVISÃO]** `READ_MEDIA_IMAGES` **não** é injetada pelo `expo-image-picker` 16.0.6 (§4.2, resolvido). O módulo usa o Photo Picker do sistema, que dispensa permissão. **A Photo and Video Permissions Declaration não é acionada** |
| **`READ/WRITE_EXTERNAL_STORAGE`** | n/a | Não é a declaração restrita `MANAGE_EXTERNAL_STORAGE`, mas permissão de storage legada em app novo tende a gerar questionamento na revisão. Recomendo bloquear |
| **`SYSTEM_ALERT_WINDOW` (órfã) — [NOVO NA REVISÃO]** | n/a | "Exibir sobre outros apps". Vem do template bare do Expo no manifesto **main**. Permissão de alta visibilidade para o revisor, sem nenhuma funcionalidade correspondente no app → risco concreto de questionamento. **Bloquear** |
| **`VIBRATE` (órfã) — [NOVO NA REVISÃO]** | n/a | Normal permission (não runtime), risco baixo, mas é ruído desnecessário na ficha da loja. Bloquear por higiene |
| **`RECORD_AUDIO` (órfã)** | `NSMicrophoneUsageDescription` sem uso correspondente → risco de rejeição por Guideline 5.1.1 ("purpose string sem funcionalidade") | Permissão dangerous sem uso → questionamento na revisão + obriga declarar "Áudio" no Data safety indevidamente |
| **Face ID (órfã)** | `NSFaceIDUsageDescription` sem biometria implementada → mesmo risco | n/a |
| **Notificações** | Não aplicável hoje: **não há push nativo** (sem `expo-notifications` em `lumen_mobile/package.json`). Se um dia houver, iOS pede autorização em runtime | Idem. Android 13+ exigiria `POST_NOTIFICATIONS`, hoje não declarada nem necessária |
| **Dados coletados via as permissões** | O comprovante de pagamento (`lumen_mobile/app/retreats/[id]/payment.tsx`) e o formulário de perfil com **CPF** (`lumen_mobile/app/(onboarding)/profile.tsx:353-358` formata CPF) fazem o app coletar **dado financeiro + identificador governamental**. Isso muda a resposta de App Privacy e Data safety | Idem |

---

## 9. Configuração-alvo recomendada (para revisão humana antes de aplicar)

Não apliquei nenhuma mudança (sou read-only para código). O bloco abaixo é **proposta**; os textos em pt-BR precisam de validação de produto/jurídico (ver §10).

```jsonc
// lumen_mobile/app.json — TRECHO PROPOSTO, NÃO APLICADO
"ios": {
  "supportsTablet": true,
  "bundleIdentifier": "com.lumenchristi.lumenplus",
  "infoPlist": {
    "NSCameraUsageDescription": "<TEXTO A DEFINIR: por que a câmera — foto de perfil e comprovante de pagamento>",
    "NSPhotoLibraryUsageDescription": "<TEXTO A DEFINIR: por que a galeria — mesma finalidade>"
  }
},
"android": {
  "package": "com.lumenchristi.lumenplus",
  "permissions": ["android.permission.CAMERA", "android.permission.INTERNET"],
  "blockedPermissions": [
    "android.permission.RECORD_AUDIO",
    "android.permission.READ_EXTERNAL_STORAGE",
    "android.permission.WRITE_EXTERNAL_STORAGE",
    // [ADICIONADAS NA REVISÃO] vêm do template bare do Expo, no manifesto main → release
    "android.permission.SYSTEM_ALERT_WINDOW",
    "android.permission.VIBRATE"
  ]
},
"plugins": [
  "expo-router",
  ["expo-image-picker", {
    "microphonePermission": false,
    "cameraPermission": "<TEXTO A DEFINIR>",
    "photosPermission": "<TEXTO A DEFINIR>"
  }]
  // "expo-secure-store" REMOVIDO — módulo nunca importado
]
```

**Ordem de execução sugerida:**
1. Resolver B1 — remover `lumen_mobile/android/` e `lumen_mobile/ios/` (Flutter morto).
2. Aplicar o bloco acima com textos pt-BR aprovados.
3. Rodar `npx expo prebuild --clean` (ou deixar o EAS prebuildar) e **conferir o `Info.plist` e o `AndroidManifest.xml` gerados**, item por item, contra as §5 e §6.
4. **[CORRIGIDO NA REVISÃO]** Remover `expo-secure-store` do `package.json` (seguro — nada mais depende dele). **Não contar com a remoção de `expo-file-system`**: ele é dependência do próprio pacote `expo` e permanece instalado e autolinkado de qualquer forma; a neutralização real é via `blockedPermissions` (§5).
5. Adicionar `Linking.openSettings()` nos 4 fluxos de negação (§7).
6. **[NOVO NA REVISÃO]** Limpeza opcional fora do escopo de permissões: remover o import comentado de `expo-linear-gradient` em `lumen_mobile/app/(auth)/index.tsx:9` — o pacote não está instalado, e descomentá-lo quebraria o bundle.

---

## 10. Bloqueios humanos (não resolvíveis por código)

1. **Textos de justificativa em pt-BR** — precisam ser escritos e aprovados pela Lumen Christi. Não os inventei: nenhum texto aprovado existe no repositório. Apple exige propósito específico, não genérico.
2. **App Store Connect → App Privacy** — declarar coleta de Fotos/Vídeos, Informações Financeiras (comprovante) e Identificadores Governamentais (CPF). Nenhum arquivo do repo cobre isso.
3. **Google Play Console → Data safety** — mesma declaração; e, se `READ_MEDIA_IMAGES` aparecer no manifesto mesclado, preencher a Photo and Video Permissions Declaration.
4. **Decisão de produto: push nativo** — hoje só existe Web Push (`lumen_mobile/src/services/push.ts`). Se houver push nativo no roadmap, `expo-notifications` + `POST_NOTIFICATIONS` entram no escopo e esta auditoria muda.
5. **Confirmar remoção de `android/` e `ios/`** — decisão de arquitetura com impacto em build; não executei por ser read-only.

---

## 11. Itens NÃO DETERMINADOS

| Item | Motivo |
|---|---|
| ~~Se `android.permission.READ_MEDIA_IMAGES` é injetada pelo `expo-image-picker` 16.0.6~~ | **RESOLVIDO NA REVISÃO — NÃO é injetada.** Ver §4.2: removida na v16.0.0 (CHANGELOG), módulo distribuído como fonte Kotlin (sem AAR), única referência é `checkSelfPermission` de leitura |
| Conteúdo exato do `AndroidManifest.xml` que o `expo prebuild` escreve | O pacote `expo-template-bare-minimum` não está instalado. O conjunto de permissões foi lido do espelho em `@expo/config-plugins/.../withAndroidBaseMods.js:56-69`, que se declara sincronizado com o template. **INFERIDO** — confirmar no manifesto gerado |
| Comportamento exato do EAS Build com `android/` + `ios/` Flutter presentes | INFERIDO da documentação de detecção de workflow bare. Nenhum build foi disparado nesta auditoria |
| Conteúdo do `Info.plist` final de um build EAS de produção | Não existe build gerado no repositório para inspecionar |
| Se `com.example.lumen_mobile` chegou a ser submetido a alguma loja | Fora do alcance do repositório |

---

## 12. Verificação pós-correção (checklist para o próximo build)

- [ ] `lumen_mobile/android/` e `lumen_mobile/ios/` removidos ou substituídos por prebuild Expo
- [ ] `applicationId` / `CFBundleIdentifier` = `com.lumenchristi.lumenplus` (não `com.example.*`)
- [ ] `Info.plist` gerado contém `NSCameraUsageDescription` e `NSPhotoLibraryUsageDescription` **em pt-BR e específicas**
- [ ] `Info.plist` gerado **não** contém `NSMicrophoneUsageDescription` nem `NSFaceIDUsageDescription`
- [ ] `AndroidManifest.xml` mesclado contém `INTERNET` e `CAMERA`
- [ ] `AndroidManifest.xml` mesclado **não** contém `RECORD_AUDIO`
- [ ] **[NOVO NA REVISÃO]** `AndroidManifest.xml` mesclado do **release** não contém `SYSTEM_ALERT_WINDOW` nem `VIBRATE` (vêm do template bare; conferir que `blockedPermissions` as removeu)
- [ ] **[NOVO NA REVISÃO]** Confirmar no manifesto mesclado que `READ_MEDIA_IMAGES` de fato não aparece (esperado: ausente — §4.2)
- [ ] Testar negar câmera e galeria nos 4 fluxos: app não crasha e mostra mensagem em pt-BR
- [ ] Testar negar definitivamente ("Nunca perguntar") e confirmar caminho de recuperação

---

## 13. Log da revisão adversarial (2026-08-06)

Segundo agente, independente, reverificou **cada** achado contra o código-fonte. Método: leitura direta de cada `arquivo:linha` citado, varredura completa de `AndroidManifest.xml` em `node_modules/`, e inspeção do grafo de dependências. Nenhum build executado.

### 13.1 Confirmados sem alteração (evidência bateu linha a linha)

- **B1** — scaffolding Flutter. Todas as 16 evidências conferidas: `AndroidManifest.xml:3,20,31` e comentários `15-18`/`28-29`; `build.gradle.kts:5,9,24,29,42-44`; `MainActivity.kt` (`FlutterActivity`, pacote `com.example.lumen_mobile`); `settings.gradle.kts:7`; `Info.plist:16,20,24`; `web/manifest.json:8`. `git ls-files lumen_mobile/android lumen_mobile/ios` = **58** (exato). Commit `4aac3f0` confirmado. Ausência de `pubspec.yaml`, `lib/`, `.easignore`, `app.config.*` — todas confirmadas.
- **B2** — `Info.plist` sem nenhuma chave `NS*`. Arquivo lido integralmente.
- **B3** — manifesto main com **zero** `uses-permission`; `INTERNET` só em `src/debug/AndroidManifest.xml:6`.
- **A1** — textos default em inglês: `withImagePicker.js:6,7,8` exatos. `applyPermissions` em `@expo/config-plugins/build/ios/Permissions.js:24-38` exato, incluindo a semântica "só omite se `=== false`" (linhas 30-32).
- **`expo-image-picker` auto-aplicado** — `legacyExpoPlugins` de fato na linha **204** e de fato contém `'expo-image-picker'`.
- **`NSFaceIDUsageDescription` órfã** — `withSecureStore.js:7` exato; `app.json:29` exato; zero ocorrências de `SecureStore` em `app/`, `src/`, `components/`.
- **Uso real = só câmera + galeria** — os 8 call sites conferidos um a um, **todos os números de linha corretos**: `profile.tsx:311,313,316,317,326,328,331`; `payment.tsx:36,38,41,42,53,55,58`; `push.ts:4,17,32-35,55,60-61,62-63`; `home.tsx:50`; `alerts.ts:22-29`; `payment.tsx:74,78`; `profile.tsx:353` (formatCPF).
- **Sem push nativo** — `expo-notifications` de fato ausente de `package.json` (deps nas linhas 15-49).
- **Sem `Linking.openSettings()` / `canAskAgain`** — grep confirmou zero ocorrências.
- **Nenhuma outra dependência declara permissão** — reconfirmado por varredura exaustiva, e o resultado é ainda mais restrito do que o afirmado.

### 13.2 Corrigidos

| # | Correção | Impacto |
|---|---|---|
| C1 | `INTERNET` **não** depende do `expo-file-system` — vem do template bare do Expo (`withAndroidBaseMods.js:62`). O alerta de §5 era falso alarme | Remove um risco inexistente |
| C2 | **Achado omitido:** `SYSTEM_ALERT_WINDOW` e `VIBRATE` entram no manifesto **main** (release) pelo template bare (`withAndroidBaseMods.js:64-65`). A versão original marcava `SYSTEM_ALERT_WINDOW` como "✅ ok, não entra no release" | **Adiciona um achado ALTO que faltava** |
| C3 | Remover `expo-file-system` de `package.json` **não funciona**: `expo@52.0.48` o declara em suas próprias `dependencies` | Remediação original era inócua |
| C4 | Citações de linha erradas: `RECORD_AUDIO` está em `withImagePicker.js:34-35` (não `:33`); `withBlockedPermissions` em `:39-42` (não `:37-40`) | Precisão de evidência |
| C5 | `expo-linear-gradient` **não** é um módulo importado — é um import **comentado** (`app/(auth)/index.tsx:9`), ausente de `package.json` e de `node_modules` | Corrige §3.1 |
| C6 | `payment.tsx:42` usa `mediaTypes: ['images'] as any`, não `MediaTypeOptions.Images` | Precisão (conclusão inalterada) |
| C7 | Cadeia de aplicação dos plugins: quem aplica é `withLegacyExpoPlugins` (`:224`) via `getPrebuildConfig.js:59`, não `getAutoPlugins()` (`:195`) | Precisão (conclusão inalterada) |
| C8 | `READ_MEDIA_IMAGES` sai de "NÃO DETERMINADO" para **resolvido: não é injetada** (CHANGELOG v16.0.0 + ausência de AAR + referência ser `checkSelfPermission`) | Fecha um item aberto e destrava a §8 do Play |
| C9 | §1.3 completada com `CFBundleDisplayName` e `UISupportedInterfaceOrientations~ipad`, antes omitidos da enumeração | Completude |

### 13.3 Severidades

Nenhuma severidade da versão original foi considerada inflada. Uma foi **subestimada** (C2: `SYSTEM_ALERT_WINDOW` estava marcada como não-problema; passou a **ALTO**). Registrada em §6 a nota de que B2/B3 não são independentemente alcançáveis — são consequências de B1 —, o que afeta a **ordem de correção**, não a severidade.

### 13.4 Secrets

**Nenhum secret vazou para este documento.** Verificado: o doc não contém chaves, tokens, senhas, DSN nem valores de credencial. As únicas referências a configuração sensível são por **nome de variável** (`EXPO_PUBLIC_FIREBASE_API_KEY`, em `firebase.ts:19`) e por caminho de arquivo, sem valores. Nenhum secret hardcoded foi encontrado nos arquivos inspecionados durante a revisão.
