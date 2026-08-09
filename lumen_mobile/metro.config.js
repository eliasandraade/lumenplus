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

const resolverPadrao = config.resolver.resolveRequest;

config.resolver.resolveRequest = (context, moduleName, platform) => {
  const ehFirebase = moduleName === 'firebase' || moduleName.startsWith('firebase/');

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
