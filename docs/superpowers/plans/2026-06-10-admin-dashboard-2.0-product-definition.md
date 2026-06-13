# Admin Dashboard 2.0 — Product Definition

**Data:** 2026-06-10
**Natureza:** Product Discovery — **só produto, governança, indicadores e decisão.** Sem código, sem migrations, sem endpoints, sem telas, sem componentes.
**Base:** auditoria aprovada em `docs/superpowers/audits/2026-06-10-admin-dashboard-audit.md`.
**Premissa de partida:** o dashboard atual mede **cadastro, demografia e estrutura organizacional** — não mede crescimento, saúde de comunidades nem formação.

---

## 0. Personas e perguntas de gestão

O Admin 2.0 deve responder perguntas **diferentes** para cada nível de governança. O erro do dashboard atual é tratar todos como um público só (uma lista única de contagens).

### 1) Conselho Geral — *visão estratégica da Obra*
Pergunta-mãe: **"A Obra está saudável e crescendo na sua missão?"**
- Estamos crescendo ou estagnando, no todo e ao longo do tempo?
- A missão de evangelização/formação vocacional está avançando (consagrações, vocacionais, adesão à formação)?
- Há comunidades em risco que ameaçam a continuidade?
- A casa está em ordem (governança, LGPD, integridade dos dados)?

### 2) Conselho Executivo — *estratégia operacional / alocação*
Pergunta-mãe: **"Onde devemos colocar atenção e recursos neste trimestre?"**
- Quais setores/ministérios crescem e quais minguam?
- Como está o funil de acolhida (interessados → convidados → membros)?
- Como está a adesão à formação (Projeto de Vida)?
- Há gargalos operacionais (convites parados, cadastros incompletos, unidades sem liderança)?

### 3) Coordenação Geral — *liderança operacional entre comunidades*
Pergunta-mãe: **"Quais comunidades precisam de mim agora?"**
- Onde há declínio, evasão ou ausência de coordenador?
- Convites pendentes acumulando em alguma unidade?
- A liderança está distribuída (unidades com coordenador único = risco)?

### 4) Coordenadores de Comunidade — *a própria unidade (escopo restrito)*
Pergunta-mãe: **"Como está a minha comunidade?"**
- Quantos membros ativos, novos, e quantos estão sumindo?
- Tenho convites pendentes para acompanhar?
- Meus membros estão aderindo à formação? *(só agregado da unidade)*
- **Nunca** vê dados espirituais individuais, nem de outras unidades.

### 5) Analistas — *insight e qualidade de dados (não decisão)*
Pergunta-mãe: **"O que os dados estão dizendo, e são confiáveis?"**
- Tendências, padrões e segmentações para subsidiar relatórios aos conselhos.
- Qualidade/consistência do cadastro.
- **Sem PII individual; agregados apenas.** Reavaliar acesso atual à trilha de auditoria nominal.

> **Princípio transversal de papéis:** *agregado por padrão; nominal só com necessidade e auditoria; foro íntimo nunca.* Cada persona vê uma fatia com escopo — não o mesmo painel.

---

## Etapa 1 — Inventário (classificação de cada métrica da auditoria)

Legenda: **🏠 Manter no Principal (Executivo)** · **👥 Demográfico** · **🌱 Comunitário** · **🗑️ Remover** · **🔁 Reavaliar**

