# Auditoria de Segurança Mobile — Lumen+

**Escopo:** `lumen_mobile/` (app/, src/, app.json, package.json, eas.json, android/, ios/, server.js)
**Data da auditoria:** 2026-08-06
**Método:** leitura estática do código-fonte + `git ls-files` + `git log` + `npm audit`. Sem execução do app, sem build, sem teste dinâmico.
**Modo:** READ-ONLY. Nenhum arquivo de código foi alterado.
**Revisão adversarial:** 2026-08-06, segundo auditor. Veredito **CORRIGIDO** — mérito de todos os achados confirmado, 13 citações `arquivo:linha` corrigidas. Ver **§11**.

> **Convenção de evidência**
> - **COMPROVADO** = li diretamente no arquivo citado.
> - **INFERIDO** = deduzi a partir do que li; não executei para confirmar.
> - **NÃO DETERMINADO** = não consegui estabelecer com o material disponível; o motivo está registrado.
>
> **Nenhum valor de secret foi impresso neste documento.** Onde um secret ou credencial existe, registro apenas `arquivo:linha`.

---

## 1. Sumário executivo

| # | Achado | Severidade | Evidência |
|---|--------|-----------|-----------|
| A-01 | `android/` e `ios/` são scaffolding **Flutter** obsoleto, não prebuild Expo — release Android assinado com **debug keystore** e `applicationId com.example.lumen_mobile` | **BLOCKER** | `lumen_mobile/android/app/build.gradle.kts:9,24,37` |
| A-02 | Path traversal no servidor estático de produção (`server.js`) | **CRITICAL** | `lumen_mobile/server.js:35-36` |
| A-03 | Token de autenticação persistido em **AsyncStorage** (texto claro), não em SecureStore/Keychain — `expo-secure-store` está instalado e declarado mas **nunca é usado** | **HIGH** | `lumen_mobile/src/services/api.ts:13,18-27`; `lumen_mobile/src/config/firebase.ts:53-56`; `lumen_mobile/app.json:29` |
| A-04 | Credencial literal `'dev-password'` embutida no bundle, em dois fluxos de auth | **HIGH** | `lumen_mobile/app/(auth)/login.tsx:71`; `lumen_mobile/app/(auth)/register.tsx:326` |
| A-05 | Cabeçalhos de segurança (CSP/XFO/nosniff) existem só em `vercel.json`, mas o deploy real é Railway (`server.js`) → **nenhum header é aplicado**; e a CSP é `Report-Only` | **HIGH** | `lumen_mobile/vercel.json:11-22`; `lumen_mobile/railway.toml:5`; `lumen_mobile/server.js:52-53` |
| A-06 | UI renderiza `debug_code` / `debug_token` sem nenhuma trava de cliente — confia 100% no gate do backend | **MEDIUM** | `lumen_mobile/app/(auth)/verify-phone.tsx:71-73`; `lumen_mobile/app/(onboarding)/verify-phone.tsx:67-69,207-210`; `lumen_mobile/app/(auth)/verify-email.tsx:64-66,156` |
| A-07 | `.gitignore` do mobile não cobre `*.p8`, `*.p12`, `*.keystore`, `*.jks`, `google-services.json`, `GoogleService-Info.plist`, `*.mobileprovision` | **MEDIUM** | `lumen_mobile/.gitignore:1-12` |
| A-08 | `EXPO_PUBLIC_API_URL` é usada sem validação de esquema — um valor `http://` produz app de produção em cleartext | **MEDIUM** | `lumen_mobile/src/services/api.ts:33-42` |
| A-09 | `Linking.openURL()` com URL vinda do servidor, sem allowlist de esquema/host | **MEDIUM** | `lumen_mobile/app/admin/retreats/[id].tsx:1046` |
| A-10 | Sentry inicializado com `@sentry/react` (SDK **web**) num app React Native → crash reporting nativo provavelmente inoperante | **MEDIUM** | `lumen_mobile/app/_layout.tsx:8,29-39`; `lumen_mobile/package.json:21` |
| A-11 | Sem certificate pinning e sem `networkSecurityConfig` / `NSAppTransportSecurity` declarados | **LOW** | busca sem resultado em `android/`, `ios/`, `app.json` |
| A-12 | `npm audit`: 47 vulnerabilidades em deps de produção (4 críticas) — maioria na toolchain | **LOW** | `npm audit --omit=dev` |

### O que está **correto** (verificado, não é achado)

- **Nenhum `console.*` em `app/` ou `src/`.** `grep -rn "console\." app src` → 0 ocorrências. Não há vazamento de dados sensíveis por log no bundle. (COMPROVADO)
- **Nenhum secret longo hardcoded.** Busca por literais `[A-Za-z0-9_-]{32,}` e por padrões `api_key/secret/token/private_key = "..."` em `app/` e `src/` → só o achado A-04. (COMPROVADO)
- **Nenhum arquivo sensível versionado, nunca.** `git log --all --diff-filter=A` sobre `.env*`, `*.p8`, `*.p12`, `*.keystore`, `*.jks`, `google-services.json`, `GoogleService-Info.plist`, `serviceAccount*`, `*.mobileprovision` → só `backend/.env.example` e `lumen_mobile/.env.example`. **Não há service account nem private key do Firebase no repositório.** (COMPROVADO)
- **`.env.local` existe em disco mas está ignorado e contém apenas chaves `EXPO_PUBLIC_*`** — nenhuma variável de servidor. (COMPROVADO — li apenas os *nomes* das chaves, nunca os valores)
- **Trava anti-fallback de auth em produção.** `MISCONFIGURED = !__DEV__ && IS_DEV_AUTH` bloqueia o app com tela de erro se um build de produção sair sem credenciais Firebase. (`src/config/firebase.ts:27`, `app/_layout.tsx:165`) (COMPROVADO)
- **Stack trace de crash só aparece em `__DEV__`.** (`app/_layout.tsx:59-64`) (COMPROVADO)
- **Sentry com `sendDefaultPii: false`.** (`app/_layout.tsx:34`) (COMPROVADO)
- **Backend rejeita tokens `dev:` quando `AUTH_MODE=PROD`.** (`backend/app/auth/firebase.py:60-64`) (COMPROVADO)
- **Nenhum WebView no app.** `react-native-webview` não é dependência; `expo-web-browser` e `expo-auth-session` estão em `package.json` mas **não são importados em lugar nenhum** de `app/` ou `src/`. (COMPROVADO)
- **Token nunca vai em query string.** É sempre header `Authorization: Bearer`. (`src/services/api.ts:92-94,152-153`) (COMPROVADO)

---

## 2. Achados detalhados

### A-01 — `android/` e `ios/` são scaffolding Flutter obsoleto (BLOCKER)

