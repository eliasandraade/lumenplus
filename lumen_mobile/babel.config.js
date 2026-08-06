module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      // Reanimated 4 moveu o plugin para react-native-worklets. O caminho
      // antigo ('react-native-reanimated/plugin') ainda funciona porque e um
      // re-export, mas e um shim de compatibilidade — usamos o nome canonico.
      'react-native-worklets/plugin',
    ],
  };
};
