# H0 — Hardening Audit Baseline — Relatório

**Data:** 2026-06-07
**Tipo:** Auditoria **read-only** — nenhuma alteração de código, env var ou deploy.
**Executado por:** Claude (modo Inline / executing-plans)
**Spec de referência:** [docs/superpowers/specs/2026-06-07-hardening-completo-design.md](../specs/2026-06-07-hardening-completo-design.md)
**Plano de referência:** [docs/superpowers/plans/2026-06-07-h0-hardening-audit-baseline.md](../plans/2026-06-07-h0-hardening-audit-baseline.md)

---

## Sumário executivo

A postura de segurança do Lumen+ é **boa no núcleo e fraca nas bordas**. A configuração de produção está **impecável** (9/9 verificações de env passaram, sem secrets expostos, sem secrets hardcoded ou no histórico amostrado). As lacunas concentram-se em **headers HTTP** (HSTS/CSP ausentes no backend; X-Frame-Options/CSP/nosniff/Referrer-Policy ausentes no frontend → risco de **clickjacking**) e em **dependências** (1 vulnerabilidade crítica + 22–23 altas no `npm audit`, majoritariamente atadas ao Expo SDK 52).

**Achados por severidade:** 🔴 1 (dep crítica `protobufjs`) · 🟠 4 · 🟡 5 · 🟢 5.
**Falsos positivos / confirmados OK:** env de produção, segredos, `IS_DEV_AUTH=false` em prod, HSTS no frontend (default Vercel), fallback de URL nunca usado em prod.

**Recomendação de início:** **H1 (headers de backend)** — risco ~zero, fecha HSTS+CSP. Em seguida o subconjunto de headers do frontend (anti-clickjacking, também baixo risco), depois **H2 (rate limit por usuário)**, que é o bug funcional de maior impacto.

---

## 1. Headers do backend

**Comando:** `curl -sS -D - -o /dev/null https://backend-production-6efc.up.railway.app/health` → `HTTP/1.1 200 OK`
**Backend local:** não estava rodando (`connection refused` na porta 8000). Não auditado e **não foi iniciado** (fora de escopo do H0). O middleware de headers (`backend/app/main.py:147-158`) é o mesmo para local e prod, então prod é representativo.

| Header | Alvo (hardening) | Observado em prod | Status |
|---|---|---|---|
| Strict-Transport-Security | presente | **ausente** | ❌ |
| Content-Security-Policy | presente | **ausente** | ❌ |
| X-Content-Type-Options | nosniff | `nosniff` | ✅ |
| X-Frame-Options | DENY | `DENY` | ✅ |
| Referrer-Policy | set | `strict-origin-when-cross-origin` | ✅ |
| X-XSS-Protection | `0` (ou ausente) | `1; mode=block` | ⚠️ deprecado |
| Server | ausente | `railway-hikari` | ⚠️ |

**Notas:**
- O código faz `del response.headers["server"]`, eficaz para o servidor da app (uvicorn), mas o **edge proxy do Railway** re-injeta `Server: railway-hikari`. Info disclosure menor; não removível só no código da app.
- `HEAD /health` retorna `405` (rota só aceita GET) — irrelevante; os headers de segurança são aplicados por middleware a todas as respostas.

---

## 2. Headers do frontend (Vercel)

**Comando:** `curl -sSI https://lumenplus.vercel.app/` → `HTTP/1.1 200 OK`
**`vercel.json`:** confirmado **sem bloco `headers`** (`lumen_mobile/vercel.json` só tem `buildCommand`, `outputDirectory`, `framework`, `rewrites`).

| Header | Alvo | Observado em prod | Status |
|---|---|---|---|
| Strict-Transport-Security | presente | `max-age=63072000; includeSubDomains; preload` | ✅ (default Vercel) |
| Content-Security-Policy | presente | **ausente** | ❌ |
| X-Frame-Options | DENY | **ausente** | ❌ **clickjacking** |
| X-Content-Type-Options | nosniff | **ausente** | ❌ |
| Referrer-Policy | set | **ausente** | ❌ |

