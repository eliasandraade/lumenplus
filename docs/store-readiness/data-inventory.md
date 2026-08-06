# Inventário de Dados Pessoais — Lumen+

> **Escopo**: inventário REAL, derivado da leitura do código-fonte em `backend/` e `lumen_mobile/`.
> **Data da auditoria**: 2026-08-06
> **Branch**: `main` (commit `7db785d`)
> **Método**: leitura estática de modelos SQLAlchemy, schemas Pydantic, rotas FastAPI e telas Expo/React Native.
>
> **Convenção de confiança usada neste documento:**
> - **[COMPROVADO]** — li a linha no código; a evidência está citada como `arquivo:linha`.
> - **[INFERIDO]** — deduzi a partir de evidência indireta; a base do raciocínio está declarada.
> - **[NÃO DETERMINADO]** — não foi possível concluir por leitura estática; o motivo está declarado.
>
> **Nenhum valor de chave, token, senha ou DSN foi lido, copiado ou reproduzido neste documento.**
>
> **Revisão adversarial (2026-08-06)**: este documento passou por verificação independente linha a linha.
> Todos os achados substantivos foram **confirmados**. Foram corrigidas **14 citações `arquivo:linha` incorretas**,
> **1 contagem errada** (17 tabelas, não 14) e **1 afirmação enganosa** sobre a ausência de scheduler.
> As correções estão marcadas com `[CORRIGIDO]`. Ver seção 11 para o registro completo.

---

## 0. Sumário executivo

O Lumen+ trata **dados pessoais sensíveis em duas categorias especiais simultâneas** da LGPD (Art. 5º, II):

1. **Convicção religiosa** — é o núcleo funcional do produto (estado de vida, realidade vocacional, ano de consagração, exame de consciência, projeto de vida espiritual). Não é um dado acessório: é a razão de existir do app.
2. **Dados de saúde** — restrição alimentar e plano de saúde, coletados para segurança em retiros.

Além disso trata **documentos de identificação civil** (CPF e RG), com criptografia AES-256-GCM implementada e auditada.

**Achados que bloqueiam publicação nas lojas** (detalhados na seção 8):

| # | Achado | Gravidade |
|---|--------|-----------|
| B1 | `lumen_mobile/ios/` e `lumen_mobile/android/` são scaffold **Flutter**, não prebuild Expo; `applicationId = "com.example.lumen_mobile"` | Blocker |
| B2 | Não existe **exclusão de conta in-app** para o próprio titular, embora a Política de Privacidade afirme que existe | Blocker |
| B3 | Ausência de `PrivacyInfo.xcprivacy` (privacy manifest da Apple) em todo o repositório | Blocker |
| B4 | Ausência de `NSCameraUsageDescription` / `NSPhotoLibraryUsageDescription` apesar de o código pedir as duas permissões | Blocker |
| B5 | Token de sessão gravado em `AsyncStorage` (não criptografado) — `expo-secure-store` está declarado mas nunca é importado | Alto |
| B6 | Endpoint `POST /profile/photo` chamado pelo app **não existe** no backend | ~~Alto~~ **Médio** (`[CORRIGIDO]` — erro é engolido por `try/catch` vazio; falha silenciosa, não quebra de fluxo) |

---

## 1. Metodologia e fontes lidas

Arquivos primários consultados:

| Camada | Arquivo | O que forneceu |
|---|---|---|
| Modelo de dados | `backend/app/db/models.py` (2158 linhas) | Todas as colunas persistidas |
| Contrato de API | `backend/app/schemas/profile.py`, `legal.py` | Campos aceitos/retornados |
| Criptografia | `backend/app/crypto/service.py` | Algoritmos e gestão de chaves |
| Anonimização | `backend/app/services/account_deletion.py` | Retenção pós-exclusão |
| Auditoria | `backend/app/audit/service.py` | Sanitização e IP/User-Agent |
| Consentimento | `backend/app/api/legal_routes.py` | Registro de aceite |
| Política vigente | `backend/app/legal_content.py` | Declarações ao titular |
| Coleta (telas) | `lumen_mobile/app/(onboarding)/profile.tsx`, `complete-documents.tsx`, `terms.tsx` | Origem dos dados |
| Upload de imagem | `lumen_mobile/app/retreats/[id]/payment.tsx` | Comprovante de pagamento |
| Transporte/token | `lumen_mobile/src/services/api.ts`, `push.ts` | Transmissão e storage local |

---

## 2. Inventário por dado pessoal

Legenda das colunas:
- **Cripto** — em repouso, no banco.
- **Vinculado** — associado a um titular identificável.
- **Tracking** — usado para analytics/publicidade/diagnóstico.

### 2.1. Identificação civil (categoria: documento)

| Dado | Origem (tela → endpoint) | Armazenamento | Cripto | Vinculado | Tracking | Evidência |
|---|---|---|---|---|---|---|
| **CPF** | `(onboarding)/complete-documents.tsx` → `PUT /profile` | `user_profiles.cpf_encrypted` (AES-256-GCM) + `user_profiles.cpf_hash` (HMAC-SHA256, `unique`) | **Sim** | Sim | Não | `backend/app/db/models.py:187-188`; `backend/app/api/profile_routes.py:211` |
| **RG** | idem | `user_profiles.rg_encrypted` (`LargeBinary`) | **Sim** | Sim | Não | `backend/app/db/models.py:189`; `backend/app/api/profile_routes.py:213` |
| **Nome completo** | `(onboarding)/profile.tsx` → `PUT /profile` | `user_profiles.full_name` (`Text`) | Não | Sim | Não | `backend/app/db/models.py:182`; `backend/app/schemas/profile.py:21` |
| **Data de nascimento** | `(onboarding)/profile.tsx:553` (campo obrigatório) → `PUT /profile` | `user_profiles.birth_date` (`Date`) | Não | Sim | Não | `backend/app/db/models.py:183`; `lumen_mobile/app/(onboarding)/profile.tsx:387,425` |

**Finalidade declarada** (`backend/app/legal_content.py:135`): *"CPF e RG: Verificação de identidade para fins pastorais | Base: Art. 7º, I (consentimento)"*.

**[COMPROVADO] A criptografia de CPF/RG está corretamente implementada:**
- AES-256-GCM com nonce de 12 bytes aleatório por operação, prefixado ao ciphertext — `backend/app/crypto/service.py:122-129`.
- Chave validada em exatamente 32 bytes; erro explícito se inválida — `backend/app/crypto/service.py:177-183`.
- **Em produção, o serviço falha na inicialização se `ENCRYPTION_KEY` ou `HMAC_PEPPER` estiverem ausentes** — `backend/app/crypto/service.py:81-93`. Não há fallback silencioso. Boa prática confirmada.
- Em DEV, gera chaves efêmeras com `logger.warning` explícito — `backend/app/crypto/service.py:64-80`.

