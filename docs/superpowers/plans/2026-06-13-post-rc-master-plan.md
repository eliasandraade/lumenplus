# Lumen+ — Plano Mestre POST-RC

**Data:** 2026-06-13  
**Ciclo:** POST-RC  
**Status:** Planejamento — nenhum código alterado  
**Referência:** `docs/final/14-roadmap-pos-rc.md`

---

## 1. Objetivo Geral

Elevar o Lumen+ de "produção operacional" para "produção robusta e pronta para App Store / Play Store", resolvendo os 35 itens de backlog POST-RC de forma ordenada por risco, dependência e valor entregue.

O ciclo está organizado em 5 grupos (Ciclos 1–5). Cada ciclo deve ser concluído, testado e commitado antes do próximo iniciar. Ciclos 1 e 2 são pré-requisito para publicação nas lojas.

---

## 2. Premissas

- Nenhum item do backlog é blocker de produção atual.
- A base de código está estável: TypeScript sem erros, hardening H1→H6A em produção, Admin 2.0 Fase 1.1 em produção.
- Branch principal: `main`. Todo trabalho parte de `main` e retorna a `main` via PR ou commit direto (conforme tamanho).
- Deploy backend: Railway. Deploy frontend: Vercel. Deploy mobile: Expo/EAS.
- A avaliação LGPD (`LGPD-07`) é gate obrigatório para iniciar Analytics Missionais.
- App Store / Play Store só após: `OPS-01`, `OPS-02`, `PROD-01`, `PROD-05`, `MOBILE-01`.

---

## 3. As 35 Pendências POST-RC

### Ciclo 1 — Fundamentos técnicos / P0
| ID | Descrição |
|---|---|
| MAINT-FE-01 | Configurar ESLint real (`.eslintrc.js` com regras no-console, no-unused-vars, etc.) |
| MAINT-FE-02 | Remover `console.log` de produção (varredura + supressão por env) |
| MAINT-FE-03 | Role guard em `admin/_layout.tsx` (bloquear rota se sem role admin) |
| OPS-01 | Criar ambiente staging formal (Railway + Vercel preview) |
| OPS-02 | Criar CI básico (GitHub Actions: lint + typecheck + build + testes backend) |

### Ciclo 2 — Segurança, operação e LGPD / P1
| ID | Descrição |
|---|---|
| SEC-01 | Ativar CSP frontend enforced (hoje está Report-Only) |
| SEC-02 | Revisar npm audit e vulnerabilidades transitivas |
| SEC-04 | Pentest externo formal |
| SEC-05 | Processo de rotação de chaves/segredos |
| LGPD-01 | Política formal de retenção de dados |
| LGPD-02 | Designar DPO/Encarregado de Dados (formalização) |
| LGPD-03 | Criar ROPA / Inventário de tratamento |
| LGPD-06 | Revisar Política de Privacidade (v1.3 → v1.4+) |
| LGPD-07 | Avaliação LGPD para Analytics Missionais ← gate para Ciclo 5 |
| PROD-01 | Validar push notifications end-to-end (web + Android + iOS) |
| PROD-05 | Validar FCM mobile iOS/Android |
| MOBILE-01 | Auditar EAS / App Store / Google Play |

### Ciclo 3 — Produto, mobile e experiência / P2
| ID | Descrição |
|---|---|
| OPS-03 | Criar runbook de deploy |
| OPS-04 | Documentar variáveis Expo |
| OPS-05 | Auditar cobertura de testes backend |
| LGPD-04 | Portabilidade de dados do usuário (`GET /auth/me/data-export`) |
| LGPD-05 | Recuperação/reset de PIN do Projeto de Vida |
| PROD-02 | Push para eventos do app (novos avisos, etc.) |
| PROD-03 | Email transacional (boas-vindas, recuperação, avisos críticos) |
| DS-01 | Corrigir cores hardcoded em `retreats/index.tsx` |
| DS-03 | Corrigir spinner hardcoded em `app/index.tsx` |
| SEC-03 | Avaliar HSTS preload |
| SEC-06 | Completar mapeamento `ACTION_META` (audit log) |
| MAINT-FE-04 | Auditar Service Worker/cache web |
| MOBILE-02 | Testes E2E em dispositivos reais |

