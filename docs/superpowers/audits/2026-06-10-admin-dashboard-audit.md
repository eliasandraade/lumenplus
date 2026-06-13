# Auditoria do Painel Admin do Lumen+ — Dashboard Administrativo

**Data:** 2026-06-10
**Escopo:** somente leitura — auditar, mapear e propor. **Nada implementado.** Sem alterações em backend, frontend, endpoints, permissões ou banco.
**Foco principal:** `/admin/dashboard`. Cobertura secundária: todas as demais telas Admin.

---

## 1. Relatório do Admin atual

### 1.1 Telas Admin existentes

| Tela | Arquivo frontend | Endpoint principal | Backend | Acesso |
|---|---|---|---|---|
| Menu Admin | `app/admin/index.tsx` | — (lê `user.global_roles` do store) | — | ANALISTA vê só Dashboard; ADMIN/DEV vê tudo |
| **Dashboard** | `app/admin/dashboard.tsx` | `GET /admin/dashboard` | `routes/admin.py:get_dashboard` | ADMIN, DEV, ANALISTA |
| Gestão de Usuários | `app/admin/users/index.tsx` | `GET /admin/users`, `/admin/users/filter-options` | `routes/admin.py` | DEV/ADMIN/SECRETARY (+ coord. C. Geral p/ listar) |
| Perfil completo do usuário | `app/admin/users/[id].tsx` | `GET /admin/users/{id}/profile` | `routes/admin.py:get_user_full_profile` | DEV/ADMIN/SECRETARY (CPF/RG só com aprovação) |
| Exportar usuários | `app/admin/users/export.tsx` | `POST /admin/export/request` | `routes/export.py` | gera CSV; sensível → aprovação |
| Entidades (estrutura) | `app/admin/entities/index.tsx` | `GET /org/tree`, `/org/units/*` | `routes/organization.py` | ADMIN/DEV + coordenadores |
| Criar Aviso | `app/admin/create-aviso.tsx` | `POST /inbox/send` (+ preview/scopes) | `inbox_routes.py` | CAN_SEND_INBOX / coord. |
| Avisos Enviados | `app/admin/sent-avisos.tsx` | `GET /inbox/sent` | `inbox_routes.py` | quem pode enviar |
| Logs de Auditoria | `app/admin/audit-logs.tsx` | `GET /admin/audit-logs` | `routes/admin.py:get_audit_logs` | ADMIN, DEV, ANALISTA |
| Aprovações (export) | `app/admin/approvals/index.tsx` | `GET /admin/export/requests` (+approve/reject) | `routes/export.py` | DEV/ADMIN/C. Geral |
| Retiros | `app/admin/retreats/*` | `/admin/retreats/*` | rotas de retiros | acesso de retiro |

> **Observação de roteamento:** o menu (`index.tsx`) lista Dashboard, Comunicações (Criar/Enviados), Eventos (Retiros), Estrutura (Entidades), Pessoas (Usuários) e Segurança (Logs). A tela de **Aprovações** existe no `_layout.tsx` mas **não tem atalho no menu** — só é alcançável por deep-link. A tela de **Export** é alcançada pelo ícone de download dentro de Usuários.

### 1.2 O Dashboard hoje (`app/admin/dashboard.tsx`)

- **Origem dos dados:** uma única chamada `api.get<DashboardData>('/admin/dashboard')` — **sem service wrapper** (chamada direta ao `api`, diferente do resto do app que usa `src/services/`).
- **Backend:** `get_dashboard` em `routes/admin.py` executa ~**20 queries SQL sequenciais** e devolve um JSON consolidado. **Sem cache.** Pull-to-refresh re-executa tudo.
- **Autorização:** `require_admin_or_analista` (ADMIN/DEV/ANALISTA).
- **Conteúdo:** 8 seções → Usuários, Faixas Etárias, Geografia (cidade/estado), Perfil Vocacional (estado de vida / realidade vocacional / estado civil), Engajamento (3 cards), Memberships, Convites, Top Ministérios.
- **Dado mockado?** **Nenhum.** 100% vem do banco via SQL real. Não há números hard-coded nem placeholders.
- **Cabeçalho diz "Visão geral do aplicativo"**, mas o conteúdo é **exclusivamente cadastro/demografia/governança** — não há métrica de *uso do app* (logins, usuários ativos, adesão ao Projeto de Vida, leitura de avisos, inscrições em retiros). Há um descompasso entre o título e o que é medido.

