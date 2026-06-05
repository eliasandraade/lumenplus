# Checkpoint 3 — Projeto de Vida: "Caderno de Oração"
**Data:** 2026-06-04  
**Status:** Aprovado pelo usuário

---

## Conceito visual

**"Caderno de Oração"** — a sensação de abrir um diário espiritual. Papel, silêncio, escrita contemplativa. Não dashboard, não checklist, não app de produtividade.

- **Light mode:** fundo `bg.spiritual` (`#fefcf5` — creme quente), tipografia acolhedora, espaçamento generoso
- **Dark mode:** fundo `blue[950]` (`#0d1a2e`) — oração noturna, dourado suavizado sobre o azul profundo

---

## Restrições invioláveis

- Zero alteração em lógica, handlers, useEffect, useState
- Zero alteração em `projetoVidaMensalApi.*` calls
- Zero alteração em tipos (`ProjetoVidaMensalFull`, `CompromissoIn`, etc.)
- Zero alteração em `src/data/vida.ts`
- Zero alteração em rotas ou parâmetros de navegação
- `vida/_layout.tsx` não é tocado (já usa BreadcrumbHeader atualizado no CP1)
- Redesign visual apenas

---

## Ajustes aprovados sobre o mini-spec inicial

### 1. Privacidade mais presente (Hub + Unlock)
- No Hub: aviso de privacidade não é um banner de rodapé genérico — é um bloco com presença discreta mas digna. Linguagem: "Tudo o que você escrever fica guardado apenas para você." Ícone `shield-checkmark` em `brand.primary`, sem alarmismo.
- No Unlock: reforçar o contexto de proteção pessoal antes do campo de PIN. Frase: "Este ciclo está protegido por você. Digite seu PIN para continuar." Tom: confiança e recolhimento, não segurança bancária.

### 2. Indicadores de progresso — "caminho percorrido"
- Os 4 `StatItem` (Comunidade, Cuidado, Compromissos, Oração) não são checkboxes nem KPIs.
- Visual: ícone preenchido/outline, label em texto discreto, sem barras de progresso percentual.
- Preenchido = `accent.spiritual` (dourado suave) ou `brand.primary` (teal). Não verde de "meta batida".
- Não preenchido = `text.tertiary` sem julgamento visual (não cinza pesado, não ✗).
- Título da seção: "Como está o seu ciclo" em vez de "Progresso" ou "Status".

### 3. Ato de Contrição — bloco espiritual especial
- Não é um formulário com TextInput para edição.
- Bloco de exibição: fundo `bg.spiritual`, borda esquerda `accent.spiritual` (3px dourado), padding generoso (20px).
- Tipografia: `Nunito-Italic`, `text.spiritual`, `fontSize: 15`, `lineHeight: 26`.
- Dark mode: garantir contraste — `text.spiritual` no dark é `primitives.teal[300]` (legível sobre `blue[950]`).
- Abaixo do texto: área de confirmação com toggle/checkbox acessível.
- Espaçamento: 24px acima e abaixo do bloco para "respirar".

### 4. Estados vazios — linguagem acolhedora e espiritualmente sóbria
- Hub (sem ciclo): "Este mês ainda não tem um ciclo. Que tal começar em oração?"
- Histórico (lista vazia): "Você ainda não registrou nenhum ciclo. O primeiro passo é sempre o mais sagrado."
- Seções do ciclo (não preenchidas): "Ainda não preenchido neste ciclo." (sem tom de cobrança)
- Histórico item: sem texto "nenhum item encontrado"

---

## Especificação por tela

### `vida/index.tsx` — Hub

**Estrutura:**
1. Header contemplativo: ícone `compass-outline` em `brand.primary`, título "Projeto de Vida" em `Nunito-ExtraBold`, mês atual em `Nunito-Regular` `text.tertiary`
2. Bloco de recomendação espiritual: borda esquerda `accent.spiritual`, fundo `bg.spiritual`, texto em `Nunito-Italic`, ícone `sparkles` dourado
3. Se projeto existe: card do ciclo com título, "Como está o seu ciclo" + 4 indicadores de caminho, botão "Ver ciclo completo"
4. Se projeto existe e não concluído: botão "Revisão Mensal" em `brand.primary`
5. Se não existe: estado vazio acolhedor (ver acima) + botão "Iniciar novo ciclo"
6. Bloco de privacidade: discreto, com `shield-checkmark`, linguagem de confiança
7. Link "Ver histórico" no rodapé com ícone `time-outline`

**Tokens principais:** `t.bg.spiritual`, `t.accent.spiritual`, `t.text.spiritual`, `t.brand.primary`, `r.lg`, `r.xl`

---

### `vida/wizard.tsx` — Wizard 8 passos

**Progressão visual:**
- Barra linear: `width: (step/7) * 100%`, fundo `brand.primary`, altura 3px, `borderRadius: full`
- Contador: "Passo 1 de 8" em `text.tertiary`, `Nunito-Regular`, `fontSize: 12`
- Não usar dots pequenos

**Step 0 — Início:**
- Texto de abertura contemplativo, espaçamento generoso
- Frase de boas-vindas espiritual em `Nunito-Italic`
- Botão "Começar" centralizado

