# Lumen+ — LGPD e Dados Sensíveis

**Versão da documentação:** 1.0  
**Data:** 2026-06-12  
**Audiência:** desenvolvedor, operador, DPO/responsável legal

> **Aviso:** Este documento é documentação técnica e operacional. Não constitui parecer jurídico. Para avaliação formal de conformidade com a LGPD, consulte profissional jurídico habilitado.

---

## Visão Geral

O Lumen+ coleta e processa dados pessoais de membros de uma comunidade religiosa. Este documento descreve: quais dados são coletados, como são protegidos tecnicamente, os mecanismos de exclusão e anonimização implementados, os controles de acesso a dados sensíveis e as limitações conhecidas até o RC.

Os controles técnicos descritos aqui estão alinhados a princípios de minimização de dados, restrição de acesso, auditabilidade e anonimização. Eles não substituem uma avaliação jurídica formal de conformidade. A adequação formal à LGPD deve ser validada com DPO ou advogado especializado.

---

## Dados Coletados

### Dados de Cadastro (UserProfile)

| Dado | Armazenamento | Criptografia |
|------|--------------|-------------|
| Nome completo | Texto plano | Não |
| E-mail | Texto plano (UserIdentity) | Não |
| Data de nascimento | Texto plano | Não |
| Cidade / Estado | Texto plano | Não |
| Foto de perfil (URL) | URL Cloudinary | Não |
| Estado de vida (catálogo) | Texto plano | Não |
| Realidade vocacional (catálogo) | Texto plano | Não |
| Estado civil (catálogo) | Texto plano | Não |
| Interesse em ministério | Texto plano | Não |
| **CPF** | Criptografado (AES-256-GCM) | **Sim** |
| **RG** | Criptografado (AES-256-GCM) | **Sim** |

### Dados do Projeto de Vida (PdV)

Conteúdo do ciclo mensal: objetivos, diário, exame de consciência, revisão, intercessão. Esses dados estão isolados — as rotas admin não têm acesso a nenhuma rota de `/vida`. O isolamento é estrutural: não é controle de UX, é ausência de endpoint.

O Sentry captura erros das telas do PdV mas com `sendDefaultPii: false` — conteúdo do diário ou exame não é enviado.

### Dados de Auditoria (AuditLog)

Registros de ações sensíveis (acesso a perfis, exportações, exclusões, mudanças de papel, aceite de termos). Retidos por 5 anos por obrigação legal declarada na Política de Privacidade. Não contêm conteúdo do PdV.

### Dados de Consentimento (UserConsent)

Registro de aceite dos termos de uso com timestamp. Retido por 5 anos (mesma obrigação legal).

---

## Criptografia de Dados Sensíveis (CPF/RG)

Implementada em `backend/app/crypto/service.py`.

### Algoritmos

| Dado | Mecanismo | Propósito |
|------|-----------|-----------|
| CPF | HMAC-SHA256 (pepper) + AES-256-GCM | HMAC: deduplicação/comparação sem descriptografar; AES: recuperação |
| RG | AES-256-GCM | Recuperação |

### Chaves

| Variável | Descrição |
|----------|-----------|
| `ENCRYPTION_KEY` | Chave AES-256-GCM (base64, 32 bytes) |
| `HMAC_PEPPER` | Pepper para HMAC-SHA256 do CPF (base64, 32 bytes) |

Ambas são obrigatórias em produção — a ausência aborta a inicialização do serviço.

> **Rotação de chaves:** `ENCRYPTION_KEY` e `HMAC_PEPPER` não devem ser rotacionadas sem migração de dados — os documentos criptografados existentes ficariam inacessíveis. Não há pipeline de rotação implementado até o RC.

### Comportamento em DEV

Em `dev`, se as chaves não estiverem configuradas, o serviço gera chaves efêmeras automaticamente (dados não persistem entre reinícios). Em produção, a ausência das chaves é fatal — fail-closed.

---

## Acesso a Dados Sensíveis (CPF/RG)

