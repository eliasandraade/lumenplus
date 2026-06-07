/**
 * Lumen+ Design Tokens
 * ====================
 * Primitives → Semantic — base do novo design system.
 * "Vela em catedral": calor humano no light, oração noturna no dark.
 */

// ── Primitives ────────────────────────────────────────────────────────────────

export const primitives = {
  teal: {
    200: '#a8dfe9',
    300: '#5cc8de',
    400: '#2da8c0',
    500: '#1A859B',
    600: '#136e80',
    700: '#0d5263',
  },
  gold: {
    200: '#ffe9a0',
    300: '#ffd24d',
    400: '#ffc61a',
    500: '#E6AC00',
    600: '#b38600',
  },
  purple: {
    300: '#c084fc',
    400: '#9d5cf5',
    500: '#7C3AED',
    600: '#5b21b6',
  },
  // Azul profundo — base do dark mode
  blue: {
    950: '#0d1a2e',
    900: '#0f1f38',
    850: '#122338',
    800: '#1a2f4a',
    750: '#1e3a5a',
    700: '#234466',
    600: '#2a4f74',
    400: '#4a7fa0',
    300: '#6a9dba',
    200: '#7fa3c0',
    100: '#adc4d8',
  },
  neutral: {
    0:   '#ffffff',
    50:  '#f7f9fc',
    100: '#eef2f7',
    200: '#dde6ef',
    300: '#b8cdd9',
    400: '#7a90a4',
    500: '#3d5166',
    600: '#243444',
    900: '#0f1923',
  },
  green:  { main: '#22c55e', light: '#86efac', dark: '#15803d' },
  red:    { main: '#ef4444', light: '#fca5a5', dark: '#b91c1c' },
  amber:  { main: '#f59e0b', light: '#fde68a', dark: '#92400e' },
  info:   { main: '#3b82f6', light: '#93c5fd', dark: '#1d4ed8' },
  // Azul navy original da Lumen+ (anterior ao CP3)
  navyBrand: {
    50:  '#e6f0ff',
    100: '#b3d4ff',
    200: '#80b8ff',
    300: '#4d9cff',
    400: '#1a80ff',
    500: '#0066e6',
    600: '#0052b3',
    700: '#003d80',
    800: '#1a365d',
    900: '#0d1b2e',
  },
  // Cinzas neutros sem hue (anterior ao CP3)
  neutralGray: {
    0:   '#ffffff',
    50:  '#fafafa',
    100: '#f5f5f5',
    200: '#e5e5e5',
    300: '#d4d4d4',
    400: '#a3a3a3',
    500: '#737373',
    600: '#525252',
    700: '#404040',
    800: '#262626',
    900: '#171717',
  },
} as const;

// ── Semantic tokens ────────────────────────────────────────────────────────────

export type ColorScheme = 'light' | 'dark';

const lightTokens = {
  bg: {
    screen:   primitives.neutralGray[0],    // #ffffff
    elevated: primitives.neutralGray[100],  // #f5f5f5 — paleta original Lumen+
    surface:  primitives.neutralGray[200],  // #e5e5e5 — paleta original Lumen+
    overlay:  'rgba(15, 25, 35, 0.45)',
    spiritual: '#fefcf5',
  },
  border: {
    subtle:  primitives.neutralGray[200],   // #e5e5e5
    default: primitives.neutralGray[300],   // #d4d4d4
    focus:   primitives.navyBrand[800],     // #1a365d
  },
  text: {
    primary:   primitives.neutralGray[900], // #171717
    secondary: primitives.neutralGray[600], // #525252 — paleta original Lumen+
    tertiary:  primitives.neutralGray[500], // #737373 — paleta original Lumen+
    inverse:   primitives.neutralGray[0],
    spiritual: primitives.navyBrand[800],   // #1a365d
    link:      primitives.navyBrand[600],   // #0052b3
  },
  brand: {
    primary:      primitives.navyBrand[800], // #1a365d
    primaryLight: primitives.navyBrand[400], // #1a80ff
    primaryDim:   primitives.navyBrand[50],  // #e6f0ff
    secondary:    primitives.gold[500],
    secondaryDim: '#fff8e1',
    admin:        primitives.purple[500],
    adminDim:     '#f3ecfd',
    coord:        '#059669',
    coordDim:     '#ecfdf5',
  },
  status: {
    success:     primitives.green.main,
    successBg:   '#f0fdf4',
    error:       primitives.red.main,
    errorBg:     '#fef2f2',
    warning:     primitives.amber.main,
    warningBg:   '#fffbeb',
    info:        primitives.info.main,
    infoBg:      '#eff6ff',
  },
  shadow: {
    color:   '#000000',
    opacity: 0.1,
    sm:  { shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 2,  elevation: 1 },
    md:  { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.10, shadowRadius: 4,  elevation: 3 },
    lg:  { shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.15, shadowRadius: 8,  elevation: 5 },
  },
  accent: {
    spiritual: primitives.gold[500],
    highlight: primitives.navyBrand[800],
    critical:  primitives.red.main,
  },
} as const;

