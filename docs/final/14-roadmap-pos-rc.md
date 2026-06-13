# Lumen+ — Roadmap POST-RC

**Versão da documentação:** 1.0  
**Data do snapshot:** 2026-06-12  
**Audiência:** desenvolvedor, product owner, operador

---

## 1. Resumo Executivo

Este documento é um **snapshot datado** das pendências aceitas após o RC do Lumen+. Não é uma lista de bugs abertos sem triagem — é o resultado de ciclos completos de auditoria e hardening que identificaram, priorizaram e deferiam conscientemente o que ficaria para ciclos futuros.

**Estado atual do sistema:**

| Componente | Status |
|-----------|--------|
| Backend (FastAPI + PostgreSQL) | Em produção operacional |
| Frontend Web (Vercel SPA) | RC Aprovado com Observações |
| Hardening H1→H6A | Em produção |
| H5A — Auditoria IDOR (7/7) | Corrigido em produção |
| Autenticação Firebase | Em produção |
| Admin 2.0 Fase 1/1.1 | Em produção |

Nenhum item desta lista é blocker atual. Os itens marcados P0 são recomendados para resolução no próximo ciclo de desenvolvimento ativo — não impedem uso presente.

---

## 2. Categorias

| Código | Categoria | Escopo |
|--------|-----------|--------|
| `MAINT-FE` | Técnico / Manutenibilidade Frontend | Dívida técnica acumulada |
| `DS` | Design System | Migração de tokens, hardcoded colors |
| `SEC` | Segurança / Governança | Controles não implementados no RC |
| `LGPD` | LGPD / Dados Pessoais | Conformidade, políticas, fluxos |
| `PROD` | Produto / Funcionalidade | Features e melhorias planejadas |
| `MOBILE` | Mobile | Distribuição, push nativo |
| `ANALYTICS` | Analytics Missionais | Data foundation, KPIs futuros |
| `OPS` | Operação / Deploy | Infraestrutura, CI/CD, staging |

---

## 3. Tabela Consolidada — 35 itens

| Categoria | Qtd | IDs |
|-----------|-----|-----|
| `MAINT-FE` | 5 | MAINT-FE-01 a 05 |
| `DS` | 3 | DS-01 a 03 |
| `SEC` | 6 | SEC-01 a 06 |
| `LGPD` | 7 | LGPD-01 a 07 |
| `PROD` | 5 | PROD-01 a 05 |
| `MOBILE` | 2 | MOBILE-01 a 02 |
| `ANALYTICS` | 2 | ANALYTICS-01 a 02 |
| `OPS` | 5 | OPS-01 a 05 |
| **Total** | **35** | |

### Técnico / Manutenibilidade Frontend

| ID | Título | Descrição | Origem | Impacto | Prioridade | Observação |
|----|--------|-----------|--------|---------|-----------|-----------|
| `MAINT-FE-01` | Configurar ESLint real | `npm run lint` chama `eslint .` sem `.eslintrc` — exit 0 sem inspecionar nenhum arquivo | RC Final checklist (MAJOR-01) | Alto — lint é linha de defesa antes de commits | **P0** | TypeScript compensa parcialmente; próximo ciclo de features ativo deve ter lint funcionando |
| `MAINT-FE-02` | Remover `console.log` de produção | `app/(tabs)/home.tsx:111` tem `console.log('Error loading data:', error)` exposto em produção | RC Final checklist (MINOR-04) | Baixo — polui console do usuário, nenhum dado sensível exposto | **P0** | Correção trivial — 1 linha |
| `MAINT-FE-03` | Role guard em `admin/_layout.tsx` | O layout admin não tem guard de papel — rotas `/admin/*` são acessíveis por deep-link; o backend bloqueia as chamadas de API, mas o frontend pode renderizar telas com erro | RC Final checklist (MINOR-03), `06-admin.md` | Baixo — backend é a barreira real; UX ruim para URLs diretas | **P0** | Adicionar verificação de papel no layout antes de renderizar |
| `MAINT-FE-04` | Auditar Service Worker (`sw.js`) | `dist/sw.js` presente no build mas comportamento de cache offline não validado | RC Final checklist (MINOR-05) | Médio — cache stale pode servir build antigo após deploy | **P1** | Verificar estratégia de cache e invalidação após deploy |
| `MAINT-FE-05` | Code splitting / bundle web | Bundle JS de 11.1 MB sem code splitting — carregamento inicial pesado na web | RC Final checklist (MAJOR-02) | Médio — degradação de UX em conexões lentas; funcional em produção | **P2** | Otimização arquitetural; requer avaliação de Expo/Metro config |

