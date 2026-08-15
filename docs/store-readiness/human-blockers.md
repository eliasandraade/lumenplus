# Blockers humanos — ações que EU não posso executar

**Data:** 2026-08-06. Cada item diz **exatamente** qual conta, qual tela, qual
campo e qual valor. Nada aqui é "preciso de acesso" genérico.

Ordenados por **quando** precisam acontecer.

---

## GRUPO A — Sem isto, nenhuma build de loja existe

### A1. Criar/vincular o projeto no Expo (EAS)
| | |
|---|---|
| **Plataforma** | expo.dev |
| **Conta** | conta/organização Expo do Lumen+ |
| **Tela** | expo.dev → Projects → *Create a project* (ou abrir o existente) |
| **Campo/valor** | slug `lumen-plus`; copiar o **Project ID** (UUID) e o **owner** (nome da conta) |
| **Onde entra** | `lumen_mobile/app.json` → `expo.extra.eas.projectId` e `expo.owner` |
| **Por quê** | `app.json` não tem `extra.eas.projectId` nem `owner`. `eas build` não resolve o projeto e falha **antes de compilar**. |
| **Risco** | nenhum. **Custo:** conta Expo gratuita serve para começar. **Rollback:** remover os campos. |

### A2. Apple Developer Program
| | |
|---|---|
| **Plataforma** | developer.apple.com |
| **Conta** | Apple ID da organização (não pessoal, se houver entidade jurídica) |
| **Ação** | Matricular no Apple Developer Program |
| **Campo/valor** | anotar o **Team ID** (10 caracteres) |
| **Por quê** | Sem programa ativo não há certificado, provisioning nem App Store Connect. |
| **Custo** | **USD 99/ano** (recorrente). **Não posso pagar.** |
| **Risco** | matrícula como *Individual* publica o app com **seu nome pessoal**; como *Organization* exige D-U-N-S da entidade. Decisão institucional. |

### A3. Google Play Console
| | |
|---|---|
| **Plataforma** | play.google.com/console |
| **Ação** | Criar conta de desenvolvedor + verificação de identidade |
| **Campo/valor** | criar o app com package **`com.lumenchristi.lumenplus`** |
| **Custo** | **USD 25** (taxa única). **Não posso pagar.** |
| **Risco** | contas novas de desenvolvedor **pessoal** podem estar sujeitas a **teste fechado obrigatório com 12+ testadores por 14 dias** antes de publicar em produção. **Verificar o estado real da conta** — não assumir. |

---

## GRUPO B — Sem isto, a build existe mas não sobe

### B1. Credenciais de submissão iOS
| | |
|---|---|
| **Tela** | App Store Connect → Users and Access → Integrations → **App Store Connect API** |
| **Campo/valor** | gerar chave `.p8` → anotar **Key ID**, **Issuer ID**; e o **ASC App ID** (número do app) |
| **Onde entra** | `lumen_mobile/eas.json` → `submit.production.ios` (`appleId`, `ascAppId`, `appleTeamId`) — já deixei o bloco pronto marcado `PENDENTE HUMANO` |
| **Segurança** | **NUNCA** versionar o `.p8`. Usar EAS Credentials / variáveis de ambiente. |

### B2. Service account do Google Play
| | |
|---|---|
| **Tela** | Play Console → Setup → **API access** → criar service account no Google Cloud → conceder *Release manager* |
| **Campo/valor** | baixar o JSON → apontar em `eas.json` → `submit.production.android.serviceAccountKeyPath` |
| **Segurança** | **NUNCA** versionar o JSON. Manter fora do repositório. |

---

## GRUPO C — Decisões de produto/jurídico que eu não posso tomar

### C1. Domínio de API de produção
| | |
|---|---|
| **Problema** | O fallback era `https://api.lumenplus.app`, que **não resolve em DNS**. Já troquei por **falha explícita** (o build quebra em vez de embarcar host morto). |
| **Decisão** | Qual é a URL de produção definitiva? `https://backend-production-6efc.up.railway.app` **responde 200** e é a referenciada na CSP — mas um domínio `*.up.railway.app` em app de loja é frágil (a plataforma pode mudá-lo). Recomendo **domínio próprio** com DNS apontado. |
| **Onde entra** | `eas.json` → `build.production.env.EXPO_PUBLIC_API_URL` (deixei **vazio de propósito**) |
| **Risco de errar** | app publicado que não conecta — só corrigível com nova submissão. |