---

## 2. Mapa completo das métricas (Dashboard)

Colunas: Métrica · Onde aparece · Origem frontend · Endpoint · Origem no banco · Cálculo · Real/Mock/Parcial · Risco de interpretação · Recomendação.

### Seção: Usuários

| Métrica | Onde | Frontend | Endpoint | Banco | Cálculo | Tipo | Risco | Recomendação |
|---|---|---|---|---|---|---|---|---|
| **Total** | Card "Total" | `data.users.total` | `/admin/dashboard` | `User` | `COUNT(User) WHERE is_active=true` | Real | "Total" = contas ativas; exclui contas excluídas/desativadas. Pode ser lido como "total histórico". | Rotular "Usuários ativos". |
| **Perfis Completos** | Card | `data.users.complete_profiles` | idem | `UserProfile` | `COUNT(UserProfile WHERE status='COMPLETE')` | Real, mas **parcial** | Conta **linhas de perfil**, não usuários; **não** filtra `is_active` nem cruza com `User`. Usuários provisionados sem linha de perfil ficam fora. Não mostra % do total. | Exibir como "X de Total (Y%)"; alinhar base. |
| **Novos (7d)** | Card | `data.users.new_last_7d` | idem | `User` | `COUNT WHERE is_active AND created_at>=now-7d` | Real | `created_at` = 1º provisionamento (1º login), **não** conclusão do cadastro. "Novo" pode incluir cadastro incompleto. | Definir claramente "novos = primeiro acesso". |
| **Novos (30d)** | Card | `data.users.new_last_30d` | idem | `User` | igual, 30 dias | Real | Janela 30d **contém** a de 7d (não somar). | Manter; deixar claro que são acumulados sobrepostos. |
| `incomplete_profiles` | **Não exibido** | retornado mas não renderizado | idem | `UserProfile` | `COUNT(status != 'COMPLETE')` | Real, **dado morto** | Campo calculado e trafegado sem uso na UI. | Remover do payload **ou** exibir. |

### Seção: Faixas Etárias

| Métrica | Onde | Frontend | Endpoint | Banco | Cálculo | Tipo | Risco | Recomendação |
|---|---|---|---|---|---|---|---|---|
| **Faixas etárias** | Barras | `data.age_ranges[]` | `/admin/dashboard` | `UserProfile.birth_date` | `_calc_age_ranges`: `idade=(hoje-nasc).days//365`, buckets `<18,18-25,26-35,36-45,46-60,>60,Não informado` | Real | `//365` ignora anos bissextos → erro de ±1 ano perto do aniversário. % de cada barra é sobre **todos** (inclui "Não informado"), diluindo. | Usar `relativedelta`; calcular % sobre quem informou. |

### Seção: Geografia

| Métrica | Onde | Frontend | Endpoint | Banco | Cálculo | Tipo | Risco | Recomendação |
|---|---|---|---|---|---|---|---|---|
| **Por Cidade (top 10)** | Lista ranqueada | `data.geography.by_city[]` | `/admin/dashboard` | `UserProfile.city` | `GROUP BY city WHERE city IS NOT NULL ORDER BY cnt DESC LIMIT 10` | Real, **parcial** | `city` é texto livre → "Fortaleza" / "fortaleza" / "Fortaleza " contam separado. `''` (string vazia) **não** é excluído → linha em branco. Buckets de contagem 1 podem **identificar** indivíduos em org pequena. | Normalizar (trim/case); excluir vazios; suprimir buckets < k (k-anonimato). |
| **Por Estado (top 10)** | Lista | `data.geography.by_state[]` | idem | `UserProfile.state` | `GROUP BY state ... LIMIT 10` | Real, parcial | Mesma fragmentação/vazios. UF tende a ser mais limpa. | Normalizar UF; excluir vazios. |

