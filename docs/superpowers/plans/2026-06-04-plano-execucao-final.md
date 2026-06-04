# Plano de Execução Final — Canal + Notificações

> **Documento operacional.** Cobre as duas features em sequência segura de deploy.
> Planos detalhados de implementação:
> - `2026-06-04-canal-grupos-ministerio.md`
> - `2026-06-04-notificacoes-push-email.md`
> - `2026-06-04-revisao-arquitetural.md` (decisões e contexto)

---

## 1. Variáveis de Ambiente Novas

Adicionar **antes** do deploy de produção. O backend valida essas variáveis no startup — valores ausentes degradam graciosamente (push/email desabilitados), não derrubam o servidor.

### Railway — serviço `backend`

| Variável | Valor | Obrigatório |
|---|---|---|
| `VAPID_PRIVATE_KEY` | gerada localmente (ver Task 1 do plano de notificações) | Sim (push) |
| `VAPID_PUBLIC_KEY` | gerada localmente | Sim (push) |
| `VAPID_EMAIL` | `mailto:oeliasandraade@gmail.com` | Sim (push) |
| `SENDGRID_API_KEY` | obtido no painel SendGrid | Sim (email) |
| `SENDGRID_FROM_EMAIL` | `noreply@lumenmobile.vercel.app` | Sim (email) |
| `SENDGRID_FROM_NAME` | `Lumen+` | Sim (email) |

**Gerar as chaves VAPID localmente antes do deploy:**
```bash
cd backend && pip install pywebpush
python -c "
from py_vapid import Vapid
v = Vapid()
v.generate_keys()
print('VAPID_PRIVATE_KEY=' + v.private_key_to_str())
print('VAPID_PUBLIC_KEY=' + v.public_key_str())
"
```

Salvar `VAPID_PRIVATE_KEY` em local seguro (ex: 1Password) — nunca commitar no repositório.

---

## 2. Ordem Exata das Migrations

```
036_channel_posts         → canal (channel_posts, channel_replies, org_units.channel_post_mode)
037_inbox_category_deeplink → inbox_messages (category, deep_link, action_label, priority)
038_push_notifications    → push_subscriptions + notification_delivery_log
```

**Regra:** cada migration só pode ser executada após a anterior ter sido aplicada com sucesso e validada. As três são aditivas (ADD COLUMN / CREATE TABLE) — sem DROP de coluna existente, sem renomear, sem alterar tipo. Risco de breaking change: **zero** para dados existentes.

---

## 3. Ordem Exata dos Commits

A sequência abaixo garante que cada commit deixa o sistema em estado deployável e testável.

### Fase 1 — Infraestrutura Backend (sem impacto no frontend)

```
[1]  feat(config): VAPID e SendGrid settings em app/settings.py
[2]  feat(canal): migration 036 — channel_posts, channel_replies, channel_post_mode
[3]  feat(canal): modelos ChannelPost, ChannelReply, enum ChannelPostMode em models.py
[4]  feat(canal): schemas Pydantic channel.py
[5]  feat(canal): endpoints canal — list/get/create/edit/delete/pin/highlight + audit
[6]  feat(canal): registra channel_router em main.py
[7]  feat(canal): channel_post_mode no schema e endpoint de update de OrgUnit (admin)
[8]  feat(notif): migration 037 — category, deep_link, action_label, priority em inbox_messages
[9]  feat(notif): modelos InboxMessage (4 campos), PushSubscription, NotificationDeliveryLog
[10] feat(notif): migration 038 — push_subscriptions + notification_delivery_log
[11] feat(notif): push_service — Web Push via pywebpush
[12] feat(notif): email_service — SendGrid, template com resumo 200 chars + cta_text
[13] feat(notif): notification_service — priority routing + delivery log + NotificationType expandido
[14] feat(notif): scheduler — APScheduler + pg_try_advisory_lock
[15] feat(notif): push_routes — vapid-public-key, subscribe, unsubscribe
[16] feat(notif): registra push_router + start/stop scheduler em main.py
[17] feat(notif): InboxService.send_message — novos params (category, deep_link, action_label, priority)
[18] feat(notif): inbox_routes — BackgroundTasks + novos campos + guard CRITICAL
[19] feat(notif): InboxSendRequest schema — category, deep_link, action_label, priority
```

**Ponto de deploy backend (Railway):** após commit [19], com migrations rodando automaticamente via `start.sh → alembic upgrade head`.

