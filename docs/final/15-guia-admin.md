# Lumen+ — Guia do Administrador

**Versão da documentação:** 1.0  
**Data:** 2026-06-12  
**Audiência:** ADMIN, DEV, ANALISTA, SECRETARY, coordenadores com acesso específico

---

## 1. Introdução

O painel Admin é a área restrita do Lumen+ para quem gerencia a plataforma no dia a dia. Por ele é possível visualizar métricas da comunidade, gerenciar usuários e unidades, criar e enviar avisos, administrar retiros, aprovar exportações de dados e consultar o histórico de ações na plataforma.

O Admin não é um painel de relatórios avançado nem um sistema financeiro — é a ferramenta operacional da Obra para manter a plataforma funcionando e os dados dos membros organizados.

**Quem usa o Admin:**

| Perfil | O que pode fazer |
|--------|-----------------|
| DEV | Tudo — incluindo operações técnicas e de segurança |
| ADMIN | Tudo o que está neste guia |
| ANALISTA | Somente o Dashboard de métricas |
| SECRETARY | Pode solicitar acesso a documentos sensíveis via backend; não vê o menu Admin completo |
| Coordenador designado | Pode gerenciar membros da sua unidade e, se designado, inscrições de retiro |

---

## 2. Acesso ao Admin

Acesse o painel Admin pelo menu principal do app ou diretamente pela URL `/admin`.

A tela de menu do Admin identifica seu papel consultando o servidor — não é uma decisão local. Se o sistema retornar que seu papel mudou, o menu refletirá isso automaticamente.

**O que cada papel vê no menu:**

| Seção | ANALISTA | ADMIN / DEV |
|-------|----------|-------------|
| Análise (Dashboard) | Sim | Sim |
| Comunicações (Avisos) | Não | Sim |
| Eventos (Retiros) | Não | Sim |
| Estrutura (Entidades) | Não | Sim |
| Pessoas (Usuários) | Não | Sim |
| Segurança (Logs, Aprovações) | Não | Sim |

> **Importante:** o menu Admin oculta seções conforme o papel, mas quem decide se uma ação é permitida é o servidor. Um usuário sem o papel correto que tente acessar uma URL diretamente receberá erro ao tentar carregar os dados.

---

## 3. Dashboard

O Dashboard exibe o panorama atual da comunidade com dados reais do banco. Nenhum número é estimativa ou dado fictício.

### O que você encontra

| Bloco | Conteúdo |
|-------|---------|
| Usuários | Total ativo, perfis completos, novos nos últimos 7 e 30 dias |
| Faixas etárias | Distribuição por faixa (<18, 18-25, 26-35, 36-45, 46-60, >60, Não informado) |
| Geografia | Top 10 cidades e estados |
| Perfil Vocacional | Estado de vida, realidade vocacional, estado civil |
| Engajamento | Acompanhamento vocacional, interesse em ministério, origem de missão |
| Vínculos | Total de vínculos ativos e pessoas participando (distintas) |
| Convites | Total, aceitos, pendentes, recusados; taxa de aceitação calculada sobre resolvidos |
| Top Ministérios | Ministérios com mais pessoas participando (top 10) |

### Como interpretar os números

- **Vínculos ≠ Pessoas:** um membro em três unidades conta como três vínculos mas uma pessoa. O Dashboard exibe ambos separadamente.
- **Taxa de aceitação de convites:** calculada sobre os convites já resolvidos (aceitos + recusados), não sobre o total. Convites expirados e cancelados são exibidos à parte.
- **Percentuais de perfil vocacional:** calculados sobre os membros que informaram o campo, não sobre o total. A base é sempre explícita no Dashboard.

### O que o Dashboard não é

O Dashboard atual é operacional e demográfico. Ele não mede engajamento real (quantos membros abriram o Projeto de Vida este mês, quantos leram avisos, quantos estão ativos no canal). Essas métricas missionais são um projeto futuro e dependem de avaliação jurídica antes de serem implementadas.

