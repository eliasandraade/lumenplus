# H0 — Hardening Audit Baseline — Plano de Execução

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recomendado) ou superpowers:executing-plans para executar este plano tarefa-a-tarefa. Os passos usam checkbox (`- [ ]`) para rastreamento.

**Goal:** Levantar o estado real de segurança do Lumen+ (backend, frontend, infra, dependências) **sem alterar comportamento**, produzindo um relatório com achados confirmados, falsos positivos, riscos por severidade e proposta de subfases H1–H5.

**Architecture:** Fase de **auditoria read-only**. Nenhum código, env var ou deploy é alterado. Cada tarefa coleta evidência via comandos de inspeção (curl, grep, leitura de arquivos, `railway run` para presença de env vars) e registra achados num relatório único. Esta fase NÃO escreve código de produção — portanto **não segue o ciclo TDD** (test→implement→commit); o ciclo é coletar→verificar→registrar.

**Tech Stack:** FastAPI (Railway), Expo/React Native web (Vercel), Firebase Auth, PostgreSQL/Redis. Ferramentas de auditoria: `curl`, `railway` CLI, `npm audit`, `pip-audit` (a instalar no venv), Grep/Read.

---

## Regras invioláveis (todas as tarefas)

- ❌ NÃO alterar código.
- ❌ NÃO alterar env vars.
- ❌ NÃO fazer deploy.
- ❌ NÃO imprimir valores de secrets (apenas presença/formato/comprimento).
- ❌ NÃO rodar `npm audit fix`.
- ❌ NÃO atualizar dependências.
- ❌ NÃO usar `railway variables` (lista valores de secrets) — usar `railway run` com snippet que imprime só booleanos.
- ❌ NÃO mexer em CP7 / CP8 / Projeto de Vida (módulos `life_plan`, `projeto_vida_*`).
- ⚠️ Se uma ferramenta não estiver instalada: registrar no relatório e propor instalação **no venv local do projeto** (nunca global) — não instalar sem aprovação.

---

## Estado já confirmado durante o planejamento (não re-investigar, só validar)

- `lumen_mobile/vercel.json` **existe mas NÃO tem bloco `headers`** → frontend sem CSP/HSTS/X-Frame-Options.
- `lumen_mobile/src/config/firebase.ts:19` → `IS_DEV_AUTH = !process.env.EXPO_PUBLIC_FIREBASE_API_KEY`. Logo, basta `EXPO_PUBLIC_FIREBASE_API_KEY` estar setado no build Vercel para `IS_DEV_AUTH=false`.
- `lumen_mobile/src/services/api.ts:38` → fallback de URL é `https://api.lumenplus.app` (≠ Railway real `backend-production-6efc.up.railway.app`).
- Ferramentas instaladas: `railway`, `npm`, `node`, `vercel`, `curl`, `python`. **`pip-audit` NÃO instalado.**
- URLs canônicas: backend prod `https://backend-production-6efc.up.railway.app`; frontend prod `https://lumenplus.vercel.app`; backend local `http://localhost:8000`.

---

## Estrutura de arquivos

**Criar (único artefato desta fase):**
- `docs/superpowers/audits/2026-06-07-h0-hardening-audit-report.md` — relatório consolidado.

**Ler (sem modificar):**
- `backend/app/main.py`, `backend/app/settings.py`, `backend/app/middlewares/rate_limit.py`
- `lumen_mobile/vercel.json`, `lumen_mobile/src/config/firebase.ts`, `lumen_mobile/src/services/api.ts`
- `backend/.env.example`, `lumen_mobile/.env.example`

Nenhum arquivo de código é criado ou modificado.

---

### Task 0: Preparar o relatório e o diretório

**Files:**
- Create: `docs/superpowers/audits/2026-06-07-h0-hardening-audit-report.md`

- [ ] **Step 1: Criar o diretório de auditorias**

Run:
```bash
mkdir -p "docs/superpowers/audits"
```
Expected: diretório criado (ou já existente, sem erro).

