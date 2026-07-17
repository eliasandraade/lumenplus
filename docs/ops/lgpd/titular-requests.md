# LGPD — Fluxo de Atendimento a Titulares de Dados

**Data:** 2026-06-14  
**Responsável:** Felipe Rocha Pinheiro Bastos — Encarregado pelo Tratamento de Dados Pessoais (LGPD-02)\
**Base legal:** LGPD Art. 18 e Art. 19

---

## Canal de Contato

**E-mail oficial:** `lgpd@lumenserfeliz.org`

**Encarregado responsável:** Felipe Rocha Pinheiro Bastos

> Todo pedido de titular deve ser encaminhado ao Encarregado pelo Tratamento de Dados Pessoais.

---

## Direitos dos Titulares (LGPD Art. 18)

| Direito | Descrição | Prazo de Resposta |
|---------|-----------|-------------------|
| Acesso (I) | Confirmação da existência de tratamento e acesso aos dados | Imediato / 15 dias corridos |
| Correção (II) | Correção de dados incompletos, inexatos ou desatualizados | 15 dias corridos |
| Anonimização / Bloqueio / Eliminação (III) | Dados desnecessários ou tratados em desconformidade | 15 dias corridos |
| Portabilidade (IV) | Fornecimento dos dados em formato interoperável | 15 dias corridos |
| Eliminação após consentimento (V) | Excluir dados tratados com base em consentimento | 15 dias corridos |
| Informação sobre compartilhamento (VI) | Informar com quem os dados são compartilhados | Imediato / 15 dias corridos |
| Revogação de consentimento (IX) | Revogar consentimento anteriormente dado | Imediato |

**Prazo legal:** Art. 18, §3º — resposta deve ser imediata ou justificada; prazo máximo razoável é 15 dias corridos (referência de boas práticas ANPD).

---

## Fluxo por Tipo de Requisição

### 1. Acesso aos Dados

**Recebimento:** Encarregado recebe e-mail em `lgpd@lumenserfeliz.org`\
**Verificação de identidade:** confirmar que o solicitante é o titular (comparar e-mail com cadastro)  
**Resposta:**
```
Dados armazenados: nome, e-mail, telefone, data de nascimento, UF, cidade,
estado de vida, estado civil, instrumentos, interesse em ministério,
Projeto de Vida Mensal (reflexões, áreas, evangelização).
```
**Formato:** e-mail descritivo ou exportação JSON via `GET /auth/me/data-export` _(endpoint a implementar em LGPD-04)_

---

### 2. Correção de Dados

**Solicitante:** enviar dados incorretos e os corretos  
**Ação:** DPO acessa painel admin → busca usuário → corrige dados  
**Registro:** anotar no AuditLog (via endpoint admin existente)

---

### 3. Eliminação / Exclusão de Conta

**Solicitante:** e-mail solicitando exclusão  
**Verificação:** confirmar identidade do titular  
**Processo atual (manual):**
1. Admin acessa Railway → psql → executa exclusão suave (marcar `deleted_at`)
2. Aguarda período de grace (30 dias recomendado)
3. Confirma exclusão ao titular

**Processo futuro:** endpoint `DELETE /me` (LGPD-01)  
**Registro:** AuditLog com `action = "user_deletion_requested"` e `action = "user_deleted"`

---

### 4. Portabilidade

**Solicitante:** e-mail solicitando exportação dos dados  
**Formato esperado:** JSON  
**Processo atual:** manual via query no banco + exportação para arquivo  
**Processo futuro:** `GET /auth/me/data-export` (LGPD-04)  
**Prazo:** 15 dias corridos

---

### 5. Anonimização / Bloqueio

**Solicitante:** e-mail solicitando que dados não sejam mais usados (sem exclusão)  
**Ação:** marcar usuário como `opt_out = true` em campo futuro  
**Processo atual:** manual — DPO notifica equipe técnica para bloquear dados  
**Registro:** AuditLog

---

### 6. Revogação de Consentimento

**Contexto:** usuário aceitou Termos de Uso / Política de Privacidade no cadastro  
**Solicitante:** e-mail ou ação no app  
**Efeito:** revogação inicia processo de exclusão (o app não funciona sem aceite dos termos)  
**Processo:** mesmo que Eliminação (item 3 acima)

---

### 7. Informação sobre Compartilhamento

**Resposta padrão:**
```
Seus dados são compartilhados com:
- Firebase Authentication (Google LLC) — autenticação
- Railway (Braintrust Group Inc.) — hospedagem do banco de dados
- Vercel Inc. — hospedagem do frontend
- Sentry — monitoramento de erros (sem dados pessoais identificáveis)
- Cloudinary — armazenamento de fotos de perfil
- SendGrid (Twilio) — envio de e-mails transacionais
```

---

## Registro e Auditoria

Toda requisição de titular deve ser registrada em planilha ou sistema:

| Campo | Exemplo |
|-------|---------|
| Data de recebimento | 2026-06-14 |
| Tipo de requisição | Acesso |
| Identificação do titular | e-mail (parcialmente mascarado) |
| Data de resposta | 2026-06-20 |
| Resultado | Exportação enviada |
| Observações | — |

Arquivo sugerido: `docs/ops/lgpd/titular-requests-log.csv` (não commitar no git — dados pessoais)

---

## Contato da ANPD

**Autoridade Nacional de Proteção de Dados (ANPD)**  
Site: https://www.gov.br/anpd  
Ouvidoria: https://www.gov.br/anpd/pt-br/canais_atendimento  

Se a ANPD entrar em contato: encaminhar imediatamente para o DPO designado.
