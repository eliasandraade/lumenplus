module.exports = {
  root: true,
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:react/recommended',
    'plugin:react-hooks/recommended',
  ],
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 2021,
    sourceType: 'module',
    ecmaFeatures: { jsx: true },
  },
  plugins: ['@typescript-eslint', 'react', 'react-hooks'],
  rules: {
    // Console: warn (MAINT-FE-02 removerá os logs; CI não bloqueia ainda)
    'no-console': 'warn',

    // Catch vazio intencional: permitido quando o erro é silenciado por design
    'no-empty': ['error', { allowEmptyCatch: true }],

    // Variáveis não usadas: warn (padrão: ignorar args prefixados com _)
    '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],

    // any: warn apenas (codebase usa any em vários lugares intencionais)
    '@typescript-eslint/no-explicit-any': 'warn',

    // require() em TS: warn (usado em api.ts para AsyncStorage dynamic import)
    '@typescript-eslint/no-require-imports': 'warn',

    // Expressões não usadas: warn (padrão existente no codebase)
    '@typescript-eslint/no-unused-expressions': 'warn',

    // Entidades JSX não escapadas: warn (texto em PT-BR usa aspas legítimas)
    'react/no-unescaped-entities': 'warn',

    // Hooks em funções não-componente: warn (useAnimatedStyle pattern existente)
    'react-hooks/rules-of-hooks': 'warn',

    // React 17+ não precisa de import React em escopo JSX
    'react/react-in-jsx-scope': 'off',

    // TypeScript já gerencia prop-types
    'react/prop-types': 'off',

    // Display names não obrigatórias para componentes anônimos no Expo Router
    'react/display-name': 'off',
  },
  settings: {
    react: { version: 'detect' },
  },
  env: {
    browser: true,
    node: true,
    es2021: true,
  },
  ignorePatterns: [
    'node_modules/',
    '.expo/',
    'dist/',
    'web-build/',
    '*.config.js',
    'server.js',
    'public/',
  ],
};
