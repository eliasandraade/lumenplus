# Revisão Arquitetural — Canal de Ministérios + Sistema de Notificações

> **Documento de decisão arquitetural.** Não é um plano de implementação.
> Os planos revisados estão em `2026-06-04-canal-grupos-ministerio.md` e `2026-06-04-notificacoes-push-email.md`.

---

## 1. Crítica do Plano Original — Canal de Grupos

### 1.1 Bug de N+1 Queries (alto impacto)

`_get_author_name` abre uma query por post e por reply. `_to_post_response` abre mais uma query COUNT por post. Para uma lista de 30 posts com 5 replies cada, o endpoint `list_posts` dispara **61 queries** (1 para posts + 30 COUNT + 30 para nomes dos autores). Com crescimento da comunidade, isso colapsará o pool de conexões de 35.

**Solução:** JOIN com `UserProfile` + subquery agregada de contagem — sempre 3 queries, independente do volume.

### 1.2 Sem Moderação (bloqueador institucional)

Sem `deleted_at` / `deleted_by_user_id` / `delete_reason`, conteúdo inadequado só pode ser removido com acesso direto ao banco. Inviabiliza o canal como ferramenta oficial.

### 1.3 Sem Auditoria

O projeto já tem `AuditLog` — não usá-lo no canal cria um buraco de rastreabilidade. A Obra precisa saber quem postou, editou e removeu conteúdo.

### 1.4 `channel_post_mode` como String Livre

`"COORDINATOR_ONLY"` e `"ALL_MEMBERS"` como strings abertas no banco e na validação. Qualquer typo ou valor inesperado passa silenciosamente. Padrão do projeto é Python `enum.Enum` (ver `OrgRoleCode`, `MembershipStatus`, etc.).

### 1.5 Soft Delete Ausente no Canal, Mas Presente no Inbox

O `InboxMessage` já tem `is_deleted / deleted_at / deleted_by_user_id` como padrão. O canal deve seguir o mesmo padrão de consistência.

### 1.6 Lógica `canPost` Incorreta no Frontend

```typescript
// Plano atual — sempre mostra o FAB para qualquer modo
const canPost =
  settings?.channel_post_mode === 'ALL_MEMBERS' ||
  settings?.channel_post_mode === 'COORDINATOR_ONLY'; // isso é sempre true
```

UX ruim: o membro digita e envia, recebe um 403. O correto é retornar `can_post: bool` resolvido para o usuário atual direto na resposta de settings.

### 1.7 Sem Campo `is_institutional_highlight`

`is_pinned` resolve fixação local. O destaque institucional (ex: mensagem da Coordenação Geral que fica acima de tudo) é uma necessidade diferente com semântica própria.

### 1.8 Sem Preparação para Mídia

Post sem campo `media_metadata` (JSON nullable). Quando chegar a hora de anexar PDFs ou imagens, uma migration vai quebrar conteúdo existente se não houver campo preparado.

---

## 2. Crítica do Plano Original — Sistema de Notificações

### 2.1 APScheduler Multi-Instância (falha crítica em produção)

APScheduler em memória (AsyncIOScheduler) dispara em CADA instância do processo. Se Railway escalar para 2+ instâncias (o que acontece automaticamente sob carga), todos os membros com ciclo ativo receberão o lembrete **N vezes**, onde N é o número de réplicas.

**Solução adotada:** `pg_try_advisory_lock` do PostgreSQL — já disponível, zero dependências novas, garante exclusão mútua entre instâncias.

### 2.2 Permissão Push Solicitada Automaticamente na Home

`registerPushSubscription()` chamado no `useEffect` de montagem dispara o diálogo do browser imediatamente após o login. Browsers modernos categorizam isso como spam — Chrome pode silenciar o site permanentemente. Taxa de aceitação para permissões automáticas: ~5-10%. Para cards contextuais: ~60-70%.

**Solução:** Card amigável na home com ação explícita do usuário. Persistir decisão no AsyncStorage para não exibir novamente.

### 2.3 Email Envia o Corpo Completo do Aviso

O template `build_inbox_email` injeta `aviso_body` completo no HTML. Para comunicados da Obra com conteúdo estratégico ou pastoral sensível, isso vaza conteúdo fora da plataforma. O e-mail deve ser um "gatilho para entrar no app", não o conteúdo em si.

### 2.4 Notificação Bloqueia a Resposta HTTP

