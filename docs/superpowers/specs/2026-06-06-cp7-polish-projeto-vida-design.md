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

### Navegação

**De `semanal.tsx`:** após salvar (create ou update), navegar para `semanal-view` em vez de `ciclo`.

**De `ciclo.tsx`:** o botão atual "Projeto Semanal" muda para dois botões:
- "Ver semana" → `semanal-view`
- "Editar semana" → `semanal` (wizard)

Quando não há `semanalAtual`, mostrar apenas "Criar Projeto Semanal" → `semanal`.

### Layout

**Header:** título "Semana N", subtítulo com intervalo de datas (calculado a partir do número da semana e mês do projeto).

**Chips de dia:** sete chips horizontais (Seg–Dom). Chip ativo = dia selecionado. Dia padrão ao abrir: dia seguinte ao atual (`getDiaSeguinte()` igual ao `diario.tsx`).

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
│   navega para diario?semanalId=...              │
└────────────────────────────────────────────────┘
```

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
```

Validação ao sair do campo (`onBlur`): se valor não corresponder a `HH:MM` válido (hora 00–23, minuto 00–59), limpar o campo e exibir erro inline discreto ("Horário inválido").

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