**Notas:**
- HSTS já vem do default da Vercel — o item 3.1 da spec (HSTS no frontend) está **coberto**; o gap real é X-Frame-Options/CSP/nosniff/Referrer-Policy.
- `Access-Control-Allow-Origin: *` presente no HTML estático servido (típico de hosting estático; baixo risco para o shell da SPA, mas registrar).
- `Server: Vercel` exposto (info disclosure menor).

---

## 3. Variáveis de produção (Railway)

**Confirmação de contexto (Ajuste 2):** `railway whoami` → `oeliasandraade@gmail.com`; `railway status` → **Project `lumen+` · Environment `production` · Service `backend`**. Claramente produção do Lumen+ — auditoria autorizada a prosseguir.
**Método:** `railway run python <script-temporário-fora-do-repo>` imprimindo **apenas booleanos** (nunca valores). `railway variables` **não** foi usado. Script temporário removido após execução.

| Verificação | Resultado |
|---|---|
| SECRET_KEY set | ✅ PASS |
| SECRET_KEY ≠ default | ✅ PASS |
| ENCRYPTION_KEY base64 = 32 bytes | ✅ PASS |
| HMAC_PEPPER base64 = 32 bytes | ✅ PASS |
| FIREBASE_PROJECT_ID set | ✅ PASS |
| AUTH_MODE == PROD | ✅ PASS |
| ENABLE_DEV_ENDPOINTS false | ✅ PASS |
| DEBUG_VERIFICATION_CODE false | ✅ PASS |
| ENVIRONMENT == production | ✅ PASS |

**Resultado: 9/9 PASS.** Configuração de produção sólida. Nenhum valor de secret foi impresso ou registrado.

---

## 4. Fallback de API no frontend

**Método:** leitura de `lumen_mobile/src/services/api.ts:30-45` + `vercel env ls production`.

- `EXPO_PUBLIC_API_URL` → **presente em Production** (criado há ~84d). Como `getBaseUrl()` retorna `process.env.EXPO_PUBLIC_API_URL` quando definido, o fallback obsoleto `https://api.lumenplus.app` (`api.ts:38`) **nunca é usado em produção**. → Severidade rebaixada para 🟢 (limpeza de código).
- `EXPO_PUBLIC_FIREBASE_API_KEY` → **presente em Production**. Como `IS_DEV_AUTH = !process.env.EXPO_PUBLIC_FIREBASE_API_KEY` (`firebase.ts:19`), o build de produção tem **`IS_DEV_AUTH=false`** → o caminho de token DEV via AsyncStorage **nunca está ativo em prod**. → Item 3.3 da spec **confirmado seguro** ✅.
- Env vars da Vercel: todas exibidas como `Encrypted` (CLI não revela valores). Apenas variáveis `EXPO_PUBLIC_*` (públicas por design) — nenhum secret de backend presente.

---

## 5. Grep de segredos

| Verificação | Resultado |
|---|---|
| Frontend (`src/` + `app/`) referencia secrets de backend? | **Não** — 0 matches para `api_secret`, `cloudinary_api_secret`, `sendgrid`, `vapid_private`, `SECRET_KEY`, `HMAC_PEPPER`, `ENCRYPTION_KEY`, `private_key`, `service_account` ✅ |
| `process.env.*` no frontend usa só `EXPO_PUBLIC_*`? | **Sim** — todos `EXPO_PUBLIC_*` + `process.env.PORT` em `server.js` (wrapper de serve, normal) ✅ |
| Backend (`app/`) tem secret hardcoded? | **Não** — 0 matches para padrão `(secret\|password\|api_key\|token)=<16+ chars>` ✅ |
| Histórico git (amostragem **leve**) | Nenhum `.env` rastreado em commit; nenhum marcador `BEGIN PRIVATE KEY`/`AKIA`/`-----BEGIN` (único match foi o texto do próprio plano H0) ✅ |

