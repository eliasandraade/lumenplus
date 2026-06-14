# LGPD-03 — ROPA / Inventário de Tratamento de Dados

**Data:** 2026-06-14 | **Prioridade:** P1 | **Depende de staging:** Não

---

## Problema

O Lumen+ não tem ROPA (Records of Processing Activities — Registro das Atividades de Tratamento) documentado. A LGPD Art. 37 exige que o controlador mantenha registro das operações de tratamento que realize. Sem ROPA:
- Não há visibilidade sobre quais dados pessoais são tratados, por quem, para qual finalidade
- Não é possível demonstrar conformidade em eventual fiscalização da ANPD
- DPO não tem base para orientar decisões de retenção (LGPD-01)

---

## Objetivo

Construir e documentar o ROPA completo do Lumen+, mapeando cada fluxo de dados pessoais com:
- Categoria de dado
- Finalidade do tratamento
- Base legal (Art. 7º LGPD)
- Prazo de retenção
- Compartilhamento com terceiros
- Medidas de segurança aplicadas

---

## Escopo

- Todos os dados coletados pelo app (backend + mobile)
- Dados compartilhados com: Firebase, Railway, Vercel, Sentry, Cloudinary, SendGrid
- Dados armazenados no PostgreSQL

## Fora de Escopo

- Dados de analítica de comportamento (não implementado — gate LGPD-07)
- Dados de push notification (quando PROD-01/05 implementados: atualizar ROPA)

---

## Dependências

- **LGPD-02** (DPO designado) — DPO deve revisar e aprovar o ROPA
- **LGPD-01** (prazos de retenção definidos) — necessários para completar o ROPA

---

## Inventário Preliminar (base para ROPA)

### Dados Coletados Diretamente

| Dado | Tabela/Campo | Finalidade | Base Legal | Compartilhado com |
|------|-------------|------------|------------|-------------------|
| Nome | `users.name` | Identificação | Execução de contrato (Art. 7º, V) | Firebase Auth |
| E-mail | `users.email` | Autenticação | Execução de contrato | Firebase Auth, SendGrid |
| UID Firebase | `users.firebase_uid` | Autenticação | Execução de contrato | Firebase Auth |
| Foto de perfil URL | `users.photo_url` | Identificação visual | Legítimo interesse | Cloudinary |
| Dados de reflexão espiritual | `projetos_vida_mensal.*` | Ferramenta espiritual pessoal | Consentimento (Art. 7º, I) | Nenhum |
| Dados de evangelização | `plano_evangelizacao.*` | Ferramenta missionária | Consentimento | Nenhum |
| Papel/função (`role`) | `users.role` | Controle de acesso | Execução de contrato | Nenhum |

### Dados Coletados Indiretamente

| Dado | Origem | Finalidade | Base Legal |
|------|--------|------------|------------|
| Logs de acesso | Railway (infraestrutura) | Segurança / operação | Legítimo interesse |
| Stack traces de erro | Sentry | Diagnóstico técnico | Legítimo interesse |
| Tokens de sessão | JWT / `SECRET_KEY` | Autenticação | Execução de contrato |

---

## Plano de Implementação

### Passo 1 — Completar mapeamento (sem código)
- [ ] DPO revisa todas as tabelas do banco com `\d+` no psql
- [ ] DPO confirma base legal para cada categoria de dado
- [ ] DPO confirma prazos de retenção (output de LGPD-01)

### Passo 2 — Documentar ROPA formal
Criar `docs/ops/lgpd/ropa.md` com tabela completa (formato ANPD):
- Nome do processo de tratamento
- Categoria de titular
- Categoria de dados pessoais
- Finalidade
- Base legal (Art. 7º LGPD)
- Prazo de retenção
- Destinatários (terceiros / suboperadores)
- País de destino (se dados saem do Brasil)
- Medidas de segurança

### Passo 3 — Revisão jurídica
- [ ] Advogado/DPO revisa o ROPA
- [ ] Aprovar bases legais escolhidas (consentimento vs contrato vs legítimo interesse)
- [ ] Versionar e assinar o documento

---

## Critérios de Aceite

- `docs/ops/lgpd/ropa.md` criado, revisado e aprovado pelo DPO
- Todas as tabelas do banco mapeadas no ROPA
- Todos os suboperadores identificados (Firebase, Railway, Vercel, Sentry, Cloudinary, SendGrid)
- Base legal documentada para cada categoria de dado
- ROPA versionado com data de aprovação

## Rollback

N/A — documento. Versionar no git; atualizar quando o modelo de dados mudar.

---

## Classificação

- **Depende de staging:** Não
- **Bloqueia App Store/Play Store:** Apple exige descrição de uso de dados no App Store Connect (Privacy Nutrition Label) — ROPA é a base para preenchê-la
- **Implementável via código:** Não — documento + processo
- **Depende de decisão humana:** ✅ Sim — DPO deve aprovar; advogado deve revisar bases legais
