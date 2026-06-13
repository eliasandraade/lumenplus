# Lumen+ — Notificações e Inbox

**Versão da documentação:** 1.0  
**Data:** 2026-06-12  
**Audiência:** desenvolvedor, operador de comunicações

---

## Visão Geral

O sistema de comunicações do Lumen+ tem dois componentes:

1. **Inbox** — mensagens internas (avisos) enviadas por administradores ou coordenadores para membros ou grupos. É o canal oficial de comunicação do app. Implementado e em uso.
2. **Push Notifications** — notificações enviadas para o dispositivo do membro (web push ou FCM). O backend possui as rotas e o modelo de subscription; o fluxo end-to-end não foi validado no RC.

---

## Inbox (Avisos)

### O que é

O Inbox é a caixa de entrada de mensagens do membro. As mensagens chegam de:
- **Avisos**: mensagens enviadas por quem tem permissão de envio (AVISOS, ADMIN, DEV, SECRETARY, coordenadores do Conselho Geral)
- **Notificações de sistema**: confirmações de inscrição, convites, etc.

### Permissão de Envio

O backend (`backend/app/api/inbox_routes.py`) define dois helpers de permissão:

```python
def _has_full_send_access(current_user) -> bool:
    # Papéis com acesso total de envio:
    return any(role.name in ['AVISOS', 'DEV', 'ADMIN', 'SECRETARY'] for role in current_user.global_roles) \
        or is_conselho_geral_coordinator(current_user)

def _check_send_permission(current_user, db) -> bool:
    # CAN_SEND_INBOX (permissão explícita) OU full send access
    return has_permission(current_user, 'CAN_SEND_INBOX', db) or _has_full_send_access(current_user)
```

**Quem pode enviar avisos:**

| Papel / Condição | Pode enviar |
|-----------------|------------|
| `AVISOS` | Sim — sem moderação |
| `DEV` | Sim — sem moderação |
| `ADMIN` | Sim — sem moderação |
| `SECRETARY` | Sim — sem moderação |
| Coordenador do Conselho Geral | Sim — sem moderação |
| `CAN_SEND_INBOX` (permissão explícita) | Sim |
| Membro regular | Não |

### Escopos de Envio

As mensagens de inbox têm um scope que define o alcance:

| Scope | Alcance |
|-------|---------|
| `GLOBAL` | Todos os membros ativos |
| `ORG_UNIT` | Membros de uma unidade específica |
| `USER` | Usuário individual |
| `CRITICAL` | Todos os membros — requer aprovação antes do envio |

### Fluxo de Envio de Aviso

**Para scopes GLOBAL / ORG_UNIT / USER:**

```
1. Remetente com permissão acessa "Criar Aviso" no admin
2. POST /inbox/messages — payload: título, conteúdo, scope, target_ids
3. Mensagem criada com status SENT
4. Membros destinatários recebem no inbox
```

**Para scope CRITICAL:**

```
1. Remetente cria aviso com scope=CRITICAL
2. Mensagem criada com status PENDING_APPROVAL
3. Admin ou DEV aprova via: POST /inbox/approval/{message_id}/approve
   (ou rejeita: POST /inbox/approval/{message_id}/reject)
4. Aprovado → mensagem distribuída para todos
```

A aprovação de avisos CRITICAL está na tela `app/admin/approvals/index.tsx`, seção "Segurança" do menu Admin.

### API do Inbox

| Endpoint | Acesso | Descrição |
|----------|--------|-----------|
| `GET /inbox/messages` | Autenticado | Mensagens do usuário atual |
| `GET /inbox/messages/{id}` | Autenticado (destinatário) | Detalhe da mensagem |
| `POST /inbox/messages/{id}/read` | Autenticado (destinatário) | Marca como lida |
| `POST /inbox/messages` | Permissão de envio | Cria aviso |
| `GET /inbox/permissions` | Autenticado | Permissões de envio do usuário |
| `GET /inbox/approval/pending` | ADMIN, DEV | Avisos CRITICAL pendentes de aprovação |
| `POST /inbox/approval/{id}/approve` | ADMIN, DEV | Aprova aviso CRITICAL |
| `POST /inbox/approval/{id}/reject` | ADMIN, DEV | Rejeita aviso CRITICAL |

