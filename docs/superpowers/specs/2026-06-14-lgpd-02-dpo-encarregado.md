# LGPD-02 — Designar DPO / Encarregado de Dados

**Data:** 2026-06-14 | **Prioridade:** P1 | **Depende de staging:** Não

---

## Problema

A LGPD (Art. 41) exige que todo controlador de dados pessoais indique um Encarregado pelo Tratamento de Dados Pessoais (DPO — Data Protection Officer). O Lumen+ trata dados pessoais de usuários (nome, e-mail, dados espirituais, métricas pessoais) e não tem DPO formalmente designado.

Sem DPO designado:
- Violação direta da LGPD Art. 41
- Não há interlocutor formal para titular de dados exercer direitos (Art. 18)
- Não há responsável pela aprovação das políticas de retenção (LGPD-01) e ROPA (LGPD-03)
- ANPD pode aplicar sanções

---

## Objetivo

Designar formalmente o DPO/Encarregado do Lumen+ e publicar seus dados de contato conforme exigido pela LGPD Art. 41, §1º.

---

## Escopo

- Decisão interna: quem será o DPO (Elias, membro do Conselho, ou terceiro)
- Publicar nome e canal de contato do DPO na Política de Privacidade e no app
- Criar canal de contato dedicado (e-mail ou formulário) para requisições de titulares

## Fora de Escopo

- Certificação formal do DPO (não obrigatória pela LGPD)
- DPO externo contratado (pode ser membro interno)

---

## Requisitos Legais

**LGPD Art. 41:**
> "O controlador deverá indicar encarregado pelo tratamento de dados pessoais."

**LGPD Art. 41, §1º:**
> "A identidade e as informações de contato do encarregado deverão ser divulgadas publicamente, de forma clara e objetiva, preferencialmente no sítio eletrônico do controlador."

**LGPD Art. 41, §2º — Atribuições do encarregado:**
> - Aceitar reclamações e comunicações dos titulares
> - Prestar esclarecimentos e adotar providências
> - Orientar os funcionários e os contratados sobre as práticas de proteção de dados
> - Executar as demais atribuições determinadas pelo controlador ou a normas complementares

---

## Decisões Humanas Requeridas

| Decisão | Responsável |
|---------|-------------|
| Quem será o DPO | Conselho / Elias |
| Canal de contato do DPO (e-mail dedicado?) | DPO eleito |
| Comunicar DPO à ANPD (quando sistema ANPD estiver disponível) | DPO eleito |

---

## Plano de Implementação

### Passo 1 — Decisão interna (sem código)
- [ ] Conselho decide quem é o DPO
- [ ] DPO aceita formalmente a designação
- [x] Canal oficial para titulares definido: `lgpd@lumenserfeliz.org` (Encarregado: Felipe Rocha Pinheiro Bastos)

### Passo 2 — Publicar informações do DPO
- [ ] Adicionar nome e contato do DPO na Política de Privacidade (LGPD-06)
- [ ] Adicionar link para contato do DPO na tela de configurações do app
- [ ] Adicionar no rodapé do site (se houver)

### Passo 3 — Criar processo de atendimento a titulares
Documentar em `docs/ops/lgpd-titular-requests.md`:
- SLA de resposta: 15 dias (LGPD Art. 18, §3º — prazo máximo imediato)
- Tipos de requisição: acesso, correção, exclusão, portabilidade, revogação de consentimento
- Como processar cada tipo no backend

---

## Critérios de Aceite

- DPO designado formalmente (decisão documentada)
- Nome e contato do DPO publicados na Política de Privacidade
- Canal de contato do DPO operacional (e-mail responde)
- Processo de atendimento a titulares documentado

## Rollback

N/A — designação de DPO é cumulativa, não reversível. Para trocar o DPO: nova designação formal + atualização nas publicações.

---

## Classificação

- **Depende de staging:** Não
- **Bloqueia App Store/Play Store:** Apple/Google exigem política de privacidade; DPO é parte dela
- **Implementável via código:** Não — decisão institucional/humana; código mínimo para exibir contato
- **Depende de decisão humana:** ✅ Sim — totalmente (quem é o DPO é decisão do Conselho)
- **Gate para:** LGPD-01, LGPD-03, LGPD-06, LGPD-07 (todos dependem do DPO designado)
