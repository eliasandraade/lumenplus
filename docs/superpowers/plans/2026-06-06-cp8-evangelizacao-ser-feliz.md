# CP8 — Evangelização Ser Feliz Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Adicionar lista de ações concretas estruturadas (JSONB) ao step 7 do wizard de Projeto de Vida Mensal, mantendo o campo `reflexao_evangelizacao` intacto.

**Architecture:** Nova coluna `evangelizacao_acoes` (JSONB nullable) na tabela `projetos_vida_mensal` via migration Alembic 044; schema Pydantic `EvangelizacaoAcaoItem` adicionado aos schemas de update/out; frontend com estado local em string (converte para int no payload), lista editável no step 7 do wizard, e visualização em cards no ciclo.

**Tech Stack:** Python/SQLAlchemy/Alembic (backend), React Native + Expo (mobile), TypeScript, Pydantic v2.

---

### Task 1: Migration Alembic 044

**Files:**
- Create: `backend/alembic/versions/044_pvm_evangelizacao_acoes.py`

- [ ] **Step 1: Criar o arquivo de migration**

```python
"""Projeto de Vida — ADD evangelizacao_acoes to projetos_vida_mensal

Revision ID: 044_pvm_evangelizacao_acoes
Revises: 043_pvm_intercessao
Create Date: 2026-06-06

Adiciona coluna JSONB nullable `evangelizacao_acoes` à tabela
`projetos_vida_mensal`. Projetos existentes recebem NULL automaticamente.
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "044_pvm_evangelizacao_acoes"
down_revision: Union[str, None] = "043_pvm_intercessao"
branch_labels: Union[Sequence[str], None] = None
depends_on: Union[Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "projetos_vida_mensal",
        sa.Column(
            "evangelizacao_acoes",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=True,
        ),
    )


def downgrade() -> None:
    op.drop_column("projetos_vida_mensal", "evangelizacao_acoes")
```

- [ ] **Step 2: Aplicar a migration**

```bash
cd backend
alembic upgrade head
```

Saída esperada: `Running upgrade 043_pvm_intercessao -> 044_pvm_evangelizacao_acoes, ...`

- [ ] **Step 3: Verificar a coluna no banco**

```bash
psql $DATABASE_URL -c "\d projetos_vida_mensal" | grep evangelizacao
```

Saída esperada: linha com `evangelizacao_acoes | jsonb | ...`

- [ ] **Step 4: Commit**

```bash
git add backend/alembic/versions/044_pvm_evangelizacao_acoes.py
git commit -m "feat(migration): 044 — add evangelizacao_acoes JSONB to projetos_vida_mensal"
```

---

### Task 2: Model SQLAlchemy

**Files:**
- Modify: `backend/app/db/models.py` (linha ~1814, após `reflexao_evangelizacao`)

- [ ] **Step 1: Adicionar a coluna no model `ProjetoVidaMensal`**

Localizar a linha:
```python
    reflexao_evangelizacao: Mapped[str | None] = mapped_column(Text, nullable=True)
```

Adicionar imediatamente após:
```python
    evangelizacao_acoes: Mapped[list | None] = mapped_column(
        postgresql.JSONB(astext_type=Text()), nullable=True
    )
```

O import `postgresql` já existe em `models.py` — verificar com `grep "from sqlalchemy.dialects" backend/app/db/models.py`. Se não existir, adicionar no topo:
```python
from sqlalchemy.dialects import postgresql
```

- [ ] **Step 2: Verificar que o servidor backend sobe sem erros**

```bash
cd backend
uvicorn app.main:app --reload
```

Esperado: sem `ImportError` ou `AttributeError`.

- [ ] **Step 3: Commit**

```bash
git add backend/app/db/models.py
git commit -m "feat(model): add evangelizacao_acoes JSONB column to ProjetoVidaMensal"
```

---

### Task 3: Schemas Pydantic

**Files:**
- Modify: `backend/app/schemas/projeto_vida_mensal.py`

- [ ] **Step 1: Adicionar o schema `EvangelizacaoAcaoItem` após os outros sub-schemas (antes de `ProjetoVidaMensalCreate`, linha ~171)**

Localizar o comentário `# ── Top-level schemas` e inserir antes dele:

```python
class EvangelizacaoAcaoItem(BaseModel):
    descricao: Optional[str] = None
    como: Optional[str] = None
    duracao_min: Optional[int] = Field(default=None, ge=1)
```