**COMPROVADO.** As pastas nativas versionadas **não são um prebuild Expo**. São o esqueleto padrão gerado pelo `flutter create`, provavelmente sobra de uma iteração anterior do projeto.

Evidência:

- `lumen_mobile/android/app/build.gradle.kts:5` → `id("dev.flutter.flutter-gradle-plugin")`
- `lumen_mobile/android/app/build.gradle.kts:9` → `namespace = "com.example.lumen_mobile"`
- `lumen_mobile/android/app/build.gradle.kts:24` → `applicationId = "com.example.lumen_mobile"` (com o TODO original do Flutter na linha 23)
- `lumen_mobile/android/settings.gradle.kts:2-9` → resolve `flutter.sdk` de `local.properties` (o `getProperty("flutter.sdk")` está em `:6`)
- `lumen_mobile/android/app/src/main/kotlin/com/example/lumen_mobile/MainActivity.kt`
- `lumen_mobile/ios/Flutter/`, `lumen_mobile/ios/Runner/`, `ios/Runner/Info.plist:20,24` → `$(FLUTTER_BUILD_NAME)`, `$(FLUTTER_BUILD_NUMBER)`
- `lumen_mobile/web/index.html:32` → `<title>lumen_mobile</title>`; `:36` → `<script src="flutter_bootstrap.js" async>`
- **Escopo confirmado por `git ls-files`:** as três pastas estão versionadas — `lumen_mobile/android/` (19 arquivos), `lumen_mobile/ios/` (39), `lumen_mobile/web/` (7). Não é sobra local não rastreada.

**Impacto de segurança direto — o release Android é assinado com a chave de debug:**

```kotlin
// lumen_mobile/android/app/build.gradle.kts:33-39
buildTypes {
    release {
        // TODO: Add your own signing config for the release build.
        // Signing with the debug keys for now, so `flutter run --release` works.
        signingConfig = signingConfigs.getByName("debug")   // ← linha 37
    }
}
```

A debug keystore é pública e idêntica em toda instalação do Android SDK. Um APK assinado com ela pode ser substituído por qualquer terceiro, e o Play Store rejeita o upload.

**Impacto de identidade:** `com.example.lumen_mobile` ≠ `com.lumenchristi.lumenplus` declarado em `app.json:18` (`ios.bundleIdentifier`) e `app.json:25` (`android.package`). O `Info.plist` também traz `CFBundleName = lumen_mobile` (`:16`) e `CFBundleDisplayName = Lumen Mobile` (`:8`).

**Impacto de permissões / privacidade:**
- `android/app/src/main/AndroidManifest.xml` **não declara `INTERNET`** (só os manifests `debug` e `profile` declaram) e não declara nenhuma permissão de câmera/mídia.
- `ios/Runner/Info.plist` **não tem `NSCameraUsageDescription` nem `NSPhotoLibraryUsageDescription`**, embora o app use `expo-image-picker` com câmera e galeria (`app/(onboarding)/profile.tsx:311,326`; `app/retreats/[id]/payment.tsx:36,53`). Ausência dessas strings é rejeição automática na App Review e crash em runtime ao pedir a permissão.

**INFERIDO:** com `android/` e `ios/` presentes, o EAS Build entra em modo *bare workflow* e usa esses projetos nativos em vez de rodar `expo prebuild`. Isso faria o build tentar compilar um projeto Flutter que não corresponde ao app. **NÃO DETERMINADO** se o EAS falha ou se produz um artefato errado — não executei nenhum build.

**Correção recomendada (não aplicada):** remover `lumen_mobile/android/`, `lumen_mobile/ios/` e `lumen_mobile/web/` do versionamento e deixar o `expo prebuild` gerá-los a partir de `app.json`; ou, se o bare workflow for intencional, regerar os projetos nativos com `npx expo prebuild --clean` e configurar signing real via EAS credentials.

---

### A-02 — Path traversal no servidor estático de produção (CRITICAL)

**COMPROVADO.**

```js
// lumen_mobile/server.js:35-36
const urlPath = req.url.split('?')[0];
let filePath = path.join(DIST, urlPath);
```

`req.url` é o *request target* bruto: o parser HTTP do Node **não normaliza** segmentos `..`. `path.join` resolve `..` e sai de `DIST`. Uma requisição crua `GET /../package.json HTTP/1.1` (ou `/../../<qualquer coisa>`) escapa do diretório servido. O `existsSync` na linha **39** apenas decide se cai no fallback de SPA — não faz nenhuma contenção de caminho.

Não há `decodeURIComponent`, então `%2e%2e` **não** traversa; o vetor é o `..` literal, que qualquer cliente HTTP não-navegador envia sem problema.

Superfície exposta: tudo no filesystem do container Railway legível pelo processo Node — incluindo `package.json`, `server.js`, e qualquer arquivo de configuração montado ao lado de `dist/`.

**Escopo:** este arquivo serve o build **web** (`expo export --platform web`) no Railway (`railway.toml:5` → `startCommand = "node server.js"`; corroborado por `package.json:6` → `"start": "node server.js"`). Não afeta os binários iOS/Android, mas vive dentro de `lumen_mobile/` e compartilha o mesmo código de aplicação, então entra nesta auditoria.

Agravante: `server.js` está em `ignorePatterns` do ESLint (`lumen_mobile/.eslintrc.js:64`) — nenhuma análise estática passa por ele.

**Calibração de severidade (revisão adversarial):** a vulnerabilidade é leitura arbitrária de arquivo **não autenticada** — sem escrita, sem RCE. O alcance real é "tudo que o processo Node consegue ler no container", que num deploy Railway é o código-fonte e o `package.json`, não os segredos (Railway injeta variáveis por env, não por arquivo em disco). **CRITICAL** é defensável pela ausência de autenticação e pela trivialidade da exploração; um avaliador conservador registraria **HIGH**. A classificação foi mantida — a divergência fica documentada.

---

### A-03 — Token de auth em AsyncStorage, não em SecureStore (HIGH)

**COMPROVADO.** Duas superfícies, ambas em armazenamento não criptografado:

**(a) Token DEV**
```ts
// lumen_mobile/src/services/api.ts:13,18-27
export const DEV_TOKEN_KEY = 'lumen_dev_token';
const AsyncStorage = () => require('@react-native-async-storage/async-storage').default;
export const getDevToken   = () => AsyncStorage().getItem(DEV_TOKEN_KEY);
export const setDevToken   = (token: string) => AsyncStorage().setItem(DEV_TOKEN_KEY, token);
export const removeDevToken = () => AsyncStorage().removeItem(DEV_TOKEN_KEY);
```

**(b) Sessão Firebase em produção**
```ts
// lumen_mobile/src/config/firebase.ts:53-56
const AsyncStorage = require('@react-native-async-storage/async-storage').default;
const { getReactNativePersistence } = require('firebase/auth');
return initializeAuth(app, { persistence: getReactNativePersistence(AsyncStorage) });
```

