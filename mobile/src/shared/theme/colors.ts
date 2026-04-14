/**
 * Vibevoice Color Tokens
 * Dark-first design system with light mode parity
 * @see docs/planning-artifacts/ux-design-specification.md
 */

/**
 * Color structure shared by both modes
 * Used as the type for ThemeTokens.colors
 */
export interface ColorScheme {
  background: {
    primary: string;
    secondary: string;
  };
  surface: {
    primary: string;
    secondary: string;
    container: string;
    'container-low': string;
    'container-high': string;
    'container-highest': string;
  };
  text: {
    primary: string;
    secondary: string;
    tertiary: string;
  };
  border: {
    subtle: string;
  };
  primary: string;
  secondary: string;
  tertiary: string;
  accent: string;
  success: string;
  warning: string;
  error: string;
  info: string;
  lane: {
    transcript: string;
    translation: string;
    suggestion: string;
    speculative: string;
  };
  status: {
    idle: string;
    ready: string;
    recording: string;
    reconnecting: string;
    offline: string;
    degraded: string;
  };
  jumpPill: {
    background: string;
    text: string;
  };
}

/**
 * Dark mode color palette
 */
const darkColors: ColorScheme = {
  background: {
    primary: '#0A0A0F',
    secondary: '#131318',
  },
  surface: {
    primary: '#0e0e13',
    secondary: '#131318',
    container: '#1f1f25',
    'container-low': '#1b1b20',
    'container-high': '#2a292f',
    'container-highest': '#35343a',
  },
  text: {
    primary: '#E4E2EE',
    secondary: '#c8c4d7',
    tertiary: '#9894a8',
  },
  border: {
    subtle: 'rgba(255,255,255,0.08)',
  },
  primary: '#c6bfff',
  secondary: '#44eeba',
  tertiary: '#adc6ff',
  accent: '#6C5CE7',
  success: '#16A34A',
  warning: '#F59E0B',
  error: '#ffb4ab',
  info: '#38BDF8',
  lane: {
    transcript: '#adc6ff',
    translation: '#44eeba',
    suggestion: '#6C5CE7',
    speculative: 'rgba(68,238,186,0.6)',
  },
  status: {
    idle: 'rgba(255,255,255,0.52)',
    ready: '#16A34A',
    recording: '#ffb4ab',
    reconnecting: '#F59E0B',
    offline: '#38BDF8',
    degraded: '#F59E0B',
  },
  jumpPill: {
    background: 'rgba(108, 92, 231, 0.8)',
    text: '#FFFFFF',
  },
};

/**
 * Light mode color palette
 */
const lightColors: ColorScheme = {
  background: {
    primary: '#FAFAFA',
    secondary: '#F0F0F5',
  },
  surface: {
    primary: '#FFFFFF',
    secondary: '#F5F5FA',
    container: '#F0F0F5',
    'container-low': '#E8E8EE',
    'container-high': '#E0E0E8',
    'container-highest': '#D8D8E0',
  },
  text: {
    primary: '#1A1A2E',
    secondary: '#4A4A6A',
    tertiary: '#8888A0',
  },
  border: {
    subtle: 'rgba(0,0,0,0.08)',
  },
  primary: '#5B4ED9',
  secondary: '#22C9A0',
  tertiary: '#3B82F6',
  accent: '#5B4ED9',
  success: '#16A34A',
  warning: '#F59E0B',
  error: '#EF4444',
  info: '#3B82F6',
  lane: {
    transcript: '#3B82F6',
    translation: '#F59E0B',
    suggestion: '#5B4ED9',
    speculative: 'rgba(245,158,11,0.6)',
  },
  status: {
    idle: 'rgba(0,0,0,0.45)',
    ready: '#16A34A',
    recording: '#EF4444',
    reconnecting: '#F59E0B',
    offline: '#3B82F6',
    degraded: '#F59E0B',
  },
  jumpPill: {
    background: 'rgba(91, 78, 217, 0.85)',
    text: '#FFFFFF',
  },
};

export type ColorMode = 'dark' | 'light';

export function getColorsForMode(mode: ColorMode): ColorScheme {
  return mode === 'dark' ? darkColors : lightColors;
}

export const colors = {
  dark: darkColors,
  light: lightColors,
} as const;

export type ColorTokens = ColorScheme;
