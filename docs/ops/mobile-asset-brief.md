# MOBILE-01 — Brief para Designer: Assets de Alta Resolução

**Data:** 2026-06-14  
**Para:** Designer responsável pelos assets do Lumen+  
**Prioridade:** BLOCKER para App Store e Play Store

---

## Problema Atual

Os assets atuais têm 192×192 px — insuficientes para submissão às lojas.

| Asset | Tamanho atual | Status |
|-------|--------------|--------|
| `icon.png` | 192×192 px | ❌ BLOCKER — App Store exige 1024×1024 |
| `splash.png` | 192×192 px | ❌ Insuficiente |
| `adaptive-icon.png` | 192×192 px | ❌ Insuficiente para Play Store |

---

## Especificações necessárias

### 1. Ícone do App — `assets/icon.png`

**Especificação:**
- Tamanho: **1024×1024 px**
- Formato: PNG
- Fundo: **sólido** (sem transparência)
- Cantos: **quadrados** (o iOS aplica os arredondados automaticamente)
- Sem sombras externas
- Sem texto — apenas o símbolo/marca

**Onde vai:**
- App Store Connect (íncone da loja)
- Google Play Console (ícone da loja, redimensionado)
- Notificações push mobile (redimensionado)
- Ícone do app na tela inicial

---

### 2. Splash Screen — `assets/splash.png`

**Especificação:**
- Tamanho: **2048×2048 px** (mínimo) — quadrado para funcionar em todos os orientations
- Formato: PNG
- Fundo: cor sólida (preferencialmente a cor primária do app)
- Conteúdo: logo/símbolo centralizado com safe zone generosa (logo não deve ultrapassar 50% do tamanho)
- Safe zone recomendada: 512px em cada borda sem conteúdo crítico

**Onde vai:**
- Tela de carregamento inicial do app (iOS e Android)

**Nota:** Expo redimensiona automaticamente para cada device. Manter o conteúdo principal na área central.

---

### 3. Adaptive Icon (Android) — `assets/adaptive-icon.png`

**Especificação:**
- Tamanho: **1024×1024 px**
- Formato: PNG
- **Com transparência**: apenas a camada de foreground (o Android aplica o background separadamente)
- Safe zone: o Android corta o ícone de formas variadas (círculo, quadrado arredondado, etc.) — manter conteúdo principal nos **72dp centrais** (aproximadamente 72% do tamanho total)

**Onde vai:**
- Ícone adaptativo do Android (diferentes formas por fabricante)

---

### 4. Ícone de Notificação — `assets/notification-icon.png` *(novo — para PROD-05)*

**Especificação:**
- Tamanho: **96×96 px** (pode ser múltiplo — 192×192 é suficiente)
- Formato: PNG
- Cor: **branco sólido sobre fundo transparente** (padrão Android notifications)
- Simplificado — funciona bem em tamanho pequeno

**Onde vai:**
- Notificações push Android
- Referenciado em `app.json → notification.icon`

---

## Configuração no app.json (a atualizar após ter os assets)

```json
{
  "expo": {
    "icon": "./assets/icon.png",
    "splash": {
      "image": "./assets/splash.png",
      "resizeMode": "contain",
      "backgroundColor": "#1A1A2E"
    },
    "android": {
      "adaptiveIcon": {
        "foregroundImage": "./assets/adaptive-icon.png",
        "backgroundColor": "#1A1A2E"
      }
    },
    "notification": {
      "icon": "./assets/notification-icon.png",
      "color": "#4A90D9"
    }
  }
}
```

_(Substituir cores pelo design system do Lumen+)_

---

## Assets adicionais necessários para as lojas (não são assets do app)

### Screenshots para App Store Connect (iOS)

Obrigatório para submissão. Mínimo 1 screenshot por tamanho de device obrigatório.

| Device | Tamanho (portrait) | Prioridade |
|--------|-------------------|------------|
| iPhone 6.9" (iPhone 16 Pro Max) | 1320×2868 px | Obrigatório |
| iPhone 6.5" (iPhone 14 Plus) | 1242×2688 px | Obrigatório |
| iPad 12.9" (se suportar iPad) | 2048×2732 px | Opcional |

### Screenshots para Google Play Console (Android)

Mínimo 2 screenshots obrigatórios.

| Tipo | Tamanho | Prioridade |
|------|---------|------------|
| Telefone (portrait) | 1080×1920 px (ou similar 16:9) | Obrigatório (mín. 2) |
| Feature Graphic | 1024×500 px | Obrigatório para publicação |

---

## Comandos para verificar as dimensões (após receber assets)

```bash
cd lumen_mobile
python3 -c "
from PIL import Image
assets = ['assets/icon.png', 'assets/splash.png', 'assets/adaptive-icon.png']
for p in assets:
    img = Image.open(p)
    print(f'{p}: {img.size} mode={img.mode}')
"
```

Resultados esperados:
```
assets/icon.png: (1024, 1024) mode=RGB
assets/splash.png: (2048, 2048) mode=RGBA
assets/adaptive-icon.png: (1024, 1024) mode=RGBA
```
