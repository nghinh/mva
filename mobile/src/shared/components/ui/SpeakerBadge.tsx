/**
 * SpeakerBadge Component
 *
 * Reusable speaker label badge with color coding.
 * Session-scoped speaker labels (S1, S2, S3...) are color-coded for visual distinction.
 *
 * Color palette:
 * - S1: Purple (#a78bfa)
 * - S2: Blue (#60a5fa)
 * - S3: Emerald (#34d399)
 * - S4: Amber (#fbbf24)
 * - S5: Pink (#f472b6)
 * - S6: Orange (#fb923c)
 *
 * Usage:
 * - Non-fatal if speakerId is absent (returns null)
 * - Graceful fallback to neutral gray if unknown speakerId
 */

import React, {useMemo} from 'react';
import {View, Text, StyleSheet} from 'react-native';

// ============================================================================
// Speaker Color Palette
// ============================================================================

export const SPEAKER_COLORS: Record<string, {bg: string; text: string; border: string}> = {
  S1: {bg: 'rgba(162, 155, 254, 0.18)', text: '#A29BFE', border: 'rgba(162, 155, 254, 0.4)'},
  S2: {bg: 'rgba(52, 211, 153, 0.18)', text: '#34D399', border: 'rgba(52, 211, 153, 0.4)'},
  S3: {bg: 'rgba(248, 113, 113, 0.18)', text: '#F87171', border: 'rgba(248, 113, 113, 0.4)'},
  S4: {bg: 'rgba(251, 191, 36, 0.18)', text: '#FBBF24', border: 'rgba(251, 191, 36, 0.4)'},
  S5: {bg: 'rgba(152, 149, 173, 0.18)', text: '#9895AD', border: 'rgba(152, 149, 173, 0.4)'},
  S6: {bg: 'rgba(152, 149, 173, 0.18)', text: '#9895AD', border: 'rgba(152, 149, 173, 0.4)'},
};

const NEUTRAL_COLOR = {bg: 'rgba(156, 163, 175, 0.18)', text: '#9ca3af', border: 'rgba(156, 163, 175, 0.4)'};

function getSpeakerColor(speakerId: string | null | undefined): {bg: string; text: string; border: string} {
  if (!speakerId) return NEUTRAL_COLOR;
  return SPEAKER_COLORS[speakerId] ?? NEUTRAL_COLOR;
}

// ============================================================================
// SpeakerBadge Component
// ============================================================================

export interface SpeakerBadgeProps {
  /** Speaker identifier (S1, S2, S3...) */
  speakerId?: string | null;
  /** Optional custom label. If not provided, uses speakerId as display */
  label?: string | null;
  /** Size variant */
  size?: 'small' | 'medium';
  /** Show border styling */
  showBorder?: boolean;
  /** Custom style override */
  style?: object;
}

/**
 * SpeakerBadge displays a speaker label with color coding.
 * Returns null if speakerId is not provided (non-fatal).
 */
export function SpeakerBadge({
  speakerId,
  label,
  size = 'small',
  showBorder = false,
  style,
}: SpeakerBadgeProps): React.JSX.Element | null {
  // Non-fatal: return null if speakerId is absent
  if (!speakerId) {
    return null;
  }

  const colors = useMemo(() => getSpeakerColor(speakerId), [speakerId]);
  const displayLabel = label ?? speakerId;

  const isSmall = size === 'small';

  return (
    <View
      style={[
        styles.badge,
        isSmall ? styles.badgeSmall : styles.badgeMedium,
        {backgroundColor: colors.bg},
        showBorder && {borderWidth: 1, borderColor: colors.border},
        style,
      ]}
      accessibilityLabel={`Speaker: ${displayLabel}`}
      accessibilityRole="text">
      <Text
        style={[
          styles.badgeText,
          isSmall ? styles.textSmall : styles.textMedium,
          {color: colors.text},
        ]}
        numberOfLines={1}>
        {displayLabel}
      </Text>
    </View>
  );
}

// ============================================================================
// SpeakerBadge with Icon
// ============================================================================

export interface SpeakerBadgeWithIconProps extends SpeakerBadgeProps {
  /** Show a person icon before the label */
  showIcon?: boolean;
}

/**
 * SpeakerBadgeWithIcon displays a speaker label with an optional person icon.
 */
export function SpeakerBadgeWithIcon({
  speakerId,
  label,
  size = 'small',
  showBorder = false,
  showIcon = false,
  style,
}: SpeakerBadgeWithIconProps): React.JSX.Element | null {
  if (!speakerId) {
    return null;
  }

  const colors = useMemo(() => getSpeakerColor(speakerId), [speakerId]);
  const displayLabel = label ?? speakerId;
  const isSmall = size === 'small';

  return (
    <View
      style={[
        styles.badgeWithIcon,
        isSmall ? styles.badgeSmall : styles.badgeMedium,
        {backgroundColor: colors.bg},
        showBorder && {borderWidth: 1, borderColor: colors.border},
        style,
      ]}
      accessibilityLabel={`Speaker: ${displayLabel}`}
      accessibilityRole="text">
      {showIcon && (
        <View style={styles.iconContainer}>
          <Text style={[styles.icon, {color: colors.text}]}>👤</Text>
        </View>
      )}
      <Text
        style={[
          styles.badgeText,
          isSmall ? styles.textSmall : styles.textMedium,
          {color: colors.text},
        ]}
        numberOfLines={1}>
        {displayLabel}
      </Text>
    </View>
  );
}

// ============================================================================
// Speaker Color Dot (for inline use)
// ============================================================================

export interface SpeakerColorDotProps {
  speakerId?: string | null;
  size?: number;
}

/**
 * SpeakerColorDot displays a small colored dot representing a speaker.
 * Useful for timeline entries or inline speaker identification.
 */
export function SpeakerColorDot({
  speakerId,
  size = 8,
}: SpeakerColorDotProps): React.JSX.Element | null {
  if (!speakerId) {
    return null;
  }

  const colors = getSpeakerColor(speakerId);

  return (
    <View
      style={[
        styles.colorDot,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: colors.text,
        },
      ]}
      accessibilityLabel={`Speaker ${speakerId} indicator`}
      accessibilityRole="image"
    />
  );
}

// ============================================================================
// Styles
// ============================================================================

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 4,
  },
  badgeSmall: {
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  badgeMedium: {
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  badgeWithIcon: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 4,
    gap: 4,
  },
  badgeText: {
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  textSmall: {
    fontSize: 9,
  },
  textMedium: {
    fontSize: 11,
  },
  iconContainer: {
    marginRight: 2,
  },
  icon: {
    fontSize: 10,
  },
  colorDot: {
    // Sized dynamically
  },
});

export default SpeakerBadge;
