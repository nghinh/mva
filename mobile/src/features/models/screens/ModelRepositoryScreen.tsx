/**
 * ModelRepositoryScreen
 *
 * Displays available AI models with download/delete functionality.
 * Shows model status, storage state, and availability.
 *
 * Story 1-3: Add model download cache and local lifecycle management
 */

import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {useNavigation} from '../../../app/navigation/router';
import {StackNavigationProp} from '../../../app/navigation/router';
import {RootStackParamList} from '../../../app/navigation/router';
import { colors, spacing, typography, borderRadius } from '@shared/constants';
import { AppIcon, ModelCard, ProgressCard } from '@shared/components/ui';
import { useBootstrapStore, useModelState, useTranslatorModelState } from '@shared/store';
import { ModelInfo, ModelStatus } from '@shared/types';
import {getSTTProcessorInstance} from '../../../native/stt/STTProcessor';

// Mock data for available models
const AVAILABLE_MODELS: ModelInfo[] = [
  {
    id: 'sensevoice-small',
    name: 'SenseVoice-Small',
    version: '1.2.4-stable',
    quality: 'int8',
    diskFootprintMB: 234,
    languages: ['EN', 'JA', 'KO', 'ZH'],
    inferenceSpeedRTF: 0.05,
    isOptimizedFor: ['iPhone 15 Pro'],
  },
  {
    id: 'nllb-600m-mobile',
    name: 'NLLB-600M Mobile',
    version: '0.1.0-alpha',
    quality: 'int8',
    diskFootprintMB: 780,
    languages: ['EN', 'JA', 'KO', 'ZH', 'VI'],
    inferenceSpeedRTF: 0.4,
    isOptimizedFor: ['iPhone 15 Pro'],
  },
  {
    id: 'whisper-small',
    name: 'Whisper-Small',
    version: '2.0.0-beta',
    quality: 'float16',
    diskFootprintMB: 456,
    languages: ['EN', 'ES', 'FR', 'DE', 'ZH', 'JA', 'KO'],
    inferenceSpeedRTF: 0.08,
    isOptimizedFor: ['Various devices'],
  },
];

const TOTAL_STORAGE_MB = 512;
const USED_STORAGE_MB = 234;

interface ModelRepositoryScreenProps {
  onNavigateBack?: () => void;
  onManageModels?: () => void;
}

type ModelRepositoryNavigationProp = StackNavigationProp<RootStackParamList, 'ModelRepository'>;

/**
 * ModelRepositoryScreen - Main model management UI
 */
