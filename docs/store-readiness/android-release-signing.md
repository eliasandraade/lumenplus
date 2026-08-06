# Assinatura do release Android

## Situação atual (verificada no artefato)

O AAB/APK gerado localmente está assinado com a **chave de debug do Gradle**:

```
Signer #1 certificate DN: CN=Android Debug, OU=Android, O=Unknown
```

Confirmado com `apksigner verify --print-certs`. O artefato **serve para
validação e teste; NÃO serve para submissão** — o Google Play recusa.

## Como o repositório resolve isso

`expo prebuild` regenera `android/`, então editar `build.gradle` à mão não
sobrevive. O config plugin `lumen_mobile/plugins/withReleaseSigning.js` injeta
um `signingConfig` chamado `lumenRelease` que lê as credenciais **do
ambiente**, em tempo de build:

| Variável | Conteúdo |
|---|---|
| `LUMEN_ANDROID_KEYSTORE_PATH` | caminho absoluto do `.jks` |
| `LUMEN_ANDROID_KEYSTORE_PASSWORD` | senha do keystore |
| `LUMEN_ANDROID_KEY_ALIAS` | alias da chave |
| `LUMEN_ANDROID_KEY_PASSWORD` | senha da chave |

Sem as quatro variáveis, o build **cai no debug** e emite aviso explícito —
assim quem não tem credenciais continua conseguindo compilar para validar.

O buildType `release` seleciona em runtime:

```groovy
signingConfig (System.getenv("LUMEN_ANDROID_KEYSTORE_PATH") &&
               file(System.getenv("LUMEN_ANDROID_KEYSTORE_PATH")).exists())
    ? signingConfigs.lumenRelease : signingConfigs.debug
```

A checagem de existência do arquivo é deliberada: um path apontando para
keystore inexistente produziria um `signingConfig` sem `storeFile`, e o Gradle
falharia tarde, no meio do empacotamento, com mensagem obscura.

## Regra de segurança — inegociável

**Nada disto entra no repositório:** keystore (`.jks`/`.p12`), senhas, alias,
service-account JSON do Google Play, `.p8`/`.p12` da Apple, provisioning
profiles. O plugin versiona apenas os **nomes** das variáveis.

## Estado de verificação — honesto

| Item | Status |
|---|---|
| Plugin altera o `build.gradle` gerado | **verificado** — bloco `signingConfigs` único, `lumenRelease` presente, `release` apontando para o seletor |
| Fallback para debug sem credenciais | **verificado** — aviso emitido no prebuild |
| Build completo assinado com chave real | **NÃO verificado** — exige um keystore, que é decisão e propriedade do operador |

## Decisão pendente de humano

Duas rotas, e a escolha não é de engenharia:

1. **Play App Signing (recomendado pelo Google).** O Google guarda a chave de
   assinatura; você envia com uma *upload key*. Perder a upload key é
   recuperável. É o padrão para apps novos.
2. **Keystore próprio.** Você guarda a chave. **Perder o keystore significa
   nunca mais poder atualizar o app** — é preciso publicar sob outro
   `applicationId`, perdendo instalações e avaliações.

Em qualquer das rotas, quem gera e guarda o keystore é o responsável pela
conta do Google Play. **Não gere o keystore de produção em máquina de
desenvolvimento compartilhada.**

## Procedimento (operador)

```bash
keytool -genkeypair -v -keystore lumen-upload.jks -alias lumen-upload \
  -keyalg RSA -keysize 4096 -validity 10000
```

Guarde o arquivo e as senhas em cofre (1Password/Bitwarden/Vault). Depois:

```bash
export LUMEN_ANDROID_KEYSTORE_PATH=/caminho/seguro/lumen-upload.jks
export LUMEN_ANDROID_KEYSTORE_PASSWORD='...'
export LUMEN_ANDROID_KEY_ALIAS=lumen-upload
export LUMEN_ANDROID_KEY_PASSWORD='...'
node scripts/android-build.mjs --release
```

Conferir a assinatura no artefato — não confiar na configuração:

```bash
apksigner verify --print-certs build-artifacts/app-release.apk
```

O DN **não** pode conter `CN=Android Debug`.

## Em EAS Build

Não é necessário: a EAS gerencia as credenciais no serviço. Este plugin serve
ao build **local** e a CI própria.