**Steps 2–6 — Formulários:**
- Label em `Nunito-SemiBold` `text.primary`, `fontSize: 14`
- Inputs: fundo `bg.surface`, borda `border.subtle`, `borderRadius: r.lg`, `fontFamily: Nunito-Regular`
- Placeholders: `text.tertiary`

**Step 6 — PIN (criação):**
- Contexto positivo: "Defina um PIN para proteger seu ciclo (opcional)"
- 4 dots com animação de preenchimento

**Step 7 — Confirmar:**
- Resumo limpo antes de salvar
- Botão "Criar meu ciclo" (não "Salvar" genérico)

**Navegação:**
- "← Anterior" ghost à esquerda, "Próximo →" primary à direita
- Ambos com `minHeight: 48` para toque confortável

---

### `vida/ciclo.tsx` — Ciclo completo

**Header:** mês + ano em `Nunito-ExtraBold`, badge "Ciclo concluído" em verde com `checkmark-circle`

**Seções** (Comunidade, Cuidado, Compromissos, Oração, Diagnóstico):
- Header de seção: `View` horizontal com ícone colorido + título `Nunito-Bold` + linha separadora suave
- Conteúdo: label → valor em hierarquia clara
- Estado vazio: "Ainda não preenchido neste ciclo." em `text.tertiary`, `Nunito-Italic`

**Cores de seção** (discretas, não gritantes):
- Comunidade: `brand.primary` (teal)
- Cuidado: `status.success` (verde)
- Compromissos: `brand.secondary` (dourado)
- Oração: `accent.spiritual` (dourado suave)

---

### `vida/revisao.tsx` — Revisão mensal

**Step 0 — Questões:**
- Título da questão: `Nunito-SemiBold`, `text.primary`, `fontSize: 15`
- Descrição/exemplo: `Nunito-Italic`, `text.tertiary`, `fontSize: 13`, `lineHeight: 20` — visualmente separado
- TextInput: `minHeight: 120`, `textAlignVertical: 'top'`, `bg.surface`, `borderRadius: r.lg`

**Step 1 — Ato de Contrição:**
- Bloco espiritual com borda esquerda `accent.spiritual` (3px), fundo `bg.spiritual`
- Texto da oração: `Nunito-Italic`, `text.spiritual`, `fontSize: 15`, `lineHeight: 26`
- Padding: 20px interno, 24px de margem vertical externa
- Dark mode: `text.spiritual = primitives.teal[300]` — garantido legível sobre `blue[950]`
- Abaixo: confirmação acessível

**Step 2 — Concluído:**
- Ícone `checkmark-circle` verde grande (56px)
- Frase de encorajamento espiritual (não "Parabéns!" genérico)
- Botão "Iniciar próximo ciclo" e link "Voltar ao início"

---

### `vida/historico.tsx` — Histórico

- Fundo `bg.screen`, lista com cards `bg.elevated`
- Mês em `Nunito-Bold` `text.primary`, ano em `text.tertiary`
- Badge "Concluído": teal suave `brand.primaryDim` + texto `brand.primary`
- Cadeado: `lock-closed` em `text.tertiary`, discreto
- Estado vazio: linguagem acolhedora (ver acima) + ícone `compass-outline`

---

### `vida/unlock.tsx` — PIN

- Card centralizado: `bg.elevated`, `borderRadius: r.xl`, sombra suave
- Ícone `lock-closed` em `brand.primary`, halo `brand.primaryDim`
- Frase de contexto de privacidade e confiança
- 4 dots: 24px × 24px, `borderRadius: 12`, preenchimento `brand.primary`
- Input numérico oculto (mantém lógica atual intacta)
- Erro: ícone `alert-circle` + texto (não só cor)
- Botão "Desbloquear": `brand.primary`, `minHeight: 52`

---

## Tokens principais (todos existentes em tokens.ts)

| Token | Light | Dark | Uso |
|---|---|---|---|
| `t.bg.spiritual` | `#fefcf5` | `blue[900]` | fundo de seções contemplativas |
| `t.text.spiritual` | `blue[700]` | `teal[300]` | textos de orações e reflexões |
| `t.accent.spiritual` | `gold[500]` | `gold[400]` | bordas de blocos espirituais |
| `t.bg.elevated` | `neutral[50]` | `blue[850]` | cards principais |
| `t.bg.surface` | `neutral[100]` | `blue[800]` | inputs e fundos internos |
| `t.brand.primary` | `teal[500]` | `teal[400]` | ações principais |
| `t.brand.primaryDim` | `#e6f4f7` | `rgba(teal, 0.15)` | badges e halos |

---

## Arquivos a alterar

| Arquivo | Tipo |
|---|---|
| `lumen_mobile/app/vida/index.tsx` | Redesign visual + useTheme |
| `lumen_mobile/app/vida/wizard.tsx` | Redesign visual + useTheme |
| `lumen_mobile/app/vida/ciclo.tsx` | Redesign visual + useTheme |
| `lumen_mobile/app/vida/revisao.tsx` | Redesign visual + useTheme |
| `lumen_mobile/app/vida/historico.tsx` | Redesign visual + useTheme |
| `lumen_mobile/app/vida/unlock.tsx` | Redesign visual + useTheme |

**Não alterados:** `vida/_layout.tsx`, `src/data/vida.ts`, `src/services/projetoVidaMensal.ts`