- [ ] **Step 2: Criar o esqueleto do relatório**

Escrever em `docs/superpowers/audits/2026-06-07-h0-hardening-audit-report.md`:
```markdown
# H0 — Hardening Audit Baseline — Relatório

**Data:** 2026-06-07
**Tipo:** Auditoria read-only (nenhuma alteração de código/env/deploy)
**Spec de referência:** docs/superpowers/specs/2026-06-07-hardening-completo-design.md

## Sumário executivo
_(preenchido na Task 9)_

## 1. Headers do backend
## 2. Headers do frontend (Vercel)
## 3. Variáveis de produção
## 4. Fallback de API no frontend
## 5. Grep de segredos
## 6. Auditoria de dependências
## 7. Consumidores de erro no frontend
## 8. Riscos por severidade
## 9. Proposta de subfases H1–H5
## Apêndice: falsos positivos e ferramentas ausentes
```

- [ ] **Step 3: Commit do esqueleto**

```bash
git add docs/superpowers/audits/2026-06-07-h0-hardening-audit-report.md
git commit -m "docs(h0): esqueleto do relatório de audit baseline"
```

---

### Task 1: Headers do backend (produção + local)

**Files:**
- Modify: `docs/superpowers/audits/2026-06-07-h0-hardening-audit-report.md` (seção 1)

- [ ] **Step 1: Coletar headers de produção**

Run:
```bash
curl -sSI https://backend-production-6efc.up.railway.app/health
```
Expected: status `200` e bloco de headers. Procurar por: `Strict-Transport-Security`, `Content-Security-Policy`, `X-Content-Type-Options`, `X-Frame-Options`, `X-XSS-Protection`, `Server`.

- [ ] **Step 2: Coletar headers locais (se o backend local estiver rodando)**

Run:
```bash
curl -sSI http://localhost:8000/health
```
Expected: se o servidor local estiver no ar, mesmos headers. Se conexão recusada, **registrar "backend local não rodando — auditado apenas prod"** e seguir (NÃO subir o servidor — fora de escopo do H0).

- [ ] **Step 3: Registrar a matriz de headers do backend**

Na seção 1 do relatório, preencher uma tabela:

| Header | Esperado (alvo) | Prod | Local |
|---|---|---|---|
| Strict-Transport-Security | presente | ? | ? |
| Content-Security-Policy | presente | ? | ? |
| X-Content-Type-Options | nosniff | ? | ? |
| X-Frame-Options | DENY | ? | ? |
| X-XSS-Protection | `0` (alvo) ou ausente | ? | ? |
| Server | ausente (removido) | ? | ? |

Marcar cada célula com ✅/❌ e o valor observado. (Referência do código atual: `backend/app/main.py:147-158`.)

- [ ] **Step 4: Commit**

```bash
git add docs/superpowers/audits/2026-06-07-h0-hardening-audit-report.md
git commit -m "docs(h0): headers do backend (prod + local)"
```

---

### Task 2: Headers do frontend (Vercel)

**Files:**
- Modify: `docs/superpowers/audits/2026-06-07-h0-hardening-audit-report.md` (seção 2)

- [ ] **Step 1: Coletar headers da home web em produção**

Run:
```bash
curl -sSI https://lumenplus.vercel.app/
```
Expected: status `200`/`304`. Procurar por: `Strict-Transport-Security`, `Content-Security-Policy` (ou `Content-Security-Policy-Report-Only`), `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`.

- [ ] **Step 2: Confirmar `vercel.json` não tem headers**

Run:
```bash
cat lumen_mobile/vercel.json
```
Expected: confirma ausência do bloco `"headers"` (já conhecido). Notar que a Vercel injeta `Strict-Transport-Security` por padrão em alguns casos — registrar o que o curl do Step 1 realmente mostrou, não suposições.

- [ ] **Step 3: Registrar a matriz de headers do frontend**

Seção 2: tabela header × observado (prod) × alvo. Indicar quais faltam.

