# Lumen+ — Visão Geral do Produto

**Versão da documentação:** 1.0  
**Data:** 2026-06-12  
**Estado do produto:** RC Aprovado com Observações — em produção operacional

---

## O que é o Lumen+

O Lumen+ é um aplicativo de formação e vida comunitária para membros de uma organização eclesial. Ele centraliza em uma única plataforma a comunicação interna, a gestão de membros, os eventos e retiros, e o acompanhamento pessoal do caminho de formação de cada membro.

O app existe porque uma comunidade que cresce precisa de ferramentas adequadas à sua missão. E-mail, grupos de WhatsApp e planilhas não sustentam o tipo de acompanhamento pastoral que a Obra oferece.

---

## Missão do Produto

Apoiar a vida de formação e comunhão dos membros da Obra, oferecendo ferramentas digitais que respeitam a privacidade, a confiança e o ritmo próprio de cada pessoa no seu caminho de discipulado.

O Lumen+ não substitui o acompanhamento humano. Ele organiza, facilita e registra — para que o tempo das pessoas e dos líderes seja investido no que importa.

---

## Público-Alvo

| Perfil | Papel no app |
|--------|-------------|
| Membro | Usa o app no dia a dia: Projeto de Vida, canal, retiros, inbox |
| Coordenador | Gerencia membros da sua unidade, posta no canal |
| Administrador | Gerencia toda a plataforma: usuários, entidades, retiros, avisos, logs |
| Analista | Acesso somente ao Dashboard de métricas |
| Desenvolvedor (DEV) | Acesso completo ao admin, incluindo ações técnicas |

O app foi desenhado para operar em contexto real de comunidade: membros com diferentes níveis de familiaridade com tecnologia, usando dispositivos variados, em ambientes com conectividade variável.

---

## Plataformas Suportadas

| Plataforma | Stack | Estado |
|-----------|-------|--------|
| Web | React Native Web via Expo | Produção operacional via Vercel |
| iOS | React Native via Expo/EAS | Suportado pelo codebase; empacotamento via EAS Build |
| Android | React Native via Expo/EAS | Suportado pelo codebase; empacotamento via EAS Build |

O código é único para as três plataformas. Diferenças de comportamento entre web e mobile (câmera, diálogos de confirmação, permissões de push) são tratadas via `Platform.OS` dentro do próprio código.

A publicação e distribuição em App Store (iOS) e Google Play (Android) não foram auditadas nesta documentação. Para o estado atual das distribuições mobile, consultar a equipe responsável pelo processo EAS.

---

## Estado Atual (2026-06-12)

| Componente | Estado |
|-----------|--------|
| Frontend | RC Aprovado com Observações |
| Backend | Hardening H1→H6A em produção, versão 0.3.0 |
| Admin | Admin 2.0 Fase 1 e Fase 1.1 em produção |
| Documentação final | Versão 1.0 — concluída |

O produto está operacional em produção. Não há blockers conhecidos. As observações do RC são dívida técnica documentada — nenhuma impede o uso real do app.

Para detalhes do RC e das pendências, ver `docs/superpowers/audits/2026-06-11-frontend-rc-final-checklist.md`.

---

## Principais Módulos

### Autenticação e Onboarding

Entrada no app via e-mail e senha (Firebase Auth). Primeiro acesso guia o membro pelos termos de uso, coleta de documentos (CPF/RG), perfil inicial e verificação de telefone. O onboarding pode ser retomado automaticamente quando pendente.

### Home

Tela inicial após o login. Apresenta saudação personalizada, acesso rápido às funcionalidades principais e, futuramente, card de permissão para notificações push.

### Inbox / Avisos

Canal de comunicação oficial da Obra para os membros. Os administradores criam avisos segmentados por unidade ou estado de vida; os membros recebem e leem no app.

### Comunidade

Visão geral da vida comunitária do membro: unidades às quais pertence, eventos, convites recebidos.

### Canal de Grupos

Cada unidade organizacional tem um canal de postagens. Coordenadores (e membros, dependendo da configuração) publicam conteúdo que aparece para todos os membros da unidade.

### Membros

Gerenciamento dos membros de uma unidade: listar, convidar, alterar cargo, remover. Coordenadores e administradores têm acesso conforme seu papel.

### Projeto de Vida