### Seção: Perfil Vocacional

| Métrica | Onde | Frontend | Endpoint | Banco | Cálculo | Tipo | Risco | Recomendação |
|---|---|---|---|---|---|---|---|---|
| **Estado de Vida** | Lista label+% | `by_life_state[]` | `/admin/dashboard` | `UserProfile.life_state_item_id` × `ProfileCatalogItem` | `JOIN catálogo LIFE_STATE, GROUP BY label` | Real | % calculado no front sobre a **soma dos que responderam**, não sobre o total de usuários. Quem não preencheu não aparece. | Mostrar base N ("de X que informaram"). |
| **Realidade Vocacional** | Lista label+% | `by_vocational_reality[]` | idem | `UserProfile.vocational_reality_item_id` | igual (catálogo VOCATIONAL_REALITY) | Real | idem | idem |
| **Estado Civil** | Lista label+% | `by_marital_status[]` | idem | `UserProfile.marital_status_item_id` | igual (catálogo MARITAL_STATUS) | Real | idem | idem |

### Seção: Engajamento

| Métrica | Onde | Frontend | Endpoint | Banco | Cálculo | Tipo | Risco | Recomendação |
|---|---|---|---|---|---|---|---|---|
| **Com Acomp. Vocacional** | Card | `with_vocational_accompaniment` | `/admin/dashboard` | `UserProfile.has_vocational_accompaniment` | `COUNT(=true)` | Real | Número **absoluto sem denominador** ("120" de quantos?). `NULL` não entra em nenhum lado. | Exibir "X de Y (%)". |
| **Interesse em Ministério** | Card | `interested_in_ministry` | idem | `UserProfile.interested_in_ministry` | `COUNT(=true)` | Real | sem base | idem |
| **De Missão** | Card | `from_mission` | idem | `UserProfile.is_from_mission` | `COUNT(=true)` | Real | sem base | idem |
| `without_vocational_accompaniment` | **Não exibido** | retornado, não usado | idem | `has_vocational_accompaniment=false` | `COUNT(=false)` | Real, **dado morto** | trafegado sem uso | Remover ou usar como denominador. |

> O rótulo da seção **"Engajamento" é enganoso**: são atributos declarados no cadastro, não sinais de engajamento/uso.

### Seção: Memberships

| Métrica | Onde | Frontend | Endpoint | Banco | Cálculo | Tipo | Risco | Recomendação |
|---|---|---|---|---|---|---|---|---|
| **Total Ativos** | Linha de total | `memberships.total_active` | `/admin/dashboard` | `OrgMembership` | `COUNT WHERE status=ACTIVE` | Real | Conta **vínculos**, não pessoas. Uma pessoa em 3 ministérios = 3. "Total Ativos" pode ser lido como "membros ativos (pessoas)". | Rotular "Vínculos ativos" e adicionar "pessoas com vínculo" (DISTINCT user). |
| **Por tipo de unidade** | Barras | `by_unit_type[]` | idem | `OrgMembership × OrgUnit.type` | `GROUP BY type` | Real | mesma contagem por vínculo | Manter; deixar claro "vínculos". |

### Seção: Convites

| Métrica | Onde | Frontend | Endpoint | Banco | Cálculo | Tipo | Risco | Recomendação |
|---|---|---|---|---|---|---|---|---|
| **Total** | Card | `invites.total` | `/admin/dashboard` | `OrgInvite` | `COUNT(*)` (**todos** os status) | Real | Inclui PENDING, EXPIRED, CANCELLED — mas só 3 status são exibidos. | Exibir também expirados/cancelados ou ajustar denominador. |
| **Aceitos** | Card | `invites.accepted` | idem | `OrgInvite.status` | `COUNT(ACCEPTED)` | Real | — | — |
| **Pendentes** | Card | `invites.pending` | idem | idem | `COUNT(PENDING)` | Real | — | — |
| **Recusados** | Card | `invites.declined` | idem | idem | `COUNT(REJECTED)` | Real | **Os 4 cards não fecham com Total** quando há EXPIRED/CANCELLED → "sumiram convites". | Mostrar os 5 status ou nota de rodapé. |
| **Taxa de aceitação** | Barra + % | `invites.acceptance_rate` | idem | — | `round(accepted/total*100,1)`, `total`=todos | Real, **enganoso** | Denominador inclui pendentes/expirados/cancelados → **subestima** a conversão real. | Calcular sobre **resolvidos** = `accepted/(accepted+declined)`. |

