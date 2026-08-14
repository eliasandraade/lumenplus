# PROD-01 — Plano de Ativação de Push Web

**Data:** 2026-06-14  
**Status:** Pronto para ativação — apenas VAPID keys faltando  
**Depende de:** Staging isolado (Railway backend-staging + Vercel env var)

---

## Auditoria do Estado Atual (2026-06-14)

### ✅ Backend — Completamente implementado

| Componente | Arquivo | Status |
|-----------|---------|--------|
| Endpoint VAPID public key | `backend/app/api/push_routes.py` | ✅ `GET /push/vapid-public-key` |
| Endpoint subscribe | `backend/app/api/push_routes.py` | ✅ `POST /push/subscribe` |
| Endpoint unsubscribe | `backend/app/api/push_routes.py` | ✅ `DELETE /push/unsubscribe` |
| Envio Web Push (pywebpush) | `backend/app/notifications/push_service.py` | ✅ `send_web_push()` |
| Orquestrador push+email | `backend/app/notifications/notification_service.py` | ✅ `notify_new_inbox()`, `notify_revision_reminder()` |
| Delivery log | `notification_service.py` | ✅ `NotificationDeliveryLog` |
| Push opt-in por usuário | `notification_service.py` | ✅ `UserPreferences.push_opt_in` |
| Proteção against endpoint takeover | `push_routes.py` linha 52 | ✅ 409 Conflict se endpoint de outro usuário |
| Limpeza de subscriptions expiradas (410) | `push_service.py` linha 40 | ✅ `is_subscription_expired()` |

**Única coisa faltando no backend:** `VAPID_PRIVATE_KEY`, `VAPID_PUBLIC_KEY`, `VAPID_EMAIL` configurados no Railway.

### ✅ Frontend — Completamente implementado

| Componente | Arquivo | Status |
|-----------|---------|--------|
| Service Worker | `lumen_mobile/public/sw.js` | ✅ Trata `push` e `notificationclick` |
| Registro do SW | `lumen_mobile/src/services/push.ts` | ✅ `navigator.serviceWorker.register('/sw.js')` |
| Subscribe | `lumen_mobile/src/services/push.ts` | ✅ `registerPushSubscription()` |
| Solicitar permissão | `lumen_mobile/src/services/push.ts` | ✅ `requestAndRegisterPush()` |
| Persistir decisão do usuário | `lumen_mobile/src/services/push.ts` | ✅ `AsyncStorage` |
| Buscar VAPID public key | `lumen_mobile/src/services/push.ts` | ✅ `api.get('/push/vapid-public-key')` |

**SW path:** registrado em `/sw.js` — arquivo existe em `lumen_mobile/public/sw.js` e é copiado para o build pelo Expo.

---

## Sequência de Ativação (quando staging estiver pronto)

### Passo 1 — Gerar VAPID keys

```bash
cd backend
# Usar Python com pywebpush instalado
python -c "
from pywebpush import Vapid
vapid = Vapid()
vapid.generate_keys()
print('VAPID_PRIVATE_KEY =', vapid.private_key)
print('VAPID_PUBLIC_KEY  =', vapid.public_key)
"
```

Salvar as chaves geradas com segurança antes de configurar.

### Passo 2 — Configurar no backend-staging

```
Railway Dashboard → lumen+ → backend-staging → Variables
VAPID_PRIVATE_KEY = <chave privada>
VAPID_PUBLIC_KEY  = <chave pública>
VAPID_EMAIL       = mailto:privacidade@lumenplus.app
```

### Passo 3 — Validar chave pública acessível

```bash
curl https://backend-staging.up.railway.app/push/vapid-public-key
# Esperado: {"public_key": "..."}
```

### Passo 4 — Testar subscribe no staging

1. Abrir staging frontend no Chrome
2. DevTools → Application → Service Workers → confirmar `sw.js` registrado
3. Acionar fluxo de push (onde estiver integrado no app)
4. Confirmar `POST /push/subscribe` retorna 201

### Passo 5 — Testar envio

```bash
# Endpoint de teste admin (se disponível) ou via shell Railway:
# cd backend && railway run python -c "
# from app.notifications.notification_service import notify_new_inbox
# notify_new_inbox([<user_id>], 'Teste', 'Push funcionando!')
# "
```

### Passo 6 — Smoke tests staging

- [ ] Permissão de notificação solicitada ao acessar app
- [ ] Service Worker registrado sem erros de CSP
- [ ] Subscription salva no banco (`SELECT * FROM push_subscriptions`)
- [ ] Push recebido no browser
- [ ] Clicar na notificação abre o app
- [ ] Cancelar permissão: app continua funcionando normalmente (fail gracioso)

### Passo 7 — Configurar produção (após staging validado)

Mesmo processo do Passo 2, mas no serviço `backend` (produção).

**Usar as mesmas VAPID keys do staging** (não gerar novas — subscriptions são vinculadas à chave pública).

---

## Riscos e Observações

| Risco | Status | Notas |
|-------|--------|-------|
| CSP bloqueia SW | ✅ Mitigado | `worker-src 'self' blob:` está na CSP |
| CSP bloqueia subscribe | ✅ Mitigado | Backend staging adicionado ao `connect-src` (este PR) |
| Browser não suporta push | Tratado | `push.ts` retorna `false` graciosamente |
| Usuário recusa permissão | Tratado | `savePushDecision('denied')` persiste decisão |
| Subscription expirada (410) | Tratado | `is_subscription_expired()` limpa automaticamente |
| Emojis no payload | Cuidado | `notify_new_inbox` usa `📢` — testar encoding UTF-8 |

---

## O que NÃO está implementado (fora do escopo PROD-01)

- UI de configuração de notificações pelo usuário (tela de preferências)
- Push para eventos além de inbox e revisão mensal (PROD-02)
- FCM mobile iOS/Android (PROD-05 — item separado)

---

## Estado: Pronto para ativar quando staging estiver disponível

Nenhum código adicional necessário. Apenas:
1. Gerar VAPID keys
2. Configurar no Railway (staging → produção)
3. Smoke tests

**Blocker atual:** Railway backend-staging não existe ainda.