### Fase 2 — Frontend

```
[20] feat(canal): API client channel.ts
[21] feat(canal): tela channel/_layout.tsx + channel/[unitId].tsx
[22] feat(canal): registra Stack.Screen channel em _layout.tsx + botão Canal em members.tsx
[23] feat(canal): seletor channel_post_mode em admin/entities/index.tsx
[24] feat(notif): Service Worker public/sw.js
[25] feat(notif): push service src/services/push.ts
[26] feat(notif): PushPermissionCard + integração em home.tsx
[27] feat(notif): seletores category, priority, deep_link, action_label em admin/create-aviso.tsx
```

**Ponto de deploy frontend (Vercel):** após commit [27].

---

## 4. Pontos de Rollback

### Rollback de Migration

Cada migration tem `downgrade()` implementado. Para reverter:

```bash
# Reverter 038 (push tables)
cd backend && alembic downgrade 037

# Reverter 037 (inbox fields)
cd backend && alembic downgrade 036

# Reverter 036 (canal)
cd backend && alembic downgrade 035
```

`downgrade` da 036 faz DROP das tabelas `channel_posts` e `channel_replies` e remove `channel_post_mode` de `org_units`. **Perda de dados** se já houver posts criados — só executar em desenvolvimento.

### Rollback de Backend (Railway)

Railway mantém o último deploy ativo. Para reverter:
```
Railway painel → serviço backend → Deployments → selecionar deploy anterior → Redeploy
```

Após o redeploy, rodar manualmente a migration downgrade se necessário.

### Rollback de Frontend (Vercel)

```
Vercel painel → projeto → Deployments → selecionar deploy anterior → Promote to Production
```

O frontend é independente do banco — pode ser revertido sem afetar os dados.

### Rollback Seguro Sem Perda de Dados

Os commits [1]–[7] (canal backend) são completamente independentes. Se algo der errado no canal, o sistema de notificações não é afetado. Mesma independência entre [8]–[19] (notificações) e o canal.

---

## 5. Validações Após Cada Migration

### Após migration 036

```sql
-- Verificar estrutura
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'channel_posts';

-- Verificar campo em org_units
SELECT column_name, column_default
FROM information_schema.columns
WHERE table_name = 'org_units' AND column_name = 'channel_post_mode';

-- Verificar que org_units existentes têm o valor default
SELECT COUNT(*) FROM org_units WHERE channel_post_mode IS NULL;
-- Expected: 0
```

```bash
# Verificar importação Python
cd backend && python -c "from app.db.models import ChannelPost, ChannelReply, ChannelPostMode; print('OK')"
```

### Após migration 037

```sql
SELECT column_name, data_type, column_default, is_nullable
FROM information_schema.columns
WHERE table_name = 'inbox_messages'
  AND column_name IN ('category', 'deep_link', 'action_label', 'priority')
ORDER BY column_name;
-- Expected: 4 linhas; priority com column_default='NORMAL', is_nullable='NO'

-- Mensagens existentes não devem ter NULL em priority
SELECT COUNT(*) FROM inbox_messages WHERE priority IS NULL;
-- Expected: 0
```

### Após migration 038

```sql
SELECT table_name FROM information_schema.tables
WHERE table_name IN ('push_subscriptions', 'notification_delivery_log');
-- Expected: 2 linhas

-- Verificar constraints
SELECT constraint_name, constraint_type
FROM information_schema.table_constraints
WHERE table_name = 'push_subscriptions';
-- Expected: uq_push_subscriptions_endpoint (UNIQUE) entre os resultados
```

```bash
cd backend && python -c "
from app.db.models import PushSubscription, NotificationDeliveryLog
print('PushSubscription:', PushSubscription.__tablename__)
print('NotifLog:', NotificationDeliveryLog.__tablename__)
print('OK')
"
```

---

## 6. Testes Manuais Essenciais

### 6.1 Canal de Grupos

**Pré-requisito:** ter uma OrgUnit com pelo menos 2 membros ACTIVE — um COORDINATOR e um MEMBER.