**[COMPROVADO] Acesso a CPF/RG por terceiros é controlado e auditado:**
- Requer solicitação formal (`SensitiveAccessRequest`) aprovada por `COUNCIL_GENERAL` ou `DEV`, com `scope`, `reason` e `expires_at` — `backend/app/db/models.py:1060-1093`.
- Cada leitura gera registro em `sensitive_access_audit` com `viewer_user_id`, `target_user_id`, `ip` e `user_agent` — `backend/app/db/models.py:1096-1120`.
- Descriptografia só ocorre em `backend/app/api/admin_routes.py:303-304`, atrás do gate `crypto_service.is_configured` (`admin_routes.py:296`).
- A consulta pública de CPF foi fechada contra enumeração: `backend/app/api/routes/auth.py:60` exige autenticação com comentário explícito de LGPD.

---

### 2.2. Contato

| Dado | Origem | Armazenamento | Cripto | Vinculado | Tracking | Evidência |
|---|---|---|---|---|---|---|
| **E-mail** | Firebase Auth (registro/login) → `user_identities` | `user_identities.email` (`Text`) | Não | Sim | Não | `backend/app/db/models.py:152` |
| **Telefone (E.164)** | `(onboarding)/profile.tsx` → `PUT /profile` | `user_profiles.phone_e164` (`Text`, `unique`) | Não | Sim | Não | `backend/app/db/models.py:192`; schema com regex `^\+[1-9]\d{10,14}$` em `backend/app/schemas/profile.py:25` |
| **Instagram** | `(onboarding)/profile.tsx` → `PUT /profile` | `user_profiles.instagram` (`Text`) | Não | Sim | Não | `backend/app/db/models.py:236` |
| Código de verificação de telefone | `(auth)/verify-phone.tsx` | `phone_verifications.code_hash` (**hash**, não texto puro) | Hash | Sim | Não | `backend/app/db/models.py:661` |
| Token de verificação de e-mail | `(auth)/verify-email.tsx` | `email_verifications.token_hash` (**hash**) | Hash | Sim | Não | `backend/app/db/models.py:681` |

**[COMPROVADO]** Códigos e tokens de verificação são armazenados como hash, nunca em texto puro. `phone_verifications` inclui contador `attempts` (`models.py:664`) — mitigação de força bruta.

**[COMPROVADO] Minimização aplicada em dois pontos:**
- `backend/app/api/deps.py:144` — comentário `# email removido — LGPD minimização de dados` no metadata de auditoria.
- `backend/app/api/routes/organization.py:410` — e-mail só retorna para membros/admins.

---

### 2.3. Dados de convicção religiosa — **CATEGORIA ESPECIAL (LGPD Art. 5º, II)**

Esta é a categoria de maior risco do produto e a que exige tratamento mais cuidadoso nas fichas de privacidade das lojas.

| Dado | Armazenamento | Cripto | Evidência |
|---|---|---|---|
| **Estado de vida** (leigo, seminarista, noviça, religioso, diácono, sacerdote, bispo) | `user_profiles.life_state_item_id` (FK catálogo) | Não | `backend/app/db/models.py:202` + comentário `models.py:200-201` |
| **Realidade vocacional** (Acolhida, Aprofundamento, Vocacional, Postulante 1º/2º ano, Discípulo Vocacional, Consagrado Filho da Luz) | `user_profiles.vocational_reality_item_id` | Não | `backend/app/db/models.py:210-212` + comentário `models.py:207-209` |
| **Ano de consagração** | `user_profiles.consecration_year` (`Integer`) | Não | `backend/app/db/models.py:215` |
| **Acompanhamento vocacional** (tem? quem é o acompanhador?) | `has_vocational_accompaniment`, `vocational_accompanist_user_id`, `vocational_accompanist_name` | Não | `backend/app/db/models.py:218-225` |
| **Interesse em ministério** + observações | `interested_in_ministry`, `interested_ministry_id`, `ministry_interest_notes` | Não | `backend/app/db/models.py:228-233` |
| **Realidade atual** (multi-select) | `user_profiles.realidade_atual` (JSON em `Text`) | Não | `backend/app/db/models.py:254` |
| **Ministérios/setores** (multi-select) | `user_profiles.ministry_sector_ids` (JSON em `Text`) | Não | `backend/app/db/models.py:257` |
| **Participação em missão** | `is_from_mission`, `mission_name`, `mission_org_unit_id` | Não | `backend/app/db/models.py:244-245,263-265` |
| **Encontro "Despertar"** | `user_profiles.despertar_encounter` | Não | `backend/app/db/models.py:272` |
| **Cônjuge na comunidade** | `user_profiles.spouse_in_community` | Não | `backend/app/db/models.py:251` |

#### 2.3.1. Conteúdo espiritual íntimo — "Projeto de Vida" e "Plano de Vida"

**[COMPROVADO]** O app persiste conteúdo devocional escrito pelo próprio usuário, incluindo **exame de consciência** — o dado mais íntimo de todo o sistema:

| Entidade | Tabela | Evidência |
|---|---|---|
| Exame de consciência | `projetos_vida_exame` | `backend/app/db/models.py:2052` |
| Intercessão (por quem o usuário reza) | `projetos_vida_intercessao` | `backend/app/db/models.py:2085` |
| Diagnóstico de vida espiritual | `life_plan_diagnoses` | `backend/app/db/models.py:1615` |
| Rotina espiritual | `life_plan_spiritual_routines` | `backend/app/db/models.py:1730` |
| Revisão mensal | `life_plan_monthly_reviews`, `projetos_vida_revisoes` | `backend/app/db/models.py:1764,1989` |
| Metas / ações / compromissos | `life_plan_goals`, `life_plan_actions`, `projetos_vida_compromissos` | `backend/app/db/models.py:1674,1704,1937` |
| Cuidado e comunidade | `projetos_vida_cuidado`, `projetos_vida_comunidade` | `backend/app/db/models.py:1910,1883` |
| Práticas / áreas mensais / semanal | `projetos_vida_praticas`, `projetos_vida_areas_mensais`, `projetos_vida_semanal` | `backend/app/db/models.py:1963,2015,2115` |

**Nenhuma dessas tabelas é criptografada em repouso** — `[COMPROVADO]` por ausência de `LargeBinary`/`crypto_service` em `backend/app/db/models.py:1551-2158`; as únicas colunas criptografadas em todo o schema são `cpf_encrypted` e `rg_encrypted` (`models.py:188-189`).

> **Risco.** A Política de Privacidade vigente (`backend/app/legal_content.py:99-131`) **não menciona** o Projeto/Plano de Vida na seção "2. DADOS PESSOAIS COLETADOS". Um titular que lê a política não é informado de que seu exame de consciência é persistido no servidor. **Blocker de conformidade LGPD (transparência, Art. 9º) — requer decisão jurídica humana.**

---

### 2.4. Dados de saúde — **CATEGORIA ESPECIAL (LGPD Art. 5º, II)**

| Dado | Armazenamento | Cripto | Evidência |
|---|---|---|---|
| **Restrição alimentar** (sim/não) | `user_profiles.dietary_restriction` | Não | `backend/app/db/models.py:237` |
| **Descrição da restrição alimentar** (texto livre, até 500 chars) | `user_profiles.dietary_restriction_notes` | Não | `backend/app/db/models.py:238`; `backend/app/schemas/profile.py:59` |
| **Possui plano de saúde** (sim/não) | `user_profiles.health_insurance` | Não | `backend/app/db/models.py:239` |
| **Nome do plano de saúde** | `user_profiles.health_insurance_name` | Não | `backend/app/db/models.py:240` |
| Preferência de acomodação | `accommodation_preference`, `accommodation_options` | Não | `backend/app/db/models.py:241-243,260` |