### Seção: Top Ministérios

| Métrica | Onde | Frontend | Endpoint | Banco | Cálculo | Tipo | Risco | Recomendação |
|---|---|---|---|---|---|---|---|---|
| **Top Ministérios** | Lista ranqueada | `top_ministries[]` | `/admin/dashboard` | `OrgUnit(MINISTERIO) × OrgMembership` | `GROUP BY OrgUnit.name`, INNER JOIN ativos, `LIMIT 10` | Real, **parcial** | (a) Agrupa por **nome**, não por id → ministérios homônimos em setores diferentes **se fundem**. (b) INNER JOIN exclui ministérios com **0 membros ativos**. (c) Conta vínculos, não pessoas. | Agrupar por `id`; rotular com setor; decidir se 0-membros importa. |

---

## 3. Problemas encontrados (consolidado)

### 3.1 Corretude / consistência de dados
1. **Convites não reconciliam.** Total inclui EXPIRED/CANCELLED, mas só 3 status aparecem. A "Taxa de aceitação" usa total como denominador → número artificialmente baixo e potencialmente desmotivador para conselheiros.
2. **Top Ministérios agrupa por nome** (`GROUP BY OrgUnit.name`) — funde unidades homônimas e omite ministérios sem membros ativos.
3. **"Total Ativos" de memberships conta vínculos, não pessoas** — superestima "membros" se há multi-pertencimento.
4. **"Perfis Completos" vs "Total"** medem populações diferentes (linhas de perfil COMPLETE vs contas ativas). A diferença não é explicada na UI.
5. **Idade por `//365`** introduz erro de borda perto do aniversário (ignora bissextos).
6. **Geografia sem normalização** — fragmentação por caixa/espaços e linhas em branco (`''` não filtrado).
7. **Percentuais sem base explícita** — catálogos calculam % sobre "quem respondeu"; engajamento mostra absolutos sem denominador. Fácil concluir errado.

### 3.2 Dados mortos / payload
8. `incomplete_profiles` e `without_vocational_accompaniment` são **calculados e trafegados, mas nunca exibidos**.

### 3.3 Desempenho
9. **~20 queries sequenciais, sem cache**, a cada carga e a cada pull-to-refresh. Hoje irrelevante (base pequena), mas escala mal e não há nenhuma janela de cache para um painel cuja granularidade é diária.

### 3.4 Produto / clareza
10. **Título "Visão geral do aplicativo"** não corresponde ao conteúdo (é demografia de cadastro, não uso do app).
11. **Rótulo "Engajamento"** é impróprio (são campos declarados no cadastro).
12. **Sem séries temporais** — tudo é foto do instante (exceto novos 7d/30d). Governança se beneficiaria de tendências.
13. **Linguagem técnica** exposta a conselheiros: "Memberships", "Total Ativos", "Perfil Vocacional".

### 3.5 Telas Admin vizinhas (achados relevantes)
14. **Logs de Auditoria com rótulos desalinhados.** O `ACTION_META` traduz `member_removed` (✓ existe), mas também `member_invited`, `invite_accepted`, `invite_declined`, `role_updated` — **que o backend nunca emite**. O backend emite `member_role_updated` (≠ `role_updated`), além de `VIEW_FULL_PROFILE`, `VIEW_CPF_RG`, `EXPORT_*`, `sensitive_*`, `channel_*`, `legal_accepted`, `phone/email_*`, `account_deleted`, `user_provisioned`, `profile_created/updated`, `membership_*`, `inbox_critical_sent`, `org_unit_created`. **Resultado:** quase todos os eventos aparecem como código cru cinza (ex.: "VIEW_FULL_PROFILE"). Só remoção de membro fica bonita.
15. **Tela de Aprovações sem entrada no menu** — fila de exportações sensíveis fica "escondida".