---

### Design System

| ID | Título | Descrição | Origem | Impacto | Prioridade | Observação |
|----|--------|-----------|--------|---------|-----------|-----------|
| `DS-01` | Hardcoded colors em `retreats/index.tsx` | `#1A859B`, `#059669`, `#6b7280` hardcoded — inconsistência visual em dark mode | RC Final checklist (POST-04), `09-retiros-eventos.md` | Baixo — visual, não funcional | **P1** | Escopo pequeno; migrar para tokens do design system |
| `DS-02` | Migração completa de cores hardcoded | 585 ocorrências de hex/rgb/hsl fora dos tokens identificadas no RC | RC Final checklist (POST-01) | Baixo — visual e manutenibilidade | **P3** | Trabalho de volume; pode ser feito gradualmente por área; não bloqueia nada |
| `DS-03` | Spinner de loading em `app/index.tsx` | `backgroundColor: '#1A859B'` hardcoded no estado de loading inicial | RC Final checklist (MINOR-01) | Baixo | **P1** | Correção de 1 linha |

---

### Segurança / Governança

| ID | Título | Descrição | Origem | Impacto | Prioridade | Observação |
|----|--------|-----------|--------|---------|-----------|-----------|
| `SEC-01` | CSP frontend enforced | `Content-Security-Policy-Report-Only` apenas monitora violações — não bloqueia. Migrar para `Content-Security-Policy` (enforced) | `11-seguranca-hardening.md`, `lumen_mobile/vercel.json` | Médio — sem CSP enforced, proteção XSS via browser CSP não existe no frontend | **P1** | Requer validação de que nenhuma fonte legítima é bloqueada antes de ativar |
| `SEC-02` | npm audit — vulnerabilidades transitivas | 41 vulns de runtime (1 crítica `protobufjs`, 22 high) vinculadas ao Expo SDK 52 — sem patches disponíveis no RC | `11-seguranca-hardening.md` (H0) | Médio — dependências transitivas; sem vetor de exploração identificado | **P1** | Monitorar releases do Expo SDK; atualizar quando patches disponíveis |
| `SEC-03` | HSTS preload | `Strict-Transport-Security` sem `preload` — omitido intencionalmente no RC para validar domínio antes | `11-seguranca-hardening.md` (H1) | Baixo — HSTS já ativo sem preload | **P2** | Ativar após confirmar domínio e subdomínios estáveis |
| `SEC-04` | Pentest externo formal | Nenhum teste de penetração externo foi realizado até o RC | `11-seguranca-hardening.md` | Alto — auditoria interna não substitui pentest profissional | **P1** | Recomendado antes de crescimento significativo de base de usuários |
| `SEC-05` | Rotação de chaves/segredos | `ENCRYPTION_KEY` e `HMAC_PEPPER` sem pipeline de rotação segura — rotacionar sem migração de dados inutiliza CPF/RG existentes | `11-seguranca-hardening.md`, `13-lgpd-dados-sensiveis.md` | Alto se chave vazar — hoje sem vetor de risco imediato | **P1** | Documentar e implementar processo de rotação antes de qualquer suspeita de comprometimento |
| `SEC-06` | Mapeamento `ACTION_META` no frontend | Eventos de auditoria não mapeados aparecem como código cru no painel de logs (ex: `VIEW_FULL_PROFILE`) — Admin 2.0 Fase 1 previu reescrita parcial | `06-admin.md` | Baixo — funcional, UX degradada para operadores | **P2** | Confirmar quais eventos ainda aparecem como código cru e completar mapeamento |

---

### LGPD / Dados Pessoais