| # | Ação | Expected |
|---|---|---|
| C1 | GET `/channel/{unitId}/settings` como COORDINATOR | `can_post: true`, `can_moderate: true` |
| C2 | GET `/channel/{unitId}/settings` como MEMBER (modo COORDINATOR_ONLY) | `can_post: false`, `can_moderate: false` |
| C3 | POST `/channel/{unitId}/posts` como MEMBER (modo COORDINATOR_ONLY) | 403 `forbidden` |
| C4 | POST `/channel/{unitId}/posts` como COORDINATOR | 201, post criado |
| C5 | Verificar AuditLog após C4 | `action = "channel_post_created"` na tabela `audit_log` |
| C6 | GET `/channel/{unitId}/posts` | Lista com 1 post, `reply_count: 0`, `author_name` preenchido |
| C7 | POST reply ao post criado em C4 | 201, reply criado |
| C8 | DELETE post como MEMBER | 403 |
| C9 | DELETE post como COORDINATOR com `reason` de 3+ chars | 200, `deleted_at` preenchido |
| C10 | GET `/channel/{unitId}/posts` após C9 | Post não aparece mais (filtro `deleted_at IS NULL`) |
| C11 | Verificar AuditLog após C9 | `action = "channel_post_deleted"` |
| C12 | Trocar `channel_post_mode` para `ALL_MEMBERS` via admin, GET settings | `can_post: true` para MEMBER |
| C13 | GET settings como não-membro | 403 |
| C14 | PATCH pin como COORDINATOR | `is_pinned: true`, post aparece antes dos não-fixados |
| C15 | PATCH highlight como DEV/ADMIN | `is_institutional_highlight: true`, post aparece antes dos pinados |
| C16 | PATCH highlight como COORDINATOR (não admin) | 403 |

### 6.2 Notificações Push

**Pré-requisito:** VAPID configurado, browser com suporte a Web Push (Chrome/Edge), app rodando em HTTPS ou localhost.

| # | Ação | Expected |
|---|---|---|
| N1 | GET `/push/vapid-public-key` | 200 com `public_key` base64url |
| N2 | Abrir app web → card de permissão aparece na home | Card visível; não solicitou permissão automaticamente |
| N3 | Clicar "Agora não" | Card desaparece; AsyncStorage tem `lumen_push_decision = later` |
| N4 | Recarregar app | Card não reaparece (decisão persistida) |
| N5 | Limpar AsyncStorage, clicar "Permitir" | Browser solicita permissão; aceitar |
| N6 | Após aceitar | `SELECT * FROM push_subscriptions WHERE user_id = '<id>';` → 1 linha |
| N7 | Aceitar e recarregar | Não registra subscription duplicada |
| N8 | GET `/push/vapid-public-key` sem VAPID_PUBLIC_KEY configurado | 503 com mensagem clara |

### 6.3 Notificações Inbox

| # | Ação | Expected |
|---|---|---|
| I1 | Publicar aviso `priority=LOW` como ADMIN | Somente Inbox; sem push, sem e-mail; `notification_delivery_log` sem entradas para este aviso |
| I2 | Publicar aviso `priority=NORMAL` para usuário com push subscription | Push enviado; e-mail NÃO enviado (fallback não necessário) |
| I3 | Publicar aviso `priority=NORMAL` para usuário SEM subscription | E-mail enviado |
| I4 | Publicar aviso `priority=HIGH` para usuário com subscription | Push E e-mail enviados |
| I5 | Publicar aviso `priority=CRITICAL` sem `critical_reason` como ADMIN | 422 validação: `critical_reason` obrigatório |
| I5b | Publicar aviso `priority=CRITICAL` com `critical_reason` de 5 chars como ADMIN | 422 validação: `min_length=10` |
| I5c | Publicar aviso `priority=CRITICAL` como SECRETARY (com `critical_reason` válido) | 403 `critical_requires_admin` |
| I6 | Publicar aviso `priority=CRITICAL` como ADMIN com `critical_reason` válido | Push e e-mail enviados; `push_opt_in=false` não bloqueia; `audit_log` tem `action=inbox_critical_sent` com `critical_reason` |
| I7 | Verificar `notification_delivery_log` após I2–I6 | 1 linha por entrega, `status=SENT` ou `FAILED` conforme resultado |
| I8 | Publicar aviso com `deep_link=/vida` e `action_label=Acessar Projeto` | E-mail tem botão com texto "Acessar Projeto" e link correto |
| I9 | Publicar aviso com `deep_link` mas sem `action_label` | E-mail tem botão "Ver mais" |
| I10 | Resposta HTTP ao publicar aviso com 200 destinatários | Resposta em < 500ms (BackgroundTask, não bloqueia) |

### 6.4 E-mail