> **Ajuste 3 — escopo do histórico:** isto foi uma **amostragem leve** (grep de markers no HEAD + busca de `.env` no log), **não** uma auditoria profunda de todo o histórico. Uma varredura completa com **gitleaks** ou **trufflehog** fica recomendada para fase posterior, se houver necessidade.

---

## 6. Auditoria de dependências (modo relatório)

> Modo relatório apenas. **`npm audit fix` NÃO foi executado. Nenhuma dependência foi atualizada ou instalada.**

### Frontend (`npm audit`)

| Escopo | Total | Moderate | High | Critical |
|---|---|---|---|---|
| `--omit=dev` (runtime/produção) | **41** | 18 | 22 | 1 |
| completo (runtime + dev/build) | **42** | 18 | 23 | 1 |

→ A diferença (1 high) está **somente** em dependências de dev/build.

- **🔴 Crítica:** `protobufjs` (transitiva — tipicamente via stack Firebase/Google).
- **🟠 Altas notáveis (runtime-relevantes):** `undici`, `node-forge`, `@xmldom/xmldom`, `tar`, `minimatch`, `fast-uri`, `flatted`, `cacache`.
- **Altas atadas ao Expo SDK 52** (fix = breaking, `expo@56`): `@expo/cli`, `@expo/config`, `@expo/metro-config`, `expo`, `expo-router`, `expo-auth-session`, `expo-asset`, `expo-constants`, `expo-linking`, `expo-splash-screen`, etc.
- `uuid <11.1.1` (moderate) e `ws 8.x` (moderate, divulgação de memória) também presentes.

**Implicação:** boa parte das vulns só se resolve atualizando o Expo SDK (mudança breaking) — alinhado à decisão da spec de **não atualizar deps sem CVE acionável e evitar regressão no Expo 52**. Triagem caso-a-caso fica para **H5**.

### Backend (`pip-audit`)

- **`pip-audit` NÃO está instalado** (confirmado em `command -v pip-audit` → ausente). **Não foi instalado** (regra: não instalar sem aprovação).
- Inventário read-only: **54 pacotes** no `backend/.venv`.
- **Pendente:** varredura de CVE do backend. Proposta para fase posterior (com aprovação): instalar `pip-audit` **no venv do projeto** (`backend/.venv/Scripts/python -m pip install pip-audit`), **nunca global**. Alternativa efêmera: `pipx run pip-audit`.

---

## 7. Consumidores de erro no frontend (pré-trabalho para H4)

**Contrato canônico do backend** (documentado em `src/utils/error.ts`): `{ detail: { error: string, message: string, field?: string } }`; validação Pydantic vem como `{ detail: [{ loc, msg, type }] }`.

**Helper seguro já existe:** `parseApiError(error, fallback)` em `lumen_mobile/src/utils/error.ts:48` extrai **apenas** a mensagem legível (trata os 3 formatos). Também há `isApiError()` e `getApiErrorStatus()`.

**Forma lançada pelo ApiClient:** `api.ts:112` faz `throw { response: { status, data: error } }` — exatamente o shape que `parseApiError` espera.

**Adoção:** **26 arquivos** acessam `err.response?.data?.detail` **diretamente** (em vez de usar `parseApiError`). Telas sensíveis entre os consumidores:
- `app/(auth)/login.tsx`, `register.tsx`, `verify-phone.tsx`, `verify-email.tsx`
- `app/(onboarding)/verify-phone.tsx`, `profile.tsx`, `complete-documents.tsx` (documentos CPF/RG)
- `app/retreats/[id].tsx`, `app/retreats/[id]/payment.tsx` (comprovante de pagamento)
- `app/members.tsx` (convite/papel), `app/admin/**` (gestão)
- `app/vida/wizard.tsx`, `app/vida/semanal.tsx` → **Projeto de Vida — fora de escopo de alteração**