### Ciclo 4 — Design system e otimização / P3
| ID | Descrição |
|---|---|
| DS-02 | Migrar 585 cores hardcoded para tokens de design |
| MAINT-FE-05 | Code splitting / reduzir bundle web |
| PROD-04 | Verificar estado do CP8 Evangelização / Ser Feliz |

### Ciclo 5 — Analytics Missionais (BLOQUEADO)
| ID | Descrição |
|---|---|
| ANALYTICS-01 | Data Foundation / Event Sourcing missional |
| ANALYTICS-02 | Dashboard de KPIs missionais |

> ⚠️ **BLOQUEADO:** `ANALYTICS-01` e `ANALYTICS-02` só podem ser iniciados após aprovação explícita de `LGPD-07`.

---

## 4. Ordem Recomendada de Execução

```
Ciclo 1 (P0)
  └─ MAINT-FE-01 → MAINT-FE-02 → MAINT-FE-03 → OPS-01 → OPS-02

Ciclo 2 (P1) — pode iniciar após Ciclo 1 concluído
  ├─ SEC-01, SEC-02 (técnico — paralelo)
  ├─ LGPD-01, LGPD-02, LGPD-03, LGPD-06 (processo — paralelo)
  ├─ LGPD-07 (avaliação — pode iniciar junto, gate para Ciclo 5)
  ├─ PROD-01 → PROD-05 (dependência: PROD-05 após PROD-01)
  └─ MOBILE-01 (após PROD-01, PROD-05, OPS-01, OPS-02)

Ciclo 3 (P2) — pode iniciar após Ciclo 2 concluído
  ├─ OPS-03, OPS-04, OPS-05 (processo — paralelo)
  ├─ LGPD-04, LGPD-05 (produto — paralelo)
  ├─ PROD-02, PROD-03 (produto — paralelo)
  ├─ DS-01, DS-03 (frontend — paralelo, simples)
  ├─ SEC-03, SEC-06 (segurança — paralelo)
  ├─ MAINT-FE-04 (manutenção)
  └─ MOBILE-02 (após MOBILE-01 + dispositivos disponíveis)

Ciclo 4 (P3) — pode iniciar após Ciclo 3 concluído
  ├─ DS-02 (grande — planejamento dedicado)
  ├─ MAINT-FE-05 (bundle)
  └─ PROD-04 (verificação CP8)

Ciclo 5 (Analytics) — bloqueado por LGPD-07
  └─ ANALYTICS-01 → ANALYTICS-02
```

---

## 5. Dependências Entre Itens

| Item | Depende de |
|---|---|
| MAINT-FE-02 | MAINT-FE-01 (ESLint configurado para auto-detectar console.log) |
| OPS-02 (CI) | MAINT-FE-01 (ESLint), OPS-01 (staging) |
| PROD-05 | PROD-01 (infra push estabelecida) |
| MOBILE-01 | OPS-01, OPS-02, PROD-01, PROD-05 |
| MOBILE-02 | MOBILE-01 |
| ANALYTICS-01 | LGPD-07 aprovado |
| ANALYTICS-02 | ANALYTICS-01 |
| LGPD-04 | Backend: novo endpoint `/auth/me/data-export` |
| SEC-01 (CSP enforced) | Validação em staging (OPS-01) — não ativar direto em produção |

---

## 6. Riscos

| Risco | Probabilidade | Impacto | Mitigação |
|---|---|---|---|
| CSP enforced quebrar features em produção | Média | Alto | Validar em staging antes de ativar (OPS-01 primeiro) |
| DS-02 (585 cores) introduzir regressão visual | Alta | Médio | Ciclo dedicado com auditoria light/dark por tela |
| MOBILE-01 revelar blocker de App Store | Média | Alto | Auditar cedo no Ciclo 2 para ter tempo de ajuste |
| LGPD-07 bloquear Analytics por prazo | Média | Médio | Iniciar LGPD-07 no Ciclo 2 mesmo sem pressão de Analytics |
| OPS-02 (CI) falhar por dependências antigas | Baixa | Médio | Usar matrix de build; não fixar versões desnecessariamente |
| SEC-04 (pentest) revelar vulnerabilidade grave | Baixa | Alto | Deixar SEC-04 para quando OPS-01 e OPS-02 estiverem estáveis |