- [ ] **Step 2: Adicionar o campo em `ProjetoVidaMensalUpdate`**

Localizar:
```python
class ProjetoVidaMensalUpdate(BaseModel):
    observacoes_mes: Optional[str] = Field(None, max_length=3000)
    concluido: Optional[bool] = None
    intencao: Optional[str] = Field(None, max_length=2000)
    reflexao_evangelizacao: Optional[str] = Field(None, max_length=3000)
```

Adicionar após `reflexao_evangelizacao`:
```python
    evangelizacao_acoes: Optional[List[EvangelizacaoAcaoItem]] = None
```

- [ ] **Step 3: Adicionar o campo em `ProjetoVidaMensalFull`**

Localizar:
```python
    reflexao_evangelizacao: Optional[str] = None
    has_new_structure: bool = False
```

Adicionar após `reflexao_evangelizacao`:
```python
    evangelizacao_acoes: Optional[List[EvangelizacaoAcaoItem]] = None
```

- [ ] **Step 4: Verificar que os schemas importam sem erro**

```bash
cd backend
python -c "from app.schemas.projeto_vida_mensal import ProjetoVidaMensalFull, ProjetoVidaMensalUpdate, EvangelizacaoAcaoItem; print('OK')"
```

Esperado: `OK`

- [ ] **Step 5: Commit**

```bash
git add backend/app/schemas/projeto_vida_mensal.py
git commit -m "feat(schema): add EvangelizacaoAcaoItem and evangelizacao_acoes field to PVM schemas"
```

---

### Task 4: Service TypeScript

**Files:**
- Modify: `lumen_mobile/src/services/projetoVidaMensal.ts`

- [ ] **Step 1: Adicionar a interface `EvangelizacaoAcaoItem`**

Localizar o bloco `// ── Tipos de itens estruturados` (linha ~33). Adicionar após `OutroItemCuidado`:

```typescript
export interface EvangelizacaoAcaoItem {
  descricao: string | null;
  como: string | null;
  duracao_min: number | null;
}
```

- [ ] **Step 2: Adicionar o campo em `ProjetoVidaMensalFull`**

Localizar:
```typescript
  reflexao_evangelizacao: string | null;
  created_at: string;
```

Adicionar após `reflexao_evangelizacao`:
```typescript
  evangelizacao_acoes?: EvangelizacaoAcaoItem[] | null;
```

- [ ] **Step 3: Verificar TypeScript**

```bash
cd lumen_mobile
npx tsc --noEmit
```

Esperado: sem erros relacionados a `EvangelizacaoAcaoItem`.

- [ ] **Step 4: Commit**

```bash
git add lumen_mobile/src/services/projetoVidaMensal.ts
git commit -m "feat(service): add EvangelizacaoAcaoItem type and evangelizacao_acoes field to ProjetoVidaMensalFull"
```

---

### Task 5: Wizard — Step 7 Redesign

**Files:**
- Modify: `lumen_mobile/app/vida/wizard.tsx`

Esta é a tarefa maior. Aplicar em sub-passos.

- [ ] **Step 1: Adicionar `EvangelizacaoAcaoItem` ao import do service**

Localizar:
```typescript
import projetoVidaMensalApi, {
  MESES,
  type CompromissoAreaItem, type AreaMensalIn,
  type ContextoVocacionalOut,
  type IntercessaoUpsert,
} from '@/services/projetoVidaMensal';
```

Substituir por:
```typescript
import projetoVidaMensalApi, {
  MESES,
  type CompromissoAreaItem, type AreaMensalIn,
  type ContextoVocacionalOut,
  type IntercessaoUpsert,
  type EvangelizacaoAcaoItem,
} from '@/services/projetoVidaMensal';
```

- [ ] **Step 2: Adicionar interface local `EvangelizacaoAcaoItemLocal`**

Localizar o bloco `// ── Tipos locais` (linha ~25). Adicionar antes de `interface AreaData`:

```typescript
interface EvangelizacaoAcaoItemLocal {
  descricao: string;
  como: string;
  duracao_min: string;
}
```

- [ ] **Step 3: Adicionar `evangelizacao_acoes` ao `WizardData`**

Localizar:
```typescript
interface WizardData {
  mes: string;
  ano: string;
  pin: string;
  intencao: string;
  reflexao_evangelizacao: string;
  intencoes_pessoais: string;
  intencoes_comunitarias: string;
  oferecimento: string;
  areas: Record<string, AreaData>;
}
```

