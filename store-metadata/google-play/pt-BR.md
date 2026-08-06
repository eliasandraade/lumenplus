# Google Play Console — Metadados pt-BR (rascunho)

> **Status:** RASCUNHO derivado do código-fonte. Nenhum campo foi inventado.
> Toda funcionalidade descrita abaixo foi lida no código do app (`lumen_mobile/app/`).
> Campos que dependem de dado jurídico/institucional estão marcados `[PENDENTE HUMANO]`.
>
> **Base:** `lumen_mobile/app.json` → `name: "Lumen+"`, `version: "1.0.0"`, `android.package: com.lumenchristi.lumenplus`, `userInterfaceStyle: "automatic"`.

---

## 1. Nome do app (limite 30 caracteres)

**Recomendado:**

```
Lumen+
```

`6/30` — idêntico a `expo.name` em `lumen_mobile/app.json:3`.

**Alternativa (mais descritiva para busca no Play):**

```
Lumen+ Comunidade Católica
```

`26/30`

> Escolha de marca. `[PENDENTE HUMANO — nome final]`

---

## 2. Descrição breve / short description (limite 80 caracteres)

```
Liturgia, Bíblia e Catecismo offline, Projeto de Vida, retiros e avisos.
```

`72/80`

---

## 3. Descrição completa / full description (limite 4000 caracteres)

```
O Lumen+ reúne, em um único aplicativo, a vida de oração e a vida comunitária de comunidades católicas. É um app de uso interno: para entrar, é preciso criar uma conta e ser vinculado à sua comunidade.

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
• CPF e RG são armazenados de forma criptografada no servidor, e o acesso administrativo a esses documentos exige solicitação, aprovação e fica registrado em auditoria.

PERMISSÕES QUE O APP SOLICITA
• Câmera e fotos: apenas para fotografar ou selecionar o comprovante de pagamento da inscrição em retiros.

O aplicativo funciona em modo claro e escuro, acompanhando a preferência do sistema.
```

`3410/4000` (contado com `node`; ver seção 8)

**Claims deliberadamente NÃO incluídas** (não comprovadas para Android):
- **Notificações push:** o código de push (`lumen_mobile/src/services/push.ts`) é **exclusivamente web** (Service Worker + Web Push/VAPID); o card de permissão só aparece com `Platform.OS === 'web'` (`lumen_mobile/app/(tabs)/home.tsx:50`). Não há `expo-notifications` em `lumen_mobile/package.json`. **Não prometer notificações no app Android.**
- **"A equipe não acessa seu Projeto de Vida":** frase existe na UI (`app/vida/index.tsx:362`), mas não comprovei no backend. Não usar como claim de loja.
- Superlativos e nomes de concorrentes: ausentes por regra.

---

## 4. Categoria

| Campo | Sugestão | Justificativa (baseada no código) |
|---|---|---|
| **Categoria do app** | **Estilo de vida** | Núcleo do produto = acompanhamento de vida espiritual + pertencimento comunitário (`app/vida/`, convites, canal, retiros). O Play não tem categoria "Religião"; apps devocionais ficam em "Estilo de vida" ou "Livros e referência". |
| **Alternativa defensável** | **Livros e referência** | Se a estratégia for enfatizar o acervo offline embarcado: Bíblia (73 livros, `assets/biblia.json`) e Catecismo (2.537 §, `assets/catecismo.json`) com busca e navegação. |

> O Play aceita **uma** categoria. Decisão de posicionamento → `[PENDENTE HUMANO — categoria final]`

---

## 5. Tags

O Play **não aceita tags livres**: são escolhidas (até 5) de uma lista fixa do Console, e essa lista varia por categoria e muda com o tempo. Não posso transcrever a lista oficial a partir do repositório, então registro aqui apenas os **temas comprovados no código** para orientar a escolha na tela do Console:

| Tema comprovado | Evidência |
|---|---|
| Religião / espiritualidade | `app/(tabs)/service.tsx`, `src/data/oracoes.ts`, `src/data/terco.ts` |
| Bíblia / textos religiosos | `src/services/bible.ts:9`, `app/biblia/` |
| Referência / consulta offline | `app/catecismo/index.tsx`, `assets/catecismo.json` |
| Diário / reflexão pessoal | `app/vida/wizard.tsx`, `app/vida/diario.tsx`, `app/vida/exame.tsx` |
| Comunidade / grupos | `app/channel/[unitId].tsx`, `app/members.tsx`, `app/coordinator/` |
| Eventos / inscrições | `app/retreats/` |

`[PENDENTE HUMANO — seleção das tags exatas na lista fixa do Play Console]`

---