| # | Verificação | Expected |
|---|---|---|
| E1 | Conteúdo do e-mail de aviso | Título + máx. 200 chars de resumo + "..." se truncado + CTA |
| E2 | Conteúdo do e-mail NÃO inclui o texto completo do aviso | Mensagem com 500 chars → e-mail mostra 200 + "..." |
| E3 | Link no e-mail aponta para app | `https://lumenmobile.vercel.app` + deep_link quando presente |

---

## 7. Riscos de Breaking Change no Frontend

### 7.1 Campos novos em InboxMessage — **sem risco**

`category`, `deep_link`, `action_label`, `priority` são nullable (exceto `priority` com default). O frontend existente que não conhece esses campos simplesmente os ignora. O campo `priority` com `server_default='NORMAL'` garante que avisos criados antes da migration continuam funcionando sem alteração.

### 7.2 `channel_post_mode` em OrgUnit — **sem risco**

`server_default='COORDINATOR_ONLY'` — todas as unidades existentes recebem o valor mais restritivo automaticamente. Nenhuma tela existente referencia esse campo antes do commit [23].

### 7.3 Endpoint de Update de OrgUnit — **sem risco**

O campo `channel_post_mode` é adicionado como **opcional** no schema de update (`str | None = None`). Chamadas sem esse campo continuam funcionando sem alteração.

### 7.4 Push subscription — **sem risco**

O Service Worker e a solicitação de permissão são **aditivos**. O card só aparece em browsers com suporte a Web Push. Em browsers sem suporte, `'serviceWorker' in navigator` é false e o card não é exibido.

### 7.5 Tela `create-aviso.tsx` — **risco baixo, controlado**

Os campos `category`, `priority`, `deep_link` e `action_label` são adicionados como opcionais na UI. Se o frontend for deployado ANTES do commit [19] do backend, esses campos serão silenciosamente ignorados pela API atual. **Sequência recomendada: deploy backend primeiro, frontend depois.**

### 7.6 Scheduler APScheduler — **risco de startup**

Se `apscheduler` não estiver em `requirements.txt` antes do deploy, o import falhará e o backend não iniciará. **Verificar que a dependência está no arquivo antes do commit [14].**

---

## 8. Checklist de Deploy Railway (Backend)

Execute na ordem:

- [ ] **Variáveis de ambiente** adicionadas no painel Railway (seção 1 deste documento)
- [ ] `pywebpush>=2.0.0` adicionado ao `requirements.txt` ou `pyproject.toml`
- [ ] `sendgrid>=6.11.0` adicionado
- [ ] `apscheduler>=3.10.0` adicionado
- [ ] Verificar que `start.sh` executa `alembic upgrade head` antes do uvicorn (já está configurado)
- [ ] Push do branch para o repositório — Railway faz deploy automático
- [ ] Aguardar logs de startup no painel Railway:
  - `Running upgrade 035 -> 036` ✓
  - `Running upgrade 036 -> 037` ✓
  - `Running upgrade 037 -> 038` ✓
  - `notification_scheduler_started` ✓
  - `application_startup` com `environment=production` ✓
- [ ] Testar health check: `GET https://backend-production-6efc.up.railway.app/health`
- [ ] Testar `/push/vapid-public-key` → 200
- [ ] Testar `/channel/{qualquer-org-unit-id}/settings` → 200 ou 403 esperado

---

## 9. Checklist de Deploy Vercel (Frontend)

- [ ] Commits [20]–[27] no branch main
- [ ] Verificar que `lumen_mobile/public/sw.js` existe e será servido pelo build web
  - Rodar `npx expo export --platform web` localmente e confirmar `sw.js` no output `dist/`
- [ ] Push para main → Vercel inicia deploy automaticamente
- [ ] Aguardar deploy concluir no painel Vercel
- [ ] Abrir `https://lumenmobile.vercel.app` em Chrome
- [ ] Verificar que o card de permissão push aparece na home após login
- [ ] Verificar que o botão "Canal" aparece na tela de membros de uma OrgUnit
- [ ] Verificar que a tela de criação de aviso tem os novos campos

---

## 10. O que Testar Antes de Liberar para Usuários

Execute este checklist completo em produção antes de comunicar a feature:

### Backend — Smoke Tests

```bash
# Health
curl https://backend-production-6efc.up.railway.app/health

# VAPID public key — rota pública, sem Authorization
curl https://backend-production-6efc.up.railway.app/push/vapid-public-key

# Canal settings (substituir UUID real)
curl -H "Authorization: Bearer dev:..." \
  https://backend-production-6efc.up.railway.app/channel/{unitId}/settings
```