| ID | Título | Descrição | Origem | Impacto | Prioridade | Observação |
|----|--------|-----------|--------|---------|-----------|-----------|
| `LGPD-01` | Política formal de retenção de dados | A retenção de `AuditLog` e `UserConsent` por 5 anos é operacionalmente assumida no código — não há job de eliminação ao final do prazo nem política formal | `13-lgpd-dados-sensiveis.md` | Médio — sem enforcement técnico da expiração | **P1** | Definir política em documento formal; criar job de eliminação controlada ao fim do prazo |
| `LGPD-02` | DPO formalmente designado | Não há Encarregado de Dados (DPO) identificado na documentação ou código | `13-lgpd-dados-sensiveis.md` | Alto — LGPD art. 41 exige designação para organizações que processam dados | **P1** | Decisão organizacional; designar e documentar antes de crescimento da base |
| `LGPD-03` | ROPA / Inventário de tratamento | Registro de Operações de Tratamento (inventário de quais dados, por quê, por quanto tempo) não existe formalmente | `13-lgpd-dados-sensiveis.md` | Alto — exigência legal de boa prática LGPD | **P1** | Construir junto com DPO; documentar CPF/RG, Analytics futuros, PdV, consentimento |
| `LGPD-04` | Portabilidade de dados (art. 18, V) | Não existe endpoint de export dos próprios dados pelo usuário em formato estruturado | `13-lgpd-dados-sensiveis.md` | Médio — direito do titular não atendido automaticamente | **P2** | Implementar `GET /auth/me/export` com dados de perfil, memberships, consentimento; excluir conteúdo de PdV |
| `LGPD-05` | Recuperação de PIN do Projeto de Vida | Não existe fluxo de reset de PIN — membro perde acesso permanente ao ciclo; tensão com direito de acesso (art. 18, II) | `07-projeto-de-vida.md`, `13-lgpd-dados-sensiveis.md` | Médio — atrito para usuário; potencial tensão jurídica se bloquear acesso a dados próprios | **P2** | Decisão de produto: permitir reset com perda de conteúdo, ou manter bloqueio como proteção de foro íntimo |
| `LGPD-06` | Revisão da Política de Privacidade | Texto legal da política não foi revisado neste ciclo | `13-lgpd-dados-sensiveis.md` | Alto — documento jurídico principal de consentimento | **P1** | Revisão com assessoria jurídica; incluir: bases legais, períodos de retenção, DPO, Analytics futuros |
| `LGPD-07` | Avaliação LGPD para Analytics Missionais | Qualquer coleta de eventos de uso requer nova avaliação de bases legais, minimização e k-anonimato antes de implementar | `docs/superpowers/plans/2026-06-10-lumen-analytics-missionais-data-foundation.md` | Alto se implementado sem revisão | **P1 (pré-requisito para ANALYTICS-01)** | Não implementar nenhum evento de jornada sem esta avaliação aprovada |

---

### Produto / Funcionalidade

| ID | Título | Descrição | Origem | Impacto | Prioridade | Observação |
|----|--------|-----------|--------|---------|-----------|-----------|
| `PROD-01` | Push notifications end-to-end | Backend tem rotas VAPID e modelo de subscription; fluxo completo (permissão → subscription → recebimento web e mobile) não foi auditado em produção | `10-notificacoes-inbox.md`, `11-seguranca-hardening.md` (H5A-07) | Alto para engajamento — sem push, avisos dependem de abertura ativa do app | **P1** | Validar: subscription, entrega web push, entrega FCM mobile; auditoria end-to-end |
| `PROD-02` | Push para eventos do app | Push automático ao receber novo post no canal, confirmação de inscrição em retiro, avisos críticos, lembretes mensais do PdV | `10-notificacoes-inbox.md`, `docs/superpowers/plans/2026-06-04-notificacoes-push-email.md` | Médio — impacto direto no engajamento | **P2** | Depende de PROD-01 validado; plano técnico existe em `notificacoes-push-email.md` |
| `PROD-03` | Email transacional (fallback de push) | Envio de e-mail via SendGrid como fallback quando push não disponível (settings já tem `SENDGRID_API_KEY`) | `12-deploy-ambientes.md`, plano de notificações | Baixo — usuários sem push perdem notificações | **P2** | Plano técnico existe; `SendGrid` configurado; implementação pendente |
| `PROD-04` | Evangelização Ser Feliz (CP8) | Plano de evangelização CP8 existe em `docs/superpowers/plans/2026-06-06-cp8-evangelizacao-ser-feliz.md` — status de implementação não confirmado no RC | `docs/superpowers/plans/` | Não confirmado | **P3** | Verificar estado real de implementação antes de priorizar |
| `PROD-05` | FCM mobile (iOS/Android) | Integração Firebase Cloud Messaging para push nativo em iOS e Android não auditada | `10-notificacoes-inbox.md` | Alto para mobile — push web não funciona em iOS sem PWA instalado | **P1** | Validar junto com PROD-01 |