## 6. Classificação de conteúdo (content rating)

O Play não aceita uma classificação escrita: ela é **gerada pelo questionário IARC** no Console. Abaixo, as respostas que o código sustenta e o resultado esperado.

**Resultado esperado no Brasil: Livre (L)** / Everyone nas demais regiões.

| Pergunta do IARC | Resposta sustentada pelo código | Evidência |
|---|---|---|
| Violência | Não | Nenhuma tela de mídia/jogo violento em `lumen_mobile/app/` |
| Conteúdo sexual / nudez | Não | — |
| Linguagem imprópria | Não (conteúdo próprio do app) | Orações, Liturgia e Catecismo são textos devocionais |
| Substâncias controladas | Não | — |
| Jogos de azar / simulação de apostas | Não | Nenhum motor de sorteio, aposta ou moeda virtual |
| Compras no app | **Não** | Retiro mostra valor em BRL, mas o app só **recebe upload de comprovante** (`app/retreats/[id]/payment.tsx`). Nenhuma biblioteca de billing/IAP em `package.json` |
| **Os usuários interagem entre si?** | **SIM** | Canal da unidade: posts e respostas entre membros (`src/services/channel.ts:94-119`) |
| **Compartilha conteúdo gerado pelo usuário?** | **SIM** | Mesmo canal; posts visíveis aos membros da unidade |
| Compartilha localização com outros usuários | Não | Sem `expo-location` em `package.json` |
| Compartilha informações pessoais com terceiros | Depende do ROPA | `docs/ops/lgpd/ropa-draft.md` |

**⚠️ Risco identificado (ausência verificada no código):**
existe conteúdo gerado por usuário e **não existe denúncia de conteúdo nem bloqueio de usuário**. Busca por `denunc|report|bloquear|block` em `app/channel/` e `src/services/channel.ts` retornou **zero ocorrências**. Há apenas moderação por coordenador (fixar/destacar/remover com motivo — `src/services/channel.ts:100-106`) e o canal é fechado a membros autenticados da unidade (`ChannelSettings.can_post`/`can_moderate`, `src/services/channel.ts:41`).

A política de **Conteúdo Gerado pelo Usuário** do Google Play exige sistema de denúncia in-app e mecanismo de bloqueio. Decisão de produto (implementar vs. argumentar canal fechado) → `[PENDENTE HUMANO]`.

---

## 7. Notas da versão 1.0.0 (release notes — limite 500 caracteres)

```
Primeira versão do Lumen+.

• Liturgia Diária, Bíblia Ave Maria (73 livros) e Catecismo (2.537 §) offline.
• Mistérios do Terço e orações tradicionais.
• Projeto de Vida: ciclo mensal, projeto semanal, revisão e histórico.
• Convites, inbox de avisos e canal da comunidade.
• Retiros: inscrição e envio de comprovante.
• Áreas de coordenação e administração.
• Modo claro e escuro.
```

`381/500`

---

## 8. Verificação de limites

| Campo | Valor contado | Limite | OK |
|---|---|---|---|
| Nome ("Lumen+") | 6 | 30 | sim |
| Nome alternativo | 26 | 30 | sim |
| Descrição breve | 72 | 80 | sim |
| Descrição completa | 3410 | 4000 | sim |
| Notas da versão | 381 | 500 | sim |

---

## 9. Campos que NÃO consigo preencher — `[PENDENTE HUMANO]`

