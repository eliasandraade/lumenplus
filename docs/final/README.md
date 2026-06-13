# Documentação Final — Lumen+

**Versão:** 1.0  
**Data do snapshot:** 2026-06-12

---

## Status do Produto

| Componente | Status |
|-----------|--------|
| Backend (FastAPI + PostgreSQL) | Em produção operacional — versão 0.3.0 |
| Frontend Web (Vercel SPA) | RC Aprovado com Observações |
| Hardening H1→H6A | Em produção |
| H5A — Auditoria IDOR (7/7 achados) | Corrigido em produção (H5B) |
| Admin 2.0 Fase 1 / Fase 1.1 | Em produção |
| Autenticação Firebase | Em produção |
| Documentação final | Versão 1.0 — concluída |

Não há blockers conhecidos. As pendências do RC estão documentadas e priorizadas em [`14-roadmap-pos-rc.md`](14-roadmap-pos-rc.md) — 35 itens, nenhum blocker de uso atual.

---

## O que é esta documentação

A pasta `docs/final/` contém a **documentação consolidada e aprovada** do Lumen+ após o RC. Ela descreve o produto tal como está em produção: arquitetura, funcionalidades, segurança, LGPD, deploy, guias operacionais e roadmap POST-RC.

**Esta documentação é diferente de `docs/superpowers/`**, que guarda planos de ciclo, specs de implementação e auditorias temporárias. Os documentos de `docs/superpowers/` são artefatos de processo — não devem ser usados como referência operacional ou apresentados a partes externas como documentação oficial.

---

## Como Usar Esta Documentação

Escolha o caminho de leitura pelo seu perfil:

### Desenvolvedor novo na plataforma
```
01 → 02 → 05 → 03 → 04
Visão Geral → Arquitetura → Auth/Permissões → Backend → Frontend
```
Continue com `11` (segurança) e `12` (deploy) antes do primeiro commit.

### Administrador / operador da plataforma
```
01 → 06 → 15
Visão Geral → Painel Admin → Guia do Administrador
```
Leia também `13` (LGPD) antes de lidar com dados sensíveis.

### Membro / usuário final
```
01 → 16
Visão Geral → Guia do Membro
```

### Operador de deploy / DevOps
```
02 → 12 → 11
Arquitetura → Deploy e Ambientes → Segurança e Hardening
```
Leia `05` (auth) para entender as variáveis de ambiente críticas.

### Conselho / gestão
```
01 → 06 → 14
Visão Geral → Painel Admin → Roadmap POST-RC
```
Leia `13` (LGPD) para a visão de dados pessoais e conformidade.

### Segurança / LGPD / DPO
```
11 → 13 → 14
Hardening → LGPD → Roadmap POST-RC
```
Leia também `05` (autenticação e papéis) para o modelo de autorização completo.

---

## Índice Completo