- [ ] **Step 4: Commit**

```bash
git add docs/superpowers/audits/2026-06-07-h0-hardening-audit-report.md
git commit -m "docs(h0): headers do frontend (Vercel)"
```

---

### Task 3: Variáveis de produção (sem expor secrets)

**Files:**
- Modify: `docs/superpowers/audits/2026-06-07-h0-hardening-audit-report.md` (seção 3)

> ⚠️ **CRÍTICO:** o snippet abaixo imprime APENAS booleanos e comprimentos. NUNCA imprimir os valores. NÃO usar `railway variables`.

- [ ] **Step 1: Auditar env vars de produção via `railway run`**

Salvar o snippet abaixo num arquivo temporário **fora do repo** (`/tmp/h0_envcheck.py`, NÃO commitar) e executá-lo via `railway run`, que injeta as env vars de produção no processo sem expor valores. O snippet imprime apenas booleanos:

```python
import os, base64

def is_b64_32(v: str) -> bool:
    if not v:
        return False
    try:
        return len(base64.b64decode(v)) == 32
    except Exception:
        return False

checks = {
    "SECRET_KEY set":            bool(os.getenv("SECRET_KEY")),
    "SECRET_KEY not default":    "change-me" not in (os.getenv("SECRET_KEY") or "") and "troque" not in (os.getenv("SECRET_KEY") or ""),
    "ENCRYPTION_KEY b64x32":     is_b64_32(os.getenv("ENCRYPTION_KEY") or ""),
    "HMAC_PEPPER b64x32":        is_b64_32(os.getenv("HMAC_PEPPER") or ""),
    "FIREBASE_PROJECT_ID set":   bool(os.getenv("FIREBASE_PROJECT_ID")),
    "AUTH_MODE == PROD":         (os.getenv("AUTH_MODE") == "PROD"),
    "ENABLE_DEV_ENDPOINTS false":(os.getenv("ENABLE_DEV_ENDPOINTS","").lower() in ("false","0","")),
    "DEBUG_VERIFICATION_CODE false":(os.getenv("DEBUG_VERIFICATION_CODE","").lower() in ("false","0","")),
    "ENVIRONMENT == production": (os.getenv("ENVIRONMENT") == "production"),
}
for k, v in checks.items():
    print(f"{'PASS' if v else 'FAIL'}  {k}")
```

Run:
```bash
cd backend && railway run python /tmp/h0_envcheck.py ; cd ..
```
Expected: 9 linhas `PASS`/`FAIL`, **sem nenhum valor de secret**. Se `railway run` exigir `railway link` primeiro, registrar e linkar ao projeto `lumen+` / environment `production` (operação read-only).

- [ ] **Step 2: Apagar o script temporário**

Run:
```bash
rm -f /tmp/h0_envcheck.py
```
Expected: arquivo removido (garantir que nunca foi versionado).

- [ ] **Step 3: Registrar resultados**

Seção 3: tabela das 9 verificações com PASS/FAIL. Para qualquer FAIL, marcar severidade (ex: `AUTH_MODE != PROD` = 🔴).

- [ ] **Step 4: Commit**

```bash
git add docs/superpowers/audits/2026-06-07-h0-hardening-audit-report.md
git commit -m "docs(h0): auditoria de env vars de produção (sem secrets)"
```

---

### Task 4: Fallback de API no frontend

**Files:**
- Modify: `docs/superpowers/audits/2026-06-07-h0-hardening-audit-report.md` (seção 4)

- [ ] **Step 1: Confirmar o fallback no código**

Run:
```bash
sed -n '30,46p' lumen_mobile/src/services/api.ts
```
Expected: confirma `getBaseUrl()` e o fallback `https://api.lumenplus.app`.

- [ ] **Step 2: Verificar se `EXPO_PUBLIC_API_URL` está definido no build de produção da Vercel**