```python
# Plano atual — síncrono dentro do endpoint
try:
    notify_new_inbox(db, user_ids=recipient_user_ids, ...)
except Exception:
    ...
```

Para 500 destinatários, cada um com tentativa de Web Push + fallback por e-mail, isso pode levar 30-60 segundos. O usuário que enviou o aviso fica travado aguardando. **Deve ser BackgroundTask.**

### 2.5 Inbox Já Tem Leitura e Tipo — Plano Não Aproveitou

`InboxRecipient.read` / `read_at` já registra confirmação de leitura. `InboxMessage.type` já existe com valores INFO/WARNING/SUCCESS/URGENT. O plano tratou ambos como ausentes e propôs recriá-los.

**O que realmente falta:** campo `category` semântico (EVENT, RETREAT, FORMATION, SURVEY) e `deep_link` para navegação direta.

### 2.6 Sem Log de Entrega de Notificação (risco LGPD)

Sem registro de *o que foi enviado*, *para quem*, *por qual canal* e *quando*, a Obra não pode responder à pergunta "Você enviou e-mail para o membro X?" — relevante para Art. 18 da LGPD.

### 2.7 Arquitetura de Notificações do Projeto de Vida Não Projetada

Apenas o lembrete de revisão mensal foi modelado. Não há `NotificationType` enum nem extensão para eventos futuros do ciclo de vida.

---

## 3. Riscos Técnicos

| Risco | Severidade | Plano original | Solução adotada |
|---|---|---|---|
| N+1 no canal | Alta | Queries por item | JOIN + subquery |
| APScheduler multi-instância | Crítica | Não tratado | `pg_try_advisory_lock` |
| Push auto na home rejeitado | Alta | useEffect na montagem | Card com ação explícita |
| Notificação síncrona bloqueia HTTP | Alta | Síncrono | FastAPI `BackgroundTasks` |
| Sem soft delete no canal | Alta | Hard delete implícito | `deleted_at` + padrão inbox |
| String enum sem validação | Média | Strings livres | `ChannelPostMode` enum Python |
| `canPost` UX incorreto | Média | Frontend só descobre no 403 | `can_post` no settings endpoint |
| Sem delivery log (LGPD) | Alta | Não existia | Tabela `notification_delivery_log` |

---

## 4. Riscos Pastorais e Operacionais

| Risco | Descrição |
|---|---|
| Conteúdo inadequado no canal | Sem moderação, um post inapropriado fica visível para todos os membros da unidade até intervenção manual no banco |
| Flood de notificações | Múltiplas instâncias + bug no scheduler = membros recebem o mesmo lembrete repetido, erosão de confiança |
| Coordenador sem controle editorial | Sem edição de post, um erro de digitação em comunicado oficial não pode ser corrigido pelo próprio coordenador |
| Destaque institucional confundido com pin comum | Sem campo separado, a Mensagem da Coordenação Geral compete no mesmo nível de prioridade visual que qualquer post fixado |
| E-mail com conteúdo completo | Aviso pastoral confidencial enviado por e-mail fica indexável em clientes de e-mail, fora do controle da Obra |
| Membro não sabe que canal existe | Sem deep link "Canal" na notificação de novo post, a funcionalidade não gera engajamento |

---

## 5. Decisões Arquiteturais Tomadas

### Canal

| Decisão | Justificativa |
|---|---|
| `ChannelPostMode` como Python enum | Consistência com `OrgRoleCode`, `MembershipStatus`, etc. |
| Soft delete com `deleted_at` + `deleted_by_user_id` + `delete_reason` | Consistência com `InboxMessage`, auditabilidade |
| `is_institutional_highlight` campo separado de `is_pinned` | Semânticas distintas: pin é local do coordenador; highlight é designação institucional pelo admin |
| `media_metadata` JSON nullable | Permite futura expansão para PDFs/imagens sem migration disruptiva |
| `can_post` / `can_moderate` no settings endpoint | Frontend não precisa conhecer lógica de roles; resolve no backend |
| JOIN + subquery para list_posts | Elimina N+1; o custo é fixo independente do volume |
| AuditLog para todas as operações do canal | Reutiliza infraestrutura existente; rastreabilidade completa |
| `edited_at` em posts e replies | Transparência para membros: "esta mensagem foi editada" |

### Notificações

