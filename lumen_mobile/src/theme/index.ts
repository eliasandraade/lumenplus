/**
 * Lumen+ Design System — Ponto de entrada
 * =========================================
 * Re-exporta tokens novos + mantém compatibilidade com código existente
 * que importa de '@/theme'.
 *
 * MIGRAÇÃO GRADUAL: telas antigas continuam funcionando.
 * Novas telas devem usar useTheme() do ThemeContext.
 */

export { useTheme, ThemeProvider } from './ThemeContext';
export type { ThemeContextValue } from './ThemeContext';
export type { ColorScheme as ThemeScheme } from './tokens';
export { primitives, semantic, typography, spacing as spacingTokens, radius as radiusTokens } from './tokens';
export type { SemanticTokens } from './tokens';

// ── Backward-compat: valores estáticos (light) para telas não migradas ─────────

export const colors = {
  // Primárias — retrocompatibilidade
  primary: {
    50:  '#e6f4f7',
    100: '#b3dde6',
    200: '#80c6d5',
    300: '#5cc8de',
    400: '#2da8c0',
    500: '#1A859B',
    600: '#136e80',
    700: '#0d5263',
    800: '#1a365d', // valor histórico mantido
    900: '#0d1b2e',
  },
  secondary: {
    50:  '#fff9e6',
    100: '#ffecb3',
    200: '#ffdf80',
    300: '#ffd24d',
    400: '#ffc61a',
    500: '#E6AC00',
    600: '#b38600',
    700: '#806000',
    800: '#4d3a00',
    900: '#1a1300',
  },
  neutral: {
    50:  '#f7f9fc',
    100: '#eef2f7',
    200: '#dde6ef',
    300: '#b8cdd9',
    400: '#7a90a4',
    500: '#3d5166',
    600: '#243444',
    700: '#1a2535',
    800: '#0f1923',
    900: '#080e14',
  },
  success: { light: '#86efac', main: '#22c55e', dark: '#15803d' },
  warning: { light: '#fde068', main: '#f59e0b', dark: '#92400e' },
  error:   { light: '#fca5a5', main: '#ef4444', dark: '#b91c1c' },
  info:    { light: '#93c5fd', main: '#3b82f6', dark: '#1d4ed8' },
  background: {
    primary:   '#ffffff',
    secondary: '#f7f9fc',
    tertiary:  '#eef2f7',
  },
  text: {
    primary:   '#0f1923',
    secondary: '#3d5166',
    tertiary:  '#7a90a4',
    inverse:   '#ffffff',
  },
  white:       '#ffffff',
  black:       '#0f1923',
  transparent: 'transparent',
};

export const spacing = {
  xs:  4,
  sm:  8,
  md:  16,
  lg:  24,
  xl:  32,
  xxl: 48,
};

export const borderRadius = {
  none: 0,
  sm:   6,
  md:   10,
  lg:   14,
  xl:   20,
  full: 9999,
};

export const fontSize = {
  xs:   11,
  sm:   13,
  md:   15,
  lg:   17,
  xl:   20,
  '2xl': 24,
  '3xl': 30,
  '4xl': 36,
};

export const fontWeight = {
  normal:   '400' as const,
  medium:   '500' as const,
  semibold: '600' as const,
  bold:     '700' as const,
};

export const shadow = {
  sm: { shadowColor: '#0d5263', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 3,  elevation: 1 },
  md: { shadowColor: '#0d5263', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.09, shadowRadius: 6,  elevation: 3 },
  lg: { shadowColor: '#0d5263', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.12, shadowRadius: 12, elevation: 6 },
};

// Export default para `import theme from '@/theme'`
const theme = { colors, spacing, borderRadius, fontSize, fontWeight, shadow };
export default theme;