**Avaliação do risco real (item 3.2 da spec):** **BAIXO**. O backend só retorna mensagens curadas (`detail.message`); o handler global de exceções devolve `500` genérico ("Erro interno do servidor") sem stack trace ou PII. Logo, não há vazamento ativo de internals hoje — o item 3.2 é mais sobre **consistência/robustez** (padronizar no `parseApiError`) do que correção de vazamento.

**⚠️ Restrição obrigatória para H4:** qualquer mudança em `api.ts` **deve preservar o contrato `{ response: { status, data } }`** (ou migrar os 26 consumidores simultaneamente). Caso contrário, quebra telas em massa — inclusive `app/vida/*`, que **não pode ser tocado**.

**Observação adicional (não-segurança):** `app/admin/approvals/index.tsx:68,90` ainda usa `Alert.alert` — resíduo que viola a regra "Alert.alert proibido na web" do projeto. Registrado para limpeza futura; fora do escopo de hardening.

---

## 8. Riscos por severidade (consolidado)

| Sev | Achado | Evidência | Item spec | Confirmação |
|---|---|---|---|---|
| 🔴 | Dependência crítica `protobufjs` | `npm audit` | 1.2 | Confirmado (audit) |
| 🟠 | Frontend sem `X-Frame-Options` → clickjacking | curl Vercel | 3.1 | Confirmado (audit) |
| 🟠 | Backend sem HSTS | curl prod | 1.1 | Confirmado (audit) |
| 🟠 | `npm audit`: 22–23 vulns high | `npm audit` | 1.2 | Confirmado (audit) |
| 🟠 | Rate limit compartilhado entre usuários Firebase | `rate_limit.py:84` | 2.1 | Confirmado por **leitura de código** (não testado dinamicamente em H0) |
| 🟠 | Upload sem limite de tamanho (DoS memória) | `retreat_routes.py:669` | 2.2 | Confirmado por **leitura de código** |
| 🟡 | Backend sem CSP | curl prod | 2.4 | Confirmado (audit) |
| 🟡 | Frontend sem CSP / nosniff / Referrer-Policy | curl Vercel | 3.1 | Confirmado (audit) |
| 🟡 | Upload valida `content_type` falsificável | `retreat_routes.py:639` | 2.3 | Confirmado por **leitura de código** |
| 🟡 | Sem limite global de body JSON | `main.py` (ausência) | 2.5 | Confirmado por **leitura de código** |
| 🟡 | CVE do backend desconhecido (`pip-audit` não rodado) | ferramenta ausente | 1.2 | Pendente |
| 🟢 | `X-XSS-Protection: 1` deprecado | curl prod | 2.6 | Confirmado (audit) |
| 🟢 | Header `Server` exposto (railway-hikari / Vercel) | curl | — | Confirmado (audit) |
| 🟢 | Fallback de URL obsoleto em `api.ts` | `api.ts:38` + vercel env | 1.4 | Confirmado — nunca usado em prod |
| 🟢 | Consistência de tratamento de erro | `error.ts` + 26 consumidores | 3.2 | Confirmado — risco de vazamento baixo |

---

## 9. Proposta de subfases H1–H5 (ajustada aos achados reais)

Cada subfase = 1 PR independente. Ordem otimizada por **risco de regressão crescente** e impacto.

