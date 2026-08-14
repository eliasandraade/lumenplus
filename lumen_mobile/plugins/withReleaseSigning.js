/**
 * Assinatura de release a partir do AMBIENTE — nunca do repositório.
 *
 * PROBLEMA: `expo prebuild` gera um android/app/build.gradle cujo buildType
 * `release` usa `signingConfigs.debug`. O AAB sai assinado com a chave de
 * debug (CN=Android Debug), que o Google Play recusa. E como o prebuild
 * regenera a pasta android/, editar o build.gradle à mão não sobrevive.
 *
 * POR QUE NÃO EXISTE MAIS FALLBACK SILENCIOSO
 * -------------------------------------------
 * A versão anterior deste plugin caía em `signingConfigs.debug` sempre que as
 * credenciais faltavam. Isso é conveniente para build local, e é EXATAMENTE o
 * caminho por onde um artefato assinado com chave de debug chega a uma esteira
 * de produção sem ninguém perceber: o build passa, o arquivo existe, o nome do
 * arquivo é `app-release.aab`, e só a Play Console recusa — se recusar.
 *
 * Agora o comportamento é explícito e declarado por perfil:
 *
 *   LUMEN_SIGNING_PROFILE=production
 *     Exige as quatro credenciais E o arquivo do keystore.
 *     Faltando qualquer uma → O BUILD FALHA. Nunca cai em debug, nunca gera
 *     keystore temporário, nunca usa chave embutida.
 *
 *   LUMEN_SIGNING_PROFILE=releaseTest
 *     Artefato de teste local, instalável, NUNCA confundível com store build.
 *     Aceita keystore próprio (efêmero) ou, sem ele, a chave de debug.
 *     Anuncia `SIGNING MODE: LOCAL TEST RELEASE` no log.
 *
 *   (perfil ausente)
 *     Tarefas de debug/desenvolvimento seguem normais. Qualquer tarefa de
 *     RELEASE no grafo → falha, exigindo escolha consciente de perfil.
 *
 * REGRA DE SEGURANÇA: keystore, senhas e alias NUNCA são versionados. Este
 * arquivo contém apenas NOMES de variáveis. Nada — nem o caminho do keystore —
 * é impresso em log.
 *
 * Em EAS Build isto não é necessário: a EAS gerencia as credenciais.
 */

const { withAppBuildGradle } = require('@expo/config-plugins');

const PERFIL_VAR = 'LUMEN_SIGNING_PROFILE';
const PERFIL_PRODUCAO = 'production';
const PERFIL_TESTE = 'releaseTest';

const ENV_VARS = [
  'LUMEN_ANDROID_KEYSTORE_PATH',
  'LUMEN_ANDROID_KEYSTORE_PASSWORD',
  'LUMEN_ANDROID_KEY_ALIAS',
  'LUMEN_ANDROID_KEY_PASSWORD',
];

const MSG_PRODUCAO_SEM_CREDENCIAL =
  'Production signing credentials are missing. Refusing to build a store release.';