| # | Arquivo | Descrição | Público |
|---|---------|-----------|---------|
| 1 | [`01-visao-geral.md`](01-visao-geral.md) | O que é o Lumen+, missão, módulos, estado atual, modelo conceitual | Todos |
| 2 | [`02-arquitetura.md`](02-arquitetura.md) | Stack, infraestrutura, fluxo de dados, decisões arquiteturais, trade-offs conhecidos | Desenvolvedor, arquiteto |
| 3 | [`03-backend.md`](03-backend.md) | FastAPI, estrutura de rotas, banco, Alembic, autenticação, segurança, testes | Desenvolvedor |
| 4 | [`04-frontend.md`](04-frontend.md) | React Native Web, Expo Router, design system, API client, estado global, build | Desenvolvedor |
| 5 | [`05-autenticacao-permissoes.md`](05-autenticacao-permissoes.md) | Firebase Auth, fluxo de login, papéis globais, papéis por unidade, onboarding, IDOR | Desenvolvedor, operador |
| 6 | [`06-admin.md`](06-admin.md) | Painel Admin: Dashboard, usuários, entidades, aprovações, retiros, avisos, logs | Desenvolvedor, ADMIN |
| 7 | [`07-projeto-de-vida.md`](07-projeto-de-vida.md) | Módulo PdV: ciclo mensal, wizard, PIN, isolamento de privacidade, histórico | Desenvolvedor, pastoral |
| 8 | [`08-comunidade-canal-membros.md`](08-comunidade-canal-membros.md) | Estrutura de unidades, canal de grupos, membros, convites, moderação | Desenvolvedor, coordenador |
| 9 | [`09-retiros-eventos.md`](09-retiros-eventos.md) | Ciclo completo de retiros: criação, publicação, inscrições, pagamento, gestão admin | Desenvolvedor, coordenador |
| 10 | [`10-notificacoes-inbox.md`](10-notificacoes-inbox.md) | Inbox (avisos), push notifications (VAPID/FCM), escopos, aprovação de CRITICAL | Desenvolvedor, operador |
| 11 | [`11-seguranca-hardening.md`](11-seguranca-hardening.md) | Ciclo H0→H6A, H5A IDOR (7/7 corrigidos), headers, rate limit, CSP, payload limits | Desenvolvedor, segurança |
| 12 | [`12-deploy-ambientes.md`](12-deploy-ambientes.md) | Railway (backend), Vercel (frontend), variáveis de ambiente, migrations, checks | Desenvolvedor, operador |
| 13 | [`13-lgpd-dados-sensiveis.md`](13-lgpd-dados-sensiveis.md) | Dados coletados, criptografia CPF/RG, anonimização, retenção, bases legais, limites | DPO, desenvolvedor, ADMIN |
| 14 | [`14-roadmap-pos-rc.md`](14-roadmap-pos-rc.md) | 35 itens POST-RC priorizados em P0→P3, sem blockers atuais | Desenvolvedor, gestão |
| 15 | [`15-guia-admin.md`](15-guia-admin.md) | Guia operacional prático para ADMIN/DEV/ANALISTA: passo a passo de cada função | ADMIN, DEV, ANALISTA |
| 16 | [`16-guia-usuario.md`](16-guia-usuario.md) | Guia do membro: primeiro acesso, PdV, canal, retiros, inbox, segurança pessoal | Membro, coordenador |

---

## Estado do RC

O Lumen+ está em produção operacional com RC Aprovado com Observações. O que isso significa:

- **Sem blockers conhecidos** — o produto está funcional e em uso.
- **Observações** = dívida técnica documentada (lint inoperante, bundle não otimizado, cores hardcoded em alguns arquivos, push end-to-end não validado end-to-end). Nenhuma afeta funcionalidades principais.
- **H5A resolvido** — todos os 7 achados da auditoria IDOR foram corrigidos em H5B e estão em produção.
- **POST-RC documentado** — [`14-roadmap-pos-rc.md`](14-roadmap-pos-rc.md) lista os 35 itens aceitos como pós-RC, com priorização sugerida por ciclo.

---

## Avisos Importantes

> **Esta documentação não substitui parecer jurídico.** Os documentos de LGPD descrevem controles técnicos implementados e limitações conhecidas. Para avaliação formal de conformidade, consulte profissional jurídico habilitado.

> **Dados sensíveis** (CPF, RG, conteúdo do Projeto de Vida) devem ser tratados conforme as políticas internas da organização e o fluxo de aprovação descrito em [`13-lgpd-dados-sensiveis.md`](13-lgpd-dados-sensiveis.md).

> **`docs/superpowers/`** não é documentação operacional final. Planos, specs e auditorias de ciclo nessa pasta são artefatos de processo interno e podem estar parcialmente desatualizados. Use `docs/final/` como referência.

> **Ambiente de produção** (Railway e Vercel) deve ser alterado somente com autorização explícita e após validar checks de segurança descritos em [`12-deploy-ambientes.md`](12-deploy-ambientes.md).

---

## Próximos Passos

- **Atualizar esta documentação** após features ou correções relevantes — cada arquivo tem uma seção "Pendências POST-RC" que indica o que mudará.
- **Manter [`14-roadmap-pos-rc.md`](14-roadmap-pos-rc.md) como snapshot do pós-RC**, não como backlog vivo. À medida que itens forem resolvidos, registre o status nos documentos correspondentes e crie nova versão do roadmap.
- **Revisar periodicamente** os documentos de LGPD ([`13`](13-lgpd-dados-sensiveis.md)) e segurança ([`11`](11-seguranca-hardening.md)) à medida que a base de usuários crescer ou novas features forem adicionadas.
- **Designar DPO e construir ROPA** (itens LGPD-02 e LGPD-03 do roadmap) antes do crescimento significativo da base de membros.