O acesso a CPF e RG em texto claro requer fluxo de aprovação explícito:

```
1. Solicitante (SECRETARY ou DEV) cria SensitiveAccessRequest com justificativa
   POST /admin/sensitive-access/request

2. Aprovador diferente do solicitante (ADMIN ou DEV) aprova
   POST /admin/sensitive-access/{id}/approve
   — auto-aprovação é bloqueada no backend

3. Janela de acesso ativa por tempo limitado

4. Solicitante acessa CPF/RG descriptografado
   GET /admin/users/{id}/profile  ou  GET /admin/users/{id}/documents

5. Cada acesso é registrado em AuditLog com:
   - actor_user_id
   - IP e user-agent
   - entity_id (usuário acessado)
   - timestamp
```

**DEV tem bypass direto** (acessa CPF/RG sem aprovação). Este comportamento é intencional e documentado — DEV é o papel de operador técnico de mais alto nível.

**ADMIN e SECRETARY** recebem `cpf=null, rg=null` na resposta do perfil se não houver aprovação ativa.

---

## Anonimização de Conta (LGPD Art. 18, VI)

O Lumen+ não exclui fisicamente a linha `User` — usa **anonimização** para preservar a âncora de auditoria e os registros de consentimento. Esta é a estratégia declarada explicitamente no docstring do serviço. A justificativa para retenção das linhas `AuditLog` e `UserConsent` é operacional — não substitui decisão jurídica sobre o período adequado de retenção para cada categoria de dado.

```python
# backend/app/services/account_deletion.py
"""
Estratégia: anonimização (não exclusão da linha User) para preservar os
registros de auditoria e os consentimentos aceitos, conforme obrigação legal de
retenção de 5 anos declarada na Política de Privacidade.
"""
```

### O que anonymize_user faz

A função é chamada tanto na auto-exclusão (`DELETE /auth/me`) quanto na exclusão administrativa (`DELETE /admin/users/{id}`):

**Remove imediatamente:**
- `UserProfile` — CPF, RG e todos os dados biográficos
- `UserPreferences`
- `OrgMembership` (todos os vínculos de unidade)
- `UserGlobalRole` (todos os papéis globais)
- `UserIdentity.email` e `provider_uid` → substituídos por `deleted+{uuid.hex}@deleted.invalid`

**Retém (obrigação legal):**
- Linha `User` com `is_active=False` — âncora para logs de auditoria
- `UserConsent` — evidência de aceite dos termos (5 anos)
- `AuditLog` — rastreabilidade de segurança (5 anos)

**Registra a exclusão no AuditLog:**
```python
metadata = {"reason": reason, "lgpd_art": "18_VI"}
create_audit_log(
    action="account_deleted",
    entity_type="user",
    entity_id=str(user_id),
    metadata=metadata,
)
```

### Idempotência

A exclusão é **idempotente**: contas já inativas (`is_active=False`) retornam HTTP 204 sem reprocessar. Isso evita double-deletion e garante que uma segunda chamada não tente deletar dados já removidos.

### Quem pode excluir

| Ator | Pode excluir |
|------|-------------|
| DEV | Qualquer conta, exceto si mesmo e outras contas DEV |
| ADMIN | Contas sem papel DEV ou ADMIN |
| Próprio usuário | Via `DELETE /auth/me` (auto-exclusão) |

---

## Exportação de Dados com CPF/RG

Exportações de usuários em CSV que incluam CPF/RG passam por fluxo de aprovação antes de serem geradas. O mesmo princípio de separação de deveres se aplica (solicitante ≠ aprovador).

A tela de aprovações (`app/admin/approvals/index.tsx`) é acessível a DEV, ADMIN e COUNCIL_GENERAL.

---

## Dados do Projeto de Vida — Isolamento

O conteúdo do Projeto de Vida (diário, exame, intercessão, revisão) não é acessível pelo painel Admin. Este isolamento é **estrutural**:

