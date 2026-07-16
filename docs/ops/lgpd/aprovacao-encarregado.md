# LGPD — Pacote de Aprovação do Encarregado

- **Encarregado pelo Tratamento de Dados Pessoais:** Felipe Rocha Pinheiro Bastos
- **Canal oficial:** `lgpd@lumenserfeliz.org`
- **Data de preparação:** 2026-07-16
- **Status:** Aguardando revisão/aprovação do Encarregado

> Este pacote reúne, em um único lugar, todos os documentos LGPD que dependem da sua revisão/aprovação.
> **Nenhum documento aqui é juridicamente válido ou aprovado até a sua aprovação formal.** Os rascunhos permanecem marcados como DRAFT.

---

## Nota de privacidade (obrigatória)

- No repositório constam **apenas nome, e-mail institucional e função** do Encarregado.
- **CPF e documentos pessoais NÃO são versionados** — ficam somente na via assinada do ato de designação, arquivada institucionalmente **fora do GitHub**.

---

## Como usar este pacote

1. Revise cada documento listado abaixo.
2. Para cada um, registre: **Aprovado** / **Aprovado com ajustes** / **Reprovado** + comentários.
3. Assine o ato/termo formal de designação (fora do GitHub — ver nota de privacidade).
4. Comunique a aprovação à equipe técnica para aplicar os status de "aprovado".

---

## Documentos para revisão

| # | Documento | Item | Status atual | O que aprovar |
|---|-----------|------|--------------|---------------|
| 1 | `dpo-designacao.md` | LGPD-02 | DPO definido | Confirmar designação + formalizar ato assinado |
| 2 | `titular-requests.md` | — | Operacional | Fluxo e prazos de atendimento a titulares |
| 3 | `retencao-dados-draft.md` | LGPD-01 | DRAFT | Prazos de retenção por categoria; definição de "inativo"; purga (soft delete vs anonimização); endpoint `DELETE /me` |
| 4 | `ropa-draft.md` | LGPD-03 | DRAFT | Bases legais; foto como dado biométrico; dados de terceiros (evangelização); assinar o ROPA |
| 5 | `politica-privacidade-draft.md` | LGPD-06 | DRAFT | Texto final; publicação; linguagem jurídica |
| 6 | `analytics-missionais-dpia-draft.md` | LGPD-07 | DRAFT | Métricas permitidas vs proibidas; se autoriza avançar |

---

## Decisões-chave que dependem de você

- [ ] **Retenção (LGPD-01):** validar prazos, definição de inativo, soft delete vs anonimização, endpoint `DELETE /me`.
- [ ] **ROPA (LGPD-03):** confirmar bases legais, classificação de foto de rosto como biométrico, tratamento de dados de terceiros, assinar.
- [ ] **Política de Privacidade (LGPD-06):** aprovar texto e autorizar publicação.
- [ ] **Analytics (LGPD-07):** autorizar ou barrar; definir métricas permitidas.
- [ ] **Ato de designação:** formalizar (assinatura do representante legal) e arquivar fora do GitHub.

---

## Checklist final de aprovação (sign-off)

- [ ] Todos os 6 documentos revisados
- [ ] Ajustes solicitados registrados e aplicados pela equipe técnica
- [ ] Ato/termo de designação assinado e arquivado (fora do GitHub)
- [ ] Política de Privacidade aprovada para publicação
- [ ] Prazos de retenção confirmados
- [ ] ROPA assinado
- [ ] Decisão sobre analytics missionais registrada
- [ ] Comunicação à ANPD planejada (quando o sistema da ANPD estiver disponível)

> Enquanto este checklist não estiver completo, os documentos permanecem **DRAFT / aguardando aprovação** e nada é publicado ou implementado. A equipe técnica **não** marca LGPD como juridicamente aprovada sem a sua confirmação.

---

## Pendências técnicas relacionadas (equipe — não bloqueiam sua revisão)

- Atualizar o e-mail de contato na `LegalDocument` PRIVACY (v1.0) exposta pelo backend: exige **bump de versão + migration + re-aceite** (item próprio, fora do LGPD-02).
- `VAPID_EMAIL` do Web Push (`mailto:`) é config técnica, não é o canal LGPD — mantido como está.
