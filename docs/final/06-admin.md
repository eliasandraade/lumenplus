# Lumen+ — Painel Administrativo

**Versão da documentação:** 1.0  
**Data:** 2026-06-12  
**Audiência:** desenvolvedor, administrador, operador

---

## Visão Geral

O painel Admin é a área restrita do Lumen+ para gerenciar a plataforma: usuários, unidades organizacionais, comunicados, retiros, logs de auditoria e exportações de dados sensíveis. É acessado via URL `/admin` e protegido por papéis globais — tanto no frontend (controle de UX) quanto no backend (autorização real de cada requisição).

O frontend usa a cor `#7c3aed` (roxo) para distinguir visualmente o contexto administrativo do app regular.

---

## Quem Acessa

A tela de menu Admin (`app/admin/index.tsx`) usa `authService.getMe()` para obter os papéis frescos do servidor e determinar o que exibir:

| Papel | O que vê no menu Admin |
|-------|------------------------|
| `DEV` | Todas as seções |
| `ADMIN` | Todas as seções |
| `ANALISTA` | Apenas a seção Análise (Dashboard) — frontend oculta as demais seções |
| Coordenador do Conselho Geral | Pode listar usuários (via `is_conselho_geral_coordinator`) |
| Sem papel admin | Não deveria acessar `/admin`; o backend rejeita qualquer chamada |

> **Separação frontend/backend:** o menu exibe ou oculta seções com base no papel, mas isso é controle de UX, não de segurança. O backend verifica papéis em cada endpoint independentemente. Um ANALISTA que acessasse diretamente `/admin/users` receberia 403 em todas as chamadas de dados.

> **Pendência POST-RC:** `app/admin/_layout.tsx` não aplica um guard de papel no nível de rota — qualquer URL `/admin/*` é acessível via deep-link. O backend bloqueia as chamadas de API, mas o frontend pode renderizar telas vazias ou com erro antes do bloqueio chegar.

---

## Menu Admin — Seções

As seções do menu são:

| Seção | Opções | Papel mínimo (frontend) |
|-------|--------|------------------------|
| **Análise** | Dashboard | ANALISTA, ADMIN, DEV |
| **Comunicações** | Criar Aviso, Avisos Enviados | ADMIN, DEV |
| **Eventos** | Retiros | ADMIN, DEV |
| **Estrutura** | Entidades | ADMIN, DEV |
| **Pessoas** | Gestão de Usuários | ADMIN, DEV |
| **Segurança** | Logs de Auditoria, Aprovações | ADMIN, DEV |

> **Nota:** ANALISTA vê apenas a seção Análise no menu; SECRETARY e COUNCIL_GENERAL têm acesso a endpoints específicos no backend, mas o menu Admin não é personalizado para eles — eles acessam as telas por URL direta ou via fluxo de aprovação.

---

## Dashboard

### O que é

O Dashboard exibe métricas operacionais e demográficas da comunidade, obtidas via `GET /admin/dashboard`. Todos os dados são reais — nenhum número é mockado ou estimado.

### Conteúdo atual

| Bloco | Métricas |
|-------|---------|
| Usuários | Total ativo, perfis completos, novos em 7d e 30d |
| Faixas etárias | Distribuição por buckets (<18, 18-25, 26-35, 36-45, 46-60, >60, Não informado) |
| Geografia | Top 10 cidades e estados |
| Perfil Vocacional | Estado de vida, realidade vocacional, estado civil (por catálogo) |
| Engajamento | Acompanhamento vocacional, interesse em ministério, origem de missão |
| Memberships | Total de vínculos ativos; vínculos por tipo de unidade |
| Convites | Total, aceitos, pendentes, recusados; taxa de aceitação |
| Top Ministérios | Ministérios com mais vínculos ativos (top 10) |

### Estado atual após Admin 2.0 Fase 1

A Fase 1 das correções do Dashboard foi implementada (jun/2026). Os seguintes pontos foram corrigidos:

- **Convites:** taxa de aceitação calculada sobre resolvidos — `aceitos ÷ (aceitos + recusados)` — não sobre o total. Expirados e cancelados são contados e exibidos separadamente.
- **Top Ministérios:** agrupamento por `id` (não por nome), com `sector_name` para desambiguação de homônimos e contagem de pessoas (DISTINCT user_id).
- **Vínculos vs. pessoas:** dashboard exibe dois números distintos: "Vínculos ativos" e "Pessoas participando" (`people_active = COUNT(DISTINCT user_id)`).
- **Bases de percentual:** catálogos (estado de vida, realidade vocacional, estado civil) exibem "X de N que informaram".
- **Linguagem:** subtítulo "Visão geral do aplicativo" → **"Panorama da comunidade"**; seções renomeadas para linguagem pastoral.

### Limites conhecidos (remanescentes)

- **Não é Analytics Missionais:** o dashboard mede cadastro e demografia, não engajamento real (adesão ao Projeto de Vida, leitura de avisos, logins). Métricas missionais requerem novas tabelas de evento — POST-RC.
- **Sem cache:** ~20 queries SQL executadas sequencialmente a cada carregamento e pull-to-refresh. Adequado para a base atual; escala mal com crescimento.
- **ANALISTA e audit-logs (tensão conhecida):** o endpoint backend `/admin/audit-logs` autoriza ANALISTA (via `require_admin_or_analista`). O menu Admin do frontend oculta Logs para ANALISTA — ele vê apenas Dashboard. Se um ANALISTA acessar `/admin/audit-logs` diretamente, o backend responde normalmente. O documento Admin 2.0 registrou como ponto a reavaliar: "Analistas — sem PII individual; reavaliar acesso atual à trilha de auditoria nominal."

---

## Gestão de Usuários

### Listagem

`GET /admin/users` — Acesso: ADMIN, DEV, SECRETARY (e coordenador do Conselho Geral para leitura básica).

Permite filtros por papel, estado de perfil, unidade. Retorna lista paginada com nome, e-mail, papéis, status.

### Perfil Completo

`GET /admin/users/{id}/profile` — Acesso: ADMIN, DEV, SECRETARY.

Retorna perfil completo incluindo dados de catálogo e histórico de auditoria. **CPF e RG** são retornados descriptografados apenas se:
- O solicitante tem papel **DEV** (bypass direto), ou
- Existe uma `SensitiveAccessRequest` **APROVADA e não expirada** para o par (solicitante, usuário-alvo)

Sem aprovação, ADMIN e SECRETARY recebem `cpf=null, rg=null` e devem usar o fluxo de acesso sensível.

### Edição de Papéis

`PATCH /admin/users/{id}` — Acesso: ADMIN, DEV. Permite adicionar ou remover papéis globais de um usuário via allow-list.

### Acesso a Documentos Sensíveis (CPF/RG)

Fluxo completo via `/admin/sensitive-access`:

1. **Solicitação**: SECRETARY ou DEV cria request com justificativa (`POST /admin/sensitive-access/request`)
2. **Aprovação**: ADMIN ou DEV diferente do solicitante aprova (`POST /admin/sensitive-access/{id}/approve`) — auto-aprovação bloqueada
3. **Acesso**: janela de tempo configurada; `GET /admin/users/{id}/documents` ou `/profile`
4. **Auditoria**: acesso registrado em `audit_logs` com IP, user-agent e actor

### Exclusão/Anonimização de Conta

`DELETE /admin/users/{id}` — Acesso: ADMIN, DEV.

| Ator | Pode excluir |
|------|-------------|
| DEV | Qualquer conta, exceto si mesmo e outras contas DEV |
| ADMIN | Contas sem papel DEV ou ADMIN |

