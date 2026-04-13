/**
 * Vibevoice Typography Tokens
 * Based on Plus Jakarta Sans as primary typeface
 * @see docs/planning-artifacts/ux-design-specification.md#Typography
 */

import {Platform, TextStyle} from 'react-native';

const fontFamily = Platform.select({
  ios: 'System',
  android: 'Roboto',
  default: 'System',
});

const monoFontFamily = Platform.select({
  ios: 'Menlo',
  android: 'monospace',
  default: 'monospace',
});

export const typography = {
  // Display - splash title
  display: {
    fontFamily,
    fontSize: 32,
    lineHeight: 40,
    fontWeight: '700',
  },

  // Screen title
  screenTitle: {
    fontFamily,
    fontSize: 24,
    lineHeight: 32,
    fontWeight: '700',
  },

  // Section title
  sectionTitle: {
    fontFamily,
    fontSize: 20,
    lineHeight: 28,
    fontWeight: '600',
  },

  // Lane item primary (meeting content)
  lanePrimary: {
    fontFamily,
    fontSize: 18,
    lineHeight: 28,
    fontWeight: '500',
  },

  // Lane item secondary
  laneSecondary: {
    fontFamily,
    fontSize: 16,
    lineHeight: 24,
    fontWeight: '400',
  },

  // Caption/metadata
  caption: {
    fontFamily,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '500',
  },

  // Micro labels/badges
  micro: {
    fontFamily,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '600',
  },

  // Monospace for technical info (model names, etc)
  mono: {
    fontFamily: monoFontFamily,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '400',
  },
} as const satisfies Record<string, TextStyle>;

export type TypographyTokens = typeof typography;