### Banco de Dados — Verificações Pós-Migration

```sql
-- Migrations aplicadas
SELECT version_num FROM alembic_version;
-- Expected: 038

-- Tabelas existem
SELECT COUNT(*) FROM channel_posts;    -- Expected: 0 (ou N se já criaram)
SELECT COUNT(*) FROM push_subscriptions;
SELECT COUNT(*) FROM notification_delivery_log;

-- Campos em inbox_messages
SELECT priority, COUNT(*) FROM inbox_messages GROUP BY priority;
-- Expected: todos os avisos existentes com priority='NORMAL'

-- Scheduler: advisory lock liberado (não deve estar preso)
SELECT pid, classid, objid, mode, granted
FROM pg_locks
WHERE locktype = 'advisory' AND objid = 1872634901;
-- Expected: 0 linhas (lock não está ativo fora do job)
```

### Fluxo End-to-End Crítico

1. **Canal:** Criar post como coordenador → membro da unidade consegue ver → membro de outra unidade recebe 403
2. **Notificação LOW:** Criar aviso `priority=LOW` → verificar `notification_delivery_log` tem registro de `channel=EMAIL`
3. **Notificação CRITICAL block:** Tentar criar aviso `priority=CRITICAL` como SECRETARY → receber 403
4. **Notificação CRITICAL:** Criar aviso `priority=CRITICAL` como ADMIN → verificar que chegou para membros com `push_opt_in=false`
5. **Push registration:** Aceitar push no browser → `push_subscriptions` tem 1 linha → criar aviso NORMAL → notificação aparece no browser

---

## 11. Autorização para Priority CRITICAL

### Decisão

**Apenas roles DEV e ADMIN podem enviar avisos com `priority=CRITICAL`.**

Justificativa: CRITICAL bypassa o `push_opt_in` do usuário — é uma exceção ao consentimento. Deve ser reservado para comunicados de máxima importância institucional (emergências, mudanças de evento de última hora, comunicados de óbito). Coordenadores de ministério, SECRETARY e AVISOS **não** têm esse poder.

### Onde Implementar (commit [18] — inbox_routes.py)

No endpoint `send_message`, **após** `_check_send_permission` e **antes** de processar os destinatários:

```python
# Guard de prioridade CRITICAL — somente DEV e ADMIN
if getattr(request, 'priority', 'NORMAL') == 'CRITICAL':
    global_roles = get_user_global_roles(db, current_user.id)
    if not any(r in global_roles for r in ["DEV", "ADMIN"]):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={
                "error": "critical_requires_admin",
                "message": "Apenas administradores podem enviar avisos com prioridade Urgente",
            },
        )
    # critical_reason obrigatório para CRITICAL (validação de negócio além do schema)
    critical_reason = getattr(request, 'critical_reason', None)
    if not critical_reason or len(critical_reason.strip()) < 10:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={
                "error": "critical_reason_required",
                "message": "Avisos urgentes exigem uma justificativa com pelo menos 10 caracteres",
            },
        )
```

> **Nota:** a validação `min_length=10` também deve estar no schema Pydantic `InboxSendRequest` como validator condicional, para que a documentação OpenAPI a reflita:
>
> ```python
> from pydantic import model_validator
>
> @model_validator(mode='after')
> def validate_critical_reason(self) -> 'InboxSendRequest':
>     if self.priority == 'CRITICAL':
>         if not self.critical_reason or len(self.critical_reason.strip()) < 10:
>             raise ValueError('critical_reason obrigatório (min 10 chars) quando priority=CRITICAL')
>     return self
> ```

`get_user_global_roles` já existe em `backend/app/services/organization.py` e é importado em `inbox_routes.py` — nenhuma importação nova necessária.

### Tabela de Autorização por Prioridade

| Role | LOW | NORMAL | HIGH | CRITICAL |
|---|---|---|---|---|
| DEV | ✓ | ✓ | ✓ | ✓ |
| ADMIN | ✓ | ✓ | ✓ | ✓ |
| AVISOS | ✓ | ✓ | ✓ | ✗ |
| SECRETARY | ✓ | ✓ | ✓ | ✗ |
| Coordenador (CAN_SEND_INBOX) | ✓ | ✓ | ✓ | ✗ |

