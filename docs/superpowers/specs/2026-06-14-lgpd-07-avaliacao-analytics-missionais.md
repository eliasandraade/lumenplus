# LGPD-07 — Avaliação LGPD: Analytics Missionais

**Data:** 2026-06-14 | **Prioridade:** P1 | **Gate para Ciclo 5**

---

## Contexto Crítico

**Este item é o gate para o Ciclo 5 (Analytics Missionais).** Nenhum item do Ciclo 5 pode ser iniciado sem a aprovação explícita desta avaliação. Analytics de comportamento e uso de ferramentas espirituais exigem avaliação de impacto de privacidade específica.

---

## Problema

O Ciclo 5 prevê implementar analytics para:
- Uso de ferramentas missionárias (Projeto de Vida Mensal, Plano de Evangelização)
- Métricas de engajamento espiritual
- Relatórios de uso para o Conselho / liderança

Esses dados são sensíveis: revelam práticas religiosas, frequência de orações, atividade de evangelização. A LGPD trata dados sobre convicções religiosas como **dados sensíveis** (Art. 11), sujeitos a proteção reforçada.

Coletar esses dados analytics sem:
- Avaliação de impacto (DPIA — Data Protection Impact Assessment)
- Consentimento específico (Art. 11, I)
- Base legal robusta

...configura violação grave da LGPD.

---

## Objetivo

Realizar DPIA (Data Protection Impact Assessment) completa para os Analytics Missionais antes de qualquer implementação, e obter aprovação explícita do DPO + Conselho para prosseguir.

**Saída esperada:** Aprovação formal (pode iniciar Ciclo 5) ou Veto (não pode iniciar Ciclo 5).

---

## Escopo da Avaliação

A DPIA deve cobrir:
1. **Quais dados serão coletados** — eventos de uso, frequência, conteúdo? Identificados ou agregados?
2. **Finalidade real** — transparência para o usuário; o que o Conselho/liderança fará com esses dados?
3. **Base legal** — consentimento específico? Legítimo interesse? (Dados religiosos: Art. 11 exige consentimento específico)
4. **Risco de discriminação** — dados de engajamento espiritual podem ser usados para julgamento de pessoas
5. **Granularidade mínima** — usar dados agregados ao máximo; evitar dados identificados de engajamento espiritual
6. **Consentimento informado** — usuário sabe que seu engajamento espiritual é medido?
7. **Direito de opt-out** — usuário pode usar o app sem ser rastreado?

---

## Dependências

- **LGPD-01** (retenção) — analytics precisam de prazo definido
- **LGPD-02** (DPO) — DPO deve conduzir ou supervisionar a DPIA
- **LGPD-03** (ROPA) — analytics serão nova entrada no ROPA
- **LGPD-06** (política de privacidade) — política deve mencionar analytics antes de ativar

---

## Decisões Humanas Requeridas

| Decisão | Responsável |
|---------|-------------|
| Conduzir a DPIA | DPO |
| Definir escopo exato do Ciclo 5 (quais métricas?) | Elias + Conselho |
| Decisão final: aprovar ou vetar analytics | Conselho + DPO |
| Forma de consentimento específico | DPO + Conselho |

---

## Riscos

| Risco | Probabilidade | Mitigação |
|-------|---------------|-----------|
| Analytics de práticas religiosas = dados sensíveis LGPD Art. 11 | Certeza | Tratar como dado sensível em toda a implementação |
| Consentimento inválido (genérico, não específico) | Alta | Consentimento granular por tipo de analytics |
| Usuário não percebe que é rastreado | Alta | Aviso claro + opt-out fácil |
| DPO veta analytics: Ciclo 5 bloqueado | Média | Aceitar decisão; analytics não são requisito de sobrevivência do app |

---

## Plano da Avaliação (DPIA)

### Passo 1 — Definir escopo do Ciclo 5 (antes da DPIA)
- [ ] Elias + Conselho documentam exatamente que métricas o Ciclo 5 coletaria
- [ ] Definir: dados identificados vs. agregados; quem tem acesso aos relatórios

### Passo 2 — Conduzir DPIA
- [ ] DPO analisa os riscos para titulares
- [ ] DPO avalia necessidade e proporcionalidade
- [ ] DPO propõe medidas de mitigação (ex: anonimização, opt-out, consentimento)

### Passo 3 — Decisão formal
- [ ] Conselho recebe relatório da DPIA
- [ ] Votação: aprovar com condições / aprovar sem condições / vetar
- [ ] Decisão documentada e assinada

### Passo 4 — Se aprovado: preparar Ciclo 5
- [ ] Atualizar ROPA com nova atividade de tratamento
- [ ] Atualizar Política de Privacidade
- [ ] Implementar mecanismo de consentimento específico antes de qualquer evento analytics

---

## Critérios de Aceite

- DPIA completa documentada em `docs/ops/lgpd/dpia-analytics-missionais.md`
- Decisão formal do Conselho + DPO registrada
- Se aprovado: condições de implementação documentadas
- Se vetado: Ciclo 5 removido do backlog ou redesenhado para não tratar dados identificados

## Rollback

N/A — avaliação e decisão. Se Ciclo 5 for vetado, nenhum código de analytics pode ser implementado.

---

## Classificação

- **Depende de staging:** Não (avaliação, não código)
- **Bloqueia App Store/Play Store:** Não diretamente (analytics são pós-lançamento)
- **Implementável via código:** Não — avaliação jurídica e decisão humana
- **Depende de decisão humana:** ✅ Sim — totalmente (DPO + Conselho)
- **Gate para:** ✅ Todo o Ciclo 5 (Analytics Missionais) depende desta aprovação