Substituir por:
```typescript
interface WizardData {
  mes: string;
  ano: string;
  pin: string;
  intencao: string;
  reflexao_evangelizacao: string;
  evangelizacao_acoes: EvangelizacaoAcaoItemLocal[];
  intencoes_pessoais: string;
  intencoes_comunitarias: string;
  oferecimento: string;
  areas: Record<string, AreaData>;
}
```

- [ ] **Step 4: Inicializar `evangelizacao_acoes` no `defaultData`**

Localizar:
```typescript
const defaultData = (): WizardData => ({
  mes: String(now.getMonth() + 1),
  ano: String(now.getFullYear()),
  pin: '',
  intencao: '',
  reflexao_evangelizacao: '',
  intencoes_pessoais: '',
```

Adicionar `evangelizacao_acoes: [],` após `reflexao_evangelizacao: '',`:
```typescript
const defaultData = (): WizardData => ({
  mes: String(now.getMonth() + 1),
  ano: String(now.getFullYear()),
  pin: '',
  intencao: '',
  reflexao_evangelizacao: '',
  evangelizacao_acoes: [],
  intencoes_pessoais: '',
  intencoes_comunitarias: '',
  oferecimento: '',
  areas: {
    FAMILIA_VOCACIONAL:    { objetivo: '', compromissos: [], observacoes: '' },
    MINISTERIO_BOM_PASTOR: { objetivo: '', compromissos: [], observacoes: '' },
    GRUPO_FORMATIVO:       { objetivo: '', compromissos: [], observacoes: '' },
    SAUDE_LAZER:           { objetivo: '', compromissos: [], observacoes: '' },
    FAMILIA_ORIGEM:        { objetivo: '', compromissos: [], observacoes: '' },
  },
});
```

- [ ] **Step 5: Adicionar `evangelizacao_acoes` no payload de `handleSave`**

Localizar:
```typescript
      await projetoVidaMensalApi.update(projetoId, {
        reflexao_evangelizacao: data.reflexao_evangelizacao || null,
        areas: areasArray,
      });
```

Substituir por:
```typescript
      await projetoVidaMensalApi.update(projetoId, {
        reflexao_evangelizacao: data.reflexao_evangelizacao || null,
        evangelizacao_acoes: data.evangelizacao_acoes
          .filter(a => a.descricao.trim().length > 0)
          .map(a => {
            const n = parseInt(a.duracao_min, 10);
            return {
              descricao: a.descricao.trim(),
              como: a.como.trim() || null,
              duracao_min: Number.isFinite(n) && n >= 1 ? n : null,
            } as EvangelizacaoAcaoItem;
          }),
        areas: areasArray,
      });
```

- [ ] **Step 6: Substituir o conteúdo do case 7 (step 7) no render**

Localizar o bloco:
```typescript
      // ── Step 7: Evangelização Ser Feliz ─────────────────────────────────────
      case 7:
        return (
          <View style={{ padding: 20 }}>
            <View style={{ backgroundColor: '#f97316', borderRadius: 14, padding: 18, marginBottom: 20 }}>
              <Text style={{ fontSize: 11, fontFamily: 'Nunito-Bold' as const, color: 'rgba(255,255,255,0.8)', letterSpacing: 1, marginBottom: 6 }}>✦ COMUNHÃO COMUNITÁRIA</Text>
              <Text style={{ fontSize: 16, fontFamily: 'Nunito-Bold' as const, color: '#ffffff', marginBottom: 10 }}>Evangelização Ser Feliz</Text>
              <Text style={{ fontSize: 14, fontFamily: 'Nunito-Regular' as const, color: 'rgba(255,255,255,0.95)', lineHeight: 21 }}>
                Como você quer viver a Evangelização Ser Feliz neste mês? Quais pessoas estão no seu coração?
              </Text>
            </View>
            <Text style={{ fontSize: 13, fontFamily: 'Nunito-Bold' as const, color: t.text.secondary, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 8 }}>
              Reflexão e intenção
            </Text>
            <TextInput
              style={{
                backgroundColor: t.bg.surface,
                borderRadius: r.md,
                borderWidth: StyleSheet.hairlineWidth,
                borderColor: t.border.subtle,
                padding: 14,
                fontSize: 15,
                fontFamily: 'Nunito-Regular' as const,
                color: t.text.primary,
                minHeight: 120,
                textAlignVertical: 'top',
              }}
              value={data.reflexao_evangelizacao}
              onChangeText={v => update({ reflexao_evangelizacao: v })}
              multiline
              numberOfLines={4}
              placeholder="Escreva livremente sobre como quer estar presente para evangelizar neste mês..."
              placeholderTextColor={t.text.tertiary}
            />
          </View>
        );
```

