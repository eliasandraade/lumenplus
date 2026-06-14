# PROD-01 — Push Notifications Web End-to-End

**Data:** 2026-06-14 | **Prioridade:** P1 | **Depende de staging:** Preferível

---

## Estado Atual (auditado)

### Backend
- `backend/app/push_service.py` — implementado (pywebpush)
- `backend/app/push_routes.py` — endpoints `/push/subscribe`, `/push/send` (ou equivalente) implementados
- `settings.py`: `vapid_private_key`, `vapid_public_key`, `vapid_email` — **todos vazios por padrão em produção**

### Frontend
- Service Worker: verificar se `lumen_mobile/` tem `service-worker.js` ou registro SW
- Expo Web tem suporte limitado a Service Workers; requer configuração explícita

---

## Problema

Push notifications web estão implementadas no backend mas não funcionam em produção porque as VAPID keys nunca foram configuradas. O fluxo completo (subscribe → armazenar subscription → enviar notificação → receber no browser) nunca foi testado end-to-end.

---

## Objetivo

Ativar push notifications web completo:
1. Gerar VAPID keys
2. Configurar em produção (Railway env vars)
3. Implementar/verificar Service Worker no frontend
4. Testar subscription e envio end-to-end em staging
5. Validar em produção

---

## Escopo

- Geração de VAPID keys
- Configuração Railway (produção e staging)
- Frontend: registro de Service Worker + subscription
- Backend: `/push/subscribe` salva subscription; envio de push funciona
- Teste end-to-end

## Fora de Escopo

- Push mobile iOS/Android (PROD-05)
- UI de configuração de notificações pelo usuário (pode ser adicionada depois)

---

## Dependências

- Acesso ao Railway Dashboard (para configurar VAPID keys)
- Staging funcionando (para testar sem risco de produção)

---

## Riscos

| Risco | Probabilidade | Mitigação |
|-------|---------------|-----------|
| Service Worker bloqueado por CSP | Alta | Garantir `worker-src 'self' blob:` na CSP (já está) |
| VAPID key incorreta rejeita subscription | Média | Testar geração com pywebpush antes de configurar |
| Push bloqueado por browser (usuário recusa permissão) | Normal | Fluxo gracioso; não quebra app se usuário recusar |
| Expo Web limita Service Worker | Alta | Verificar suporte; pode precisar de `public/service-worker.js` customizado |

---

## Plano de Implementação

### Passo 1 — Gerar VAPID keys
```bash
# Instalar pywebpush
pip install pywebpush

# Gerar par de chaves
python -c "
from pywebpush import Vapid
vapid = Vapid()
vapid.generate_keys()
print('Private:', vapid.private_key)
print('Public:', vapid.public_key)
"
```

### Passo 2 — Configurar em staging primeiro
```
Railway Dashboard → lumen+ → backend (staging) → Variables
VAPID_PRIVATE_KEY = <chave privada gerada>
VAPID_PUBLIC_KEY = <chave pública gerada>
VAPID_EMAIL = mailto:contato@lumenplus.app
```

### Passo 3 — Verificar Service Worker no frontend
```bash
ls lumen_mobile/public/service-worker.js
# ou
ls lumen_mobile/public/sw.js
```

Se não existir, criar `lumen_mobile/public/service-worker.js`:
```javascript
self.addEventListener('push', function(event) {
  const data = event.data.json();
  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: '/icon.png',
    })
  );
});

self.addEventListener('notificationclick', function(event) {
  event.notification.close();
  event.waitUntil(clients.openWindow('/'));
});
```

### Passo 4 — Registrar Service Worker no app web
```tsx
// lumen_mobile/app/_layout.tsx ou similar
// Adicionar após montagem:
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/service-worker.js');
}
```

### Passo 5 — Testar subscription em staging
```bash
# No browser: DevTools → Application → Service Workers → verificar registrado
# Clicar em "Enable Push" no app → verificar POST /push/subscribe → 200
# Enviar push de teste via backend:
curl -X POST https://backend-staging.up.railway.app/push/send \
  -H "Authorization: Bearer <admin-token>" \
  -d '{"title": "Teste", "body": "Push funcionando!"}'
```

### Passo 6 — Configurar produção após validação em staging
```
Railway Dashboard → lumen+ → backend (prod) → Variables
VAPID_PRIVATE_KEY = <mesma chave do staging>
VAPID_PUBLIC_KEY = <mesma chave pública>
VAPID_EMAIL = mailto:contato@lumenplus.app
```

---

## Critérios de Aceite

- VAPID keys configuradas em produção
- `POST /push/subscribe` retorna 200 com subscription válida
- Push enviado pelo backend aparece no browser do usuário
- Service Worker registrado sem erros no console
- Nenhum erro CSP relacionado ao Service Worker

## Rollback

Remover VAPID keys do Railway. Backend retorna erro ao tentar enviar push (fail gracioso).

---

## Classificação

- **Depende de staging:** Preferível — testar antes de expor em produção
- **Bloqueia App Store/Play Store:** Não (push web é independente do mobile)
- **Implementável via código:** ✅ Sim (geração de keys + Service Worker + configuração)
- **Depende de decisão humana:** Parcialmente (acesso ao Railway para configurar keys)