O refresh token do Firebase — a credencial de longa duração da sessão — é gravado pelo `getReactNativePersistence(AsyncStorage)` em texto claro: SQLite/arquivo no sandbox do app no Android, `NSUserDefaults`/arquivo no iOS. Nenhum dos dois é Keychain nem EncryptedSharedPreferences. Em dispositivo com root/jailbreak, ou em backup não criptografado do iTunes/ADB, o token é legível.

**O agravante desta descoberta:** `expo-secure-store` **está instalado** (`package.json:33`) e **declarado como plugin** (`app.json:29`), mas `grep -rn "SecureStore\|expo-secure-store" app src` retorna **zero** ocorrências. A infraestrutura de armazenamento seguro foi provisionada e nunca conectada. A correção é de baixo risco: trocar o `AsyncStorage` das duas chamadas acima por um adaptador `SecureStore` (com fallback `AsyncStorage` só em `Platform.OS === 'web'`, onde SecureStore não existe).

O uso de AsyncStorage para preferência de tema (`src/theme/ThemeContext.tsx:47,61`) e decisão de push (`src/services/push.ts:9,13`) é adequado — não são dados sensíveis.

---

### A-04 — Credencial `'dev-password'` hardcoded no bundle (HIGH)

**COMPROVADO.** Duas ocorrências, ambas literais no código que vai para o bundle:

```
lumen_mobile/app/(auth)/login.tsx:71
lumen_mobile/app/(auth)/register.tsx:326
```

Ambas montam o corpo de `POST /auth/login` (e `/auth/register`) com `password: 'dev-password'` quando `IS_DEV_AUTH` é verdadeiro.

O gate no cliente é frágil: `IS_DEV_AUTH = !process.env.EXPO_PUBLIC_FIREBASE_API_KEY` (`src/config/firebase.ts:19`). Ou seja, **o modo dev-auth ativa por ausência de configuração**, não por decisão explícita. Um build sem a env var cai nesse caminho.

**Contexto do backend (COMPROVADO, mitiga a severidade real):**
- `backend/app/api/routes/auth.py:138-146` — `/auth/login` retorna 501 quando `settings.auth_mode != "DEV"`.
- `backend/app/auth/firebase.py:60-65` — tokens com prefixo `dev:` são explicitamente rejeitados em modo PROD.
- `backend/app/settings.py:145` (`def validate_production_settings`), com a checagem em `:151-152` → `if self.auth_mode == "DEV": errors.append("AUTH_MODE deve ser PROD em produção")`.

**Porém**, em modo DEV o backend **não valida senha nenhuma**:
```python
# backend/app/api/routes/auth.py:158
# TODO: Validar senha (quando implementar auth real com Firebase)
```
Qualquer e-mail cadastrado gera token. O token é `dev:{user.id}:{email}` (`auth.py:128,161`) — string previsível, sem assinatura. Se `AUTH_MODE=DEV` vazar para qualquer ambiente com dados reais, é takeover total de qualquer conta com o e-mail conhecido.

Defesa em profundidade recomendada: remover completamente o caminho `IS_DEV_AUTH` dos builds de release (guardar com `__DEV__` além do check de env var), para que a string e a lógica não cheguem ao bundle de produção.

---

### A-05 — Headers de segurança não aplicados no deploy real (HIGH)

**COMPROVADO.** `lumen_mobile/vercel.json:11-22` define `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy` e uma CSP detalhada.

Dois problemas:

1. **A plataforma de deploy é Railway, não Vercel.** `lumen_mobile/railway.toml:1-5` define `buildCommand = "npm run build"` e `startCommand = "node server.js"`. O `server.js` escreve apenas `Content-Type` (`server.js:52-53`). Nenhum dos headers do `vercel.json` é aplicado no host que realmente serve o app. O `CLAUDE.md` do projeto confirma Railway como plataforma de backend/deploy.
2. **A CSP é `Content-Security-Policy-Report-Only`** (`vercel.json:16`), ou seja, não bloqueia nada mesmo onde é aplicada. E não há `report-uri`/`report-to` na diretiva — os relatórios não vão a lugar nenhum.

**INFERIDO:** o app web em Railway roda sem CSP, sem proteção de clickjacking e sem `nosniff`. **NÃO DETERMINADO** se existe um proxy/CDN à frente do Railway que injete headers — não inspecionei a infraestrutura, apenas o repositório.

Nota adicional: a CSP inclui `'unsafe-inline' 'unsafe-eval'` em `script-src`. Para um bundle Expo/Metro isso é frequentemente inevitável, mas vale registrar que reduz muito o valor da política mesmo se ela for promovida a enforced.

---

### A-06 — `debug_code` / `debug_token` renderizados sem trava de cliente (MEDIUM)

**COMPROVADO.** O cliente exibe o código OTP na tela sempre que o backend o devolver, sem checar `__DEV__`:

| Local | Comportamento |
|---|---|
| `app/(auth)/verify-phone.tsx:71-73` | `if (response.debug_code) showAlert('DEV Mode', \`Código: ${response.debug_code}\`)` |
| `app/(onboarding)/verify-phone.tsx:67-69` e `:207-210` | Guarda em estado e renderiza card `🛠️ Código de teste: {debugCode}` |
| `app/(auth)/verify-email.tsx:64-66` e `:156` | Guarda `debug_token` e renderiza card DEV; `:81-85` usa o token para auto-confirmar o e-mail |

**Contexto do backend (COMPROVADO, mitiga):** `backend/app/api/verification_routes.py:173,344` só populam esses campos quando `settings.is_dev and settings.debug_verification_code`.

**Por que ainda é um achado:** a proteção é 100% server-side. Um flip acidental de `DEBUG_VERIFICATION_CODE` em produção converte imediatamente a verificação de telefone e de e-mail em no-op — o app entrega o código ao próprio atacante na tela. Um `if (__DEV__ && response.debug_code)` no cliente torna a falha impossível de explorar em builds de loja, a custo zero.

Registro também que `debug_code`/`debug_token` fazem parte do contrato de tipos público do app (`src/types/index.ts:376`, `src/services/index.ts:369`).

---

### A-07 — `.gitignore` não cobre artefatos de assinatura mobile (MEDIUM)

**COMPROVADO.** `lumen_mobile/.gitignore` (12 linhas, íntegro):

```
expo-env.d.ts
.env
.env.local
.env.*.local
.vercel
```

Não cobre: `*.p8` (APNs auth key), `*.p12` / `*.cer` (certificados iOS), `*.keystore` / `*.jks` (Android), `*.mobileprovision`, `google-services.json`, `GoogleService-Info.plist`, `serviceAccountKey.json`.