export const ModelRepositoryScreen: React.FC<ModelRepositoryScreenProps> = ({
  onNavigateBack,
}) => {
  const modelState = useModelState();
  const translatorModelState = useTranslatorModelState();
  const navigation = useNavigation<ModelRepositoryNavigationProp>();
  const { setModelDownloading, setModelDownloadProgress, setModelReady, setModelDeleting, setModelDeleted, setTranslatorModelDownloading, setTranslatorModelDownloadProgress, setTranslatorModelReady, setTranslatorModelDeleting, setTranslatorModelDeleted } =
    useBootstrapStore();

  const [downloadingModelId, setDownloadingModelId] = useState<string | null>(null);
  const [downloadProgress, setDownloadProgress] = useState(0);

  const currentModelId = modelState.currentModel?.id ?? null;
  const currentModelStatus = modelState.status;

  /**
   * Handle model download with simulated progress
   */
  const handleDownload = useCallback(async (model: ModelInfo) => {
    try {
      setDownloadingModelId(model.id);
      setDownloadProgress(0);

      const totalBytes = model.diskFootprintMB * 1024 * 1024;
      let downloadedBytes = 0;

      const isTranslatorModel = model.id === 'nllb-600m-mobile';
      if (isTranslatorModel) {
        setTranslatorModelDownloading(model);
      } else {
        setModelDownloading(model);
      }

      const simulateDownload = () => {
        return new Promise<void>((resolve) => {
          const interval = setInterval(() => {
            downloadedBytes += totalBytes * 0.1;
            const progress = Math.min((downloadedBytes / totalBytes) * 100, 100);

            setDownloadProgress(progress);
            (isTranslatorModel ? setTranslatorModelDownloadProgress : setModelDownloadProgress)({
              bytesDownloaded: Math.round(downloadedBytes),
              totalBytes,
              percentage: progress,
            });

            if (progress >= 100) {
              clearInterval(interval);
              resolve();
            }
          }, 300);
        });
      };

      await simulateDownload();
      if (isTranslatorModel) {
        setTranslatorModelReady(model);
      } else {
        await getSTTProcessorInstance().loadModel();
        setModelReady(model);
      }
    } catch (error) {
      Alert.alert('Model download failed', 'Unable to prepare the speech model. Please try again.');
      if (model.id === 'nllb-600m-mobile') {
        setTranslatorModelDeleted();
      } else {
        setModelDeleted();
      }
      console.warn('[ModelRepositoryScreen] Failed to download/load model:', error);
    } finally {
      setDownloadingModelId(null);
      setDownloadProgress(0);
    }
  }, [setModelDeleted, setModelDownloading, setModelDownloadProgress, setModelReady, setTranslatorModelDeleted, setTranslatorModelDownloading, setTranslatorModelDownloadProgress, setTranslatorModelReady]);

  /**
   * Handle model deletion with confirmation
   */
  const handleDelete = useCallback(
    (model: ModelInfo) => {
      Alert.alert(
        'Delete Model',
        `Are you sure you want to delete ${model.name}? This will free up ${model.diskFootprintMB} MB of storage.`,
        [
          {
            text: 'Cancel',
            style: 'cancel',
          },
          {
            text: 'Delete',
            style: 'destructive',
            onPress: async () => {
               if (model.id === 'nllb-600m-mobile') {
                 setTranslatorModelDeleting();
               } else {
                 setModelDeleting();
               }
               // Simulate deletion delay
               await new Promise((resolve) => setTimeout(resolve, 1000));
               if (model.id === 'nllb-600m-mobile') {
                 setTranslatorModelDeleted();
               } else {
                 getSTTProcessorInstance().unloadModel();
                 setModelDeleted();
               }
            },
          },
        ],
        { cancelable: true }
      );
    },
    [setModelDeleting, setModelDeleted, setTranslatorModelDeleting, setTranslatorModelDeleted]
  );

  const usedStoragePercent = (USED_STORAGE_MB / TOTAL_STORAGE_MB) * 100;

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable
          style={styles.backButton}
          onPress={onNavigateBack ?? (() => navigation.goBack())}
          accessibilityLabel="Go back"
          accessibilityRole="button"
        >
          <AppIcon name="back" size={24} color={colors['on-surface']} />
        </Pressable>
        <Text style={styles.headerTitle}>AI Models</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Header Section */}
        <View style={styles.titleSection}>
          <Text style={styles.sectionLabel}>Repository Status</Text>
          <Text style={styles.sectionTitle}>Available Models</Text>
        </View>

        {/* Model Cards */}
        <View style={styles.modelCards}>
          {AVAILABLE_MODELS.map((model) => {
            const isDownloading = downloadingModelId === model.id;
            const isCurrentModel = currentModelId === model.id || translatorModelState.currentModel?.id === model.id;
            const status: ModelStatus = isDownloading
              ? 'downloading'
              : isCurrentModel
              ? (model.id === 'nllb-600m-mobile' ? translatorModelState.status : currentModelStatus)
              : 'missing';

            return (
              <View key={model.id}>
                {isDownloading && (
                  <View style={styles.downloadingCard}>
                    <ProgressCard
                      title={`Downloading ${model.name}...`}
                      subtitle={`${model.languages.join(' / ')}`}
                      progress={downloadProgress}
                      bytesDownloaded={Math.round(
                        (downloadProgress / 100) * model.diskFootprintMB * 1024 * 1024
                      )}
                      totalBytes={model.diskFootprintMB * 1024 * 1024}
                      status="downloading"
                    />
                  </View>
                )}
                {!isDownloading && (
                  <ModelCard
                    model={model}
                    status={status}
                    onDownload={() => handleDownload(model)}
                    onDelete={isCurrentModel ? () => handleDelete(model) : undefined}
                    disabled={modelState.status === 'deleting'}
                  />
                )}
              </View>
            );
          })}
        </View>

        {/* Coming Soon Card */}
        <View style={styles.comingSoonCard}>
          <View style={styles.comingSoonHeader}>
            <View style={styles.comingSoonTitle}>
              <AppIcon
                name="cloud-off"
                size={20}
                color={colors['on-surface-variant']}
              />
              <Text style={styles.comingSoonModelName}>Whisper-Small</Text>
            </View>
            <View style={styles.comingSoonBadge}>
              <Text style={styles.comingSoonBadgeText}>Coming Soon</Text>
            </View>
          </View>
          <Text style={styles.comingSoonVersion}>v2.0.0-beta</Text>
          <View style={styles.comingSoonProgress}>
            <View style={styles.progressBarBackground}>
              <View style={styles.progressBarFill} />
            </View>
            <Text style={styles.comingSoonProgressText}>
              Model weights being processed for NPU...
            </Text>
          </View>
          <Pressable style={styles.preRegisterButton} disabled>
            <Text style={styles.preRegisterButtonText}>Pre-register Model</Text>
          </Pressable>
        </View>

        {/* Storage Section */}
        <View style={styles.storageSection}>
          <View style={styles.storageCard}>
            <View style={styles.storageHeader}>
              <Text style={styles.storageTitle}>On-Device Storage</Text>
              <View style={styles.storageStats}>
                <Text style={styles.storageUsed}>{USED_STORAGE_MB} MB</Text>
                <Text style={styles.storageTotal}>/ {TOTAL_STORAGE_MB} MB</Text>
              </View>
            </View>

            <View style={styles.storageBar}>
              <View
                style={[
                  styles.storageBarFill,
                  { width: `${usedStoragePercent}%` },
                ]}
              />
            </View>

            <Text style={styles.storagePercentText}>{usedStoragePercent.toFixed(0)}% Used</Text>

            <Text style={styles.storageDescription}>
              Local models ensure zero-latency transcription and absolute privacy.
              Meetings are never sent to the cloud.
            </Text>
          </View>
        </View>
      </ScrollView>

      {/* Bottom Navigation */}
      <View style={styles.bottomNav}>
        <NavItem icon="forum" label="Meetings" active={false} onPress={() => {}} />
        <NavItem icon="memory" label="Models" active={true} onPress={() => {}} />
        <NavItem icon="insights" label="Intelligence" active={false} onPress={() => {}} />
        <NavItem icon="settings" label="Settings" active={false} onPress={() => {}} />
      </View>
    </SafeAreaView>
  );
};