| Campo do Play Console | Por que não posso preencher | O que é preciso |
|---|---|---|
| **E-mail de contato do desenvolvedor** (obrigatório) | Dado institucional, não está no código | Definir e-mail público de suporte |
| **Website do desenvolvedor** (opcional) | Não existe no repositório | Definir se haverá |
| **Telefone de contato** (opcional) | Dado institucional | Definir |
| **URL da Política de Privacidade** (obrigatório) | O repositório registra `https://lumenplus.app/privacidade` como **"URL pública futura"**, ainda não publicada (`docs/ops/lgpd/politica-privacidade-draft.md:7`) | Publicar e confirmar que a URL responde publicamente |
| **Nome do desenvolvedor / conta Play Console** | A conta ainda não existe (`docs/ops/mobile-store-readiness.md:77`) | Criar/confirmar conta Google Play Console |
| **Endereço do desenvolvedor** (exigido para contas de organização) | Dado institucional | Fornecer |
| **Data Safety / Segurança de dados** (obrigatório) | Depende do ROPA (`docs/ops/lgpd/ropa-draft.md`) | Declarar coleta de: nome, e-mail, telefone, data de nascimento, cidade/estado, **CPF e RG**, foto de perfil, contato de emergência, **dados de saúde** (plano de saúde e restrição alimentar — `app/(auth)/register.tsx:742,754`), conteúdo do usuário (posts do canal) e fotos (comprovante de pagamento); e informar criptografia em trânsito e política de exclusão |
| **Declaração de público-alvo e crianças** | Decisão de produto | O app não é direcionado a crianças; confirmar no Console |
| **Declaração de app financeiro** | Não se aplica — não há processamento de pagamento no app | Confirmar "não" no questionário |
| **Gráfico de destaque 1024×500** e **ícone 512×512** | São imagens; os assets atuais são placeholders 192×192 (`docs/ops/mobile-store-readiness.md:37-41`) | Designer precisa gerar |
| **Screenshots (mín. 2)** | Precisam ser capturados em build real | Capturar |
| **Exclusão de conta (obrigatório desde 2023)** | Verifiquei: **não existe** no app. O único fluxo de exclusão é admin excluindo outro usuário (`app/admin/users/[id].tsx:222`); o backend expõe `DELETE /auth/me` (README.md:374) mas **nenhuma tela do app chama esse endpoint**. Perfil só tem "Sair da Conta" (`app/(tabs)/profile.tsx:627`) | O Play exige exclusão iniciada pelo usuário **dentro do app e também por uma URL web**. É bloqueio de publicação |
| **Permissões declaradas no manifesto** | O app usa câmera e galeria (`app/retreats/[id]/payment.tsx:35,53`) via `expo-image-picker`, mas `app.json` **não declara** essas permissões nem plugin correspondente | Declarar antes do build de produção |

---

## 10. Evidência das funcionalidades descritas (COMPROVADO)

| Claim na descrição | Arquivo |
|---|---|
| Liturgia Diária (leituras + cor litúrgica), via API externa | `lumen_mobile/app/(tabs)/service.tsx:127` (`https://liturgia.up.railway.app/v2/`) |
| Bíblia Ave Maria, 73 livros, offline | `lumen_mobile/src/services/bible.ts:9`, `app/biblia/index.tsx` |
| Catecismo, 2.537 parágrafos, offline, busca e §número | `lumen_mobile/app/catecismo/index.tsx:1-8`, `assets/catecismo.json` |
| Mistérios do Terço por dia da semana | `lumen_mobile/src/data/terco.ts`, `app/(tabs)/service.tsx:116` |
| Lista de orações tradicionais | `lumen_mobile/src/data/oracoes.ts:35-49` |
| Versículo do dia | `lumen_mobile/app/(tabs)/home.tsx:15,233` |
| Projeto de Vida — roteiro guiado por etapas | `lumen_mobile/app/vida/wizard.tsx:73-78` |
| Projeto semanal em 4 etapas | `lumen_mobile/app/vida/semanal.tsx:4,26` |
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
| Upload de comprovante (câmera/galeria) | `lumen_mobile/app/retreats/[id]/payment.tsx:35,53` |
| Painel admin (usuários, entidades, avisos, retiros, auditoria, aprovações) | `lumen_mobile/app/admin/index.tsx:33-116` |
| Verificação de e-mail e telefone | `lumen_mobile/app/(auth)/verify-email.tsx`, `verify-phone.tsx` |
| Aceite de Termos e Política | `lumen_mobile/app/(onboarding)/terms.tsx:114-119` |
| CPF/RG criptografados (AES-256-GCM) | `backend/app/crypto/service.py:6-7,127` |
| Contato de emergência | `lumen_mobile/app/(tabs)/profile.tsx:1081` |
| Modo claro/escuro | `lumen_mobile/app.json:9` (`userInterfaceStyle: "automatic"`) |

---

## 11. Resumo — campos `[PENDENTE HUMANO]` desta página

1. Escolha do **nome final** (`Lumen+` vs `Lumen+ Comunidade Católica`)
2. **Categoria final** (Estilo de vida vs Livros e referência)
3. **Tags** (seleção na lista fixa do Play Console)
4. **E-mail de contato do desenvolvedor**
5. **Website do desenvolvedor** (se houver)
6. **Telefone de contato** (se aplicável)
7. **URL da Política de Privacidade** (publicar `https://lumenplus.app/privacidade` — hoje é "URL futura")
8. **Nome e endereço do desenvolvedor / conta Play Console**
9. **Formulário de Segurança de dados (Data Safety)** completo
10. Decisão sobre **denúncia/bloqueio de conteúdo (política de UGC)**
11. Decisão sobre **exclusão de conta no app + URL web de exclusão**
12. **Ícone 512×512**, **gráfico de destaque 1024×500** e **screenshots**
13. **Declaração de permissões** de câmera e galeria antes do build de produção
