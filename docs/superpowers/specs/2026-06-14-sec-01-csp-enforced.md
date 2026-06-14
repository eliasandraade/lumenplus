# SEC-01 — CSP Frontend Enforced

**Data:** 2026-06-14 | **Prioridade:** P1 | **Depende de staging:** Sim

---

## Estado Atual (auditado)

`lumen_mobile/vercel.json` tem o header:
```
Content-Security-Policy-Report-Only: default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' blob:; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https:; font-src 'self' data:; connect-src 'self' https://backend-production-6efc.up.railway.app ... https://*.sentry.io ...; media-src 'self' blob: data: https:; frame-src 'self' https://*.firebaseapp.com https://*.google.com; worker-src 'self' blob:; frame-ancestors 'none'; base-uri 'self'; form-action 'self'
```

**Report-Only = sem bloqueio real.** O header existe mas não protege contra nada.

---

## Problema

CSP em Report-Only não bloqueia injeção de scripts maliciosos. Qualquer XSS no frontend pode exfiltrar tokens Firebase, dados de usuário e fazer requests autenticadas.

---

## Objetivo

Ativar `Content-Security-Policy` (enforced) sem quebrar:
- Login Firebase (popup OAuth, `frame-src`)
- Sentry (error tracking, `connect-src`)
- Cloudinary (upload de imagens, `connect-src`)
- Service Worker (web push, `worker-src`)
- Expo/React Native Web (`unsafe-inline`, `unsafe-eval` — necessários)

---

## Escopo

- Alterar o header em `lumen_mobile/vercel.json`
- Validar todas as funcionalidades críticas em staging antes de prod
- Remover o `-Report-Only` suffix

## Fora de Escopo

- Remover `unsafe-inline` e `unsafe-eval` (React Native Web os exige; remoção quebraria o app)
- Implementar nonce-based CSP (requer mudança de arquitetura de build)

---

## Dependências

- **Staging isolado funcionando** (EXPO_PUBLIC_API_URL correto + backend-staging operacional)
- Testes manuais no staging antes de enforced em produção

---

## Riscos

| Risco | Probabilidade | Mitigação |
|-------|---------------|-----------|
| Firebase popup bloqueado por `frame-src` | Média | `frame-src *.firebaseapp.com *.google.com` já está na CSP atual |
| Sentry bloqueado | Baixa | `connect-src *.sentry.io *.ingest.sentry.io` já está |
| Cloudinary bloqueado | Baixa | `connect-src *.cloudinary.com` já está |
| URL do backend staging não na CSP | Média | Precisamos adicionar URL do backend-staging na `connect-src` |

---

## Plano de Implementação

### Passo 1 — Adicionar URL staging à CSP (fazer agora, sem risco)
No `vercel.json`, adicionar `https://backend-staging.up.railway.app` ao `connect-src` mantendo Report-Only.

### Passo 2 — Validar em staging com CSP enforced
Trocar `-Report-Only` para enforced **apenas no staging** (arquivo de config de staging se houver, ou via env var Vercel).

### Passo 3 — Smoke tests em staging
- [ ] Login Firebase funciona (sem bloqueio de popup)
- [ ] Sentry captura erros (verificar rede)
- [ ] Upload de imagem funciona (Cloudinary)
- [ ] Push notification web funciona (Service Worker)
- [ ] Nenhum erro CSP no console em uso normal

### Passo 4 — Enforced em produção
Após validação em staging, trocar o header em `vercel.json` na branch `main`.

---

## Plano de Testes

```bash
# Após deploy em staging com CSP enforced:
# 1. Abrir DevTools > Console → zero erros de CSP em uso normal
# 2. Abrir DevTools > Network → nenhum request bloqueado
# 3. Testar login → sucesso
# 4. Testar upload de foto de perfil → sucesso
# 5. Testar que erros chegam no Sentry dashboard
```

---

## Critérios de Aceite

- `Content-Security-Policy` enforced em prod (sem `-Report-Only`)
- Zero erros de CSP no console em fluxo normal
- Login Firebase funcional
- Sentry recebendo eventos
- Push web funcional (após PROD-01)

## Rollback

Reverter `vercel.json` para `-Report-Only`. Deploy automático Vercel.

---

## Classificação

- **Depende de staging:** ✅ Sim — validação obrigatória antes de enforced em prod
- **Bloqueia App Store/Play Store:** Não diretamente (mas é P1 antes de lançamento público)
- **Implementável via código:** ✅ Sim — mudança mínima em `vercel.json`
- **Depende de decisão humana:** Não
