# Estrutura da Documentação Final — Lumen+

**Data:** 2026-06-12  
**Status:** Proposta consolidada — aguardando autorização para escrita  
**Contexto:** Frontend RC Aprovado com Observações. Backend H1→H6A em produção. Admin 2.0 Fase 1/1.1 em produção.

---

## 1. Organização de Pastas

```
docs/
├── superpowers/          ← artefatos de ciclo (não mover, não editar)
│   ├── audits/
│   ├── plans/
│   └── specs/
└── final/                ← documentação final do produto (criar)
    ├── README.md
    ├── 01-visao-geral.md
    ├── 02-arquitetura.md
    ├── 03-backend.md
    ├── 04-frontend.md
    ├── 05-autenticacao-permissoes.md
    ├── 06-admin.md
    ├── 07-projeto-de-vida.md
    ├── 08-comunidade-canal-membros.md
    ├── 09-retiros-eventos.md
    ├── 10-notificacoes-inbox.md
    ├── 11-seguranca-hardening.md
    ├── 12-deploy-ambientes.md
    ├── 13-lgpd-dados-sensiveis.md
    ├── 14-roadmap-pos-rc.md
    ├── 15-guia-admin.md
    └── 16-guia-usuario.md
```

Total: 17 arquivos (1 índice + 16 seções).

---

## 2. Arquivos a Criar em `docs/final/`

### README.md — Índice raiz

**Objetivo:** Ponto de entrada. Apresenta o app, lista todas as seções com link e uma linha de descrição cada, indica por onde começar conforme o perfil do leitor.  
**Público:** todos.  
**Escrever após:** seções 1–16 concluídas.

---

### 01-visao-geral.md

**Objetivo:** Responder "o que é o Lumen+, para quem serve e qual problema resolve" sem entrar em código ou operação.  
**Conteúdo:** missão do produto; público-alvo (membros de comunidade eclesial); modelo conceitual (usuário → unidade organizacional → papéis); plataformas (web, iOS, Android); estado atual (RC aprovado, em produção).  
**Público:** desenvolvedor, administrador, conselho/gestão.  
**Tipo Diataxis:** Explanation.

**Documentos a incorporar/referenciar:**
- `README.md` (raiz) — extrair e atualizar descrição do produto
- `docs/superpowers/plans/2026-06-04-revisao-arquitetural.md` — contexto de produto
- `docs/superpowers/plans/2026-06-04-plano-execucao-final.md` — escopo aprovado

---

### 02-arquitetura.md

**Objetivo:** Diagrama de componentes e fluxo de dados entre as três camadas do sistema.  
**Conteúdo:** diagrama ASCII da arquitetura (FastAPI + PostgreSQL + Alembic, Expo/RN, Firebase Auth, Railway, Vercel, Cloudinary, Sentry); fluxo de autenticação de ponta a ponta; fluxo de um request típico; decisões arquiteturais não óbvias.  
**Público:** desenvolvedor, operador de deploy.  
**Tipo Diataxis:** Explanation + Reference.

**Documentos a incorporar/referenciar:**
- `docs/superpowers/plans/2026-06-04-revisao-arquitetural.md` — decisões arquiteturais
- `CLAUDE.md` (seção Stack) — fonte de verdade da stack atual
- `lumen_mobile/vercel.json` — CSP e headers de segurança

---

### 03-backend.md

**Objetivo:** Referência técnica da API, modelos de dados, migrations e como rodar localmente.  
**Conteúdo:** estrutura de `backend/app/`; endpoints por domínio (auth, users, orgs, retiros, projeto de vida, canal, avisos); modelo de roles (`global_roles`); Alembic migrations; variáveis de ambiente obrigatórias; Railway deployment.  
**Público:** desenvolvedor, operador de deploy.  
**Tipo Diataxis:** Reference + How-to.

**Documentos a incorporar/referenciar:**
- `backend/README.md` — base para expandir
- `docs/superpowers/audits/2026-06-07-h0-hardening-audit-report.md` — baseline de segurança da API

---

### 04-frontend.md

