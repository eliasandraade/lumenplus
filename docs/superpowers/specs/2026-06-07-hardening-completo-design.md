# Hardening Completo — Lumen+ (pré-lançamento)

**Data:** 2026-06-07
**Status:** Spec aprovada — pendente revisão final do usuário
**Gatilho:** Lançamento público iminente. Blindar antes de expor.
**Escopo:** Full-stack (backend FastAPI/Railway + frontend Expo/Vercel + infra/deploy). Tudo no alcance.
**Prazo:** Sem prazo fixo — qualidade acima de velocidade.

---

## Contexto e Filosofia

A base de segurança do Lumen+ **já é forte**. Esta spec NÃO reescreve o que funciona; ela fecha lacunas concretas encontradas em varredura do código real. O objetivo é defesa em profundidade antes da exposição pública.

### Baseline já sólido (não tocar)
- Verificação RS256 real de token Firebase, com rejeição explícita de prefixo `dev:` em PROD (`backend/app/auth/firebase.py`)
- AES-256-GCM + HMAC-SHA256 para CPF/RG, com fail-closed no carregamento de chaves (`backend/app/crypto/service.py`)
- Vínculo de conta por email **só em DEV** — previne account takeover por colisão de email (`backend/app/api/deps.py:92`)
- Rate limiting com Redis + fallback em memória (`backend/app/middlewares/rate_limit.py`)
- CORS restrito (não usa `*`); `validate_production_settings()` aborta o boot com config inválida (`backend/app/settings.py`)
- Sentry sem PII; exception handler global loga apenas `type(exc).__name__`, nunca `str(exc)` (`backend/app/main.py:188`)
- `.env` corretamente fora do git (só `.env.example` versionado)
- Feature flags fail-closed: `enable_dev_endpoints=False`, `debug_verification_code=False`

### Legenda de severidade
🔴 Crítico · 🟠 Alto · 🟡 Médio · 🟢 Baixo/Endurecimento

### Ordem de implementação (Abordagem A — por camada)
Cada camada é um PR independente e entregável sozinho. Severidade anotada dentro de cada camada para priorização interna.

1. **Camada 1** — Infra / Deploy / Secrets
2. **Camada 2** — Backend (FastAPI)
3. **Camada 3** — Frontend (Expo / Vercel)
4. **Camada 4** — Autorização (varredura endpoint-a-endpoint)
5. **Camada 5** — Testes automatizados de segurança

---

## Camada 1 — Infra / Deploy / Secrets

### 1.1 🟠 HSTS ausente
**Problema:** `backend/app/main.py:147` (middleware `security_headers`) não envia `Strict-Transport-Security`. Sem HSTS, um ataque man-in-the-middle pode forçar downgrade para HTTP.

**Correção:** Adicionar ao middleware:
```python
response.headers["Strict-Transport-Security"] = "max-age=63072000; includeSubDomains; preload"
```
Railway serve HTTPS, então é seguro. (HSTS sobre HTTP puro é ignorado pelo browser — sem risco em ambiente local.)

### 1.2 🟡 Auditoria de dependências não faz parte do processo
**Problema:** Não há `pip-audit` (backend) nem rotina de `npm audit` (frontend). CVEs em dependências passam despercebidos.

**Correção:**
- Backend: rodar `pip-audit` contra o ambiente, corrigir/atualizar libs com CVE conhecido.
- Frontend: rodar `npm audit`, corrigir o que for seguro (sem quebrar Expo SDK 52).
- Documentar ambos os comandos no `README` do backend e do frontend como passo recorrente pré-deploy.
- **Não** atualizar versões de libs sem CVE só por atualizar (evitar regressão no Expo).

### 1.3 🟡 Verificação de secrets de produção
**Problema:** Confirmar que os secrets no Railway são fortes e únicos. `SECRET_KEY` default é `"change-me-in-production"` (detectado pelo boot validator, mas precisa confirmação de que o valor real foi setado e é forte).

**Correção:**
- Auditar (sem expor valores em log/output) que `SECRET_KEY`, `ENCRYPTION_KEY`, `HMAC_PEPPER`, `FIREBASE_PROJECT_ID` estão setados no Railway e que `ENCRYPTION_KEY`/`HMAC_PEPPER` têm 32 bytes base64.
- Confirmar `AUTH_MODE=PROD`, `ENABLE_DEV_ENDPOINTS=false`, `DEBUG_VERIFICATION_CODE=false`, `ENVIRONMENT=production` no ambiente de produção.
- Grep no código por qualquer secret hardcoded (chaves, tokens, senhas) fora de `settings`.