// ============================================================================
// NavItem Component
// ============================================================================

interface NavItemProps {
  icon: 'forum' | 'memory' | 'insights' | 'settings';
  label: string;
  active: boolean;
  onPress: () => void;
}

const NavItem: React.FC<NavItemProps> = ({ icon, label, active, onPress }) => (
  <Pressable
    style={styles.navItem}
    onPress={onPress}
    accessibilityLabel={label}
    accessibilityRole="button"
  >
    <AppIcon
      name={icon}
      size={24}
      color={active ? colors.primary : colors['on-surface-variant']}
    />
    <Text style={[styles.navLabel, active && styles.navLabelActive]}>{label}</Text>
  </Pressable>
);

// ============================================================================
// Styles
// ============================================================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors['surface-dim'],
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    backgroundColor: colors['surface-container'],
    borderBottomWidth: 1,
    borderBottomColor: colors['outline-variant'],
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontFamily: typography.fontFamily.headline,
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold,
    color: colors['on-surface'],
  },
  headerSpacer: {
    width: 40,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: spacing.lg,
    paddingBottom: 120, // Space for bottom nav
  },
  titleSection: {
    marginBottom: spacing.lg,
  },
  sectionLabel: {
    fontFamily: typography.fontFamily.label,
    fontSize: typography.fontSize.xs,
    color: colors['on-surface-variant'],
    textTransform: 'uppercase',
    letterSpacing: typography.letterSpacing.widest,
    marginBottom: spacing.xs,
  },
  sectionTitle: {
    fontFamily: typography.fontFamily.headline,
    fontSize: typography.fontSize['3xl'],
    fontWeight: typography.fontWeight.extrabold,
    color: colors['on-surface'],
    letterSpacing: typography.letterSpacing.tight,
  },
  modelCards: {
    gap: spacing.lg,
  },
  downloadingCard: {
    marginBottom: spacing.sm,
  },
  comingSoonCard: {
    backgroundColor: colors['surface-container-lowest'],
    borderRadius: borderRadius.xl,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors['outline-variant'],
    opacity: 0.6,
    marginTop: spacing.lg,
  },
  comingSoonHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  comingSoonTitle: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  comingSoonModelName: {
    fontFamily: typography.fontFamily.headline,
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
    color: colors['on-surface-variant'],
  },
  comingSoonBadge: {
    backgroundColor: colors['surface-container-highest'],
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.full,
  },
  comingSoonBadgeText: {
    fontFamily: typography.fontFamily.label,
    fontSize: typography.fontSize.xs,
    color: colors['on-surface-variant'],
  },
  comingSoonVersion: {
    fontFamily: typography.fontFamily.label,
    fontSize: typography.fontSize.xs,
    color: colors['on-surface-variant'],
    marginTop: spacing.xxs,
    marginLeft: 28,
  },
  comingSoonProgress: {
    marginTop: spacing.md,
  },
  progressBarBackground: {
    height: 6,
    backgroundColor: colors['surface-container-highest'],
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    width: '0%',
    backgroundColor: colors['outline-variant'],
  },
  comingSoonProgressText: {
    fontFamily: typography.fontFamily.label,
    fontSize: typography.fontSize.xs,
    color: colors['on-surface-variant'],
    textAlign: 'center',
    marginTop: spacing.sm,
  },
  preRegisterButton: {
    marginTop: spacing.md,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.xl,
    borderWidth: 1,
    borderColor: colors['outline-variant'],
    alignItems: 'center',
  },
  preRegisterButtonText: {
    fontFamily: typography.fontFamily.label,
    fontSize: typography.fontSize.md,
    fontWeight: typography.fontWeight.bold,
    color: colors['on-surface-variant'],
  },
  storageSection: {
    marginTop: spacing.xl,
  },
  storageCard: {
    backgroundColor: colors['surface-container-low'],
    borderRadius: borderRadius.xl,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors['outline-variant'],
  },
  storageHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.md,
  },
  storageTitle: {
    fontFamily: typography.fontFamily.label,
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.bold,
    color: colors['on-surface'],
    textTransform: 'uppercase',
    letterSpacing: typography.letterSpacing.wider,
  },
  storageStats: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  storageUsed: {
    fontFamily: typography.fontFamily.label,
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold,
    color: colors.primary,
  },
  storageTotal: {
    fontFamily: typography.fontFamily.label,
    fontSize: typography.fontSize.md,
    color: colors['on-surface-variant'],
    marginLeft: spacing.xs,
  },
  storageBar: {
    height: 8,
    backgroundColor: colors['surface-container-highest'],
    borderRadius: 4,
    overflow: 'hidden',
    flexDirection: 'row',
  },
  storageBarFill: {
    height: '100%',
    backgroundColor: colors['primary-container'],
    borderRadius: 4,
  },
  storagePercentText: {
    fontFamily: typography.fontFamily.label,
    fontSize: typography.fontSize.xs,
    color: colors['on-surface-variant'],
    marginTop: spacing.sm,
    textAlign: 'right',
  },
  storageDescription: {
    fontFamily: typography.fontFamily.body,
    fontSize: typography.fontSize.sm,
    color: colors['on-surface-variant'],
    marginTop: spacing.md,
    lineHeight: typography.fontSize.sm * typography.lineHeight.relaxed,
  },
  bottomNav: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    height: 80,
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.md,
    backgroundColor: colors['surface-container-lowest'],
    borderTopWidth: 1,
    borderTopColor: colors['outline-variant'],
    borderTopLeftRadius: borderRadius.xl,
    borderTopRightRadius: borderRadius.xl,
  },
  navItem: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
  },
  navLabel: {
    fontFamily: typography.fontFamily.label,
    fontSize: typography.fontSize.xs,
    color: colors['on-surface-variant'],
    marginTop: spacing.xs,
    letterSpacing: typography.letterSpacing.widest,
    textTransform: 'uppercase',
  },
  navLabelActive: {
    color: colors.primary,
  },
});

export default ModelRepositoryScreen;
