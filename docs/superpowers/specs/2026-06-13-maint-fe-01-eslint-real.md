# Spec: MAINT-FE-01 — Configurar ESLint Real

**Data:** 2026-06-13  
**Ciclo:** POST-RC / Ciclo 1 — Fundamentos técnicos  
**Prioridade:** P0  
**Estimativa:** 2–4 horas

---

## Problema

O projeto `lumen_mobile/` não possui configuração ESLint funcional. O script `npm run lint` existe no `package.json` mas não há `.eslintrc.js` / `.eslintrc.json` configurado com regras reais. Isso significa:

- `console.log` em produção não é detectado automaticamente
- Variáveis não utilizadas passam silenciosamente
- O CI (OPS-02) não tem lint executável contra uma config válida
- A qualidade do código depende exclusivamente do TypeScript, sem regras de estilo/segurança

---

## Objetivo

Criar uma configuração ESLint funcional para `lumen_mobile/` que:
1. Rode sem erros no estado atual do código (zero warnings bloqueantes)
2. Detecte `console.log` e variáveis não utilizadas
3. Seja compatível com React Native + Expo + TypeScript
4. Sirva de base para o CI (OPS-02)

---

## Escopo

**Dentro do escopo:**
- Criar/atualizar `.eslintrc.js` (ou `.eslintrc.json`) em `lumen_mobile/`
- Instalar dependências ESLint necessárias
- Garantir que `npm run lint` passa no estado atual do código (corrigir ou suprimir achados existentes)
- Configurar regra `no-console` como `warn` (não error — para não quebrar CI antes de MAINT-FE-02)
- Configurar regra `no-unused-vars` como `warn`

**Fora do escopo:**
- Corrigir todas as ocorrências de `console.log` (isso é MAINT-FE-02)
- Configurar ESLint para o backend Python
- Configurar pre-commit hooks (pode vir depois)
- Regras de formatação Prettier (fora do escopo desta spec)

---

## Arquivos Prováveis

```
lumen_mobile/
  .eslintrc.js          ← criar ou atualizar
  .eslintignore         ← criar se necessário
  package.json          ← verificar dependências e script lint
  package-lock.json     ← atualizar após install
```

Dependências a verificar/instalar:
- `eslint`
- `@typescript-eslint/eslint-plugin`
- `@typescript-eslint/parser`
- `eslint-plugin-react`
- `eslint-plugin-react-hooks`
- `eslint-plugin-react-native` (opcional mas recomendado)

---

## Abordagem Recomendada

### Configuração base sugerida

```js
// lumen_mobile/.eslintrc.js
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
    'no-console': 'warn',
    '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
    '@typescript-eslint/no-explicit-any': 'warn',
    'react/react-in-jsx-scope': 'off', // não necessário no React 17+
    'react/prop-types': 'off',         // TypeScript faz isso
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
  ],
};
```

### Estratégia para warnings existentes

Após configurar, executar `npm run lint -- --max-warnings 9999` para ver o estado atual sem falhar. Se houver `error` (não `warn`), converter para `warn` ou adicionar supressão pontual com comentário justificado.

---

## Riscos

| Risco | Mitigação |
|---|---|
| Versão do ESLint incompatível com Expo SDK 52 | Verificar `peerDependencies` do `expo-eslint-config` antes de instalar |
| Muitos warnings quebrando CI futuramente | Definir `--max-warnings` no script do CI com número realista |
| `.eslintrc.js` conflitar com configuração do Expo | Verificar se Expo injeta config automaticamente via `app.json` |

---

## Plano de Implementação

1. Verificar configuração ESLint existente: `cat lumen_mobile/package.json | grep -A5 eslint`
2. Verificar se há `.eslintrc.*` existente
3. Instalar dependências faltantes: `cd lumen_mobile && npm install --save-dev eslint @typescript-eslint/eslint-plugin @typescript-eslint/parser eslint-plugin-react eslint-plugin-react-hooks`
4. Criar `.eslintrc.js` com a configuração base
5. Executar: `cd lumen_mobile && npm run lint 2>&1 | head -50` (ver estado inicial)
6. Ajustar regras para zerar erros (não warnings) no estado atual
7. Executar `npx tsc --noEmit` para confirmar TypeScript ainda passa
8. Executar `npm run lint` — deve terminar com exit code 0

---

## Plano de Testes

- `npm run lint` retorna exit code 0
- `npx tsc --noEmit` retorna exit code 0
- `console.log('test')` adicionado temporariamente em qualquer arquivo gera warning visível
- Remover o console.log de teste antes do commit

---

## Critérios de Aceite

- [ ] `npm run lint` passa com exit code 0
- [ ] `npx tsc --noEmit` passa sem novos erros
- [ ] Regra `no-console` está ativa e gera `warn`
- [ ] Regra `@typescript-eslint/no-unused-vars` está ativa e gera `warn`
- [ ] `.eslintrc.js` commitado em `lumen_mobile/`
- [ ] Script `lint` no `package.json` roda ESLint (não é no-op)

---

## Rollback

Remover `.eslintrc.js` e reverter `package.json` / `package-lock.json` para o estado anterior. O código de produção não é alterado por este item.

---

## Estimativa de Esforço

**2–4 horas** (incluindo diagnóstico, instalação, ajuste de warnings existentes, validação)

---

## Dependências

- Nenhuma dependência de outros itens POST-RC
- **Bloqueia:** MAINT-FE-02 (lint detecta console.log), OPS-02 (CI usa ESLint)