**Finalidade e base legal declaradas** (`backend/app/legal_content.py:138`): *"Dados de saúde: Segurança em eventos e retiros | Base: Art. 7º, I (consentimento) e Art. 11, II (tutela da saúde)"*.

**[COMPROVADO] Lacuna de proteção**: a política afirma em `legal_content.py:145` que *"Dados de saúde são tratados como dados sensíveis conforme o Art. 11 da LGPD"*, mas o controle técnico de acesso sensível (`SENSITIVE_FIELDS`) cobre **apenas CPF e RG** — `backend/app/api/routes/export.py:38`:

```python
SENSITIVE_FIELDS = {"cpf", "rg"}
```

Ou seja: dados de saúde e de convicção religiosa **não** passam pelo fluxo de `SensitiveAccessRequest`, não geram `sensitive_access_audit` e não marcam `has_sensitive` nas requisições de exportação (`export.py:325`). **Descompasso entre política declarada e controle implementado.**

---

### 2.5. Dados de terceiros (não-usuários)

| Dado | Armazenamento | Cripto | Evidência |
|---|---|---|---|
| **Nome do contato de emergência** | `user_emergency_contacts.contact_name` | Não | `backend/app/db/models.py:318` |
| **Telefone do contato de emergência** | `user_emergency_contacts.contact_phone` | Não | `backend/app/db/models.py:319` |
| **Grau de parentesco** | `user_emergency_contacts.contact_relationship` | Não | `backend/app/db/models.py:320` |
| Nome do acompanhador vocacional (quando não é usuário) | `user_profiles.vocational_accompanist_name` | Não | `backend/app/db/models.py:223-225` |

**[COMPROVADO]** São dados de **pessoas que não têm conta e nunca consentiram**. Coletados em `lumen_mobile/app/(tabs)/profile.tsx:1085` e `POST /profile/emergency-contact` (`backend/app/api/profile_routes.py:281`).
A Política de Privacidade (`backend/app/legal_content.py:99-131`) **não menciona** contato de emergência na lista de dados coletados. **Requer avaliação jurídica humana.**

---

### 2.6. Localização

| Dado | Granularidade | Armazenamento | Evidência |
|---|---|---|---|
| Cidade | Município | `user_profiles.city` | `backend/app/db/models.py:196` |
| Estado (UF) | UF | `user_profiles.state` (`String(2)`) | `backend/app/db/models.py:197` |
| País | País | `user_profiles.country` | `backend/app/db/models.py:248` |

**[COMPROVADO] Não há coleta de geolocalização precisa.** Nenhuma dependência de localização em `lumen_mobile/package.json` (não há `expo-location`, `react-native-geolocation` ou equivalente). A cidade/UF é **digitada/selecionada pelo usuário**, alimentada pelo catálogo público do IBGE via BrasilAPI — `lumen_mobile/src/services/brasilApi.ts:23,32`.

**[COMPROVADO]** A chamada à BrasilAPI **não envia dado pessoal**: `GET /ibge/uf/v1` e `GET /ibge/municipios/v1/{UF}` transmitem apenas a sigla da UF — `lumen_mobile/src/services/brasilApi.ts:24,33`. Sem chave de API, sem corpo de requisição.

---

### 2.7. Foto e imagens

| Dado | Origem | Destino | Evidência |
|---|---|---|---|
| **Foto de perfil** | Câmera ou galeria — `lumen_mobile/app/(onboarding)/profile.tsx:311-331` | `user_profiles.photo_url` (apenas URL, não o binário) | `backend/app/db/models.py:184` |
| **Comprovante de pagamento** (imagem) | Câmera ou galeria — `lumen_mobile/app/retreats/[id]/payment.tsx:36-58` | **Cloudinary** (terceiro) → URL em `retreat_registrations.payment_proof_url` | `backend/app/api/retreat_routes.py:795` (chamada `cloudinary.uploader.upload`); `backend/app/db/models.py:1313` |

> `[CORRIGIDO]` A versão anterior citava `retreat_routes.py:721` para o Cloudinary. Aquela linha é
> `).scalar_one_or_none()` — não tem relação com o Cloudinary. As linhas corretas são:
> `:16-17` (import), `:715` (docstring), `:771-774` (`cloudinary.config`), `:795` (upload efetivo).

**[COMPROVADO] Defesa contra SSRF/exfiltração na URL de foto**: `_validate_photo_url` aceita apenas HTTPS e domínios em allow-list (`firebasestorage.googleapis.com`, `storage.googleapis.com`, `res.cloudinary.com`, `lh3.googleusercontent.com`) — `backend/app/api/profile_routes.py:49-65`. Comparação de host case-insensitive conforme RFC 3986 (`profile_routes.py:62`).

**[COMPROVADO] Defeito funcional — endpoint de foto de perfil inexistente:**
O app faz `await api.postForm('/profile/photo', formData)` em `lumen_mobile/app/(onboarding)/profile.tsx:466`, mas o router de perfil não expõe essa rota. As rotas existentes em `backend/app/api/profile_routes.py` são apenas:

```
GET  /profile/catalogs            (linha 108)
GET  /profile/sectors             (linha 146)
GET  /profile/missions            (linha 158)
GET  /profile                     (linha 179)
PUT  /profile                     (linha 190)
POST /profile/me/confirm          (linha 265)
POST /profile/emergency-contact   (linha 281)
GET  /profile/emergency-contacts  (linha 329)
```

O único endpoint de upload de arquivo em todo o backend é o de comprovante de pagamento — `grep -rn "UploadFile" backend/app` retorna somente `backend/app/api/retreat_routes.py:18,713`. **Consequência: o upload de foto de perfil retorna 404.**

**`[CORRIGIDO]` Calibração de severidade — de Alto para Médio.** A chamada está envolvida por um
`try/catch` que engole o erro silenciosamente (`profile.tsx:465-468`):

```ts
try {
  await api.postForm('/profile/photo', formData);
} catch {
}
```

Não há crash, não há mensagem de erro e o fluxo de onboarding segue normalmente — o usuário
simplesmente nunca tem foto salva, sem jamais saber disso. Isso **rebaixa o impacto funcional**
(não é quebra de fluxo) mas **agrava o problema de UX** (falha silenciosa). Efeito colateral
positivo em privacidade permanece: nenhuma foto de perfil chega ao servidor hoje.

---

### 2.8. Dados técnicos, diagnóstico e auditoria