---

## 4. Gestão de Usuários

Acesse em: **Pessoas → Gestão de Usuários**.

### Buscar e filtrar usuários

A tela exibe a lista paginada de membros. Use os filtros disponíveis para restringir por papel, estado de perfil ou unidade.

### Abrir o perfil de um membro

Clique no nome do membro para ver o perfil completo: dados pessoais, papéis globais, histórico de memberships, status de perfil e auditoria associada.

**CPF e RG nunca aparecem por padrão** para ADMIN ou SECRETARY — eles exigem um fluxo separado de aprovação (ver seção 5).

### Entender o status de perfil

| Status | Significado |
|--------|-------------|
| Perfil completo | O membro completou todas as etapas do onboarding |
| Documentos pendentes | CPF/RG ainda não foram informados |
| Atualização de perfil pendente | O app está solicitando ao membro que revise seus dados |

### Editar papéis

ADMIN e DEV podem adicionar ou remover papéis globais de um membro (ex.: promover alguém para ANALISTA, revogar um papel). Faça isso com cuidado — papéis globais determinam o que o membro pode fazer em toda a plataforma.

---

## 5. Dados Sensíveis — CPF/RG

CPF e RG são criptografados no banco e não devem ser acessados sem necessidade legítima. O fluxo abaixo garante que todo acesso seja rastreável e auditado.

### Quando acessar CPF/RG

Apenas quando há necessidade operacional real e documentável — por exemplo, confirmar identidade para um processo formal. Nunca acesse por curiosidade ou para compartilhar fora da plataforma.

### Fluxo de solicitação

```
1. Solicitante (SECRETARY ou DEV) abre uma solicitação de acesso
   com justificativa obrigatória.

2. Um aprovador diferente do solicitante (ADMIN ou DEV)
   aprova a solicitação. Auto-aprovação é bloqueada pelo sistema.

3. O solicitante tem uma janela de tempo limitada para
   acessar os documentos via perfil do membro.

4. Cada acesso é registrado automaticamente nos Logs de Auditoria
   com data, hora, IP, quem acessou e qual membro foi consultado.
```

> **DEV** tem acesso direto a CPF/RG sem passar pelo fluxo de aprovação. Esse é o papel de operador técnico de mais alto nível — e todo acesso dele também é auditado.

### Boas práticas

- Nunca copie ou exporte CPF/RG fora do sistema sem justificativa formal registrada.
- Se precisar compartilhar com a equipe de secretaria, use o fluxo de exportação com aprovação — não copie o dado manualmente da tela.
- Documente sempre a justificativa de acesso no campo correspondente.

---

## 6. Exclusão / Anonimização de Conta

**Acesse em:** Pessoas → Gestão de Usuários → Perfil do membro → ação de exclusão.

### Quando usar

Exclusão é uma ação irreversível. Use apenas quando o membro solicitou formalmente a remoção ou quando há motivo administrativo claro e documentado (ex.: conta duplicada, membro que saiu formalmente da Obra).

### Quem pode excluir

| Ator | Pode excluir |
|------|-------------|
| DEV | Qualquer conta, exceto a si mesmo e outras contas DEV |
| ADMIN | Contas de membros sem papel DEV ou ADMIN |

### Passo a passo

1. Abra o perfil do membro na Gestão de Usuários.
2. Clique na ação de exclusão.
3. O sistema pedirá que você **confirme digitando o nome do membro** — isso evita exclusões acidentais.
4. Informe um motivo (campo obrigatório ou recomendado).
5. Confirme a ação.

### O que acontece após a exclusão

O sistema **não apaga a linha do usuário** — ele anonimiza os dados. Isso é necessário para preservar o histórico de auditoria e os registros de consentimento.

**Removido imediatamente:**
- Perfil (incluindo CPF e RG criptografados)
- Preferências
- Todos os vínculos de unidade
- Todos os papéis globais
- E-mail substituído por endereço anônimo gerado automaticamente

