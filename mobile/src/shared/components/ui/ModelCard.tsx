/**
 * ModelCard Component
 *
 * Displays model information with status, languages, and actions.
 * Used in the Model Repository screen.
 */

import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { colors, spacing, typography, borderRadius, statusColors } from '../../constants';
import { ModelInfo, ModelStatus } from '../../types';
import {AppIcon} from './AppIcon';

interface ModelCardProps {
  model: ModelInfo;
  status: ModelStatus;
  onDelete?: () => void;
  onDownload?: () => void;
  disabled?: boolean;
}

/**
 * Get status badge display
 */
function getStatusBadge(status: ModelStatus): {
  colorSet: (typeof statusColors)[keyof typeof statusColors];
  label: string;
  pulse?: boolean;
} {
  switch (status) {
    case 'cached-ready':
      return { colorSet: statusColors.ready, label: 'Ready', pulse: true };
    case 'downloading':
      return { colorSet: statusColors.loading, label: 'Downloading', pulse: true };
    case 'missing':
      return { colorSet: statusColors.warning, label: 'Not Downloaded' };
    case 'invalid':
      return { colorSet: statusColors.error, label: 'Invalid' };
    case 'deleting':
      return { colorSet: statusColors.loading, label: 'Deleting', pulse: true };
    default:
      return { colorSet: statusColors.offline, label: 'Unknown' };
  }
}