| Dado | Armazenamento | Retenção declarada | Evidência |
|---|---|---|---|
| **Endereço IP** | `audit_log.extra_data["ip"]` (JSON) | 5 anos | `backend/app/audit/service.py:59-60`; `backend/app/api/legal_routes.py:108,135` |
| **User-Agent** | `audit_log.extra_data["user_agent"]` | 5 anos | `backend/app/audit/service.py:61-62` |
| **IP + User-Agent em acesso sensível** | `sensitive_access_audit.ip` / `.user_agent` (colunas dedicadas) | [NÃO DETERMINADO] | `backend/app/db/models.py:1115-1116`; gravado em `backend/app/api/routes/admin.py:331-332` |
| Ação de auditoria | `audit_log.action`, `entity_type`, `entity_id`, `actor_user_id` | 5 anos | `backend/app/db/models.py:786-800` |
| **Endpoint de push + chaves p256dh/auth** | `push_subscriptions` | [NÃO DETERMINADO] | `backend/app/db/models.py:750-753` |
| User-Agent da inscrição push | `push_subscriptions.user_agent` | [NÃO DETERMINADO] | `backend/app/db/models.py:753` |
| Log de entrega de notificação | `notification_delivery_log` (user_id, tipo, canal, status, deep_link, erro) | [NÃO DETERMINADO] | `backend/app/db/models.py:757-780` |
| Registro de consentimento | `user_consents` (user_id, document_id, accepted_at) | 5 anos | `backend/app/db/models.py:709-726` |
| Preferências (analytics/push opt-in) | `user_preferences` | Até exclusão | `backend/app/db/models.py:729-736` |

**[COMPROVADO] Sanitização de auditoria é robusta.** `sanitize_sensitive_data` em `backend/app/audit/service.py:22-40` faz redação recursiva por regex antes de persistir (`_SENSITIVE_PATTERNS`, `audit/service.py:14-19`):
- Telefone E.164 → `[PHONE_REDACTED]` (`audit/service.py:15`)
- CPF formatado e não formatado → `[CPF_REDACTED]` (`audit/service.py:16-17`)
- RG formatado → `[RG_REDACTED]` (`audit/service.py:18`)
- Chaves de dicionário `cpf`, `rg`, `phone`, `phone_e164`, `telefone`, `documento` → `[REDACTED]` (`audit/service.py:33-34`)

> `[CORRIGIDO]` As citações desta subseção estavam deslocadas em +1 linha na versão anterior
> (`:16`/`:17-18`/`:19`/`:23-41`). Os números acima foram reconferidos linha a linha.
> **A substância — a sanitização existe e é recursiva — está confirmada.**

**[COMPROVADO] Redação também no middleware de logging**: `SENSITIVE_HEADERS = ["authorization", "cookie", "x-api-key"]` — `backend/app/middlewares/logging.py:32,73`, com `SENSITIVE_PATHS` em `logging.py:24`.

**[COMPROVADO] O IP é gravado dentro de um campo JSON (`extra_data`), não em coluna dedicada** (`backend/app/db/models.py:799`). `[INFERIDO]` Isso dificulta a purga seletiva de IP por retenção diferenciada, já que exigiria manipulação de JSON em vez de um `UPDATE ... SET ip = NULL`.

---

## 3. Tracking, analytics e diagnóstico

**Resumo: o app NÃO faz tracking publicitário e NÃO tem identificador de publicidade.** Confirmado por ausência de qualquer SDK de atribuição/ads em `lumen_mobile/package.json` (sem AppsFlyer, Adjust, Branch, Facebook SDK, AdMob, Google Analytics/GA4, Amplitude, Mixpanel).

| Ferramenta | Estado real | Dados enviados | Evidência |
|---|---|---|---|
| **Sentry** (`@sentry/react`) | **Ativo** somente se `EXPO_PUBLIC_SENTRY_DSN` estiver definido (`enabled: !!...`) | Stack traces, mensagens de erro, `environment`, `release`. `sendDefaultPii: false` → **não anexa IP nem dados de usuário automaticamente**. `tracesSampleRate: 0.1` | `lumen_mobile/app/_layout.tsx:29-39` |
| **Sentry backend** (`sentry-sdk[fastapi]`) | Ativo se DSN configurado | Erros de servidor, transações (10% em prod, 0% fora). `send_default_pii=False` | `backend/app/main.py:31-43` |
| **Vercel Analytics** (`@vercel/analytics`) | **INATIVO — componente é stub no-op nas duas plataformas** | **Nenhum** | `lumen_mobile/src/components/VercelAnalytics.tsx:2-4` (retorna `null`); `VercelAnalytics.web.tsx:3-5` (retorna `null`; comentário *"desativado no Railway"* em `:1-2`) — `[CORRIGIDO]`, antes citado como `:4-6`, mas o arquivo tem 5 linhas |
| **Firebase Analytics** | **Não usado.** Apenas `firebase/app` e `firebase/auth` são importados | — | `lumen_mobile/src/config/firebase.ts:15-16` |
| Preferência de analytics do usuário | `user_preferences.analytics_opt_in`, default **`false`** (opt-in, não opt-out) | — | `backend/app/db/models.py:735`; gravado em `backend/app/api/legal_routes.py:135` |

**[COMPROVADO] `measurementId` do Firebase é lido da env** (`lumen_mobile/src/config/firebase.ts:44`) e passado para `initializeApp`, **mas `getAnalytics()` nunca é chamado** — nenhuma ocorrência de `firebase/analytics` no código. `[INFERIDO]` Portanto o Firebase Analytics não é inicializado e não coleta eventos.

**[COMPROVADO] Descompasso de governança**: existe a flag `analytics_opt_in` persistida e coletada na tela de termos, mas **nenhum código de analytics a consulta**. Ocorrências completas (`grep -rn analytics_opt_in`), todas de escrita ou definição de tipo, **nenhuma de leitura condicional**:
`backend/app/api/legal_routes.py:32,135,141`; `backend/app/db/models.py:735`; `backend/app/schemas/legal.py:31`; `lumen_mobile/src/stores/onboardingStore.ts:94`; `lumen_mobile/src/types/index.ts:194`.
`[CORRIGIDO]` — a versão anterior listava apenas 3 das 7 ocorrências; a conclusão não muda.
`[INFERIDO]` A flag é hoje um registro de consentimento sem efeito técnico. Não é um risco de privacidade (nada é coletado), mas é um risco de conformidade se algum analytics for ligado no futuro sem religar a flag.

---

## 4. Transmissão

| Canal | Protocolo | Observação | Evidência |
|---|---|---|---|
| App → Backend | HTTPS em produção | `EXPO_PUBLIC_API_URL`; fallback de produção `https://api.lumenplus.app` | `lumen_mobile/src/services/api.ts:34-38` |
| App → Backend (dev) | **HTTP em claro** | `http://10.0.2.2:8000` (Android) e `http://localhost:8000` — apenas em dev | `lumen_mobile/src/services/api.ts:41-42` |
| App → Firebase Auth | HTTPS (SDK Google) | Credenciais de login trafegam direto para o Google | `lumen_mobile/src/config/firebase.ts:47` |
| App → BrasilAPI | HTTPS | Sem dado pessoal (só sigla de UF) | `lumen_mobile/src/services/brasilApi.ts:6` |
| Backend → Cloudinary | HTTPS (SDK) | Envia **imagem de comprovante de pagamento** | `backend/app/api/retreat_routes.py:795` |
| Backend → SendGrid | HTTPS (SDK) | Envia **e-mail e conteúdo da mensagem** | `backend/app/notifications/email_service.py:33` |
| Backend → Sentry | HTTPS | Erros; `send_default_pii=False` | `backend/app/main.py:36` |
| Backend → Web Push | HTTPS (`pywebpush`) | Payload de notificação | `backend/requirements.txt:35` |
| App → BrasilAPI (endpoints) | HTTPS | `GET /ibge/uf/v1` (`brasilApi.ts:22`) e `GET /ibge/municipios/v1/{UF}` (`brasilApi.ts:30-31`) | `[CORRIGIDO]` — antes citado como `:23,32` / `:24,33` |

