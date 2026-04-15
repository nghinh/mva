/**
 * ModelRepositoryScreen
 *
 * Bundled model management UI for offline-only mode.
 * No network download, no AI-analysis settings, no server dependency.
 */

import React, {useCallback, useMemo, useState} from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Alert,
  SafeAreaView,
} from 'react-native';
import {useNavigation} from '../../../app/navigation/router';
import {StackNavigationProp} from '../../../app/navigation/router';
import {RootStackParamList} from '../../../app/navigation/router';
import {AppIcon} from '../../../shared/components/ui';
import {useTheme} from '../../../shared/hooks/useTheme';
import {useBootstrapStore, useModelState, useTranslatorModelState} from '../../../shared/store';
import {ModelInfo, ModelStatus} from '../../../shared/types';
import {getSTTProcessorInstance} from '../../../native/stt/STTProcessor';
import {
  areBundledAssetsAvailable,
  areInstalledModelFilesPresent,
  deleteInstalledModelFiles,
  ensureBundledModelInstalled,
} from '../../../native/models/BundledModelInstaller';
import {getOnDeviceTranslator} from '../../../services/OnDeviceTranslator';
import {getSpeakerEmbeddingService} from '../../../native/speaker/SpeakerEmbeddingService';

type ModelRepositoryNavigationProp = StackNavigationProp<RootStackParamList, 'ModelRepository'>;

interface ModelRepositoryScreenProps {
  onNavigateBack?: () => void;
}

const BUNDLED_MODELS: ModelInfo[] = [
  {
    id: 'sensevoice-small',
    name: 'SenseVoice-Small',
    version: '1.2.4-bundled',
    quality: 'int8',
    diskFootprintMB: 234,
    languages: ['EN', 'JA', 'KO', 'ZH'],
    inferenceSpeedRTF: 0.05,
    isOptimizedFor: ['iPhone 15 Pro'],
  },
  {
    id: 'nllb-600m-mobile',
    name: 'NLLB-600M',
    version: '0.1.0-bundled',
    quality: 'int8',
    diskFootprintMB: 780,
    languages: ['EN', 'JA', 'KO', 'ZH', 'VI'],
    inferenceSpeedRTF: 0.4,
    isOptimizedFor: ['iPhone 15 Pro'],
  },
  {
    id: 'speaker-diarization',
    name: 'Speaker Diarization',
    version: '1.0.0-bundled',
    quality: 'int8',
    diskFootprintMB: 35,
    languages: ['S1', 'S2', 'S3'],
    inferenceSpeedRTF: 0.03,
    isOptimizedFor: ['iPhone 14 Pro Max'],
  },
];

function getStatusMeta(status: ModelStatus, colors: ReturnType<typeof useTheme>['theme']['colors']) {
  switch (status) {
    case 'cached-ready':
      return {label: 'Ready', color: colors.secondary, icon: 'check-circle'};
    case 'downloading':
      return {label: 'Preparing', color: colors.primary, icon: 'download'};
    case 'deleting':
      return {label: 'Removing', color: colors.error, icon: 'delete'};
    case 'invalid':
      return {label: 'Invalid', color: colors.error, icon: 'error'};
    case 'missing':
    default:
      return {label: 'Missing', color: colors.text.tertiary, icon: 'cloud-off'};
  }
}