O `.gitignore` **raiz** cobre `.env` e `.env.*` (com exceção para `.env.example`) mas nada de mobile signing.

Cobertura parcial existente: `lumen_mobile/android/.gitignore:12-14` ignora `key.properties` (`:12`), `**/*.keystore` (`:13`), `**/*.jks` (`:14`) — mas é o arquivo gerado pelo Flutter (ver A-01) e só vale dentro de `android/`. Se `android/` for removido no fix de A-01, essa cobertura desaparece junto.

**Estado atual verificado (COMPROVADO):** nenhum arquivo desses tipos existe no repositório nem existiu no histórico (`git log --all --diff-filter=A`). O risco é **prospectivo** — na primeira vez que alguém rodar `eas credentials` localmente ou baixar a chave APNs, ela pode entrar num commit sem aviso.

Efeito colateral menor observado: `lumen_mobile/.env.staging.example` existe em disco mas **não é versionado**, porque o padrão `.env.*` do `.gitignore` raiz o captura e a exceção `!.env.example` não o cobre. O template de staging não chega a quem clona o repo.

---

### A-08 — `EXPO_PUBLIC_API_URL` sem validação de esquema (MEDIUM)

**COMPROVADO.**

```ts
// lumen_mobile/src/services/api.ts:32-43
const getBaseUrl = () => {
  if (process.env.EXPO_PUBLIC_API_URL) {
    return process.env.EXPO_PUBLIC_API_URL;   // ← aceito sem checar https://
  }
  if (!__DEV__) {
    return 'https://api.lumenplus.app';
  }
  if (Platform.OS === 'android') return 'http://10.0.2.2:8000';
  return 'http://localhost:8000';
};
```

O fallback padrão de produção é HTTPS (linha 38) — correto. Os `http://` das linhas 41-42 só são alcançáveis com `__DEV__` verdadeiro — aceitável.

O buraco é a linha 34: `EXPO_PUBLIC_API_URL` tem prioridade absoluta e é usada crua, dev ou prod. Um `http://` nessa variável — copiado de um `.env` de staging, digitado errado no painel do EAS — produz um build de loja falando cleartext, enviando `Authorization: Bearer <token>` em claro. Nada no código nem no build detecta isso.

Mitigação parcial não configurada: ver A-11 (sem ATS/networkSecurityConfig explícitos que bloqueariam cleartext na camada de plataforma).

Registro relacionado: `lumen_mobile/.env.staging.example:5` aponta para `https://backend-staging.up.railway.app`, enquanto o host de staging real é `https://backend-staging-staging-3d47.up.railway.app` (confirmado por `vercel.json:17`, o *valor* da CSP, que lista o host real na `connect-src`). O template está defasado — drift de configuração, severidade informativa.

---

### A-09 — `Linking.openURL()` com URL controlada pelo servidor (MEDIUM)

**COMPROVADO.** Duas chamadas em `lumen_mobile/app/admin/retreats/[id].tsx`:

- **Linha 1046:** `Linking.openURL(reg.payment_proof_url!)` — a URL vem do payload da API (comprovante de pagamento enviado por usuário). Não há validação de esquema nem de host. `Linking.openURL` no React Native despacha **qualquer** esquema registrado no dispositivo, não só `https:` — inclui deep links de outros apps, `tel:`, `intent:` no Android. Se um usuário conseguir gravar um `payment_proof_url` arbitrário no backend, o admin que clicar em "Comprovante" dispara essa URL. É um XSS-equivalente de mobile por confusão de esquema.
  - **NÃO DETERMINADO:** se o backend valida/normaliza `payment_proof_url` na escrita. Não auditei esse caminho do backend nesta tarefa.
  - Correção sugerida: rejeitar tudo que não seja `https://` (e idealmente restringir ao host de storage esperado) antes de chamar `openURL`.

- **Linha 718:** `Linking.openURL(\`${api.baseUrl}/admin/retreats/${id}/export\`)` — URL construída internamente, sem token na query string (bom: nenhum vazamento de credencial em URL). Porém, por abrir no navegador externo, o header `Authorization` não acompanha e o endpoint protegido deve responder 401. Isso é **defeito funcional**, não de segurança; registro aqui porque a tentação de "corrigir" colocando o token na query string seria um vazamento sério.

---

### A-10 — Sentry web SDK num app React Native (MEDIUM)

**COMPROVADO.**

```ts
// lumen_mobile/app/_layout.tsx:8
import * as Sentry from '@sentry/react';
```
`package.json:21` → `"@sentry/react": "^10.45.0"`. O pacote `@sentry/react-native` **não** está nas dependências.

`@sentry/react` é o SDK de browser: depende de `window`, `document`, `XMLHttpRequest` e do handler global de erros do DOM. Em iOS/Android nativos, a captura de crash nativa e o handler global do RN não são instrumentados.

**INFERIDO:** builds nativos não reportam crashes ao Sentry, ou reportam de forma parcial/inconsistente. **NÃO DETERMINADO** se o SDK web falha silenciosamente ou lança em runtime no Hermes — não executei o app.

Consequência de segurança: perda de telemetria de crash em produção mobile significa que uma exploração ativa que derrube o app passa despercebida. A configuração em si está correta (`sendDefaultPii: false`, `enabled` condicional ao DSN) — o problema é o pacote escolhido.

`Sentry.ErrorBoundary` (`app/_layout.tsx:168`) continua funcionando como boundary React em qualquer plataforma; o que não funciona é o transporte/instrumentação nativa.

---

### A-11 — Sem certificate pinning e sem política de rede declarada (LOW)

**COMPROVADO por ausência.** Busca por `usesCleartextTraffic`, `network_security_config`, `NSAppTransportSecurity`, `NSAllowsArbitraryLoads` em `lumen_mobile/android/`, `lumen_mobile/ios/` e `lumen_mobile/app.json` → **zero ocorrências**.

Situação:
- **iOS:** sem chave `NSAppTransportSecurity` no `Info.plist`, o ATS padrão da Apple já bloqueia HTTP em claro. Isso mitiga A-08 no iOS. (Nota: o `Info.plist` atual é o do Flutter — ver A-01. Após regerar via prebuild, confirmar que nenhuma exceção de ATS foi introduzida.)
- **Android:** `usesCleartextTraffic` sem declaração explícita segue o default por `targetSdk`. Como `targetSdk` vem de `flutter.targetSdkVersion` (`android/app/build.gradle.kts:28`), o valor efetivo é **NÃO DETERMINADO** neste repositório — depende do SDK Flutter instalado na máquina de build, que não existe aqui.
- **Certificate pinning:** ausente em ambas as plataformas. Para um app que trafega dados pessoais sob LGPD (perfis, documentos, comprovantes de pagamento), pinning é uma defesa esperada contra MITM com CA comprometida ou proxy corporativo. Não é bloqueador de loja.