**Autorização**: `Bearer` token no header `Authorization` — `lumen_mobile/src/services/api.ts:93,153`.

---

## 5. Armazenamento local no dispositivo

| Chave | Conteúdo | Mecanismo | Criptografado | Evidência |
|---|---|---|---|---|
| `lumen_dev_token` | Token de autenticação (modo DEV) | `AsyncStorage` | **Não** | `lumen_mobile/src/services/api.ts:13,21,24,27` |
| Persistência do Firebase Auth | **Token de sessão / refresh token** | `AsyncStorage` via `getReactNativePersistence` | **Não** | `lumen_mobile/src/config/firebase.ts:53-56` |
| `lumen_push_decision` | `granted`/`denied`/`later` | `AsyncStorage` | Não | `lumen_mobile/src/services/push.ts:6,13` |
| Preferência de tema | claro/escuro | `AsyncStorage` | Não | `lumen_mobile/src/theme/ThemeContext.tsx:13` |

**[COMPROVADO] Achado B5 — credenciais em armazenamento não criptografado.**
`expo-secure-store@14.0.1` está instalado e **declarado no `plugins` do `app.json`** (`lumen_mobile/app.json:29`), mas **nunca é importado em nenhum arquivo de `app/` ou `src/`** — `grep -rn "expo-secure-store" app src` não retorna nenhuma ocorrência de import. Toda a persistência de token usa `AsyncStorage`, que no Android grava em SharedPreferences em texto plano e no iOS em arquivo no sandbox — não no Keychain.

`[INFERIDO]` A presença do plugin no `app.json` sugere que o uso de SecureStore foi planejado e não concluído.

---

## 6. Retenção e exclusão

### 6.1. Retenção declarada ao titular (`backend/app/legal_content.py:155-160`)

| Categoria | Prazo declarado |
|---|---|
| Conta ativa | Enquanto o usuário for membro ativo |
| Após exclusão | Anonimização/exclusão em até 30 dias |
| Logs de auditoria | 5 anos (legítimo interesse) |
| CPF e RG | Exclusão **imediata** após exclusão da conta |
| Consentimentos | 5 anos (obrigação legal) |

### 6.2. Retenção implementada (`backend/app/services/account_deletion.py`)

**[COMPROVADO] `anonymize_user` remove imediatamente:**
- `UserProfile` inteiro — inclui `cpf_encrypted`, `rg_encrypted`, saúde, dados vocacionais (`account_deletion.py:53-54`). **Cumpre a promessa de exclusão imediata de CPF/RG.**
- `UserPreferences` (`account_deletion.py:70-74`)
- `OrgMembership` e `UserGlobalRole` (`account_deletion.py:64-67`)
- E-mail e `provider_uid` substituídos por `deleted+{uuid}@deleted.invalid` (`account_deletion.py:57-61`)
- **`[ADICIONADO]` `UserEmergencyContact`** — em cascata. `UserProfile.emergency_contacts` declara
  `cascade="all, delete-orphan"` (`backend/app/db/models.py:290-292`) e a FK é para
  `user_profiles.user_id` com `ondelete="CASCADE"` (`models.py:313-316`). Como o `UserProfile` **é**
  apagado, o contato de emergência **é apagado junto**. A versão anterior não registrava isso.

> **`[ADICIONADO]` Este é o contraste estrutural que explica o achado R1.** O contato de emergência
> desaparece porque sua FK aponta para `user_profiles.user_id` — tabela que é deletada. As tabelas de
> Projeto de Vida sobrevivem porque apontam para `users.id` — linha preservada de propósito.
> **A diferença não é de intenção, é de alvo da chave estrangeira.** Isso torna a correção de R1
> barata: basta deletar explicitamente as raízes (`life_plan_cycles`, `projetos_vida_mensal`).

**[COMPROVADO] Retém deliberadamente:**
- Linha `User` com `is_active=False` — âncora de auditoria (`account_deletion.py:77`)
- `UserConsent` — evidência de aceite (5 anos)
- `AuditLog` — inclui **IP e User-Agent** em `extra_data`

**[COMPROVADO] Idempotência garantida**: exclusão de conta já anonimizada retorna sucesso no-op — `backend/app/api/routes/admin.py:496`.

### 6.3. Lacunas de retenção

**`[CORRIGIDO]` — a versão anterior afirmava "não encontrei rotina de expurgo automático
(cron/scheduler)", o que sugeria erroneamente que não há infraestrutura de agendamento. Há.**

**[COMPROVADO] O scheduler EXISTE e está em execução:**
- `apscheduler>=3.10.0` — `backend/requirements.txt:37`
- `AsyncIOScheduler` com timezone `America/Fortaleza` — `backend/app/notifications/scheduler.py:53`
- Iniciado no lifespan da aplicação — `backend/app/main.py:81-83`, encerrado em `main.py:87`
- Usa `pg_try_advisory_lock` para garantir execução em uma única instância (`scheduler.py:34-36`) — boa prática

**[COMPROVADO] Mas há exatamente UM job registrado, e não é de expurgo:**
```
_scheduler.add_job(_run_revision_reminder_job, CronTrigger(day_of_week="fri", hour=8, minute=0),
                   id="revision_reminder", replace_existing=True)   # scheduler.py:54-59
```
`revision_reminder` apenas envia notificação de revisão na 1ª sexta-feira do mês (`scheduler.py:19-27`).
**Nenhum job de retenção/expurgo é registrado** — confirmado por leitura integral de `scheduler.py` (68 linhas).

> **Por que a correção importa.** A conclusão substantiva do achado original permanece **correta**
> (os prazos declarados não são efetivados por nenhuma rotina). Mas o esforço de remediação foi
> superestimado: não é preciso construir infraestrutura de agendamento, apenas **registrar um
> segundo `add_job`** no scheduler que já existe, roda e já resolve o problema de concorrência
> entre instâncias. Isso muda a estimativa de "projeto" para "tarefa".

**`[ADICIONADO]` Código de limpeza morto:** `InboxService.cleanup_expired_messages()` existe em
`backend/app/services/inbox_service.py:816` mas **nunca é chamado** — `grep -rn "cleanup_expired_messages" backend`
retorna apenas a própria definição. É a evidência de que a limpeza automática foi planejada e não concluída.

Consequências concretas:

| Tabela | Lacuna | Evidência |
|---|---|---|
| `audit_log` | Sem job que apague registros com mais de 5 anos | `backend/app/db/models.py:786` |
| `user_consents` | Sem job de expurgo após 5 anos | `backend/app/db/models.py:709` |
| `push_subscriptions` | **`anonymize_user` não apaga** — endpoint + chaves p256dh/auth sobrevivem à exclusão da conta | `account_deletion.py:52-84` (ausente da lista de deleções) |
| `notification_delivery_log` | **Não apagado** na anonimização; `user_id` é FK `CASCADE` mas a linha `User` é preservada, então o log permanece vinculado | `backend/app/db/models.py:769-771` |
| `phone_verifications` / `email_verifications` | Guardam telefone e e-mail em texto puro; **não apagados** na anonimização | `backend/app/db/models.py:659,680` |
| Projeto/Plano de Vida (**17 tabelas** — `[CORRIGIDO]`, eram citadas 14) | **Não apagados** na anonimização — o exame de consciência sobrevive à exclusão da conta | `account_deletion.py:48-91` |

