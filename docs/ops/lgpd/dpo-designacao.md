# LGPD-02 — DPO / Encarregado de Dados: Processo de Designação

**Data:** 2026-06-14  
**Status:** Aguardando decisão do Conselho

---

## Base Legal

**LGPD Art. 41:**
> "O controlador deverá indicar encarregado pelo tratamento de dados pessoais."

**LGPD Art. 41, §1º:**
> "A identidade e as informações de contato do encarregado deverão ser divulgadas publicamente, de forma clara e objetiva, preferencialmente no sítio eletrônico do controlador."

**Controlador:** Obra Lumen de Evangelização — CNPJ 19.614.384/0001-60  
**Sítio eletrônico:** https://lumenplus.app

---

## Responsabilidades do DPO (LGPD Art. 41, §2º)

O Encarregado pelo Tratamento de Dados Pessoais deve:

1. **Aceitar reclamações e comunicações** dos titulares dos dados e prestar esclarecimentos
2. **Adotar providências** para atender às requisições dos titulares (acesso, correção, exclusão, portabilidade)
3. **Receber comunicações da ANPD** e adotar providências
4. **Orientar** funcionários, contratados e parceiros sobre proteção de dados
5. **Executar demais atribuições** determinadas pelo controlador

---

## Critérios para Escolha do DPO

O DPO não precisa de certificação formal (a LGPD não exige). Deve ter:

- [ ] Conhecimento básico da LGPD e das obrigações do controlador
- [ ] Disponibilidade para atender titulares em até **15 dias corridos** (prazo legal — LGPD Art. 18, §3º)
- [ ] Acesso ao Conselho para orientações sobre tratamento de dados
- [ ] Canal de comunicação dedicado (e-mail ou formulário)

---

## Opções de DPO

### Opção A — DPO Interno (membro da liderança)
**Vantagem:** Conhecimento do contexto missional; sem custo adicional  
**Desvantagem:** Pode ter conflito de interesse em decisões sobre uso de dados

### Opção B — Membro do Conselho designado
**Vantagem:** Autoridade institucional; alinhamento com missão  
**Desvantagem:** Disponibilidade limitada

### Opção C — Terceiro (advogado/especialista em LGPD)
**Vantagem:** Expertise técnica; sem conflito de interesse  
**Desvantagem:** Custo; menor conhecimento do contexto missional

**Recomendação:** Opção A ou B para início. Opção C se houver fiscalização ANPD.

---

## Canal de Contato Recomendado

**E-mail:** `privacidade@lumenplus.app` — canal institucional público obrigatório para o DPO.

Este canal deve ser criado e controlado pela instituição, não por e-mail pessoal de nenhum membro. Opções para implementação:

- Domínio próprio operacional: criar caixa `privacidade@lumenplus.app` e conceder acesso ao DPO designado
- Domínio ainda não operacional: **canal temporário institucional a definir pelo Conselho** — ex. formulário público hospedado no Vercel ou caixa criada especificamente para este fim

**O canal de contato do DPO deve ser publicável na Política de Privacidade e adequado para titular de dados.**  
E-mails pessoais não devem ser usados como canal oficial.

---

## Minuta de Designação Formal

```
DESIGNAÇÃO DE ENCARREGADO PELO TRATAMENTO DE DADOS PESSOAIS

Pela presente, a Obra Lumen de Evangelização, CNPJ 19.614.384/0001-60,
com sede na Rua Coronel Jucá, 2040, Meireles, Fortaleza/CE,

DESIGNA formalmente:

Nome: ___________________________________
Cargo/Função: ___________________________
E-mail de contato: privacidade@lumenplus.app

Como Encarregado pelo Tratamento de Dados Pessoais (DPO),
nos termos do Art. 41 da Lei nº 13.709/2018 (LGPD),
com as responsabilidades previstas no §2º do mesmo artigo.

Esta designação é válida a partir de: ____/____/______

Fortaleza/CE, ____/____/______

_______________________________
Representante Legal da Obra Lumen de Evangelização
```

---

## Checklist para Publicação (após designação)

- [ ] Publicar nome e contato do DPO na Política de Privacidade (LGPD-06)
- [ ] Adicionar link de contato do DPO na tela de configurações do app
- [ ] Confirmar que o canal de contato (e-mail) está operacional
- [ ] Comunicar designação à ANPD quando sistema ANPD estiver disponível
- [ ] Atualizar `docs/ops/lgpd/titular-requests.md` com nome do DPO

---

## Impacto nos Demais Itens LGPD

| Item | Dependência |
|------|-------------|
| LGPD-01 — Retenção de dados | DPO deve aprovar os períodos de retenção |
| LGPD-03 — ROPA | DPO conduz ou supervisiona a construção do ROPA |
| LGPD-06 — Política de Privacidade | DPO revisa e aprova o texto final |
| LGPD-07 — Avaliação Analytics | DPO conduz a DPIA dos analytics missionais |

**Todos esses itens ficam bloqueados até a designação formal do DPO.**

---

## Decisão Pendente

**Para o Conselho / Elias:**

> Quem será o DPO do Lumen+?
> Qual o canal de contato público (e-mail)?
> Quando será feita a designação formal?

Registrar decisão neste documento após tomada.