Recomendação: declarar explicitamente em `app.json` (`android.usesCleartextTraffic: false` e, se necessário, `ios.infoPlist.NSAppTransportSecurity`) para que a política seja versionada e não dependa de default de plataforma.

---

### A-12 — Dependências vulneráveis (LOW para o app, informativo)

**COMPROVADO.** `npm audit --omit=dev` em `lumen_mobile/`:

```
47 vulnerabilities (1 low, 15 moderate, 27 high, 4 critical)
```

Críticas: `protobufjs`, `shell-quote`, `tar`, `websocket-driver`.
Altas mais relevantes: `ws` (5 caminhos).

Cadeias de dependência observadas:
- `tar` → `effects: ["@expo/cli", "cacache"]` — **toolchain de build**, não entra no bundle.
- `ws` → todos os caminhos são `metro`, `react-devtools-core`, `@react-native/dev-middleware`, `react-native` — **dev server**, não entra no bundle de release.
- `shell-quote`, `websocket-driver` — **INFERIDO** toolchain (padrão típico de Metro/webpack-dev-server).
- `protobufjs` — nó raiz em `node_modules/protobufjs`. **INFERIDO** que entra via `firebase` (cadeia gRPC/Firestore). Como o app importa apenas `firebase/app` e `firebase/auth` (`src/config/firebase.ts:15-16`) e nunca Firestore, **INFERIDO** que não é alcançado em runtime. **NÃO DETERMINADO** se o Metro o inclui no bundle final — isso exigiria inspecionar o output de `expo export`, que não executei.

Conclusão: o número absoluto (47) assusta, mas a superfície real de risco em runtime mobile é pequena. Vale um `npm audit fix` (não-breaking) para reduzir ruído, e uma verificação dirigida se `protobufjs` aparece no bundle exportado.

---

## 3. Inventário completo de `EXPO_PUBLIC_*`

Toda variável `EXPO_PUBLIC_*` é **inlinada no bundle JavaScript** pelo Metro e é trivialmente extraível de qualquer APK/IPA. Só pode conter dado público.

| Variável | Onde é lida | É secreta? | Veredito |
|---|---|---|---|
| `EXPO_PUBLIC_FIREBASE_API_KEY` | `src/config/firebase.ts:19,38` | Não | **OK.** A Firebase Web API key é um identificador público por design — o controle de acesso é feito por Firebase Security Rules e por restrições de referrer/app no Google Cloud Console, não por sigilo da chave. |
| `EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN` | `src/config/firebase.ts:39` | Não | OK |
| `EXPO_PUBLIC_FIREBASE_PROJECT_ID` | `src/config/firebase.ts:40` | Não | OK |
| `EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET` | `src/config/firebase.ts:41` | Não | OK |
| `EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` | `src/config/firebase.ts:42` | Não | OK |
| `EXPO_PUBLIC_FIREBASE_APP_ID` | `src/config/firebase.ts:43` | Não | OK |
| `EXPO_PUBLIC_FIREBASE_MEASUREMENT_ID` | `src/config/firebase.ts:44` | Não | OK |
| `EXPO_PUBLIC_API_URL` | `src/services/api.ts:34-35` | Não | OK como dado, **mas ver A-08** — falta validação de esquema `https://` |
| `EXPO_PUBLIC_SENTRY_DSN` | `app/_layout.tsx:30,38` | Não | **OK.** DSN de cliente Sentry é público por design (só permite escrita de eventos). Nunca use aqui um token de auth do Sentry. |
| `EXPO_PUBLIC_ENVIRONMENT` | `app/_layout.tsx:31` | Não | OK |
| `EXPO_PUBLIC_APP_VERSION` | `app/_layout.tsx:32` | Não | OK |

**Veredito: nenhuma variável `EXPO_PUBLIC_*` contém segredo.** Nenhum achado CRÍTICO nesta categoria. (COMPROVADO — auditei os *nomes* e os *usos*; não li nem reproduzo valores.)

Fonte de verdade dos nomes: `lumen_mobile/.env.example:6-20`, `lumen_mobile/.env.staging.example:5`, e as chaves presentes em `lumen_mobile/.env.local` (arquivo ignorado pelo git; li apenas os nomes das chaves, todas `EXPO_PUBLIC_*`, nenhuma variável de servidor).

---

## 4. Firebase — confirmação de ausência de credencial privada

**COMPROVADO.** Verificações realizadas:

- `find` por `google-services.json`, `GoogleService-Info.plist`, `*serviceAccount*`, `*.p8`, `*.p12`, `*.keystore`, `*.jks`, `*.pem`, `*.key` em todo o repositório (excluindo `node_modules/`) → apenas dois `cacert.pem` dentro de `backend/.venv/Lib/site-packages/` (bundles de CA raiz do `certifi`, benignos e não versionados).
- `git ls-files` com os mesmos padrões → apenas `backend/.env.example` e `lumen_mobile/.env.example`.
- `git log --all --diff-filter=A --name-only` com os mesmos padrões → idem. **Nunca houve** service account ou private key no histórico.

Do lado do cliente, a config Firebase é montada exclusivamente a partir de `EXPO_PUBLIC_FIREBASE_*` (`src/config/firebase.ts:37-45`) — todos campos públicos. Nenhum Admin SDK, nenhum `credential.cert()`, nenhuma private key no app mobile.

**Conclusão: OK.** Ver A-07 para o risco prospectivo de que um `google-services.json` ou uma `.p8` futura não seja bloqueada pelo `.gitignore`.

---

## 5. Endpoints de dev, menus secretos e usuários de teste

| Verificação | Resultado |
|---|---|
| Menu/tela de debug oculta | **Nenhum encontrado.** Todas as rotas em `app/` são funcionais; não há rota `/debug`, `/dev`, nem gesto secreto. (COMPROVADO) |
| Banner de debug em produção | **Um encontrado:** card `🛠️ Código de teste` / `🛠️ Modo DEV` — ver A-06. Renderização condicionada apenas a o backend devolver o campo. |
| Usuários de teste hardcoded | **Nenhum.** Busca por `admin@`, `@example.com`, `@teste`, `senha123`, `password123` em `app/` e `src/` → zero. (COMPROVADO) |
| Credencial hardcoded | **Uma:** `'dev-password'` — ver A-04. |
| Endpoint de dev apontado pelo app | `http://10.0.2.2:8000` e `http://localhost:8000`, ambos gated por `__DEV__` (`src/services/api.ts:41-42`). Aceitável. |
| Guard de rota admin | `app/admin/_layout.tsx:16,32` verifica `global_roles` contra `['DEV','ADMIN','ANALISTA']` via `/auth/me`. **É guard de UX, não de segurança** — a autorização real precisa estar no backend (fora do escopo desta auditoria). Nota: o role `'DEV'` é aceito como role administrativa no cliente. |
| Rotas `/dev` no backend | `backend/app/api/routes/dev.py:175,236` fazem `if not is_dev: ...`. Fora do escopo mobile; registrado para rastreabilidade. |

