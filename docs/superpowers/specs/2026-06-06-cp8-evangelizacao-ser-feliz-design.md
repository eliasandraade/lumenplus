# CP8 — Evangelização Ser Feliz

**Data:** 2026-06-06  
**Status:** Aprovado — aguardando implementação  
**Origem:** Feedback do teste manual pós-deploy do PV 2.0  
**Tipo:** Backend + Frontend — 1 migration, 1 campo novo na API

---

## Contexto

A Evangelização Ser Feliz é um chamado comunitário: cada membro se compromete com pelo menos 15 minutos por dia de presença evangelizadora, podendo ser divididos em 5 minutos por turno. O passo atual do wizard tem apenas um campo de reflexão livre. O redesign adiciona ações concretas estruturadas e um texto que inspire o usuário a ir além dos 15 minutos.

---

## Backend

### Migration nova

`044_pvm_evangelizacao_acoes.py`

```sql
ALTER TABLE projetos_vida_mensal
ADD COLUMN evangelizacao_acoes JSONB DEFAULT NULL;
```

### Schema de cada ação (JSONB)

```json
[
  {
    "descricao": "Conversa com colega durante o almoço",
    "como": "Presença atenta, sem celular, ouvindo de verdade",
    "duracao_min": 15
  }
]
```

Todos os campos opcionais dentro de cada item. Lista pode ser vazia ou `null`.

### Pydantic

Adicionar em `ProjetoVidaMensalUpdate` e `ProjetoVidaMensalOut`:

```python
class EvangelizacaoAcaoItem(BaseModel):
    descricao: str | None = None
    como: str | None = None
    duracao_min: int | None = None

# em ProjetoVidaMensalUpdate / ProjetoVidaMensalOut:
evangelizacao_acoes: list[EvangelizacaoAcaoItem] | None = None
```

### Endpoint

Nenhum endpoint novo. `PUT /projeto-vida-mensal/{id}` já aceita campos livres. Apenas incluir `evangelizacao_acoes` no schema de update e na resposta.

### Merge de campos existentes

O campo `reflexao_evangelizacao` (texto livre) é **mantido** — funciona como reflexão pessoal complementar às ações concretas. Os dois coexistem.

---

## Frontend

### Wizard step 7 — `wizard.tsx`

#### Texto de abertura (bloco laranja existente, conteúdo novo)

```
COMUNHÃO COMUNITÁRIA

Evangelização Ser Feliz

A Evangelização Ser Feliz é um chamado de comunhão: cada um de
nós, no lugar onde está, oferece ao menos 15 minutos por dia à
presença de Deus entre as pessoas. Esses minutos podem ser
divididos — 5 de manhã, 5 à tarde, 5 à noite. Não é uma tarefa.
É uma disponibilidade do coração.

Mas não pare nos 15 minutos. Deixe que Deus te surpreenda.
Quais são as pessoas que Ele está colocando no seu caminho?
Que ação concreta nasce do amor?
```

#### Campo de reflexão (existente, mantido)

Label: "Reflexão sobre este mês"  
Placeholder atual mantido.

#### Lista de ações concretas (nova)

Label: "Ações concretas"  
Subtítulo discreto: "O que você fará de concreto?"

Cada item da lista:
```
┌─ Ação ─────────────────────────────────────────┐
│ O quê      [Descrição da ação              ]   │
│ Como       [De que forma vai acontecer     ]   │
│ Quanto     [15] min                            │
│                                    [✕ remover] │
└────────────────────────────────────────────────┘
```

Botão "+ Adicionar ação" (estilo dashed, igual aos `momentos` do `semanal.tsx`).

**Campo "Quanto":** `keyboardType="numeric"`, sufixo "min" exibido ao lado.  
**Limite:** sem limite fixo de itens.

#### Estado no wizard

```typescript
interface WizardData {
  // ... campos existentes
  evangelizacao_acoes: EvangelizacaoAcaoItem[];
}

interface EvangelizacaoAcaoItem {
  descricao: string;
  como: string;
  duracao_min: string; // string no estado, converte para int no payload
}
```

#### Payload no `handleSave`

```typescript
evangelizacao_acoes: data.evangelizacao_acoes
  .filter(a => a.descricao.trim())
  .map(a => ({
    descricao: a.descricao || null,
    como: a.como || null,
    duracao_min: parseInt(a.duracao_min) || null,
  }))
```

### Visualização no `ciclo.tsx`

Na seção "Evangelização Ser Feliz", exibir:

1. `reflexao_evangelizacao` (texto, se preenchido)
2. Lista de ações:
   - Cada item como card compacto: descrição em bold, "Como: ..." em regular, "N min" como badge

### Service — `projetoVidaMensal.ts`

Adicionar ao tipo `ProjetoVidaMensalFull`:

```typescript
export interface EvangelizacaoAcaoItem {
  descricao: string | null;
  como: string | null;
  duracao_min: number | null;
}

// em ProjetoVidaMensalFull:
evangelizacao_acoes?: EvangelizacaoAcaoItem[] | null;
```

---

## Arquivos afetados

| Arquivo | Mudança |
|---------|---------|
| `backend/alembic/versions/044_pvm_evangelizacao_acoes.py` | **Criado** — migration |
| `backend/app/models/projeto_vida_mensal.py` | Adicionar coluna `evangelizacao_acoes` (JSONB) |
| `backend/app/schemas/projeto_vida_mensal.py` | Adicionar `EvangelizacaoAcaoItem` + campo nos schemas de update e out |
| `lumen_mobile/src/services/projetoVidaMensal.ts` | Adicionar tipo `EvangelizacaoAcaoItem` + campo no `ProjetoVidaMensalFull` |
| `lumen_mobile/app/vida/wizard.tsx` | Redesign do step 7 com novo texto + lista de ações |
| `lumen_mobile/app/vida/ciclo.tsx` | Exibir ações na seção Evangelização |

---

## Restrições

- Migration reversível (`op.drop_column` no `downgrade`)
- `reflexao_evangelizacao` mantido — sem remover dados existentes
- Sem Alert.alert
- Sem emojis na UI
- Tom contemplativo no texto de abertura
