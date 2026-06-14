# MOBILE-01 — EAS / App Store / Play Store

**Data:** 2026-06-14 | **Prioridade:** P1 | **Depende de staging:** Não

---

## Estado Atual (auditado)

```
lumen_mobile/app.json:
  name: "Lumen+"
  slug: "lumen-plus"
  version: "1.0.0"
  ios.bundleIdentifier: "com.lumenchristi.lumenplus"  ✅
  android.package: "com.lumenchristi.lumenplus"       ✅
  icon: "./assets/icon.png"                           (verificar se existe)
  scheme: "lumenplus"                                 ✅

eas.json: NÃO EXISTE ❌
EAS project ID: não configurado no app.json ❌
```

---

## Problema

O app mobile nunca foi submetido a nenhuma loja. Não há `eas.json`, não há configuração EAS, não há conta Apple Developer nem Google Play Console verificada para este bundle ID. Sem esses itens, não é possível:
- Fazer build de produção
- Distribuir internamente para teste (TestFlight / Play Console Internal Testing)
- Submeter para revisão nas lojas

---

## Objetivo

Preparar toda a infraestrutura de build e distribuição mobile:
1. Criar `eas.json` com perfis development/preview/production
2. Configurar EAS Project
3. Auditar assets (ícone, splash screen, tamanhos corretos para lojas)
4. Abrir contas de desenvolvedor nas lojas
5. Registrar o app nos portais das lojas
6. Fazer primeiro build de preview/internal bem-sucedido

---

## Escopo

- `eas.json` criado e commitado
- EAS project configurado (`expo.extra.eas.projectId` no app.json)
- Assets de loja auditados
- Apple App Store Connect: app criado
- Google Play Console: app criado
- Build EAS preview bem-sucedido

## Fora de Escopo

- Submissão para revisão nas lojas (Ciclo posterior, após LGPD-06 + SEC-01 + PROD-05)
- Metadata das lojas (screenshots, descrição, classificação etária)

---

## Dependências

- Conta Apple Developer Program ativa (`$99/ano`)
- Conta Google Play Console ativa (`$25 taxa única`)
- Conta EAS (Expo Application Services) — plano gratuito disponível
- Bundle IDs já definidos: `com.lumenchristi.lumenplus` ✅

---

## Decisões Humanas Requeridas

| Decisão | Responsável |
|---------|-------------|
| Abrir conta Apple Developer (se não existir) | Elias |
| Abrir conta Google Play Console (se não existir) | Elias |
| Criar app no App Store Connect | Elias |
| Criar app no Google Play Console | Elias |
| Confirmar classificação etária do app | Elias |
| Definir países de distribuição | Elias |

---

## Checklist de Assets (verificar antes do build)

### Ícone do app
```bash
ls lumen_mobile/assets/icon.png
# Deve ser: 1024x1024px, PNG, sem cantos arredondados, sem transparência
```

### Splash Screen
```bash
ls lumen_mobile/assets/splash.png
# Deve ser: 1284x2778px (ou maior) para iOS; 1080x1920px para Android
```

### Adaptive Icon (Android)
```json
// app.json deve ter:
"android": {
  "adaptiveIcon": {
    "foregroundImage": "./assets/adaptive-icon.png",
    "backgroundColor": "#FFFFFF"
  }
}
```

---

## Plano de Implementação

### Passo 1 — Instalar EAS CLI e login
```bash
npm install -g eas-cli
eas login  # login com conta Expo do projeto
```

### Passo 2 — Inicializar projeto EAS
```bash
cd lumen_mobile
eas init  # cria EAS project e adiciona expo.extra.eas.projectId ao app.json
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
      "distribution": "internal",
      "ios": { "simulator": true }
    },
    "preview": {
      "distribution": "internal",
      "android": { "buildType": "apk" },
      "ios": { "simulator": false }
    },
    "production": {
      "autoIncrement": true,
      "android": { "buildType": "app-bundle" }
    }
  },
  "submit": {
    "production": {
      "ios": {
        "appleId": "oeliasandraade@gmail.com",
        "ascAppId": "",
        "appleTeamId": ""
      },
      "android": {
        "serviceAccountKeyPath": "./google-play-key.json",
        "track": "internal"
      }
    }
  }
}
```

### Passo 4 — Criar app nas lojas
```
Apple App Store Connect → My Apps → + → New App
  Bundle ID: com.lumenchristi.lumenplus
  Name: Lumen+
  Primary Language: Portuguese (Brazil)

Google Play Console → All Apps → Create App
  App name: Lumen+
  Default language: Portuguese (Brazil)
  App or game: App
  Free or paid: Free
```

### Passo 5 — Auditar e corrigir assets
```bash
# Verificar dimensões do ícone
python -c "from PIL import Image; img = Image.open('assets/icon.png'); print(img.size)"
# Esperado: (1024, 1024)
```

### Passo 6 — Primeiro build preview
```bash
cd lumen_mobile
eas build --platform all --profile preview
# Aguardar ~10-20 min
# Verificar que build completa sem erros
```

---

## Critérios de Aceite

- `eas.json` criado e commitado
- EAS project ID configurado no `app.json`
- App criado no App Store Connect (com bundle ID correto)
- App criado no Google Play Console (com bundle ID correto)
- Build EAS preview completa sem erros para iOS e Android
- Assets (ícone, splash) em dimensões corretas

## Rollback

N/A — `eas.json` pode ser removido sem impacto. Contas nas lojas ficam como rascunho até submissão.

---

## Classificação

- **Depende de staging:** Não
- **Bloqueia App Store/Play Store:** ✅ Sim — é o pré-requisito de todos os outros itens de loja
- **Implementável via código:** ✅ Parcialmente (`eas.json` + `app.json` são código; contas externas são ação humana)
- **Depende de decisão humana:** ✅ Sim — criar contas nas lojas, aceitar termos
- **Gate para:** PROD-05 (FCM mobile requer eas.json e contas ativas)
