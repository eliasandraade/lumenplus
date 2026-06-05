# Redesign Frontend Lumen+ — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task.
>
> **Design context:** `.impeccable.md` na raiz do projeto.

**Goal:** Redesign completo do frontend — tipografia Nunito, dark mode azul profundo, animações spring com react-native-reanimated, design system coeso. Mesmas cores, nova alma.

**Architecture:** ThemeContext centralizado com `useTheme()` hook, tokens de design em camadas (primitives → semantic → component), animações via Reanimated Layout Animations + hooks reutilizáveis. Web-first (Expo Router), sem Alert.alert.

**Tech Stack:** React Native + Expo SDK 52, react-native-reanimated (já instalado), expo-font, Expo Router 4, StyleSheet.

---

## Direção Visual

### Identidade
- **Personalidade:** Comunitário · Caloroso · Vivo
- **Referência:** Duolingo / BeReal — personalidade forte, animações expressivas, não corporativo
- **Tom:** Acolhimento com vitalidade. Nunca solene demais.

### Tipografia — Nunito (Google Fonts)
```
Display/Hero:    Nunito 800  (ExtraBold)
Títulos H1-H2:  Nunito 700  (Bold)
Labels/CTA:     Nunito 600  (SemiBold)
Corpo:          Nunito 400  (Regular)
Legenda/Meta:   Nunito 400  (Regular, opacity 0.6)
```
Conteúdo espiritual (versículos, reflexões): `Nunito 400 italic` — diferencia sem mudar família.

### Paleta — Light Mode
```
Primária:  #1A859B  (teal — confiança, água viva)
Dourado:   #E6AC00  (ouro — luz divina)
Admin:     #7C3AED  (roxo — autoridade)
Success:   #22c55e
Background: #ffffff / #f7f9fc / #eef2f7
Text:      #0f1923 / #3d5166 / #7a90a4
```

### Paleta — Dark Mode
```
Fundo principal: #0d1a2e  (azul profundo — oração noturna)
Fundo elevado:   #122338  (cards, headers)
Fundo surface:   #1a2f4a  (inputs, modais)
Borda sutil:     #1e3a5a  (separadores)
Texto primário:  #e8f0f8
Texto secundário:#7fa3c0
Primária:        #2da8c0  (teal mais claro no escuro)
Dourado:         #ffc61a  (mais vivo no escuro)
```

### Animações — Spring Physics
```typescript
// Configurações reutilizáveis
SPRING_GENTLE = { damping: 20, stiffness: 150 }   // cards, modais
SPRING_SNAPPY = { damping: 15, stiffness: 250 }    // botões, tabs
SPRING_SLOW   = { damping: 25, stiffness: 80 }     // overlays, sidesheets
```
- **Listas:** FadeInDown staggerado (delay de 50ms por item, máx 5 items)
- **Telas:** FadeIn na montagem do ScrollView/FlatList
- **Botões:** scale 0.95 no press, volta com spring
- **Cards:** SlideInDown leve na primeira carga
- **Tab bar:** scale 1.15 + translateY -2 no item ativo

---

## File Map

### Novos
| Arquivo | Responsabilidade |
|---|---|
| `src/theme/tokens.ts` | Primitives + semantic tokens (light + dark) |
| `src/theme/ThemeContext.tsx` | Provider + `useTheme()` hook + toggle |
| `src/hooks/useAnimations.ts` | Spring configs, stagger helper, pressable hook |
| `src/components/ui/AnimatedList.tsx` | FlatList/ScrollView com stagger entrada |
| `src/components/ui/PressableScale.tsx` | Wrapper de pressable com scale spring |
| `src/components/ui/SkeletonLoader.tsx` | Skeleton shimmer animado |

### Modificados (design system)
| Arquivo | O que muda |
|---|---|
| `src/theme/index.ts` | Re-exporta de tokens.ts + mantém compat |
| `src/components/ui/Button.tsx` | Nunito, scale press, variantes dark/light |
| `src/components/ui/Card.tsx` | Bordas suaves, sombra tingida, dark-aware |
| `src/components/ui/Input.tsx` | Foco animado, label flutuante, dark-aware |
| `src/components/ui/Loading.tsx` | Spinner com cor do tema |
| `app/_layout.tsx` | Carrega Nunito + ThemeProvider + StatusBar adaptivo |
| `app/(tabs)/_layout.tsx` | Tab bar customizada — Nunito, scale animation |

