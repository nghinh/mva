/**
 * Theme Context and Provider
 * Provides theme tokens with dynamic dark/light mode switching
 * Listens to system Appearance changes and reduced motion preferences
 */

import React, {
  createContext,
  useContext,
  useMemo,
  useEffect,
  useState,
} from 'react';
import {Appearance, AccessibilityInfo} from 'react-native';
import type {ColorMode} from '../theme/colors';
import {useThemeMode} from '../store/settingsStore';
import {
  ThemeTokens,
  ThemeMode,
  getColorsForMode,
  typography,
  spacing,
  borderRadius,
  touchTarget,
} from '../theme';

interface ThemeContextValue {
  theme: ThemeTokens;
  mode: ThemeMode;
  isDark: boolean;
  isReduceMotionEnabled: boolean;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

interface ThemeProviderProps {
  children: React.ReactNode;
  mode?: ThemeMode;
}

/**
 * Hook to track system theme and reduced-motion preferences
 */
function useSystemPreferences() {
  const [systemColorMode, setSystemColorMode] = useState<ColorMode>(() => {
    const scheme = Appearance.getColorScheme();
    return scheme === 'light' ? 'light' : 'dark';
  });
  const [isReduceMotionEnabled, setIsReduceMotionEnabled] = useState(false);

  useEffect(() => {
    // Listen for system color scheme changes
    const subscription = Appearance.addChangeListener(({colorScheme}) => {
      setSystemColorMode(colorScheme === 'light' ? 'light' : 'dark');
    });

    return () => subscription.remove();
  }, []);

  useEffect(() => {
    // Check reduced motion preference
    const checkReduceMotion = async () => {
      const enabled = await AccessibilityInfo.isReduceMotionEnabled();
      setIsReduceMotionEnabled(enabled);
    };
    checkReduceMotion();

    // Listen for reduced motion changes
    const subscription = AccessibilityInfo.addEventListener(
      'reduceMotionChanged',
      (enabled) => {
        setIsReduceMotionEnabled(enabled);
      },
    );

    return () => subscription.remove();
  }, []);

  return {systemColorMode, isReduceMotionEnabled};
}

export function ThemeProvider({children, mode}: ThemeProviderProps): React.JSX.Element {
  const {systemColorMode, isReduceMotionEnabled} = useSystemPreferences();
  const preferredThemeMode = useThemeMode();

  // Use explicit mode prop if provided, otherwise fall back to system preference
  const resolvedMode: ThemeMode = mode ?? (preferredThemeMode === 'system' ? systemColorMode : preferredThemeMode);

  const value = useMemo<ThemeContextValue>(() => {
    const modeColors = getColorsForMode(resolvedMode);
    const theme: ThemeTokens = {
      colors: modeColors,
      typography,
      spacing,
      borderRadius,
      touchTarget,
    };

    return {
      theme,
      mode: resolvedMode,
      isDark: resolvedMode === 'dark',
      isReduceMotionEnabled,
    };
  }, [resolvedMode, isReduceMotionEnabled]);

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
