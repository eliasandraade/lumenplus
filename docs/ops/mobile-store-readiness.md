# MOBILE-01 — Checklist de Preparação para App Store / Play Store

**Data:** 2026-06-14  
**Status:** Em preparação — aguardando ações humanas externas

---

## Identificação do App

| Item | Valor | Status |
|------|-------|--------|
| Nome | Lumen+ | ✅ |
| iOS Bundle ID | `com.lumenchristi.lumenplus` | ✅ |
| Android Package | `com.lumenchristi.lumenplus` | ✅ |
| Versão | 1.0.0 | ✅ |
| URL scheme | `lumenplus` | ✅ |

---

## Status do eas.json

| Item | Status | Detalhe |
|------|--------|---------|
| `eas.json` criado | ✅ | `lumen_mobile/eas.json` — perfis development/preview/production |
| EAS Project ID | ❌ PENDENTE | Requer `eas init` com login na conta Expo do projeto |
| `expo.extra.eas.projectId` em app.json | ❌ PENDENTE | Adicionado automaticamente pelo `eas init` |
| EAS CLI autenticado | ❌ PENDENTE | Requer `eas login` + conta Expo |

---

## Auditoria de Assets (auditado em 2026-06-14)

### Dimensões atuais (verificado com PIL)

| Asset | Tamanho Atual | Requisito App Store | Requisito Play Store | Status |
|-------|--------------|---------------------|---------------------|--------|
| `icon.png` | 192×192 px | **1024×1024 px** | 512×512 px (hi-res) | ❌ Insuficiente |
| `splash.png` | 192×192 px | ≥ 1242×2688 px | ≥ 1080×1920 px | ❌ Insuficiente |
| `adaptive-icon.png` | 192×192 px | N/A | ≥ 1024×1024 px (recomendado) | ❌ Insuficiente |

**⚠️ BLOCKER para submissão às lojas:** Os três assets precisam ser redesenhados em resolução alta.

### Requisitos de assets para submissão

#### iOS (App Store Connect)
- **App icon:** 1024×1024 px, PNG, sem transparência, sem cantos arredondados (o iOS os aplica)
- **Splash screen:** não obrigatório, mas recomendado >= iPhone Pro Max resolution (1320×2868)
- **Screenshots:** obrigatório para submissão (não é asset do app — são capturas de tela)
  - iPhone 6.9": 1320×2868 px
  - iPhone 6.5": 1242×2688 px
  - iPad 12.9": 2048×2732 px (se suportar iPad)

#### Android (Google Play Console)
- **Hi-res icon:** 512×512 px, PNG ou JPEG
- **Feature graphic:** 1024×500 px (obrigatório para publicação)
- **Screenshots:** mínimo 2, máximo 8 (não é asset do app)
  - Telefone: 320-3840 px (ratio 16:9 ou 9:16)
- **Adaptive icon:** Foreground 1024×1024+ com safe zone de 72dp no centro

---

## Contas Externas

### Apple Developer Program
| Item | Status | Detalhe |
|------|--------|---------|
| Conta Apple Developer | ❌ PENDENTE | Verificar se já existe conta ativa |
| Taxa anual | $99/ano | Confirmar pagamento antes de criar app |
| App criado no App Store Connect | ❌ PENDENTE | Após conta ativa |
| Bundle ID registrado (`com.lumenchristi.lumenplus`) | ❌ PENDENTE | Registrar no Apple Developer portal |
| Certificado de distribuição iOS | ❌ PENDENTE | Gerado durante `eas build` (automático se EAS manages credentials) |
| APNs key (para push notifications) | ❌ PENDENTE | Necessário para PROD-05 |

### Google Play Console
| Item | Status | Detalhe |
|------|--------|---------|
| Conta Google Play Console | ❌ PENDENTE | Verificar se já existe conta ativa |
| Taxa de registro | $25 (única) | Confirmar pagamento |
| App criado no Google Play Console | ❌ PENDENTE | Após conta ativa |
| Upload de keystore Android | ❌ PENDENTE | Gerado durante `eas build` (automático se EAS manages credentials) |
| FCM server key | ❌ PENDENTE | Necessário para PROD-05 |

---

## Privacidade e Compliance (exigidos pelas lojas)

| Requisito | Apple | Google | Status |
|-----------|-------|--------|--------|
| Política de Privacidade (URL pública) | Obrigatório | Obrigatório | ❌ PENDENTE (LGPD-06) |
| Privacy Nutrition Label (tipos de dados coletados) | Obrigatório | Obrigatório | ❌ PENDENTE (LGPD-03/ROPA) |
| Classificação etária | Obrigatório | Obrigatório | ❌ PENDENTE |
| Declaração de exportação (CCATS ou isenção) | Obrigatório se criptografia | Não necessário | ❌ PENDENTE (usa Firebase Auth com criptografia) |
| Permissões explicadas (câmera, notificações) | Obrigatório | Obrigatório | ❌ PENDENTE |

---

## Checklist Pré-TestFlight / Internal Testing

### Técnico
- [ ] EAS Project ID configurado em `app.json`
- [ ] `eas build --profile preview --platform all` completa sem erros
- [ ] Assets redesenhados em resolução correta (icon, splash, adaptive-icon)
- [ ] Permissões declaradas no `app.json` (câmera, notificações se PROD-05)
- [ ] `expo-notifications` adicionado se push mobile ativado (PROD-05)

### App Store Connect (iOS)
- [ ] Conta Apple Developer ativa
- [ ] App criado no App Store Connect
- [ ] Bundle ID `com.lumenchristi.lumenplus` registrado
- [ ] Certificado de distribuição provisionado (via EAS credentials)
- [ ] TestFlight configurado para distribuição interna

### Google Play Console (Android)
- [ ] Conta Google Play Console ativa
- [ ] App criado no Console
- [ ] Keystore provisionada (via EAS credentials)
- [ ] Internal Testing track configurado
- [ ] APK/AAB enviado com sucesso

### Legal
- [ ] Política de Privacidade publicada (LGPD-06)
- [ ] Privacy Nutrition Label preenchida (baseada no ROPA — LGPD-03)
- [ ] Classificação etária definida (likely: 4+/Everyone — conteúdo espiritual sem violência/conteúdo adulto)

---

## Próximos Passos (ações humanas necessárias)

1. **Elias:** Verificar se existe conta Apple Developer (`$99/ano`) — se não, criar
2. **Elias:** Verificar se existe conta Google Play Console (`$25`) — se não, criar
3. **Elias:** Instalar EAS CLI: `npm install -g eas-cli` + `eas login`
4. **Elias:** Rodar `eas init` dentro de `lumen_mobile/` para gerar EAS Project ID
5. **Designer:** Criar assets em resolução correta (icon 1024×1024, splash, adaptive-icon)
6. **Após LGPD-06:** Publicar Política de Privacidade em URL pública
7. **Após PROD-05:** Adicionar `expo-notifications` ao `app.json`
