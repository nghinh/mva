/**
 * ProgressCard Component
 *
 * Displays download progress for model acquisition.
 * Calm, confidence-building presentation per UX spec.
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, spacing, typography, borderRadius } from '../../constants';

interface ProgressCardProps {
  title: string;
  subtitle?: string;
  progress: number; // 0-100
  bytesDownloaded?: number;
  totalBytes?: number;
  status?: 'downloading' | 'processing' | 'verifying';
}

/**
 * Format bytes to human readable string
 */
function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

export const ProgressCard: React.FC<ProgressCardProps> = ({
  title,
  subtitle,
  progress,
  bytesDownloaded,
  totalBytes,
  status = 'downloading',
}) => {
  const isComplete = progress >= 100;
  const clampedProgress = Math.min(Math.max(progress, 0), 100);

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.titleRow}>
          <Text style={styles.title}>{title}</Text>
          {subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
        </View>
        <Text style={styles.percentage}>{clampedProgress.toFixed(0)}%</Text>
      </View>

      {/* Progress Bar */}
      <View style={styles.progressBarContainer}>
        <View style={styles.progressBarBackground}>
          <View
            style={[
              styles.progressBarFill,
              { width: `${clampedProgress}%` },
              isComplete && styles.progressBarComplete,
            ]}
          />
        </View>
      </View>

      {/* Status Line */}
      <View style={styles.statusRow}>
        <Text style={styles.statusText}>
          {status === 'downloading' && 'Loading AI model...'}
          {status === 'processing' && 'Processing model assets...'}
          {status === 'verifying' && 'Verifying model integrity...'}
          {isComplete && 'Model ready'}
        </Text>
        {bytesDownloaded !== undefined && totalBytes !== undefined && (
          <Text style={styles.bytesText}>
            {formatBytes(bytesDownloaded)} / {formatBytes(totalBytes)}
          </Text>
        )}
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
    alignItems: 'flex-start',
    marginBottom: spacing.sm,
  },
  titleRow: {
    flex: 1,
  },
  title: {
    fontFamily: typography.fontFamily.label,
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    color: colors.secondary,
    letterSpacing: typography.letterSpacing.wider,
    textTransform: 'uppercase',
  },
  subtitle: {
    fontFamily: typography.fontFamily.body,
    fontSize: typography.fontSize.sm,
    color: colors['on-surface-variant'],
    marginTop: spacing.xxs,
  },
  percentage: {
    fontFamily: typography.fontFamily.label,
    fontSize: typography.fontSize.md,
    fontWeight: typography.fontWeight.bold,
    color: colors['on-surface'],
  },
  progressBarContainer: {
    marginVertical: spacing.sm,
  },
  progressBarBackground: {
    height: 4,
    backgroundColor: colors['surface-container-highest'],
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: colors['secondary-container'],
    borderRadius: 2,
    shadowColor: colors.secondary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 4,
  },
  progressBarComplete: {
    backgroundColor: colors.secondary,
  },
  statusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing.xs,
  },
  statusText: {
    fontFamily: typography.fontFamily.label,
    fontSize: typography.fontSize.xs,
    color: colors['on-surface-variant'],
    letterSpacing: typography.letterSpacing.wide,
    textTransform: 'uppercase',
  },
  bytesText: {
    fontFamily: typography.fontFamily.label,
    fontSize: typography.fontSize.xs,
    color: colors['on-surface-variant'],
    opacity: 0.7,
  },
});

export default ProgressCard;