---

## 6. WebView, tráfego em claro, validação de certificado

| Item | Estado | Evidência |
|---|---|---|
| WebView | **Ausente.** `react-native-webview` não é dependência; nenhum `<WebView>` em `app/` ou `src/`. | `package.json`; `grep -rniE "webview" app src` → 0 |
| `expo-web-browser` | Declarado em `package.json:36`, **nunca importado**. Dependência morta. | `grep -rn "expo-web-browser" app src` → 0 |
| `expo-auth-session` | Declarado em `package.json:26`, **nunca importado**. Dependência morta. | `grep -rn "expo-auth-session" app src` → 0 |
| `serve` | Declarado em `package.json:46`, **nunca usado** — o `start` roda `node server.js` (`package.json:6`). Terceira dependência morta, não registrada na auditoria original. | `package.json:6,46` |
| Tráfego em claro | Fallbacks `http://` gated por `__DEV__`; risco real via `EXPO_PUBLIC_API_URL` — ver A-08 | `src/services/api.ts:32-43` |
| `networkSecurityConfig` / ATS | Não declarados — ver A-11 | busca sem resultado |
| Certificate pinning | Ausente — ver A-11 | busca sem resultado |
| Deep link scheme | `"scheme": "lumenplus"` declarado. Nenhum handler de deep link customizado que consuma parâmetros não confiáveis foi encontrado em `app/`. **NÃO DETERMINADO** se o expo-router expõe alguma rota sensível por deep link sem re-autenticação — exigiria teste dinâmico. | `app.json:8` |
| Service Worker (web) | `public/sw.js` — payload de push é `event.data.json()` (`:3`) e `notificationclick` usa `data.url` sem validação de esquema/origem. **Correção da revisão adversarial:** a chamada perigosa é `clients.openWindow(url)` em `:27`, que abre **qualquer** URL do payload numa janela nova. O `client.navigate(url)` em `:23` está atrás de um check em `:22` (`client.url.includes(self.location.origin)`) — mas esse check valida a origem do *cliente já aberto*, não a do destino, então também navega para URL externa. Superfície web apenas; o servidor de push é o próprio backend autenticado. Severidade informativa. | `lumen_mobile/public/sw.js:3,18,22-23,27` |

---

## 7. `.gitignore` — matriz de cobertura

| Padrão | `.gitignore` raiz | `lumen_mobile/.gitignore` | `lumen_mobile/android/.gitignore` | Veredito |
|---|---|---|---|---|
| `.env` | ✅ linha 4 | ✅ linha 9 | — | OK |
| `.env.*` | ✅ linha 5 (com `!.env.example`) | ✅ `.env.local`, `.env.*.local` | — | OK |
| `*.p8` (APNs key) | ❌ | ❌ | ❌ | **Falta** |
| `*.p12` / `*.cer` | ❌ | ❌ | ❌ | **Falta** |
| `*.keystore` | ❌ | ❌ | ✅ linha 13 | Parcial (só sob `android/`) |
| `*.jks` | ❌ | ❌ | ✅ linha 14 | Parcial (só sob `android/`) |
| `key.properties` | ❌ | ❌ | ✅ linha 12 | Parcial |
| `*.mobileprovision` | ❌ | ❌ | ❌ | **Falta** |
| `google-services.json` | ❌ | ❌ | ❌ | **Falta** |
| `GoogleService-Info.plist` | ❌ | ❌ | ❌ | **Falta** |
| `serviceAccount*.json` | ❌ | ❌ | ❌ | **Falta** |
| `.expo/` | ✅ | — | — | OK (verificado: não versionado) |
| `.vercel` | ❌ | ✅ linha 12 | — | OK |
| `dist/` | ✅ | — | — | OK (verificado: não versionado) |
| `node_modules/` | ✅ | — | — | OK |

Ver A-07. Correção sugerida: um bloco em `lumen_mobile/.gitignore` com `*.p8`, `*.p12`, `*.cer`, `*.keystore`, `*.jks`, `*.mobileprovision`, `google-services.json`, `GoogleService-Info.plist`, `**/serviceAccount*.json`, `key.properties` — independente do destino de `android/`.

---

## 8. O que esta auditoria NÃO cobriu

Registro explícito para não gerar falsa sensação de cobertura:

- **NÃO DETERMINADO — comportamento em runtime.** Nada foi executado: nem app, nem build, nem EAS. Todas as conclusões sobre o que acontece em um binário de loja são inferência a partir do código.
- **NÃO DETERMINADO — conteúdo do bundle exportado.** Não rodei `expo export` nem inspecionei `dist/`. Afirmações sobre "o que entra no bundle" seguem a semântica documentada do Metro para `EXPO_PUBLIC_*` e para literais de string, não uma verificação do artefato.
- **NÃO DETERMINADO — autorização server-side.** Guards de role no cliente foram mapeados; se o backend enforce as mesmas regras é assunto de auditoria de backend.
- **NÃO DETERMINADO — validação de `payment_proof_url` na escrita** (ver A-09).
- **NÃO DETERMINADO — `targetSdk` efetivo do Android** (ver A-11), porque vem do SDK Flutter ausente nesta máquina.
- **NÃO DETERMINADO — headers HTTP realmente servidos em produção.** Só li a configuração no repositório; não fiz requisição ao host.
- **NÃO COBERTO — segurança do backend, do Strapi, e da infraestrutura Railway.**
- **NÃO COBERTO — análise dinâmica:** MITM proxy, inspeção de tráfego real, engenharia reversa de binário, teste de deep link.

---

## 9. Ordem de correção sugerida

Priorizada por (severidade × esforço), sem nenhuma alteração aplicada por esta auditoria.

**Antes de qualquer submissão a loja:**
1. **A-01** — resolver a situação `android/` + `ios/` Flutter. É pré-requisito de tudo: sem isso não existe build de loja válido, e o signing com debug key é rejeição automática.
2. **A-02** — corrigir o path traversal em `server.js` (resolver e verificar contenção do caminho dentro de `DIST` antes de ler).
3. **A-03** — migrar token de auth e persistência Firebase para `expo-secure-store`. A dependência já está instalada; é troca de adaptador.

**Antes do lançamento público:**
4. **A-04** e **A-06** — envolver todo caminho dev-auth e toda renderização de `debug_*` em `__DEV__`, para que nem a lógica nem as strings cheguem ao build de release.
5. **A-05** — aplicar headers de segurança no `server.js` (o host real) e promover a CSP de `Report-Only` a enforced com `report-to` configurado.
6. **A-08** — validar que `EXPO_PUBLIC_API_URL` começa com `https://` quando `!__DEV__`, falhando o build/boot caso contrário.
7. **A-07** — ampliar `.gitignore` antes que qualquer credencial de assinatura seja gerada localmente.