Run:
```bash
cd lumen_mobile && vercel env ls production 2>/dev/null ; cd ..
```
Expected: lista de **nomes** de env vars (sem valores sensíveis para vars públicas). Confirmar presença de `EXPO_PUBLIC_API_URL` e `EXPO_PUBLIC_FIREBASE_API_KEY`. Se o CLI não estiver linkado/autenticado, registrar e propor verificação manual no painel Vercel (não autenticar interativamente sem aprovação).

- [ ] **Step 3: Registrar achado**

Seção 4: documentar se `EXPO_PUBLIC_API_URL` está setado (então o fallback nunca é usado em prod → severidade 🟢) ou ausente (então o app aponta para host errado → severidade 🟠). Registrar recomendação para H4.

- [ ] **Step 4: Commit**

```bash
git add docs/superpowers/audits/2026-06-07-h0-hardening-audit-report.md
git commit -m "docs(h0): confirmação do fallback de API no frontend"
```

---

### Task 5: Grep de segredos (backend + frontend)

**Files:**
- Modify: `docs/superpowers/audits/2026-06-07-h0-hardening-audit-report.md` (seção 5)

> ⚠️ Objetivo: detectar **referências a nomes de secrets de backend no frontend** e **valores hardcoded**. NÃO imprimir valores; se um valor real aparecer, redigir como `[REDACTED]` no relatório.

- [ ] **Step 1: Frontend não deve referenciar secrets de backend**

Usar a ferramenta Grep (não imprimir valores) no diretório `lumen_mobile/` (excluindo `node_modules`) para os padrões:
```
api_secret|cloudinary_api_secret|sendgrid|vapid_private|SECRET_KEY|HMAC_PEPPER|ENCRYPTION_KEY|service_account|private_key
```
Expected: **nenhum match** em código-fonte (`src/`, `app/`). Matches só em `node_modules`/lockfiles são falsos positivos. Registrar.

- [ ] **Step 2: Confirmar que só `EXPO_PUBLIC_*` é lido no frontend**

Grep em `lumen_mobile/src` e `lumen_mobile/app` por `process.env.` e confirmar que todos os usos são `EXPO_PUBLIC_*`.
Expected: lista de usos; todos devem ser `EXPO_PUBLIC_*`. Registrar exceções.

- [ ] **Step 3: Backend não deve ter secrets hardcoded fora de settings**

Grep em `backend/app` por padrões de chave/valor hardcoded:
```
(secret|password|api_key|token)\s*=\s*["'][A-Za-z0-9+/=_-]{16,}["']
```
Expected: matches só em `settings.py`/`.env.example` como defaults inócuos (ex: `troque-em-producao`, `change-me`). Qualquer outro = achado 🔴, redigir o valor.

- [ ] **Step 4: Verificar histórico recente do git por secrets vazados**

Run:
```bash
git log --oneline -n 50
git grep -nI -e "AKIA" -e "BEGIN PRIVATE KEY" -e "BEGIN RSA PRIVATE KEY" $(git rev-list --all --max-count=1) 2>/dev/null | head -20
```
Expected: nenhum match. (Se houver, escalar como 🔴 — secret no histórico exige rotação.) Registrar.

- [ ] **Step 5: Registrar e commit**

Seção 5: resumo dos greps, falsos positivos, achados reais (com valores redigidos).
```bash
git add docs/superpowers/audits/2026-06-07-h0-hardening-audit-report.md
git commit -m "docs(h0): grep de segredos backend + frontend"
```

---

### Task 6: Auditoria de dependências (modo relatório)

**Files:**
- Modify: `docs/superpowers/audits/2026-06-07-h0-hardening-audit-report.md` (seção 6)

> ⚠️ Modo relatório apenas. NÃO rodar `npm audit fix`. NÃO atualizar nada.

- [ ] **Step 1: npm audit (frontend) — somente relatório**

Run:
```bash
cd lumen_mobile && npm audit --omit=dev 2>&1 | tail -40 ; cd ..
```
Expected: resumo de vulnerabilidades por severidade. Registrar contagem (critical/high/moderate/low) e os pacotes críticos/high. NÃO aplicar fix.