Substituir pelo novo bloco:
```typescript
      // ── Step 7: Evangelização Ser Feliz ─────────────────────────────────────
      case 7:
        return (
          <View style={{ padding: 20 }}>
            {/* Bloco de abertura */}
            <View style={{ backgroundColor: '#f97316', borderRadius: 14, padding: 18, marginBottom: 20 }}>
              <Text style={{ fontSize: 11, fontFamily: 'Nunito-Bold' as const, color: 'rgba(255,255,255,0.8)', letterSpacing: 1, marginBottom: 6 }}>COMUNHÃO COMUNITÁRIA</Text>
              <Text style={{ fontSize: 16, fontFamily: 'Nunito-Bold' as const, color: '#ffffff', marginBottom: 10 }}>Evangelização Ser Feliz</Text>
              <Text style={{ fontSize: 14, fontFamily: 'Nunito-Regular' as const, color: 'rgba(255,255,255,0.95)', lineHeight: 22 }}>
                {'A Evangelização Ser Feliz é um chamado de comunhão: cada um de nós, no lugar onde está, oferece ao menos 15 minutos por dia à presença de Deus entre as pessoas. Esses minutos podem ser divididos — 5 de manhã, 5 à tarde, 5 à noite. Não é uma tarefa.\nÉ uma disponibilidade do coração.\n\nMas não pare nos 15 minutos. Deixe que Deus te surpreenda.\nQuais são as pessoas que Ele está colocando no seu caminho?\nQue ação concreta nasce do amor?'}
              </Text>
            </View>

            {/* Campo de reflexão (mantido) */}
            <Text style={{ fontSize: 13, fontFamily: 'Nunito-Bold' as const, color: t.text.secondary, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 8 }}>
              Reflexão sobre este mês
            </Text>
            <TextInput
              style={{
                backgroundColor: t.bg.surface,
                borderRadius: r.md,
                borderWidth: StyleSheet.hairlineWidth,
                borderColor: t.border.subtle,
                padding: 14,
                fontSize: 15,
                fontFamily: 'Nunito-Regular' as const,
                color: t.text.primary,
                minHeight: 100,
                textAlignVertical: 'top',
                marginBottom: 24,
              }}
              value={data.reflexao_evangelizacao}
              onChangeText={v => update({ reflexao_evangelizacao: v })}
              multiline
              numberOfLines={4}
              placeholder="Escreva livremente sobre como quer estar presente para evangelizar neste mês..."
              placeholderTextColor={t.text.tertiary}
            />

            {/* Lista de ações concretas */}
            <Text style={{ fontSize: 13, fontFamily: 'Nunito-Bold' as const, color: t.text.secondary, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 4 }}>
              Ações concretas
            </Text>
            <Text style={{ fontSize: 13, fontFamily: 'Nunito-Regular' as const, color: t.text.tertiary, marginBottom: 12 }}>
              O que você fará de concreto?
            </Text>

            {data.evangelizacao_acoes.map((acao, idx) => (
              <View
                key={idx}
                style={{
                  backgroundColor: t.bg.surface,
                  borderRadius: r.md,
                  borderWidth: StyleSheet.hairlineWidth,
                  borderColor: t.border.subtle,
                  padding: 14,
                  marginBottom: 12,
                }}
              >
                {/* O quê */}
                <Text style={{ fontSize: 12, fontFamily: 'Nunito-Bold' as const, color: t.text.secondary, marginBottom: 4 }}>O quê</Text>
                <TextInput
                  style={{
                    backgroundColor: t.bg.base,
                    borderRadius: 8,
                    borderWidth: StyleSheet.hairlineWidth,
                    borderColor: t.border.subtle,
                    padding: 10,
                    fontSize: 14,
                    fontFamily: 'Nunito-Regular' as const,
                    color: t.text.primary,
                    minHeight: 40,
                    marginBottom: 10,
                  }}
                  value={acao.descricao}
                  onChangeText={v => {
                    const updated = [...data.evangelizacao_acoes];
                    updated[idx] = { ...updated[idx], descricao: v };
                    update({ evangelizacao_acoes: updated });
                  }}
                  placeholder="Descrição da ação"
                  placeholderTextColor={t.text.tertiary}
                />

                {/* Como */}
                <Text style={{ fontSize: 12, fontFamily: 'Nunito-Bold' as const, color: t.text.secondary, marginBottom: 4 }}>Como</Text>
                <TextInput
                  style={{
                    backgroundColor: t.bg.base,
                    borderRadius: 8,
                    borderWidth: StyleSheet.hairlineWidth,
                    borderColor: t.border.subtle,
                    padding: 10,
                    fontSize: 14,
                    fontFamily: 'Nunito-Regular' as const,
                    color: t.text.primary,
                    minHeight: 40,
                    marginBottom: 10,
                  }}
                  value={acao.como}
                  onChangeText={v => {
                    const updated = [...data.evangelizacao_acoes];
                    updated[idx] = { ...updated[idx], como: v };
                    update({ evangelizacao_acoes: updated });
                  }}
                  placeholder="De que forma vai acontecer"
                  placeholderTextColor={t.text.tertiary}
                />

                {/* Quanto */}
                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 10 }}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 12, fontFamily: 'Nunito-Bold' as const, color: t.text.secondary, marginBottom: 4 }}>Quanto</Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                      <TextInput
                        style={{
                          backgroundColor: t.bg.base,
                          borderRadius: 8,
                          borderWidth: StyleSheet.hairlineWidth,
                          borderColor: t.border.subtle,
                          padding: 10,
                          fontSize: 14,
                          fontFamily: 'Nunito-Regular' as const,
                          color: t.text.primary,
                          width: 72,
                          textAlign: 'center',
                        }}
                        value={acao.duracao_min}
                        onChangeText={v => {
                          const updated = [...data.evangelizacao_acoes];
                          updated[idx] = { ...updated[idx], duracao_min: v };
                          update({ evangelizacao_acoes: updated });
                        }}
                        keyboardType="numeric"
                        placeholder="15"
                        placeholderTextColor={t.text.tertiary}
                      />
                      <Text style={{ fontSize: 14, fontFamily: 'Nunito-Regular' as const, color: t.text.secondary, marginLeft: 8 }}>min</Text>
                    </View>
                  </View>
                </View>

                {/* Remover */}
                <TouchableOpacity
                  onPress={() => {
                    const updated = data.evangelizacao_acoes.filter((_, i) => i !== idx);
                    update({ evangelizacao_acoes: updated });
                  }}
                  style={{ alignSelf: 'flex-end' }}
                >
                  <Text style={{ fontSize: 13, fontFamily: 'Nunito-Regular' as const, color: t.status.error }}>remover</Text>
                </TouchableOpacity>
              </View>
            ))}

            {/* Botão adicionar */}
            <TouchableOpacity
              onPress={() => {
                update({
                  evangelizacao_acoes: [
                    ...data.evangelizacao_acoes,
                    { descricao: '', como: '', duracao_min: '' },
                  ],
                });
              }}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                padding: 12,
                borderRadius: 10,
                borderWidth: 1.5,
                borderColor: t.brand.primary,
                borderStyle: 'dashed',
                marginBottom: 4,
              }}
            >
              <Text style={{ fontSize: 14, fontFamily: 'Nunito-SemiBold' as const, color: t.brand.primary }}>+ Adicionar ação</Text>
            </TouchableOpacity>
          </View>
        );
```

