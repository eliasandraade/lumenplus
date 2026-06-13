# Lumen+ — Comunidade, Canal e Membros

**Versão da documentação:** 1.0  
**Data:** 2026-06-12  
**Audiência:** desenvolvedor, coordenador de unidade

---

## Visão Geral

O módulo de Comunidade cobre a estrutura organizacional do Lumen+ (unidades), o canal de comunicação interno de cada unidade (posts e replies), a gestão de membros e o sistema de convites. É o coração da vida comunitária no app.

---

## Estrutura Organizacional (OrgUnit)

### Hierarquia

As unidades organizacionais seguem uma hierarquia de 5 níveis:

```
CONSELHO_GERAL
  └── CONSELHO_EXECUTIVO
        └── SETOR
              └── MINISTERIO
                    └── GRUPO
```

Existe também o tipo especial `MISSAO`, que pode ser criado fora da hierarquia padrão.

Cada unidade (`OrgUnit`) tem:
- `id`, `name`, `type` (enum acima)
- `parent_id` → referência à unidade pai (null para raiz)
- `is_active`
- Membros: via tabela `OrgMembership`

### API

| Endpoint | Acesso | Descrição |
|----------|--------|-----------|
| `GET /org/tree` | Autenticado | Árvore completa de unidades |
| `GET /org/units/{id}` | Autenticado | Detalhe de uma unidade |
| `GET /org/units/{id}/members` | Autenticado | Membros da unidade |
| `POST /org/root-unit` | ADMIN, DEV | Cria unidade raiz (CONSELHO_GERAL) |
| `POST /org/units/{parent_id}/children` | ADMIN, DEV | Cria unidade filha de `parent_id` |
| `PATCH /org/units/{unit_id}` | ADMIN, DEV, Coordinator | Edita unidade |

### Frontend

`app/admin/entities/index.tsx` — gestão admin de unidades (árvore, edição).

A tela de comunidade do membro (`app/(tabs)/community.tsx`) exibe as unidades às quais o membro pertence.

---

## Membros

### Modelo

Cada vínculo usuário-unidade é uma `OrgMembership`:

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `user_id` | UUID | Membro |
| `org_unit_id` | UUID | Unidade |
| `role` | `COORDINATOR` \| `MEMBER` | Papel na unidade |
| `is_active` | bool | Vínculo ativo |

Um usuário pode ter vínculos em múltiplas unidades com papéis diferentes em cada uma.

### Papéis na Unidade

| Papel | Permissões |
|-------|------------|
| `COORDINATOR` | Gerencia membros, envia convites, modera canal, posta qualquer conteúdo |
| `MEMBER` | Lê o canal; pode postar e responder conforme `channel_post_mode` da unidade (a capacidade de criar posts depende da configuração da unidade, não é garantida a todo membro) |

### API de Membros

| Endpoint | Acesso | Descrição |
|----------|--------|-----------|
| `GET /org/units/{id}/members` | Autenticado | Lista membros da unidade |
| `POST /org/units/{id}/invites` | COORDINATOR, ADMIN, DEV | Convida usuário para a unidade |
| `PUT /org/units/{id}/members/{user_id}/role` | COORDINATOR, ADMIN, DEV | Altera papel do membro |
| `DELETE /org/units/{id}/members/{user_id}` | COORDINATOR, ADMIN, DEV | Remove membro |
| `POST /org/units/{id}/leave` | Membro | Sai da unidade |

---

## Convites

### Fluxo

1. **Criação**: coordenador ou admin cria um convite para um usuário existente (`POST /org/units/{unit_id}/invites`)
2. **Notificação**: o usuário convidado recebe aviso — convite pendente aparece em `/auth/me` (`pending_invites`)
3. **Resposta**: o usuário aceita ou recusa via `POST /org/invites/{id}/accept` ou `POST /org/invites/{id}/reject`
4. **Confirmação**: ao aceitar, `OrgMembership` é criada com `role=MEMBER`