### 1.4 🟢 URL de fallback obsoleta
**Problema:** `lumen_mobile/src/services/api.ts:38` tem fallback `https://api.lumenplus.app` que não corresponde ao backend real do Railway (`https://backend-production-6efc.up.railway.app`). Se `EXPO_PUBLIC_API_URL` não estiver setado no build de produção, o app aponta para um host errado/inexistente.

**Correção:** Corrigir o fallback para a URL canônica do Railway, OU garantir (e documentar) que `EXPO_PUBLIC_API_URL` é sempre obrigatório no build de produção da Vercel.

---

## Camada 2 — Backend (FastAPI)

### 2.1 🟠 Rate limiting global compartilhado para usuários Firebase
**Problema:** Em `backend/app/middlewares/rate_limit.py:84`, o `client_id` é derivado dos primeiros 20 caracteres do token (`auth[7:27]`). Para JWTs Firebase RS256, esse prefixo é o **header do JWT, idêntico em todos os tokens** (`eyJhbGciOiJSUzI1Ni...` = base64 de `{"alg":"RS256",...}`). Consequência: **todos os usuários autenticados caem no mesmo balde de rate limit** — um único usuário pode esgotar o limite de todos, e o limite per-user é inútil.

**Correção:** Derivar o `client_id` do identificador **verificado** do usuário (o `uid` do `TokenPayload`), não do prefixo do token bruto. Como o rate limit roda em middleware (antes do `Depends(get_current_user)`), as opções são:
- **Opção A (recomendada):** hashear o **token inteiro** (não só o prefixo) com SHA-256. Tokens distintos → baldes distintos. Simples, sem reordenar middleware.
- **Opção B:** mover a derivação de client_id para depois da verificação de auth (mais invasivo).

Adotar **Opção A**: `token_hash = sha256(token_completo)[:16]`. Manter o fallback por IP para requisições não autenticadas.

### 2.2 🟠 Upload sem limite de tamanho (DoS de memória)
**Problema:** `backend/app/api/retreat_routes.py:669` faz `contents = await file.read()` sem checar tamanho. Um usuário pode enviar um arquivo enorme e exaurir a memória do worker.

**Correção:**
- Definir teto (ex: `MAX_UPLOAD_BYTES = 8 * 1024 * 1024` = 8 MB).
- Validar `Content-Length` se presente; e/ou ler com limite e rejeitar (`413 Payload Too Large`) se exceder.
- Mensagem de erro inline (sem `Alert.alert` no frontend, conforme padrão do projeto).

### 2.3 🟡 Validação de upload confia em `content_type` falsificável
**Problema:** `backend/app/api/retreat_routes.py:639` valida apenas `file.content_type.startswith("image/")`. O `content_type` é enviado pelo cliente e pode ser falsificado (um arquivo arbitrário com header `image/png`).

**Correção:** Validar os **magic bytes** reais do arquivo após a leitura (assinaturas de JPEG `FF D8 FF`, PNG `89 50 4E 47`, WEBP, etc.) antes de enviar ao Cloudinary. Rejeitar com `400` se a assinatura não bater com imagem. Manter também a checagem de content-type como primeira barreira.

### 2.4 🟡 CSP ausente no backend
**Problema:** `backend/app/main.py:147` não envia `Content-Security-Policy`.

**Correção:** Como o backend é uma API JSON (não serve HTML em produção — `/docs` e `/redoc` só existem em dev), aplicar CSP restritiva:
```python
response.headers["Content-Security-Policy"] = "default-src 'none'; frame-ancestors 'none'"
```
Verificar que isso não quebra o Swagger em dev (se quebrar, aplicar CSP só fora de `is_dev` ou afrouxar apenas para as rotas de docs).

### 2.5 🟡 Sem limite global de tamanho de body
**Problema:** Qualquer endpoint aceita payloads JSON de tamanho arbitrário. Vetor de DoS.

**Correção:** Middleware que rejeita requisições com `Content-Length` acima de um teto (ex: 1 MB para JSON). Endpoints de upload multipart ficam sob o limite da Camada 2.2. Retornar `413`.

