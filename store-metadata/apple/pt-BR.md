# App Store Connect — Metadados pt-BR (rascunho)

> **Status:** RASCUNHO derivado do código-fonte. Nenhum campo foi inventado.
> Toda funcionalidade descrita abaixo foi lida no código do app (`lumen_mobile/app/`).
> Campos que dependem de dado jurídico/institucional estão marcados `[PENDENTE HUMANO]`.
>
> **Verificado adversarialmente** em 2026-08-06: segunda passagem independente reabriu cada `arquivo:linha` citado. Uma claim falsa na descrição foi corrigida, dois achados novos foram acrescentados e seis citações foram ajustadas. Registro completo na **seção 13**.
>
> **Base:** `lumen_mobile/app.json` → `name: "Lumen+"`, `version: "1.0.0"`, `bundleIdentifier: com.lumenchristi.lumenplus`, `supportsTablet: true`, `userInterfaceStyle: "automatic"`.

---

## 1. Nome do app (limite 30 caracteres)

**Recomendado:**

```
Lumen+
```

`6/30` — idêntico a `expo.name` em `lumen_mobile/app.json:3`. Mantém paridade com o nome já usado no produto.

**Alternativa (se for necessário reforçar descoberta):**

```
Lumen+ Comunidade Católica
```

`26/30`

> Decisão entre as duas opções = decisão de marca. Não é dado que eu possa deduzir do código. `[PENDENTE HUMANO — escolha do nome final]`

---

## 2. Subtítulo (limite 30 caracteres)

```
Vida comunitária e espiritual
```

`29/30`

Justificativa: os dois eixos reais do app no código são (a) vida espiritual — orações/Liturgia/Bíblia/Catecismo/Projeto de Vida — e (b) vida comunitária — convites, inbox, canal da unidade, membros, retiros.

---

## 3. Texto promocional (limite 170 caracteres)

```
Liturgia Diária, Bíblia e Catecismo offline, Projeto de Vida mensal, inscrição em retiros e os avisos da sua comunidade — reunidos em um único aplicativo.
```

`154/170`

---

## 4. Descrição (limite 4000 caracteres)

