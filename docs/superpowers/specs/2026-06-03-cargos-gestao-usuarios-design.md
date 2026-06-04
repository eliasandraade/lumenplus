# Spec: Cargos + Gestão de Usuários Avançada

**Data:** 2026-06-03
**Branch alvo:** `feat/cargos-gestao-usuarios`
**Status:** Aprovado para implementação

---

## Contexto

O sistema Lumen+ possui cargos globais (DEV, ADMIN, SECRETARY, AVISOS, COUNCIL_GENERAL, ANALISTA) que controlam acesso a funcionalidades administrativas. Os cargos pararam de ser atribuídos corretamente em produção por ausência de registros na tabela `global_roles`. Paralelamente, a tela de gestão de usuários precisa de filtros avançados, visualização completa de perfil e exportação de listas com dupla confirmação para dados sensíveis.

---

## Parte 1 — Bug Fix: Cargos não salvando

### Causa raiz

`PUT /admin/users/{id}` faz `select(GlobalRole).where(code == X)`. Se o role não existir em `global_roles`, o `if role:` falha silenciosamente e o cargo não é salvo. O seed script (`scripts/seed_dev.py`) nunca foi executado em produção — apenas as migrations rodaram. A migration `012_add_analista_role.py` inseriu `ANALISTA`, mas `ADMIN`, `SECRETARY`, `AVISOS` e `COUNCIL_GENERAL` estavam ausentes.

### Fix

**Migration `023_seed_missing_roles.py`** — insere idempotentemente (via `ON CONFLICT DO NOTHING`) todos os roles do sistema:

| code | name |
|------|------|
| DEV | Desenvolvedor |
| ADMIN | Administrador |
| SECRETARY | Secretário Geral |
| AVISOS | Avisos |
| COUNCIL_GENERAL | Conselho Geral |
| ANALISTA | Analista |

A migration roda automaticamente no próximo deploy (o `start.sh` já executa `alembic upgrade head`).

---

## Parte 2 — Filtros na Gestão de Usuários

### Backend

Endpoint `GET /admin/users` recebe novos query params:

| Parâmetro | Tipo | Descrição |
|-----------|------|-----------|
| `cidade` | `str` | Filtro por cidade (ilike) |
| `estado` | `str` | Filtro por estado/UF (ilike) |
| `realidade_vocacional` | `str` | Code do item em `ProfileCatalogItem` (catalog `VOCATIONAL_REALITY`) |
| `ministerio_id` | `UUID` | ID da unidade organizacional do tipo `MINISTRY` (`org_units.type = MINISTRY`) |
| `estado_civil` | `str` | Code do item em `ProfileCatalogItem` (catalog `MARITAL_STATUS`) |
| `profile_status` | `str` | `COMPLETE` ou `INCOMPLETE` |

Os filtros são aditivos (AND). Parâmetros vazios são ignorados.

### Frontend (mobile)

- Botão **"Filtrar"** (ícone `options-outline`) na barra de busca da tela `app/admin/users/index.tsx`
- Abre um **bottom sheet** com seções para cada filtro
- Filtros ativos aparecem como pills coloridos abaixo da barra de busca (com botão X para remover individualmente)
- Contador de filtros ativos no botão "Filtrar" (ex: "Filtrar (3)")
- Estado dos filtros persiste durante a sessão (limpa ao fechar a tela)

---

## Parte 3 — Visualização Completa do Perfil

### Backend

**Novo endpoint:** `GET /admin/users/{id}/profile`

Acesso: DEV, ADMIN, SECRETARY apenas.

Resposta inclui todos os campos:
- `id`, `name`, `email`, `phone`, `birth_date`, `marital_status`, `city`, `state`
- `vocational_reality`, `ministry`, `org_memberships` (comunidade/núcleo/grupo)
- `rg`, `cpf` — retornados em claro (sem máscara) apenas para DEV/ADMIN/SECRETARY
- `global_roles` com `granted_at` e `granted_by_name` para cada cargo
- `audit_log` — últimas 50 entradas de auditoria sobre este usuário (criadas por admins)
- `created_at`, `last_login`

Toda chamada a este endpoint gera entrada em `audit_log` com `action = "VIEW_FULL_PROFILE"`.

### Frontend (mobile)

**Nova tela:** `app/admin/users/[id].tsx`

Acessada ao tocar em um usuário na lista (substituindo o modal de edição inline).

Seções da tela (ScrollView com seções colapsáveis):

1. **Cabeçalho** — avatar, nome, email, status do perfil, cargos como pills
2. **Dados Pessoais** — nome completo, telefone, nascimento, estado civil, cidade, estado
3. **Vocacional** — realidade vocacional, ministério, comunidade/núcleo/grupo
4. **Documentos** — RG e CPF visíveis com ícone de olho (toggle mostra/oculta); campo exibe `•••••••` por padrão e revela ao tocar — cada revelação é auditada
5. **Cargos** — lista dos cargos com data de concessão e quem concedeu; botão de edição de cargos (apenas DEV/ADMIN)
6. **Auditoria** — timeline das últimas 50 ações sobre este perfil

---

## Parte 4 — Exportação de Listas com Dupla Confirmação

### Tabela nova: `data_export_requests`