| Métrica atual | Destino | Motivo |
|---|---|---|
| **Total de usuários (ativos)** | 🏠 | KPI primário de tamanho da Obra. Reenquadrar como "Membros ativos". |
| **Perfis completos** | 🏠 (como % de saúde do cadastro) | Indicador de qualidade do cadastro, útil ao Executivo. Corrigir base (sobre o total de membros). |
| `incomplete_profiles` | 🗑️ | Dado morto (calculado, nunca exibido). Vira denominador de "saúde do cadastro", não card próprio. |
| **Novos (7d/30d)** | 🏠 | Crescimento é estratégico. Tornar período flexível e adicionar comparação com período anterior. |
| **Faixas etárias** | 👥 | Perfil da comunidade ("quem somos"), não decisão operacional. |
| **Geografia por estado** | 👥 | Perfil pastoral/geográfico. |
| **Geografia por cidade** | 🔁 → 👥 | Reavaliar **antes**: normalizar texto e suprimir contagens pequenas (risco de reidentificação). Só então mover ao Demográfico. |
| **Estado de vida** | 👥 | Perfil. Pode alimentar 1 KPI resumido no Principal (% consagrados/clérigos). |
| **Realidade vocacional** | 👥 (+ resumo 🏠) | Central à missão: detalhe no Demográfico, mas "% em caminho vocacional/consagrado" merece resumo no Executivo. |
| **Estado civil** | 👥 | Perfil. |
| **Com acompanhamento vocacional** | 🔁 → 👥/Formação | Útil, mas hoje sem base. Reenquadrar como cobertura ("X de Y, Z%"). |
| `without_vocational_accompaniment` | 🗑️ | Dado morto. Vira denominador. |
| **Interesse em ministério** | 🌱 | É pipeline de serviço/acolhida — acionável por coordenação, não mero perfil. |
| **De missão** | 👥 | Atributo de perfil. |
| **Memberships "Total Ativos"** | 🌱 | Métrica comunitária. Corrigir: separar "vínculos" de "pessoas com vínculo (distintas)". |
| **Vínculos por tipo de unidade** | 🌱 | Estrutura/comunidade. |
| **Convites (total/aceitos/pendentes/recusados)** | 🏠 | Funil de crescimento = estratégico. Corrigir reconciliação (incluir expirados/cancelados). |
| **Taxa de aceitação** | 🏠 | Corrigir denominador: sobre **resolvidos** (aceitos ÷ (aceitos+recusados)). |
| **Top ministérios** | 🌱 | Saúde de comunidades. Corrigir: agrupar por id, rotular com setor, contar pessoas. |
| **Logs de auditoria** (tela) | Governança (fora do trio de dashboards) | Não é métrica de gestão; é controle. Reavaliar acesso de Analista. |
| **Aprovações de exportação** (tela) | Governança | Não é métrica; é fluxo de compliance. Dar entrada no menu. |

**Resumo do inventário:** 2 itens removidos (dados mortos), 1 reavaliado por privacidade (cidade), ~7 movidos para Demográfico, ~5 para Comunitário, ~6 mantidos/promovidos ao Executivo (com correção). Nada do que existe é "lixo de dados" — é tudo real; o problema é **lugar e enquadramento**.

---

## Etapa 2 — Dashboard Executivo (os 10 números dos 15 segundos)

> *"Se um membro do Conselho Geral abrir o Lumen+ por 15 segundos, quais os 10 números mais importantes?"*

Critério: cada número responde a uma pergunta estratégica e é **agregado** (sem PII). "Fórmula" é conceitual; "origem" indica a fonte de dados.

