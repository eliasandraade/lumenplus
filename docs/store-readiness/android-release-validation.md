# Validação do release Android — evidência de artefato e de execução

Tudo abaixo foi lido de **artefato empacotado** ou de **execução em
dispositivo**. Configuração não conta como prova: o manifest merger e os
plugins podem sobrescrever o valor efetivo, e nenhum arquivo de config diz se
o app abre.

## 1. O achado que só o dispositivo revelou

O APK passou por toda a bateria estática — `tsc` limpo, `eslint` sem erros,
`expo-doctor` 18/18, `BUILD SUCCESSFUL`, `aapt2` e `bundletool` conferindo
`targetSdkVersion=36`, `allowBackup=false`, permissões corretas — e **não
abria**:

```
FATAL EXCEPTION: mqt_v_native
com.facebook.react.common.JavascriptException:
    Error: Component auth has not been registered yet
        initializeAuth@ -> getAuth@ -> initFirebase@
```

Morte em ~0,4 s após o lançamento, com o launcher voltando ao foreground.

**Causa:** a partir do SDK 54 o Metro resolve pelo campo `exports` do
package.json. O pacote `firebase` declara em `exports["./auth"]` apenas as
condições `node`, `browser` e `default` — **não existe condição
`react-native`**. Sem ela o RN cai no `default`, que aponta para o bundle ESM
de browser, e esse bundle não executa o registro do componente `auth`.

**Correção:** `metro.config.js` desviando a resolução de `firebase/*` para o
campo `main` (build CJS). O desvio é restrito a esse pacote — desligar package
exports globalmente quebraria pacotes que só expõem subcaminhos por `exports`.

Um `try/catch` em `src/config/firebase.ts` estava mascarando o erro e caindo
em `getAuth(app)`, que falha igual. Removido: agora a falha aponta a causa.

> Vale registrar como lição de processo: **nenhum gate estático pegava isso**.
> A cadeia inteira estava verde com um app que não abria.

## 2. Evidência do artefato

| Verificação | APK (`aapt2 dump badging`) | AAB (`bundletool dump manifest`) |
|---|---|---|
| `package` | `com.lumenchristi.lumenplus` | idem |
| `targetSdkVersion` | **36** | **36** |
| `minSdkVersion` | 24 | 24 |
| `compileSdkVersion` | 36 | 36 |
| `allowBackup` | — | **false** |
| `debuggable` | ausente | ausente |
| `testOnly` | ausente | ausente |

`targetSdkVersion=36` fecha o prazo do Google Play de 31/08/2026.

### Permissões no AAB

`CAMERA · INTERNET · READ_EXTERNAL_STORAGE · READ_MEDIA_IMAGES · VIBRATE ·
WRITE_EXTERNAL_STORAGE · USE_BIOMETRIC · USE_FINGERPRINT`

Ausentes, como exigido: `RECORD_AUDIO`, `ACCESS_FINE_LOCATION`,
`ACCESS_COARSE_LOCATION`, `SYSTEM_ALERT_WINDOW`.

**Install Referrer:** o AAB trazia
`com.google.android.finsky.permission.BIND_GET_INSTALL_REFERRER_SERVICE`,
rastreada pelo `manifest-merger-report` até `com.android.installreferrer:2.2`
← `expo-application` ← `expo-auth-session`. É mecanismo de **atribuição** e
contradizia a declaração de privacidade. Como os três pacotes tinham zero uso
(a autenticação é só e-mail/senha, sem OAuth), foram removidos. O CI passou a
falhar se a permissão voltar.

## 3. Execução em dispositivo

Emulador Android API 34, x86_64.

| Item | Resultado |
|---|---|
| `adb install -r app-release.apk` | `Success` |
| `dumpsys package` | `versionName=1.0.0 versionCode=1 minSdk=24 **targetSdk=36**` |
| `am start -W` | `Status: ok · LaunchState: COLD · TotalTime: 6291ms` |

`targetSdk=36` confirmado no **pacote instalado** — evidência mais forte que a
inspeção do arquivo.

## 4. Assinatura

Os dois ramos do seletor foram exercitados em build real:

```
com LUMEN_SIGNING_PROFILE + credenciais → CN=Lumen Teste Descartavel, O=NAO USAR EM PRODUCAO
sem credenciais                          → CN=Android Debug, OU=Android, O=Unknown
```

O keystore de teste foi gerado fora do repositório e destruído em seguida.
Nenhuma credencial real foi criada, lida ou versionada.

**O fallback para debug foi removido do caminho de produção.** Hoje:

| Perfil | Comportamento |
|---|---|
| `production` | exige as 4 credenciais + o arquivo; faltando qualquer uma, **o build falha** |
| `releaseTest` | artefato de teste local; anuncia `SIGNING MODE: LOCAL TEST RELEASE` |
| ausente | debug normal; **qualquer** tarefa de release falha, exigindo escolha consciente |

Validado por `npm run signing:check` — 8/8, incluindo produção com credencial
**parcial**, que também é recusada.

## 5. Gates de CI corrigidos nesta rodada

| Gate | Problema | Correção |
|---|---|---|
| Permissões | lia o manifest de **debug**, onde o RN injeta `SYSTEM_ALERT_WINDOW` para o overlay de dev — reprovava artefato correto | passa a gerar e auditar o manifest de **release** |
| Workflow iOS | `KeyError: 'workspace'` — `xcodebuild -list -json` devolve `project` antes do `pod install` | aceita as duas chaves, ignora schemes de Pods |
| YAML | Python multilinha na coluna 0 invalidou o arquivo; o GitHub recusou a run inteira antes de qualquer passo | linha única |

## 6. O que este documento **não** prova

- **Smoke funcional completo** — login, feed, UGC, exclusão pela interface.
- **Maestro** — os três fluxos existem e têm YAML validado, mas dependem do
  job `maestro-e2e.yml` (runner Linux; o Maestro não roda em Windows).
- **Assinatura de produção** — exige a chave institucional.
- **Screenshots de loja** — dependem do app estável em tela.
