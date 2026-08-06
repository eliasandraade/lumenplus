# Validação de build nativo — evidência

**Data:** 2026-08-06.

## Resultado: o app **COMPILA** como binário nativo Android

```
BUILD SUCCESSFUL in 13m 32s
APK: android/app/build/outputs/apk/debug/app-debug.apk   (169 MB, debug)
```

Esta é a primeira vez que o Lumen+ foi compilado como aplicativo nativo. Antes
disto, **nenhum binário jamais existiu**.

## O caminho até aqui — 3 blockers reais encontrados e corrigidos

### 1. `android/` e `ios/` eram scaffolding **Flutter**
Aplicavam `dev.flutter.flutter-gradle-plugin`, `applicationId =
com.example.lumen_mobile` e assinatura com chave de **debug**. Não estavam no
`.gitignore`, então o EAS Build os detectaria e trataria o projeto como *bare
workflow* — compilando um app Flutter com o package errado. **Removidos.**

### 2. Os assets placeholder quebravam o `prebuild`
Os PNGs de 192×192 / 1.328 bytes eram **inválidos**:

```
[android.dangerous] withAndroidDangerousBaseMod: Unrecognised filter type - 48
```

Substituídos por assets gerados da identidade real (`assets/icon.svg`).
Depois disso, `expo prebuild --clean` **conclui**.

### 3. O caminho do projeto quebra o `ninja` (limitação de AMBIENTE, não do código)
Com o projeto em `C:\Users\...\Projeto Lumen+\...`, o build C++ falha:

```
ninja: error: mkdir(.../worklets.dir/C_/Users/Elias/Documents/Projeto_Lumen+/...)
       : No such file or directory
```

O ninja **mutila** o caminho (o espaço vira `_`) ao derivar o diretório dos
objetos — o `+` e o espaço no caminho o quebram no Windows.

**Prova:** copiado o projeto para `C:\lumenbuild` (sem espaço, sem `+`),
regenerado o nativo e executado o build → **BUILD SUCCESSFUL**.
Mesmo código, mesma máquina, mesma toolchain — só o caminho mudou.

> Consequência prática: **nenhuma**. O EAS Build e o CI rodam em Linux, com
> caminhos limpos. Só afeta build local nesta pasta.

## Verificação do artefato (manifest **mesclado**, o que vai no APK)

| Item | Valor | Status |
|---|---|---|
| `package` | `com.lumenchristi.lumenplus` | ✅ correto |
| `versionName` / `versionCode` | `1.0.0` / `1` | ✅ |
| Resíduo Flutter / `com.example` | nenhum | ✅ |

### Permissões no manifest final

| Permissão | Origem | Situação |
|---|---|---|
| `CAMERA` | expo-image-picker | ✅ usada (foto de perfil, comprovante) |
| `READ_MEDIA_IMAGES` | expo-image-picker | ✅ usada |
| `READ/WRITE_EXTERNAL_STORAGE` | compat Android antigo | ✅ esperada |
| `INTERNET`, `VIBRATE` | base | ✅ |
| `USE_BIOMETRIC`, `USE_FINGERPRINT` | expo-secure-store | ⚠️ transitivas — avaliar se removíveis |
| `RECORD_AUDIO` | transitiva | ✅ **REMOVIDA** por `blockedPermissions` |
| `ACCESS_FINE_LOCATION` | transitiva | ✅ **REMOVIDA** |
| `ACCESS_COARSE_LOCATION` | transitiva | ✅ **REMOVIDA** |
| `SYSTEM_ALERT_WINDOW` | React Native (overlay do dev menu) | ⚠️ presente **em debug**; precisa reconferir em **release** |

`blockedPermissions` só funcionou com o nome **totalmente qualificado**
(`android.permission.X`) — com o nome curto o Expo ignora silenciosamente.

## O que este build **não** prova

- **Não é build de loja.** É `assembleDebug`, sem assinatura de release.
- **Não foi instalado nem executado** — não há emulador/dispositivo neste
  ambiente (`adb` ausente). Portanto: crash, ANR, cold start, permissões em
  runtime e deep links continuam **não verificados**.
- **iOS não foi compilado** — exige macOS. O workflow `mobile-build.yml`
  inclui um job `macos-14` que compila para simulador **sem assinatura**
  (não precisa de conta Apple) — é a próxima evidência a obter.

## CI — fonte de verdade a partir de agora

`.github/workflows/mobile-build.yml` roda em runners limpos:

- **checks** (ubuntu): `tsc`, ESLint, validação de assets, expo-doctor, config;
- **android** (ubuntu): prebuild → confere identidade → `assembleDebug` →
  **falha se qualquer permissão bloqueada aparecer no manifest final** →
  publica o APK como artefato;
- **ios** (macos-14): prebuild → `pod install` → confere as purpose strings no
  `Info.plist` → `xcodebuild` para simulador sem assinatura.

Node pinado em `22.19.0`, `npm ci` determinístico.


---

# ANDROID RELEASE — AAB DE PRODUÇÃO GERADO (2026-08-06)

```
BUILD SUCCESSFUL in 30m 6s   —   891 tasks executed
app-release.aab   56 MB   <- artefato de submissão do Google Play
app-release.apk   81 MB   <- instalável para teste
```

Gerado por `npm run android:release`, que detecta o caminho hostil do Windows,
espelha para um diretório limpo, roda prebuild + `assembleRelease bundleRelease`
e coleta os artefatos em `build-artifacts/` (ignorado pelo git).

## Manifest RELEASE mesclado — auditado

| Item | Valor | Status |
|---|---|---|
| `package` | `com.lumenchristi.lumenplus` | ✅ |
| `versionName` / `versionCode` | `1.0.0` / `1` | ✅ |
| **`targetSdkVersion`** | **36** | ✅ **atende a exigência do Google Play de 31/08/2026** |
| `android:debuggable` | ausente | ✅ |

### Permissões finais no APK/AAB de release

| Permissão | Origem | Avaliação |
|---|---|---|
| `CAMERA`, `READ_MEDIA_IMAGES` | expo-image-picker | ✅ usadas (foto de perfil, comprovante) |
| `READ/WRITE_EXTERNAL_STORAGE` | compat Android antigo | ✅ esperada |
| `INTERNET`, `VIBRATE` | base | ✅ |
| `USE_BIOMETRIC`, `USE_FINGERPRINT` | expo-secure-store | ⚠️ transitivas — avaliar remoção |
| `RECORD_AUDIO` | — | ✅ **removida** |
| `ACCESS_FINE/COARSE_LOCATION` | — | ✅ **removidas** |
| `SYSTEM_ALERT_WINDOW` | dev menu do RN | ✅ **some em release** (confirmado; em debug aparecia) |

## Reclassificação

Android sai de *"compilação debug comprovada"* para
**"AAB de produção gerado e manifest auditado"**.

**Ainda NÃO comprovado:** o AAB está assinado com a chave de **debug** do Gradle
(não há keystore de release) — serve para validação e teste, **não** para
submissão. A assinatura final virá do **Play App Signing** ou de um keystore
fornecido pelo operador. Nada foi instalado nem executado: `adb`/emulador não
existem neste ambiente.