| # | Métrica | Fórmula (conceitual) | Origem | Motivo estratégico |
|---|---|---|---|---|
| 1 | **Membros ativos** | contagem de contas ativas | `User.is_active` | Tamanho real da Obra — o número-âncora. |
| 2 | **Crescimento líquido no período** | (novos membros) − (saídas) no período | `User.created_at`, exclusões/`is_active` | Mostra se a Obra cresce ou encolhe, não só "entradas". |
| 3 | **Variação vs período anterior** | crescimento atual ÷ crescimento do período anterior | mesmas fontes, 2 janelas | Tendência, não foto. Diz se estamos acelerando ou desacelerando. |
| 4 | **Saúde do cadastro** | perfis completos ÷ membros ativos | `UserProfile.status`, `User` | Qualidade dos dados sobre os quais todas as outras decisões se apoiam. |
| 5 | **Taxa de conversão de convites** | aceitos ÷ (aceitos + recusados) | `OrgInvite.status` | Eficácia da acolhida — quem é convidado, entra? |
| 6 | **Convites pendentes** | contagem de convites em aberto | `OrgInvite.status=PENDING` | Gargalo de acolhida; pendência alta = processo travado. |
| 7 | **Pessoas com vínculo ativo** | contagem **distinta** de usuários com ≥1 vínculo ativo | `OrgMembership` (DISTINCT user) | Participação real no serviço (diferente de "tem conta"). |
| 8 | **Comunidades ativas** | unidades com ≥ N membros ativos **e** coordenador | `OrgUnit` × `OrgMembership` | Quantas comunidades realmente funcionam, não quantas existem no papel. |
| 9 | **Comunidades em risco** | unidades em declínio **ou** sem coordenador ativo | `OrgUnit`, `OrgMembership.role/status` | Alerta de continuidade — onde a Obra pode estar "morrendo na borda". |
| 10 | **Adesão à formação** | membros com ciclo de Projeto de Vida ativo ÷ membros elegíveis | `LifePlanCycle.status=ACTIVE` (só metadado) | A missão é formar; este é o indicador de que a formação acontece. **Sem conteúdo espiritual.** |

> Complemento opcional de 11º (missão): **% em caminho vocacional/consagrado** (`UserProfile.vocational_reality_item_id` agregado) — para o Conselho Geral, é o pulso vocacional da Obra.

---

## Etapa 3 — Dashboard Comunitário

Responde: *como estão nossas comunidades? quais crescem? quais enfraquecem? onde agir?*

Unidade de análise = **a comunidade** (OrgUnit: setor, ministério, grupo, missão). Tudo agregado por unidade; coordenador vê só a sua, Coordenação Geral vê todas.

### Como estão (estado atual)
- **Tamanho ativo** por comunidade (pessoas distintas ativas).
- **Densidade de liderança**: coordenadores ativos ÷ membros (baixo demais = sobrecarga; zero = órfã).
- **Cobertura de coordenação**: a unidade tem coordenador ativo? tem mais de um (sucessão)?

### Quais estão crescendo
- **Crescimento líquido por unidade** no período (entradas − saídas).
- **Ranking de crescimento** (Δ positivo) — onde está dando certo, para replicar.
- **Conversão de convites por unidade** (acolhida eficaz).

### Quais estão enfraquecendo
- **Ranking de declínio** (saídas > entradas; Δ negativo sustentado).
- **Evasão**: vínculos que passaram a REMOVED no período ÷ tamanho.
- **Estagnação**: unidades sem nenhuma entrada há X meses.

### Onde agir (priorização — "semáforo de comunidades")
Combinar sinais num índice de risco por unidade:
- 🔴 Sem coordenador **ou** coordenador único + declínio
- 🟡 Convites pendentes acumulados **ou** estagnação
- 🟢 Saudável e crescendo

Saída: **lista priorizada** ("estas 5 comunidades precisam de atenção"), não um mar de números. Esse é o produto central para Coordenação Geral.

> Fontes: `OrgUnit`, `OrgMembership` (status/role/datas), `OrgInvite` por unidade. Adesão à formação por unidade entra como **agregado k-anônimo** (suprimir unidades pequenas demais).

---

## Etapa 4 — Dashboard Demográfico ("Perfil da Comunidade")

Responde: *quem somos?* — material para planejamento pastoral, não para decisão operacional do dia a dia.

Pertencem aqui (todos com **base N explícita** e **k-anonimato**):
- **Estado de vida** (leigo → bispo)
- **Realidade vocacional** (acolhida → consagrado)
- **Estado civil**
- **Faixa etária** (com cálculo de idade corrigido)
- **Geografia por estado** (UF)
- **Geografia por cidade** — *só após normalização e supressão de contagens pequenas*
- **Outros atributos de cadastro estendido** já coletados: de missão, interesse em ministério (versão "perfil"), e atributos do registro estendido (ex.: instrumentos musicais para ministério de música) — sempre agregados e não-identificantes.