---

## 4. Proposta de novo Dashboard Admin

### 4.1 Métricas realmente úteis (manter / promover)
- **Usuários ativos** (Total) + **% de perfis completos** (com base explícita) + **novos no período** (com seletor 7/30/90d).
- **Distribuição vocacional** (Realidade Vocacional, Estado de Vida) — núcleo da missão; manter, mas com base N.
- **Pessoas com vínculo ativo** (DISTINCT) + **vínculos por tipo de unidade**.
- **Funil de convites** reformulado (aceitos / recusados / pendentes / expirados) + **taxa de conversão sobre resolvidos**.
- **Top Ministérios** corrigido (por id, rotulado com setor).
- **Cobertura de acompanhamento vocacional** como razão (com/total que informou).

### 4.2 Métricas que devem sair
- `incomplete_profiles` e `without_vocational_accompaniment` da forma atual (mortos) — ou viram base de uma razão.
- **Geografia por cidade** enquanto não houver normalização e supressão de pequenos números (risco de privacidade > valor).
- Cards de "Engajamento" como estão (renomear, não remover).

### 4.3 Métricas que devem ser agrupadas
- **Bloco "Quem somos"**: Estado de Vida + Realidade Vocacional + Estado Civil + Faixa etária (demografia).
- **Bloco "Comunidade"**: pessoas com vínculo + vínculos por tipo + top ministérios.
- **Bloco "Crescimento"**: novos no período + funil de convites.
- **Bloco "Saúde do cadastro"**: % completos + cobertura de acompanhamento + interesse em ministério.

### 4.4 Dados que precisam de **novo endpoint** (futuro — não agora)
- **Séries temporais** (novos cadastros por mês, convites por mês) — exige agregação por data.
- **Uso real do app** (logins/ativos, adesão ao Projeto de Vida, leitura de avisos, inscrições em retiros) — exige novas queries/tabelas de eventos.
- **Pessoas distintas com vínculo** (DISTINCT user) — pequeno ajuste, hoje inexistente.

### 4.5 Dados que já existem e podem ser reaproveitados
- Tudo do payload atual de `/admin/dashboard` (é real). Reaproveitar `top_ministries`, `by_unit_type`, catálogos, faixas etárias.
- `incomplete_profiles`/`without_vocational_accompaniment` já vêm prontos para virar denominadores.
- `GET /inbox/sent` traz `recipient_count`/`read_count` (taxa de leitura de avisos) — reaproveitável para um KPI de comunicação.
- Logs de auditoria já existem para um widget "atividade administrativa recente".

### 4.6 Dados sensíveis que **NÃO** devem aparecer
- **CPF/RG** — já corretamente fora do dashboard (só via fluxo de aprovação). Manter.
- **Nomes/identificação individual** no painel de métricas — o dashboard deve ser **só agregado**. (Cuidado: pequenos buckets de cidade já beiram a identificação.)
- **Audit log com nomes e UUIDs** é acessível a **ANALISTA** via API direta (o menu esconde, mas `require_admin_or_analista` libera). Reavaliar se "analista de métricas" deve ler quem-fez-o-quê-a-quem. (Fora do escopo de mexer agora — apenas sinalizado.)

### 4.7 Melhor hierarquia visual
1. **Topo:** 3–4 KPIs grandes (Usuários ativos, % cadastro completo, Novos no período, Taxa de conversão de convites).
2. **Crescimento** (tendência) logo abaixo.
3. **Quem somos** (demografia/vocacional) — o coração para conselheiros.
4. **Comunidade** (vínculos, ministérios).
5. **Saúde do cadastro** + atalho discreto para Logs/Aprovações.
- Cada número-chave com **base e período** visíveis; toda razão como "X de Y (Z%)".