### Frontend do Inbox

**Criação de avisos (admin):**
- `app/admin/create-aviso.tsx` — formulário de criação de aviso com seleção de scope e destinatários
- `app/admin/sent-avisos.tsx` — lista de avisos enviados pelo remetente

**Inbox do membro:**
- `app/(tabs)/invites.tsx` — esta é a tela de inbox/avisos do membro (header do arquivo: *"Tela de avisos e comunicações do app"*). URL: `/invites`. Exibe mensagens recebidas dos últimos 30 dias e, para aprovadores, avisos pendentes de aprovação de exportação.

---

## Push Notifications

### Visão Geral

O backend implementa Push Notifications via Web Push API (VAPID) para web e via Firebase Cloud Messaging (FCM) para mobile. As rotas estão em `backend/app/api/push_routes.py`.

### Backend (em produção)

| Endpoint | Acesso | Descrição |
|----------|--------|-----------|
| `GET /push/vapid-public-key` | Público | Chave pública VAPID para subscription |
| `POST /push/subscribe` | Autenticado | Registra endpoint de push do dispositivo |
| `DELETE /push/unsubscribe` | Autenticado | Remove subscription do dispositivo |

### Fix H5A-07 (em produção)

A auditoria H5A identificou que `POST /push/subscribe` reatribuía o `user_id` de uma subscription existente caso o mesmo endpoint de push fosse registrado por um usuário diferente — um dispositivo compartilhado poderia ter suas notificações redirecionadas silenciosamente.

**Correção (H5B):** se o endpoint de push já existe no banco e pertence a outro `user_id`, o servidor retorna **HTTP 409 Conflict** em vez de reatribuir. O cliente deve solicitar uma nova subscription ao service worker antes de tentar novamente.

```python
# backend/app/api/push_routes.py
existing = db.query(PushSubscription).filter_by(endpoint=endpoint).first()
if existing and existing.user_id != current_user.id:
    raise HTTPException(status_code=409, detail="Endpoint already registered to another user")
```

### Frontend (integração não auditada)

O backend possui as rotas de push (`/push/vapid-public-key`, `/push/subscribe`, `/push/unsubscribe`) e o Service Worker (`dist/sw.js`) está presente no build web. Porém:

- O fluxo completo de permissão → subscription → recebimento de push **não foi auditado** no RC
- FCM mobile (iOS/Android) não foi auditado
- Não foi confirmado se o frontend chama `/push/subscribe` em produção

**Status:** rotas backend disponíveis; integração frontend não validada end-to-end. Não declarar como feature ativa sem validação.

---

## Diferença entre Inbox e Push

| Característica | Inbox | Push |
|----------------|-------|------|
| Persistência | Sim — mensagens ficam no banco | Não — notificação é transiente |
| Requer app aberto | Não | Não (push chega em background) |
| Rastreável | Sim (read/unread) | Não |
| Controle de escopo | Sim (GLOBAL, ORG_UNIT, USER, CRITICAL) | Depende do targeting do push |
| Aprovação | Só para CRITICAL | Não |

O design atual usa o Inbox como canal principal de avisos. Push é complementar — idealmente dispara uma notificação que leva o usuário a abrir o aviso no inbox.

---

## Pendências POST-RC

| Item | Descrição |
|------|-----------|
| Push end-to-end não auditado | Fluxo completo (permissão → subscription → recebimento web e mobile) não validado em produção |
| FCM mobile | Integração FCM para iOS/Android não auditada |
| Push para eventos do app | Novos posts no canal, confirmação de inscrição, avisos críticos, lembretes — não implementado |

---

## Próxima leitura

- **Painel Admin (aprovações de CRITICAL):** `06-admin.md`
- **Autenticação e permissões (papéis AVISOS, SECRETARY):** `05-autenticacao-permissoes.md`
- **Backend — endpoints inbox e push:** `03-backend.md`
- **Segurança e hardening (H5A-07):** `11-seguranca-hardening.md`
