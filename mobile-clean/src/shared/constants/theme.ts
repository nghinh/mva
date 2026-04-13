/**
 * React Native-safe design tokens for VibeVoice.
 * Numeric values only for style-compatible spacing, radius, and letter spacing.
 */

export const colors = {
  primary: '#c6bfff',
  'primary-container': '#6c5ce7',
  'on-primary': '#2900a0',
  'on-primary-container': '#faf6ff',
  'primary-fixed': '#e4dfff',
  'primary-fixed-dim': '#c6bfff',
  secondary: '#44eeba',
  'secondary-container': '#00d19f',
  'on-secondary': '#003828',
  'on-secondary-container': '#00543e',
  'secondary-fixed': '#57fdc8',
  'secondary-fixed-dim': '#2ce0ad',
  tertiary: '#adc6ff',
  'tertiary-container': '#1a6de0',
  'on-tertiary': '#002e6a',
  'on-tertiary-container': '#f6f6ff',
  'tertiary-fixed': '#d8e2ff',
  'tertiary-fixed-dim': '#adc6ff',
  error: '#ffb4ab',
  'error-container': '#93000a',
  'on-error': '#690005',
  'on-error-container': '#ffdad6',
  surface: '#131318',
  'surface-bright': '#39383e',
  'surface-container': '#1f1f25',
  'surface-container-high': '#2a292f',
  'surface-container-highest': '#35343a',
  'surface-container-low': '#1b1b20',
  'surface-container-lowest': '#0e0e13',
  'surface-dim': '#131318',
  'surface-tint': '#c6bfff',
  'surface-variant': '#35343a',
  'on-surface': '#e4e1e9',
  'on-surface-variant': '#c8c4d7',
  background: '#131318',
  'on-background': '#e4e1e9',
  'inverse-surface': '#e4e1e9',
  'inverse-on-surface': '#303036',
  'inverse-primary': '#5847d2',
  outline: '#928ea0',
  'outline-variant': '#474554',
} as const;

export const spacing = {
  xxs: 2,
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
  xxxl: 64,
} as const;

export const borderRadius = {
  sm: 4,
  md: 8,
  lg: 12,
  xl: 16,
  full: 999,
} as const;

export const typography = {
  fontFamily: {
    headline: 'System',
    body: 'System',
    label: 'System',
    mono: 'Courier',
  },
  fontSize: {
    xs: 10,
    sm: 12,
    md: 14,
    lg: 16,
    xl: 18,
    '2xl': 24,
    '3xl': 32,
  },
  fontWeight: {
    regular: '400' as const,
    medium: '500' as const,
    semibold: '600' as const,
    bold: '700' as const,
    extrabold: '800' as const,
    black: '900' as const,
  },
  letterSpacing: {
    tighter: -0.4,
    tight: -0.2,
    normal: 0,
    wide: 0.2,
    wider: 0.4,
    widest: 0.8,
    widest2: 1.2,
  },
  lineHeight: {
    tight: 1.25,
    normal: 1.5,
    relaxed: 1.75,
  },
} as const;

export const shadows = {
  glow: {
    primary: {
      shadowColor: '#6C5CE7',
      shadowOffset: {width: 0, height: 0},
      shadowOpacity: 0.15,
      shadowRadius: 20,
      elevation: 0,
    },
    secondary: {
      shadowColor: '#00D19F',
      shadowOffset: {width: 0, height: 0},
      shadowOpacity: 0.15,
      shadowRadius: 20,
      elevation: 0,
    },
  },
  card: {
    subtle: {
      shadowColor: '#000000',
      shadowOffset: {width: 0, height: 4},
      shadowOpacity: 0.2,
      shadowRadius: 12,
      elevation: 2,
    },
    elevated: {
      shadowColor: '#6C5CE7',
      shadowOffset: {width: 0, height: 8},
      shadowOpacity: 0.2,
      shadowRadius: 16,
      elevation: 4,
    },
  },
} as const;

export const animation = {
  fast: 100,
  normal: 200,
  slow: 300,
  slower: 400,
} as const;

export const touchTargets = {
  minimum: 44,
  comfortable: 48,
} as const;

export const zIndex = {
  base: 0,
  dropdown: 10,
  sticky: 20,
  modal: 40,
  toast: 50,
  tooltip: 100,
} as const;

export const statusColors = {
  ready: {
    background: 'rgba(68, 238, 186, 0.1)',
    text: colors.secondary,
    border: 'rgba(68, 238, 186, 0.2)',
    dot: colors.secondary,
  },
  loading: {
    background: 'rgba(198, 191, 255, 0.1)',
    text: colors.primary,
    border: 'rgba(198, 191, 255, 0.2)',
    dot: colors.primary,
  },
  error: {
    background: 'rgba(255, 180, 171, 0.1)',
    text: colors.error,
    border: 'rgba(255, 180, 171, 0.2)',
    dot: colors.error,
  },
  warning: {
    background: 'rgba(255, 195, 71, 0.1)',
    text: '#ffc345',
    border: 'rgba(255, 195, 71, 0.2)',
    dot: '#ffc345',
  },
  offline: {
    background: 'rgba(146, 142, 160, 0.1)',
    text: colors['on-surface-variant'],
    border: 'rgba(146, 142, 160, 0.2)',
    dot: colors['on-surface-variant'],
  },
} as const;
