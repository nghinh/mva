/**
 * Theme Context and Provider
 * Provides dark-first theme tokens to the app
 */

import React, {createContext, useContext, useMemo} from 'react';
import {
  ThemeTokens,
  ThemeMode,
  defaultThemeMode,
  colors,
  typography,
  spacing,
  borderRadius,
  touchTarget,
} from '../theme';

interface ThemeContextValue {
  theme: ThemeTokens;
  mode: ThemeMode;
  isDark: boolean;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

interface ThemeProviderProps {
  children: React.ReactNode;
  mode?: ThemeMode;
}

export function ThemeProvider({children, mode = defaultThemeMode}: ThemeProviderProps) {
  const value = useMemo<ThemeContextValue>(() => {
    const theme: ThemeTokens = {
      colors,
      typography,
      spacing,
      borderRadius,
      touchTarget,
    };

    return {
      theme,
      mode,
      isDark: mode === 'dark',
    };
  }, [mode]);

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}