### C2. Vigência da Política de Privacidade v1.4 (PR #17)
| | |
|---|---|
| **Situação** | PR #17 está **aberto e não mergeado**, por decisão. O deploy roda `alembic upgrade head` no boot, então **mergear publica a política e força re-aceite de 100% dos usuários**. |
| **Decisão humana** | data de vigência e comunicação aos usuários. |
| **Urgência** | **ALTA** — a produção ainda serve a v1.3, que expõe o **e-mail pessoal** do DPO anterior. O DPO aprovado é **Felipe Rocha Pinheiro Bastos** / `lgpd@lumenserfeliz.org`. |

### C3. Conformidade de pagamento (IAP)
| | |
|---|---|
| **Situação** | O app exibe **instrução de pagamento externo** (Pix/transferência) e coleta **comprovante** dentro do app (`retreats/[id]/payment.tsx`). |
| **Decisão** | Retiro é **serviço presencial**, o que normalmente **isenta** de IAP (Apple 3.1.3(e) / Google). Mas o formato atrai escrutínio na revisão. Confirmar com quem responde juridicamente e preparar a justificativa nas *review notes*. |

### C4. Canal de suporte e conteúdo do EULA
| | |
|---|---|
| **Campo** | e-mail e/ou URL de suporte público (obrigatório nas duas lojas) |
| **Por quê** | Não invento endereço de contato nem texto jurídico. |

### C5. Arte final dos ícones
| | |
|---|---|
| **Situação** | `assets/icon.png`, `adaptive-icon.png` e `splash.png` são **192×192, 1.328 bytes** — placeholders. O próprio script do repo (`scripts/check-assets.mjs`) **reprova** todos (exit 1). |
| **Necessário** | ícone **1024×1024 PNG sem canal alpha** (App Store), 512×512 (ficha do Play), splash ≥ 1024×1024, feature graphic 1024×500 (Play). |
| **Observação** | existe `assets/icon.svg` (775 KB) que **pode** ser a arte real — precisa de aprovação de quem responde pela marca antes de eu derivar os PNGs. |

---

## GRUPO D — Infraestrutura

### D1. Push nativo (decisão de escopo)
Hoje existe **apenas Web Push** (Service Worker + VAPID). Em binário nativo o app
**não tem notificações**. Se a ficha da loja prometer avisos, a afirmação é falsa.
Para ter push nativo: projeto Firebase iOS/Android, `google-services.json`,
`GoogleService-Info.plist`, **APNs Auth Key** (Apple) e `expo-notifications`.
**Decisão:** entra no v1.0 ou fica para a v1.1 (e a ficha não promete push)?

### D2. Prometheus/Grafana para as métricas
`/metrics` existe e está protegido por token em produção, mas **ninguém o raspa**.
Provisionar um Prometheus (ou Grafana Cloud) e importar `ops/observability/`.

### D3. Confirmar hops de proxy do Railway
`trusted_proxy_hops=1` (default) assume **um** proxy à frente. Se houver CDN
adicional, ajustar — senão o rate limit por IP fica incorreto.

---

## O que **deixou** de ser blocker nesta rodada

| Antes | Agora |
|---|---|
| Railway CLI deslogado | **resolvido** — autenticado |
| `backend-staging` "403 / sem deployment" | **resolvido** — era **hostname errado**; o domínio real é `backend-staging-staging-3d47.up.railway.app` e responde **200** |
| Carga nunca executada | **executada** — ramp 10→250 real contra staging |
| Sem tela de exclusão de conta no app | **implementada** (`app/account/delete.tsx`) |
| Permissões de câmera/fotos não declaradas | **declaradas** |
| `android/`+`ios/` com scaffolding Flutter | **removidos** e gitignored |

---

## GRUPO D — Novos, revelados nesta rodada

### D1. Escolher a estratégia de assinatura Android

| | |
|---|---|
| **Decisão** | **Play App Signing** (Google guarda a chave) **ou keystore próprio** |
| **Por quê** | O AAB atual sai com `CN=Android Debug` — confirmado por `apksigner`. O Google Play recusa |
| **Já pronto** | O código lê as credenciais do ambiente (`plugins/withReleaseSigning.js`); falta só a chave |
| **Risco do keystore próprio** | **perder o arquivo = nunca mais poder atualizar o app.** Só resta republicar sob outro `applicationId`, perdendo instalações e avaliações |
| **Recomendação** | Play App Signing — a *upload key* é recuperável |
| **Custo** | zero |
| **Quem** | responsável pela conta do Google Play. **Não gerar o keystore de produção em máquina compartilhada** |

Runbook completo: [`android-release-signing.md`](android-release-signing.md).

### D2. Declarar dado sensível — decisão do Encarregado