### 2.6 🟢 `X-XSS-Protection` deprecado
**Problema:** `backend/app/main.py:153` envia `X-XSS-Protection: 1; mode=block`. Esse header é **deprecado** e pode introduzir vulnerabilidades em browsers legados; a guidance moderna (OWASP) é desativá-lo e confiar em CSP.

**Correção:** Trocar para `X-XSS-Protection: 0`.

---

## Camada 3 — Frontend (Expo / Vercel)

### 3.1 🟡 Sem headers de segurança no Vercel
**Problema:** A build web servida pela Vercel não tem CSP, HSTS, `X-Frame-Options`, `X-Content-Type-Options` ou `Referrer-Policy` (não há `vercel.json` com bloco `headers`). O site web fica exposto a clickjacking e sem defesa em profundidade contra XSS.

**Correção:** Criar/ajustar `vercel.json` com bloco `headers`:
- `Strict-Transport-Security: max-age=63072000; includeSubDomains; preload`
- `X-Frame-Options: DENY`
- `X-Content-Type-Options: nosniff`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Content-Security-Policy` — **cuidado:** o app web (Expo web) precisa de `script-src`, `style-src`, `connect-src` (backend Railway, Firebase Auth, Sentry, Cloudinary), `img-src`, etc. **Estratégia:** começar com `Content-Security-Policy-Report-Only` para não quebrar o app, validar no preview que nada é bloqueado, e só então promover para `Content-Security-Policy` enforce.

**Verificação obrigatória:** rodar o app no preview após aplicar a CSP e confirmar (console + network) que login Firebase, chamadas ao backend, Sentry e upload Cloudinary continuam funcionando.

### 3.2 🟡 Tratamento de erro vaza objeto cru
**Problema:** `lumen_mobile/src/services/api.ts:112` faz `throw { response: { status, data: error } }`, propagando o corpo bruto da resposta do backend. Combinado com a proibição de `Alert.alert` na web, isso pode exibir detalhes internos ao usuário ou falhar silenciosamente.

**Correção:** Normalizar erros numa forma segura e previsível (ex: `{ status: number, message: string, code?: string }`), extraindo apenas a mensagem amigável do backend (`detail.message`). Garantir que stack traces ou estruturas internas nunca cheguem à UI.

### 3.3 🟢 Confirmar `IS_DEV_AUTH=false` em produção
**Problema:** O token DEV é guardado em AsyncStorage (= `localStorage` na web em `api.ts:13-27`), legível por XSS. Isso **só afeta o modo DEV**; produção usa Firebase SDK (IndexedDB gerenciado). Mas é preciso garantir que o build de produção nunca ative `IS_DEV_AUTH`.

**Correção:** Confirmar em `lumen_mobile/src/config/firebase.ts` que `IS_DEV_AUTH` é derivado de forma que seja sempre `false` quando as credenciais Firebase de produção estão presentes. Documentar. (Confirmação/documentação, não necessariamente mudança de código.)

### 3.4 🟢 Varredura de segredos no bundle web
**Problema:** Garantir que nenhum segredo real vaze no bundle JS público. Variáveis `EXPO_PUBLIC_*` e a config web do Firebase são **públicas por design** (não são segredos); o risco é algum segredo de backend (Cloudinary `api_secret`, SendGrid key, VAPID private) ter sido acidentalmente referenciado no código do frontend.

**Correção:** Grep no `lumen_mobile/` por nomes de segredos de backend (`api_secret`, `sendgrid`, `vapid_private`, `cloudinary_api_secret`, etc.) e confirmar que nenhum aparece. Confirmar que só `EXPO_PUBLIC_*` apropriadas são lidas.

---

## Camada 4 — Autorização (varredura endpoint-a-endpoint)

Camada de **auditoria + correção**, não apenas implementação. Método sistemático.

### Método
Para cada rota mutável (POST/PUT/PATCH/DELETE) e cada rota que retorna recurso identificado por ID, confirmar:
1. **Autenticação** — exige `CurrentUser`?
2. **Autorização** — checa role global (DEV/ADMIN/...) **ou** ownership/escopo (usuário é dono do recurso / coordenador da unidade)?

### Routers no alcance
- `admin_routes.py` / `routes/admin.py` — gestão de usuários, roles, dashboard
- `admin_retreat_routes.py` / `retreat_routes.py` — retiros, inscrições, pagamentos
- `inbox_routes.py` — avisos (escopo de envio via `_has_full_send_access`)
- `life_plan_routes.py` / `projeto_vida_mensal_routes.py` / `projeto_vida_semanal_routes.py` — **alto risco de IDOR**: dados pessoais de Projeto de Vida; confirmar que um usuário não acessa o ciclo/diagnóstico de outro por ID
- `membership_routes.py`, `channel_routes.py`, `profile_routes.py`, `verification_routes.py`, `push_routes.py`, `legal_routes.py`, `routes/export.py`

### Entregável
- Uma **matriz** (rota × método × auth × authz × veredito OK/FALHA) documentada.
- Correção de toda rota que falhar, com foco principal em **IDOR** (acesso a recurso por ID sem checar dono/escopo).
- Cada correção de remoção/alteração sensível deve gerar `AuditLog` (padrão já existente no projeto).

**Nota:** o escopo de correção desta camada só é totalmente conhecido após a varredura. A matriz é entregue primeiro; as correções derivam dela.

---

## Camada 5 — Testes Automatizados de Segurança

Suíte `pytest` no backend que trava regressões das correções. **Infra de teste já existe** (`backend/tests/conftest.py` com fixtures `client`, `auth_headers`, `admin_headers`, `secretary_headers`, `db_session`, `seeded_db`). Os testes novos reutilizam esses fixtures e seguem o padrão dos arquivos existentes.

### Arquivos de teste (novos)

| Arquivo | Cobre |
|---|---|
| `tests/test_security_auth.py` | Token `dev:` rejeitado quando `FirebaseAuth(dev_mode=False)`; header de auth ausente → 401; formato inválido → 401; conta `is_active=False` → 403 |
| `tests/test_security_headers.py` | Toda resposta contém HSTS, CSP, `X-Content-Type-Options`, `X-Frame-Options`; **não** contém header `Server`; `X-XSS-Protection` é `0` (não `1`) |
| `tests/test_security_rate_limit.py` | Dois tokens distintos → baldes de rate limit distintos (regressão direta do 2.1); exceder limite → 429 |
| `tests/test_security_upload.py` | Arquivo acima do teto → 413; content-type não-imagem → 400; magic bytes inválidos → 400 |
| `tests/test_security_body_size.py` | Payload JSON acima do teto → 413 |
| `tests/test_security_authz.py` | IDOR: usuário A não acessa recurso (ciclo de vida, inscrição de retiro) de usuário B → 403/404 — cobre achados da Camada 4 |

### Considerações de ambiente de teste
- O ambiente de teste roda `AUTH_MODE=DEV` / `ENVIRONMENT=test` (`conftest.py`). Testar "rejeição de `dev:` em PROD" exige instanciar `FirebaseAuth(dev_mode=False)` diretamente no teste, não depender do ambiente global.
- Rate limit usa fallback em memória nos testes (Redis indisponível) — testável com requisições sequenciais.
- Rodar local e adicionar ao CI (se houver pipeline; senão documentar o comando `pytest tests/test_security_*.py` como gate pré-deploy).

---

## Critérios de Aceite (todas as camadas)

- [ ] Backend envia HSTS, CSP, X-Content-Type-Options, X-Frame-Options em toda resposta; sem `Server`; `X-XSS-Protection: 0`
- [ ] Rate limit isola usuários distintos em baldes distintos
- [ ] Upload rejeita arquivos grandes (413) e não-imagens reais (400)
- [ ] Body JSON acima do teto rejeitado (413)
- [ ] `vercel.json` aplica headers de segurança; app web validado no preview sem quebra
- [ ] Erros do frontend normalizados, sem vazamento de estrutura interna
- [ ] Matriz de autorização documentada; todo IDOR encontrado corrigido
- [ ] `pip-audit` e `npm audit` rodados; CVEs acionáveis resolvidos; comandos documentados
- [ ] Secrets de produção auditados e confirmados fortes/únicos
- [ ] Suíte `tests/test_security_*.py` passa local

## Fora de escopo (registrado, não nesta spec)
- Migração de autenticação (Firebase permanece)
- Mudanças de configuração nos painéis Railway/Vercel/Firebase além de env vars (código apenas)
- Portabilidade de dados LGPD (`/auth/me/data-export`) — pendência separada já registrada
- Atualização de dependências sem CVE (evitar regressão no Expo SDK 52)
