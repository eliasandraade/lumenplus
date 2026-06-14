# SEC-01 — Plano de Ativação de CSP Enforced

**Data:** 2026-06-14  
**Status atual:** `Content-Security-Policy-Report-Only` (sem enforcement)  
**Próximo passo:** Testar enforced em staging antes de produção

---

## Estado Atual (auditado em 2026-06-14)

**Arquivo:** `lumen_mobile/vercel.json`

**Mudança neste PR:**
- Adicionado `https://backend-staging.up.railway.app` ao `connect-src`
- Mantido `Content-Security-Policy-Report-Only` (sem enforcement)

**CSP atual (completa):**
```
default-src 'self';
script-src 'self' 'unsafe-inline' 'unsafe-eval' blob:;
style-src 'self' 'unsafe-inline';
img-src 'self' data: blob: https:;
font-src 'self' data:;
connect-src 'self'
  https://backend-production-6efc.up.railway.app
  https://backend-staging.up.railway.app          ← adicionado neste PR
  https://api.lumenplus.app
  https://*.googleapis.com
  https://*.firebaseio.com
  https://*.firebaseapp.com
  https://*.google.com
  https://*.gstatic.com
  https://*.sentry.io
  https://*.ingest.sentry.io
  https://*.cloudinary.com;
media-src 'self' blob: data: https:;
frame-src 'self' https://*.firebaseapp.com https://*.google.com;
worker-src 'self' blob:;
frame-ancestors 'none';
base-uri 'self';
form-action 'self'
```

---

## Por que `unsafe-inline` e `unsafe-eval` são necessários

**React Native Web / Expo** exige `unsafe-inline` e `unsafe-eval` porque:
- O Metro bundler gera scripts inline durante o build
- `__webpack_require__` e similares usam eval para módulos dinâmicos
- Remover essas diretivas quebra o app completamente

Isso é um trade-off aceito de toda a indústria para apps React Native Web. Nonce-based CSP requereria mudança de arquitetura de build (não viável no Ciclo 2).

---

## Plano para Ativar CSP Enforced

### Pré-requisito: Staging isolado funcionando

Antes de testar CSP enforced:
- [ ] Railway backend-staging funcionando
- [ ] Vercel Preview com `EXPO_PUBLIC_API_URL = https://backend-staging.up.railway.app`
- [ ] Login Firebase funcional em staging

### Passo 1 — Testar Report-Only em staging

O staging já carrega com a CSP atual em Report-Only. **Abrir DevTools → Console** e verificar:
- [ ] Nenhum erro de CSP ao fazer login
- [ ] Nenhum erro de CSP ao fazer upload de foto
- [ ] Nenhum erro de CSP ao receber push notification
- [ ] Nenhum erro de CSP ao navegar pelo app

Se aparecerem erros: adicionar a URL/fonte ao CSP antes de enforced.

### Passo 2 — Criar ambiente de teste com CSP enforced

**Opção A:** Vercel Environment Variable override (recomendado)
- Criar variável `VERCEL_HEADER_CSP_ENFORCED = true` no Vercel Dashboard para branch staging
- Usar `vercel.json` condicional (requer lógica de build)

**Opção B:** Trocar header temporariamente para teste
- Criar branch `test/csp-enforced` com `Content-Security-Policy` (sem `-Report-Only`)
- Deploy em Vercel Preview
- Testar todos os fluxos
- Reverter após validação

**Opção B é mais simples** — criar uma branch de curta duração só para validação.

### Passo 3 — Smoke tests com CSP enforced

Testar todos os fluxos críticos com DevTools → Network e Console abertos:
- [ ] Login com Google (Firebase popup)
- [ ] Login com e-mail/senha
- [ ] Navegação pelo app
- [ ] Carregar foto de perfil
- [ ] Upload de foto de perfil (Cloudinary)
- [ ] Push notification (requer PROD-01 ativado)
- [ ] Sentry: forçar um erro e verificar que chega no dashboard
- [ ] Zero erros de CSP no console

### Passo 4 — Ativar em produção

Após validação completa em staging:

```
Arquivo: lumen_mobile/vercel.json
Mudança: "Content-Security-Policy-Report-Only" → "Content-Security-Policy"
```

Deploy automático via Vercel após merge para `main`.

---

## Riscos ao Ativar Enforced

| Risco | Análise | Mitigação |
|-------|---------|-----------|
| Firebase popup bloqueado | `frame-src *.firebaseapp.com *.google.com` já está | Testar login em staging enforced |
| Sentry bloqueado | `connect-src *.sentry.io *.ingest.sentry.io` já está | Verificar eventos Sentry em staging |
| Cloudinary upload bloqueado | `connect-src *.cloudinary.com` já está | Testar upload em staging enforced |
| Service Worker bloqueado | `worker-src 'self' blob:` já está | Testar push em staging enforced |
| URL de backend nova não mapeada | backend-staging adicionado neste PR | OK |
| `unsafe-eval` bloqueado eventualmente | React Native Web exige | Não remover — aceitar trade-off |

---

## Blocker atual

**CSP enforced não pode ser ativado antes de:**
1. Staging isolado funcionando (Railway backend-staging)
2. Smoke tests completos em staging com CSP enforced
