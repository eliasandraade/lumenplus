# Ciclo 2 — Segurança, LGPD e Mobile Base
## Plano Mestre — POST-RC

**Data:** 2026-06-14  
**Branch de planejamento:** `post-rc/ciclo-2-planning`  
**Pré-requisito:** Ciclo 1 mergeado em `main` ✅

---

## Visão Geral

O Ciclo 2 agrupa todos os itens P1 do POST-RC que tratam de segurança aplicada, conformidade LGPD e preparação para lançamento mobile nativo. São 12 itens que variam de mudanças de código simples até decisões de Conselho e contratos com auditores externos.

**Objetivo central:** deixar o Lumen+ apto para:
- CSP enforced em produção (sem quebrar autenticação Firebase/Sentry)
- Conformidade LGPD documentada e auditável
- App Store Connect / Google Play Console configurados para submissão

---

## Itens do Ciclo 2

| ID | Nome | Tipo | Depende de | Staging obrigatório |
|----|------|------|------------|---------------------|
| SEC-01 | CSP frontend enforced | Código | staging validado | Sim |
| SEC-02 | npm audit / vulnerabilidades | Código | — | Não |
| SEC-04 | Pentest externo formal | Processo externo | fornecedor, budget | Não (prod só leitura) |
| SEC-05 | Rotação de segredos | Operação | Elias (acesso ao painel) | Não |
| LGPD-01 | Política de retenção de dados | Jurídico + Código | Conselho/DPO | Não |
| LGPD-02 | Designar DPO/Encarregado | Institucional | Conselho | Não |
| LGPD-03 | ROPA / Inventário de tratamento | Jurídico + Documento | DPO designado | Não |
| LGPD-06 | Revisar Política de Privacidade | Jurídico + Código | LGPD-01, 02, 03 | Não |
| LGPD-07 | Avaliação LGPD Analytics Missionais | Jurídico | LGPD-01, 02, 03, 06 | Não |
| PROD-01 | Push web end-to-end | Código + Infra | VAPID keys em prod | Sim (preferível) |
| PROD-05 | FCM mobile iOS/Android | Código + Infra | eas.json, FCM, certificados | Sim |
| MOBILE-01 | Auditar EAS / App Store / Play Store | Processo + Código | Apple/Google accounts | Não |

---

## Dependências e Bloqueios

```
SEC-01 ──────────────────────────────── staging isolado obrigatório antes de enforced em prod
SEC-02 ──────────────────────────────── pode iniciar agora (build-time vulns, não runtime)
SEC-04 ──────────────────────────────── depende de contratar fornecedor + budget aprovado
SEC-05 ──────────────────────────────── decisão humana de quando rotar + acesso Railway/Vercel

LGPD-02 ─── (antes de) ──► LGPD-01 ─► LGPD-03 ─► LGPD-06 ─► LGPD-07
      └─────────────────────────────────────────────────────────── gate para Ciclo 5 Analytics

PROD-01 ─── VAPID keys configuradas em prod ─► pode testar em staging primeiro
PROD-05 ─── eas.json + expo-notifications + FCM server key ─► staging obrigatório
MOBILE-01 ── Apple Developer + Google Play accounts ─► antes de PROD-05
```

---

## Classificação por Natureza

### Implementável via código agora (ou após staging)
- **SEC-01** — mudar header de `Content-Security-Policy-Report-Only` para `Content-Security-Policy` no `vercel.json`. Requer validação em staging primeiro.
- **SEC-02** — investigar e documentar as 44 vulnerabilidades do `npm audit`. Provavelmente build-time; poucas requerem mudança de código.
- **PROD-01** — ativar VAPID keys em produção e testar subscription/push end-to-end.
- **PROD-05** — criar `eas.json`, adicionar `expo-notifications` ao `app.json`, configurar FCM.

### Depende de decisão humana / Conselho
- **LGPD-01** — definir períodos de retenção por tipo de dado (decisão do DPO + Conselho)
- **LGPD-02** — nomear formalmente o DPO (decisão institucional do Conselho)
- **LGPD-03** — construir ROPA (precisa de LGPD-02 e conhecimento de todos os fluxos de dados)
- **LGPD-06** — revisar texto da Política (depende de LGPD-01 e LGPD-03)
- **LGPD-07** — avaliação de impacto Analytics (precisa de LGPD completo)
- **SEC-04** — contratar empresa de pentest (decisão de budget + fornecedor)