```
O Lumen+ reúne, em um único aplicativo, a vida de oração e a vida comunitária de comunidades católicas. Para usar o aplicativo é preciso criar uma conta. Os recursos de comunidade — convites, canal da unidade e lista de membros — ficam disponíveis conforme o vínculo de cada pessoa com as unidades da comunidade.

ORAÇÃO E FORMAÇÃO
• Liturgia Diária: primeira leitura, salmo responsorial, segunda leitura e Evangelho do dia, com a cor litúrgica em destaque. Requer conexão com a internet.
• Bíblia Ave Maria completa: 73 livros, organizados por Antigo e Novo Testamento, com busca por livro e leitura por capítulo e versículo. Funciona offline.
• Catecismo da Igreja Católica: 2.537 parágrafos, com leitura paginada, busca por palavra e acesso direto pelo número do parágrafo. Funciona offline.
• Mistérios do Santo Terço: Gozosos, Luminosos, Dolorosos e Gloriosos, apresentados conforme o dia da semana.
• Orações tradicionais: Pai Nosso, Ave Maria, Glória, Oração de Fátima, Salve Rainha, Credo Apostólico, Confiteor, Ato de Abandono, Oração de São Francisco, Alma de Cristo, Magnificat, Stabat Mater, entre outras.
• Versículo do dia na tela inicial.

PROJETO DE VIDA
Um caderno espiritual pessoal, organizado em ciclos mensais.
• Criação do ciclo por um roteiro guiado, passo a passo: motivação, ciclo mensal, família vocacional, ministério, grupo formativo, saúde e lazer, família de origem, evangelização, intercessão e privacidade.
• Projeto semanal em quatro etapas: semana, dever de estado, vida interior e evangelização.
• "Amanhã com o Emanuel": preparação do dia seguinte.
• Revisão mensal do ciclo.
• Exame de Consciência ao fim do ciclo — sempre sugerido, nunca obrigatório.
• Histórico dos ciclos anteriores.
• O ciclo pode ser protegido por um PIN de 4 dígitos.

COMUNIDADE
• Convites para setores, ministérios e grupos, aceitos ou recusados pelo próprio membro.
• Inbox com os avisos e comunicações da coordenação, com marcação de lidos.
• Canal da unidade: publicações e respostas entre membros, com moderação da coordenação (fixar, destacar e remover publicações).
• Lista de membros da unidade.
• Área de coordenação: gestão de membros e envio de convites nas unidades que a pessoa coordena.

RETIROS
• Lista de retiros com datas, local, tipo e valor.
• Inscrição pelo aplicativo.
• Envio do comprovante de pagamento por foto da câmera ou da galeria. O pagamento em si é feito fora do aplicativo.
• Acompanhamento do status da inscrição: aguardando pagamento, comprovante enviado, confirmado ou lista de espera.

ADMINISTRAÇÃO (apenas para perfis autorizados)
• Painel com indicadores, gestão de usuários e das entidades da hierarquia.
• Criação e envio de avisos, com histórico dos avisos enviados.
• Gestão completa de retiros e inscrições.
• Registros de auditoria e fluxo de aprovação para acesso a documentos sensíveis.

CONTA, PERFIL E PRIVACIDADE
• Cadastro com e-mail e senha, com verificação de e-mail e de telefone.
• Aceite dos Termos de Uso e da Política de Privacidade no primeiro acesso.
• Perfil com dados pessoais, informações de comunidade, preferências para retiros e contato de emergência.
• CPF e RG são solicitados no cadastro e armazenados de forma criptografada no servidor. O acesso administrativo a esses documentos exige solicitação, aprovação e fica registrado em auditoria.

O aplicativo funciona em modo claro e escuro, acompanhando a preferência do sistema.
```

`3407/4000` (contado com `node`; ver seção 10)

**Claims deliberadamente NÃO incluídas** (não comprovadas para iOS):
- **Notificações push:** o código de push (`lumen_mobile/src/services/push.ts:17`) é **exclusivamente web** — a função retorna `false` se não houver `serviceWorker` em `navigator` e `PushManager` em `window`; o registro usa Service Worker + Web Push/VAPID (`:29-35`). O card de permissão só aparece com `Platform.OS === 'web'` (`lumen_mobile/app/(tabs)/home.tsx:50`). Não há `expo-notifications` em `lumen_mobile/package.json`. **Não prometer push no app iOS.**
- **"A equipe não acessa seu Projeto de Vida":** frase existe na UI (`app/vida/index.tsx:362`), mas não consegui comprovar no código do backend que o conteúdo é inacessível ao servidor. Não usar como claim de loja.
- **Superlativos** ("o melhor", "o mais completo") e nomes de concorrentes: ausentes por regra.

---

## 5. Palavras-chave (limite 100 caracteres, separadas por vírgula)

```
católico,liturgia,bíblia,catecismo,terço,rosário,oração,retiro,ministério,fé,pastoral,evangelização
```

`99/100`

Regras aplicadas: sem espaço após a vírgula (espaço conta caractere), sem repetir palavras já presentes no nome/subtítulo, sem marca de terceiros.

---

## 6. Categorias

| Campo | Sugestão | Justificativa (baseada no código) |
|---|---|---|
| **Primária** | **Estilo de Vida** (Lifestyle) | O núcleo do app é acompanhamento de vida espiritual e pertencimento comunitário: Projeto de Vida (`app/vida/`), convites, canal, retiros. Não há categoria "Religião" na App Store; Lifestyle é a categoria usual para apps devocionais/comunitários. |
| **Secundária** | **Referência** (Reference) | Dois módulos são acervos de consulta offline embarcados: Bíblia (`assets/biblia.json`, 73 livros) e Catecismo (`assets/catecismo.json`, 2.537 §), com busca e navegação — `app/biblia/`, `app/catecismo/`. |

