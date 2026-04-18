/**
 * ReadinessStatus Component
 *
 * Displays the readiness state for a single domain (model, prewarm, or server).
 * Follows accessibility guidelines: color paired with text/icons, not color-alone.
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, spacing, typography, borderRadius, statusColors } from '../../constants';
import { ModelStatus, PrewarmStatus } from '../../types';
import {AppIcon, type IconName} from './AppIcon';

type DomainStatus = ModelStatus | PrewarmStatus;

interface ReadinessStatusProps {
  domain: 'model' | 'prewarm';
  status: DomainStatus;
  label: string;
  description?: string;
  progress?: number; // 0-100 for loading states
  latencyMs?: number | null;
  error?: string | null;
}

/**
 * Get status display info including color, icon, and label
 */
function getStatusDisplay(domain: string, status: DomainStatus): {
  colorSet: (typeof statusColors)[keyof typeof statusColors];
  iconName: IconName;
  statusLabel: string;
} {
  switch (domain) {
    case 'model':
      return getModelStatusDisplay(status as ModelStatus);
    case 'prewarm':
      return getPrewarmStatusDisplay(status as PrewarmStatus);
    default:
      return {
        colorSet: statusColors.offline,
        iconName: 'help',
        statusLabel: 'Unknown',
      };
  }
}

function getModelStatusDisplay(status: ModelStatus): {
  colorSet: (typeof statusColors)[keyof typeof statusColors];
  iconName: IconName;
  statusLabel: string;
} {
  switch (status) {
    case 'missing':
      return { colorSet: statusColors.warning, iconName: 'cloud-off', statusLabel: 'Not Downloaded' };
    case 'downloading':
      return { colorSet: statusColors.loading, iconName: 'download', statusLabel: 'Downloading' };
    case 'cached-ready':
      return { colorSet: statusColors.ready, iconName: 'check-circle', statusLabel: 'Ready' };
    case 'invalid':
      return { colorSet: statusColors.error, iconName: 'error', statusLabel: 'Invalid' };
    case 'deleting':
      return { colorSet: statusColors.loading, iconName: 'delete', statusLabel: 'Deleting' };
    default:
      return { colorSet: statusColors.offline, iconName: 'help', statusLabel: 'Unknown' };
  }
}

function getPrewarmStatusDisplay(status: PrewarmStatus): {
  colorSet: (typeof statusColors)[keyof typeof statusColors];
  iconName: IconName;
  statusLabel: string;
} {
  switch (status) {
    case 'pending':
      return { colorSet: statusColors.warning, iconName: 'schedule', statusLabel: 'Pending' };
    case 'warming':
      return { colorSet: statusColors.loading, iconName: 'fire', statusLabel: 'Warming' };
    case 'ready':
      return { colorSet: statusColors.ready, iconName: 'check-circle', statusLabel: 'Ready' };
    case 'failed':
      return { colorSet: statusColors.error, iconName: 'error', statusLabel: 'Failed' };
    default:
      return { colorSet: statusColors.offline, iconName: 'help', statusLabel: 'Unknown' };
  }
}

export const ReadinessStatus: React.FC<ReadinessStatusProps> = ({
  domain,
  status,
  label,
  description,
  progress,
  error,
}) => {
  const { colorSet, iconName, statusLabel } = getStatusDisplay(domain, status);
  const isLoading = status === 'downloading' || status === 'warming';
  const isError = status === 'invalid' || status === 'failed';

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.labelRow}>
          <Text style={styles.label}>{label}</Text>
          {isLoading && progress !== undefined && (
            <Text style={[styles.progress, { color: colorSet.text }]}>
              {progress}%
            </Text>
          )}
        </View>
        <View
          style={[
            styles.statusBadge,
            { backgroundColor: colorSet.background, borderColor: colorSet.border },
          ]}
        >
          <View style={[styles.statusDot, { backgroundColor: colorSet.dot }]} />
          <Text style={[styles.statusText, { color: colorSet.text }]}>{statusLabel}</Text>
        </View>
      </View>

      {description && (
        <Text style={styles.description}>{description}</Text>
      )}

      {error && isError && (
        <Text style={[styles.error, { color: colorSet.text }]}>{error}</Text>
      )}

      {/* Icon representation */}
      <View style={styles.iconContainer}>
        <AppIcon name={iconName} size={24} color={colorSet.text} />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors['surface-container'],
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors['outline-variant'],
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  label: {
    fontFamily: typography.fontFamily.label,
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    color: colors['on-surface'],
    letterSpacing: typography.letterSpacing.wider,
    textTransform: 'uppercase',
  },
  progress: {
    fontFamily: typography.fontFamily.label,
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.bold,
  },
  latency: {
    fontFamily: typography.fontFamily.label,
    fontSize: typography.fontSize.xs,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.full,
    borderWidth: 1,
    gap: spacing.xs,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusText: {
    fontFamily: typography.fontFamily.label,
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.bold,
    textTransform: 'uppercase',
    letterSpacing: typography.letterSpacing.widest,
  },
  description: {
    marginTop: spacing.sm,
    fontFamily: typography.fontFamily.body,
    fontSize: typography.fontSize.md,
    color: colors['on-surface-variant'],
    lineHeight: typography.fontSize.md * typography.lineHeight.normal,
  },
  error: {
    marginTop: spacing.sm,
    fontFamily: typography.fontFamily.label,
    fontSize: typography.fontSize.xs,
  },
  iconContainer: {
    position: 'absolute',
    right: spacing.md,
    bottom: spacing.md,
    opacity: 0.3,
  },
});

export default ReadinessStatus;