export function ModelRepositoryScreen({onNavigateBack}: ModelRepositoryScreenProps): React.JSX.Element {
  const {theme} = useTheme();
  const navigation = useNavigation<ModelRepositoryNavigationProp>();
  const modelState = useModelState();
  const translatorModelState = useTranslatorModelState();
  const {
    setModelDownloading,
    setModelDownloadProgress,
    setModelReady,
    setModelError,
    setModelDeleting,
    setModelDeleted,
    setTranslatorModelDownloading,
    setTranslatorModelDownloadProgress,
    setTranslatorModelReady,
    setTranslatorModelError,
    setTranslatorModelDeleting,
    setTranslatorModelDeleted,
  } = useBootstrapStore();

  const [busyModelId, setBusyModelId] = useState<string | null>(null);
  const [assetAvailability, setAssetAvailability] = useState<Record<string, boolean>>({});

  React.useEffect(() => {
    let mounted = true;
    const load = async () => {
      const [sttAvailable, nllbAvailable, diarizationAvailable, sttInstalled, nllbInstalled, diarizationInstalled] = await Promise.all([
        areBundledAssetsAvailable('stt'),
        areBundledAssetsAvailable('nllb'),
        areBundledAssetsAvailable('diarization'),
        areInstalledModelFilesPresent('stt'),
        areInstalledModelFilesPresent('nllb'),
        areInstalledModelFilesPresent('diarization'),
      ]);
      if (!mounted) return;
      setAssetAvailability({
        'sensevoice-small': sttAvailable && sttInstalled,
        'nllb-600m-mobile': nllbAvailable && nllbInstalled,
        'speaker-diarization': diarizationAvailable && diarizationInstalled,
      });
    };
    load().catch(() => undefined);
    return () => {
      mounted = false;
    };
  }, []);

  const handlePrepare = useCallback(async (model: ModelInfo) => {
    const isTranslator = model.id === 'nllb-600m-mobile';
    const isDiarization = model.id === 'speaker-diarization';
    const totalBytes = model.diskFootprintMB * 1024 * 1024;
    setBusyModelId(model.id);

    try {
      if (isTranslator) {
        setTranslatorModelDownloading(model);
        await ensureBundledModelInstalled('nllb', (completed, total) => {
          const percentage = Math.round((completed / total) * 100);
          setTranslatorModelDownloadProgress({
            bytesDownloaded: Math.round((totalBytes * percentage) / 100),
            totalBytes,
            percentage,
          });
        });
        setTranslatorModelReady(model);
      } else if (isDiarization) {
        await ensureBundledModelInstalled('diarization');
        await getSpeakerEmbeddingService().initialize();
      } else {
        setModelDownloading(model);
        await ensureBundledModelInstalled('stt', (completed, total) => {
          const percentage = Math.round((completed / total) * 100);
          setModelDownloadProgress({
            bytesDownloaded: Math.round((totalBytes * percentage) / 100),
            totalBytes,
            percentage,
          });
        });
        await getSTTProcessorInstance().loadModel();
        setModelReady(model);
      }

      setAssetAvailability((prev) => ({...prev, [model.id]: true}));
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Bundled model preparation failed.';
        if (isTranslator) {
          setTranslatorModelError(message);
        } else if (!isDiarization) {
          setModelError(message);
        }
      Alert.alert('Preparation failed', message);
    } finally {
      setBusyModelId(null);
    }
  }, [setModelDownloadProgress, setModelDownloading, setModelError, setModelReady, setTranslatorModelDownloadProgress, setTranslatorModelDownloading, setTranslatorModelError, setTranslatorModelReady]);

  const handleRemove = useCallback((model: ModelInfo) => {
    Alert.alert(
      'Remove bundled model',
      `Remove ${model.name} from local prepared storage? Bundled app resources remain available for preparing again later.`,
      [
        {text: 'Cancel', style: 'cancel'},
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
    const isTranslator = model.id === 'nllb-600m-mobile';
    const isDiarization = model.id === 'speaker-diarization';
            setBusyModelId(model.id);
            try {
              if (isTranslator) {
                setTranslatorModelDeleting();
                await deleteInstalledModelFiles('nllb');
                await getOnDeviceTranslator().unload();
                setTranslatorModelDeleted();
              } else if (isDiarization) {
                await deleteInstalledModelFiles('diarization');
                getSpeakerEmbeddingService().release();
              } else {
                setModelDeleting();
                await deleteInstalledModelFiles('stt');
                getSTTProcessorInstance().unloadModel();
                setModelDeleted();
              }
              setAssetAvailability((prev) => ({...prev, [model.id]: false}));
            } catch (error) {
              const message = error instanceof Error ? error.message : 'Unable to remove local model files.';
              Alert.alert('Remove failed', message);
              if (isTranslator) {
                setTranslatorModelReady(model);
              } else if (!isDiarization) {
                setModelReady(model);
              }
            } finally {
              setBusyModelId(null);
            }
          },
        },
      ],
    );
  }, [setModelDeleted, setModelDeleting, setModelReady, setTranslatorModelDeleted, setTranslatorModelDeleting, setTranslatorModelReady]);

  const usedStorageMB = useMemo(
    () => BUNDLED_MODELS.reduce((sum, model) => sum + (assetAvailability[model.id] ? model.diskFootprintMB : 0), 0),
    [assetAvailability],
  );

  const totalStorageMB = useMemo(() => BUNDLED_MODELS.reduce((sum, model) => sum + model.diskFootprintMB, 0), []);

  const renderCard = (model: ModelInfo) => {
    const diarizationPrepared = assetAvailability[model.id] ?? false;
    const state = model.id === 'nllb-600m-mobile'
      ? translatorModelState
      : model.id === 'speaker-diarization'
        ? ({status: diarizationPrepared ? 'cached-ready' : 'missing'} as {status: ModelStatus})
        : modelState;
    const prepared = assetAvailability[model.id] || state.status === 'cached-ready';
    const statusMeta = getStatusMeta(state.status, theme.colors);
    const canManage = busyModelId == null;

    return (
      <View key={model.id} style={[styles.card, {backgroundColor: theme.colors.surface.primary, borderColor: theme.colors.border.subtle}]}> 
        <View style={styles.cardHeader}>
          <View style={styles.cardTitleWrap}>
            <AppIcon name="memory" size={18} color={theme.colors.primary} />
            <View style={styles.cardTitleTextWrap}>
              <Text style={[styles.cardTitle, {color: theme.colors.text.primary}]}>{model.name}</Text>
              <Text style={[styles.cardVersion, {color: theme.colors.text.tertiary}]}>v{model.version}</Text>
            </View>
          </View>
          <View style={[styles.badge, {backgroundColor: `${statusMeta.color}18`, borderColor: `${statusMeta.color}33`}]}> 
            <AppIcon name={statusMeta.icon as never} size={12} color={statusMeta.color} />
            <Text style={[styles.badgeText, {color: statusMeta.color}]}>{statusMeta.label}</Text>
          </View>
        </View>

        <Text style={[styles.cardSubtext, {color: theme.colors.text.tertiary}]}>
          {model.id === 'sensevoice-small' ? 'Bundled speech-to-text model' : 'Bundled offline translation model'}
        </Text>

        <View style={styles.statsRow}>
          <View>
            <Text style={[styles.statLabel, {color: theme.colors.text.tertiary}]}>Size</Text>
            <Text style={[styles.statValue, {color: theme.colors.text.primary}]}>{model.diskFootprintMB} MB</Text>
          </View>
          <View>
            <Text style={[styles.statLabel, {color: theme.colors.text.tertiary}]}>Speed</Text>
            <Text style={[styles.statValue, {color: theme.colors.secondary}]}>RTF {model.inferenceSpeedRTF.toFixed(2)}</Text>
          </View>
        </View>

        <View style={styles.languageRow}>
          {model.languages.map((lang) => (
            <View key={lang} style={[styles.langChip, {backgroundColor: theme.colors.surface.secondary}]}> 
              <Text style={[styles.langChipText, {color: theme.colors.text.secondary}]}>{lang}</Text>
            </View>
          ))}
        </View>

        <View style={styles.footerRow}>
          <Text style={[styles.optimizedText, {color: theme.colors.text.tertiary}]}>Optimized for {model.isOptimizedFor.join(', ')}</Text>
          {prepared ? (
            <Pressable onPress={() => handleRemove(model)} disabled={!canManage} style={styles.actionButton}>
              <AppIcon name="delete" size={16} color={theme.colors.error} />
              <Text style={[styles.actionDanger, {color: theme.colors.error}]}>Remove</Text>
            </Pressable>
          ) : (
            <Pressable onPress={() => handlePrepare(model)} disabled={!canManage} style={styles.actionButton}>
              <AppIcon name="download" size={16} color={theme.colors.primary} />
              <Text style={[styles.actionPrimary, {color: theme.colors.primary}]}>{busyModelId === model.id ? 'Preparing…' : 'Prepare'}</Text>
            </Pressable>
          )}
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={[styles.container, {backgroundColor: theme.colors.background.secondary}]}> 
      <View style={[styles.header, {backgroundColor: theme.colors.surface.primary}]}> 
        <Pressable onPress={onNavigateBack ?? (() => navigation.goBack())} style={styles.backButton}>
          <AppIcon name="back" size={24} color={theme.colors.text.primary} />
        </Pressable>
        <Text style={[styles.headerTitle, {color: theme.colors.text.primary}]}>AI Models</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.titleSection}>
          <Text style={[styles.eyebrow, {color: theme.colors.text.tertiary}]}>Bundled Models</Text>
          <Text style={[styles.title, {color: theme.colors.text.primary}]}>On-device AI</Text>
          <Text style={[styles.subtitle, {color: theme.colors.text.tertiary}]}>Models ship with the app and are prepared locally when needed. No network download. No AI analysis lane.</Text>
        </View>

        <View style={styles.cardList}>{BUNDLED_MODELS.map(renderCard)}</View>

        <View style={[styles.storageCard, {backgroundColor: theme.colors.surface.primary, borderColor: theme.colors.border.subtle}]}> 
          <View style={styles.storageHeader}>
            <Text style={[styles.storageTitle, {color: theme.colors.text.primary}]}>On-device storage</Text>
            <Text style={[styles.storageValuePrimary, {color: theme.colors.primary}]}>{usedStorageMB} MB / {totalStorageMB} MB</Text>
          </View>
          <View style={[styles.progressTrack, {backgroundColor: theme.colors.surface.secondary}]}> 
            <View style={[styles.progressFill, {backgroundColor: theme.colors.primary, width: `${Math.min(100, Math.round((usedStorageMB / totalStorageMB) * 100))}%`}]} />
          </View>
          <Text style={[styles.storageBody, {color: theme.colors.text.tertiary}]}>Local model preparation preserves absolute privacy: transcript, translation, and model inference stay inside the app sandbox.</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {flex: 1},
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  backButton: {width: 40, height: 40, alignItems: 'center', justifyContent: 'center'},
  headerTitle: {fontSize: 20, fontWeight: '700'},
  headerSpacer: {width: 40},
  scrollView: {flex: 1},
  scrollContent: {padding: 16, paddingBottom: 40, gap: 16},
  titleSection: {gap: 6},
  eyebrow: {fontSize: 10, fontWeight: '700', letterSpacing: 1.4, textTransform: 'uppercase'},
  title: {fontSize: 30, fontWeight: '800', letterSpacing: -0.6},
  subtitle: {fontSize: 14, lineHeight: 20},
  cardList: {gap: 16},
  card: {borderWidth: 1, borderRadius: 20, padding: 16, gap: 12},
  cardHeader: {flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12},
  cardTitleWrap: {flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1},
  cardTitleTextWrap: {flex: 1},
  cardTitle: {fontSize: 18, fontWeight: '700'},
  cardVersion: {fontSize: 11},
  badge: {flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999},
  badgeText: {fontSize: 11, fontWeight: '700'},
  cardSubtext: {fontSize: 13, lineHeight: 18},
  statsRow: {flexDirection: 'row', justifyContent: 'space-between'},
  statLabel: {fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.8},
  statValue: {fontSize: 14, fontWeight: '700', marginTop: 2},
  languageRow: {flexDirection: 'row', gap: 8, flexWrap: 'wrap'},
  langChip: {paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10},
  langChipText: {fontSize: 11, fontWeight: '700'},
  footerRow: {flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12},
  optimizedText: {fontSize: 11, flex: 1},
  actionButton: {flexDirection: 'row', alignItems: 'center', gap: 6},
  actionPrimary: {fontSize: 13, fontWeight: '700'},
  actionDanger: {fontSize: 13, fontWeight: '700'},
  storageCard: {borderWidth: 1, borderRadius: 20, padding: 16, gap: 12},
  storageHeader: {flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12},
  storageTitle: {fontSize: 16, fontWeight: '700'},
  storageValuePrimary: {fontSize: 14, fontWeight: '700'},
  progressTrack: {height: 8, borderRadius: 999, overflow: 'hidden'},
  progressFill: {height: '100%', borderRadius: 999},
  storageBody: {fontSize: 13, lineHeight: 18},
});

export default ModelRepositoryScreen;