**Higiene, sem urgência de lançamento:**
8. **A-10** — trocar `@sentry/react` por `@sentry/react-native`.
9. **A-09** — allowlist de esquema em `Linking.openURL`.
10. **A-11** — declarar política de rede explicitamente em `app.json`; avaliar pinning.
11. **A-12** — `npm audit fix` não-breaking; remover deps mortas (`expo-web-browser`, `expo-auth-session`).
12. Atualizar `lumen_mobile/.env.staging.example:5` para o host de staging real e garantir que o arquivo seja versionado (hoje é capturado pelo padrão `.env.*` do `.gitignore` raiz).

---

## 10. Bloqueios que exigem ação humana

Itens que não podem ser resolvidos por leitura ou alteração de código — dependem de decisão ou de acesso a console externo.

| # | Ação humana necessária | Plataforma | Por quê |
|---|---|---|---|
| H-01 | Decidir e comunicar: `android/`/`ios/` devem ser **removidos** (managed workflow, prebuild no EAS) ou **regerados** com `npx expo prebuild --clean` (bare workflow)? | Repositório / decisão de arquitetura | A escolha muda toda a estratégia de build e de credenciais. Não posso decidir isso por leitura de código — ver A-01. |
| H-02 | Gerar e registrar credenciais de assinatura reais: keystore/upload key Android e certificado + provisioning profile iOS, via `eas credentials`. | Expo/EAS + Google Play Console + Apple Developer | Hoje o release Android está configurado para a debug keystore (`android/app/build.gradle.kts:39`). Envolve chaves privadas — fora do que posso ou devo manipular. |
| H-03 | Confirmar o valor de `EXPO_PUBLIC_API_URL` configurado no perfil `production` do EAS e verificar que começa com `https://`. | Expo/EAS (painel ou `eas env:list`) | `eas.json` não define `env` em nenhum perfil; o valor vive só no painel. Não tenho acesso — ver A-08. |
| H-04 | Confirmar que `AUTH_MODE=PROD` e `DEBUG_VERIFICATION_CODE=false` estão setados no serviço de produção **e** no de staging. | Railway (backend) | São a única barreira efetiva contra A-04 e A-06 hoje. Variáveis de ambiente não estão no repositório. |
| H-05 | Confirmar se existe CDN/proxy à frente do Railway injetando headers de segurança; se não existir, decidir onde eles serão aplicados. | Railway / infraestrutura | Determina se A-05 é uma exposição real ou já mitigada fora do repo. |
| H-06 | Preencher os textos de permissão iOS (`NSCameraUsageDescription`, `NSPhotoLibraryUsageDescription`) com a justificativa oficial em PT-BR aprovada pelo responsável do produto. | Decisão de produto → `app.json` | O texto é declaração ao usuário e à App Review. Não posso inventar a redação oficial — ver A-01. |
| H-07 | Revisar e aprovar a rotação da Firebase Web API key **se** o projeto Firebase estiver sem restrições de app/referrer no Google Cloud Console. | Firebase / Google Cloud Console | A chave é pública por design, mas sua segurança depende de restrições configuradas no console, que não consigo inspecionar daqui. |

---

## 11. Revisão adversarial (segundo auditor)

**Data:** 2026-08-06. **Objetivo:** tentar **refutar** cada achado acima relendo o código-fonte. Read-only sobre o código; apenas este documento foi alterado.

### 11.1 Veredito

**CORRIGIDO.** Nenhum achado foi refutado quanto ao mérito — todas as 12 conclusões técnicas (A-01 a A-12) e todos os itens da lista "o que está correto" se sustentaram na releitura. O que falhou foi a **precisão das citações**: 13 referências `arquivo:linha` apontavam para a linha errada, uma delas para uma linha que não existe e outra para um trecho que não contém a afirmação. Todas foram corrigidas in loco.

**Nenhum secret vazou para este documento.** Reconferido: o único literal de credencial citado é `'dev-password'`, que já é público no código-fonte (`app/(auth)/login.tsx:71`). Os hosts em `connect-src` já estão versionados em `vercel.json`. Nenhum valor de `.env.local` aparece — apenas nomes de chave.

### 11.2 Citações corrigidas

| Local | Estava | É |
|---|---|---|
| A-01 (tabela + detalhe) | `build.gradle.kts:20` (namespace) | **`:9`** |
| A-01 | `build.gradle.kts:26` (applicationId) | **`:24`** |
| A-01 | `build.gradle.kts:39-40` / bloco `:37-40` (signingConfig) | bloco **`:33-39`**, `signingConfig` em **`:37`** |
| A-01 | `app.json:23,26` (identificadores) | **`:18`** (iOS) e **`:25`** (Android) |
| A-01 | `Info.plist:19,23` | **`:20,24`** (19/23 são as tags `<key>`) |
| A-01 | `web/index.html:33` | `<title>` em **`:32`**, `flutter_bootstrap.js` em **`:36`** |
| A-01 | `settings.gradle.kts:3-10` | **`:2-9`** (`getProperty("flutter.sdk")` em `:6`) |
| A-02 | "`existsSync` na linha 38" | **linha 39** |
| A-02 (tabela + detalhe) | `.eslintrc.js:69` — **linha inexistente**, o arquivo tem 67 linhas | **`:64`** |
| A-04 | `backend/app/settings.py:129-130` — **não contém a validação** (linha em branco + separador de comentário) | **`:145`** (`validate_production_settings`), checagem em **`:151-152`** |
| A-07 / §7 | `android/.gitignore:11-13` | **`:12-14`** (`:11` é comentário) |
| A-08 / §3 | `vercel.json:16` como fonte do host de staging | **`:17`** (o `:16` é a *chave* do header, correto só para a afirmação "Report-Only") |
| A-10 / §6 | `package.json:24` (`@sentry/react`), `:35` (`expo-web-browser`), `:28` (`expo-auth-session`) | **`:21`**, **`:36`**, **`:26`** |

### 11.3 Correções de conteúdo

1. **§6, Service Worker — achado subdimensionado.** A citação original (`sw.js:17-19`) não cobria a chamada de fato perigosa, `clients.openWindow(url)` em `sw.js:27`. Corrigido.
2. **A-01 — faltava provar que as pastas estão versionadas.** Adicionada a contagem de `git ls-files`: `android/` 19 arquivos, `ios/` 39, `web/` 7. O achado só é BLOCKER porque estão no repositório; agora isso está comprovado, não pressuposto.
3. **A-02 — calibração de severidade registrada.** CRITICAL mantido, com a divergência (HIGH seria defensável) documentada explicitamente.
4. **§6 — terceira dependência morta.** `serve` (`package.json:46`) nunca é usada; o `start` roda `node server.js`. A auditoria original listou só duas.