| Decisão | Justificativa |
|---|---|
| `pg_try_advisory_lock` para scheduler | Usa PostgreSQL já existente; zero dependências novas; atomicamente seguro |
| FastAPI `BackgroundTasks` para dispatch | Resposta HTTP imediata; notificações enviadas em background |
| E-mail = título + resumo (200 chars) + CTA | Conteúdo sensível permanece na plataforma |
| Card de permissão push (não auto-request) | UX comprovada; evita bloqueio permanente pelo browser |
| Campo `category` em vez de estender `type` | `type` é urgência visual; `category` é semântica de conteúdo — responsabilidades distintas |
| Campo `deep_link` em `InboxMessage` | Toda notificação pode ter destino explícito no app |
| Tabela `notification_delivery_log` | Auditoria LGPD; diagnóstico de entrega; futura dashboard de campanhas |
| `NotificationType` enum centralizado | Extensível para todos os gatilhos futuros (ciclo de vida do Projeto de Vida) |
| InboxRecipient já tem read/read_at — reutilizar | Evita duplicação; o modelo de confirmação de leitura já existe |

---

## 6. Tabelas de Impacto

### 6.1 Banco de Dados

| Tabela | Operação | Campos novos |
|---|---|---|
| `org_units` | ALTER | `channel_post_mode` (Text, server_default COORDINATOR_ONLY) |
| `channel_posts` | CREATE | id, org_unit_id, author_user_id, title, body, is_pinned, is_institutional_highlight, media_metadata, edited_at, deleted_at, deleted_by_user_id, delete_reason, created_at, updated_at |
| `channel_replies` | CREATE | id, post_id, author_user_id, body, edited_at, deleted_at, deleted_by_user_id, delete_reason, created_at |
| `inbox_messages` | ALTER | `category` (Text nullable), `deep_link` (Text nullable), `action_label` (Text nullable), `priority` (Text NOT NULL default NORMAL) |
| `push_subscriptions` | CREATE | id, user_id, endpoint, p256dh, auth, user_agent, created_at |
| `notification_delivery_log` | CREATE | id, user_id, notification_type, channel, status, inbox_message_id, deep_link, sent_at, error_detail |

Migrations necessárias:
- `036_channel_posts.py` — canal completo + campo em org_units
- `037_inbox_category_deeplink.py` — campos na InboxMessage
- `038_push_subscriptions.py` — push_subscriptions + notification_delivery_log

### 6.2 Backend

| Arquivo | Tipo | O que muda |
|---|---|---|
| `app/db/models.py` | Modify | ChannelPost, ChannelReply, OrgUnit.channel_post_mode, InboxMessage.category + deep_link, PushSubscription, NotificationDeliveryLog |
| `app/api/channel_routes.py` | Create | CRUD + edit + soft-delete + pin + highlight + settings |
| `app/api/push_routes.py` | Create | vapid-public-key, subscribe, unsubscribe |
| `app/schemas/channel.py` | Create | Todos os schemas do canal |
| `app/notifications/push_service.py` | Create | Web Push via pywebpush |
| `app/notifications/email_service.py` | Create | SendGrid com template resumo |
| `app/notifications/notification_service.py` | Create | Orquestrador com BackgroundTasks + delivery log |
| `app/notifications/scheduler.py` | Create | APScheduler + pg_try_advisory_lock |
| `app/api/inbox_routes.py` | Modify | BackgroundTasks + deep_link + category |
| `app/api/routes/admin.py` | Modify | channel_post_mode no update de OrgUnit |
| `app/schemas/organization.py` | Modify | channel_post_mode no schema de OrgUnit |
| `app/settings.py` | Modify | VAPID + SendGrid |
| `app/main.py` | Modify | scheduler + push_router + channel_router |

### 6.3 Frontend

| Arquivo | Tipo | O que muda |
|---|---|---|
| `app/channel/_layout.tsx` | Create | Stack do canal |
| `app/channel/[unitId].tsx` | Create | Lista + detalhe + edit + delete + moderação |
| `src/services/channel.ts` | Create | API client do canal |
| `src/services/push.ts` | Create | Permissão + registro + revogação |
| `app/(tabs)/home.tsx` | Modify | Card de permissão push |
| `app/members.tsx` | Modify | Botão Canal |
| `app/admin/entities/index.tsx` | Modify | Seletor channel_post_mode |
| `app/admin/create-aviso.tsx` | Modify | Seletor category + campo deep_link |
| `app/_layout.tsx` | Modify | Stack.Screen channel |
| `public/sw.js` | Create | Service Worker |