- [ ] **Step 7: Verificar TypeScript no wizard**

```bash
cd lumen_mobile
npx tsc --noEmit 2>&1 | grep wizard
```

Esperado: sem erros em `wizard.tsx`.

- [ ] **Step 8: Commit**

```bash
git add lumen_mobile/app/vida/wizard.tsx
git commit -m "feat(wizard): redesign step 7 — novo texto, lista de ações concretas evangelizacao"
```

---

### Task 6: Ciclo — Visualização de Ações

**Files:**
- Modify: `lumen_mobile/app/vida/ciclo.tsx`

- [ ] **Step 1: Localizar o bloco da seção Evangelização**

Localizar (linha ~131):
```typescript
          {/* Reflexão sobre Evangelização */}
          {projeto.reflexao_evangelizacao && (
            <Section title="Evangelização Ser Feliz" icon={'globe-outline' as IoniconsName} color={'#f97316'} t={t} r={r}>
              <Text style={{ fontSize: 14, fontFamily: 'Nunito-Regular', color: t.text.primary, lineHeight: 22 }}>
                {projeto.reflexao_evangelizacao}
              </Text>
            </Section>
          )}
```

- [ ] **Step 2: Substituir por versão que exibe reflexão + ações**

```typescript
          {/* Evangelização Ser Feliz */}
          {(projeto.reflexao_evangelizacao || (projeto.evangelizacao_acoes ?? []).length > 0) && (
            <Section title="Evangelização Ser Feliz" icon={'globe-outline' as IoniconsName} color={'#f97316'} t={t} r={r}>
              {projeto.reflexao_evangelizacao ? (
                <Text style={{ fontSize: 14, fontFamily: 'Nunito-Regular', color: t.text.primary, lineHeight: 22, marginBottom: (projeto.evangelizacao_acoes ?? []).length > 0 ? 12 : 0 }}>
                  {projeto.reflexao_evangelizacao}
                </Text>
              ) : null}
              {(projeto.evangelizacao_acoes ?? []).map((acao, idx) => (
                <View
                  key={idx}
                  style={{
                    backgroundColor: t.bg.surface,
                    borderRadius: r.md,
                    borderWidth: StyleSheet.hairlineWidth,
                    borderColor: t.border.subtle,
                    padding: 12,
                    marginBottom: 8,
                  }}
                >
                  <Text style={{ fontSize: 14, fontFamily: 'Nunito-Bold', color: t.text.primary, marginBottom: acao.como ? 4 : 0 }}>
                    {acao.descricao}
                  </Text>
                  {acao.como ? (
                    <Text style={{ fontSize: 13, fontFamily: 'Nunito-Regular', color: t.text.secondary, lineHeight: 20, marginBottom: acao.duracao_min != null ? 6 : 0 }}>
                      Como: {acao.como}
                    </Text>
                  ) : null}
                  {acao.duracao_min != null ? (
                    <View style={{ alignSelf: 'flex-start', backgroundColor: '#f97316', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 2 }}>
                      <Text style={{ fontSize: 12, fontFamily: 'Nunito-Bold', color: '#ffffff' }}>
                        {acao.duracao_min} min
                      </Text>
                    </View>
                  ) : null}
                </View>
              ))}
            </Section>
          )}
```