**Objetivo:** Mapa de rotas, design system, convenções e como adicionar uma tela nova.  
**Conteúdo:** mapa de rotas (`app/`); design system (tokens em `src/theme/tokens.ts`, paleta navy `#1a365d`, dark/light); componentes UI (`src/components/ui/`); convenções (`useTheme`, `showAlert`/`showConfirm`); variáveis de ambiente Expo; bundle web (limitações conhecidas).  
**Público:** desenvolvedor.  
**Tipo Diataxis:** Reference + Explanation.

**Documentos a incorporar/referenciar:**
- `docs/superpowers/specs/2026-06-06-cp7.1-restaurar-paleta-light-theme.md` — decisão de paleta
- `docs/superpowers/plans/2026-06-05-cp6-design-system-consolidation.md` — design system
- `docs/superpowers/audits/2026-06-11-frontend-rc-final-checklist.md` — estado atual do frontend (RC aprovado)

---

### 05-autenticacao-permissoes.md

**Objetivo:** Explicar o modelo Firebase + JWT + papéis e o que cada papel pode fazer.  
**Conteúdo:** fluxo de login (Firebase Auth → token → `/auth/me` → store); papéis globais (`DEV`, `ADMIN`, `ANALISTA`, membro regular); papéis por unidade (coordenador, membro); fail-fast de configuração (`MISCONFIGURED`); modo DEV (`IS_DEV_AUTH`); refresh de token; guard de rotas no frontend.  
**Público:** desenvolvedor, administrador.  
**Tipo Diataxis:** Explanation + Reference.

**Documentos a incorporar/referenciar:**
- `docs/superpowers/audits/2026-06-11-rc-fe-auth-store-audit.md` — RC-FE-AUTH-01 (role reads seguros)
- `docs/superpowers/plans/2026-06-03-cargos-gestao-usuarios.md` — modelo de cargos
- `docs/superpowers/specs/2026-06-03-cargos-gestao-usuarios-design.md` — design de permissões
- `docs/superpowers/audits/2026-06-07-h5a-authz-idor-matrix.md` — matriz de autorização IDOR

---

### 06-admin.md

**Objetivo:** O que o painel admin contém, quem acessa o quê e como usar cada seção.  
**Conteúdo:** rotas admin (`/admin/*`); guard por role (ANALISTA vê só Dashboard; ADMIN/DEV veem tudo); seções (Dashboard, Usuários, Entidades, Aprovações, Retiros, Avisos, Logs de Auditoria); Analytics Missionais (decisão de governança — POST-RC); comportamento de exclusão de conta.  
**Público:** administrador, desenvolvedor.  
**Tipo Diataxis:** Reference + How-to.

**Documentos a incorporar/referenciar:**
- `docs/superpowers/audits/2026-06-10-admin-dashboard-audit.md` — auditoria do dashboard
- `docs/superpowers/specs/2026-06-10-admin-2.0-fase-1-correcoes.md` — Admin 2.0 Fase 1
- `docs/superpowers/specs/2026-06-10-admin-2.0-fase-1.1-missao-labels-e-dev-exclusao.md` — Fase 1.1
- `docs/superpowers/specs/2026-06-11-admin-exclusao-conta.md` — fluxo de exclusão

---

### 07-projeto-de-vida.md

**Objetivo:** Documentar a feature mais complexa do app — conceito, fluxo completo, PIN, ciclos e privacidade.  
**Conteúdo:** conceito (ciclo mensal de discipulado); estrutura de dados (ProjetoVidaMensal, áreas, semanal, diário, exame, revisão); fluxo do wizard (11 passos); sistema de PIN/unlock; histórico; privacidade (conteúdo não visível no admin, protegido por PIN).  
**Público:** desenvolvedor, administrador.  
**Tipo Diataxis:** Explanation + How-to.

**Documentos a incorporar/referenciar:**
- `docs/superpowers/plans/2026-04-29-projeto-vida-mensal.md` — concepção original
- `docs/superpowers/plans/2026-06-06-projeto-vida-2.0-implementacao.md` — implementação v2.0
- `docs/superpowers/specs/2026-06-06-projeto-vida-2.0-spec.md` — spec v2.0

---

### 08-comunidade-canal-membros.md