- As rotas `/admin/*` não chamam nenhum endpoint de `/vida/*` ou `/projeto-vida*`
- Não existe endpoint administrativo de "ver PdV de outro usuário"
- O conteúdo do PdV não aparece em nenhum export de dados admin

O PIN de acesso ao PdV não tem recuperação self-service — o admin também não pode contornar o PIN. Se o membro esquecer o PIN, o conteúdo fica inacessível. Este ponto é comunicado ao usuário no wizard (`app/vida/wizard.tsx`, step 9): *"Se você perder essa senha, não será possível recuperar o conteúdo ou o acesso ao seu Projeto de Vida."*

> **Implicação LGPD:** a ausência de recuperação de PIN pode criar tensão com o direito de acesso a dados (art. 18, II) se o membro solicitar portabilidade e não conseguir acessar o próprio conteúdo. Decisão de produto a tratar em ciclo futuro.

---

## Consentimento

O Lumen+ registra o aceite dos termos de uso via `UserConsent`. O registro inclui:
- `user_id`
- Versão dos termos aceitos
- Timestamp de aceite

O aceite dos termos é registrado no `AuditLog` (ação de auditoria). A retenção de `UserConsent` por 5 anos após a exclusão da conta é declarada como obrigação legal no código.

---

## Monitoramento e PII

| Ferramenta | Configuração de PII |
|-----------|---------------------|
| Sentry (backend) | `sendDefaultPii: false` |
| Sentry (frontend) | `sendDefaultPii: false` |
| Vercel Analytics | Pageviews — sem dados de usuário individual |

Nenhuma dessas ferramentas recebe CPF, RG, conteúdo do PdV ou credenciais.

---

## Limitações Conhecidas até o RC

| Limitação | Descrição |
|-----------|-----------|
| Não há DPO formalmente designado | Não identificado no código ou documentação |
| Não há mecanismo de portabilidade automatizado | Não existe endpoint de export dos dados do próprio usuário em formato estruturado |
| PIN do PdV sem recuperação | Conteúdo inacessível em caso de PIN esquecido — tensão com art. 18, II |
| Rotação de chaves sem pipeline | `ENCRYPTION_KEY` / `HMAC_PEPPER` não têm processo documentado de rotação segura |
| Retenção sem enforcement técnico | Não existe job ou política automatizada que elimine `AuditLog` e `UserConsent` após o prazo de retenção previsto. A retenção é operacionalmente assumida. |
| Política de Privacidade não auditada | O texto legal da política não foi revisado neste ciclo |
| Analytics Missionais (POST-RC) | Qualquer coleta de dados de evento de uso (logins, leituras, engajamento) requer nova avaliação de necessidade e bases legais antes de implementar |

---

## Bases Legais Identificadas no Código

| Dado / Ação | Referência / Nota |
|-------------|------------------|
| Anonimização de conta | Código referencia `lgpd_art: "18_VI"` no metadata do AuditLog — indica a justificativa operacional. A adequação jurídica deve ser validada com assessoria legal. |
| Retenção de AuditLog e UserConsent | O docstring de `account_deletion.py` declara "obrigação legal de retenção de 5 anos". Não há job técnico de exclusão automática ao fim do prazo. A retenção é operacionalmente assumida, não tecnicamente enforced. A definição formal do prazo e do processo de eliminação ao final deve ser tratada em política própria validada juridicamente. |
| CPF/RG (documentos de identificação) | Coletados para fins de identificação dos membros da comunidade. A base legal e a necessidade de coleta devem ser documentadas no ROPA (Registro de Operações de Tratamento) da organização. |
| Controle de acesso sensível com aprovação | Implementação de separação de deveres alinhada ao princípio de segurança e prevenção (LGPD art. 46). Não constitui certificação de conformidade. |

---

## Próxima leitura

- **Criptografia e acesso sensível:** `05-autenticacao-permissoes.md`
- **Exclusão e anonimização (Admin):** `06-admin.md`
- **Projeto de Vida (isolamento de dados):** `07-projeto-de-vida.md`
- **Segurança e hardening:** `11-seguranca-hardening.md`
