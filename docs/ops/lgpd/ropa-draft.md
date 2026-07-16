# LGPD-03 — ROPA: Registro das Atividades de Tratamento

> ⚠️ **STATUS: DRAFT** — Aguardando revisão/aprovação do Encarregado (LGPD-02)\
> Este documento não representa o ROPA formal da organização. Precisa ser revisado e assinado pelo Encarregado (Felipe Rocha Pinheiro Bastos).

**Data do rascunho:** 2026-06-14  
**Controlador:** Obra Lumen de Evangelização — CNPJ 19.614.384/0001-60  
**Encarregado:** Felipe Rocha Pinheiro Bastos — lgpd@lumenserfeliz.org (aguardando revisão/aprovação — LGPD-02)\
**Base legal:** LGPD Art. 37

---

## Atividade 1 — Cadastro e Autenticação de Usuários

| Campo | Valor |
|-------|-------|
| Nome da atividade | Cadastro e autenticação de membros |
| Categorias de titulares | Membros da Obra Lumen de Evangelização |
| Categorias de dados | Nome, e-mail, senha (via Firebase), telefone, data de nascimento, cidade/UF, foto de perfil |
| Finalidade | Identificar o usuário e controlar acesso à plataforma |
| Base legal | Art. 7º, V — execução de contrato ou procedimentos preliminares (o usuário solicita cadastro para usar o app) |
| Prazo de retenção | Enquanto conta ativa + 30 dias após exclusão solicitada _(draft — ver LGPD-01)_ |
| Destinatários / Suboperadores | Firebase Authentication (Google LLC, EUA) |
| País de destino | Estados Unidos (Firebase) — adequação ou garantias: SCCs Google |
| Medidas de segurança | HTTPS, Firebase Auth, SECRET_KEY para JWT, bcrypt (se aplicável) |

---

## Atividade 2 — Projeto de Vida Mensal (dados espirituais)

| Campo | Valor |
|-------|-------|
| Nome da atividade | Ferramenta de Projeto de Vida Mensal |
| Categorias de titulares | Membros ativos com ciclo criado |
| Categorias de dados | Dados sobre convicções religiosas, práticas espirituais, confessor, diretor espiritual, reflexões pessoais, diagnóstico de virtudes e defeitos |
| Finalidade | Oferecer ferramenta de desenvolvimento espiritual pessoal |
| Base legal | Art. 11, I — **consentimento específico e destacado** (dados sensíveis — convicções religiosas) |
| Prazo de retenção | Enquanto ativo + 12 meses após inatividade _(draft — ver LGPD-01)_ |
| Destinatários | Nenhum (dados não compartilhados com terceiros) |
| País de destino | Brasil (Railway, Postgres) |
| Medidas de segurança | Acesso autenticado, HTTPS, sem compartilhamento com terceiros |

**⚠️ DADOS SENSÍVEIS (Art. 11 LGPD):** Dados sobre práticas religiosas, confissão, diretor espiritual. Tratamento sujeito a proteção reforçada. Consentimento deve ser específico, distinto dos Termos de Uso gerais.

---

## Atividade 3 — Plano de Evangelização

| Campo | Valor |
|-------|-------|
| Nome da atividade | Ferramenta de Evangelização Missionária |
| Categorias de titulares | Membros com plano de evangelização ativo |
| Categorias de dados | Nomes/perfis de pessoas evangelizadas, ações missionárias, reflexões |
| Finalidade | Ferramenta pessoal para organização da missão evangelizadora |
| Base legal | Art. 11, I — consentimento específico (dados potencialmente referentes a terceiros) |
| Prazo de retenção | Enquanto ativo + 12 meses após inatividade _(draft — ver LGPD-01)_ |
| Destinatários | Nenhum |
| País de destino | Brasil |
| Medidas de segurança | Acesso autenticado; dados de terceiros: aviso ao usuário de não inserir dados sensíveis de terceiros sem consentimento |

**⚠️ DADO DE TERCEIRO:** Se o usuário insere nome ou informações de pessoas evangelizadas, esses são dados pessoais de terceiros. A base legal para este tratamento deve ser revisada pelo DPO.

---

## Atividade 4 — Sistema de Avisos e Inbox

| Campo | Valor |
|-------|-------|
| Nome da atividade | Comunicação interna via Inbox |
| Categorias de titulares | Todos os membros |
| Categorias de dados | Conteúdo das mensagens, leitura/entrega, metadados de envio |
| Finalidade | Comunicação institucional da Obra Lumen |
| Base legal | Art. 7º, IX — legítimo interesse (comunicação com membros da associação) |
| Prazo de retenção | 90 dias para logs de entrega; mensagens enquanto conta ativa _(draft)_ |
| Destinatários | SendGrid (Twilio Inc., EUA) para e-mail; Railway (infraestrutura) |
| País de destino | EUA (SendGrid) |
| Medidas de segurança | HTTPS, autenticação, rate limiting |