**Objetivo:** Canal de grupos ministeriais, membros de unidades organizacionais, convites e cargos.  
**Conteúdo:** modelo de unidade organizacional (tipos: CONSELHO_GERAL, SETOR, VIDA etc.); canal de posts por unidade (`/channel/[unitId]`); gestão de membros (`/members`); coordenador (`/coordinator`); sistema de convites (invite → aceite → membership); alteração de cargo; confirmações web-safe.  
**Público:** desenvolvedor, administrador.  
**Tipo Diataxis:** Reference + How-to.

**Documentos a incorporar/referenciar:**
- `docs/superpowers/plans/2026-06-04-canal-grupos-ministerio.md` — concepção do canal
- `docs/superpowers/plans/2026-06-04-canal-redesign-cp4.md` — redesign CP4
- `docs/superpowers/plans/2026-06-05-cp5-perfil-comunidade-membros.md` — comunidade e membros

---

### 09-retiros-eventos.md

**Objetivo:** Ciclo de vida de um retiro — criação, publicação, inscrição, pagamento e confirmação.  
**Conteúdo:** tipos de retiro (WEEKEND, DAY, FORMATION); estados (PUBLISHED, CLOSED); status de inscrição (PENDING_PAYMENT → PAYMENT_SUBMITTED → CONFIRMED / WAITLIST); upload de comprovante; criação e edição pelo admin; papel do coordenador de retiro.  
**Público:** desenvolvedor, administrador.  
**Tipo Diataxis:** Reference + How-to.

**Documentos a incorporar/referenciar:**  
Nenhum doc de superpowers diretamente sobre retiros. Escrito a partir do código (`app/retreats/`, `app/admin/retreats/`).

---

### 10-notificacoes-inbox.md

**Objetivo:** Avisos enviados por admin, inbox do usuário e estado atual das push notifications.  
**Conteúdo:** modelo de aviso (criação pelo admin com filtros por life_state/unidade/deeplink); inbox do usuário (`/invites`); status de leitura; push notifications — o que foi implementado vs. o que é POST-RC.  
**Público:** desenvolvedor, administrador.  
**Tipo Diataxis:** Reference.

**Documentos a incorporar/referenciar:**
- `docs/superpowers/plans/2026-06-04-notificacoes-push-email.md` — separar implementado de roadmap

---

### 11-seguranca-hardening.md

**Objetivo:** Medidas de segurança implementadas e modelo de ameaças atual.  
**Conteúdo:** resumo do hardening (H1 validação de input, H2 rate limiting, H3 CORS, H4 headers, H5A autorização IDOR, H6 auditoria); CSP da Vercel; `MISCONFIGURED` guard; modelo de autorização (matriz IDOR); logs de auditoria no admin.  
**Público:** desenvolvedor, operador de deploy, conselho/gestão.  
**Tipo Diataxis:** Explanation + Reference.

**Documentos a incorporar/referenciar:**
- `docs/superpowers/audits/2026-06-07-h0-hardening-audit-report.md` — baseline H0
- `docs/superpowers/audits/2026-06-07-h5a-authz-idor-matrix.md` — matriz IDOR completa
- `docs/superpowers/plans/2026-04-28-security-hardening.md` — plano original de hardening

---

### 12-deploy-ambientes.md

**Objetivo:** Como deployar backend e frontend, variáveis de ambiente necessárias e estrutura de ambientes.  
**Conteúdo:** tabela de ambientes (dev/staging/production); backend Railway (variáveis obrigatórias, health check `{"status":"healthy","version":"0.3.0"}`, logs); frontend Vercel (project ID `prj_eVkMyGDdSBg1b95qGC1ID8CYUAP8`, build command, output dir, rewrites); EAS para mobile (bundle IDs); checklist de deploy seguro.  
**Público:** operador de deploy, desenvolvedor.  
**Tipo Diataxis:** How-to + Reference.

**Documentos a incorporar/referenciar:**
- `CLAUDE.md` (seção Deploy Seguro) — referenciar, não duplicar
- `lumen_mobile/vercel.json` — configuração canônica Vercel
- `lumen_mobile/.env.example` — variáveis de ambiente frontend

---

### 13-lgpd-dados-sensiveis.md

**Objetivo:** Onde vivem dados pessoais, quais são sensíveis, como são protegidos e direitos do titular.  
**Conteúdo:** dados coletados (nome, CPF/RG, telefone, foto, email); onde são armazenados (PostgreSQL no Railway, Firebase Auth, Cloudinary); dados do Projeto de Vida (protegidos por PIN, não visíveis no admin); LGPD consent flow (terms/privacy pending no onboarding); exclusão de conta (fluxo admin e auto-exclusão); Sentry (`sendDefaultPii: false`).  
**Público:** conselho/gestão, desenvolvedor, administrador.  
**Tipo Diataxis:** Explanation + Reference.