A feature de maior profundidade do app. Um ciclo mensal de discipulado com wizard de criação (11 passos), acompanhamento semanal, diário de oração, exame de consciência, revisão e histórico. O conteúdo é privado por padrão e protegido por PIN — não aparece no painel Admin.

### Retiros / Eventos

Listagem de retiros disponíveis, detalhe, inscrição e acompanhamento de pagamento. Administradores criam e publicam retiros; membros se inscrevem e enviam comprovantes.

### Admin

Painel de administração da plataforma. Acesso restrito por papel (DEV, ADMIN, ANALISTA). Inclui: Dashboard, Usuários, Entidades, Aprovações de exportação, Retiros, Avisos enviados, Logs de auditoria.

### Logs / Aprovações

Rastreabilidade de ações sensíveis na plataforma. Exportações de dados requerem aprovação manual de um administrador antes de serem liberadas.

### Perfil

Dados do membro, foto, logout. O membro pode atualizar suas informações; o app solicita atualização periódica de perfil automaticamente quando necessário.

---

## Modelo Conceitual

```
Usuário
  └── Perfil (nome, foto, documentos, estado de vida)
  └── Papéis globais (DEV | ADMIN | ANALISTA | membro regular)
  └── Memberships (pertence a uma ou mais Unidades Organizacionais)
        └── Papel na unidade (coordenador | membro)
        └── Canal da unidade (posts, replies)
  └── Projeto de Vida Mensal (privado, por PIN)
        └── Ciclo mensal
              └── Áreas (5 áreas de compromisso)
              └── Semanal
              └── Diário
              └── Exame
              └── Revisão
  └── Inscricões em Retiros
  └── Inbox (avisos recebidos)
```

**Unidade Organizacional** é a entidade que organiza membros em grupos: pode ser um setor, um conselho, uma casa, uma equipe de formação. Cada unidade tem seus membros, seu coordenador e seu canal de comunicação.

**Papéis globais** determinam o que o usuário pode fazer na plataforma como um todo (admin, analista etc.). **Papéis por unidade** determinam o que pode fazer dentro de uma unidade específica (coordenador ou membro simples). Um usuário pode ser coordenador em uma unidade e membro simples em outra.

**Projeto de Vida** pertence exclusivamente ao membro. Nenhum administrador tem acesso ao conteúdo do Projeto de Vida de um membro — nem via painel admin, nem via API sem autenticação do próprio membro.

---

## O que o Lumen+ NÃO é

**Não é um CRM genérico.** O Lumen+ não foi desenhado para gerenciar clientes, leads ou funis de conversão. A lógica de relacionamento é pastoral, não comercial.

**Não é um sistema financeiro.** O app registra comprovantes de pagamento de retiros, mas não processa pagamentos, não emite notas fiscais e não substitui a gestão financeira da Obra.

**Não é uma ferramenta para expor o foro íntimo.** O Projeto de Vida é protegido por PIN e permanece fora do alcance do admin. O app não coleta ou exibe conteúdo espiritual de um membro para terceiros.

**Não é um dashboard de Analytics Missionais.** A fundação de dados para Analytics Missionais está documentada como roadmap futuro. O Dashboard atual do Admin exibe métricas operacionais básicas, não análises missionais avançadas.

**Não é uma rede social aberta.** O acesso requer convite e aprovação. O conteúdo do canal é visível apenas para membros da unidade correspondente.

---

## Estado de Maturidade

O Lumen+ está em **produção operacional** com RC aprovado.

| Critério | Estado |
|---------|--------|
| TypeScript sem erros | ✅ |
| Build web funcional | ✅ |
| Backend saudável | ✅ |
| Sem blockers conhecidos | ✅ |
| Pendências documentadas | ✅ (ver Roadmap POST-RC) |

O app passou por múltiplos ciclos de revisão antes do RC: hardening de segurança (H1→H6A), correção do sistema de alertas web, correção do auth store, implantação do Admin 2.0 e auditoria final.

As pendências que ficaram para POST-RC são dívida técnica (lint, bundle, cores hardcoded) — não são falhas funcionais que afetem o uso do app.

---

## Próxima leitura

- **Arquitetura técnica:** `02-arquitetura.md`
- **Autenticação e papéis:** `05-autenticacao-permissoes.md`
- **Roadmap e pendências:** `14-roadmap-pos-rc.md`
- **Guia para administradores:** `15-guia-admin.md`
- **Guia para usuários:** `16-guia-usuario.md`