---

## Atividade 5 — Push Notifications Web

| Campo | Valor |
|-------|-------|
| Nome da atividade | Notificações push via browser (Web Push) |
| Categorias de titulares | Membros que concederam permissão de notificação |
| Categorias de dados | Push subscription (endpoint, chaves p256dh e auth), user_agent |
| Finalidade | Entrega de notificações de inbox e lembretes de revisão espiritual |
| Base legal | Art. 7º, I — consentimento (permissão de notificação solicitada explicitamente) |
| Prazo de retenção | Enquanto conta ativa; subscriptions expiradas (410) removidas automaticamente |
| Destinatários | Browser do usuário (via Web Push Protocol) |
| País de destino | Depende do browser service do usuário (Chrome/FCM: EUA) |
| Medidas de segurança | VAPID (autenticação do servidor de push), HTTPS, opt-in explícito |

---

## Atividade 6 — Monitoramento de Erros (Sentry)

| Campo | Valor |
|-------|-------|
| Nome da atividade | Diagnóstico técnico de erros |
| Categorias de titulares | Usuários que experimentam erros técnicos |
| Categorias de dados | Stack traces, logs de erro, versão do app, OS — **sem dados pessoais identificáveis** (Sentry configurado com PII desativado) |
| Finalidade | Manutenção técnica, correção de bugs |
| Base legal | Art. 7º, IX — legítimo interesse (manutenção do serviço) |
| Prazo de retenção | Gerenciado pela Sentry (90 dias no plano gratuito) |
| Destinatários | Sentry (Functional Software Inc., EUA) |
| País de destino | EUA |
| Medidas de segurança | PII scrubbing ativado, sem envio de dados pessoais explícitos |

---

## Atividade 7 — Armazenamento de Fotos de Perfil

| Campo | Valor |
|-------|-------|
| Nome da atividade | Upload e armazenamento de foto de perfil |
| Categorias de titulares | Membros que fazem upload de foto |
| Categorias de dados | Imagem de rosto (dado biométrico potencial) |
| Finalidade | Identificação visual do membro na plataforma |
| Base legal | Art. 7º, I — consentimento (ação voluntária do usuário) |
| Prazo de retenção | Enquanto conta ativa + 30 dias _(draft)_ |
| Destinatários | Cloudinary (Cloudinary Ltd., Israel / servidores EUA) |
| País de destino | EUA/Israel |
| Medidas de segurança | HTTPS, autenticação por API key, URL pública mas sem listagem |

**⚠️ POTENCIAL DADO BIOMÉTRICO:** Foto de rosto pode ser classificada como dado biométrico (Art. 5º, II LGPD) dependendo de análise futura. DPO deve confirmar classificação.

---

## Suboperadores Identificados

| Suboperador | Serviço | País | DPA / Adequação |
|------------|---------|------|-----------------|
| Google LLC (Firebase) | Autenticação | EUA | SCCs + Google Cloud DPA |
| Braintrust Group Inc. (Railway) | Hospedagem backend + banco | EUA | Railway DPA (verificar) |
| Vercel Inc. | Hospedagem frontend | EUA | Vercel DPA |
| Functional Software Inc. (Sentry) | Monitoramento de erros | EUA | Sentry DPA |
| Cloudinary Ltd. | Armazenamento de imagens | Israel / EUA | Cloudinary DPA |
| Twilio Inc. (SendGrid) | E-mail transacional | EUA | Twilio DPA |

---

## Pendências para o DPO

- [ ] Revisar bases legais de cada atividade
- [ ] Confirmar se foto de rosto é dado biométrico (Atividade 7)
- [ ] Revisar tratamento de dados de terceiros em Evangelização (Atividade 3)
- [ ] Assinar o ROPA formal (com nome e data)
- [ ] Registrar na ANPD quando sistema estiver disponível
- [ ] Confirmar DPAs com cada suboperador (especialmente Railway)

---

## Histórico do Documento

| Versão | Data | Autor | Status |
|--------|------|-------|--------|
| 0.1 draft | 2026-06-14 | Equipe técnica | DRAFT — aguardando DPO |
| 0.2 draft | 2026-07-16 | Equipe técnica | DRAFT — DPO definido; aguardando revisão/aprovação do Encarregado |