> **Este é o achado de privacidade mais grave do inventário.** `[COMPROVADO]` por leitura integral de `anonymize_user` (`account_deletion.py:23-91`): a função deleta `UserProfile` (e, em cascata, o contato de emergência), `UserPreferences`, `OrgMembership` e `UserGlobalRole`, e nada mais.
>
> **`[COMPROVADO]` — a cadeia de FK foi verificada e o raciocínio se sustenta.** Confirmado por leitura direta:
> - `life_plan_cycles.user_id` → `users.id ON DELETE CASCADE` (`models.py:1577`)
> - `projetos_vida_mensal.user_id` → `users.id ON DELETE CASCADE` (`models.py:1803`)
> - todas as tabelas-filhas apontam para essas duas raízes, não para `users` diretamente
>   (ex.: `life_plan_diagnoses.cycle_id` → `life_plan_cycles.id CASCADE`, `models.py:1630-1632`;
>   `projetos_vida_exame.projeto_id` → `projetos_vida_mensal.id CASCADE`, `models.py:2063`)
>
> Como a linha `User` é intencionalmente preservada (`is_active=False`), **nenhum elo da cadeia é
> acionado**. `[CORRIGIDO]` — a versão anterior classificava isso como `[INFERIDO]` pendente de
> inspeção do PostgreSQL. A leitura estática das FKs é conclusiva: a raiz da cascata nunca é deletada,
> logo nada abaixo dela é deletado. Não depende do schema físico.

**`[CORRIGIDO]` Contagem exata — 17 tabelas, não 14.** Verificado por
`grep -c '__tablename__ = "life_plan\|__tablename__ = "projetos_vida' backend/app/db/models.py` → `17`:

| Grupo | Tabelas | Total |
|---|---|---|
| `life_plan_*` | `cycles` (1564), `diagnoses` (1618), `cores` (1648), `goals` (1677), `actions` (1707), `spiritual_routines` (1733), `monthly_reviews` (1767) | 7 |
| `projetos_vida_*` | `mensal` (1794), `comunidade` (1884), `cuidado` (1911), `compromissos` (1938), `praticas` (1964), `revisoes` (1990), `areas_mensais` (2016), `exame` (2053), `intercessao` (2086), `semanal` (2116) | 10 |

As três tabelas omitidas na contagem original eram `life_plan_cycles`, `life_plan_cores` e
`projetos_vida_mensal` — justamente **as duas raízes da cascata**, o que torna a omissão relevante
para o plano de correção.

### 6.4. Exclusão de conta — **Blocker B2**

**[COMPROVADO] O backend implementa** `DELETE /auth/me` com anonimização — decorator em
`backend/app/api/routes/auth.py:311`, corpo em `:312-342`. `[CORRIGIDO]` — a versão anterior citava
`:317-341`, que cai dentro da docstring e não na declaração da rota.

**[COMPROVADO] O app mobile NÃO expõe essa função ao titular.**
- A tela de perfil (`lumen_mobile/app/(tabs)/profile.tsx`) oferece apenas **"Sair da Conta"** (logout) — `profile.tsx:384-391,625-627`.
- Não há chamada a `DELETE /auth/me` em nenhum arquivo de `app/` ou `src/` — `grep -rn "auth/me" app src` retorna apenas chamadas `GET`.
- A única UI de "Excluir conta" é **administrativa**, para excluir *outro* usuário: `lumen_mobile/app/admin/users/[id].tsx:222,237`.

**[COMPROVADO] A Política de Privacidade afirma o contrário** — `backend/app/legal_content.py:189`:

> "• Pelo Aplicativo: Perfil → Configurações → Excluir conta"

Esse caminho de navegação **não existe**. Duplo impacto:
1. **App Store Review Guideline 5.1.1(v)** — apps que permitem criação de conta são obrigados a oferecer exclusão de conta iniciada pelo usuário, dentro do app. Rejeição praticamente certa.
2. **LGPD Art. 18, VI** — a política declara um canal que não existe; resta apenas o e-mail.

---

## 7. Compartilhamento com terceiros (operadores)

| Operador | Dado compartilhado | Declarado na política? | Evidência |
|---|---|---|---|
| **Google Firebase** (Auth) | E-mail, senha, tokens | **Sim** — `legal_content.py:151` | `lumen_mobile/src/config/firebase.ts` |
| **Cloudinary** | Imagem de comprovante de pagamento | **NÃO** | `backend/app/api/retreat_routes.py:795`; `backend/app/settings.py:93-96` |
| **SendGrid** (Twilio) | E-mail e conteúdo das mensagens | **NÃO** | `backend/app/notifications/email_service.py:33`; `backend/app/settings.py:88-91` |
| **Sentry** | Stack traces (sem PII por config) | **NÃO** | `lumen_mobile/app/_layout.tsx:29`; `backend/app/main.py:31` |
| **BrasilAPI** | Nenhum dado pessoal | N/A | `lumen_mobile/src/services/brasilApi.ts:6` |
| **Railway** (hospedagem) | Todos | Genericamente — `legal_content.py:152` ("servidores de hospedagem na nuvem") | `lumen_mobile/railway.toml` |

**[COMPROVADO] A seção 5 da política (`legal_content.py:147-153`) lista apenas Firebase + hospedagem genérica.** Cloudinary, SendGrid e Sentry são operadores reais não declarados.

**[COMPROVADO] Conflito com a declaração de base territorial** — `legal_content.py:208`:

> "O Lumen+ opera exclusivamente em território brasileiro. Os dados são armazenados em servidores localizados no Brasil ou em países com nível de proteção equivalente, conforme Art. 33 da LGPD."

Cloudinary, SendGrid, Sentry e Firebase processam dados fora do Brasil. `[INFERIDO]` — a região exata de cada conta contratada é configuração de painel, não determinável pelo código. A adequação ao Art. 33 exige verificação humana das cláusulas contratuais de cada operador.

---

## 8. Achados consolidados

### Blockers de loja

| # | Achado | Evidência | Impacto |
|---|---|---|---|
| **B1** | `lumen_mobile/ios/` e `android/` são scaffold **Flutter**, não prebuild Expo. `applicationId = "com.example.lumen_mobile"` | `lumen_mobile/android/app/build.gradle.kts:9` (`namespace`), `:24` (`applicationId`); `ios/Runner/Info.plist:20` (`$(FLUTTER_BUILD_NAME)`); `AndroidManifest.xml:31` (`flutterEmbedding`); ausência de `ios/Podfile`; `git ls-files` → 19 arquivos em `android/`, 39 em `ios/` (versionados) | Google Play **rejeita** `com.example.*`. Não corresponde a `com.lumenchristi.lumenplus` do `app.json:18` (`ios.bundleIdentifier`) e `app.json:25` (`android.package`) — `[CORRIGIDO]`, antes citado como `app.json:23,27` |
| **B2** | Sem exclusão de conta in-app para o titular | `lumen_mobile/app/(tabs)/profile.tsx:625` (só logout); política afirma que existe em `legal_content.py:189` | App Store 5.1.1(v) |
| **B3** | Nenhum `PrivacyInfo.xcprivacy` no repositório | `find lumen_mobile/ios -name "PrivacyInfo.xcprivacy"` → vazio | Apple exige desde mai/2024 |
| **B4** | Sem `NSCameraUsageDescription` / `NSPhotoLibraryUsageDescription`, apesar de o código pedir as permissões | Pedidos em `profile.tsx:311,326` e `payment.tsx:36,53`; `app.json` não declara `expo-image-picker` em `plugins` (`app.json:27-30`) nem `ios.infoPlist` | Crash no iOS + rejeição |