### Modificados (telas — todas)
Cada tela recebe: `useTheme()` para cores, Nunito via styles, animações de entrada.

**Grupo 1 — Autenticação** (login.tsx, register.tsx, verify-email.tsx, verify-phone.tsx)
**Grupo 2 — Tabs** (home.tsx, profile.tsx, community.tsx, service.tsx, invites.tsx)
**Grupo 3 — Vida** (index.tsx, wizard.tsx, revisao.tsx, historico.tsx, ciclo.tsx)
**Grupo 4 — Canal** (channel/[unitId].tsx)
**Grupo 5 — Ministério** (members.tsx, coordinator/index.tsx)
**Grupo 6 — Retiros** (retreats/index.tsx, [id].tsx, payment.tsx)
**Grupo 7 — Bíblia + Catecismo** (biblia/index.tsx, reader.tsx, catecismo/*)
**Grupo 8 — Admin** (admin/index.tsx, dashboard.tsx, create-aviso.tsx, users/*, entities/*, sent-avisos.tsx)
**Grupo 9 — Onboarding** (profile.tsx, terms.tsx, complete-documents.tsx)

---

## Tasks

### Task 1: Design System Foundation

**Files:**
- Create: `lumen_mobile/src/theme/tokens.ts`
- Create: `lumen_mobile/src/theme/ThemeContext.tsx`
- Create: `lumen_mobile/src/hooks/useAnimations.ts`
- Modify: `lumen_mobile/src/theme/index.ts`

**tokens.ts** — primitives + semantic tokens light/dark:
```typescript
export const primitives = {
  teal: { 300: '#5cc8de', 400: '#2da8c0', 500: '#1A859B', 600: '#136e80', 700: '#0d5263' },
  gold: { 300: '#ffd24d', 400: '#ffc61a', 500: '#E6AC00', 600: '#b38600' },
  purple: { 400: '#9d5cf5', 500: '#7C3AED', 600: '#5b21b6' },
  blue: {
    950: '#0d1a2e', 900: '#0f1f38', 850: '#122338', 800: '#1a2f4a',
    700: '#1e3a5a', 600: '#2a4f74', 400: '#4a7fa0', 200: '#7fa3c0',
  },
  neutral: {
    0: '#ffffff', 50: '#f7f9fc', 100: '#eef2f7', 200: '#dde6ef',
    300: '#b8cdd9', 400: '#7a90a4', 500: '#3d5166', 900: '#0f1923',
  },
  green: { main: '#22c55e', dark: '#15803d' },
  red: { main: '#ef4444', dark: '#b91c1c' },
  amber: { main: '#f59e0b' },
};

export type ColorScheme = 'light' | 'dark';

export const semantic = {
  light: {
    bg: { screen: primitives.neutral[0], elevated: primitives.neutral[50], surface: primitives.neutral[100], overlay: 'rgba(0,0,0,0.4)' },
    border: { subtle: primitives.neutral[200], default: primitives.neutral[300] },
    text: { primary: primitives.neutral[900], secondary: primitives.neutral[500], tertiary: primitives.neutral[400], inverse: primitives.neutral[0], spiritual: primitives.blue[600] },
    brand: { primary: primitives.teal[500], primaryLight: primitives.teal[300], secondary: primitives.gold[500], admin: primitives.purple[500] },
    status: { success: primitives.green.main, error: primitives.red.main, warning: primitives.amber.main },
    shadow: { color: primitives.teal[700], opacity: 0.08 },
  },
  dark: {
    bg: { screen: primitives.blue[950], elevated: primitives.blue[850], surface: primitives.blue[800], overlay: 'rgba(0,0,0,0.7)' },
    border: { subtle: primitives.blue[700], default: primitives.blue[600] },
    text: { primary: '#e8f0f8', secondary: primitives.blue[200], tertiary: '#4a6580', inverse: primitives.blue[950], spiritual: primitives.teal[300] },
    brand: { primary: primitives.teal[400], primaryLight: primitives.teal[300], secondary: primitives.gold[400], admin: primitives.purple[400] },
    status: { success: primitives.green.main, error: primitives.red.main, warning: primitives.amber.main },
    shadow: { color: '#000000', opacity: 0.4 },
  },
} as const;

export type SemanticTokens = typeof semantic.light;
```

**ThemeContext.tsx:**
```typescript
import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useColorScheme } from 'react-native';
import { semantic, SemanticTokens, ColorScheme } from './tokens';

const THEME_KEY = 'lumen_theme_preference';

interface ThemeContextValue {
  scheme: ColorScheme;
  t: SemanticTokens;            // tokens semânticos do tema atual
  isDark: boolean;
  toggleTheme: () => void;
  setTheme: (scheme: ColorScheme) => void;
}

const ThemeContext = createContext<ThemeContextValue>({} as ThemeContextValue);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const systemScheme = useColorScheme() ?? 'light';
  const [scheme, setSchemeState] = useState<ColorScheme>(systemScheme);

  useEffect(() => {
    AsyncStorage.getItem(THEME_KEY).then((saved) => {
      if (saved === 'light' || saved === 'dark') setSchemeState(saved);
    });
  }, []);

  const setTheme = (s: ColorScheme) => {
    setSchemeState(s);
    AsyncStorage.setItem(THEME_KEY, s);
  };

  const toggleTheme = () => setTheme(scheme === 'light' ? 'dark' : 'light');

  return (
    <ThemeContext.Provider value={{
      scheme,
      t: semantic[scheme],
      isDark: scheme === 'dark',
      toggleTheme,
      setTheme,
    }}>
      {children}
    </ThemeContext.Provider>
  );
}

export const useTheme = () => useContext(ThemeContext);
```

**useAnimations.ts:**
```typescript
import { useSharedValue, useAnimatedStyle, withSpring, withTiming } from 'react-native-reanimated';

export const SPRING = {
  gentle: { damping: 20, stiffness: 150 },
  snappy: { damping: 15, stiffness: 250 },
  slow:   { damping: 25, stiffness: 80 },
} as const;

// Para stagger em listas
export function useStaggerDelay(index: number, maxIndex = 5) {
  return Math.min(index, maxIndex) * 50;
}

// Para botões com scale press
export function usePressableScale(scaleTo = 0.95) {
  const scale = useSharedValue(1);
  const style = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  const onPressIn = () => { scale.value = withSpring(scaleTo, SPRING.snappy); };
  const onPressOut = () => { scale.value = withSpring(1, SPRING.snappy); };
  return { style, onPressIn, onPressOut };
}

// Para fade + slide de entrada
export function useEntranceAnimation(delay = 0) {
  const opacity = useSharedValue(0);
  const translateY = useSharedValue(12);
  const style = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }],
  }));
  useEffect(() => {
    const t = setTimeout(() => {
      opacity.value = withTiming(1, { duration: 300 });
      translateY.value = withSpring(0, SPRING.gentle);
    }, delay);
    return () => clearTimeout(t);
  }, []);
  return style;
}
```

Commit: `feat(design): tokens semânticos light/dark, ThemeContext, useAnimations`

---

### Task 2: Font Loading + App Layout

**Files:**
- Modify: `lumen_mobile/app/_layout.tsx`

Carregar Nunito via `expo-font` + `useFonts` antes de qualquer tela. Envolver com `ThemeProvider`. Adaptar `StatusBar` ao tema.

```typescript
import { useFonts } from 'expo-font';
import { ThemeProvider } from '@/src/theme/ThemeContext';
import { StatusBar } from 'expo-status-bar';
import { useTheme } from '@/src/theme/ThemeContext';
```

**Fontes via `@expo-google-fonts/nunito`** (instalar):
```bash
npx expo install @expo-google-fonts/nunito
```

Configuração no `_layout.tsx`:
```typescript
const [fontsLoaded] = useFonts({
  'Nunito-Regular':    Nunito_400Regular,
  'Nunito-Italic':     Nunito_400Regular_Italic,
  'Nunito-SemiBold':   Nunito_600SemiBold,
  'Nunito-Bold':       Nunito_700Bold,
  'Nunito-ExtraBold':  Nunito_800ExtraBold,
});
```

Commit: `feat(design): Nunito carregado, ThemeProvider, StatusBar adaptivo`

---

### Task 3: Componentes UI — Button, Card, Input, Loading

**Files:**
- Modify: `lumen_mobile/src/components/ui/Button.tsx`
- Modify: `lumen_mobile/src/components/ui/Card.tsx`
- Modify: `lumen_mobile/src/components/ui/Input.tsx`
- Modify: `lumen_mobile/src/components/ui/Loading.tsx`
- Create: `lumen_mobile/src/components/ui/PressableScale.tsx`
- Create: `lumen_mobile/src/components/ui/SkeletonLoader.tsx`

**Button** — variantes: `primary` (teal filled), `secondary` (gold outlined), `ghost` (text only), `danger` (red). Scale spring no press. Nunito SemiBold. Ícone opcional à esquerda.

**Card** — `elevated` vs `outlined`. Borda suave, sombra tingida da cor primária (opacity 0.08 light / 0.4 dark). Nunca `Card` dentro de `Card`.

**Input** — borda animada no foco (cor primária), label Nunito 600, erro inline.

**PressableScale** — wrapper genérico para qualquer elemento que precisa de scale feedback.

**SkeletonLoader** — shimmer via `useSharedValue` + gradient animado (sem libs externas).

Commit: `feat(design): componentes UI redesenhados — Button, Card, Input, Skeleton`

---

### Task 4: Tab Bar Customizada

**Files:**
- Modify: `lumen_mobile/app/(tabs)/_layout.tsx`

Tab bar customizada com:
- Fundo: `t.bg.elevated` (branco no light, azul elevado no dark)
- Ícone ativo: scale 1.15 + translateY -2 com spring
- Label: Nunito 600, tamanho 11
- Indicador: pill roxo/teal sob o ícone ativo (não só colorir o ícone)
- Sombra sutil no topo

```typescript
// Tab item customizado
function TabItem({ icon, label, focused, onPress }) {
  const { t } = useTheme();
  const scale = useSharedValue(1);
  const translateY = useSharedValue(0);

  useEffect(() => {
    if (focused) {
      scale.value = withSpring(1.15, SPRING.snappy);
      translateY.value = withSpring(-2, SPRING.snappy);
    } else {
      scale.value = withSpring(1, SPRING.gentle);
      translateY.value = withSpring(0, SPRING.gentle);
    }
  }, [focused]);
  // ...
}
```

Commit: `feat(design): tab bar customizada com spring animation e dark mode`

---

### Task 5: Autenticação (login, register, verify)

**Files:**
- Modify: `lumen_mobile/app/(auth)/login.tsx`
- Modify: `lumen_mobile/app/(auth)/register.tsx`
- Modify: `lumen_mobile/app/(auth)/verify-email.tsx`
- Modify: `lumen_mobile/app/(auth)/verify-phone.tsx`

**Login:** Hero com logomarca (ícone de chama/luz) + "Lumen+" em Nunito 800. Form limpo, Input redesenhado. Botão primário full-width. Link "Criar conta" ghost. Animação de entrada com FadeInDown staggerado nos elementos.

**Register:** Wizard 4 passos. ProgressBar animada com spring. Cada passo faz FadeIn lateral (slide da direita). Botão "Continuar" sempre visível.

**Verify:** Código OTP com cells animadas (border + scale ao digitar).

Commit: `feat(design): telas de autenticação — Nunito, animações, dark mode`

---

### Task 6: Home Screen

**Files:**
- Modify: `lumen_mobile/app/(tabs)/home.tsx`

**Seções com entrada staggerada:**
1. **Header** — saudação personalizada ("Bom dia, [Nome]") Nunito 700, avatar pequeno
2. **Versículo do dia** — card com borda esquerda dourada, texto em Nunito 400 italic, "João 3:16" em Nunito 600 teal
3. **Avisos** — lista compacta com badge colorido por tipo (info/warning/urgent)
4. **Acesso rápido** — grid 2×2 de cards com ícone animado + label Nunito 600

Card do versículo usa `bg.elevated` com borda dourada de 3px à esquerda — tratamento especial para conteúdo espiritual.

Commit: `feat(design): home screen — versículo em destaque, stagger, dark mode`

---

### Task 7: Projeto de Vida (wizard, ciclo ativo, revisão, histórico)

**Files:**
- Modify: `lumen_mobile/app/vida/index.tsx`
- Modify: `lumen_mobile/app/vida/wizard.tsx`
- Modify: `lumen_mobile/app/vida/revisao.tsx`
- Modify: `lumen_mobile/app/vida/historico.tsx`
- Modify: `lumen_mobile/app/vida/ciclo.tsx`

**Index:** Ciclo ativo com progresso circular (sem libs, SVG puro), dimensões como chips horizontais coloridos, ação "Fazer revisão" em botão primário proeminente.

**Wizard:** Barra de progresso animada. Cada passo entra com slide lateral suave. Campos de seleção como chips com spring (selected = scale 1.05 + bg primária). Indicador de passo atual como dots.

**Revisão:** Layout de reflexão — campos de texto com bordas mínimas, muito espaço em branco, tipografia maior, fundo levemente diferente para "modo contemplativo".

Commit: `feat(design): módulo Projeto de Vida — progress, chips animados, modo contemplativo`

---

### Task 8: Canal de Grupos

**Files:**
- Modify: `lumen_mobile/app/channel/[unitId].tsx`

**Lista de posts:** Cards com sombra suave, avatar da inicial do autor (circle colorido), metadata inline, reply_count com bolha. Posts pinados com badge discreta no canto.

**Destaque institucional:** Borda esquerda dourada 4px + bg levemente amarelada no light / azul mais claro no dark.

**Detalhe do post:** Header fixo com título, scroll das replies, thread visual com linha conectora entre replies (ViewLine de 1px na vertical).

**Composer de reply:** Barra inferior animada (sobe quando teclado abre).

Commit: `feat(design): canal de grupos — thread visual, destaque dourado, composer animado`

---

### Task 9: Profile, Community, Members

**Files:**
- Modify: `lumen_mobile/app/(tabs)/profile.tsx`
- Modify: `lumen_mobile/app/(tabs)/community.tsx`
- Modify: `lumen_mobile/app/members.tsx`

**Profile:** Avatar com círculo de status (online/offline), nome em Nunito 800, realidade vocacional como chip colorido, seções com separadores sutis.

**Community:** Cards de OrgUnit com hierarquia visual clara (ícone de tipo + nome + count de membros). Botão Canal como chip roxo pequeno ao lado do título da unidade.

**Members:** Lista de membros com avatar (inicial colorida), badge de cargo (COORDINATOR = chip dourado), ações inline discretas.

Commit: `feat(design): profile, community, members — avatars, hierarquia visual`

---

### Task 10: Admin + Retiros + Bíblia + Onboarding

**Files:**
- Modify: `lumen_mobile/app/admin/index.tsx`
- Modify: `lumen_mobile/app/admin/dashboard.tsx`
- Modify: `lumen_mobile/app/admin/create-aviso.tsx`
- Modify: `lumen_mobile/app/admin/users/index.tsx`
- Modify: `lumen_mobile/app/retreats/index.tsx`
- Modify: `lumen_mobile/app/retreats/[id].tsx`
- Modify: `lumen_mobile/app/biblia/index.tsx`
- Modify: `lumen_mobile/app/biblia/reader.tsx`
- Modify: `lumen_mobile/app/(onboarding)/terms.tsx`
- Modify: `lumen_mobile/app/(onboarding)/profile.tsx`

**Admin:** Menu admin com cards de acesso em grid, cada um com ícone e label Nunito 700.

**Create-aviso:** Chips de categoria com spring, seletor de prioridade visual com cores, preview inline do aviso.

**Retiros:** Card de retiro com imagem/placeholder, status badge, botão de inscrição proeminente.

**Bíblia/reader:** Modo leitura com tipografia grande (Nunito 400 italic 18-20px), fundo creme no light / azul ainda mais escuro no dark.

**Onboarding:** Progress bar + steps visuais, cada tela com ilustração/ícone central simples.

Commit: `feat(design): admin, retiros, bíblia, onboarding — design system aplicado`

---

## Ordem de Commits

```
feat(design): tokens semânticos light/dark, ThemeContext, useAnimations       [Task 1]
feat(design): Nunito carregado, ThemeProvider, StatusBar adaptivo              [Task 2]
feat(design): componentes UI — Button, Card, Input, Skeleton, PressableScale   [Task 3]
feat(design): tab bar customizada com spring e dark mode                       [Task 4]
feat(design): autenticação — Nunito, animações, dark mode                      [Task 5]
feat(design): home screen — versículo em destaque, stagger, dark mode          [Task 6]
feat(design): Projeto de Vida — progress, chips animados, modo contemplativo   [Task 7]
feat(design): Canal de Grupos — thread visual, destaque dourado, composer      [Task 8]
feat(design): profile, community, members                                      [Task 9]
feat(design): admin, retiros, bíblia, onboarding                               [Task 10]
```