### Estados do Convite

| Estado | Descrição |
|--------|-----------|
| `PENDING` | Aguardando resposta |
| `ACCEPTED` | Usuário aceitou |
| `DECLINED` | Usuário recusou |
| `EXPIRED` | Expirado sem resposta |

Convites pendentes aparecem na resposta de `/auth/me` (`pending_invites`), permitindo que o guard de onboarding os exiba ao usuário.

### Frontend

`app/(tabs)/invites.tsx` — esta tela é a **Inbox/Avisos** do membro (header do arquivo: "Tela de avisos e comunicações do app"). Exibe mensagens recebidas e, para aprovadores, avisos pendentes de aprovação. Os convites de unidades são exibidos como notificações dentro do mesmo fluxo de inbox.

---

## Canal de Grupos

### O que é

Cada unidade tem um canal de comunicação interno acessível a todos os seus membros. O canal suporta posts (mensagens principais) e replies (respostas a um post). É o espaço de comunicação cotidiana da comunidade — não é um fórum público nem uma feature admin.

### Frontend

`app/channel/[unitId].tsx` — canal de um grupo específico. Rota paramétrica: `/channel/:unitId`.

### API do Canal

| Endpoint | Acesso | Descrição |
|----------|--------|-----------|
| `GET /channel/{unit_id}/posts` | Membro da unidade | Lista posts |
| `POST /channel/{unit_id}/posts` | Membro da unidade | Cria post |
| `DELETE /channel/{unit_id}/posts/{post_id}` | Autor do post, Coordinator, ADMIN | Remove post |
| `GET /channel/{unit_id}/posts/{post_id}/replies` | Membro da unidade | Lista replies |
| `POST /channel/{unit_id}/posts/{post_id}/replies` | Membro da unidade | Cria reply |
| `PATCH /channel/{unit_id}/posts/{post_id}/replies/{reply_id}` | Autor da reply, Coordinator | Edita reply |
| `DELETE /channel/{unit_id}/posts/{post_id}/replies/{reply_id}` | Autor da reply, Coordinator | Remove reply |

### Autorização e IDOR — H5A-02 (Corrigido)

**Contexto:** a auditoria H5A (jun/2026) identificou que `edit_reply` e `delete_reply` não validavam o `org_unit_id` da rota — um coordenador de unidade A poderia editar replies de posts da unidade B se soubesse os IDs.

**Correção (H5B, em produção):** os endpoints de reply agora fazem JOIN com `ChannelPost` para garantir que o `post.org_unit_id == org_unit_id` da rota antes de qualquer operação. A falha não é mais reproduzível.

```python
# backend/app/api/channel_routes.py (~linha 382)
# JOIN garante que o post pertence à unidade da rota
post = db.query(ChannelPost).join(OrgUnit).filter(
    ChannelPost.id == post_id,
    ChannelPost.org_unit_id == org_unit_id  # ← H5A-02 fix
).first()
```

### Moderação

Coordenadores podem editar e deletar qualquer reply dentro de sua unidade. Membros só editam/deletam as próprias replies. Todas as deleções são registradas no `audit_log`.

---

## Tela de Membros

`app/members.tsx` — tela de listagem de membros de uma unidade, acessível a qualquer membro. Exibe nome, foto de perfil e papel (coordenador/membro) de cada integrante.

---

## Pendências POST-RC

| Item | Descrição |
|------|-----------|
| Notificação de novos posts | Membros não recebem push automático de posts no canal |
| Paginação do canal | Verificar se canal com muitos posts tem paginação adequada |
| Moderação avançada | Sem reportar post inadequado — moderação manual via coordenador |

---

## Próxima leitura

- **Papéis por unidade (COORDINATOR/MEMBER):** `05-autenticacao-permissoes.md`
- **Backend — endpoints org e channel:** `03-backend.md`
- **Notificações e avisos:** `10-notificacoes-inbox.md`