### 11.4 Reverificado e confirmado sem alteração

Executado nesta revisão, resultado idêntico ao original:

- `npm audit --omit=dev` → **`47 vulnerabilities (1 low, 15 moderate, 27 high, 4 critical)`**, número por número. Críticas: `protobufjs`, `shell-quote`, `tar`, `websocket-driver`. `tar` com `effects: ["@expo/cli","cacache"]` — cadeia de toolchain, como descrito.
- `grep -rn "console\." app src` → **0**. `grep -rnoE "['\"][A-Za-z0-9_-]{32,}['\"]" app src` → **0**. `grep -rn "SecureStore" app src` → **0**. `grep -rniE "webview|WebBrowser|expo-auth-session" app src` → **0**. Busca por usuários de teste → **0**.
- `git ls-files` e `git log --all --diff-filter=A` sobre padrões de credencial → apenas `backend/.env.example` e `lumen_mobile/.env.example`. **Nunca houve** service account nem private key no histórico.
- Busca por `usesCleartextTraffic|network_security_config|NSAppTransportSecurity|NSAllowsArbitraryLoads` em `android/`, `ios/`, `app.json` → **0**.
- `server.js` não chama `decodeURIComponent` em lugar nenhum — o vetor de A-02 é mesmo o `..` literal, como descrito.
- `AndroidManifest.xml` de `main` não declara `INTERNET`; os de `debug` e `profile` declaram (`:6` em ambos). `Info.plist` não tem `NSCameraUsageDescription` nem `NSPhotoLibraryUsageDescription`, e o app de fato usa câmera e galeria (`app/(onboarding)/profile.tsx:311,326`; `app/retreats/[id]/payment.tsx:36,53`).
- `eas.json` (32 linhas) não define `env` em nenhum perfil — H-03 procede.
- `.env.staging.example` está de fato fora do versionamento: `git check-ignore` aponta `.gitignore:5` (`.env.*`); a exceção `!.env.example` / `!**/.env.example` (`:6-7`) não o alcança.
- `.env.local` contém **8** chaves, todas `EXPO_PUBLIC_*` (7 Firebase + `API_URL`) — nenhuma variável de servidor. Os outros 3 nomes do inventário (`SENTRY_DSN`, `ENVIRONMENT`, `APP_VERSION`) vêm de `.env.example:18-20`.
- Citações exatas e confirmadas sem ajuste: `server.js:35-36`; `login.tsx:71`; `register.tsx:326`; `api.ts:13,18-27,32-43,92-94`; `firebase.ts:19,27,53-56`; `_layout.tsx:8,29-39,34,59-64,165,168`; `verify-phone (auth):71-73`; `verify-phone (onboarding):67-69,207-210`; `verify-email:64-66,81-85,156`; `retreats/[id].tsx:718,1046`; `admin/_layout.tsx:16,32`; `types/index.ts:376`; `services/index.ts:369`; `ThemeContext.tsx:47,61`; `push.ts:9,13`; `app.json:8,29`; `railway.toml:5`; `.gitignore` do mobile (12 linhas); `auth.py:128,138,158,161`; `firebase.py:60-65`; `verification_routes.py:173,344`; `dev.py:175,236`; `.env.example:6-20`.

### 11.5 Tentativas de refutação que falharam

Registro do que tentei derrubar e não consegui, para que não seja retestado:

- **"`android/`/`ios/` talvez não estejam versionados"** — estão (67 arquivos no total). A-01 sobrevive.
- **"o path traversal talvez seja bloqueado por normalização"** — não é: nenhum `decodeURIComponent`, nenhum `path.resolve` + prefix check, nenhum `normalize`. A-02 sobrevive.
- **"a CSP do `vercel.json` talvez seja aplicada por algum outro caminho"** — `railway.toml:5` e `package.json:6` convergem em `node server.js`, que emite apenas `Content-Type` (`:52`). Nenhum middleware de header em lugar nenhum do repositório. A-05 sobrevive (com a ressalva de proxy externo, já registrada como NÃO DETERMINADO).
- **"talvez exista um uso de SecureStore que o grep original perdeu"** — zero ocorrências em `app/` e `src/`. A-03 sobrevive.
- **"o `npm audit` talvez tenha mudado desde a auditoria"** — reexecutado, números idênticos. A-12 sobrevive.

### 11.6 Limites desta revisão

Herda todos os limites da §8 — nada foi executado além de `npm audit` e comandos `git`/`grep`. Especificamente **não** foram verificados nesta passagem: comportamento de runtime, conteúdo do bundle exportado, autorização server-side, validação de `payment_proof_url` na escrita, `targetSdk` efetivo do Android e headers HTTP realmente servidos em produção.

---

## Apêndice — comandos de verificação executados

```bash
# Armazenamento de token
grep -rn "AsyncStorage|SecureStore|expo-secure-store" lumen_mobile/   # exclui node_modules

# Secrets hardcoded
grep -rniE "(api[_-]?key|secret|passwd|password|token|bearer|private[_-]?key)\s*[:=]\s*['\"][A-Za-z0-9_-]{12,}" app src
grep -rnoE "['\"][A-Za-z0-9_-]{32,}['\"]" app src        # → 0 resultados

# Logs
grep -rn "console\." app src                              # → 0 resultados

# Inventário EXPO_PUBLIC_*
grep -rn "EXPO_PUBLIC_[A-Z0-9_]+" lumen_mobile/
grep -oE "^[A-Za-z0-9_]+=" lumen_mobile/.env.local        # só nomes, nunca valores

# Credenciais versionadas (estado atual e histórico completo)
git ls-files | grep -iE "\.env|\.p8$|\.p12$|\.keystore$|\.jks$|google-services|GoogleService|serviceAccount"
git log --all --pretty=format: --name-only --diff-filter=A | sort -u | grep -iE "<mesmos padrões>"
find . -path "*/node_modules" -prune -o -type f \( -name "*.p8" -o -name "*.p12" -o -name "*.keystore" \
  -o -name "*.jks" -o -name "google-services.json" -o -name "GoogleService-Info.plist" \
  -o -name "*.mobileprovision" -o -name "*serviceAccount*" -o -name "*.pem" -o -name "*.key" \) -print

# Rede e WebView
grep -rniE "webview|WebBrowser|openURL|Linking\.|http://" app src
grep -rn "usesCleartextTraffic|network_security_config|NSAppTransportSecurity|NSAllowsArbitraryLoads" android ios app.json

# Debug / usuários de teste
grep -rniE "debug|mock|dev-?login|test.?user|seed|admin@|@example\.com|localhost|10\.0\.2\.2" app src

# Dependências
npm audit --omit=dev
```