**Documentos a incorporar/referenciar:**
- `docs/superpowers/plans/2026-06-10-decisoes-governanca-analytics-missionais.md` — governança de dados
- `docs/superpowers/specs/2026-06-11-admin-exclusao-conta.md` — fluxo de exclusão

---

### 14-roadmap-pos-rc.md

**Objetivo:** Registro formal do que foi aprovado como POST-RC e do roadmap de features futuras. Snapshot datado — não é um documento vivo.  
**Conteúdo:** pendências POST-RC aceitas formalmente; features planejadas não implementadas; dívida técnica conhecida.  
**Público:** conselho/gestão, desenvolvedor.  
**Tipo Diataxis:** Reference (snapshot datado 2026-06-12).

**Documentos a incorporar/referenciar:**
- `docs/superpowers/audits/2026-06-11-frontend-rc-final-checklist.md` — seção POST-RC (fonte canônica)
- `docs/superpowers/plans/2026-06-10-lumen-analytics-missionais-data-foundation.md` — Analytics Missionais
- `docs/superpowers/plans/2026-06-06-cp8-evangelizacao-ser-feliz.md` — CP8 evangelização
- `docs/superpowers/plans/2026-06-04-notificacoes-push-email.md` — push notifications (parcialmente implementado)

---

### 15-guia-admin.md

**Objetivo:** Passo a passo para tarefas do dia a dia de um administrador.  
**Conteúdo:** como acessar o painel; criar e publicar um aviso; gerenciar inscrições em retiro; aprovar/rejeitar exportação de dados; promover membro a coordenador; ver logs de auditoria; diferença prática entre DEV/ADMIN/ANALISTA.  
**Público:** administrador.  
**Tipo Diataxis:** Tutorial + How-to.

**Documentos a incorporar/referenciar:**
- `docs/superpowers/specs/2026-06-10-admin-2.0-fase-1-qa-checklist.md` — adaptar checklist para guia operacional

---

### 16-guia-usuario.md

**Objetivo:** Onboarding de novos membros, do primeiro acesso ao uso pleno do app.  
**Conteúdo:** criar conta (email + senha via Firebase); aceitar termos; completar documentos (CPF/RG); preencher perfil; navegar pelas abas; criar um Projeto de Vida Mensal (wizard); participar do canal de grupos; se inscrever em um retiro.  
**Público:** usuário final.  
**Tipo Diataxis:** Tutorial.

**Documentos a incorporar/referenciar:**  
Escrito primariamente a partir do código de onboarding (`app/(onboarding)/`, `app/vida/wizard.tsx`). Nenhum doc de superpowers adequado para guia de usuário final.

---

## 3. Público-Alvo por Seção

| Arquivo | Desenvolvedor | Administrador | Usuário Final | Conselho/Gestão | Operador de Deploy |
|---------|:---:|:---:|:---:|:---:|:---:|
| README.md | ✅ | ✅ | ✅ | ✅ | ✅ |
| 01-visao-geral | ✅ | ✅ | — | ✅ | — |
| 02-arquitetura | ✅ | — | — | — | ✅ |
| 03-backend | ✅ | — | — | — | ✅ |
| 04-frontend | ✅ | — | — | — | — |
| 05-autenticacao-permissoes | ✅ | ✅ | — | — | — |
| 06-admin | ✅ | ✅ | — | — | — |
| 07-projeto-de-vida | ✅ | ✅ | — | — | — |
| 08-comunidade-canal-membros | ✅ | ✅ | — | — | — |
| 09-retiros-eventos | ✅ | ✅ | — | — | — |
| 10-notificacoes-inbox | ✅ | ✅ | — | — | — |
| 11-seguranca-hardening | ✅ | — | — | ✅ | ✅ |
| 12-deploy-ambientes | ✅ | — | — | — | ✅ |
| 13-lgpd-dados-sensiveis | ✅ | ✅ | — | ✅ | — |
| 14-roadmap-pos-rc | ✅ | — | — | ✅ | — |
| 15-guia-admin | — | ✅ | — | — | — |
| 16-guia-usuario | — | — | ✅ | — | — |

