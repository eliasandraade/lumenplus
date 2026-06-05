/**
 * ThemeContext
 * ============
 * Provê tema light/dark para toda a aplicação.
 * Persiste preferência do usuário via AsyncStorage.
 * Detecta preferência do sistema como default.
 *
 * SOMENTE visual — nenhuma lógica de negócio aqui.
 */

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { semantic, SemanticTokens, ColorScheme, typography, spacing, radius } from './tokens';

const THEME_STORAGE_KEY = 'lumen_theme_preference';

export interface ThemeContextValue {
  /** Esquema atual: 'light' | 'dark' */
  scheme: ColorScheme;
  /** Tokens semânticos do tema atual */
  t: SemanticTokens;
  /** Tipografia */
  font: typeof typography;
  /** Espaçamento */
  sp: typeof spacing;
  /** Border radius */
  r: typeof radius;
  isDark: boolean;
  /** Alterna entre light e dark */
  toggleTheme: () => void;
  /** Define tema explicitamente */
  setTheme: (scheme: ColorScheme) => void;
  /** True enquanto carrega a preferência salva */
  isThemeLoading: boolean;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const systemScheme = useColorScheme();
  const [scheme, setSchemeState] = useState<ColorScheme>(systemScheme === 'dark' ? 'dark' : 'light');
  const [isThemeLoading, setIsThemeLoading] = useState(true);

  // Carrega preferência salva
  useEffect(() => {
    AsyncStorage.getItem(THEME_STORAGE_KEY)
      .then((saved) => {
        if (saved === 'light' || saved === 'dark') {
          setSchemeState(saved);
        }
      })
      .catch(() => {
        // Falha silenciosa — usa o tema do sistema
      })
      .finally(() => setIsThemeLoading(false));
  }, []);

  const setTheme = useCallback((s: ColorScheme) => {
    setSchemeState(s);
    AsyncStorage.setItem(THEME_STORAGE_KEY, s).catch(() => {});
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme(scheme === 'light' ? 'dark' : 'light');
  }, [scheme, setTheme]);

  const value: ThemeContextValue = {
    scheme,
    t: semantic[scheme] as SemanticTokens,
    font: typography,
    sp: spacing,
    r: radius,
    isDark: scheme === 'dark',
    toggleTheme,
    setTheme,
    isThemeLoading,
  };

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    // Fallback seguro para componentes fora do provider (ex: Storybook, testes)
    return {
      scheme: 'light',
      t: semantic.light,
      font: typography,
      sp: spacing,
      r: radius,
      isDark: false,
      toggleTheme: () => {},
      setTheme: () => {},
      isThemeLoading: false,
    };
  }
  return ctx;
}