> Alternativa defensável para a secundária: **Livros**, se a estratégia for enfatizar o acervo. Decisão de posicionamento. `[PENDENTE HUMANO — confirmação de categoria]`

---

## 7. Classificação etária sugerida

**Sugestão: 4+**

Justificativa, item a item, com base no que existe no código:

| Critério do questionário Apple | Situação no app | Evidência |
|---|---|---|
| Violência (realista, cartunesca, sádica) | Inexistente | Nenhuma tela de jogo/mídia violenta em `lumen_mobile/app/` |
| Conteúdo sexual / nudez | Inexistente | — |
| Álcool, tabaco, drogas | Inexistente | — |
| Jogos de azar / apostas | Inexistente | Não há motor de sorteio, aposta ou moeda virtual |
| Compras no app (IAP) | **Não há** | Retiro exibe valor em BRL e o app só recebe **upload de comprovante** (`app/retreats/[id]/payment.tsx`). Nenhuma biblioteca de IAP/pagamento em `package.json` |
| Horror / temas maduros | Inexistente | Conteúdo devocional católico (orações, Liturgia, Catecismo) |
| Acesso irrestrito à web | **Não** | Só há fetch de API própria e da API de liturgia; não há WebView de navegação livre |
| **Conteúdo gerado por usuários** | **SIM — existe** | Canal da unidade permite posts e respostas entre membros (`app/channel/[unitId].tsx`, `src/services/channel.ts`) |
| Localização do usuário compartilhada | Não | Não há `expo-location` em `package.json` |

**⚠️ Risco identificado (não é opinião — é ausência verificada no código):**
o app tem **conteúdo gerado por usuário** (posts + respostas no canal) e **não possui denúncia de conteúdo nem bloqueio de usuário**. Busca por `denunc|report|bloquear|block` em `app/channel/` e `src/services/channel.ts` retornou **zero ocorrências**. Existe apenas moderação por coordenador (remover com motivo — `src/services/channel.ts:99-100`; fixar/destacar — `:102-106`).

A App Review Guideline 1.2 (User-Generated Content) exige, para apps com UGC: filtro de conteúdo ofensivo, **mecanismo de denúncia**, **bloqueio de usuários abusivos** e canal de contato.

Atenuante **comprovado no backend**: o canal é fechado — toda rota de canal chama `_require_active_member`, que retorna 403 a quem não é membro ativo da unidade (`backend/app/api/channel_routes.py:65-72`, aplicado em todas as rotas do arquivo). O contrato `can_post`/`can_moderate` é resolvido no servidor (`ChannelSettings` em `src/services/channel.ts:43-48`; regras em `backend/app/api/channel_routes.py:80-87`).

Agravante **também comprovado**: a criação de **respostas não tem trava de papel** — qualquer membro ativo pode responder (`backend/app/api/channel_routes.py:359-363`, sem checagem de `can_post`). Só a criação de *posts* depende de `channel_post_mode` (`COORDINATOR_ONLY` | `ALL_MEMBERS` — `backend/app/db/models.py:85-87`). Ou seja: mesmo em unidades no modo mais restrito, **existe UGC aberto a todos os membros**. O argumento "canal fechado" reduz o alcance, mas **não elimina** o UGC exigido pela 1.2.

Consequência prática: **4+ é a classificação correta pelo conteúdo**, mas a submissão pode ser rejeitada por 1.2 antes de chegar à classificação. Decisão de produto (implementar denúncia/bloqueio vs. argumentar canal fechado na App Review) → `[PENDENTE HUMANO]`.

---

## 8. Notas da versão 1.0.0 (release notes)

