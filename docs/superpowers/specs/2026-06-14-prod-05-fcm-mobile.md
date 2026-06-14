# PROD-05 — FCM Mobile iOS/Android

**Data:** 2026-06-14 | **Prioridade:** P1 | **Depende de staging:** ✅ Sim

---

## Estado Atual (auditado)

```json
// lumen_mobile/app.json
"plugins": ["expo-router", "expo-secure-store"]
// NÃO tem expo-notifications
// NÃO tem configuração FCM
// NÃO tem eas.json (arquivo não existe no repo)
```

- `expo-notifications` **não instalado**
- Firebase Cloud Messaging server key: **não configurada**
- `eas.json`: **não existe**
- Bundle IDs configurados: `com.lumenchristi.lumenplus` (iOS + Android) ✅

---

## Problema

Push notifications mobile não existem. O app mobile não está configurado para receber ou exibir notificações push no iOS e Android. Isso requer:
1. Plugin `expo-notifications` (rebuild nativo necessário)
2. FCM server key no backend
3. `eas.json` para builds EAS
4. Certificados de push iOS (APNs) no Apple Developer

---

## Objetivo

Ativar push notifications mobile completo:
- iOS: APNs via Firebase (FCM wrapping APNs)
- Android: FCM nativo
- Backend: armazenar tokens FCM e enviar push mobile

---

## Escopo

- Instalar e configurar `expo-notifications`
- Criar `eas.json` básico
- Configurar FCM no Firebase Console
- Backend: endpoint de registro de token FCM
- Testar em device real (simulador não suporta push iOS)

## Fora de Escopo

- Push web (PROD-01)
- Notificações em background quando app está fechado (requer entitlement iOS extra)
- Deep links de notificação (Ciclo posterior)

---

## Dependências

- **MOBILE-01** (eas.json + contas de loja) — prerequisite
- **Apple Developer Program** ativo (`com.lumenchristi.lumenplus` registrado)
- **Google Play Console** ativo (para Android)
- **Firebase Console** — habilitar FCM no projeto `lumenplus`
- Acesso ao Railway (para configurar FCM server key)

---

## Riscos

| Risco | Probabilidade | Mitigação |
|-------|---------------|-----------|
| `expo-notifications` requer rebuild nativo (não hot-update) | Certeza | Planejar novo build EAS antes de testar |
| APNs exige certificado Apple válido | Alta | Criar via EAS ou Apple Developer antes do build |
| FCM muda API (FCM v1 vs Legacy) | Média | Usar FCM HTTP v1 (pywebpush não suporta FCM; usar `firebase-admin` Python) |
| Simulador iOS não suporta push | Certeza | Testar em device real via TestFlight |
| Build EAS demora (fila de build) | Média | Iniciar build cedo; usar staging build |

---

## Plano de Implementação

### Passo 1 — Instalar expo-notifications
```bash
cd lumen_mobile
npx expo install expo-notifications
```

### Passo 2 — Adicionar plugin ao app.json
```json
{
  "expo": {
    "plugins": [
      "expo-router",
      "expo-secure-store",
      ["expo-notifications", {
        "icon": "./assets/notification-icon.png",
        "color": "#ffffff",
        "sounds": []
      }]
    ],
    "notification": {
      "icon": "./assets/notification-icon.png",
      "color": "#4A90D9"
    }
  }
}
```

### Passo 3 — Criar eas.json
```json
{
  "cli": {
    "version": ">= 10.0.0"
  },
  "build": {
    "development": {
      "developmentClient": true,
      "distribution": "internal"
    },
    "preview": {
      "distribution": "internal",
      "ios": { "simulator": false }
    },
    "production": {
      "autoIncrement": true
    }
  },
  "submit": {
    "production": {}
  }
}
```

### Passo 4 — Registrar token FCM no app
```tsx
// lumen_mobile/hooks/usePushNotifications.ts
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

export async function registerForPushNotifications(): Promise<string | null> {
  const { status } = await Notifications.requestPermissionsAsync();
  if (status !== 'granted') return null;

  const token = await Notifications.getExpoPushTokenAsync({
    projectId: 'YOUR_EAS_PROJECT_ID', // do app.json "expo.extra.eas.projectId"
  });
  return token.data;
}
```

### Passo 5 — Endpoint no backend para registrar token
```python
# backend/app/push_routes.py
# POST /push/fcm-token  { token: str, platform: "ios" | "android" }
# Armazenar em tabela push_tokens (user_id, token, platform, created_at)
```

### Passo 6 — Configurar FCM no Firebase Console
```
Firebase Console → lumenplus → Project Settings → Cloud Messaging
Habilitar FCM API v1
Gerar chave de servidor ou usar service account existente
```

### Passo 7 — Configurar backend para enviar via FCM
```bash
pip install firebase-admin
# Usar service account do Firebase (já disponível como FIREBASE_PRIVATE_KEY)
```

### Passo 8 — Build EAS staging
```bash
eas build --platform all --profile preview
# Aguardar build (~10-20 min)
# Instalar no device via link EAS
```

### Passo 9 — Testar end-to-end
```bash
# Device real com build de staging
# Conceder permissão de notificação
# Verificar token registrado no backend
# Enviar push de teste via admin endpoint
# Verificar notificação no device
```

---

## Critérios de Aceite

- `expo-notifications` instalado e no `app.json`
- `eas.json` criado e commitado
- Build EAS funciona sem erros
- Token FCM registrado no backend após login
- Push enviado pelo backend aparece no device iOS e Android
- Permissão de push solicitada corretamente na primeira abertura

## Rollback

Remover `expo-notifications` do `app.json` + `npm uninstall expo-notifications` + novo build. Não afeta usuários web.

---

## Classificação

- **Depende de staging:** ✅ Sim — build EAS de preview antes de production
- **Bloqueia App Store/Play Store:** ✅ Sim — sem `eas.json` não há build para submissão
- **Implementável via código:** ✅ Sim (com acesso a Firebase Console e Apple Developer)
- **Depende de decisão humana:** Parcialmente (acesso às plataformas externas)