### 6.4 Segurança

| Área | Risco | Mitigação |
|---|---|---|
| Canal — moderação | Conteúdo inapropriado visível | Soft delete + audit trail + coordenador com poder de remoção |
| Canal — edição | Revisionism sem rastro | `edited_at` sempre atualizado; histórico em AuditLog |
| Push endpoint | Usuário A registra subscription de B | `user_id` sempre do `current_user` autenticado; endpoint nunca aceita `user_id` do body |
| Push endpoint | Endpoint de unsubscribe sem auth filtra por `current_user.id` | Não é possível remover subscription de outro usuário |
| Email — vazamento de conteúdo | Aviso pastoral fora da plataforma | Email contém apenas título + 200 chars de resumo; link para app |
| VAPID keys | Exposição da chave privada | Nunca exposta via API; somente a pública em GET /push/vapid-public-key |
| Scheduler multi-instância | Envio duplicado | pg_advisory_lock garante execução em apenas uma instância |
| LGPD Art. 18 | Sem registro de envio | notification_delivery_log documenta canal, timestamp, status por usuário |
| canal_post_mode | Bypass por string manipulation | Enum Python com validação no schema Pydantic impede valores inválidos |

---

## 7. Arquitetura para Notificações do Projeto de Vida (não implementado agora)

Definição do `NotificationType` enum para implementações futuras:

```
INBOX_NEW          — novo aviso publicado
REVISION_REMINDER  — 1ª sexta do mês: revisão mensal (implementado)
CYCLE_STARTED      — usuário ativou um ciclo novo
CYCLE_ENDING_SOON  — ciclo com 30 dias restantes
CYCLE_ARCHIVED     — ciclo encerrado/arquivado
GOAL_EXPIRING      — meta com prazo próximo
SEMESTER_REVIEW    — lembrete semestral de revisão profunda
CHANNEL_NEW_POST   — novo post publicado em canal de OrgUnit do usuário
CHANNEL_NEW_REPLY  — nova resposta em post que o usuário criou ou respondeu
CHANNEL_MENTION    — usuário mencionado em post ou reply
```

`CHANNEL_*` tipos estão definidos no enum central agora para evitar refatorações quando as notificações do Canal forem ativadas. O `notification_delivery_log` usa `notification_type` como Text (não enum FK), então novos tipos são adicionados sem migration.

---

## 8. Arquitetura de Enquetes (não implementado — futuro)

Quando implementado, a tabela será:

```
inbox_surveys
  id, inbox_message_id (FK), question, type (SINGLE_CHOICE | MULTIPLE_CHOICE)
  
inbox_survey_options
  id, survey_id (FK), text, display_order
  
inbox_survey_responses
  id, survey_id (FK), user_id (FK), option_ids (ARRAY), created_at
  UniqueConstraint(survey_id, user_id)
```

A `InboxMessage` com `category = 'SURVEY'` indica que a mensagem tem enquete associada. O frontend verificará `message.category === 'SURVEY'` para exibir o componente de votação.

Nenhuma dessas tabelas será criada nas migrations atuais — apenas documentadas aqui.

---

## 9. Decisões Adicionais Aprovadas (2026-06-04)

### 9.1 Campo `priority` em InboxMessage

Novo campo `priority: Text NOT NULL default NORMAL` em `inbox_messages`.

Valores: `LOW | NORMAL | HIGH | CRITICAL`

| Priority | Semântica | Estratégia de entrega |
|---|---|---|
| LOW | Conteúdo informativo, assíncrono | Somente Inbox; **sem push, sem e-mail** (reduz ruído, evita fadiga) |
| NORMAL | Eventos e comunicações comuns | Push se subscription existe; e-mail como fallback |
| HIGH | Comunicações importantes | Push se subscription existe; e-mail **sempre** (não é fallback) |
| CRITICAL | Avisos urgentes institucionais | Push **bypass opt-in**; e-mail sempre |

**Separação de responsabilidades entre os três campos:**
- `type` (INFO / WARNING / SUCCESS / URGENT) → urgência **visual** no frontend
- `category` (EVENT / RETREAT / FORMATION / SURVEY / ALERT / GENERAL) → **semântica** do conteúdo
- `priority` (LOW / NORMAL / HIGH / CRITICAL) → **estratégia de entrega**

