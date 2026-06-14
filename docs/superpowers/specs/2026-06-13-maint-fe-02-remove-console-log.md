# Spec: MAINT-FE-02 — Remover console.log de Produção

**Data:** 2026-06-13  
**Ciclo:** POST-RC / Ciclo 1 — Fundamentos técnicos  
**Prioridade:** P0  
**Estimativa:** 2–4 horas  
**Depende de:** MAINT-FE-01 (ESLint real)

---

## Problema

O frontend (`lumen_mobile/`) possui `console.log` espalhados pelo código de produção. Esses logs:

- Expõem dados internos (tokens parciais, IDs, estruturas de estado) no console do browser
- São visíveis para usuários técnicos via DevTools
- Podem conter informações sensíveis (dados de usuário, respostas da API)
- Constituem vazamento de informação (risco LGPD e segurança)
- Foram identificados como issue no RC frontend (audit `2026-06-10-frontend-rc-audit.md`)

---

## Objetivo

Remover ou suprimir todos os `console.log` / `console.warn` / `console.error` não intencionais do código de produção do frontend, garantindo que nenhum log de debug chegue ao console em produção.

---

## Escopo

**Dentro do escopo:**
- Varredura completa de `lumen_mobile/` por `console.log`, `console.warn`, `console.error`, `console.debug`
- Remoção de logs de debug/desenvolvimento
- Manter apenas logs de erro crítico que sejam intencionais (e documentados)
- Configurar supressão automática em produção via Babel plugin ou override de `console`

**Fora do escopo:**
- Backend Python (sem console.log)
- Logs do Sentry (permanecem — são intencionais)
- `console.log` em arquivos de configuração/build (`babel.config.js`, `metro.config.js`)
- Logs de bibliotecas de terceiros

---

## Arquivos Prováveis

Executar varredura para identificar:
```bash
cd lumen_mobile && grep -rn "console\.\(log\|warn\|error\|debug\)" \
  --include="*.ts" --include="*.tsx" \
  --exclude-dir=node_modules \
  --exclude-dir=.expo \
  src/ app/ stores/
```

Arquivos mais prováveis baseado no histórico do projeto:
- `src/services/api.ts` — logs de request/response
- `app/(auth)/*.tsx` — logs de fluxo de auth
- `stores/authStore.ts` — logs de estado
- `app/admin/*.tsx` — logs de admin
- `app/vida/*.tsx` — logs do módulo vida

---

## Abordagem Recomendada

### Opção A: Remoção direta (recomendada para maioria dos casos)
Remover `console.log` de debug que não têm propósito em produção.

### Opção B: Supressão via Babel (para garantia sistêmica)
Instalar `babel-plugin-transform-remove-console` e configurar apenas para builds de produção:

```js
// babel.config.js
module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      ...(process.env.NODE_ENV === 'production'
        ? [['transform-remove-console', { exclude: ['error'] }]]
        : []),
    ],
  };
};
```

### Estratégia combinada (ideal)
1. Remover os logs de debug óbvios (Opção A)
2. Adicionar supressão Babel para produção (Opção B) como rede de segurança
3. ESLint `no-console: warn` (MAINT-FE-01) previne novos logs

---

## Riscos

| Risco | Mitigação |
|---|---|
| Remover log que mascarava erro silencioso | Revisar cada log removido; se for try/catch, garantir que Sentry já captura |
| `console.error` legítimo removido | Usar `exclude: ['error']` no plugin Babel; avaliar log a log |
| babel-plugin não disponível para Expo SDK 52 | Verificar compatibilidade antes de instalar; alternativa: override manual |
| Log continha dados sensíveis (CPF, token) | Registrar no commit message que dados sensíveis foram removidos |

---

## Plano de Implementação

1. **Varredura:** executar grep acima; listar todos os arquivos e linhas com `console.*`
2. **Classificar cada log:**
   - Debug de desenvolvimento → remover
   - Erro intencional com contexto → avaliar se Sentry já cobre → se sim, remover
   - Log de biblioteca chamado explicitamente → comentar ou remover
3. **Instalar plugin Babel:** `npm install --save-dev babel-plugin-transform-remove-console`
4. **Configurar `babel.config.js`** com supressão apenas em `NODE_ENV=production`
5. **Executar:** `npm run lint` — não deve haver novos warnings de `no-console` (além dos que já existiam)
6. **Executar:** `npx tsc --noEmit` — TypeScript sem erros
7. **Testar build web:** `npx expo export --platform web` e verificar no bundle que console.log não aparece

---

## Plano de Testes

- `npm run lint` passa
- `npx tsc --noEmit` passa
- Build web gerado: `grep "console.log" web-build/` não encontra logs de debug
- Em desenvolvimento (`NODE_ENV=development`): logs de desenvolvimento ainda aparecem se desejado
- Fluxo de autenticação funciona normalmente (login, logout, refresh)
- Módulo Vida funciona normalmente
- Admin Dashboard funciona normalmente

---

## Critérios de Aceite

- [ ] `grep -rn "console\.log" lumen_mobile/app lumen_mobile/src lumen_mobile/stores` retorna zero resultados (ou apenas comentários)
- [ ] `console.warn` e `console.error` intencionais documentados com comentário justificando
- [ ] Plugin Babel configurado para remover console em produção
- [ ] `npm run lint` passa
- [ ] `npx tsc --noEmit` passa
- [ ] Build web não contém logs de debug visíveis

---

## Rollback

Reverter `babel.config.js` e re-adicionar os `console.log` removidos via `git revert`. O código de produção não é alterado de forma destrutiva — apenas remoção de linhas de log.

---

## Estimativa de Esforço

**2–4 horas** (varredura + classificação + remoção + configuração Babel + validação)

---

## Dependências

- **Depende de:** MAINT-FE-01 (ESLint com regra `no-console` ativa)
- **Não bloqueia** outros itens diretamente, mas é pré-requisito de qualidade para App Store