Princípios do Demográfico:
1. Toda proporção mostrada como "X de Y que informaram (Z%)" — nunca um % órfão.
2. Nunca cruzar dois eixos a ponto de criar célula identificável (ex.: "1 sacerdote viúvo na cidade Z").
3. É uma área de **leitura/planejamento**, separada dos KPIs de ação — para não competir por atenção com o Executivo.

---

## Etapa 5 — Projeto de Vida 2.0 (indicadores espirituais)

**Contexto crítico:** o modelo de dados do Projeto de Vida carrega, no próprio código, o aviso *"Dados sensíveis — não expor em logs ou dashboards admin"*. Os ciclos contêm **foro íntimo religioso**: defeito/pecado dominante, diagnósticos em texto livre por dimensão, frequência de confissão, exame de consciência, diretor espiritual, objetivos pessoais e reflexões mensais. Sob a LGPD, **convicção religiosa é dado pessoal sensível** (art. 5º, II); prática sacramental e foro íntimo são o núcleo mais protegido.

A regra de ouro: **gestão pode medir que a formação acontece — nunca o que a pessoa formou.** Adesão e constância (metadados), nunca conteúdo.

### Indicadores que PODEM existir (futuramente, agregados e anônimos)
| Indicador | Fórmula (conceitual) | Por que é seguro |
|---|---|---|
| **Taxa de adesão** | membros com ciclo (rascunho+ativo) ÷ elegíveis | usa só `status`, sem conteúdo |
| **Taxa de conclusão do wizard** | ciclos ATIVOS ÷ ciclos iniciados (rascunho) | mede se as pessoas terminam de montar o plano |
| **Constância** | ciclos ativos com revisão mensal em dia ÷ ciclos ativos | comportamento (fez a revisão), não o que escreveu |
| **Maturidade dos ciclos** | distribuição por nº de revisões / tempo de vida do ciclo | sinal de perseverança, agregado |
| **Renovação** | ciclos arquivados que iniciaram novo ciclo | decisão `NEW_CYCLE` agregada, sem texto |

### Úteis para gestão
Adesão, conclusão e constância — respondem "a formação está pegando?" e "onde a formação não acontece?" (por comunidade, **k-anônimo**). Esses três bastam para o Conselho avaliar a missão formativa.

### Que NUNCA devem ser mostrados (nem agregados finos)
- `dominant_defect` (defeito/pecado dominante)
- conteúdo dos diagnósticos (`abandonar`/`melhorar`/`deus_pede`)
- `confession_frequency`, `exam_of_conscience` — foro íntimo sacramental
- `spiritual_director_name`, objetivos/ações (`title`/`description`/`action`)
- reflexões das revisões mensais (`progress_reflection`/`difficulties`/`notes`)
- **qualquer coisa em nível individual** — sempre.

### Anonimização e LGPD
1. **Só agregado, nunca nominal.** Nenhum painel cruza Projeto de Vida com nome, e-mail ou unidade pequena.
2. **k-anonimato forte** (suprimir grupos abaixo de um limiar, ex. < 10) — formação espiritual exige limiar maior que demografia comum.
3. **Finalidade declarada:** o dado existe para a *formação pessoal do titular*, não para vigilância pastoral. Métricas de gestão derivam apenas de **metadados de uso**.
4. **Separação de papéis:** nem ADMIN/DEV deve ver conteúdo de ciclo em painel; o acesso ao conteúdo é do próprio titular (e, fora do sistema, do seu diretor espiritual).
5. **Prática sacramental (confissão/missa/exame):** tratar como sensível especialíssimo. **Recomendação:** *não* transformar em indicador de gestão; se um dia houver demanda, exigir consentimento específico e finalidade explícita.
6. **Minimização:** preferir derivar saúde formativa de adesão/constância e **não coletar para gestão** aquilo que não se pode mostrar com segurança.