A exclusão usa `anonymize_user` (mesmo serviço do self-delete):
- Remove imediatamente: perfil, CPF/RG, preferências, memberships, papéis
- Anonimiza e-mail na identidade
- Retém: linha `User` (`is_active=False`), `UserConsent`, `AuditLog` (obrigação legal de 5 anos)
- É idempotente: contas já inativas retornam 204 sem reprocessar
- Registra em `audit_logs` com `actor_user_id` e motivo opcional

O frontend exige confirmação por nome do usuário antes de executar a exclusão (controle de UX — webfriendly).

### Exportação

`POST /admin/export/request` — inicia exportação de usuários em CSV. Exportações com CPF/RG passam por fluxo de aprovação antes de serem geradas. Acessível via ícone dentro da tela de Usuários.

---

## Entidades (Estrutura Organizacional)

`app/admin/entities/index.tsx` — Acesso: ADMIN, DEV (e coordenadores com permissão).

Exibe a árvore de unidades organizacionais (`GET /org/tree`). Permite criar, editar e gerenciar membros de cada unidade. Coordenadores veem apenas as unidades que coordenam.

Hierarquia: `CONSELHO_GERAL → CONSELHO_EXECUTIVO → SETOR → MINISTERIO → GRUPO`; existe também o tipo `MISSAO`.

---

## Aprovações

`app/admin/approvals/index.tsx` — Acesso: ADMIN, DEV, COUNCIL_GENERAL.

Fila de solicitações de exportação de dados pendentes de aprovação. Cada solicitação pode ser aprovada ou rejeitada. Aprovação de exportações com dados sensíveis exige que o aprovador seja diferente do solicitante (separação de deveres).

A tela de Aprovações está na seção "Segurança" do menu Admin.

---

## Retiros (Admin)

`app/admin/retreats/` — Acesso: ADMIN, DEV, e coordenadores de retiro designados.

Cobre criação, edição, publicação, gestão de inscrições e equipes de serviço. Detalhado em `09-retiros-eventos.md`.

---

## Comunicações

`app/admin/create-aviso.tsx` e `app/admin/sent-avisos.tsx`.

Criação de avisos com segmentação por unidade ou perfil. `app/admin/sent-avisos.tsx` lista avisos enviados. Detalhado em `10-notificacoes-inbox.md`.

---

## Logs de Auditoria

`app/admin/audit-logs.tsx` — `GET /admin/audit-logs` — Acesso: ADMIN, DEV, ANALISTA.

Registra ações sensíveis da plataforma: acesso a perfis, exportações, exclusões, login/logout, mudanças de papel, ações de canal, termos aceitos, etc.

**Nota de UX (POST-RC):** os rótulos de eventos no frontend (`ACTION_META`) não cobrem todos os códigos que o backend emite. Eventos não mapeados aparecem como código cru (ex.: `VIEW_FULL_PROFILE`). Apenas alguns eventos como `member_removed` têm rótulo legível. Mapeamento completo é dívida pós-RC.

---

## Pendências POST-RC

| Item | Descrição |
|------|-----------|
| Role guard em `_layout.tsx` | Rotas admin acessíveis por deep-link; backend bloqueia as chamadas mas frontend pode renderizar erro antes do bloqueio |
| Analytics Missionais | Dashboard atual é demográfico/operacional; métricas de uso real (adesão ao PdV, leitura de avisos, ativos) requerem novas tabelas de evento — fora do escopo do RC |
| Mapeamento de ACTION_META (parcial) | A spec Admin 2.0 Fase 1 previu reescrita do `ACTION_META` com as ações reais do backend; verificar se a implementação foi completada ou se ainda há códigos crus no frontend |
| ANALISTA e trilha de auditoria | Backend permite ANALISTA em `/admin/audit-logs`; decisão sobre restringir ou manter está documentada como pendente |

---

## Próxima leitura

- **Autenticação e papéis:** `05-autenticacao-permissoes.md`
- **Backend — endpoints admin:** `03-backend.md`
- **Segurança e hardening:** `11-seguranca-hardening.md`
- **LGPD e dados sensíveis:** `13-lgpd-dados-sensiveis.md`
