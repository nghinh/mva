/**
 * ProgressCard Component
 *
 * Displays download progress for model acquisition.
 * Calm, confidence-building presentation per UX spec.
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { spacing, typography, borderRadius } from '../../constants';
import { useTheme } from '../../hooks/useTheme';

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
  const { theme } = useTheme();
  const isComplete = progress >= 100;
  const clampedProgress = Math.min(Math.max(progress, 0), 100);

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: theme.colors.surface.container,
          borderColor: theme.colors.border.subtle,
        },
      ]}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.titleRow}>
          <Text style={[styles.title, { color: theme.colors.secondary }]}>{title}</Text>
          {subtitle && <Text style={[styles.subtitle, { color: theme.colors.text.secondary }]}>{subtitle}</Text>}
        </View>
        <Text style={[styles.percentage, { color: theme.colors.text.primary }]}>{clampedProgress.toFixed(0)}%</Text>
      </View>

      {/* Progress Bar */}
      <View style={styles.progressBarContainer}>
        <View style={[styles.progressBarBackground, { backgroundColor: theme.colors.surface['container-highest'] }]}>
          <View
            style={[
              styles.progressBarFill,
              { width: `${clampedProgress}%`, backgroundColor: theme.colors.secondary, shadowColor: theme.colors.secondary },
              isComplete && { backgroundColor: theme.colors.secondary },
            ]}
          />
        </View>
      </View>

      {/* Status Line */}
      <View style={styles.statusRow}>
        <Text style={[styles.statusText, { color: theme.colors.text.tertiary }]}>
          {status === 'downloading' && 'Loading AI model...'}
          {status === 'processing' && 'Processing model assets...'}
          {status === 'verifying' && 'Verifying model integrity...'}
          {isComplete && 'Model ready'}
        </Text>
        {bytesDownloaded !== undefined && totalBytes !== undefined && (
          <Text style={[styles.bytesText, { color: theme.colors.text.tertiary }]}>
            {formatBytes(bytesDownloaded)} / {formatBytes(totalBytes)}
          </Text>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    borderWidth: 1,
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
    letterSpacing: typography.letterSpacing.wider,
    textTransform: 'uppercase',
  },
  subtitle: {
    fontFamily: typography.fontFamily.body,
    fontSize: typography.fontSize.sm,
    marginTop: spacing.xxs,
  },
  percentage: {
    fontFamily: typography.fontFamily.label,
    fontSize: typography.fontSize.md,
    fontWeight: typography.fontWeight.bold,
  },
  progressBarContainer: {
    marginVertical: spacing.sm,
  },
  progressBarBackground: {
    height: 4,
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 2,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 4,
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
    letterSpacing: typography.letterSpacing.wide,
    textTransform: 'uppercase',
  },
  bytesText: {
    fontFamily: typography.fontFamily.label,
    fontSize: typography.fontSize.xs,
    opacity: 0.7,
  },
});

export default ProgressCard;
