/**
 * Vibevoice Color Tokens
 * Dark-first design system based on UX design specification
 * @see docs/planning-artifacts/ux-design-specification.md
 */

export const colors = {
  // Core backgrounds
  background: {
    primary: '#0F172A',
  },

  // Surface layers
  surface: {
    primary: '#111827',
    secondary: '#1F1E27',
  },

  // Text hierarchy
  text: {
    primary: '#FFFFFF',
    secondary: 'rgba(255,255,255,0.72)',
    tertiary: 'rgba(255,255,255,0.52)',
  },

  // Border/dividers
  border: {
    subtle: 'rgba(255,255,255,0.08)',
  },

  // Brand colors
  primary: '#D97706',
  secondary: '#F59E0B',

  // Semantic colors
  accent: '#6366F1',
  success: '#16A34A',
  warning: '#F59E0B',
  error: '#DC2626',
  info: '#38BDF8',

  // Lane-specific colors for meeting screen
  lane: {
    transcript: '#FFFFFF',
    translation: '#F59E0B',
    suggestion: '#6366F1',
    speculative: 'rgba(245,158,11,0.6)',
  },

  // Status indicators
  status: {
    idle: 'rgba(255,255,255,0.52)',
    ready: '#16A34A',
    recording: '#DC2626',
    reconnecting: '#F59E0B',
    offline: '#38BDF8',
    degraded: '#F59E0B',
  },
} as const;

export type ColorTokens = typeof colors;