HIGH está liberado para todos que podem enviar avisos porque não bypassa consentimento — apenas garante entrega dupla (push + email).

### Registrar no AuditLog

Toda mensagem CRITICAL deve ser registrada explicitamente no AuditLog para rastreabilidade institucional (adicionar após o `db.commit()` em `InboxService.send_message` quando `priority == 'CRITICAL'`):

```python
if priority == "CRITICAL":
    from app.audit.service import create_audit_log
    create_audit_log(
        self.db,
        actor_user_id=created_by_user_id,
        action="inbox_critical_sent",
        entity_type="inbox_message",
        entity_id=str(inbox_message.id),
        extra_data={
            "title": title,
            "recipient_count": len(user_ids),
            "critical_reason": critical_reason,  # passado como parâmetro de send_message
        },
    )
```

`critical_reason` deve ser adicionado como parâmetro de `InboxService.send_message` (commit [17]), repassado pela rota e armazenado no `extra_data` do AuditLog — não é persistido como coluna própria em `inbox_messages` (não é necessário; o AuditLog é suficiente para LGPD).

---

## 12. Atualização de InboxService.send_message (commit [17])

O `InboxService.send_message` em `backend/app/services/inbox_service.py` recebe os novos campos e os persiste no `InboxMessage`. A assinatura atual está em `inbox_service.py:506`. Adicionar os parâmetros:

```python
def send_message(
    self,
    title: str,
    message: str,
    message_type: str,
    created_by_user_id: UUID,
    send_to_all: bool,
    filters: InboxFilters | None = None,
    attachments: list[dict[str, Any]] | None = None,
    scope_org_unit_id: UUID | None = None,
    requires_approval: bool = False,
    # Novos campos
    category: str | None = None,
    deep_link: str | None = None,
    action_label: str | None = None,
    priority: str = "NORMAL",
    critical_reason: str | None = None,  # obrigatório quando priority=CRITICAL; vai para AuditLog
) -> tuple[UUID, int]:
```

E no objeto `InboxMessage(...)` (linha ~545), adicionar:

```python
inbox_message = InboxMessage(
    title=title,
    message=message,
    type=msg_type,
    created_by_user_id=created_by_user_id,
    expires_at=datetime.now(timezone.utc) + timedelta(days=INBOX_EXPIRATION_DAYS),
    attachments=attachments,
    filters=filters.model_dump() if filters else None,
    target_org_unit_id=scope_org_unit_id,
    approval_status=approval_status,
    # Novos campos
    category=category,
    deep_link=deep_link,
    action_label=action_label,
    priority=priority,
)
```

Em `inbox_routes.py`, a chamada a `service.send_message(...)` deve passar os novos campos vindos de `request`:

```python
message_id, recipient_count = service.send_message(
    title=request.title,
    message=request.message,
    message_type=request.type,
    created_by_user_id=current_user.id,
    send_to_all=request.send_to_all,
    filters=request.filters,
    attachments=attachments,
    scope_org_unit_id=request.scope_org_unit_id,
    requires_approval=not _has_full_send_access(db, current_user.id),
    # Novos campos
    category=getattr(request, 'category', None),
    deep_link=getattr(request, 'deep_link', None),
    action_label=getattr(request, 'action_label', None),
    priority=getattr(request, 'priority', 'NORMAL'),
    critical_reason=getattr(request, 'critical_reason', None),
)
```

O `getattr` com fallback garante que o endpoint não quebra se o schema não tiver sido atualizado ainda em ambiente de teste. Em produção o schema estará sempre atualizado.

---

## 13. Sequência de Deploy Recomendada

```
1. Merge branch de desenvolvimento → main
2. Adicionar variáveis de ambiente no Railway (seção 1)
3. Railway faz deploy automático do backend
4. Aguardar logs: 036→037→038 + scheduler_started
5. Executar validações SQL (seção 5)
6. Executar smoke tests (seção 10)
7. Vercel faz deploy automático do frontend
8. Verificar sw.js acessível: https://lumenmobile.vercel.app/sw.js
9. Fluxo end-to-end completo (seção 10)
10. Comunicar availability para coordenadores e admins antes de liberar para todos os membros
```

**Janela de manutenção:** as três migrations são aditivas e não bloqueiam tabelas existentes por mais de milissegundos — não é necessária janela de manutenção formal. O Railway faz zero-downtime deploy com dois processos rodando em paralelo durante a transição; o `alembic upgrade head` roda no novo processo antes de receber tráfego.
