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

Tabela alvo: `projetos_vida_mensal` (confirmado em `backend/app/db/models.py`, linha 1794: `__tablename__ = "projetos_vida_mensal"`).

```sql
ALTER TABLE projetos_vida_mensal
ADD COLUMN evangelizacao_acoes JSONB DEFAULT NULL;
```

Downgrade:
```sql
ALTER TABLE projetos_vida_mensal
DROP COLUMN evangelizacao_acoes;
```

**Compatibilidade com projetos antigos:** coluna é `NULLABLE` com `DEFAULT NULL`. Projetos existentes receberão `NULL` automaticamente. No frontend, tratar `evangelizacao_acoes: null | undefined` como lista vazia `[]` em todos os pontos de leitura.

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
    duracao_min: int | None = Field(default=None, ge=1)  # inteiro positivo

# em ProjetoVidaMensalUpdate / ProjetoVidaMensalOut:
evangelizacao_acoes: list[EvangelizacaoAcaoItem] | None = None
```

`ge=1` rejeita zero e negativos. O frontend nunca envia `duracao_min=0` (converte string vazia para `null`), mas a validação no schema é a rede de segurança.

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
interface EvangelizacaoAcaoItemLocal {
  descricao: string;
  como: string;
  duracao_min: string; // string no estado UI, converte para int no payload
}

interface WizardData {
  // ... campos existentes
  evangelizacao_acoes: EvangelizacaoAcaoItemLocal[];
}
```

**Inicialização em modo criação:** `evangelizacao_acoes: []` (lista vazia).

**Inicialização em modo edição** (ciclo existente já tem `evangelizacao_acoes`):

```typescript
evangelizacao_acoes: (existing.evangelizacao_acoes ?? []).map(a => ({
  descricao: a.descricao ?? '',
  como: a.como ?? '',
  duracao_min: a.duracao_min != null ? String(a.duracao_min) : '',
}))
```

Usar `?? []` como fallback para projetos antigos onde o campo é `null`.

#### Regra de descarte

Itens sem `descricao` preenchida são descartados antes de enviar ao backend:

```typescript
evangelizacao_acoes: data.evangelizacao_acoes
  .filter(a => a.descricao.trim().length > 0)   // descarta sem descrição
  .map(a => ({
    descricao: a.descricao.trim(),
    como: a.como.trim() || null,
    duracao_min: (() => {
      const n = parseInt(a.duracao_min, 10);
      return Number.isFinite(n) && n >= 1 ? n : null;  // positivo ou null
    })(),
  }))
```

`duracao_min` vazio ou `0` → `null`. String não numérica → `null`. Nunca envia `0` ou negativo.

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
| `backend/app/db/models.py` | Adicionar coluna `evangelizacao_acoes` (JSONB) ao model `ProjetoVidaMensal` |
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
