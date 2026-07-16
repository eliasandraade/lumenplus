# SEC-01 — CSP: Enforced em Staging (host-conditional)

- **Data:** 2026-06-14 (atualizado 2026-07-16)
- **Arquivo:** `lumen_mobile/vercel.json`
- **Status atual:** **enforced** no host de staging + `Report-Only` em produção e demais hosts
- **Próximo passo:** validar no browser após deploy da branch `staging`; depois avaliar enforced em produção

---

## Mudança SEC-01 (2026-07-16)

- CSP **enforced** (`Content-Security-Policy`) aplicada **apenas ao host de staging** (`^lumenplus-git-staging-.*\.vercel\.app$`) via condição `has` de host do Vercel.
- Produção e demais hosts continuam em `Content-Security-Policy-Report-Only` (via condição `missing` do mesmo host).
- Cabeçalhos comuns (`X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`) aplicados a **todos** os hosts.
- Removido host **morto** `https://api.lumenplus.app` do `connect-src` (não resolve — HTTP 000 em 2026-07-16).
- `connect-src` usa o host real de staging `https://backend-staging-staging-3d47.up.railway.app`.

> **Por que host-conditional:** o Vercel aplica os `headers` do `vercel.json` de forma estática (mesma config para todos os deploys); não há como diferenciar header por branch git diretamente. A forma suportada de diferenciar por ambiente é por **host** (`has`/`missing`), casando o alias de preview da branch `staging`.

---

## CSP aplicada (mesmo valor em staging enforced e prod report-only)

```
default-src 'self';
script-src 'self' 'unsafe-inline' 'unsafe-eval' blob:;
style-src 'self' 'unsafe-inline';
img-src 'self' data: blob: https:;
font-src 'self' data:;
connect-src 'self'
  https://backend-production-6efc.up.railway.app
  https://backend-staging-staging-3d47.up.railway.app
  https://*.googleapis.com https://*.firebaseio.com https://*.firebaseapp.com
  https://*.google.com https://*.gstatic.com
  https://*.sentry.io https://*.ingest.sentry.io
  https://*.cloudinary.com;
media-src 'self' blob: data: https:;
frame-src 'self' https://*.firebaseapp.com https://*.google.com;
worker-src 'self' blob:;
frame-ancestors 'none'; base-uri 'self'; form-action 'self'
```

---

## Por que `unsafe-inline` e `unsafe-eval` são necessários

React Native Web / Expo exige `unsafe-inline` e `unsafe-eval`:
- O Metro bundler gera scripts inline durante o build.
- Módulos dinâmicos usam `eval`.
- Remover essas diretivas quebra o app.

Trade-off aceito para apps RN Web. CSP com nonce exigiria mudança de arquitetura de build (fora do escopo do Ciclo 2).

---

## Validação obrigatória ANTES de considerar produção enforced

> ⚠️ A config só passa a valer quando a branch `staging` é redeployada no Vercel com este `vercel.json`. **Este PR permanece em Draft** até a validação abaixo (passo de browser).

Deploy da branch `staging` e, no browser (DevTools → Console), confirmar **zero violações de CSP** em:

- [ ] Login com e-mail/senha
- [ ] Login com Google (popup Firebase)
- [ ] Navegação geral pelo app
- [ ] Carregar e fazer upload de foto de perfil (Cloudinary)
- [ ] Service Worker registrado + push (PROD-01)
- [ ] Sentry recebe um erro forçado
- [ ] Nenhuma request de staging para produção

Se aparecer violação: adicionar a fonte à diretiva correspondente e re-testar.

---

## Produção enforced (passo futuro, após staging verde)

Trocar o bloco `missing`-host de `Content-Security-Policy-Report-Only` para `Content-Security-Policy` (enforced), ou remover a diferenciação e enforçar globalmente.

**Rollback:** reverter `vercel.json` para `Content-Security-Policy-Report-Only` — o Vercel redeploya automaticamente no merge. Rollback = um commit + redeploy.

---

## Riscos ao ativar enforced

| Risco | Análise | Mitigação |
|-------|---------|-----------|
| Firebase popup bloqueado | `frame-src *.firebaseapp.com *.google.com` presente | Testar login em staging enforced |
| Sentry bloqueado | `connect-src *.sentry.io *.ingest.sentry.io` presente | Forçar erro e checar dashboard |
| Cloudinary upload bloqueado | `connect-src *.cloudinary.com` presente | Testar upload |
| Service Worker bloqueado | `worker-src 'self' blob:` presente | Testar push |
| `unsafe-eval` necessário | RN Web exige | Não remover — trade-off aceito |
| Host de staging não casa o regex | alias `lumenplus-git-staging-*.vercel.app` | Ajustar regex se o alias mudar |
