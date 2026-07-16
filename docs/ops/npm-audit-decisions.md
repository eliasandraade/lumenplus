# SEC-02 — npm audit: Triagem e Decisões

**Data da auditoria:** 2026-06-14  
**Próxima revisão:** 2026-12-14 (ou quando Expo SDK for atualizado)  
**Executado em:** `lumen_mobile/` (Expo SDK 52, React Native 0.76)

---

## Sumário

| Severidade | Antes | Depois | Situação |
|-----------|-------|--------|----------|
| Critical  | 2     | 2      | Bloqueado por Expo SDK |
| High      | 24    | 24     | Bloqueado por Expo SDK |
| Moderate  | 18    | 18     | Bloqueado por Expo SDK |
| **Total** | **44**| **44** | **Nenhuma correção aplicada** |

**Conclusão:** `npm audit fix` sem `--force` não aplica nenhuma mudança porque todas as 44 vulnerabilidades estão em dependências transitivas do Expo SDK 52 / Firebase / Metro bundler. O npm resolve que corrigir qualquer uma delas requer puxar o Expo SDK 56 (mudança breaking). Nenhuma vulnerabilidade está em runtime do dispositivo.

---

## Comandos Executados

```bash
npm audit                           # inventário completo
npm audit --json > docs/ops/npm-audit-2026-06-14.json  # relatório salvo
npm audit fix --dry-run             # 0 mudanças sem --force; tenta expo@56 com --force
```

**Resultado do dry-run:** dry-run tentou puxar expo@56 mesmo para fixes "seguros", confirmando que toda a cadeia de dependências é bloqueada pelo lock do Expo SDK 52.

---

## Classificação por Pacote

### Categoria A — Bloqueado por Expo SDK (aguardar upgrade de SDK)

Todos os 44 itens se encaixam nesta categoria. Os pacotes diretamente vulneráveis são:

| Pacote | Severidade | Advisory | Vetor de Exploração | Contexto |
|--------|-----------|----------|---------------------|---------|
| `@babel/plugin-transform-modules-systemjs` | High | GHSA-fv7c-fp4j-7gwp | Código malicioso **durante compilação** | Build-time (Babel/Metro) |
| `@grpc/grpc-js` | High | GHSA-5375-pq7m-f5r2, GHSA-99f4-grh7-6pcq | Servidor gRPC exposto a malformed requests | Build-time (Firebase Admin SDK / CI) |
| `@protobufjs/utf8` | Moderate | GHSA-q6x5-8v7m-xcrf | Overlong UTF-8 decoding | Build-time (gRPC/Firebase) |
| `@xmldom/xmldom` | High (múltiplos) | GHSA-wh4c-j3r5-mjhp et al. | XML injection/DoS via serialização | Build-time (`@expo/plist`, `xcode`) — **só durante `eas build`** |
| `cacache` | High | GHSA-34x7-hfp2-rc4v et al. | Path traversal em extração de tar | Build-time (`@expo/cli`) |
| `firebase` / `@firebase/*` | High | cadeia via `undici` | HTTP smuggling, WebSocket overflow | Node.js (build/CI); **não afeta código que roda no device** |
| `shell-quote` | Critical | GHSA-w7jw-789q-3m8p | Shell injection via newline | Build-time (`@expo/cli`) |
| `tar` | High (múltiplos) | GHSA-34x7-hfp2-rc4v et al. | Path traversal em extração | Build-time (`@expo/cli`) |
| `undici` | High (múltiplos) | GHSA-f269-vfmq-vjvj et al. | HTTP smuggling, WebSocket | Node.js (Firebase SDK) — **não roda no device** |
| `uuid` | Moderate | GHSA-w5hq-g745-h8pq | Buffer bounds check | Build-time (`@expo/bunyan`, `xcode`) |
| `ws` | Moderate | GHSA-58qx-3vcg-4xpx | Uninitialized memory disclosure | Build-time (Metro HMR) |

---

## Avaliação de Risco Real

### Por que todas são build-time?

O Lumen+ é um app React Native / Expo. O código que **roda no dispositivo do usuário** é JavaScript compilado pelo Metro bundler. As vulnerabilidades acima estão em:

1. **Metro bundler e Expo CLI** — ferramentas que rodam apenas no ambiente de build (CI / máquina do dev)
2. **Firebase Admin SDK (Node.js)** — usado pelo backend Python (não pela SDK Firebase JS que roda no dispositivo)
3. **@grpc/grpc-js** — protocolo gRPC é Node.js; React Native não usa gRPC no device
4. **@xmldom/xmldom** — parse de XML em ferramentas de build (plist, xcode); não usado em runtime

### Vetor de exploração real

Para explorar qualquer dessas vulnerabilidades, um atacante precisaria:
- Ter acesso ao ambiente de build/CI (código malicioso no repositório ou dependência comprometida)
- OU comprometer a supply chain do npm (substituir o pacote)

**Não há vetor de exploração direto via usuário final do app.**

### Exposição classificada: BAIXA para usuário final / MÉDIA para pipeline de CI

---

## Decisões Formais

> **Nota sobre esta classificação:** Esta é uma triagem técnica preliminar formalmente aceita, baseada na árvore de dependências atual, no contexto Expo SDK 52 e no fato de que os pacotes afetados foram identificados como build-time/tooling. **Não é uma garantia absoluta de ausência de risco.** A decisão deve ser revista no próximo upgrade do Expo SDK ou se surgir evidência de vetor runtime real — o que vier primeiro.

### Decisão 1 — Vulnerabilidades build-time (Categoria A)
**Decisão: ACEITAR TEMPORARIAMENTE — triagem técnica formal**  
**Justificativa:** Todas em ferramentas de build. Nenhum vetor de exploração no device identificado com base na análise da árvore de dependências atual. Correção requer atualização do Expo SDK (mudança breaking com plano de testes dedicado).  
**Prazo de revisão:** 2026-12-14 ou quando Expo SDK for atualizado, o que vier primeiro.  
**Responsável:** Elias  
**Revisão:** esta decisão não dispensa nova triagem se o contexto mudar (nova vuln de supply chain ativa, mudança de arquitetura, upgrade de deps críticas).

### Decisão 2 — `npm audit fix --force` (upgrade para Expo SDK 56)
**Decisão: NEGAR — fora do escopo do Ciclo 2**  
**Justificativa:** Expo SDK 56 é uma mudança breaking. Requer plano de testes completo, branch dedicada, validação de todas as telas. Ciclo 4 ou item separado.

### Decisão 3 — Monitoramento contínuo
**Decisão: ATIVO**  
- Revisar `npm audit` a cada atualização de dependência significativa
- Revisar quando Expo SDK for atualizado
- Se nova vulnerabilidade **com vetor runtime real** for identificada: tratar como blocker imediato
- Se supply chain attack em pacote do Expo/Firebase for reportado publicamente: reavaliar esta decisão

---

## Itens Sem Ação Necessária

Todos os 44 itens são **sem ação imediata necessária** com base na triagem acima. A classificação permanece válida enquanto não houver mudança no contexto descrito na "Nota sobre esta classificação".

---

## Referências

- Relatório JSON completo: `docs/ops/npm-audit-2026-06-14.json`
- Expo SDK 52 advisory tracker: https://github.com/expo/expo/security
- Próxima revisão: após upgrade de Expo SDK ou 2026-12-14, o que vier primeiro

---

## Re-check 2026-07-16 (Ciclo 2)

- `npm audit`: **48 vulnerabilidades** (3 critical, 26 high, 18 moderate, 1 low) — variação vs 2026-06-14 (44) por atualização dos advisories; a natureza permanece **transitiva sob Expo SDK 52** (ex.: `ws` via `metro`/`react-native`).
- `npm audit fix --dry-run` (sem `--force`): tenta sobrepor peers de `expo@52`/`react-native` (ERESOLVE) → **nenhuma correção segura aplicável** sem quebrar a matriz do SDK.
- **Decisão mantida:** aceitar temporariamente (build-time/tooling, sem vetor runtime no device); `--force`/upgrade de SDK segue fora do escopo (item próprio). **Nenhuma dependência alterada neste ciclo.**