```
id                UUID PK
requested_by      UUID FK users.id
status            ENUM: PENDING | APPROVED | REJECTED | GENERATED | EXPIRED
fields_requested  TEXT[]  — lista de campos incluídos na exportação
filters_json      JSONB   — snapshot dos filtros aplicados
has_sensitive     BOOLEAN — true se inclui RG ou CPF
approved_by       UUID FK users.id nullable
approved_at       TIMESTAMPTZ nullable
file_path         TEXT nullable — path interno do CSV gerado
expires_at        TIMESTAMPTZ nullable — 24h após geração
created_at        TIMESTAMPTZ default now()
```

### Fluxo de exportação

**Exportação sem dados sensíveis (sem RG/CPF):**
1. Usuário (DEV/ADMIN/SECRETARY) solicita → CSV gerado imediatamente → disponível para download
2. Entrada em `audit_log`: `action = "EXPORT_DATA"`

**Exportação com dados sensíveis (inclui RG e/ou CPF):**
1. Usuário solicita → registro criado com `status = PENDING`
2. Sistema envia mensagem no **Inbox** para todos com cargo `COUNCIL_GENERAL` descrevendo: quem pediu, quais campos, quantos usuários
3. Aparece na aba **"Aprovações"** em `app/admin/approvals/index.tsx`
4. Um COUNCIL_GENERAL (ou DEV) aprova → `status = APPROVED` → CSV gerado → `status = GENERATED`
5. Solicitante recebe notificação no Inbox: "Sua exportação foi aprovada e está disponível"
6. Link de download disponível por 24h; após expirar → `status = EXPIRED`
7. Entrada em `audit_log` para cada etapa: `EXPORT_REQUESTED`, `EXPORT_APPROVED`, `EXPORT_DOWNLOADED`

**DEV** pode aprovar a própria solicitação (bypass, mas auditado).

### Backend

- `POST /admin/export/request` — cria solicitação
- `GET /admin/export/requests` — lista solicitações (admin vê as próprias; DEV/ADMIN/COUNCIL_GENERAL veem todas pendentes)
- `POST /admin/export/{id}/approve` — aprova (COUNCIL_GENERAL, DEV, ADMIN)
- `POST /admin/export/{id}/reject` — rejeita
- `GET /admin/export/{id}/download` — retorna o CSV (apenas se GENERATED e não expirado; audita o download)

### Frontend (mobile)

**Nova tela:** `app/admin/approvals/index.tsx`

- Tab no menu admin com badge numérico de aprovações pendentes
- Lista de exportações pendentes com: quem pediu, quando, campos solicitados, número de usuários
- Botões Aprovar / Rejeitar com confirmação

**Tela de exportação:** `app/admin/users/export.tsx`

- Acessada via botão "Exportar" na tela de usuários
- Checkboxes para selecionar campos (agrupados: básicos / vocacionais / documentos)
- Aviso em destaque se campos sensíveis selecionados: "Esta exportação requer aprovação do Conselho Geral"
- Filtros ativos são aplicados automaticamente à exportação

---

## Auditoria

Todas as ações abaixo geram entrada em `audit_log`:

| action | Quando |
|--------|--------|
| `VIEW_FULL_PROFILE` | Abertura da tela de perfil completo |
| `VIEW_SENSITIVE_FIELD` | Toggle para revelar RG ou CPF na UI |
| `ROLE_GRANTED` | Cargo atribuído a usuário |
| `ROLE_REVOKED` | Cargo removido de usuário |
| `EXPORT_REQUESTED` | Exportação solicitada |
| `EXPORT_APPROVED` | Exportação aprovada |
| `EXPORT_REJECTED` | Exportação rejeitada |
| `EXPORT_DOWNLOADED` | Arquivo CSV baixado |

---

## Controle de Acesso Consolidado

| Ação | DEV | ADMIN | SECRETARY | COUNCIL_GENERAL | Outros |
|------|-----|-------|-----------|-----------------|--------|
| Listar usuários | ✅ | ✅ | ✅ | ✅ (unidade própria) | ❌ |
| Filtrar usuários | ✅ | ✅ | ✅ | ❌ | ❌ |
| Ver perfil completo | ✅ | ✅ | ✅ | ❌ | ❌ |
| Ver RG/CPF na UI | ✅ | ✅ | ✅ | ❌ | ❌ |
| Exportar sem sensíveis | ✅ | ✅ | ✅ | ❌ | ❌ |
| Exportar com RG/CPF | ✅ (auto-aprova) | ✅ req. aprov. | ✅ req. aprov. | Aprovar | ❌ |
| Atribuir cargos | ✅ | ✅ | ❌ | AVISOS apenas | ❌ |
| Aprovar exportação | ✅ | ✅ | ❌ | ✅ | ❌ |

---

## Branch e escopo

- Branch: `feat/cargos-gestao-usuarios`
- Não afeta nenhuma funcionalidade existente em produção antes do merge
- A migration `023` é segura (apenas INSERTs idempotentes, sem ALTER TABLE)
- O CSV é gerado server-side e armazenado temporariamente; não requer storage externo (usa disco do container por 24h)

---

## Fora do escopo desta feature

- Filtros por todos os campos do perfil (segunda fase, mencionada pelo usuário)
- Push notifications via FCM/Expo para aprovações (fase futura)
- Exportação em PDF
- Filtro por cargo global na tela de usuários (fase futura)
