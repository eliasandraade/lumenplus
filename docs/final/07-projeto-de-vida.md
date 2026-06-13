# Lumen+ — Projeto de Vida

**Versão da documentação:** 1.0  
**Data:** 2026-06-12  
**Audiência:** desenvolvedor, pastoral

---

## Propósito

O módulo Projeto de Vida (PdV) é o coração pastoral do Lumen+. Ele oferece ao membro um espaço privado e estruturado para acompanhar sua jornada espiritual através de: ciclo mensal, áreas de vida, registro diário, exame de consciência, revisão mensal e histórico. O membro define um PIN pessoal que protege o acesso ao conteúdo — reforçando a posse individual e a privacidade do espaço.

> "Tudo o que você escreve é seu. A Equipe Lumen+ não acessa o conteúdo do seu Projeto de Vida."
>
> — Texto exibido na tela Hub (`app/vida/index.tsx`)

Esta frase não é apenas UX copy — reflete uma decisão arquitetural real: as rotas administrativas do backend não importam nem chamam nenhum endpoint de `/vida`. O conteúdo do PdV é tecnicamente inacessível pelo painel Admin.

---

## Arquitetura

### Backend

As rotas do Projeto de Vida estão em `backend/app/api/routes/projeto_vida_mensal.py` (e sub-rotas). O banco contém as tabelas:

- `life_plan_cycles` — ciclo mensal (migração 022+)
- `projeto_vida_mensal` — dados do ciclo com PIN (migração 032+)
- `projeto_vida_areas` — áreas de vida do ciclo
- `projeto_vida_semanal` — registros semanais
- `projeto_vida_diario` — diário diário
- `projeto_vida_exame` — exame de consciência
- `projeto_vida_revisao` — revisão mensal
- `projeto_vida_intercessao` — intenções de intercessão
- `projeto_vida_evangelizacao` — comprometimentos de evangelização

Todas as rotas filtram por `WHERE user_id = current_user.id` — sem acesso cruzado entre membros.

### Frontend

```
app/vida/
├── index.tsx          # Hub: overview do ciclo do mês
├── unlock.tsx         # Tela de desbloqueio com PIN
├── wizard.tsx         # Criação de novo ciclo (passo a passo)
├── ciclo.tsx          # Tela principal do ciclo após desbloqueio
├── semanal.tsx        # Registro semanal
├── diario.tsx         # Diário diário
├── exame.tsx          # Exame de consciência
├── revisao.tsx        # Revisão mensal do ciclo
└── historico.tsx      # Histórico de ciclos anteriores
```

```
src/contexts/
└── UnlockedCyclesContext.tsx  # Controle de sessão de PIN
```

---

## Fluxo do Usuário

### 1. Hub (`app/vida/index.tsx`)

O Hub carrega o ciclo do mês atual via API e mostra um resumo:

```
┌─────────────────────────────────────┐
│  Projeto de Vida — [Mês/Ano]        │
│                                     │
│  Como está o seu ciclo              │
│  Comunidade · Cuidado               │
│  Compromissos · Oração              │
│                                     │
│  [ Ver ciclo completo ]             │
│                                     │
│  Histórico de ciclos anteriores     │
└─────────────────────────────────────┘
```

O card do ciclo exibe quatro indicadores de resumo com rótulos: **Comunidade**, **Cuidado**, **Compromissos**, **Oração**. Esses rótulos mapeiam para campos agregados do projeto (`comunidade`, `cuidado`, `compromissos`, `praticas`) — são uma visão simplificada de status, não os nomes internos das áreas do wizard.

> **Importante:** os rótulos do Hub (Comunidade/Cuidado/Compromissos/Oração) são labels de exibição do card de resumo. As áreas reais criadas no wizard têm nomes distintos — ver seção "Wizard" abaixo.

**Estado vazio (sem ciclo no mês):**

> "Este mês ainda não tem um ciclo"  
> [Iniciar novo ciclo]