### 4.8 Linguagem para conselheiros e administradores não técnicos
| Hoje | Proposto |
|---|---|
| "Visão geral do aplicativo" | "Panorama da comunidade" |
| "Memberships / Total Ativos" | "Vínculos ativos / Pessoas com vínculo" |
| "Perfil Vocacional" | "Vocação e estado de vida" |
| "Engajamento" | "Acompanhamento e interesse" |
| "Taxa de aceitação" (s/ contexto) | "Convites aceitos (entre os respondidos)" |
| "Top Ministérios" | "Ministérios com mais membros" |

---

## 5. Plano de implementação futuro (faseado, quando autorizado)

**Fase 0 — Correções de baixo risco (backend de leitura, sem schema):**
- Taxa de aceitação sobre resolvidos; expor expirados/cancelados.
- `top_ministries` por `id` + rótulo de setor.
- Geografia: `trim`/normalização + excluir vazios + suprimir buckets pequenos.
- Idade com `relativedelta`.
- Remover/expor campos mortos.

**Fase 1 — Clareza de UI (só frontend):**
- Renomear seções/títulos (linguagem não técnica).
- Toda razão com base N e período; KPIs no topo.
- Completar `ACTION_META` dos logs (ou mapear no backend) para acabar com códigos crus.

**Fase 2 — Pessoas distintas + cache:**
- Métrica DISTINCT de pessoas com vínculo.
- Cache curto (ex.: 5–15 min) no `/admin/dashboard`.

**Fase 3 — Novos dados (novo endpoint + possíveis tabelas de evento):**
- Séries temporais (cadastros/convites por mês).
- Uso real (ativos, adesão ao Projeto de Vida, leitura de avisos, inscrições em retiros).

---

## 6. Riscos de dados e privacidade

- **Baixo no dashboard atual:** o payload é **100% agregado**, sem PII. CPF/RG estão fora (gated por aprovação — já endurecido em H5B). ✅
- **k-anonimato (médio):** rankings de **cidade** com contagem 1–2 em organização pequena podem **identificar pessoas**. Recomenda-se suprimir buckets pequenos.
- **Escopo de papel (médio):** **ANALISTA** alcança `/admin/audit-logs` (nomes + UUIDs + ações sobre terceiros) pela API, mesmo o menu mostrando só Dashboard. Reavaliar se o papel "métricas" deveria ler trilha de auditoria nominal.
- **Exposição acidental por dado morto:** campos trafegados-e-não-exibidos aumentam superfície sem benefício; preferir não enviar o que não se mostra.
- **LGPD:** alinhado ao princípio de minimização **desde que** se trate a fragilidade de pequenos números na geografia.

---

## 7. Recomendação final

**Redesenhar parcialmente.** A fundação é sólida — **todos os dados são reais (zero mock)**, a autorização do dashboard está correta e dados sensíveis já estão fora. Os problemas são de **semântica, clareza e algumas fórmulas**, não de arquitetura.

Caminho recomendado:
1. **Não jogar fora** — o backend já entrega quase tudo de que se precisa.
2. **Corrigir as 7 inconsistências de cálculo** (Seção 3.1) — são pontuais e de baixo risco.
3. **Reescrever a camada de apresentação** com linguagem para conselheiros, KPIs no topo, bases e períodos explícitos.
4. **Tratar geografia/privacidade** antes de destacar cidades.
5. **Adiar** séries temporais e métricas de uso real para uma fase com novo endpoint.

**Redesenho total não se justifica:** desperdiçaria uma base correta e funcional.

---

### Anexo — Arquivos-chave

- Frontend: [dashboard.tsx](../../../lumen_mobile/app/admin/dashboard.tsx), [admin/index.tsx](../../../lumen_mobile/app/admin/index.tsx), [audit-logs.tsx](../../../lumen_mobile/app/admin/audit-logs.tsx), [services/index.ts](../../../lumen_mobile/src/services/index.ts)
- Backend: [routes/admin.py](../../../backend/app/api/routes/admin.py) (`get_dashboard` ~L571), [services/organization.py](../../../backend/app/services/organization.py), [routes/export.py](../../../backend/app/api/routes/export.py)
- Modelos: `User`, `UserProfile`, `OrgMembership`, `OrgUnit`, `OrgInvite`, `ProfileCatalogItem`, `AuditLog` em [db/models.py](../../../backend/app/db/models.py)