**Retido por obrigação legal:**
- Registro do usuário (inativo, sem dados pessoais)
- Registros de consentimento aos termos
- Histórico de auditoria (ações realizadas pelo e sobre o membro)

**A exclusão é registrada** nos Logs de Auditoria com quem executou, quando e o motivo informado.

**A exclusão é idempotente:** se tentar excluir uma conta já inativa, o sistema retorna sucesso sem reprocessar — não há risco de duplicar a ação.

### Antes de excluir

- Confirme que é o membro correto (verifique nome, e-mail e unidades vinculadas).
- Verifique se há inscrições ativas em retiros que precisam ser tratadas.
- Se o membro solicitou exclusão via LGPD (art. 18, VI), documente a solicitação no campo de motivo.

---

## 7. Entidades / Unidades Organizacionais

**Acesse em:** Estrutura → Entidades.

### Hierarquia

```
CONSELHO_GERAL
  └── CONSELHO_EXECUTIVO
        └── SETOR
              └── MINISTERIO
                    └── GRUPO
```

Existe também o tipo `MISSAO`, que pode ser criado fora da hierarquia padrão.

A tela exibe a árvore completa de unidades. Coordenadores só veem as unidades que coordenam.

### O que você pode fazer

- **Ver a árvore:** navegue pela hierarquia para entender a estrutura atual.
- **Criar unidade filha:** dentro de uma unidade existente, crie sub-unidades conforme a hierarquia.
- **Editar unidade:** altere nome ou dados da unidade.
- **Gerenciar membros da unidade:** adicione ou remova membros, altere o papel (membro / coordenador).

---

## 8. Membros e Convites

### Convidar um membro para uma unidade

1. Acesse a unidade desejada em Estrutura → Entidades.
2. Abra a gestão de membros da unidade.
3. Clique em "Convidar membro" e informe o e-mail ou busque pelo nome do usuário.
4. O convite é criado com validade configurável.
5. O membro verá o convite pendente no app (na tela de Inbox/Avisos) e poderá aceitar ou recusar.

### Estados do convite

| Estado | Significado |
|--------|-------------|
| Pendente | Aguardando resposta do membro |
| Aceito | Membro ingressou na unidade |
| Recusado | Membro optou por não entrar |
| Expirado | Prazo expirou sem resposta |

### Alterar o papel de um membro

Na gestão de membros da unidade, selecione o membro e altere entre `MEMBRO` e `COORDENADOR`.

- **COORDENADOR:** gerencia membros da unidade, posta no canal, modera conteúdo.
- **MEMBRO:** participa da unidade, lê o canal e (dependendo da configuração) pode postar.

### Remover membro de uma unidade

Remova o vínculo do membro com a unidade diretamente na gestão de membros. Isso não exclui a conta — apenas encerra a participação naquela unidade.

---

## 9. Avisos / Inbox

**Acesse em:** Comunicações → Criar Aviso.

### Criar um aviso

1. Clique em "Criar Aviso".
2. Informe título e conteúdo da mensagem.
3. Escolha o escopo de envio:

| Escopo | Quem recebe |
|--------|-------------|
| GLOBAL | Todos os membros ativos da plataforma |
| ORG_UNIT | Membros de uma unidade específica |
| USER | Um único membro |
| CRITICAL | Todos os membros — requer aprovação antes do envio |

4. Para ORG_UNIT ou USER, selecione a unidade ou o membro alvo.
5. Confirme o envio.

### Avisos CRITICAL

Avisos com escopo CRITICAL vão para uma fila de aprovação antes de serem distribuídos. O fluxo:

1. Você cria o aviso CRITICAL.
2. Ele fica com status "Aguardando aprovação".
3. Um ADMIN ou DEV diferente de você aprova (ou rejeita) em Segurança → Aprovações.
4. Após aprovação, o aviso é distribuído para todos os membros.