- [ ] **Step 2: pip-audit (backend) — ferramenta ausente**

`pip-audit` **não está instalado**. NÃO instalar globalmente. Propor no relatório uma das opções (a executar só em H-posterior, com aprovação):
- Opção A (recomendada): instalar no venv do projeto — `backend/.venv/Scripts/python -m pip install pip-audit` e rodar `backend/.venv/Scripts/pip-audit`.
- Opção B (efêmera): `pipx run pip-audit` (se `pipx` existir).

Tentar a verificação read-only sem instalar, se possível:
```bash
backend/.venv/Scripts/python -m pip list --format=freeze > /tmp/h0_pipfreeze.txt 2>/dev/null && wc -l /tmp/h0_pipfreeze.txt && rm -f /tmp/h0_pipfreeze.txt
```
Expected: número de pacotes instalados (inventário). Registrar que a varredura de CVE fica pendente da instalação aprovada do `pip-audit`.

- [ ] **Step 3: Registrar e commit**

Seção 6: resultado do `npm audit`, status do `pip-audit` (ausente + proposta de instalação no venv).
```bash
git add docs/superpowers/audits/2026-06-07-h0-hardening-audit-report.md
git commit -m "docs(h0): auditoria de dependências (npm relatório + pip-audit pendente)"
```

---

### Task 7: Mapear consumidores de erro no frontend

**Files:**
- Modify: `docs/superpowers/audits/2026-06-07-h0-hardening-audit-report.md` (seção 7)

> Objetivo: antes de mexer em `api.ts` (H4), saber quem consome `error.response`, `detail`, `message`, e quais telas sensíveis dependem do formato atual.

- [ ] **Step 1: Mapear usos de `error.response` / `.response.status` / `.response.data`**

Grep em `lumen_mobile/src` e `lumen_mobile/app` por:
```
\.response\.(status|data)|error\.response|catch\s*\(
```
Expected: lista de arquivos:linha. Registrar cada consumidor.

- [ ] **Step 2: Mapear usos de `detail` e `message` vindos do backend**

Grep por:
```
\.detail|\.message|detail\?\.|response\.data\?\.
```
Expected: lista de telas que extraem mensagens de erro. Registrar.

- [ ] **Step 3: Identificar telas sensíveis**

Cruzar os resultados com telas que tratam dados sensíveis (login/register, perfil/CPF-RG, pagamento de retiro). **Não** incluir telas de CP7/CP8/Projeto de Vida na proposta de alteração (fora de escopo), mas registrar se elas consomem o formato de erro (para evitar quebrá-las em H4).

- [ ] **Step 4: Registrar e commit**

Seção 7: tabela arquivo × padrão consumido × tela sensível? × impacto se `api.ts` mudar o formato de erro.
```bash
git add docs/superpowers/audits/2026-06-07-h0-hardening-audit-report.md
git commit -m "docs(h0): mapa de consumidores de erro no frontend"
```

---

### Task 8: Consolidar riscos por severidade

**Files:**
- Modify: `docs/superpowers/audits/2026-06-07-h0-hardening-audit-report.md` (seção 8)

- [ ] **Step 1: Compilar todos os achados confirmados**

A partir das seções 1–7, listar cada achado confirmado com severidade (🔴🟠🟡🟢), evidência (arquivo:linha ou header observado) e referência ao item da spec (ex: 2.1, 3.1).

- [ ] **Step 2: Separar falsos positivos**

Listar o que parecia problema mas foi confirmado OK (ex: secrets só em `node_modules`, header X já presente). Vai para o Apêndice.

- [ ] **Step 3: Ordenar por severidade e commit**

Seção 8: tabela ordenada (🔴 → 🟢). 
```bash
git add docs/superpowers/audits/2026-06-07-h0-hardening-audit-report.md
git commit -m "docs(h0): consolidação de riscos por severidade"
```

---