### Depende de painel externo
- **SEC-05** — rotar segredos (Railway env vars, sem exposição aqui)
- **MOBILE-01** — Apple Developer Program, App Store Connect, Google Play Console (contas externas)
- **PROD-05** — Firebase Cloud Messaging server key (Firebase Console)

### Gate para Ciclo 5 (Analytics Missionais)
- **LGPD-07** — aprovação explícita obrigatória antes de iniciar qualquer item do Ciclo 5

---

## Ordem Recomendada de Execução

### Fase A — O que pode começar agora (sem staging isolado)
1. `SEC-02` — mapear vulnerabilidades npm audit; decidir quais corrigir
2. `LGPD-02` — Elias designar DPO formalmente (institucional, sem código)
3. `MOBILE-01` — auditar `app.json`/`eas.json`; criar `eas.json`; abrir contas App Store Connect e Google Play

### Fase B — Após staging estar isolado (Railway + Vercel env var corretos)
4. `SEC-01` — testar CSP enforced em staging; validar Firebase, Sentry, Cloudinary; depois enforced em prod
5. `PROD-01` — configurar VAPID keys reais; testar push web em staging; depois prod
6. `PROD-05` — `expo-notifications`, FCM server key, `eas.json`; build EAS; testar em staging

### Fase C — Após LGPD-02 designado
7. `LGPD-01` — política de retenção (documento + código de purga se necessário)
8. `LGPD-03` — ROPA completo
9. `LGPD-06` — revisar Política de Privacidade (nova migration de aceite se houver mudança relevante)
10. `LGPD-07` — avaliação de impacto Analytics (gate para Ciclo 5)

### Fase D — Após SEC-04 contratado
11. `SEC-04` — pentest externo; receber relatório; tratar achados

### Fase E — Processo contínuo
12. `SEC-05` — rotação de segredos (processo documentado; execução quando necessário)

---

## Riscos

| Risco | Impacto | Mitigação |
|-------|---------|-----------|
| CSP enforced quebra Firebase Auth (popup OAuth) | Alto — login para | Testar em staging; incluir `frame-src *.firebaseapp.com *.google.com` |
| CSP enforced quebra Sentry | Médio — sem monitoramento | Incluir `connect-src *.sentry.io *.ingest.sentry.io` (já na CSP atual) |
| CSP enforced quebra Cloudinary (upload de imagens) | Médio | Incluir `connect-src *.cloudinary.com` (já na CSP atual) |
| expo-notifications exige rebuild nativo | Alto — novo EAS build | Não pode ser hot-updated; requer nova submissão às lojas |
| npm audit: atualizar Expo SDK sem plano | Crítico — quebra app | Só atualizar SDK com plano de testes completo; não atualizar durante Ciclo 2 |
| LGPD-06 gera nova versão de Política | Baixo-médio | Migration de aceite é bem entendida; manter padrão existente |
| Pentest encontra vulnerabilidade crítica | Alto | Ter plano de hotfix; não publicar achados externamente antes de corrigir |

---

## Critérios de Conclusão do Ciclo 2

- [ ] CSP enforced em produção, sem erros de console em login/uso normal
- [ ] npm audit: zero high/critical em dependências runtime (build-time documentadas e aceitas)
- [ ] DPO designado formalmente (LGPD-02)
- [ ] ROPA criado (LGPD-03)
- [ ] Política de Privacidade revisada e publicada se necessário (LGPD-06)
- [ ] LGPD-07 avaliada (gate para Ciclo 5 desbloqueado ou explicitamente mantido bloqueado)
- [ ] Push web funcional end-to-end (PROD-01)
- [ ] Push mobile FCM funcional (PROD-05) — ou decisão de postergar para pós-lançamento
- [ ] `eas.json` criado, builds EAS funcionando (MOBILE-01)
- [ ] Relatório de pentest recebido e achados tratados (SEC-04) — ou pentest agendado com prazo
- [ ] Processo de rotação de segredos documentado e executado ao menos uma vez (SEC-05)

---

## Critérios para Liberar Preparação App Store / Play Store

Antes de submeter às lojas:
- [ ] MOBILE-01 concluído (eas.json, bundle IDs, ícones, splash screen validados)
- [ ] PROD-05 concluído (FCM configurado, push mobile testado)
- [ ] PROD-01 concluído (push web também funcional)
- [ ] SEC-01 concluído (CSP enforced)
- [ ] LGPD-06 concluído (Política atualizada)
- [ ] Staging isolado validado com smoke tests completos
- [ ] SEC-04 pelo menos agendado (não bloqueia submissão, mas deve preceder lançamento público)
