/**
 * Assinatura de release a partir do AMBIENTE — nunca do repositório.
 *
 * PROBLEMA: `expo prebuild` gera um android/app/build.gradle cujo buildType
 * `release` usa `signingConfigs.debug`. O AAB sai assinado com a chave de
 * debug (CN=Android Debug), que o Google Play recusa. E como o prebuild
 * regenera a pasta android/, editar o build.gradle à mão não sobrevive.
 *
 * SOLUÇÃO: este config plugin injeta um signingConfig `release` que lê as
 * credenciais de variáveis de ambiente, em tempo de build.
 *
 * REGRA DE SEGURANÇA: o keystore (.jks/.p12), as senhas e o alias NUNCA são
 * versionados. Este arquivo contém apenas os NOMES das variáveis. Se as
 * variáveis não estiverem definidas, o comportamento anterior é preservado
 * (assina com debug) e um aviso é emitido — assim o build de validação
 * continua funcionando para quem não tem as credenciais.
 *
 * Variáveis esperadas:
 *   LUMEN_ANDROID_KEYSTORE_PATH      caminho absoluto do .jks
 *   LUMEN_ANDROID_KEYSTORE_PASSWORD  senha do keystore
 *   LUMEN_ANDROID_KEY_ALIAS          alias da chave
 *   LUMEN_ANDROID_KEY_PASSWORD       senha da chave
 *
 * Em EAS Build isto não é necessário: a EAS gerencia as credenciais. Este
 * plugin serve ao build LOCAL e a CI própria.
 */

const { withAppBuildGradle } = require('@expo/config-plugins');

const ENV_VARS = [
  'LUMEN_ANDROID_KEYSTORE_PATH',
  'LUMEN_ANDROID_KEYSTORE_PASSWORD',
  'LUMEN_ANDROID_KEY_ALIAS',
  'LUMEN_ANDROID_KEY_PASSWORD',
];

// Config adicionado DENTRO do bloco signingConfigs que o template do Expo já
// gera — e não num segundo bloco. Lê do ambiente no momento do build, então o
// valor nunca fica escrito em arquivo nenhum.
const LUMEN_RELEASE_CONFIG = `
        // Injetado por plugins/withReleaseSigning.js — credenciais vêm do
        // ambiente, nunca do repositório. Sem elas, cai no debug (build de
        // validação), e o artefato NÃO serve para submissão.
        lumenRelease {
            def ksPath = System.getenv("LUMEN_ANDROID_KEYSTORE_PATH")
            if (ksPath != null && !ksPath.isEmpty() && file(ksPath).exists()) {
                storeFile file(ksPath)
                storePassword System.getenv("LUMEN_ANDROID_KEYSTORE_PASSWORD")
                keyAlias System.getenv("LUMEN_ANDROID_KEY_ALIAS")
                keyPassword System.getenv("LUMEN_ANDROID_KEY_PASSWORD")
            }
        }
`;

// Groovy avaliado na configuração do buildType. Exige a variável E o arquivo:
// um path apontando para keystore inexistente cairia num signingConfig sem
// storeFile, e o gradle falharia tarde, no meio do empacotamento.
//
// ATENÇÃO à sintaxe: `signingConfig (cond) ? a : b` NÃO funciona. O Groovy lê
// isso como a chamada `signingConfig(cond)` e só depois aplica o ternário ao
// retorno — resultado: `Boolean cannot be cast to SigningConfig`. A forma com
// `=` é atribuição de propriedade e não tem essa ambiguidade.
const RELEASE_SELECTOR =
  'signingConfig = (System.getenv("LUMEN_ANDROID_KEYSTORE_PATH") && ' +
  'file(System.getenv("LUMEN_ANDROID_KEYSTORE_PATH")).exists()) ' +
  '? signingConfigs.lumenRelease : signingConfigs.debug';

function injectSigningConfigs(gradle) {
  // Entra no bloco signingConfigs existente, logo após sua abertura.
  const marker = /signingConfigs\s*\{/;
  if (!marker.test(gradle)) {
    throw new Error('withReleaseSigning: bloco `signingConfigs {` nao encontrado em build.gradle');
  }
  return gradle.replace(marker, (m) => `${m}\n${LUMEN_RELEASE_CONFIG}`);
}

function pointReleaseAtSigningConfig(gradle) {
  // O template do Expo escreve `signingConfig signingConfigs.debug` dentro de
  // `release { }`. Trocamos APENAS essa ocorrência — a do buildType debug fica
  // como está.
  const releaseBlock = /(release\s*\{[\s\S]*?)signingConfig\s+signingConfigs\.debug/;
  if (!releaseBlock.test(gradle)) {
    throw new Error(
      'withReleaseSigning: nao achei `signingConfig signingConfigs.debug` no buildType release'
    );
  }
  return gradle.replace(releaseBlock, (_full, head) => `${head}${RELEASE_SELECTOR}`);
}

module.exports = function withReleaseSigning(config) {
  const faltando = ENV_VARS.filter((v) => !process.env[v]);
  if (faltando.length > 0) {
    console.warn(
      '\n[withReleaseSigning] AVISO: assinando o release com a chave de DEBUG.\n' +
        `  Variáveis ausentes: ${faltando.join(', ')}\n` +
        '  O artefato serve para validação e teste, NÃO para submissão.\n'
    );
  }

  return withAppBuildGradle(config, (cfg) => {
    if (cfg.modResults.language !== 'groovy') {
      throw new Error('withReleaseSigning: build.gradle nao e Groovy');
    }
    let gradle = cfg.modResults.contents;
    if (!gradle.includes('lumenRelease')) {
      gradle = injectSigningConfigs(gradle);
      gradle = pointReleaseAtSigningConfig(gradle);
    }
    cfg.modResults.contents = gradle;
    return cfg;
  });
};