```
Primeira versão do Lumen+.

• Liturgia Diária com as leituras e a cor litúrgica do dia.
• Bíblia Ave Maria completa (73 livros) e Catecismo da Igreja Católica (2.537 parágrafos), ambos offline.
• Mistérios do Santo Terço conforme o dia da semana e orações tradicionais.
• Projeto de Vida: ciclo mensal, projeto semanal, preparação do dia seguinte, revisão mensal, Exame de Consciência e histórico de ciclos.
• Convites para setores, ministérios e grupos.
• Inbox de avisos da coordenação e canal da unidade.
• Retiros: inscrição pelo app e envio do comprovante de pagamento.
• Painel de administração e de coordenação para os perfis autorizados.
• Modo claro e modo escuro.
```

---

## 9. Campos que NÃO consigo preencher — `[PENDENTE HUMANO]`

| Campo do App Store Connect | Por que não posso preencher | O que é preciso |
|---|---|---|
| **Support URL** (obrigatório) | Não existe URL de suporte no repositório | Publicar uma página de suporte e informar a URL |
| **Marketing URL** (opcional) | Não existe site de marketing no repositório | Definir se haverá |
| **Privacy Policy URL** (obrigatório) | O repositório registra `https://lumenplus.app/privacidade` como **"URL pública futura"**, ainda não publicada (`docs/ops/lgpd/politica-privacidade-draft.md:7`). O próprio doc diz "publicação user-facing pendente" | Publicar a política nessa URL e confirmar que responde publicamente |
| **Copyright** | Não há string de copyright no código | Formato Apple: `<ano> <titular>`. O controlador documentado no repo é "Obra Lumen de Evangelização" (`docs/ops/lgpd/dpo-designacao.md:31`) — **confirmar com o jurídico** antes de usar |
| **Nome do vendedor / titular da conta** | Depende da conta Apple Developer, que ainda não existe (`docs/ops/mobile-store-readiness.md:67`) | Criar/confirmar conta Apple Developer |
| **E-mail e telefone de contato da App Review** | Dado pessoal/institucional | Fornecer |
| **Conta de demonstração para a App Review** | O app **exige login** (`app/index.tsx:41-45`) e, depois do login, **bloqueia o acesso** até aceite de termos, CPF+RG e perfil em dia (`app/(tabs)/_layout.tsx:18-39`). Sem credencial de teste a revisão é rejeitada por 2.1. **Correção:** vínculo com unidade **não** é exigido para entrar — `grep memberships.length` em `app/` e `src/` = 0 resultados; nenhum gate de membership no roteamento | Criar usuário de demonstração já com termos aceitos, **CPF e RG preenchidos**, membership ativa em uma unidade (para exibir canal/membros) e, se possível, um retiro visível |
| **Exigência de CPF e RG para usar o app** (risco 5.1.1(i)) | **Verificado: é obrigatório.** No cadastro há validação de dígito verificador de CPF e RG mínimo (`app/(auth)/register.tsx:281-282`) + checagem de unicidade em `/auth/check-cpf` (`:294`). Para contas antigas, o app **redireciona à força** para `complete-documents` enquanto `has_documents === false` (`app/(tabs)/_layout.tsx:27-29`), tela que exige 11 dígitos de CPF e RG não vazio (`app/(onboarding)/complete-documents.tsx:47-48`). Resultado: **não é possível ler a Bíblia, o Catecismo ou as orações sem informar documento de identidade nacional** | Decisão de produto/jurídico: justificar a necessidade na App Review (uso institucional, inscrição em retiros) **ou** tornar CPF/RG opcionais para as funções devocionais. A Guideline 5.1.1(i) exige que os dados solicitados sejam relevantes à funcionalidade. **Risco alto de rejeição** — não estava mapeado antes desta verificação |
| **Privacy Nutrition Label** | Depende do ROPA aprovado (`docs/ops/lgpd/ropa-draft.md`) | Preencher declarando: e-mail, nome, telefone, data de nascimento, cidade/estado, **CPF e RG**, foto de perfil, contato de emergência, dados de saúde (plano de saúde e restrição alimentar em `app/(auth)/register.tsx:742,754`), conteúdo do usuário (posts do canal) e identificadores. **Acrescentado na verificação:** a Nutrition Label também precisa cobrir os **SDKs de terceiros** presentes no bundle — Sentry (`app/_layout.tsx:29-39`, ativo somente quando `EXPO_PUBLIC_SENTRY_DSN` está definido; `sendDefaultPii: false`, `tracesSampleRate: 0.1`), Firebase Auth e `@vercel/analytics` (`package.json`). A Apple considera dados coletados por SDK de terceiro como coletados pelo app |
| **Strings de permissão (Info.plist)** | O app pede **câmera** e **galeria** (`app/retreats/[id]/payment.tsx:35,53`) via `expo-image-picker`, mas `app.json` **não declara** `NSCameraUsageDescription` nem `NSPhotoLibraryUsageDescription` | Adicionar as strings — sem elas o app é rejeitado |
| **Declaração de criptografia (export compliance)** | O app usa criptografia (Firebase Auth/HTTPS; CPF/RG cifrados com AES-256-GCM no backend — `backend/app/crypto/service.py:127`) | Responder o questionário de export compliance |
| **Screenshots (6.9", 6.5", iPad 12.9")** | Não são texto — precisam ser capturados. `supportsTablet: true` obriga screenshots de iPad | Capturar em build real |
| **Exclusão de conta dentro do app** | Verifiquei: **não existe**. O único fluxo de exclusão é admin excluindo outro usuário (`app/admin/users/[id].tsx:222`); o backend expõe `DELETE /auth/me` (README.md:374) mas **nenhuma tela do app chama esse endpoint**. A tela de perfil só tem "Sair da Conta" (`app/(tabs)/profile.tsx:627`) | Guideline 5.1.1(v) **exige** exclusão de conta iniciada pelo usuário. É bloqueio de submissão — precisa de decisão/implementação |

---

## 10. Verificação de limites

```bash
# Rode a partir da raiz do repo para reconferir os contadores desta página
node -e "const s=process.argv[1];console.log(s.length,'chars')" "Vida comunitária e espiritual"
```

| Campo | Valor contado | Limite | OK |
|---|---|---|---|
| Nome ("Lumen+") | 6 | 30 | sim |
| Nome alternativo | 26 | 30 | sim |
| Subtítulo | 29 | 30 | sim |
| Texto promocional | 154 | 170 | sim |
| Palavras-chave | 99 | 100 | sim |
| Descrição | 3407 | 4000 | sim |
| Notas da versão (seção 8) | 673 | 4000 | sim |

> Recontagem independente feita na verificação adversarial extraindo os blocos ` ``` ` do próprio arquivo e medindo `String.length` (idêntico em NFC). Os seis valores originais batiam; a descrição mudou de 3272 → 3407 por causa da correção factual na primeira frase (ver seção 13).

---

## 11. Evidência das funcionalidades descritas (COMPROVADO)

| Claim na descrição | Arquivo |
|---|---|
| Liturgia Diária (leituras + cor litúrgica), via API externa | `lumen_mobile/app/(tabs)/service.tsx:127` (`https://liturgia.up.railway.app/v2/`) |
| Bíblia Ave Maria, 73 livros, offline | `lumen_mobile/src/services/bible.ts:9` (`require('../../assets/biblia.json')`), `app/biblia/index.tsx`. **Contado no asset:** 46 livros em `antigoTestamento` + 27 em `novoTestamento` = **73** |
| Catecismo, 2.537 parágrafos, offline, busca e §número | `lumen_mobile/app/catecismo/index.tsx:1-8`, `assets/catecismo.json`. **Contado no asset:** `meta.total_paragrafos = 2537` e `paragrafos.length = 2537` (numeração 1–2557) |
| Mistérios do Terço por dia da semana | `lumen_mobile/src/data/terco.ts`, `app/(tabs)/service.tsx:116` |
| Lista de orações tradicionais (15 itens em `ORACOES`) | `lumen_mobile/src/data/oracoes.ts:34-50`. Obs.: a descrição usa o nome popular "Oração de São Francisco"; o título no app é "Senhor, fazei-me instrumento de vossa paz" (`:43`, `id: 'sao-francisco'`) |
| Versículo do dia | `lumen_mobile/app/(tabs)/home.tsx:15,233` |
| Projeto de Vida — roteiro guiado por etapas | `lumen_mobile/app/vida/wizard.tsx:73-78` |
| Projeto semanal em 4 etapas | `lumen_mobile/app/vida/semanal.tsx:4` (docstring) e `:25` (`STEP_TITLES` = Semana, Dever de Estado, Vida Interior, Evangelização, **Confirmar**) |
| "Amanhã com o Emanuel" | `lumen_mobile/app/vida/diario.tsx:1-6` |
| Exame de Consciência opcional | `lumen_mobile/app/vida/exame.tsx:1-6` |
| PIN de 4 dígitos no ciclo | `lumen_mobile/app/vida/unlock.tsx:29` |
| Histórico de ciclos | `lumen_mobile/app/vida/historico.tsx` |
| Convites aceitar/recusar | `lumen_mobile/app/(tabs)/community.tsx:206-236` |
| Inbox de avisos | `lumen_mobile/app/(tabs)/invites.tsx:1-7` |
| Canal com posts, respostas, fixar/destacar/remover | `lumen_mobile/src/services/channel.ts:94-119` |
| Lista/gestão de membros | `lumen_mobile/app/members.tsx:1-6` |
| Área de coordenação | `lumen_mobile/app/coordinator/index.tsx:1-6` |
| Retiros: lista, status, valor | `lumen_mobile/app/retreats/index.tsx:32-42` |
| Upload de comprovante (câmera/galeria) | `lumen_mobile/app/retreats/[id]/payment.tsx:36` (`requestMediaLibraryPermissionsAsync`) e `:53` (`requestCameraPermissionsAsync`) |
| Painel admin (usuários, entidades, avisos, retiros, auditoria, aprovações) | `lumen_mobile/app/admin/index.tsx:33-116` |
| Verificação de e-mail e telefone | `lumen_mobile/app/(auth)/verify-email.tsx`, `verify-phone.tsx` |
| Aceite de Termos e Política | `lumen_mobile/app/(onboarding)/terms.tsx:114-119` |
| CPF/RG criptografados (AES-256-GCM) | `backend/app/crypto/service.py:6-7,127` |
| Contato de emergência | `lumen_mobile/app/(tabs)/profile.tsx:1081` |
| Modo claro/escuro | `lumen_mobile/app.json:9` (`userInterfaceStyle: "automatic"`) |

---

## 12. Resumo — campos `[PENDENTE HUMANO]` desta página

1. Escolha do **nome final** (`Lumen+` vs `Lumen+ Comunidade Católica`)
2. Confirmação da **categoria secundária** (Referência vs Livros)
3. **Support URL**
4. **Marketing URL** (se houver)
5. **Privacy Policy URL** (publicar `https://lumenplus.app/privacidade` — hoje é "URL futura")
6. **Copyright** (ano + titular)
7. **Nome do vendedor / conta Apple Developer**
8. **E-mail e telefone de contato da App Review**
9. **Conta de demonstração** para a revisão
10. **Privacy Nutrition Label** completa
11. Decisão sobre **denúncia/bloqueio de conteúdo (Guideline 1.2)**
12. Decisão sobre **exclusão de conta no app (Guideline 5.1.1(v))**
13. **Strings de permissão** de câmera e galeria no `app.json`
14. **Screenshots** (iPhone e iPad)
15. **Declaração de export compliance**
16. Decisão sobre a **obrigatoriedade de CPF e RG** para usar o app (Guideline 5.1.1(i)) — *acrescentado na verificação adversarial*
17. Declaração dos **SDKs de terceiros** (Sentry, Firebase, Vercel Analytics) na Nutrition Label — *acrescentado na verificação adversarial*

---

## 13. Log da verificação adversarial

> Segunda passagem, independente, tentando **refutar** cada afirmação deste documento contra o código. Cada linha citada foi aberta e lida.

### 13.1 Correções aplicadas

| # | O que estava errado | Correção |
|---|---|---|
| 1 | **Claim falsa na descrição (seção 4):** *"para entrar, é preciso criar uma conta e ser vinculado à sua comunidade"*. Vínculo com comunidade **não** é exigido para entrar: o cadastro é auto-serviço e aberto (`app/(auth)/login.tsx:268` → `register.tsx`, sem código de convite; `mission_org_unit_id` é opcional em `register.tsx:373`); `app/index.tsx:41-45` redireciona só com base no login; `app/(tabs)/_layout.tsx:18-39` bloqueia por consentimento/documentos/perfil, **nunca** por membership (`grep "memberships.length\|!memberships\|no_membership"` em `app/` e `src/` = 0 resultados) | Primeira frase da descrição reescrita para o que é comprovado; contagem atualizada 3272 → **3407/4000** |
| 2 | Mesma claim repetida na linha **"Conta de demonstração"** da seção 9 | Linha reescrita com o gate real (login + termos + CPF/RG + perfil) |
| 3 | **Achado ausente (alto):** CPF e RG são **obrigatórios** para usar o app — não estavam mapeados como risco de submissão, só como item de Nutrition Label | Nova linha na seção 9 e item 16 na seção 12 |
| 4 | **Achado ausente:** Nutrition Label não mencionava **SDKs de terceiros** (Sentry ativo em `app/_layout.tsx:29-39`, Firebase, `@vercel/analytics`) | Linha da Nutrition Label ampliada e item 17 na seção 12 |
| 5 | Citação errada: `ChannelSettings` em `src/services/channel.ts:41` — a linha 41 é o `}` de `ChannelPostList` | Corrigido para `:43-48` |
| 6 | Citação imprecisa: moderação em `channel.ts:100-106` — `deletePost` começa em **99** | Corrigido para `:99-100` (remover) e `:102-106` (fixar/destacar) |
| 7 | `semanal.tsx:4,26` — `STEP_TITLES` está em **25**, e tem **5** entradas (a 5ª é "Confirmar") | Corrigido e explicitado |
| 8 | `payment.tsx:35` — `requestMediaLibraryPermissionsAsync` está em **36** (35 é a declaração de `pickImage`) | Corrigido |
| 9 | `push.ts:18-33` — a guarda web-only está em **17** | Corrigido |
| 10 | Atenuante "canal fechado" estava marcado como inferência de front-end | **Promovido a comprovado** no backend, e acrescentado o **agravante** de que respostas não têm trava de papel |

### 13.2 Achados do documento que resistiram à refutação (CONFIRMADOS)

| Achado | Evidência reconferida |
|---|---|
| **Sem exclusão de conta no app** (5.1.1(v)) — bloqueador | `app/(tabs)/profile.tsx:627` é literalmente `<Text style={styles.logoutText}>Sair da Conta</Text>`, único controle terminal da tela; `app/admin/users/[id].tsx:222` é exclusão de **outro** usuário por admin (`adminUserService.deleteUser`, `src/services/index.ts:342-343`); o endpoint existe (`backend/app/api/routes/auth.py:311` → `@router.delete("/me", status_code=204)`, documentado em `README.md:374`) mas **nenhum arquivo de `app/` ou `src/` o chama** |
| **UGC sem denúncia/bloqueio** (1.2) — crítico | `grep -i "denunc|report|bloquear|block|abuso|abuse|flag"` em `app/channel/`, `app/members*`, `app/(tabs)/community*` = **0 resultados**. Respostas abertas a todo membro ativo (`backend/app/api/channel_routes.py:359-363`) |
| **Push é web-only** — não prometer no iOS | `src/services/push.ts:17`, `app/(tabs)/home.tsx:50`, ausência de `expo-notifications` no `package.json` |
| **Câmera/galeria sem strings no `app.json`** | `app.json` → `plugins: ["expo-router", "expo-secure-store"]`, sem `expo-image-picker` e **sem** bloco `ios.infoPlist`; `expo-image-picker ~16.0.6` está nas dependências e é usado em `payment.tsx:36,53` |
| **Política de Privacidade não publicada** — bloqueador | `docs/ops/lgpd/politica-privacidade-draft.md:3` ("Ainda não publicada aos usuários"), `:7` ("URL pública futura"), `:8` ("publicação user-facing pendente") |
| **Sem IAP / sem pagamento no app** | Nenhuma lib de billing no `package.json`; `retreats/index.tsx:139-142` só exibe `price_brl` ou "Gratuito"; `payment.tsx` só envia imagem |
| **README desatualizado** — não usar como fonte | `README.md:94-102` descreve 8 etapas (Realidade Vocacional, Diagnóstico, Síntese, Objetivo Principal, Meios Concretos, Rotina Espiritual, Diretor Espiritual, Confirmar) × `app/vida/wizard.tsx:73-78` tem **11** títulos reais |
| **Aba "Comunidade" mostra convites** — impacta screenshots | `app/(tabs)/community.tsx:7-9` (comentário `BUG-SEMÂNTICO`), `:191` (`inviteService.getMyInvites()`), `app/(tabs)/_layout.tsx:57` (`title: 'Comunidade'`) e `:59` (`invites` → `title: 'Inbox'`) |
| **Assets 192×192** — bloqueador de imagem | `docs/ops/mobile-store-readiness.md:37-41` |
| **Liturgia depende de API de terceiro** | `app/(tabs)/service.tsx:127` (`fetch('https://liturgia.up.railway.app/v2/')`); contraste com bundle offline em `src/services/bible.ts:9` |

### 13.3 Demais claims da descrição reconferidas uma a uma (todas COMPROVADAS)

73 livros e 2.537 parágrafos (contados nos próprios assets); mistérios por dia da semana (`service.tsx:116` + `src/data/terco.ts`); versículo do dia (`home.tsx:15,233`); 11 etapas do wizard (`wizard.tsx:73-78`); "Amanhã com o Emanuel" (`vida/diario.tsx:1-6`); Exame de Consciência opcional (`vida/exame.tsx:5` — *"SUGERIDO, nunca obrigatório. Sempre oferece opção de pular."*); PIN de 4 dígitos (`vida/unlock.tsx:28-29`); histórico (`vida/historico.tsx`); aceitar/recusar convite (`community.tsx:206-236`); inbox com marcação de lidos (`invites.tsx:149-152`, `markAsRead`); membros (`members.tsx:1-6`); coordenação (`coordinator/index.tsx:1-6`); status de retiro exatamente como descrito (`retreats/index.tsx:37-42`); painel admin (`admin/index.tsx:33-116`); aceite de termos forçado no primeiro acesso (`app/(tabs)/_layout.tsx:22-25` → `terms.tsx:114,119`); verificação de e-mail e telefone (`(auth)/verify-email.tsx`, `(auth)/verify-phone.tsx:4,41`); AES-256-GCM (`backend/app/crypto/service.py:6-7,127`); contato de emergência (`profile.tsx:1081`); tema claro/escuro (`app.json` → `userInterfaceStyle: "automatic"`).

### 13.4 Segurança

Nenhum segredo neste documento. O DSN do Sentry vem de variável de ambiente (`app/_layout.tsx:30`, `process.env.EXPO_PUBLIC_SENTRY_DSN`), não há valor hardcoded no repositório mobile, e nenhum token, chave ou credencial foi transcrito aqui. As únicas URLs citadas são públicas (`liturgia.up.railway.app`, `lumenplus.app`).