| Subfase | Escopo | Itens spec | Risco regressão | Prioridade |
|---|---|---|---|---|
| **H1 — Headers do backend** | Adicionar HSTS + CSP (`default-src 'none'; frame-ancestors 'none'`) ; trocar `X-XSS-Protection` para `0`. Validar que `/docs` (dev) não quebra. | 1.1, 2.4, 2.6 | **Baixo** (header-only) | **1ª — começar aqui** |
| **H2 — Headers do frontend (anti-clickjacking)** | `vercel.json` → bloco `headers`: `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy`. CSP entra como `Content-Security-Policy-Report-Only` primeiro, validada no preview, só depois enforce. | 3.1 | **Baixo-Médio** (CSP exige validação no preview) | 2ª |
| **H3 — Rate limit por usuário** | Corrigir `_get_client_id`: hashear o **token completo** (não o prefixo de 20 chars, que é idêntico em todo JWT Firebase). Manter fallback por IP para não autenticados. | 2.1 | **Médio** (testar 429; não regredir multi-instância) | 3ª — maior impacto funcional |
| **H4 — Upload + body size + erros frontend** | Backend: limite de tamanho de upload (413) + validação magic-bytes + limite global de body JSON. Frontend: padronizar consumidores em `parseApiError` **preservando** o contrato `{ response: { status, data } }`; remover fallback de URL obsoleto. **Não tocar `app/vida/*`.** | 2.2, 2.3, 2.5, 3.2, 1.4 | **Médio-Alto** (26 consumidores + validar retiro/preview) | 4ª |
| **H5 — Autorização + dependências + testes** | Varredura IDOR endpoint-a-endpoint (foco em Projeto de Vida/retiros). Triagem do `npm audit` (crítica `protobufjs` + altas; o que dá sem quebrar Expo 52). Instalar `pip-audit` no venv e rodar. Suíte `tests/test_security_*.py`. | Camada 4, 1.2, Camada 5 | **Variável** (definido pela matriz IDOR) | 5ª |

**Desvios em relação à proposta original do plano:**
- A proposta original juntava todos os headers de frontend em H4; H0 mostrou que o gap de **clickjacking é 🟠** e a correção é de baixo risco → **promovido a H2 próprio** (headers do frontend), separado da normalização de erro (que é mais arriscada).
- A config de produção **não precisou de subfase de emergência** (9/9 PASS), liberando H1 para ser puramente headers.
- O risco de vazamento de erro (3.2) foi rebaixado de "vazamento" para "consistência" — dimensiona o esforço de H4.

---

## Apêndice — Falsos positivos, confirmações OK e ferramentas ausentes

### Confirmados OK (não são problemas)
- **Config de produção:** 9/9 env vars corretas; secrets fortes; sem default.
- **Segredos:** nenhum hardcoded no código; nenhum no histórico amostrado; frontend não referencia secrets de backend.
- **`IS_DEV_AUTH=false` em produção** — caminho de token DEV/AsyncStorage inativo em prod (item 3.3 seguro).
- **HSTS no frontend** — presente via default da Vercel (item 3.1-HSTS coberto).
- **Fallback de URL** — obsoleto no código, mas inalcançável em prod (`EXPO_PUBLIC_API_URL` setado).
- Matches de `md5` em greps anteriores: só em `node_modules`/lockfiles (falsos positivos).

### Ferramentas
- **Instaladas:** `railway`, `npm`, `node`, `vercel`, `curl`, `python`.
- **Ausente:** `pip-audit` → varredura de CVE do backend **pendente**. Proposta (com aprovação, fase posterior): instalar **no `.venv` do projeto**, nunca global.
- **Recomendadas para fase posterior:** `gitleaks` ou `trufflehog` para auditoria profunda de histórico git (H0 fez só amostragem leve).

### Limites de escopo desta auditoria
- H0 **não** testou dinamicamente os achados de rate limit / upload / body size (confirmados por leitura de código durante o planejamento). A validação dinâmica ocorre nas respectivas subfases via testes (Camada 5 / H5).
- Backend local não foi iniciado (e não deveria ser, em H0). Headers auditados só em produção.
- **CP7 / CP7.1 / CP8 / CP8.1 / Projeto de Vida não foram alterados** e estão fora do escopo de qualquer correção proposta.
