# SEC-02 — npm audit / Vulnerabilidades de Dependências

**Data:** 2026-06-14 | **Prioridade:** P1 | **Depende de staging:** Não

---

## Estado Atual (auditado)

```
npm audit -- lumen_mobile/
44 vulnerabilities (2 critical, 24 high, 18 moderate)
```

Todas as vulnerabilidades identificadas estão em dependências de **build-time** (Expo, Babel, Metro bundler), não em código que executa em produção no dispositivo do usuário.

---

## Problema

44 vulnerabilidades catalogadas sem triagem formal. Sem distinção entre:
- Vulnerabilidades reais em runtime (risco direto ao usuário)
- Vulnerabilidades de build-time (risco ao pipeline de CI, não ao usuário final)
- Vulnerabilidades sem vetor de exploração no contexto do projeto

---

## Objetivo

Produzir um inventário triado: para cada vulnerabilidade, classificar como:
1. **Runtime crítico** — corrigir imediatamente
2. **Build-time sem vetor de exploração** — aceitar formalmente e documentar
3. **Bloqueado pelo Expo SDK** — aguardar nova versão do Expo

---

## Escopo

- Rodar `npm audit --json` em `lumen_mobile/`
- Classificar cada vulnerabilidade por tipo (runtime vs build-time)
- Identificar quais têm fix disponível sem quebrar o app
- Documentar decisão formal para as build-time (aceitar ou aguardar)

## Fora de Escopo

- Atualizar Expo SDK (risco de regressão — decisão separada com plano de testes completo)
- Corrigir vulnerabilidades cujo fix exige mudança de SDK major

---

## Riscos

| Risco | Probabilidade | Mitigação |
|-------|---------------|-----------|
| Atualização de dep quebra build | Alta | Testar em branch separada antes de merge |
| Expo SDK impede upgrade de sub-dep | Alta | Aceitar formalmente e registrar em audit trail |
| "Fix" introduz incompatibilidade | Média | `npm audit fix --dry-run` primeiro |

---

## Plano de Implementação

### Passo 1 — Gerar relatório completo
```bash
cd lumen_mobile
npm audit --json > ../docs/ops/npm-audit-2026-06-14.json
npm audit 2>&1 | head -100
```

### Passo 2 — Classificar vulnerabilidades
Para cada vulnerabilidade:
- [ ] Verificar se o pacote é carregado em runtime no dispositivo
- [ ] Verificar se há `npm audit fix` disponível sem `--force`
- [ ] Verificar se a correção é compatível com a versão atual do Expo SDK

### Passo 3 — Aplicar fixes seguros
```bash
cd lumen_mobile
npm audit fix --dry-run   # ver o que mudaria
npm audit fix             # aplicar apenas se dry-run ok
npm run build             # validar que build não quebrou
npx tsc --noEmit          # validar types
```

### Passo 4 — Documentar decisão formal
Criar `docs/ops/npm-audit-decisions.md` com:
- Data da auditoria
- Vulnerabilidades corrigidas
- Vulnerabilidades aceitas (build-time, sem vetor)
- Vulnerabilidades pendentes (bloqueadas pelo Expo SDK)

---

## Plano de Testes

```bash
cd lumen_mobile
npm run lint             # lint não quebrou
npx tsc --noEmit         # types ok
npx expo export --platform web  # build ok
npm audit                # número de vulns igual ou menor
```

---

## Critérios de Aceite

- Zero vulnerabilidades runtime críticas sem mitigação documentada
- Todas as vulnerabilidades build-time documentadas com decisão formal
- Build passando após qualquer mudança de dependência
- `docs/ops/npm-audit-decisions.md` criado e commitado

## Rollback

`git checkout lumen_mobile/package.json lumen_mobile/package-lock.json` + `npm ci`

---

## Classificação

- **Depende de staging:** Não
- **Bloqueia App Store/Play Store:** Não diretamente (mas lojas podem rejeitar app com deps críticas)
- **Implementável via código:** ✅ Sim
- **Depende de decisão humana:** Parcialmente — quais builds-time aceitar formalmente