- [ ] **Step 3: Garantir que `StyleSheet` está importado em ciclo.tsx**

```bash
grep "StyleSheet" lumen_mobile/app/vida/ciclo.tsx | head -3
```

Se não aparecer no import de `react-native`, adicionar `StyleSheet` ao import existente.

- [ ] **Step 4: Verificar TypeScript no ciclo**

```bash
cd lumen_mobile
npx tsc --noEmit 2>&1 | grep ciclo
```

Esperado: sem erros em `ciclo.tsx`.

- [ ] **Step 5: Commit**

```bash
git add lumen_mobile/app/vida/ciclo.tsx
git commit -m "feat(ciclo): exibir acoes concretas de evangelizacao como cards"
```

---

### Task 7: Verificação final

- [ ] **Step 1: Rodar tsc completo**

```bash
cd lumen_mobile
npx tsc --noEmit
```

Esperado: zero erros.

- [ ] **Step 2: Verificar que o backend aceita o campo no payload**

```bash
cd backend
python -c "
from app.schemas.projeto_vida_mensal import ProjetoVidaMensalUpdate, EvangelizacaoAcaoItem
payload = ProjetoVidaMensalUpdate(
    evangelizacao_acoes=[
        EvangelizacaoAcaoItem(descricao='Conversa', como='Ouvindo', duracao_min=15)
    ]
)
print(payload.model_dump())
"
```

Esperado: dict com `evangelizacao_acoes` contendo a ação.

- [ ] **Step 3: Verificar que `ge=1` rejeita `duracao_min=0`**

```bash
cd backend
python -c "
from app.schemas.projeto_vida_mensal import EvangelizacaoAcaoItem
from pydantic import ValidationError
try:
    EvangelizacaoAcaoItem(duracao_min=0)
    print('FALHOU — deveria ter rejeitado 0')
except ValidationError:
    print('OK — 0 rejeitado')
"
```

Esperado: `OK — 0 rejeitado`

- [ ] **Step 4: Commit final se tudo OK**

```bash
git add -A
git commit -m "chore(cp8): verificacao final — todos os campos integrados"
```