**Auto-aprovação é bloqueada pelo sistema** — você não pode aprovar um aviso que você mesmo criou.

### Ver avisos enviados

Acesse: Comunicações → Avisos Enviados. Você vê apenas os avisos criados por você.

---

## 10. Aprovações

**Acesse em:** Segurança → Aprovações.

A tela de Aprovações reúne as solicitações que aguardam sua análise. Dois tipos de item aparecem aqui:

1. **Solicitações de exportação de dados** — pedidos de CSV de membros (com ou sem dados sensíveis) que precisam de aprovação antes de serem gerados.
2. **Avisos CRITICAL pendentes** — avisos criados com escopo CRITICAL que aguardam liberação.

### Como aprovar ou rejeitar

1. Abra o item na fila.
2. Leia os detalhes: quem solicitou, para qual finalidade e quais dados serão incluídos (no caso de exportação).
3. Aprove ou rejeite.
4. Se rejeitar, informe o motivo.

### Separação de deveres

O sistema garante que quem solicita não possa aprovar a própria solicitação. Se você tentou criar uma exportação e ela aparece na sua fila, há um problema de configuração — reporte ao DEV.

---

## 11. Retiros / Eventos

**Acesse em:** Eventos → Retiros.

### Criar um retiro

1. Clique em "Criar Retiro".
2. Preencha: nome, descrição, tipo (Fim de semana / Dia único / Formação), datas, local, capacidade, valor e instruções de pagamento.
3. Faça o upload da imagem de capa, se houver.
4. Salve — o retiro é criado com status **Rascunho** e fica invisível para os membros.

### Publicar o retiro

Quando o retiro estiver pronto para inscrições, publique-o. Ele passa para o status **Publicado** e aparece na listagem dos membros.

```
Rascunho → Publicado → Inscrições Encerradas
              ↓
          Cancelado (em qualquer estado)
```

### Encerrar inscrições

Ao atingir a capacidade ou na data definida, encerre as inscrições. O retiro fica visível mas sem possibilidade de novas inscrições.

### Cancelar um retiro

O cancelamento é irreversível pela interface. Se houver membros inscritos, comunique-os diretamente (via aviso ou contato direto) antes de cancelar.

### Gerenciar inscrições

Dentro do detalhe do retiro, você vê todas as inscrições com seus status:

| Status | Significado |
|--------|-------------|
| PENDING_PAYMENT | Inscrito, aguardando comprovante |
| PAYMENT_SUBMITTED | Comprovante enviado, aguardando confirmação |
| CONFIRMED | Inscrição confirmada |
| WAITLIST | Na lista de espera |
| CANCELLED | Inscrição cancelada |

Você pode:
- Confirmar inscrições (`PAYMENT_SUBMITTED → CONFIRMED`)
- Mover para lista de espera
- Cancelar inscrições individuais
- Exportar a lista de inscritos em CSV (sujeito ao fluxo de aprovação se incluir dados sensíveis)

### Coordenadores de retiro

Você pode designar coordenadores de serviço para um retiro específico dentro da tela de detalhe. Eles terão acesso à gestão daquele retiro sem precisar ter papel ADMIN.

---

## 12. Logs de Auditoria

**Acesse em:** Segurança → Logs de Auditoria.

### Para que servem

Os logs registram automaticamente as ações sensíveis realizadas na plataforma: quem acessou qual perfil, quem fez uma exportação, quem excluiu uma conta, quem alterou um papel, quais termos foram aceitos, entre outras.

São a fonte de verdade para investigar o que aconteceu e quando.

### O que você encontra

| Campo | Conteúdo |
|-------|---------|
| Ação | Tipo da ação realizada (ex.: `member_removed`, `account_deleted`) |
| Ator | Quem realizou a ação |
| Alvo | Sobre qual membro ou entidade a ação ocorreu |
| Data/Hora | Quando aconteceu |
| IP | Endereço de origem do ator |

