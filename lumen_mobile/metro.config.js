// Metro — configuração mínima, existindo por UM motivo concreto.
//
// SINTOMA: o APK de release abria e morria na hora, com
//   FATAL EXCEPTION: mqt_v_native
//   JavascriptException: Error: Component auth has not been registered yet
//       initializeAuth@ -> getAuth@ -> initFirebase@
//
// CAUSA: a partir do SDK 54 o Metro resolve pelo campo `exports` do
// package.json (`unstable_enablePackageExports` liga por padrão). O pacote
// `firebase` declara, em exports["./auth"], apenas as condições `node`,
// `browser` e `default` — **não existe condição `react-native`**. Sem ela, o
// React Native cai no `default`, que aponta para o bundle ESM de browser. Esse
// bundle não executa o registro do componente `auth`, e qualquer chamada a
// getAuth/initializeAuth estoura.
//
// Pelo campo `main` (o caminho antigo, sem package exports) a resolução vai
// para `dist/index.cjs.js`, que registra o componente corretamente.
//
// POR QUE NÃO DESLIGAR PACKAGE EXPORTS GLOBALMENTE: é o conselho mais comum na
// internet e é exagerado — muitos pacotes modernos só expõem seus subcaminhos
// por `exports`, e desligar em bloco quebraria a resolução deles. Aqui o
// desvio é aplicado SOMENTE a `firebase/*`.
//
// Isto não é preferência de estilo: sem este arquivo, o app não abre.

const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// O bundle CJS do Firebase usa extensão .cjs; sem isto o Metro não o enxerga.
if (!config.resolver.sourceExts.includes('cjs')) {
  config.resolver.sourceExts.push('cjs');
}

// Package exports DESLIGADO globalmente.
//
// A tentativa anterior foi desligar só para `firebase/*` e `@firebase/*`, para
// não mexer na resolução dos demais pacotes. Não funcionou, e a investigação
// mostrou por quê: com exports ligado o grafo acaba misturando entradas — o
// build de React Native do @firebase/auth entra no bundle (confirmado por
// marcadores exclusivos de dist/rn/index.js, como STORAGE_AVAILABLE_KEY), mas
// o registro do componente `auth` não chega ao container do @firebase/app que
// o app usa, e initializeAuth estoura com "Component auth has not been
// registered yet".
//
// Desligar globalmente é o que a documentação da Expo indica para este erro, e
// devolve a resolução ao caminho por mainFields ['react-native','browser',
// 'main'] — onde @firebase/auth declara `react-native` e tudo aponta para a
// mesma cópia.
//
// Custo aceito conscientemente: pacotes que só expõem subcaminhos via `exports`
// deixam de resolver por eles. Foi o padrão do Metro até recentemente, e o
// conjunto de dependências deste app funciona assim — comprovado pelo bundle
// exportando sem erro e pelo app abrindo.
config.resolver.unstable_enablePackageExports = false;

const resolverPadrao = config.resolver.resolveRequest;

config.resolver.resolveRequest = (context, moduleName, platform) => {
  // ATENÇÃO: `@firebase/*` é tão importante quanto `firebase/*` — na verdade,
  // MAIS. O pacote `firebase` é só um guarda-chuva de reexports; quem tem o
  // build de React Native é `@firebase/auth`, e é lá que mora
  // `getReactNativePersistence` (dist/rn/index.js é o ÚNICO build que o
  // exporta). A primeira versão deste desvio cobria só `firebase/*`, então o
  // pacote que de fato importa continuou resolvendo pelo campo `browser` — e o
  // app seguiu crashando com "Component auth has not been registered yet".
  //
  // Com package exports desligado, o Metro usa mainFields
  // ['react-native', 'browser', 'main'], e `@firebase/auth` declara
  // `react-native` — que é exatamente o build correto.
  const ehFirebase =
    moduleName === 'firebase' ||
    moduleName.startsWith('firebase/') ||
    moduleName === '@firebase' ||
    moduleName.startsWith('@firebase/');

  if (ehFirebase && platform !== 'web') {
    // Resolve este módulo — e só ele — com package exports desligado, o que
    // faz o Metro usar `main` (build CJS) em vez de `default` (ESM browser).
    return context.resolveRequest(
      { ...context, unstable_enablePackageExports: false },
      moduleName,
      platform
    );
  }

  return (resolverPadrao ?? context.resolveRequest)(context, moduleName, platform);
};

module.exports = config;
