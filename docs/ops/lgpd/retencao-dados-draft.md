# LGPD-01 — Política de Retenção de Dados

> ⚠️ **STATUS: DRAFT** — Aguardando aprovação do DPO (LGPD-02)  
> Este documento não representa decisão final. Não pode ser publicado nem implementado sem aprovação do DPO.

**Data do rascunho:** 2026-06-14  
**Preparado por:** Equipe técnica  
**Aprovação pendente:** DPO a ser designado

---

## Base Legal

**LGPD Art. 15** — O término do tratamento de dados pessoais ocorrerá quando:
- A finalidade for alcançada ou quando os dados deixarem de ser necessários
- O titular solicitar (direito de exclusão — Art. 18, VI)
- Determinação da ANPD

**LGPD Art. 16** — Dados poderão ser conservados após término do tratamento:
- Para cumprimento de obrigação legal ou regulatória
- Para uso exclusivo do controlador (vedado acesso por terceiro), anonimizados

---

## Categorias de Dados e Retenção Proposta

> **DRAFT — todos os prazos abaixo precisam de aprovação do DPO**

### Dados de Conta e Identificação

| Dado | Tabela / Campo | Retenção Proposta | Justificativa |
|------|---------------|-------------------|---------------|
| Nome | `users.name` | Enquanto conta ativa + 30 dias após exclusão solicitada | Necessário para operação |
| E-mail | `users.email` | Enquanto conta ativa + 30 dias | Necessário para autenticação |
| UID Firebase | `users.firebase_uid` | Enquanto conta ativa | Vínculo com autenticação |
| Foto de perfil (URL Cloudinary) | `users.photo_url` | Enquanto conta ativa + 30 dias | Identidade visual |
| Telefone, CPF, RG | `users.*` | Enquanto conta ativa + 30 dias | Dados de cadastro |
| Data de nascimento | `users.birth_date` | Enquanto conta ativa + 30 dias | Cadastro |
| Cidade/UF | `users.city`, `users.uf` | Enquanto conta ativa + 30 dias | Cadastro |

### Dados Espirituais e Missionários (dados sensíveis — Art. 11)

| Dado | Tabela | Retenção Proposta | Justificativa |
|------|--------|-------------------|---------------|
| Projeto de Vida Mensal (reflexões, áreas, síntese) | `projetos_vida_mensal`, `areas_mensais` | Enquanto ativo + 1 ano após inatividade | Ferramenta pessoal de longo prazo |
| Plano de Evangelização | `plano_evangelizacao`, `acoes_evangelizacao` | Enquanto ativo + 1 ano | Ferramenta missionária |
| Reflexão de evangelização | `reflexao_evangelizacao` | Junto com PVM | Ferramenta espiritual |
| Estado de vida vocacional | `users.life_state_id` | Enquanto conta ativa | Perfil vocacional |
| Diretor espiritual | `projetos_vida_mensal.spiritual_director_*` | Junto com PVM | Dado sensível espiritual |

### Dados de Uso e Sistema

| Dado | Origem | Retenção Proposta | Justificativa |
|------|--------|-------------------|---------------|
| Logs de acesso | Railway infrastructure | Gerenciado pela Railway (SLA deles) | Fora do controle direto |
| Tokens JWT | Memória (não persistidos) | Expiração natural (~1h) | Sem persistência |
| Push subscriptions | `push_subscriptions` | Enquanto conta ativa + 30 dias | Para envio de notificações |
| Delivery log de notificações | `notification_delivery_log` | 90 dias | Diagnóstico de falhas |
| Audit log | `audit_log` | 2 anos | Conformidade, rastreabilidade |

---

## Definição de "Usuário Inativo"

> **DRAFT — precisa de decisão do DPO**

Proposta:
- Usuário que não fez login há **24 meses** = inativo
- Dados espirituais/missionários: retidos por mais **12 meses** após inatividade antes de purga
- Total máximo de retenção após último login: 36 meses

---

## Processo de Purga

> **DRAFT — precisa de aprovação técnica e DPO antes de implementar**

### Opções de purga

**Opção A — Anonimização (preferida para dados espirituais)**
```sql
-- Preserva registros para estatísticas agregadas, remove dados pessoais
UPDATE users SET name = 'Usuário Anonimizado', email = NULL,
  firebase_uid = NULL, photo_url = NULL, cpf = NULL, rg = NULL
WHERE last_login_at < NOW() - INTERVAL '36 months';
```

**Opção B — Soft delete + hard delete após grace period**
```sql
-- Passo 1: marcar para exclusão
UPDATE users SET deleted_at = NOW() WHERE id = :user_id;
-- Passo 2 (30 dias depois): excluir dados pessoais
DELETE FROM users WHERE deleted_at < NOW() - INTERVAL '30 days';
```

**Decisão pendente DPO:** soft delete ou anonimização?

### Endpoint de exclusão por solicitação (LGPD Art. 18, VI)

A implementar:
```
DELETE /me
→ Inicia grace period (30 dias)
→ Confirma via e-mail
→ Após 30 dias: anonimiza ou deleta dados pessoais
→ Registra no AuditLog
```

---

## Dados que NÃO podem ser excluídos imediatamente

| Dado | Motivo de retenção |
|------|-------------------|
| AuditLog | Rastreabilidade de ações (2 anos) |
| Logs de erros Sentry | Diagnóstico — gerenciado pela Sentry com retenção própria |
| Registros de aceite de termos | Conformidade legal — evidência de consentimento |

---

## Pendências para Aprovação do DPO

- [ ] Validar prazos de retenção para cada categoria
- [ ] Definir o que é "usuário inativo" (tempo de corte)
- [ ] Decidir: soft delete vs anonimização para dados espirituais
- [ ] Aprovar endpoint `DELETE /me` antes de implementar
- [ ] Revisar se há obrigação legal de retenção mínima (contábil, fiscal)
- [ ] Confirmar que dados de menores foram identificados e tratados com rigor adicional

---

## Histórico do Documento

| Versão | Data | Autor | Status |
|--------|------|-------|--------|
| 0.1 draft | 2026-06-14 | Equipe técnica | DRAFT — aguardando DPO |
