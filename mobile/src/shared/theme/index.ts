/**
 * Vibevoice Theme Index
 * Exports all theme tokens and types
 */

export {
  colors,
  getColorsForMode,
  type ColorMode,
  type ColorTokens,
} from './colors';
export {typography, type TypographyTokens} from './typography';
export {
  spacing,
  borderRadius,
  touchTarget,
  type SpacingTokens,
  type BorderRadiusTokens,
  type TouchTargetTokens,
} from './spacing';
import type {ColorTokens} from './colors';
import type {TypographyTokens} from './typography';
import type {SpacingTokens, BorderRadiusTokens, TouchTargetTokens} from './spacing';

/**
 * Combined theme tokens
 */
export interface ThemeTokens {
  colors: ColorTokens;
  typography: TypographyTokens;
  spacing: SpacingTokens;
  borderRadius: BorderRadiusTokens;
  touchTarget: TouchTargetTokens;
}

/**
 * Theme mode - dark-first, light mode parity
 */
export type ThemeMode = 'dark' | 'light';

/**
 * Default theme is dark
 */
export const defaultThemeMode: ThemeMode = 'dark';