const darkTokens = {
  bg: {
    screen:   primitives.blue[950],   // #0d1a2e — oração noturna
    elevated: primitives.blue[850],   // #122338 — cards
    surface:  primitives.blue[800],   // #1a2f4a — inputs, modais
    overlay:  'rgba(0, 0, 0, 0.65)',
    spiritual: primitives.blue[900],  // levemente mais claro para conteúdo espiritual
  },
  border: {
    subtle:  primitives.blue[750],
    default: primitives.blue[700],
    focus:   primitives.teal[400],
  },
  text: {
    primary:   '#e8f0f8',
    secondary: primitives.blue[200],
    tertiary:  '#4a6580',
    inverse:   primitives.blue[950],
    spiritual: primitives.teal[300],  // versículos em teal suave
    link:      primitives.teal[300],
  },
  brand: {
    primary:      primitives.teal[400],
    primaryLight: primitives.teal[300],
    primaryDim:   'rgba(45, 168, 192, 0.15)',
    secondary:    primitives.gold[400],
    secondaryDim: 'rgba(255, 198, 26, 0.15)',
    admin:        primitives.purple[400],
    adminDim:     'rgba(157, 92, 245, 0.15)',
    coord:        '#34d399',
    coordDim:     'rgba(52, 211, 153, 0.15)',
  },
  status: {
    success:     '#4ade80',
    successBg:   'rgba(74, 222, 128, 0.12)',
    error:       '#f87171',
    errorBg:     'rgba(248, 113, 113, 0.12)',
    warning:     '#fbbf24',
    warningBg:   'rgba(251, 191, 36, 0.12)',
    info:        '#60a5fa',
    infoBg:      'rgba(96, 165, 250, 0.12)',
  },
  shadow: {
    color:   '#000000',
    opacity: 0.4,
    sm:  { shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.3,  shadowRadius: 3,  elevation: 2 },
    md:  { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.4,  shadowRadius: 6,  elevation: 5 },
    lg:  { shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.5,  shadowRadius: 12, elevation: 8 },
  },
  accent: {
    spiritual: primitives.gold[400],
    highlight: primitives.teal[400],
    critical:  '#f87171',
  },
} as const;

export const semantic = {
  light: lightTokens,
  dark:  darkTokens,
} as const;

export type SemanticTokens = typeof lightTokens;

// ── Typography ─────────────────────────────────────────────────────────────────

export const typography = {
  family: {
    regular:    'Nunito-Regular',
    italic:     'Nunito-Italic',
    semibold:   'Nunito-SemiBold',
    bold:       'Nunito-Bold',
    extrabold:  'Nunito-ExtraBold',
    // Fallbacks enquanto fontes carregam
    fallback:   'System',
  },
  size: {
    xs:   11,
    sm:   13,
    md:   15,
    lg:   17,
    xl:   20,
    '2xl': 24,
    '3xl': 30,
    '4xl': 36,
    '5xl': 44,
  },
  lineHeight: {
    tight:  1.2,
    normal: 1.5,
    loose:  1.8,
  },
} as const;

// ── Spacing ────────────────────────────────────────────────────────────────────

export const spacing = {
  1:  4,
  2:  8,
  3:  12,
  4:  16,
  5:  20,
  6:  24,
  8:  32,
  10: 40,
  12: 48,
  16: 64,
} as const;

// ── Radius ─────────────────────────────────────────────────────────────────────

export const radius = {
  sm:   6,
  md:   10,
  lg:   14,
  xl:   20,
  '2xl': 28,
  full: 9999,
} as const;