export const ModelCard: React.FC<ModelCardProps> = ({
  model,
  status,
  onDelete,
  onDownload,
  disabled = false,
}) => {
  const badge = getStatusBadge(status);
  const isReady = status === 'cached-ready';
  const isDownloading = status === 'downloading';
  const isDisabled = disabled || isReady || isDownloading;

  return (
    <View style={[styles.container, isDisabled && styles.containerDisabled]}>
      {/* Header Row */}
      <View style={styles.header}>
        <View style={styles.titleSection}>
          <View style={styles.titleRow}>
            <AppIcon
              name={isReady ? 'memory' : 'cloud-off'}
              size={20}
              color={isReady ? colors.primary : colors['on-surface-variant']}
              style={styles.modelIcon}
            />
            <Text style={[styles.modelName, !isReady && styles.modelNameDisabled]}>
              {model.name}
            </Text>
          </View>
          <Text style={styles.version}>v{model.version}</Text>
        </View>

        {/* Status Badge */}
        <View
          style={[
            styles.statusBadge,
            { backgroundColor: badge.colorSet.background, borderColor: badge.colorSet.border },
          ]}
        >
          <View
            style={[
              styles.statusDot,
              { backgroundColor: badge.colorSet.dot },
              badge.pulse && styles.statusDotPulse,
            ]}
          />
          <Text style={[styles.statusText, { color: badge.colorSet.text }]}>
            {badge.label}
          </Text>
        </View>
      </View>

      {/* Stats Grid */}
      <View style={styles.statsGrid}>
        <View style={styles.stat}>
          <Text style={styles.statLabel}>Disk Footprint</Text>
          <Text style={styles.statValue}>{model.diskFootprintMB} MB</Text>
        </View>
        <View style={styles.stat}>
          <Text style={styles.statLabel}>Inference Speed</Text>
          <Text style={[styles.statValue, { color: colors.secondary }]}>
            RTF: {model.inferenceSpeedRTF.toFixed(2)}
          </Text>
        </View>
      </View>

      {/* Languages */}
      <View style={styles.languagesSection}>
        <Text style={styles.languagesLabel}>Native Support</Text>
        <View style={styles.languageChips}>
          {model.languages.map((lang) => (
            <View key={lang} style={styles.languageChip}>
              <Text style={styles.languageChipText}>{lang}</Text>
            </View>
          ))}
        </View>
      </View>

      {/* Footer Actions */}
      <View style={styles.footer}>
        <Text style={styles.optimizedText}>
          Optimized for {model.isOptimizedFor.join(', ')}
        </Text>

        {isReady && onDelete && (
          <Pressable
            style={({ pressed }) => [
              styles.deleteButton,
              pressed && styles.deleteButtonPressed,
            ]}
            onPress={onDelete}
            accessibilityLabel={`Delete ${model.name} model`}
            accessibilityRole="button"
          >
            <AppIcon name="delete" size={16} color={colors.error} />
            <Text style={styles.deleteButtonText}>Delete</Text>
          </Pressable>
        )}

        {!isReady && !isDownloading && onDownload && (
          <Pressable
            style={({ pressed }) => [
              styles.downloadButton,
              pressed && styles.downloadButtonPressed,
            ]}
            onPress={onDownload}
            accessibilityLabel={`Download ${model.name} model`}
            accessibilityRole="button"
          >
            <AppIcon name="download" size={16} color={colors.primary} />
            <Text style={styles.downloadButtonText}>Download</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors['surface-container'],
    borderRadius: borderRadius.xl,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors['outline-variant'],
  },
  containerDisabled: {
    opacity: 0.6,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    padding: spacing.md,
    paddingBottom: spacing.sm,
  },
  titleSection: {
    flex: 1,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  modelIcon: {
    marginRight: spacing.sm,
  },
  modelName: {
    fontFamily: typography.fontFamily.headline,
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
    color: colors['on-surface'],
    letterSpacing: typography.letterSpacing.tight,
  },
  modelNameDisabled: {
    color: colors['on-surface-variant'],
  },
  version: {
    fontFamily: typography.fontFamily.label,
    fontSize: typography.fontSize.xs,
    color: colors['on-surface-variant'],
    marginTop: spacing.xxs,
    marginLeft: 28, // Align with text after icon
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
  statusDotPulse: {
    // Pulse animation would be handled by reanimated
  },
  statusText: {
    fontFamily: typography.fontFamily.label,
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.bold,
    textTransform: 'uppercase',
    letterSpacing: typography.letterSpacing.widest,
  },
  statsGrid: {
    flexDirection: 'row',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    gap: spacing.md,
  },
  stat: {
    flex: 1,
  },
  statLabel: {
    fontFamily: typography.fontFamily.label,
    fontSize: typography.fontSize.xs,
    color: colors['on-surface-variant'],
    textTransform: 'uppercase',
    letterSpacing: typography.letterSpacing.widest,
    opacity: 0.6,
  },
  statValue: {
    fontFamily: typography.fontFamily.label,
    fontSize: typography.fontSize.md,
    fontWeight: typography.fontWeight.bold,
    color: colors['on-surface'],
    marginTop: spacing.xxs,
  },
  languagesSection: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  languagesLabel: {
    fontFamily: typography.fontFamily.label,
    fontSize: typography.fontSize.xs,
    color: colors['on-surface-variant'],
    textTransform: 'uppercase',
    letterSpacing: typography.letterSpacing.widest,
    opacity: 0.6,
    marginBottom: spacing.sm,
  },
  languageChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  languageChip: {
    backgroundColor: colors['surface-container-highest'],
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.sm,
    borderWidth: 1,
    borderColor: colors['outline-variant'],
  },
  languageChipText: {
    fontFamily: typography.fontFamily.label,
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.bold,
    color: colors['on-surface'],
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.md,
    paddingTop: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors['outline-variant'],
  },
  optimizedText: {
    fontFamily: typography.fontFamily.body,
    fontSize: typography.fontSize.sm,
    color: colors['on-surface-variant'],
    fontStyle: 'italic',
    flex: 1,
  },
  deleteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.lg,
    gap: spacing.xs,
  },
  deleteButtonPressed: {
    backgroundColor: 'rgba(255, 180, 171, 0.1)',
  },
  deleteButtonText: {
    fontFamily: typography.fontFamily.label,
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.bold,
    color: colors.error,
  },
  downloadButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.lg,
    gap: spacing.xs,
  },
  downloadButtonPressed: {
    backgroundColor: 'rgba(198, 191, 255, 0.1)',
  },
  downloadButtonText: {
    fontFamily: typography.fontFamily.label,
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.bold,
    color: colors.primary,
  },
});

export default ModelCard;