Exemplos concretos:
| Comunicado | type | category | priority |
|---|---|---|---|
| Formação gravada | INFO | FORMATION | LOW |
| Novo evento | INFO | EVENT | NORMAL |
| Alteração de programação de retiro | WARNING | RETREAT | HIGH |
| Comunicado urgente da Coordenação Geral | URGENT | GENERAL | CRITICAL |

CRITICAL bypassa `push_opt_in` — justificativa pastoral: comunicados críticos da Obra devem chegar a todos os membros ativos. Deve ser usado com parcimônia e documentado no AuditLog.

**Campo obrigatório para CRITICAL:** `critical_reason: str` com `min_length=10`. Documenta a justificativa institucional para o bypass de consentimento e é registrado no AuditLog junto com `title`, `recipient_count` e `created_by_user_id`.

### 9.2 Campo `action_label` em InboxMessage

Novo campo `action_label: Text nullable` em `inbox_messages`.

Permite CTAs contextualizados no e-mail e no payload push:

| action_label | deep_link |
|---|---|
| "Inscrever-se" | /retreats/123 |
| "Abrir Canal" | /channel/abc |
| "Responder Enquete" | /survey/xyz |
| "Ver Projeto de Vida" | /vida |
| null → frontend usa "Ver mais" | qualquer |

O `action_label` é usado:
- No template de e-mail como texto do botão CTA (substituindo o hardcoded "Ver aviso completo")
- No payload do push como campo `action` para futura expansão com notification actions

### 9.3 `NotificationType` Expandido com Tipos do Canal

Adicionados desde já (sem implementação de disparo):

```
CHANNEL_NEW_POST   — novo post em canal de OrgUnit do usuário
CHANNEL_NEW_REPLY  — nova resposta em post que o usuário criou ou respondeu
CHANNEL_MENTION    — menção de usuário em post ou reply
```

Objetivo: evitar refatorações quando as notificações do Canal forem ativadas. O `notification_delivery_log.notification_type` é Text, portanto não requer migration para acomodar os novos tipos.

### 9.4 Arquitetura de Badges e Contadores (não implementado agora)

**Fonte de verdade:** `InboxRecipient.read / read_at` permanece a fonte oficial de contagem de não-lidos.

**Contadores futuros projetados:**

| Badge | Fonte de dados | Implementação futura |
|---|---|---|
| Aba Inbox | `COUNT(InboxRecipient) WHERE user_id=X AND read=false` | Query direta |
| Home (total) | Soma de todos os contadores | Endpoint `GET /me/badges` |
| Canal | `COUNT(ChannelPost) WHERE org_unit_id IN (...) AND created_at > last_seen` | Requer `channel_last_seen` por user+unit |

Para o Canal, será necessário uma tabela `channel_last_seen (user_id, org_unit_id, last_seen_at)` quando badges do canal forem implementados. Não criar agora — apenas garantir que `ChannelPost.created_at` e `InboxRecipient.read_at` são as fontes corretas.

**O sistema de notificações atual não alimenta contadores em tempo real** — isso é intencional. Push notifica; o app atualiza o contador na próxima abertura via query. Evita websockets desnecessários para o volume atual da comunidade.

### 9.5 Arquitetura de Campanhas de Comunicação (não implementado agora)

Futura entidade `notification_campaigns` para agrupar envios institucionais:

```
notification_campaigns
  id, name, description, created_by_user_id, created_at, status
  
Exemplos de nome:
  "Retiro de Postulantado 2027"
  "Quaresma de São Miguel"
  "Formação de Líderes — Módulo 3"
  "Assembleia Geral 2026"
```

**Integração futura com `notification_delivery_log`:**

Quando implementado, `notification_delivery_log` receberá um campo `campaign_id (UUID nullable FK)`, permitindo:
- Métricas por campanha (taxa de entrega push vs e-mail)
- Relatórios institucionais de alcance
- Análise de engajamento por tipo de conteúdo
- Auditoria de campanhas para diretoria da Obra

**Integração futura com `InboxMessage`:**

`InboxMessage` receberá `campaign_id (UUID nullable FK)` para agrupar avisos de uma mesma campanha no inbox do usuário.

Não criar migration agora. A direção está documentada para que o schema atual não conflite com essa expansão (todos os campos são nullable FK — zero impacto retroativo).