| | |
|---|---|
| **Decisão** | Confirmar a declaração de **crença religiosa** e **saúde** nas duas lojas |
| **Por quê** | O perfil coleta 7 campos de vida religiosa (realidade vocacional, ano de consagração, acompanhamento, estado de vida) e 2 de saúde (restrição alimentar, plano). Ambas são categorias **sensíveis** para Apple e Google |
| **Risco de não declarar** | **Sub-declarar dado sensível é causa comum de remoção do app**, inclusive depois de publicado |
| **Alternativa** | Se a coordenação não quiser declarar, o caminho **não é omitir** — é **deixar de coletar** os campos |
| **Quem** | Felipe Rocha Pinheiro Bastos — `lgpd@lumenserfeliz.org` |
| **Custo** | zero |

Respostas prontas: [`store-privacy-declarations.md`](store-privacy-declarations.md).

### D3. URL pública de exclusão de conta

| | |
|---|---|
| **Ação** | Publicar a página de exclusão num endereço **público, sem login** |
| **Por quê** | O Google Play **exige** essa URL no formulário de Data Safety |
| **Já pronto** | A tela existe (`lumen_mobile/app/excluir-conta.tsx`) |
| **Falta** | O domínio de produção definitivo |
| **Custo** | depende do domínio já contratado |

### D4. Conflito Apple × retenção legal na exclusão de conta

| | |
|---|---|
| **Decisão** | Se `retreat_registrations` deve ser reduzido a campos estritamente financeiros na exclusão |
| **Por quê** | A Apple (5.1.1(v)) espera exclusão do registro da conta; a retenção de 5 anos sobre registro financeiro colide com a leitura mais literal |
| **Postura atual** | Excluir todo dado pessoal e romper o vínculo de identidade, retendo só o mínimo com base legal **declarada na Política de Privacidade** — que é o que a Apple aceita |
| **Quem** | Encarregado |

Matriz completa: [`account-deletion-data-map.md`](account-deletion-data-map.md).

---

## Atualização — o que saiu da lista nesta rodada

| Antes | Agora |
|---|---|
| Expo SDK 52 não compila contra Xcode 26 (bloqueio da Apple) | **SDK 54** — menor versão estável que atende Xcode 26 **e** target API 36 |
| Target API 36 só comprovado em `gradle.properties` | **provado no artefato**: `aapt2` no APK e `bundletool` no AAB |
| Android release nunca compilado | **BUILD SUCCESSFUL** — APK 90 MB, AAB 57 MB |
| Sem `PrivacyInfo.xcprivacy` | declarado via `ios.privacyManifests` (falta o CI validar o gerado) |
| Exclusão de conta deixava telefone, e-mail e push para trás | **corrigido**, com teste que percorre a matriz de dados |
| Sem aceite de diretrizes antes de publicar (Apple 1.2) | **implementado**, versionado, com 428 e re-aceite automático |

---

## DECISÕES TOMADAS — 2026-08-15

Registrado a partir de confirmação direta da coordenação.

| # | Decisão | Efeito |
|---|---|---|
| **D1** | **Play App Signing** — o Google guarda a chave | Elimina o risco de perder o keystore e nunca mais poder atualizar o app. A *upload key* é recuperável. Nada a fazer no código: o mecanismo fail-closed já está pronto e testado |
| **D2** | Domínio de produção | **ainda pendente** — "vou configurar em breve" |
| **D3** | Contato de suporte **e** de moderação: `applumenplus@gmail.com` | Já gravado em `app.json` → `expo.extra`. O app lê via `src/config/contacts.ts` |
| **D4** | **Declarar tudo o que se coleta**, incluindo crença religiosa e saúde | É a leitura correta. As fichas de App Privacy e Data Safety em [`store-privacy-declarations.md`](store-privacy-declarations.md) já estão preenchidas nessa premissa e podem ser usadas como estão |

### Sobre D3 — uma observação que não é técnica

O mesmo endereço atende suporte e denúncia de conteúdo. Funciona para as
lojas, mas vale registrar: a Apple espera que denúncia de conteúdo censurável
tenha **resposta em prazo razoável**. Um endereço sem dono definido tende a
acumular. Não é bloqueio de publicação — é risco operacional depois dela.

### Sobre D4 — o que ainda cabe decidir depois

Declarar tudo é a decisão certa e destrava a submissão. As duas sugestões de
**minimização** seguem valendo como melhoria futura, não como pendência:

- mover **saúde** (restrição alimentar, plano) para a inscrição do retiro, em
  vez do cadastro geral;
- reavaliar o **RG**, já que o CPF identifica e dois documentos para a mesma
  finalidade é coleta excedente.

Ambas reduziriam a superfície sensível sem perder função.

### O que resta

Apenas **D2 (domínio)**. Ele sozinho destrava: URL pública de exclusão de conta
(exigida pelo Data Safety), URL da Política de Privacidade, Android App Links e
iOS Universal Links.