---

### Mobile

| ID | Título | Descrição | Origem | Impacto | Prioridade | Observação |
|----|--------|-----------|--------|---------|-----------|-----------|
| `MOBILE-01` | Auditoria de distribuição EAS / App Store / Google Play | Não foi auditado se o app está configurado para build e distribuição via EAS; se há profiles de App Store e Google Play | RC Final checklist | Alto para acesso mobile nativo | **P1** | Verificar `eas.json`, `app.json`, perfis de provisioning, submissão a lojas |
| `MOBILE-02` | Testes end-to-end em dispositivos reais | Runtime em iOS e Android não foi testado nos ciclos de RC auditados (só TypeScript e build) | RC Final checklist | Médio | **P2** | Testar fluxo completo (login → tab → canal → retiro → PdV) em dispositivo |

---

### Analytics Missionais

| ID | Título | Descrição | Origem | Impacto | Prioridade | Observação |
|----|--------|-----------|--------|---------|-----------|-----------|
| `ANALYTICS-01` | Data Foundation — Event Sourcing missional | Das 22 transições missionais identificadas, apenas 3 são capturadas hoje (retiro, criação e revisão de PdV). As demais (progressão vocacional, entrada/saída da Obra, acompanhamento, missão) precisam de novas tabelas de evento | `docs/superpowers/plans/2026-06-10-lumen-analytics-missionais-data-foundation.md` | Estratégico — sem eventos históricos, KPIs missionais são impossíveis | **P3** | **Pré-requisito: LGPD-07 aprovado.** Não implementar sem governance e bases legais definidas |
| `ANALYTICS-02` | Dashboard de KPIs missionais | Dashboards de progressão vocacional, perseverança, formação, evangelização — nenhum derivável hoje sem eventos históricos | `docs/superpowers/plans/2026-06-10-lumen-analytics-missionais-data-foundation.md` | Estratégico | **P3** | Depende de ANALYTICS-01 implementado |

---

### Operação / Deploy

| ID | Título | Descrição | Origem | Impacto | Prioridade | Observação |
|----|--------|-----------|--------|---------|-----------|-----------|
| `OPS-01` | Staging formal | Não existe ambiente de staging com banco isolado — previews Vercel não têm backend dedicado | `12-deploy-ambientes.md` | Alto — deploys vão direto para produção sem validação em ambiente equivalente | **P0** | Criar ambiente staging no Railway com banco separado; configurar preview do Vercel apontando para staging |
| `OPS-02` | CI com lint / typecheck / build / testes | Nenhum pipeline de CI está configurado — todos os checks são manuais | `12-deploy-ambientes.md` | Alto — sem CI, qualquer push pode introduzir regressão sem barreira automática | **P0** | GitHub Actions ou Railway CI; mínimo: `tsc --noEmit`, `npm run lint` (após MAINT-FE-01), `expo export` |
| `OPS-03` | Runbook de deploy | Não existe documentação do passo a passo de deploy (migrations → backend → frontend) com rollback | `12-deploy-ambientes.md` | Médio — risco operacional em deploys urgentes | **P2** | Documentar: sequência, rollback, verificações pós-deploy |
| `OPS-04` | Documentar variáveis de ambiente Expo | Lista de variáveis `EXPO_PUBLIC_*` usadas pelo frontend não está formalmente documentada | `12-deploy-ambientes.md` | Médio — novo desenvolvedor não consegue configurar ambiente sem investigação | **P2** | Criar `.env.example` ou documentar em `12-deploy-ambientes.md` |
| `OPS-05` | Testes automatizados de backend | `pytest` existe mas cobertura de testes não foi auditada no RC | `03-backend.md` | Médio | **P2** | Auditar cobertura atual; priorizar testes de rotas críticas (auth, acesso sensível, exclusão) |