### Riscos altos

| # | Achado | Evidência |
|---|---|---|
| **B5** | Token de sessão em `AsyncStorage` não criptografado; `expo-secure-store@14.0.1` declarado no `app.json:29` mas nunca importado (`grep` em `app/` e `src/` → 0 ocorrências) | `lumen_mobile/src/config/firebase.ts:53-56`; `src/services/api.ts:13,21,24,27` |
| **B6** (Médio) | `POST /profile/photo` chamado pelo app não existe no backend → 404 **engolido silenciosamente** | `lumen_mobile/app/(onboarding)/profile.tsx:465-468` vs. 8 rotas em `backend/app/api/profile_routes.py:108-329` |
| **R1** | Projeto/Plano de Vida (**17 tabelas**, inclui exame de consciência) **não é apagado** na exclusão de conta | `backend/app/services/account_deletion.py:23-91`; raízes de cascata em `models.py:1577,1803` |
| **R2** | Projeto/Plano de Vida **não é mencionado** na Política de Privacidade | `backend/app/legal_content.py:99-131` |
| **R3** | Cloudinary, SendGrid e Sentry são operadores **não declarados** na política | `backend/app/legal_content.py:147-153` |
| **R4** | Dados de saúde e de religião fora do controle `SENSITIVE_FIELDS` (só CPF/RG) | `backend/app/api/routes/export.py:38` |
| **R5** | `push_subscriptions`, `phone_verifications`, `email_verifications` sobrevivem à anonimização | `backend/app/services/account_deletion.py:52-84` |
| **R6** | Contato de emergência (dado de terceiro não-consentinte) não declarado na política | `backend/app/db/models.py:318-320` vs. `legal_content.py:99-131` |

### Pontos fortes confirmados

- Criptografia AES-256-GCM correta, com nonce aleatório por operação e falha explícita em produção sem chave — `backend/app/crypto/service.py:81-93,122-129`.
- Fluxo formal de aprovação + auditoria para acesso a CPF/RG — `backend/app/db/models.py:1060-1120`.
- Sanitização recursiva de CPF/RG/telefone antes de gravar auditoria — `backend/app/audit/service.py:23-41`.
- `sendDefaultPii: false` no Sentry, cliente e servidor — `lumen_mobile/app/_layout.tsx:34`; `backend/app/main.py:36`.
- Analytics em **opt-in** (default `false`) — `backend/app/db/models.py:735`.
- Allow-list de domínios para URL de foto — `backend/app/api/profile_routes.py:49-65`.
- Sem SDK de publicidade, sem IDFA/AAID, sem geolocalização precisa.
- `.env.local` não rastreado pelo git e coberto pelo `.gitignore` — `lumen_mobile/.gitignore:10`. Confirmado: `git ls-files | grep .env` retorna **apenas** `backend/.env.example` e `lumen_mobile/.env.example`.
- Nenhum secret hardcoded encontrado: todas as credenciais vêm de env (`backend/app/settings.py:78-96` — `[CORRIGIDO]`, o intervalo `:76-84` citado antes não cobria SendGrid nem Cloudinary; `lumen_mobile/src/config/firebase.ts:38-44`).
- **`[ADICIONADO]`** Contato de emergência **é apagado** na exclusão de conta, via `cascade="all, delete-orphan"` (`models.py:290-292`) — o risco R6 é de *transparência na política*, não de retenção indevida.
- **`[ADICIONADO]`** Scheduler usa `pg_try_advisory_lock` para evitar execução duplicada entre instâncias — `backend/app/notifications/scheduler.py:34-36`.

---

## 9. Itens NÃO DETERMINADOS

| Item | Motivo |
|---|---|
| Retenção efetiva de `push_subscriptions`, `notification_delivery_log`, `sensitive_access_audit` | Nenhum prazo declarado na política nem job de expurgo no código |
| Comportamento real do `ON DELETE CASCADE` nas tabelas de Projeto de Vida | Exige inspeção do schema em PostgreSQL real; a leitura estática mostra a FK, mas a linha `User` é preservada, o que impede o disparo |
| Região geográfica de processamento de Cloudinary, SendGrid, Sentry e Firebase | Configuração de painel de cada serviço, fora do código |
| Se as fotos de perfil já existentes em produção estão no Firebase Storage ou Cloudinary | A allow-list aceita ambos (`profile_routes.py:49-51`); requer consulta ao banco de produção |
| Existência de DPA/contrato de operador assinado com Cloudinary, SendGrid e Sentry | Documento jurídico, fora do repositório |
| Se o backend valida tokens Firebase corretamente | `firebase-admin` está **comentado** em `backend/requirements.txt:18` (`# firebase-admin==6.3.0`, sob o comentário "Auth (quando implementar Firebase)"); a verificação usa `python-jose` (`requirements.txt:22`) + `cachetools` (`:21`). `[CORRIGIDO]` — antes citado como `:23` e `:27`, que são `cryptography==42.0.2` e uma linha em branco. Fora do escopo deste inventário; **merece revisão de segurança dedicada** |

---

## 10. Ações humanas necessárias

Ver `human_blockers` no relatório estruturado. Resumo:

1. **Jurídico/DPO** — atualizar a Política de Privacidade para incluir: Projeto/Plano de Vida, contato de emergência, e os operadores Cloudinary, SendGrid e Sentry; e corrigir a declaração de base territorial (`legal_content.py:208`).
2. **Jurídico/DPO** — corrigir `legal_content.py:189`, que promete um caminho de exclusão de conta inexistente.
3. **Produto/Eng** — decidir e implementar a exclusão de conta in-app (bloqueia a App Store).
4. **Eng** — decidir o destino do scaffold Flutter em `lumen_mobile/ios/` e `android/` antes de qualquer `expo prebuild`.
5. **DPO** — avaliar se o tratamento de convicção religiosa + saúde exige RIPD (Relatório de Impacto, LGPD Art. 38).
6. **Eng** — `[REVISADO]` estender `anonymize_user` para deletar as **duas raízes** de Projeto de Vida (`life_plan_cycles`, `projetos_vida_mensal`); as outras 15 tabelas caem por cascata. Também `push_subscriptions`, `phone_verifications` e `email_verifications`.
7. **Eng** — `[REVISADO]` registrar um job de expurgo no scheduler **já existente** (`backend/app/notifications/scheduler.py:54`). Não requer nova infraestrutura: o `AsyncIOScheduler` e o advisory lock já estão em produção.

---

## 11. Registro da revisão adversarial (2026-08-06)

