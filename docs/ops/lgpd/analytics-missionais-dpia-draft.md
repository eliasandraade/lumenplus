# LGPD-07 — Analytics Missionais: Avaliação de Impacto (DPIA) — DRAFT

> ⚠️ **STATUS: DRAFT** — Aguardando revisão/aprovação do Encarregado (LGPD-02) e do Conselho.
> **Nenhuma métrica sensível é coletada ou ativada.** Este documento é apenas avaliação preparatória; não há implementação de código runtime.

- **Preparado por:** Equipe técnica
- **Data:** 2026-07-16
- **Encarregado:** Felipe Rocha Pinheiro Bastos (`lgpd@lumenserfeliz.org`)
- **Base legal de referência:** LGPD Art. 5º (dados sensíveis), Art. 11 (tratamento de dados sensíveis), Art. 38 (relatório de impacto / DPIA)

---

## Objetivo

Avaliar, **antes de qualquer implementação**, se e como métricas de uso podem ser coletadas sem violar a LGPD, dado que o Lumen+ trata dados espirituais/religiosos (**dados sensíveis**, Art. 11).

---

## Princípios (invioláveis nesta fase)

- **NÃO** ativar analytics missionais sem aprovação do Encarregado e do Conselho.
- **NÃO** coletar dado sensível para métricas.
- **NÃO** criar dashboard de conteúdo espiritual individual.
- **NÃO** expor o Projeto de Vida de nenhum usuário.

---

## Métricas PERMITIDAS (agregadas, anônimas, não sensíveis)

| Métrica | Por que é aceitável | Condição |
|--------|---------------------|----------|
| Usuários ativos (DAU/MAU) | Contagem agregada, sem conteúdo | Sem recorte que reidentifique |
| Nº de ciclos de Projeto de Vida criados | Volume, sem conteúdo das reflexões | Apenas contagem |
| Adoção de features (telas abertas) | UX, sem dado pessoal | Evento anônimo, sem PII |
| Taxa de conclusão de onboarding | Operacional | Agregado |
| Erros técnicos (Sentry) | Manutenção | PII scrubbing ativo |

---

## Métricas PROIBIDAS (sensíveis / reidentificáveis)

| Métrica | Por que é proibida |
|--------|--------------------|
| Conteúdo de reflexões / Projeto de Vida | Dado sensível (convicção religiosa) — Art. 11 |
| Frequência de práticas espirituais por indivíduo | Sensível e reidentificável |
| Diretor espiritual / confissão | Dado sensível |
| Dados de pessoas evangelizadas (terceiros) | Dado de terceiro sem base legal |
| Qualquer métrica individual de conteúdo espiritual | Viola Art. 11 |

---

## Requisitos técnicos (SE aprovado no futuro)

- Coleta apenas de eventos **anônimos**, sem identificador que reidentifique o titular.
- **Nenhum** conteúdo espiritual enviado a qualquer ferramenta de analytics.
- Mecanismo de opt-out claro (opt-in se necessário).
- **DPIA formal** (Art. 38) concluída antes de qualquer produção.
- Ferramenta de analytics com DPA; se fora do Brasil, garantias de transferência internacional.

---

## Backlog técnico futuro (NÃO implementar agora)

- [ ] Definir camada de telemetria anônima (sem PII).
- [ ] Definir catálogo **fechado** de eventos permitidos.
- [ ] Revisão do Encarregado sobre cada evento antes de ligar.
- [ ] DPIA completa antes de ativar em produção.

---

## Status

Aguardando: (1) aprovação do Encarregado; (2) aprovação do Conselho. **Sem implementação de código runtime sensível.** Enquanto isso, nenhuma coleta de analytics missional é feita.