### Limite atual (POST-RC)

Alguns eventos aparecem como código técnico (ex.: `VIEW_FULL_PROFILE`) em vez de um rótulo legível em português. O mapeamento completo de rótulos de eventos é uma pendência do próximo ciclo. Quando isso acontecer, consulte a equipe técnica para interpretar o código.

---

## 13. Boas Práticas do Administrador

**Princípio do mínimo privilégio:** use apenas o acesso necessário para cada tarefa. Não explore seções do admin por curiosidade.

**Não compartilhe sua conta:** cada ação no sistema é registrada com seu usuário. Compartilhar acesso inviabiliza a rastreabilidade e compromete a auditoria.

**Antes de ações destrutivas (exclusões, cancelamentos, remoções):**
- Confirme que é o membro ou item correto.
- Verifique se há dependências (inscrições ativas, memberships pendentes).
- Informe um motivo claro — o campo de motivo existe para isso.

**Exportação de dados:**
- Só exporte quando necessário para um processo formal.
- Dados com CPF/RG exigem aprovação de outro administrador antes de serem gerados.
- Após receber a exportação, descarte o arquivo com segurança quando não for mais necessário.

**Reporte comportamento estranho:** se perceber ações nos logs que não reconhece, ou acesso suspeito a dados sensíveis, notifique imediatamente o DEV responsável.

---

## 14. O que Fazer em Caso de Erro

| Situação | O que fazer |
|----------|------------|
| Erro 401 (não autorizado) | Sua sessão expirou. Saia e entre novamente. |
| Erro 403 (acesso negado) | Seu papel não permite essa ação. Verifique com o DEV se o papel está correto. |
| Tela carregando sem parar | Verifique a conexão. Recarregue a página. Se persistir, reporte. |
| Dados não aparecem | Recarregue. Se o problema continuar, verifique se o backend está disponível (Railway). |
| Membro não encontrado | Confirme o e-mail ou nome. O membro pode estar inativo (conta excluída). |
| Exportação travada na fila | Aguarde aprovação de outro administrador ou DEV. |
| Não consigo acessar `/admin` | Confirme que você tem papel ADMIN ou DEV atribuído. Acesse com outra conta DEV para verificar. |

Se o problema persistir após esses passos, acione o DEV responsável pela plataforma.

---

## 15. Limites Conhecidos / POST-RC

Os itens abaixo são limitações conhecidas que afetam o uso do admin neste ciclo. Não impedem o funcionamento atual, mas é importante estar ciente deles.

| Limite | Detalhe |
|--------|---------|
| Deep links sem guard de papel | Acessar URLs `/admin/*` diretamente pode exibir tela com erro antes do backend bloquear a chamada. Isso é visual — o backend bloqueia a ação. Correção no próximo ciclo. |
| Analytics Missionais não disponível | O Dashboard atual é operacional/demográfico. Métricas de engajamento missional (adesão ao PdV, leituras, ativos) requerem projeto futuro com avaliação jurídica prévia. |
| Rótulos de auditoria incompletos | Alguns eventos nos Logs de Auditoria aparecem como código técnico. Mapeamento completo é dívida do próximo ciclo. |
| Push não auditado end-to-end | O sistema de push (notificações de dispositivo) tem rotas backend disponíveis, mas o fluxo completo de entrega não foi validado em produção. Avisos via Inbox funcionam normalmente. |
| Sem staging formal | Não existe ambiente de teste separado — mudanças técnicas vão direto para produção. Isso é uma limitação operacional, não funcional. |

---

## Próxima leitura

- **Segurança e hardening:** `11-seguranca-hardening.md`
- **LGPD e dados sensíveis:** `13-lgpd-dados-sensiveis.md`
- **Roadmap POST-RC:** `14-roadmap-pos-rc.md`
- **Notificações e Inbox:** `10-notificacoes-inbox.md`
- **Retiros em detalhe:** `09-retiros-eventos.md`