Botão leva ao wizard de criação.

**Decisão de roteamento no Hub:**

```typescript
// app/vida/index.tsx
if (has_pin) {
  router.push('/vida/unlock');   // PIN já definido → pede desbloqueio
} else {
  router.push('/vida/ciclo');    // Sem PIN → acesso direto (DEV/setup)
}
```

### 2. Wizard (`app/vida/wizard.tsx`)

Fluxo multipasso (11 passos) para criar um novo ciclo mensal:

| Passo | Título | Conteúdo |
|-------|--------|---------|
| 0 | Motivação | Reflexão vocacional personalizada pelo perfil do membro; campo de intenção do ciclo |
| 1 | Ciclo Mensal | Seleção de mês e ano |
| 2 | Família Vocacional | Objetivo, compromissos concretos (data/hora/local), observações |
| 3 | Ministério Bom Pastor | Idem — encontros de acompanhamento |
| 4 | Grupo Formativo | Idem — encontros do grupo e retiros |
| 5 | Saúde e Lazer | Idem — consultas, descanso, atividade física |
| 6 | Família de Origem | Idem — momentos com a família de sangue |
| 7 | Evangelização Ser Feliz | Reflexão livre + ações concretas (o quê / como / duração em min) |
| 8 | Intercessão | Intenções pessoais, intenções comunitárias, oferecimento do mês |
| 9 | Privacidade / PIN | Criação de senha de 4 dígitos (opcional) |
| 10 | Confirmar | Resumo do ciclo e botão "Salvar Projeto de Vida" |

**As 5 áreas** criadas internamente são: `FAMILIA_VOCACIONAL`, `MINISTERIO_BOM_PASTOR`, `GRUPO_FORMATIVO`, `SAUDE_LAZER`, `FAMILIA_ORIGEM`. Esses são os tipos armazenados no banco — os rótulos exibidos no wizard são os títulos da tabela acima.

**PIN é opcional:** o passo 9 exibe "Senha de 4 dígitos (opcional)" com instrução "Deixe em branco para não usar senha." Se nenhum PIN for definido, o ciclo abre diretamente sem tela de desbloqueio.

Após salvar, o usuário é redirecionado ao ciclo criado (`/vida/ciclo`).

### 3. Desbloqueio com PIN (`app/vida/unlock.tsx`)

O desbloqueio ocorre apenas quando o ciclo tem PIN definido (`has_pin = true`). O fluxo:

```
1. Usuário informa 4 dígitos
2. Frontend chama: POST /projeto-vida-mensal/{id}/pin/verificar  { pin }
3. Backend valida o PIN contra o hash armazenado, retorna { valid: boolean }
4. Se válido: markUnlocked(projetoId) + router.replace('/vida/ciclo')
5. Se inválido: mensagem de erro, PIN limpo, refoco no campo
```

**Validação é server-side.** O PIN nunca é comparado no cliente. O backend retorna `{ valid: true/false }`; o frontend não conhece o hash.

### 4. Ciclo (`app/vida/ciclo.tsx`)

Tela principal após desbloqueio. Exibe o ciclo completo com acesso às seções: áreas, semanal, diário, exame, revisão.

### 5. Revisão (`app/vida/revisao.tsx`)

Ao final do mês, o membro faz uma revisão do ciclo — avaliando cada área, o cumprimento das metas e as lições aprendidas. Após a revisão, o ciclo é marcado como concluído.

### 6. Histórico (`app/vida/historico.tsx`)

Lista de ciclos anteriores com resumo de cada mês. Cada ciclo arquivado também requer desbloqueio de PIN para acesso ao conteúdo.

---

## Proteção por PIN

### Modelo de segurança

