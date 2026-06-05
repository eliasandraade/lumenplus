# Checkpoint 2 — Login, Home e Tab Bar
**Data:** 2026-06-04  
**Status:** Aprovado pelo usuário

---

## Escopo

Redesign visual das telas de autenticação (login + register), Home e Tab Bar customizada.  
**Restrições hard:** zero alteração em lógica Firebase/API, rotas, stores, services, backend.

---

## 1. Login — "Vela em Catedral"

### Conceito visual
- Fundo base: `#0d1a2e` (primitives.blue[950])
- Gradiente teal suave emergindo do centro da tela (radial, não linear)
- Glow discreto atrás do ícone bússola — não neon, não saturado
- Sensação: luz irradiando na escuridão. Contemplativo, institucional
- Sem aparência de fintech, SaaS, banco digital ou gamer

### Valores transmitidos
1. Confiança
2. Acolhimento
3. Propósito
4. Espiritualidade discreta
5. Tecnologia madura

### Estrutura da tela
```
─────────────────────────────
  [Espaço topo + safe area]

  [Bússola com glow suave]
  LUMEN+
  "Mais Luz | Mais Encontro"

  ────────────────
  [Input: e-mail]
  [Input: senha + olho]
  [Esqueci a senha]  ← direita
  [Mensagem reset / erro inline]

  [Botão Entrar — teal, arredondado]

  ────────────────
  Não tem conta? Crie agora.
─────────────────────────────
```

### Componentes e tokens
- Inputs: fundo `rgba(255,255,255,0.08)`, borda `rgba(255,255,255,0.15)`, focus borda `teal[400]`
- Placeholder: `rgba(255,255,255,0.45)`
- Texto: `#ffffff`
- Botão Entrar: `brand.primary` (teal), Nunito-Bold, borderRadius `r.xl`
- Erro: `status.error` com bg `status.errorBg` em pill acima do botão
- Reset sucesso: `status.success` com ícone check

### Register
- Mantém a lógica multi-step intacta
- Aplica o mesmo fundo "Vela em Catedral" no step 1 (acima do dobra)
- Steps 2-4: fundo `bg.screen` normal para não cansar visualmente com steps longos

---

## 2. Home — "Membro primeiro"

### Conceito
A Home é acolhimento, não painel. O membro comum é o usuário primário.  
Admin/Coord ficam no final, discretos.

### Estrutura hierárquica

#### 1 — Hero de acolhimento (topo)
- Saudação personalizada: "Olá, [Nome]!"
- Realidade vocacional do perfil (se disponível)
- Versículo do dia integrado ao hero — não como card separado
- Fundo: gradiente suave `bg.screen → bg.elevated`
- Tom: contemplativo, não funcional

#### 2 — Área de Atenção (badges de urgência)
Visível apenas se houver itens pendentes:
- Avisos não lidos (com badge numérico)
- Convites pendentes
- Aprovações pendentes (se coordenador)
- Próximo retiro (se inscrito)
- Revisão de perfil pendente (se `profile_update_due`)

Cada item: card horizontal compacto com ícone colorido por tipo.

#### 3 — Vida Comunitária
Sempre visível:
- Avisos recentes (últimos 3, link "ver todos")
- Eventos (se existir endpoint)
- Retiros disponíveis (se `has_retreat_access` ou aberto)
- Canal (link para `/(tabs)/community`)

#### 4 — Área de Serviço
Somente para `hasAdminAccess`, `isCoordinator` ou `hasRetreatAccess`:
- Card admin: Administração → `/admin`
- Card coord: Minha Coordenação → `/coordinator`
- Card retiro: Ministério de Retiro → `/coordinator`

Visual: discreto, sem destaque excessivo. Role-appropriate colors dos tokens.

#### 5 — Rodapé espiritual
- Frase ou símbolo discreto da identidade da Obra
- Sem funcionalidade — só presença e pertencimento

### Tokens usados
- `t.bg.screen`, `t.bg.elevated`, `t.bg.surface`
- `t.text.primary`, `t.text.secondary`, `t.text.spiritual`
- `t.brand.primary`, `t.brand.admin`, `t.brand.coord`
- `t.accent.spiritual` (dourado) para o versículo
- Fonte: Nunito — saudação em ExtraBold, versículo em Italic

---

## 3. Tab Bar — Pill Flutuante Animado

### Conceito
Tab bar com indicador pill que desliza entre tabs usando spring animation.  
Funciona em web e mobile. Performance garantida via `react-native-reanimated`.

### Especificação visual

**Light mode:**
- Fundo: `bg.elevated` (branco elevado, sombra suave no topo)
- Pill ativo: `brand.primary` (teal)
- Ícone ativo: branco (`#ffffff`)
- Ícone inativo: `text.tertiary`
- Texto sempre visível, `font.size.xs` (11px), Nunito-Regular

**Dark mode:**
- Fundo: `#0d1a2e` (primitives.blue[950])
- Pill ativo: `brand.primary` (teal[400])
- Ícone ativo: branco off-white (`#e8f0f8`)
- Ícone inativo: `text.tertiary` (azul acinzentado)

### Animação
- Spring: `SPRING.snappy` (damping 15, stiffness 280) — suave mas responsivo
- Sem bounce exagerado
- O pill se move horizontalmente via `useSharedValue` + `withSpring`
- Ícones trocam entre outline e filled com fade rápido

### Arquitetura de navegação
A Tab Bar custom resolve o problema de escala: em vez de adicionar tabs indefinidamente, mantém 5 tabs fixas e usa navegação dentro das tabs para novos módulos:
- **Orações** → `service.tsx` (liturgia, bíblia acessível via botão interno)
- **Convites** → `community.tsx` (Canal + Inbox unificados futuramente)
- **Início** → `home.tsx` (hub de tudo)
- **Inbox** → `invites.tsx`
- **Perfil** → `profile.tsx` (Projeto de Vida, configurações)

Módulos futuros (Canal, Projeto de Vida, Retiros, Bíblia) entram como sub-rotas dentro das tabs existentes, não como novas tabs.

### Implementação
- Componente `CustomTabBar` substituindo `tabBarStyle` do Expo Tabs
- `tabBar` prop do `<Tabs>` recebe o componente custom
- `useBottomTabBarHeight()` para safe area no iOS
- Web: `height: 60px`, sem safe area padding extra

---

## Arquivos a serem alterados

| Arquivo | Tipo de mudança |
|---|---|
| `app/(auth)/login.tsx` | Redesign visual completo |
| `app/(auth)/register.tsx` | Fundo step 1 + tipografia |
| `app/(tabs)/home.tsx` | Redesign estrutural + useTheme |
| `app/(tabs)/_layout.tsx` | Tab bar custom |
| `src/components/ui/CustomTabBar.tsx` | **Novo** — pill animado |

---

## Restrições reafirmadas
- Zero alteração em: `handleLogin`, `handleForgotPassword`, `handleRegister`, Firebase calls, `router.replace/push`, `api.get/post`, stores, types
- Erros pré-existentes no typecheck (services/, rotas vida/) permanecem como estão
- Register: somente visuais nos steps — nenhuma lógica de validação ou step flow alterada