const LUMEN_RELEASE_CONFIG = `
        // Injetado por plugins/withReleaseSigning.js — credenciais vêm do
        // ambiente, nunca do repositório.
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

// ATENÇÃO à sintaxe: `signingConfig (cond) ? a : b` NÃO funciona. O Groovy lê
// isso como a chamada `signingConfig(cond)` e só depois aplica o ternário ao
// retorno — resultado: `Boolean cannot be cast to SigningConfig`. A forma com
// `=` é atribuição de propriedade e não tem essa ambiguidade.
const RELEASE_SELECTOR =
  'signingConfig = (System.getenv("LUMEN_ANDROID_KEYSTORE_PATH") && ' +
  'file(System.getenv("LUMEN_ANDROID_KEYSTORE_PATH")).exists()) ' +
  '? signingConfigs.lumenRelease : signingConfigs.debug';

/**
 * O portão fail-closed propriamente dito.
 *
 * Roda em `gradle.taskGraph.whenReady`, e não na configuração do buildType,
 * porque a configuração é avaliada para QUALQUER tarefa — incluindo
 * assembleDebug. Validar ali quebraria o fluxo de desenvolvimento. No grafo de
 * tarefas dá para perguntar a coisa certa: "este build vai de fato empacotar
 * um release?".
 */
const FAIL_CLOSED_GATE = `
// ---------------------------------------------------------------------------
// Injetado por plugins/withReleaseSigning.js — portão de assinatura.
// Nenhum valor de credencial é impresso: apenas nomes de variáveis ausentes.
// ---------------------------------------------------------------------------
gradle.taskGraph.whenReady { grafo ->
    def tarefasRelease = grafo.allTasks.findAll { t ->
        def n = t.name
        (n.startsWith("assemble") || n.startsWith("bundle") || n.startsWith("package")) &&
            n.contains("Release")
    }
    if (!tarefasRelease.isEmpty()) {
        def perfil = System.getenv("${PERFIL_VAR}")
        def ksPath = System.getenv("LUMEN_ANDROID_KEYSTORE_PATH")
        def temKeystore = ksPath != null && !ksPath.isEmpty() && file(ksPath).exists()

        if (perfil == "${PERFIL_PRODUCAO}") {
            def faltando = []
            ${ENV_VARS.map(
              (v) => `if (!System.getenv("${v}")) { faltando.add("${v}") }`
            ).join('\n            ')}
            if (ksPath != null && !ksPath.isEmpty() && !file(ksPath).exists()) {
                faltando.add("LUMEN_ANDROID_KEYSTORE_PATH (arquivo nao encontrado)")
            }
            if (!faltando.isEmpty()) {
                throw new GradleException(
                    "${MSG_PRODUCAO_SEM_CREDENCIAL}\\n" +
                    "  Ausentes: " + faltando.join(", ") + "\\n" +
                    "  Nao ha fallback para debug em perfil de producao."
                )
            }
            println "SIGNING MODE: PRODUCTION (store release)"
        } else if (perfil == "${PERFIL_TESTE}") {
            println "SIGNING MODE: LOCAL TEST RELEASE"
            if (temKeystore) {
                println "  chave: keystore fornecido pelo ambiente (efemero/local)"
            } else {
                println "  chave: DEBUG — artefato instalavel, NAO submissivel"
            }
        } else {
            throw new GradleException(
                "Release build sem perfil de assinatura declarado.\\n" +
                "  Defina ${PERFIL_VAR}=${PERFIL_PRODUCAO} (exige credenciais) ou\\n" +
                "         ${PERFIL_VAR}=${PERFIL_TESTE} (artefato de teste local).\\n" +
                "  Recusando gerar um release de perfil ambiguo."
            )
        }
    }
}
`;

function injectSigningConfigs(gradle) {
  const marker = /signingConfigs\s*\{/;
  if (!marker.test(gradle)) {
    throw new Error('withReleaseSigning: bloco `signingConfigs {` nao encontrado em build.gradle');
  }
  return gradle.replace(marker, (m) => `${m}\n${LUMEN_RELEASE_CONFIG}`);
}

function pointReleaseAtSigningConfig(gradle) {
  const releaseBlock = /(release\s*\{[\s\S]*?)signingConfig\s+signingConfigs\.debug/;
  if (!releaseBlock.test(gradle)) {
    throw new Error(
      'withReleaseSigning: nao achei `signingConfig signingConfigs.debug` no buildType release'
    );
  }
  return gradle.replace(releaseBlock, (_full, head) => `${head}${RELEASE_SELECTOR}`);
}

/**
 * Validação em tempo de prebuild. Falha cedo, com mensagem legível, em vez de
 * deixar o Gradle falhar 15 minutos depois. O portão do Gradle continua sendo
 * a barreira real — este aqui é só o aviso antecipado.
 */
function validarPerfil(env = process.env) {
  const perfil = env[PERFIL_VAR];
  const faltando = ENV_VARS.filter((v) => !env[v]);

  if (perfil === PERFIL_PRODUCAO) {
    if (faltando.length > 0) {
      const erro = new Error(
        `${MSG_PRODUCAO_SEM_CREDENCIAL}\n  Ausentes: ${faltando.join(', ')}`
      );
      erro.code = 'PRODUCTION_SIGNING_MISSING';
      throw erro;
    }
    return { perfil, modo: 'PRODUCTION', usaDebug: false };
  }

  if (perfil === PERFIL_TESTE) {
    return {
      perfil,
      modo: 'LOCAL TEST RELEASE',
      usaDebug: faltando.length > 0,
    };
  }

  // Sem perfil: desenvolvimento. O portão do Gradle barra se alguém pedir
  // uma tarefa de release.
  return { perfil: null, modo: 'DEVELOPMENT', usaDebug: true };
}

module.exports = function withReleaseSigning(config) {
  const estado = validarPerfil();

  if (estado.modo === 'LOCAL TEST RELEASE') {
    console.warn(
      '\n[withReleaseSigning] SIGNING MODE: LOCAL TEST RELEASE\n' +
        (estado.usaDebug
          ? '  Sem keystore no ambiente — usara a chave de DEBUG.\n'
          : '  Usara o keystore fornecido pelo ambiente.\n') +
        '  Artefato instalavel para teste. NAO serve para submissao.\n'
    );
  } else if (estado.modo === 'PRODUCTION') {
    console.log('\n[withReleaseSigning] SIGNING MODE: PRODUCTION (store release)\n');
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
    if (!gradle.includes('gradle.taskGraph.whenReady')) {
      gradle = `${gradle}\n${FAIL_CLOSED_GATE}`;
    }
    cfg.modResults.contents = gradle;
    return cfg;
  });
};

// Exportado para o validador em scripts/validate-signing.mjs.
module.exports.validarPerfil = validarPerfil;
module.exports.MSG_PRODUCAO_SEM_CREDENCIAL = MSG_PRODUCAO_SEM_CREDENCIAL;
module.exports.ENV_VARS = ENV_VARS;
module.exports.PERFIL_VAR = PERFIL_VAR;
