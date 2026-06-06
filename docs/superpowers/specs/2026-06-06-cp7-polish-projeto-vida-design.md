# CP7 — Polish UI do Projeto de Vida

**Data:** 2026-06-06  
**Status:** Aprovado — aguardando implementação  
**Origem:** Feedback do teste manual pós-deploy do PV 2.0  
**Tipo:** Frontend only — sem migration, sem endpoint novo

---

## Escopo

Cinco melhorias independentes identificadas no teste manual:

1. Tela de leitura do Projeto Semanal (view por dia)
2. Calendário mensal nos campos de data dos compromissos
3. Máscara HH:MM nos campos de horário
4. Texto orientador do Ministério Bom Pastor
5. Toggle Dark/Light na tela de Perfil

---

## 1. Tela de leitura do Projeto Semanal

### Arquivo novo

`lumen_mobile/app/vida/semanal-view.tsx`

### Rota

`/vida/semanal-view?semanalId=<id>&projetoId=<id>`

Registrar em `vida/_layout.tsx` com breadcrumb "Projeto Semanal".

### Enum interno de dias

```typescript
const DIAS_SEMANA = ['seg', 'ter', 'qua', 'qui', 'sex', 'sab', 'dom'] as const;
type DiaSemana = typeof DIAS_SEMANA[number];

const DIA_LABELS: Record<DiaSemana, string> = {
  seg: 'Segunda', ter: 'Terça',  qua: 'Quarta', qui: 'Quinta',
  sex: 'Sexta',   sab: 'Sábado', dom: 'Domingo',
};
const DIA_SHORT: Record<DiaSemana, string> = {
  seg: 'Seg', ter: 'Ter', qua: 'Qua', qui: 'Qui',
  sex: 'Sex', sab: 'Sáb', dom: 'Dom',
};
```

Usar o mesmo enum no `diario.tsx` (já definido lá como constante local — manter consistência).

### Dia padrão ao abrir

```typescript
function getDiaPadrao(): DiaSemana {
  return DIAS_SEMANA[(new Date().getDay() + 1) % 7];
}
```

`getDay()` retorna 0 (dom) a 6 (sáb). `(getDay() + 1) % 7` mapeia para o dia seguinte no ciclo dom→seg→...→sáb→dom, alinhado com a ordem do array `DIAS_SEMANA` que começa em `seg` (índice 0). Resultado: se hoje é sexta (5), abre em sábado (índice 5 = 'sab'). Sem exceção — o fallback é sempre o dia seguinte, inclusive no domingo (abre segunda).

### Navegação

**De `semanal.tsx`:** após salvar (create ou update), navegar para `semanal-view` em vez de `ciclo`.

**De `ciclo.tsx`:** o botão atual "Projeto Semanal" muda para dois botões:
- "Ver semana" → `semanal-view`
- "Editar semana" → `semanal` (wizard)

Quando não há `semanalAtual`, mostrar apenas "Criar Projeto Semanal" → `semanal`.

### Layout

**Header:** título "Semana N", subtítulo com intervalo de datas (calculado a partir do número da semana e mês do projeto).

**Chips de dia:** sete chips horizontais na ordem `DIAS_SEMANA`. Chip ativo = dia selecionado.

**Conteúdo do dia selecionado:**

```
┌─ Práticas planejadas ──────────────────────────┐
│ Extraídas de vida_interior[prática].dias        │
│ Exibe somente as que incluem o dia ativo        │
│ Formato: "Missa — 07:00" / "Terço"             │
│ Se nenhuma: "Nenhuma prática para este dia"     │
└────────────────────────────────────────────────┘

┌─ Amanhã com o Emanuel ─────────────────────────┐
│ Extraído de plano_diario[dia]                   │
│ Campos exibidos apenas se preenchidos:          │
│   • Propósito                                   │
│   • Missa + horário                             │
│   • Oração da manhã                             │
│   • Lectio Divina                               │
│   • Terço (ícone check se true)                 │
│   • Leitura Espiritual                          │
│   • Evangelização                               │
│ Se vazio: botão "Planejar este dia" →           │
│   navega para /vida/diario?semanalId=...&dia=<diaAtivo> │
└────────────────────────────────────────────────┘
```

**Navegação para `diario`:** passa `dia` como parâmetro de rota para que `diario.tsx` abra diretamente no dia correto, sem depender do cálculo `getDiaSeguinte()`.

`diario.tsx` lê `dia` de `useLocalSearchParams` se presente; caso ausente, usa `getDiaSeguinte()` como fallback.

**Rodapé:** botão "Editar Semana" → `semanal?projetoId=...`

### Dados

Chamar `projetoVidaMensalApi.getSemanal(semanalId)` uma vez ao montar. Sem re-fetch ao trocar de dia (tudo em memória).

### Estados de erro

- `semanalId` ausente: mensagem clara + botão "Voltar"
- Erro no fetch: mensagem inline + botão "Tentar novamente"

---

## 2. Calendário mensal nos compromissos

### Componente novo

`lumen_mobile/src/components/ui/CalendarPicker.tsx`

Sem nova dependência — implementação própria.

### Aparência