| Camada | Mecanismo |
|--------|-----------|
| Armazenamento do PIN | Hash no banco (backend) — nunca em plain text |
| Validação | Server-side: `POST /projeto-vida-mensal/{id}/pin/verificar` |
| Sessão de desbloqueio | React memory (Map em `UnlockedCyclesContext`) — **não** AsyncStorage |
| TTL da sessão | 15 minutos (definido em `UnlockedCyclesContext`, apenas no cliente) |
| Reset por background | `AppState` listener: se app fica inativo/background por >15 min, `clearAll()` é chamado ao retornar |
| Reset por refresh (web) | Memória JavaScript é zerada — PIN obrigatório novamente |

> **Clarificação:** o TTL de 15 minutos é controlado exclusivamente pelo frontend (`UnlockedCyclesContext`). Não existe TTL server-side de sessão de PIN — o backend apenas valida o PIN na chamada e não mantém estado de "desbloqueado". Cada verificação de desbloqueio é uma nova chamada à API.

### UnlockedCyclesContext

```typescript
// src/contexts/UnlockedCyclesContext.tsx

const UNLOCK_TTL_MS = 15 * 60 * 1000;  // 15 minutos

// Verifica se está desbloqueado e dentro do TTL
isUnlocked(projetoId): boolean

// Marca como desbloqueado com timestamp atual
markUnlocked(projetoId): void

// Limpa todos os desbloqueios (chamado no background>15min)
clearAll(): void
```

O Map interno nunca é persistido. Em web, um refresh de página zera a memória → PIN necessário novamente. Em mobile, saída do app por >15 minutos desencadeia `clearAll()` via AppState listener.

### Implicações

- **PIN não tem recuperação self-service.** Não foi localizado fluxo de recuperação ou reset de PIN na implementação auditada. O app exibe o aviso ao usuário no step 9 do wizard: *"Se você perder essa senha, não será possível recuperar o conteúdo ou o acesso ao seu Projeto de Vida."*
- **Admin não pode desbloquear.** Não existe endpoint administrativo que contorna o PIN.
- **POST-RC:** a ausência de recuperação é um ponto de atrito potencial. A decisão de produto sobre um fluxo de recuperação deve ser tratada em ciclo futuro.

---

## Privacidade e Isolamento

- As rotas admin (`/admin/*`) não têm acesso a nenhuma rota de `/vida/*`
- O backend não implementa nenhuma rota de "ver PdV de outro usuário" — o isolamento é estrutural
- Sentry captura erros da tela de vida, mas com `sendDefaultPii: false` — conteúdo não é enviado
- O conteúdo do ciclo (diário, exame, intercessão) não aparece em nenhum export de dados admin

---

## Migrações

O módulo Projeto de Vida foi implementado nas migrações **032–044**:

| Faixa | Conteúdo |
|-------|---------|
| 032–034 | Tabela `projeto_vida_mensal` com campo de PIN (hash) |
| 035–036 | Revisão e áreas de vida |
| 037–038 | Registro diário e exame |
| 039 | Semanal e acompanhamento |
| 040–041 | Intercessão e evangelização |
| 042–044 | Ajustes de schema, índices e seeds de catálogo |

---

## Estado dos Checks

TypeScript passa sem erros nas telas do módulo `app/vida/`. Não há testes unitários de frontend configurados. Para o estado dos testes de backend específicos do PdV, rodar `pytest backend/tests/` como fonte de verdade.

---

## Pendências POST-RC

| Item | Descrição |
|------|-----------|
| Recuperação de PIN | Não existe fluxo de reset de PIN — membro perde acesso ao ciclo |
| Wizard de criação não auditado | Fluxo de criação não foi parte do escopo do RC |
| Evangelização e intercessão | Seções implementadas no backend mas status do frontend não auditado completamente |

---

## Próxima leitura

- **Arquitetura geral (isolamento admin/vida):** `02-arquitetura.md`
- **Backend — endpoints `/projeto-vida`:** `03-backend.md`
- **LGPD — dados pessoais e retenção:** `13-lgpd-dados-sensiveis.md`