### Task 9: Proposta de subfases H1–H5 + sumário executivo

**Files:**
- Modify: `docs/superpowers/audits/2026-06-07-h0-hardening-audit-report.md` (seções 9 e sumário)

- [ ] **Step 1: Escrever a proposta de subfases (ajustar conforme achados reais)**

Base de partida (refinar com os achados; cada subfase = 1 PR independente):

| Subfase | Escopo | Itens da spec | Risco de regressão |
|---|---|---|---|
| **H1 — Headers do backend** | HSTS + CSP (`default-src 'none'`) + trocar `X-XSS-Protection` para `0`; manter `/docs` em dev | 1.1, 2.4, 2.6 | Baixo (header-only) |
| **H2 — Rate limit por usuário** | Corrigir bucket: hash do token completo, não do prefixo | 2.1 | Médio (testar 429) |
| **H3 — Upload + body size** | Limite de tamanho de upload (413), validação magic-bytes, limite global de body JSON | 2.2, 2.3, 2.5 | Médio (testar retiro) |
| **H4 — Frontend** | `vercel.json` headers (CSP em Report-Only primeiro), normalizar erros em `api.ts`, corrigir fallback de URL, confirmar `IS_DEV_AUTH=false` | 1.4, 3.1, 3.2, 3.3, 3.4 | Médio-Alto (validar app no preview) |
| **H5 — Autorização + deps + testes** | Varredura IDOR endpoint-a-endpoint, remediar CVEs do `npm/pip-audit`, suíte `tests/test_security_*.py` | Camada 4, 1.2, Camada 5 | Variável (definido pela matriz) |

Ajustar a ordem/conteúdo se os achados das Tasks 1–8 mudarem as prioridades (ex: se algum FAIL 🔴 em env vars, vira H1 imediato).

- [ ] **Step 2: Escrever o sumário executivo**

No topo do relatório: 3–5 linhas — postura geral, nº de achados por severidade, e a recomendação de por onde começar.

- [ ] **Step 3: Commit final**

```bash
git add docs/superpowers/audits/2026-06-07-h0-hardening-audit-report.md
git commit -m "docs(h0): proposta de subfases H1-H5 e sumário executivo"
```

- [ ] **Step 4: Apresentar o relatório ao usuário**

Resumir os achados confirmados (por severidade) e a proposta H1–H5. **NÃO** iniciar nenhuma implementação — aguardar o usuário escolher qual subfase planejar/executar a seguir.

---

## Self-Review (cobertura do escopo H0 pedido pelo usuário)

| Item do escopo pedido | Task que cobre |
|---|---|
| 1. Headers do backend (prod + local) | Task 1 |
| 2. Headers do frontend/Vercel | Task 2 |
| 3. Env vars de produção (sem expor secrets) | Task 3 |
| 4. Fallback de API no frontend | Task 4 |
| 5. Grep de segredos (backend/frontend/bundle) | Task 5 |
| 6. Auditoria de dependências (pip-audit + npm audit, modo relatório) | Task 6 |
| 7. Mapa de consumidores de erro no frontend | Task 7 |
| 8. Relatório (achados, falsos positivos, riscos, proposta H1–H5, sem implementação) | Tasks 8 + 9 |

**Regras respeitadas:** todas as tarefas são read-only; nenhuma altera código/env/deploy; secrets nunca impressos (Task 3 imprime só booleanos; Task 5 redige valores); `npm audit fix` e updates proibidos (Task 6); `pip-audit` ausente é registrado e proposta de instalação no venv (não global, sob aprovação); CP7/CP8/Projeto de Vida explicitamente fora de escopo (Tasks 7).

**Sobre o "bundle web" (item 5):** o grep cobre `src/` e `app/`. Auditar o bundle compilado exigiria `npm run build` (gera artefato, sem alterar comportamento) — fica como passo **opcional** de H0, só se o usuário aprovar rodar o build; caso contrário, o grep do código-fonte é suficiente para o baseline.