---

## Etapa 6 — Roadmap (evolução em fases)

| Fase | Entrega | Depende de | Risco |
|---|---|---|---|
| **Fase 1 — Correções de cálculo e semântica** | Convites reconciliados + taxa sobre resolvidos; top ministérios por id; vínculos vs pessoas; base nos percentuais; idade correta; geografia normalizada; remover dados mortos; renomear seções p/ linguagem de conselheiro | Só o que já existe | Baixo |
| **Fase 2 — Dashboard Executivo** | Os 10 números (Etapa 2), com período flexível e comparação temporal; "pessoas distintas"; "comunidades ativas/em risco" | Pessoas distintas + séries temporais leves | Médio |
| **Fase 3 — Dashboard Comunitário** | Saúde por comunidade, rankings crescimento/declínio, semáforo de risco, escopo por coordenador | Agregação por unidade + tendências + cobertura de liderança | Médio |
| **Fase 4 — Dashboard Demográfico** | Área "Perfil da Comunidade" com base N e k-anonimato; geografia tratada | Reaproveita dados atuais + supressão de pequenos números | Baixo/Médio |
| **Fase 5 — Indicadores do Projeto de Vida** | Adesão/conclusão/constância, agregados e anônimos, com gating de privacidade reforçado | Metadados de ciclo + política de k-anonimato + decisão de governança/LGPD | **Alto (privacidade)** — fazer por último, com mais cuidado |

Ordem proposta = **maior valor / menor risco primeiro**. Fase 1 destrava confiança nos números; Fase 5 é a mais sensível e exige decisão formal de governança antes de qualquer agregação.

---

## Recomendação final — Arquitetura do Admin 2.0

**Abandonar o painel único e adotar quatro superfícies com escopo por papel:**

1. **Executivo (Principal)** — os 10 números estratégicos. Público: Conselho Geral e Executivo. Resposta a "estamos saudáveis e crescendo?".
2. **Comunitário** — saúde por comunidade + semáforo de ação. Público: Coordenação Geral (todas) e Coordenadores (só a sua, escopado). Resposta a "onde agir?".
3. **Demográfico ("Perfil da Comunidade")** — quem somos, para planejamento pastoral. Público: conselhos e analistas. Leitura, não ação.
4. **Governança** — logs de auditoria e aprovações (compliance/LGPD), separado das métricas. Reavaliar o acesso de Analista a trilha nominal.

E uma quinta superfície **futura e gated**:
5. **Formação (Projeto de Vida)** — só adesão/constância anônimas, k-anônimas, sem nenhum conteúdo de foro íntimo.

**Três princípios inegociáveis da arquitetura:**
- **Escopo por papel:** cada persona vê a fatia que precisa — não o mesmo painel para todos.
- **Agregado por padrão; nominal só com necessidade e auditoria; foro íntimo nunca.**
- **Todo número com base e período;** tendência acima de foto; semáforo acima de tabelão.

**Sequência:** Fase 1 (confiança nos dados) → Executivo → Comunitário → Demográfico → Formação. O dashboard atual não é descartado: ele é **redistribuído** entre Demográfico e Comunitário, e **complementado** por um Executivo que hoje não existe.

---

### Anexo — Rastreabilidade de dados (fontes existentes)
- Membros/crescimento: `User`, `UserProfile`
- Comunidades/vínculos: `OrgUnit`, `OrgMembership`, `OrgInvite`
- Demografia/vocacional: `UserProfile` × `ProfileCatalogItem`
- Comunicação (reuso possível): `/inbox/sent` (`recipient_count`/`read_count`)
- Formação (Fase 5, só metadados): `LifePlanCycle.status`, `LifePlanMonthlyReview.review_date` — **conteúdo nunca**
- Governança: `AuditLog`, fluxo de export (`routes/export.py`)
