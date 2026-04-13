/**
 * Vibevoice Spacing Tokens
 * Base spacing scale: 4 / 8 / 12 / 16 / 24 / 32 / 40
 * @see docs/planning-artifacts/ux-design-specification.md#Spacing & Radius
 */

export const spacing = {
  /** 4px - tight spacing */
  xxs: 4,
  /** 8px - default small */
  xs: 8,
  /** 12px - small-medium */
  sm: 12,
  /** 16px - default medium */
  md: 16,
  /** 24px - large */
  lg: 24,
  /** 32px - extra large */
  xl: 32,
  /** 40px - section spacing */
  xxl: 40,
} as const;

export const borderRadius = {
  /** 8px - small elements */
  sm: 8,
  /** 12px - buttons, inputs */
  md: 12,
  /** 16px - cards */
  lg: 16,
  /** 20px - sheets */
  xl: 20,
  /** 24px - large containers */
  full: 9999,
} as const;

export const touchTarget = {
  /** Minimum touch target (44px) */
  min: 44,
  /** Ideal touch target (48px) */
  ideal: 48,
} as const;

export type SpacingTokens = typeof spacing;
export type BorderRadiusTokens = typeof borderRadius;
export type TouchTargetTokens = typeof touchTarget;
