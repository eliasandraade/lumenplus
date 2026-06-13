# Lumen+ — Retiros e Eventos

**Versão da documentação:** 1.0  
**Data:** 2026-06-12  
**Audiência:** desenvolvedor, coordenador de retiro

---

## Visão Geral

O módulo de Retiros cobre a listagem, detalhe, inscrição e gestão administrativa de retiros e eventos da comunidade. O ciclo completo vai da criação pelo admin até a confirmação de inscrição do membro, passando por aprovação de pagamento.

---

## Modelos de Dados

### Tipos de Retiro

| Valor | Exibição no Frontend |
|-------|---------------------|
| `WEEKEND` | Fim de semana |
| `DAY` | Dia único |
| `FORMATION` | Formação |

Todos os três valores são confirmados no backend (`backend/app/db/models.py:1126-1129`, `RetreatType` enum) e no frontend (`TYPE_LABEL` em `app/retreats/index.tsx` e `app/admin/retreats/[id].tsx`).

### Status do Retiro

| Status | Descrição |
|--------|-----------|
| `DRAFT` | Em preparação — não visível para membros |
| `PUBLISHED` | Inscrições abertas — visível na listagem |
| `CLOSED` | Inscrições encerradas |
| `CANCELLED` | Retiro cancelado |

Apenas retiros com status `PUBLISHED` aparecem na listagem do membro (`GET /retreats` filtra por `status=PUBLISHED`).

### Status de Inscrição

| Status | Descrição |
|--------|-----------|
| `PENDING_PAYMENT` | Inscrito, aguardando pagamento |
| `PAYMENT_SUBMITTED` | Comprovante enviado, aguardando confirmação |
| `CONFIRMED` | Inscrição confirmada |
| `WAITLIST` | Na lista de espera |
| `CANCELLED` | Inscrição cancelada |

---

## Área do Membro

### Listagem de Retiros

`app/retreats/index.tsx` — lista retiros publicados.

A tela exibe cards com: nome, tipo (label), data, local e status das inscrições. Se o membro já tem inscrição, exibe o status dela.

> **Dívida técnica POST-RC:** `app/retreats/index.tsx` usa cores hardcoded:
> ```typescript
> primary: '#1A859B', white: '#ffffff', gray: '#6b7280'
> ```
> Essas cores não foram migradas para os tokens do design system. Impacto: inconsistência visual em dark mode e futuras mudanças de paleta.

### Detalhe do Retiro

`app/retreats/[id].tsx` — informações completas do retiro: descrição, programação, local, valor, equipe.

### Inscrição

Fluxo de inscrição do membro:

```
1. Membro clica em "Inscrever-se"
2. Frontend: POST /retreats/{id}/register
3. Status inicial: PENDING_PAYMENT
4. Membro envia comprovante de pagamento (upload de imagem)
5. Status: PAYMENT_SUBMITTED
6. Admin confirma via painel: status → CONFIRMED
7. (Alternativa) Lista de espera: se vagas esgotadas → WAITLIST
```

O comprovante é enviado como imagem e a URL é armazenada no campo `payment_proof_url` da inscrição. O fluxo técnico exato do upload (direto ao Cloudinary ou via backend) não foi auditado no RC — verificar implementação antes de assumir o mecanismo.

---

## Área Admin de Retiros

`app/admin/retreats/` — acesso: ADMIN, DEV, e coordenadores designados.

### Criação

`app/admin/retreats/create.tsx` — formulário de criação com:

- Nome, descrição, tipo (`WEEKEND`/`DAY`/`FORMATION`)
- Data de início e fim
- Local (nome + link opcional)
- Capacidade máxima e lista de espera
- Valor e instruções de pagamento
- Banner/imagem (upload via Cloudinary)

### Publicação

O ciclo de vida de um retiro no admin:

```
DRAFT → PUBLISHED → CLOSED
              ↓
          CANCELLED (em qualquer estado)
```

A transição `DRAFT → PUBLISHED` torna o retiro visível na listagem do membro. `PUBLISHED → CLOSED` encerra as inscrições. `CANCELLED` é irreversível via UI.

### Gestão de Inscrições

A gestão de inscrições é feita dentro de `app/admin/retreats/[id].tsx` — não existe arquivo separado para registrations. A tela de detalhe do retiro concentra: dados gerais, casas, taxas, inscrições, equipes de serviço e coordenadores.

O admin pode:
- Confirmar inscrição (`PAYMENT_SUBMITTED → CONFIRMED`)
- Mover para lista de espera
- Cancelar inscrição individual
- Exportar lista de inscritos (CSV)

### Equipes de Serviço

`app/admin/retreats/[id].tsx` inclui interfaces para `ServiceTeam` e `ServiceTeamMember` — a funcionalidade está presente no frontend e no backend. O fluxo completo de gestão de equipes (criação, atribuição de membros por casa/papel) está dentro da tela de detalhe do retiro.

---

## API de Retiros

### Endpoints do Membro

| Endpoint | Acesso | Descrição |
|----------|--------|-----------|
| `GET /retreats` | Autenticado | Lista retiros PUBLISHED |
| `GET /retreats/{id}` | Autenticado | Detalhe do retiro |
| `POST /retreats/{id}/register` | Autenticado | Inscreve o usuário |
| `GET /retreats/{id}/my-registration` | Autenticado | Minha inscrição |
| `POST /retreats/{id}/my-registration/payment` | Autenticado | Envia comprovante |
| `DELETE /retreats/{id}/my-registration` | Autenticado | Cancela minha inscrição |

### Endpoints Admin

| Endpoint | Acesso | Descrição |
|----------|--------|-----------|
| `GET /admin/retreats` | ADMIN, DEV | Lista todos os retiros |
| `POST /admin/retreats` | ADMIN, DEV | Cria retiro |
| `PATCH /admin/retreats/{id}` | ADMIN, DEV | Edita retiro |
| `POST /admin/retreats/{id}/publish` | ADMIN, DEV | Publica retiro |
| `POST /admin/retreats/{id}/close` | ADMIN, DEV | Encerra inscrições |
| `POST /admin/retreats/{id}/cancel` | ADMIN, DEV | Cancela retiro |
| `GET /admin/retreats/{id}/registrations` | ADMIN, DEV | Lista inscrições |
| `PATCH /admin/retreats/{id}/registrations/{reg_id}` | ADMIN, DEV | Atualiza status de inscrição |

---

## Permissões de Acesso a Retiros

| Ação | Quem pode |
|------|-----------|
| Ver listagem de retiros | Qualquer autenticado |
| Inscrever-se | Qualquer autenticado |
| Ver detalhe da própria inscrição | O próprio usuário |
| Criar/editar retiro | ADMIN, DEV |
| Confirmar pagamento | ADMIN, DEV |
| Exportar inscritos | ADMIN, DEV (fluxo de aprovação para dados sensíveis) |

---

## Pendências POST-RC

| Item | Descrição |
|------|-----------|
| Hardcoded colors em `retreats/index.tsx` e `(tabs)/invites.tsx` | `#1A859B`, `#ffffff`, `#6b7280` não migrados para tokens |
| Notificação de confirmação | Membros não recebem push automático ao ter inscrição confirmada |
| Cancelamento de retiro com inscritos | Não auditado: o que acontece com inscrições ao cancelar o retiro |
| Upload de comprovante | Fluxo técnico exato (Cloudinary direto vs. backend) não confirmado |

---

## Próxima leitura

- **Painel Admin (visão geral):** `06-admin.md`
- **Notificações e avisos:** `10-notificacoes-inbox.md`
- **Backend — endpoints retreats:** `03-backend.md`