Segunda passagem independente, com tentativa deliberada de **refutar** cada achado da primeira versão.

### 11.1. Veredito

**CORRIGIDO** — nenhum achado substantivo foi refutado; a espinha dorsal do inventário se sustenta.
Foram corrigidas imprecisões de citação, uma contagem e uma afirmação enganosa sobre esforço de remediação.

### 11.2. Achados confirmados sem alteração (verificados linha a linha)

| Achado | Status da verificação |
|---|---|
| B1 — scaffold Flutter versionado | **Confirmado exatamente**: `build.gradle.kts:9,24`, `AndroidManifest.xml:31`, `Info.plist:20`, sem `ios/Podfile`, 58 arquivos rastreados no git |
| B2 — sem exclusão de conta in-app | **Confirmado**: `grep` por `api.delete` em `app/` e `src/` retorna 11 chamadas, **nenhuma** para `/auth/me`; única UI é admin (`admin/users/[id].tsx:222,237`) |
| B3 — sem `PrivacyInfo.xcprivacy` | **Confirmado**: `find` no repo → 0 fora de `node_modules` |
| B4 — sem `NSCameraUsageDescription`/`NSPhotoLibraryUsageDescription` | **Confirmado**: `Info.plist` tem 49 linhas, nenhuma chave `NS*UsageDescription`; permissões pedidas em `profile.tsx:311,326` e `payment.tsx:36,53` |
| B5 — token em `AsyncStorage` | **Confirmado**: `expo-secure-store@14.0.1` instalado, 0 imports |
| R1 — Projeto de Vida sobrevive à exclusão | **Confirmado e reforçado** (cadeia de FK rastreada até a raiz) |
| R2 — política omite Projeto de Vida | **Confirmado**: `legal_content.py:99-131` lido integralmente |
| R3 — Cloudinary/SendGrid/Sentry não declarados | **Confirmado**: política lista só Firebase (`:151`) e hospedagem genérica (`:152`) |
| R4 — `SENSITIVE_FIELDS = {"cpf","rg"}` | **Confirmado exatamente** em `export.py:38`; uso em `:325` |
| R5 — `push_subscriptions`/verificações sobrevivem | **Confirmado**: ausentes de `anonymize_user` |
| `@sentry/react` é SDK web | **Confirmado**: `node_modules/@sentry/` contém `browser`, `core`, `react` — **não** `react-native` |
| Criptografia AES-256-GCM | **Confirmado exatamente**: `crypto/service.py:81-93,122-129,177-183` |
| Zero SDK de ads/tracking, sem IDFA, sem geolocalização | **Confirmado**: `package.json` lido integralmente (34 deps); 0 ocorrências de `firebase/analytics` |
| Nenhum secret hardcoded | **Confirmado**; **nenhum secret vazou para este documento** (varredura por padrões de chave/token/DSN → 0) |

### 11.3. Correções aplicadas

**Correção material (muda decisão ou esforço):**

| # | Erro | Correção |
|---|---|---|
| C1 | "Não encontrei rotina de expurgo (cron/scheduler)" — sugeria ausência de infraestrutura | **Existe scheduler APScheduler ativo** (`scheduler.py`, `main.py:81-87`) com 1 job de notificação e nenhum de expurgo. Conclusão mantida, **esforço de remediação cai de "projeto" para "tarefa"** |
| C2 | "14 tabelas" de Projeto de Vida | **17 tabelas**. As 3 omitidas incluíam as duas raízes da cascata (`life_plan_cycles`, `projetos_vida_mensal`) — relevantes para o plano de correção |
| C3 | R1 marcado `[INFERIDO]`, pendente de inspeção no PostgreSQL | **Promovido a `[COMPROVADO]`**: as FKs foram rastreadas até `users.id`; a leitura estática é conclusiva |
| C4 | B6 classificado como severidade Alta | **Rebaixado para Média**: erro engolido por `try/catch` vazio (`profile.tsx:465-468`) |

**Correções de citação (substância inalterada):**

| # | Citado | Real |
|---|---|---|
| C5 | Cloudinary em `retreat_routes.py:721` (4 ocorrências no doc) | `:16-17`, `:715`, `:771-774`, **`:795`** (`:721` é `).scalar_one_or_none()`) |
| C6 | Cloudinary em `settings.py:82-84` | `settings.py:93-96` |
| C7 | SendGrid em `settings.py:77` | `settings.py:88-91` |
| C8 | `firebase-admin` comentado em `requirements.txt:23` | `requirements.txt:18` (`:23` é `cryptography==42.0.2`) |
| C9 | `python-jose` em `requirements.txt:27` | `requirements.txt:22` |
| C10 | IP/User-Agent em `audit/service.py:64-67` | `audit/service.py:59-62` |
| C11 | Regexes de sanitização em `audit/service.py:16,17-18,19,23-41` | `:15`, `:16-17`, `:18`, `:22-40` |
| C12 | `account_deletion.py:56-57 / 60-64 / 70-73 / 76-78 / 81` | `:53-54 / :57-61 / :64-67 / :70-74 / :77` |
| C13 | `DELETE /auth/me` em `auth.py:317-341` | decorator em `auth.py:311` |
| C14 | Bundle/package em `app.json:23,27` | `app.json:18` (iOS) e `:25` (Android) |
| C15 | `VercelAnalytics.web.tsx:4-6` | `:3-5` (o arquivo tem 5 linhas) |
| C16 | BrasilAPI em `brasilApi.ts:23,32` / `:24,33` | `:22` e `:30-31` |
| C17 | `analytics_opt_in` — 3 ocorrências listadas | 7 ocorrências (todas de escrita/tipo; conclusão inalterada) |

### 11.4. Achados adicionados pela revisão

| # | Achado | Evidência | Gravidade |
|---|---|---|---|
| A1 | `InboxService.cleanup_expired_messages()` está definido mas **nunca é chamado** — limpeza planejada e não concluída | `backend/app/services/inbox_service.py:816`; `grep` no repo → só a definição | Baixa |
| A2 | Contato de emergência **é** apagado na anonimização (`cascade="all, delete-orphan"`) — contraria a leitura pessimista e explica estruturalmente por que o Projeto de Vida sobrevive | `backend/app/db/models.py:290-292,313-316` | Info (ponto forte) |
| A3 | O erro do upload de foto é suprimido por `catch {}` vazio — falha 100% silenciosa para o usuário | `lumen_mobile/app/(onboarding)/profile.tsx:465-468` | Média |

### 11.5. O que a revisão NÃO conseguiu verificar

- Se o schema **físico** em PostgreSQL corresponde aos modelos SQLAlchemy (migrações Alembic não foram executadas). Para R1 isso é irrelevante — a raiz da cascata não é deletada em nenhuma hipótese —, mas afeta qualquer conclusão sobre constraints aplicadas de fato.
- Correção da validação de JWT do Firebase via `python-jose` (assinatura, `iss`, `aud`, `exp`, rotação de certificado x509). **Permanece exigindo revisão de segurança dedicada.**
- Região geográfica de processamento dos operadores — configuração de painel, fora do código.

---

*Documento gerado por auditoria estática read-only e submetido a revisão adversarial independente. Nenhum arquivo de código foi modificado. Nenhum valor de chave, token ou senha foi lido ou reproduzido.*