Modal com grade mensal:
- Setas `‹` e `›` para navegar entre meses
- Grade 7×6 com dias do mês
- Dia selecionado: fundo `t.brand.primary`
- Dias de outros meses: opacidade 0.3
- Hoje: borda sutil `t.brand.primary`

### Interface do componente

```typescript
interface CalendarPickerProps {
  value: string;          // "DD/MM/YYYY" ou ""
  onChange: (v: string) => void;
  label?: string;
  mes?: number;           // Mês inicial (1-12), default: mês atual
  ano?: number;
}
```

### Integração em `wizard.tsx`

Substituir o `TextInput` do campo `data` em `CompromissoAreaItem` por um `TouchableOpacity` que abre o `CalendarPicker`. Exibir a data selecionada como texto; placeholder "Selecionar data" quando vazio.

Mês inicial: mês do ciclo sendo criado/editado.

**Datas fora do mês do ciclo:** permitidas. O picker não restringe a seleção ao mês do ciclo — compromissos podem ocorrer antes ou depois (ex.: retiro agendado para o mês seguinte). O picker inicia no mês do ciclo por conveniência, mas o usuário pode navegar livremente.

---

## 3. Máscara HH:MM

### Localização

Todos os `TextInput` com `placeholder` contendo "horário" ou "HH:MM" no `wizard.tsx`, `semanal.tsx` e `diario.tsx`.

### Comportamento

```typescript
function formatarHorario(raw: string): string {
  const digits = raw.replace(/\D/g, '').slice(0, 4);
  if (digits.length <= 2) return digits;
  return `${digits.slice(0, 2)}:${digits.slice(2)}`;
}

function horarioValido(v: string): boolean {
  if (!/^\d{2}:\d{2}$/.test(v)) return false;
  const [h, m] = v.split(':').map(Number);
  return h >= 0 && h <= 23 && m >= 0 && m <= 59;
}
```

**Formatação em tempo real (`onChangeText`):** aplica `formatarHorario` a cada keystroke, aceitando só dígitos.

**Validação no blur (`onBlur`):** se o valor não passa `horarioValido`, limpar o campo (setar para `''`) e exibir mensagem de erro inline abaixo do input: "Horário inválido — use o formato HH:MM (ex.: 07:30)". A mensagem desaparece assim que o usuário volta a editar o campo.

**Casos explícitos:**
- `""` → válido (campo opcional, não validar vazio)
- `"07"` → inválido no blur (incompleto)
- `"25:00"` → inválido (hora fora do range)
- `"07:60"` → inválido (minuto fora do range)
- `"07:30"` → válido

Props adicionais: `keyboardType="numeric"`, `maxLength={5}`.

---

## 4. Copy — Ministério Bom Pastor

### Localização

`lumen_mobile/app/vida/wizard.tsx`, prop `descricaoOrientadora` do step `MINISTERIO_BOM_PASTOR`.

### Texto atual

> "Seu serviço e missão apostólica. Liste atividades pastorais, atendimentos e compromissos de serviço que você assume neste mês."

### Texto novo

> "O Ministério Bom Pastor é o coração apostólico do seu caminho. Registre o dia do seu encontro de acompanhamento — esse compromisso é sagrado. Se você também é acompanhador, registre os dias em que estará presente para os seus acompanhados."

Sem alteração na estrutura do formulário.

---

## 5. Toggle Dark/Light no Perfil

### Localização

`lumen_mobile/app/(tabs)/profile.tsx` — nova seção antes do rodapé de privacidade.

### UI

Card simples com dois botões lado a lado:

```
┌─ Aparência ──────────────────────────────────┐
│  [ Claro ]        [ Escuro ]                 │
│   ← ativo                                    │
└──────────────────────────────────────────────┘
```

Botão ativo: fundo `t.brand.primaryDim`, borda `t.brand.primary`, texto `t.brand.primary`.  
Botão inativo: fundo `t.bg.surface`, texto `t.text.secondary`.

Usa `setTheme('light')` / `setTheme('dark')` do `useTheme()`.  
Preferência já persiste via `AsyncStorage` — sem mudança no ThemeContext.

---

## Arquivos afetados

| Arquivo | Mudança |
|---------|---------|
| `app/vida/semanal-view.tsx` | **Criado** |
| `app/vida/_layout.tsx` | Adicionar Screen `semanal-view` |
| `app/vida/semanal.tsx` | Redirecionar para `semanal-view` após salvar |
| `app/vida/ciclo.tsx` | Substituir botão "Projeto Semanal" por "Ver semana" + "Editar semana" |
| `src/components/ui/CalendarPicker.tsx` | **Criado** |
| `app/vida/wizard.tsx` | Integrar CalendarPicker + máscara HH:MM + copy Bom Pastor |
| `app/vida/semanal.tsx` | Máscara HH:MM nos campos de horário |
| `app/vida/diario.tsx` | Máscara HH:MM no campo `horario_missa` |
| `app/(tabs)/profile.tsx` | Seção de toggle de tema |

---

## Restrições

- Sem dependência nova de calendário
- Sem Alert.alert
- Sem emojis
- Tom contemplativo preservado nos textos
- Sem métricas ou contadores