---

## 7. O Que Deve Ser Feito Antes de App Store / Play Store

Itens obrigatórios antes de submeter às lojas (ordem sugerida):

1. `MAINT-FE-01` — ESLint real (CI depende)
2. `MAINT-FE-02` — Sem console.log em produção
3. `MAINT-FE-03` — Role guard no admin
4. `OPS-01` — Staging formal (validar build nativo)
5. `OPS-02` — CI básico (build nativo automatizado)
6. `PROD-01` — Push end-to-end funcionando
7. `PROD-05` — FCM iOS/Android validado
8. `MOBILE-01` — Auditoria EAS/App Store/Play Store (metadata, permissões, privacidade)
9. `SEC-01` — CSP enforced (exigência de App Store para webviews)
10. `LGPD-01`, `LGPD-02`, `LGPD-03`, `LGPD-06` — Documentação LGPD completa (exigência Play Store)

---

## 8. O Que NÃO Deve Ser Feito Ainda

- **Não iniciar** `ANALYTICS-01` ou `ANALYTICS-02` antes da aprovação de `LGPD-07`
- **Não ativar** CSP enforced em produção sem validação em staging
- **Não iniciar** DS-02 (585 cores) sem planejamento dedicado de auditoria visual
- **Não submeter** App Store / Play Store antes dos 10 itens listados acima
- **Não reabrir** H5A-01→07, Alert.alert, api.ts 204, Admin 2.0, hardening H1→H6A

---

## 9. Estratégia de Branches/Commits

- **Branch principal:** `main`
- **Ciclo 1:** commits pequenos e rastreáveis diretamente em `main` (ou feature branch curta por item)
  - `fix(frontend): configure real eslint` (MAINT-FE-01)
  - `fix(frontend): remove console.log from production` (MAINT-FE-02)
  - `fix(admin): add role guard to admin layout` (MAINT-FE-03)
  - `ops: add formal staging environment` (OPS-01)
  - `ci: add basic CI pipeline` (OPS-02)
- **Regra geral:** nunca commitar com build/lint/typecheck quebrado
- **Secrets:** nunca commitar em `.env` real — sempre via Railway/Vercel env vars
- **Diff review:** antes de todo commit, revisar diff completo

---

## 10. Estratégia de Validação

| Ciclo | Validação obrigatória |
|---|---|
| Ciclo 1 | `npx tsc --noEmit` + `npm run lint` passando; revisão manual das 3 telas admin afetadas |
| Ciclo 2 | Staging funcional; push testado em dispositivo real; checklist LGPD documentado |
| Ciclo 3 | Testes E2E smoke em staging; revisão visual light/dark para DS-01/DS-03 |
| Ciclo 4 | Auditoria visual completa light/dark para DS-02; métricas de bundle antes/depois |
| Ciclo 5 | Aprovação LGPD-07 documentada; revisão de schema de eventos missional |

---

## 11. Critérios de Conclusão do Ciclo POST-RC

O ciclo POST-RC é considerado concluído quando:

- [ ] Todos os 35 itens têm status "concluído" ou "cancelado com justificativa"
- [ ] App publicado na App Store e Google Play
- [ ] CI/CD rodando em todo PR
- [ ] Staging formal operacional
- [ ] LGPD documentada: retenção + ROPA + DPO + política atualizada
- [ ] Push notifications funcionando em iOS, Android e web
- [ ] Analytics Missionais em produção (se LGPD-07 aprovado)
- [ ] Zero console.log em produção
- [ ] Zero hardcoded colors fora dos tokens (DS-02)
- [ ] Pentest externo concluído e achados tratados

---

## Specs do Ciclo 1

- [MAINT-FE-01](../specs/2026-06-13-maint-fe-01-eslint-real.md) — ESLint real
- [MAINT-FE-02](../specs/2026-06-13-maint-fe-02-remove-console-log.md) — Remover console.log
- [MAINT-FE-03](../specs/2026-06-13-maint-fe-03-admin-layout-role-guard.md) — Role guard admin layout
- [OPS-01](../specs/2026-06-13-ops-01-staging-formal.md) — Staging formal
- [OPS-02](../specs/2026-06-13-ops-02-ci-basico.md) — CI básico