---

## 4. Ordem Recomendada de Escrita

A ordem respeita dependências de vocabulário: seções posteriores referenciam conceitos definidos nas anteriores.

| Fase | Seções | Razão |
|------|--------|-------|
| 1 — Fundação | 01, 02 | Estabelecem vocabulário e diagrama de componentes para tudo mais |
| 2 — Base técnica | 05, 03, 04 | Auth/permissões primeiro (referenciada por todas as seções funcionais), depois backend e frontend |
| 3 — Features | 06, 07, 08, 09, 10 | Podem ser escritas em paralelo; cada uma é independente das outras |
| 4 — Operacional | 11, 12, 13 | Dependem da base técnica e das features estarem documentadas |
| 5 — Roadmap | 14 | Fecha o ciclo RC; depende de tudo estar estabilizado |
| 6 — Guias | 15, 16 | Sintetizam todas as seções anteriores em linguagem de usuário/admin |
| 7 — Índice | README.md | Escrito por último, quando todos os arquivos existem |

---

## 5. O Que NÃO Deve Entrar na Documentação Final

- **Specs de desenvolvimento** (raciocínio de implementação, opções descartadas, changelogs internos) — pertencem a `docs/superpowers/`
- **Conteúdo de ciclo** (planos de sprint, audits RC, checklists QA) — referenciados como fonte, não copiados
- **Decisões ainda abertas** — só decisões tomadas e em produção entram na doc final
- **Código-fonte inline** — exemplos de código devem ser mínimos e focados no uso, não na implementação
- **Comentários de revisão ou pendências de revisão** — pertencem ao ciclo, não à doc
- **Configurações locais do desenvolvedor** — `.env.local`, paths de máquina, credenciais de exemplo
- **Features POST-RC não implementadas** — mencionadas apenas em `14-roadmap-pos-rc.md`, sem detalhe de implementação

---

## 6. Pendências POST-RC para o Roadmap (seção 14)

Lista aprovada formalmente no RC Final (2026-06-12):

| ID | Área | Descrição |
|----|------|-----------|
| POST-01 | Frontend / Lint | MAINT-FE-LINT-01 — adicionar `.eslintrc.js` e configurar lint real |
| POST-02 | Frontend / Web | Code splitting para reduzir bundle web de 11.1 MB |
| POST-03 | Frontend / Debug | Remover `console.log('Error loading data:', error)` de `app/(tabs)/home.tsx:111` |
| POST-04 | Frontend / Segurança | Adicionar role guard no `app/admin/_layout.tsx` |
| POST-05 | Frontend / Tema | Migração completa das 585 ocorrências de hardcoded hex colors para tokens do design system |
| POST-06 | Frontend / Web | Auditar Service Worker (`dist/sw.js`) para comportamento de cache offline |
| POST-07 | Backend / Analytics | Analytics Missionais — foundation de dados (ver `docs/superpowers/plans/2026-06-10-lumen-analytics-missionais-data-foundation.md`) |
| POST-08 | Mobile | Push notifications completas (implementação parcial — ver `docs/superpowers/plans/2026-06-04-notificacoes-push-email.md`) |
| POST-09 | Frontend / Features | CP8 Evangelização / Ser Feliz (ver `docs/superpowers/plans/2026-06-06-cp8-evangelizacao-ser-feliz.md`) |

---

## 7. Recomendação Final de Execução

**Escrita em sessões separadas, uma fase por vez.**

- Cada sessão recebe uma fase da ordem de escrita (seção 4 acima).
- Ao final de cada fase, revisar e aprovar antes de avançar.
- Não escrever mais de 3–4 seções por sessão para manter qualidade.
- As seções de features (fase 3) podem ser delegadas a subagentes em paralelo.
- `README.md` é o último arquivo a ser criado.

**Checkpoint recomendado:** após Fase 2 (fundação + base técnica), revisar o conjunto antes de escrever as features.

**Não commitar** a pasta `docs/final/` até que todas as 16 seções estejam revisadas e aprovadas.

---

*Documento pronto para aprovação. Nenhum arquivo em `docs/final/` foi criado ainda.*