---

## 4. O que NÃO É Pendência

Os itens abaixo foram corrigidos ou validados em produção durante os ciclos de RC. Não são pendências:

| Item | Status |
|------|--------|
| H5A-01 — CPF/RG via `GET /admin/users/{id}/profile` sem aprovação | Corrigido em H5B |
| H5A-02 — Edit/delete reply sem validar `org_unit_id` | Corrigido em H5B |
| H5A-03 — `GET /org/units/{id}` sem verificação de visibilidade | Corrigido em H5B |
| H5A-04 — Auto-aprovação de export | Corrigido em H5B |
| H5A-05 — `/dev/*` sem block em produção | Corrigido em H5B (`_block_in_production`) |
| H5A-06 — `vocational_accompanist` ecoava `full_name` de terceiro | Corrigido em H5B |
| H5A-07 — Push subscription takeover (409) | Corrigido em H5B |
| `Alert.alert` na web — blocker de confirmações | Corrigido (RC anterior) |
| Firebase fail-fast (`MISCONFIGURED`) | Corrigido e validado |
| `authStore.user` frágil em Admin e Canal — roles lidas do store | Corrigido (RC-FE-AUTH-01) |
| `api.ts` — parse de JSON em respostas 204 / sem corpo | Corrigido |
| Admin 2.0 Fase 1 — aceitação, `people_active`, `sector_name`, bases de percentual | Em produção |
| Admin 2.0 Fase 1.1 — DELETE idempotente + refresh de lista | Em produção |
| Backend hardening H1→H6A (headers, rate limit, upload, IDOR, AuditLog) | Em produção |
| IS_DEV_AUTH=false em produção | Confirmado em H0 |
| ENABLE_DEV_ENDPOINTS=false em produção | Confirmado em H0 |
| TypeScript (`npx tsc --noEmit`) | Passa sem erros |

---

## 5. Priorização Sugerida por Ciclo

### Ciclo 1 — Fundamentos técnicos (P0)

Itens de baixo esforço e alto impacto operacional:

| ID | Esforço estimado |
|----|----------------|
| `MAINT-FE-01` — ESLint | Baixo (1 arquivo de config) |
| `MAINT-FE-02` — console.log home.tsx | Trivial (1 linha) |
| `MAINT-FE-03` — Admin role guard layout | Baixo (1 guard no layout) |
| `OPS-01` — Staging formal | Médio (provisionar Railway staging) |
| `OPS-02` — CI básico | Médio (configurar GitHub Actions) |

### Ciclo 2 — Segurança e operação (P1)

| ID | Esforço estimado |
|----|----------------|
| `SEC-01` — CSP enforced | Baixo (mudar header no vercel.json após validação) |
| `SEC-04` — Pentest externo | Externo (contratar) |
| `SEC-05` — Rotação de chaves | Médio (processo + script de migração) |
| `LGPD-01` — Política de retenção + job | Médio |
| `LGPD-02` — DPO | Organizacional |
| `LGPD-06` — Política de Privacidade | Jurídico |
| `LGPD-07` — Avaliação LGPD Analytics | Jurídico + técnico |
| `PROD-01` — Push end-to-end | Alto (validação + debugging em produção) |
| `PROD-05` — FCM mobile | Alto |
| `MOBILE-01` — Auditoria EAS / lojas | Médio |

### Ciclo 3 — Produto e experiência (P2)

| ID | Esforço estimado |
|----|----------------|
| `PROD-02` — Push para eventos do app | Alto |
| `PROD-03` — Email transacional | Médio |
| `LGPD-04` — Portabilidade de dados | Médio |
| `LGPD-05` — PIN recovery PdV (decisão de produto) | Médio (após decisão) |
| `DS-01` + `DS-03` — Hardcoded colors (escopo pequeno) | Baixo |
| `SEC-06` — ACTION_META completo | Baixo |
| `MAINT-FE-04` — Auditar Service Worker | Baixo |

### Ciclo 4 — Design e volume (P3)

| ID | Esforço estimado |
|----|----------------|
| `DS-02` — Migração completa de 585 hardcoded colors | Alto (volume) |
| `MAINT-FE-05` — Code splitting | Alto (arquitetural) |
| `PROD-04` — CP8 Evangelização (verificar estado) | A confirmar |

### Ciclo 5 — Analytics Missionais (após LGPD aprovada)

| ID | Esforço estimado |
|----|----------------|
| `ANALYTICS-01` — Data Foundation (event sourcing) | Alto (novas tabelas, migrations, eventos) |
| `ANALYTICS-02` — Dashboards de KPIs | Alto |

> **Pré-requisito inegociável:** `LGPD-07` deve ser aprovado antes de qualquer trabalho em `ANALYTICS-01`. Os dados de jornada missional têm sensibilidade moderada; a captura sem governance adequada gera risco jurídico e viola o princípio de minimização.

---

## 6. Riscos de Adiar

| Grupo | Risco de adiar |
|-------|---------------|
| Fundamentos técnicos (ESLint, CI) | Sem ESLint e CI, bugs de regressão passam direto para produção sem barreira automática. A cada ciclo sem essa base, o custo de corrigir aumenta. |
| Segurança (CSP enforced, pentest, rotação de chaves) | CSP em Report-Only não protege; sem pentest, vulnerabilidades desconhecidas ficam abertas. Rotação de chaves sem pipeline é risco de incidente sem plano de resposta. |
| LGPD (DPO, ROPA, retenção) | Operar sem DPO designado e sem ROPA é não-conformidade documental com a LGPD. Crescimento da base amplifica a exposição legal. |
| Push end-to-end | Backend tem as rotas, frontend pode ter o fluxo — sem validação, o usuário pode ter subscriptions registradas mas nunca receber push, degradando silenciosamente o engajamento. |
| Staging | Sem staging, todo deploy é um experimento em produção. Um deploy de migrations quebrado sem rollback testado pode causar downtime. |
| Analytics Missionais sem LGPD | Implementar event sourcing de jornada vocacional sem bases legais e k-anonimato é risco jurídico e de confiança da comunidade. |

---

## 7. Recomendação Final

O Lumen+ está em produção operacional com RC Aprovado. As pendências deste roadmap não impedem o uso atual nem comprometem a integridade do sistema.

A sequência recomendada para o próximo ciclo é:

1. **Fechar os fundamentos** (ESLint, CI, staging) — são o custo de manutenção crescente que afeta todo o restante.
2. **Completar a validação de push** — é a feature com backend pronto e mais próxima de entregar valor ao usuário.
3. **Tratar LGPD antes de crescer** — DPO, ROPA e política de retenção devem preceder crescimento significativo da base de usuários.
4. **Analytics Missionais apenas após governança LGPD aprovada** — é o projeto de maior impacto estratégico, mas também o de maior sensibilidade; a pressa aqui gera passivo, não valor.

---

## Fontes deste Documento

| Fonte | Itens derivados |
|-------|----------------|
| `docs/superpowers/audits/2026-06-11-frontend-rc-final-checklist.md` | MAINT-FE-01/02/03/04/05, DS-01/02/03, OPS checklist |
| `docs/final/11-seguranca-hardening.md` | SEC-01/02/03/04/05, status H5A |
| `docs/final/12-deploy-ambientes.md` | OPS-01/02/03/04 |
| `docs/final/13-lgpd-dados-sensiveis.md` | LGPD-01/02/03/04/05/06/07 |
| `docs/final/06-admin.md` | SEC-06, Admin 2.0 status |
| `docs/final/10-notificacoes-inbox.md` | PROD-01/02/05 |
| `docs/final/07-projeto-de-vida.md` | LGPD-05 |
| `docs/superpowers/plans/2026-06-10-lumen-analytics-missionais-data-foundation.md` | ANALYTICS-01/02, LGPD-07 |
| `docs/superpowers/plans/2026-06-04-notificacoes-push-email.md` | PROD-02/03 |
