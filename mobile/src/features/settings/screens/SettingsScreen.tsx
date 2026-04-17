/**
 * Settings Screen
 *
 * Professional settings layout for offline model management and app preferences.
 * All AI inference runs locally — no network dependency.
 */

import React, {useState, useCallback} from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
  Alert,
  SafeAreaView,
  Modal,
} from 'react-native';
import {useNavigation} from '../../../app/navigation/router';
import {StackNavigationProp} from '../../../app/navigation/router';
import {useTheme} from '../../../shared/hooks/useTheme';
import {RootStackParamList} from '../../../app/navigation/router';
import {
  useDeveloperMode,
  useSettingsStore,
  useModelState,
  useTranslatorModelState,
  useTargetLanguage,
  useThemeMode,
  useDiarizationThreshold,
  TARGET_LANGUAGE_OPTIONS,
  getLanguageOption,
} from '../../../shared/store';
import {
  formatDiarizationThreshold,
  getDiarizationThresholdLabel,
  getDiarizationThresholdDescription,
  DIARIZATION_THRESHOLD_MIN,
  DIARIZATION_THRESHOLD_MAX,
} from '../../../shared/config/runtimeConfig';
import {getPersistenceService} from '../../../services/persistence';
import {getSpeakerClusterService, type SpeakerClusterConfig} from '../../../services/speaker/SpeakerClusterService';
import {spacing, borderRadius, typography} from '../../../shared/constants';
import {AppBottomNav, AppIcon} from '../../../shared/components/ui';

type SettingsNavigationProp = StackNavigationProp<RootStackParamList, 'Settings'>;

// Bundled model info (sizes are fixed for bundled models)
const SENSEVOICE_SIZE_MB = 234;
const NLLB_SIZE_MB = 780;
const DIARIZATION_SIZE_MB = 35;
const TOTAL_MODELS_SIZE_MB = SENSEVOICE_SIZE_MB + NLLB_SIZE_MB + DIARIZATION_SIZE_MB;

// Language flag emojis for selector
const LANGUAGE_FLAGS: Record<string, string> = {
  en: '🇬🇧',
  vi: '🇻🇳',
  zh: '🇨🇳',
  ko: '🇰🇷',
  ja: '🇯🇵',
};

export function SettingsScreen(): React.JSX.Element {
  const {theme} = useTheme();
  const navigation = useNavigation<SettingsNavigationProp>();
  const developerMode = useDeveloperMode();
  const themeMode = useThemeMode();
  const {setDeveloperMode, setThemeMode} = useSettingsStore();
  const modelState = useModelState();
  const translatorModelState = useTranslatorModelState();
  const targetLanguage = useTargetLanguage();
  const {setTargetLanguage} = useSettingsStore();
  const currentLangOption = getLanguageOption(targetLanguage);
  const diarizationThreshold = useDiarizationThreshold();
  const {setDiarizationThreshold} = useSettingsStore();

  // Session data size estimation (would be derived from persistence in production)
  const [sessionDataSizeMB] = useState<number>(0);
  const [langSelectorVisible, setLangSelectorVisible] = useState(false);

  // Diarization tuning state (dev mode only)
  const [clusterConfig, setClusterConfig] = useState<SpeakerClusterConfig>(() => getSpeakerClusterService().getConfig());
  const updateClusterParam = useCallback(<K extends keyof SpeakerClusterConfig>(key: K, value: SpeakerClusterConfig[K]) => {
    const updated = {...clusterConfig, [key]: value};
    setClusterConfig(updated);
    getSpeakerClusterService().setConfig({[key]: value});
  }, [clusterConfig]);
  const resetClusterDefaults = useCallback(() => {
    const fresh = getSpeakerClusterService().getConfig();
    const defaults: SpeakerClusterConfig = {
      similarityThreshold: 0.50,
      highConfidenceThreshold: 0.65,
      lowConfidenceThreshold: 0.22,
      minUtteranceDuration: 1.0,
      temporalBiasWindow: 10.0,
      temporalBiasBoost: 0.05,
      maxEmbeddingsPerCluster: 30,
      minClusterSize: 3,
      clusterMergeThreshold: 0.68,
      maxSpeakers: 8,
    };
    getSpeakerClusterService().setConfig(defaults);
    setClusterConfig(defaults);
  }, []);

  // Speaker sensitivity preset options
  // Values are blended 30% with the algorithm's internal 0.55 default,
  // so the effective threshold range is narrower than these raw values.
  const SENSITIVITY_PRESETS = [
    {label: 'Low', value: 0.40, description: 'Fewer speaker labels'},
    {label: 'Medium', value: 0.55, description: 'Balanced'},
    {label: 'High', value: 0.70, description: 'More speaker labels'},
  ] as const;

  const currentSensitivityLabel = getDiarizationThresholdLabel(diarizationThreshold);

  const handleSensitivityChange = useCallback((value: number) => {
    setDiarizationThreshold(value);
  }, [setDiarizationThreshold]);

  const handleDeleteAllSessions = useCallback(async () => {
    Alert.alert(
      'Delete All Sessions',
      'Permanently delete all meeting sessions, transcripts, and translations? This cannot be undone.',
      [
        {text: 'Cancel', style: 'cancel'},
        {
          text: 'Delete All',
          style: 'destructive',
          onPress: async () => {
            try {
              const persistence = getPersistenceService();
              await persistence.deleteAllSessions();
            } catch (error) {
              console.warn('[SettingsScreen] Failed to delete all sessions:', error);
              Alert.alert('Error', 'Failed to delete all sessions. Please try again.');
            }
          },
        },
      ],
    );
  }, []);

  const getModelStatusDisplay = (status: string, isReady: boolean) => {
    if (isReady || status === 'cached-ready') {
      return {icon: 'check-circle', color: theme.colors.secondary, label: 'Ready'};
    }
    if (status === 'downloading') {
      return {icon: 'download', color: theme.colors.primary, label: 'Preparing'};
    }
    if (status === 'deleting') {
      return {icon: 'delete', color: theme.colors.error, label: 'Removing'};
    }
    if (status === 'invalid') {
      return {icon: 'error', color: theme.colors.error, label: 'Invalid'};
    }
    return {icon: 'cloud-off', color: theme.colors.text.tertiary, label: 'Not Available'};
  };

  const sttStatus = getModelStatusDisplay(modelState.status, modelState.status === 'cached-ready');
  const nllbStatus = getModelStatusDisplay(translatorModelState.status, translatorModelState.status === 'cached-ready');

  const renderModelCard = (
    name: string,
    description: string,
    sizeMB: number,
    statusInfo: {icon: string; color: string; label: string},
    onPress?: () => void,
  ) => (
    <TouchableOpacity
      style={[styles.modelCard, {backgroundColor: theme.colors.surface.container}]}
      onPress={onPress}
      activeOpacity={onPress ? 0.7 : 1}
      disabled={!onPress}>
      <View style={styles.modelCardHeader}>
        <View style={styles.modelCardInfo}>
          <Text style={[styles.modelCardName, {color: theme.colors.text.primary}]}>{name}</Text>
          <Text style={[styles.modelCardDesc, {color: theme.colors.text.tertiary}]}>{description}</Text>
        </View>
        <View style={[styles.statusBadge, {backgroundColor: statusInfo.color + '20', borderColor: statusInfo.color + '40'}]}>
          <AppIcon name={statusInfo.icon as any} size={12} color={statusInfo.color} />
          <Text style={[styles.statusBadgeText, {color: statusInfo.color}]}>{statusInfo.label}</Text>
        </View>
      </View>
      <View style={styles.modelCardFooter}>
        <Text style={[styles.modelCardSize, {color: theme.colors.text.tertiary}]}>{sizeMB} MB</Text>
        {onPress && (
          <Text style={[styles.modelCardAction, {color: theme.colors.primary}]}>Manage</Text>
        )}
      </View>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={[styles.container, {backgroundColor: theme.colors.background.primary}]}> 
      {/* Header */}
      <View style={[styles.header, {backgroundColor: theme.colors.surface.primary}]}>
        <TouchableOpacity onPress={() => navigation.goBack()} activeOpacity={0.7} style={styles.backButton}>
          <AppIcon name="back" size={24} color={theme.colors.text.primary} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, {color: theme.colors.text.primary}]}>Settings</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView style={styles.content} contentContainerStyle={styles.scrollContent}>
        {/* AI Models Section */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>AI Models</Text>
          <Text style={styles.sectionSubtitle}>Bundled offline models — all processing happens on-device</Text>

          {renderModelCard(
            'SenseVoice-Small',
            'Speech recognition (STT)',
            SENSEVOICE_SIZE_MB,
            sttStatus,
            () => navigation.navigate('ModelRepository'),
          )}
          {renderModelCard(
            'NLLB-600M',
            'Neural machine translation',
            NLLB_SIZE_MB,
            nllbStatus,
            () => navigation.navigate('ModelRepository'),
          )}
          {renderModelCard(
            'Speaker Diarization',
            'Per-utterance speaker labeling (S1, S2, S3...)',
            DIARIZATION_SIZE_MB,
            {icon: 'check-circle', color: theme.colors.secondary, label: 'Bundled'},
            () => navigation.navigate('ModelRepository'),
          )}
        </View>

        {/* Appearance Section */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Appearance</Text>
          <View style={[styles.card, {backgroundColor: theme.colors.surface.primary}]}> 
            <View style={styles.settingInfo}>
              <Text style={[styles.settingLabel, {color: theme.colors.text.primary}]}>Theme</Text>
              <Text style={[styles.settingDesc, {color: theme.colors.text.tertiary}]}>Use one consistent app theme across Meetings, Live, and Network.</Text>
            </View>
            <View style={styles.themeModeRow}>
              {([
                {key: 'system', label: 'System'},
                {key: 'light', label: 'Light'},
                {key: 'dark', label: 'Dark'},
              ] as const).map((option) => {
                const active = themeMode === option.key;
                return (
                  <TouchableOpacity
                    key={option.key}
                    style={[
                      styles.themeModeButton,
                      active
                        ? {backgroundColor: theme.colors.primary + '25', borderColor: theme.colors.primary}
                        : {backgroundColor: theme.colors.surface.container, borderColor: theme.colors.border.subtle},
                    ]}
                    onPress={() => setThemeMode(option.key)}
                    activeOpacity={0.7}>
                    <Text style={{color: active ? theme.colors.primary : theme.colors.text.primary, fontWeight: '700'}}>{option.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        </View>

        {/* Translation Section */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Translation</Text>
          <View style={[styles.card, {backgroundColor: theme.colors.surface.primary}]}>
            <TouchableOpacity
              style={styles.settingRow}
              onPress={() => setLangSelectorVisible(true)}
              activeOpacity={0.7}>
              <View style={styles.settingInfo}>
                <Text style={[styles.settingLabel, {color: theme.colors.text.primary}]}>Target Language</Text>
                <Text style={[styles.settingDesc, {color: theme.colors.text.tertiary}]}>
                  All translations output to this language
                </Text>
              </View>
              <View style={[styles.languageSelector, {backgroundColor: theme.colors.surface.container}]}>
                <Text style={[styles.languageFlag]}>{LANGUAGE_FLAGS[targetLanguage] ?? '🇻🇳'}</Text>
                <Text style={[styles.languageCode, {color: theme.colors.text.primary}]}>
                  {targetLanguage.toUpperCase()}
                </Text>
                <AppIcon name="chevron-down" size={16} color={theme.colors.text.tertiary} />
              </View>
            </TouchableOpacity>
          </View>
        </View>

        {/* Speaker Detection Section */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Speaker Detection</Text>
          <View style={[styles.card, {backgroundColor: theme.colors.surface.primary}]}>
            <View style={styles.speakerDetectionHeader}>
              <View style={styles.settingInfo}>
                <Text style={[styles.settingLabel, {color: theme.colors.text.primary}]}>Sensitivity</Text>
                <Text style={[styles.settingDesc, {color: theme.colors.text.tertiary}]}>
                  {getDiarizationThresholdDescription()}
                </Text>
              </View>
              <View style={[styles.sensitivityBadge, {backgroundColor: theme.colors.primary + '20'}]}>
                <Text style={[styles.sensitivityBadgeText, {color: theme.colors.primary}]}>
                  {currentSensitivityLabel}
                </Text>
              </View>
            </View>

            {/* Sensitivity preset buttons */}
            <View style={styles.sensitivityPresets}>
              {SENSITIVITY_PRESETS.map((preset) => {
                const isSelected = Math.abs(diarizationThreshold - preset.value) < 0.05;
                return (
                  <TouchableOpacity
                    key={preset.label}
                    style={[
                      styles.sensitivityPresetButton,
                      isSelected
                        ? {backgroundColor: theme.colors.primary + '30', borderColor: theme.colors.primary, borderWidth: 1}
                        : {backgroundColor: theme.colors.surface.container},
                    ]}
                    onPress={() => handleSensitivityChange(preset.value)}
                    activeOpacity={0.7}>
                    <Text
                      style={[
                        styles.sensitivityPresetLabel,
                        {color: isSelected ? theme.colors.primary : theme.colors.text.primary},
                      ]}>
                      {preset.label}
                    </Text>
                    <Text
                      style={[
                        styles.sensitivityPresetValue,
                        {color: isSelected ? theme.colors.primary : theme.colors.text.tertiary},
                      ]}>
                      {formatDiarizationThreshold(preset.value)}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Current value indicator */}
            <View style={styles.sensitivityCurrentValue}>
              <Text style={[styles.sensitivityCurrentLabel, {color: theme.colors.text.tertiary}]}>
                Current:
              </Text>
              <Text style={[styles.sensitivityCurrentValueText, {color: theme.colors.text.primary}]}>
                {formatDiarizationThreshold(diarizationThreshold)}
              </Text>
            </View>
          </View>
        </View>

        {/* Storage Section */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Storage</Text>
          <View style={[styles.card, {backgroundColor: theme.colors.surface.primary}]}>
            <View style={styles.storageRow}>
              <Text style={[styles.storageLabel, {color: theme.colors.text.tertiary}]}>AI Models</Text>
              <Text style={[styles.storageValue, {color: theme.colors.text.primary}]}>{TOTAL_MODELS_SIZE_MB} MB</Text>
            </View>
            <View style={[styles.divider, {backgroundColor: theme.colors.border.subtle}]} />
            <View style={styles.storageRow}>
              <Text style={[styles.storageLabel, {color: theme.colors.text.tertiary}]}>Session Data</Text>
              <Text style={[styles.storageValue, {color: theme.colors.text.primary}]}>
                {sessionDataSizeMB > 0 ? `${sessionDataSizeMB} MB` : '—'}
              </Text>
            </View>
            <View style={[styles.divider, {backgroundColor: theme.colors.border.subtle}]} />
            <View style={styles.totalRow}>
              <Text style={[styles.totalLabel, {color: theme.colors.text.primary}]}>Total Local</Text>
              <Text style={[styles.totalValue, {color: theme.colors.primary}]}>
                {TOTAL_MODELS_SIZE_MB + sessionDataSizeMB} MB
              </Text>
            </View>
          </View>

          <TouchableOpacity
            style={[styles.deleteButton, {borderColor: theme.colors.error + '40'}]}
            onPress={handleDeleteAllSessions}
            activeOpacity={0.7}>
            <AppIcon name="delete" size={18} color={theme.colors.error} />
            <Text style={[styles.deleteButtonText, {color: theme.colors.error}]}>Delete All Sessions</Text>
          </TouchableOpacity>
        </View>

        {/* Developer Mode Section */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Developer Options</Text>
          <View style={[styles.card, {backgroundColor: theme.colors.surface.primary}]}>
            <View style={styles.settingRow}>
              <View style={styles.settingInfo}>
                <Text style={[styles.settingLabel, {color: theme.colors.text.primary}]}>Developer Mode</Text>
                <Text style={[styles.settingDesc, {color: theme.colors.text.tertiary}]}>
                  Show performance metrics overlay during meetings
                </Text>
              </View>
              <Switch
                value={developerMode}
                onValueChange={setDeveloperMode}
                trackColor={{false: theme.colors.surface.container, true: theme.colors.primary + '60'}}
                thumbColor={developerMode ? theme.colors.primary : theme.colors.text.tertiary}
              />
            </View>
          </View>

          {/* Diarization Tuning — only when developer mode is ON */}
          {developerMode && (
            <View style={[styles.card, {backgroundColor: theme.colors.surface.primary, marginTop: spacing.sm}]}>
              <View style={{padding: spacing.md, gap: spacing.xs}}>
                <Text style={[styles.settingLabel, {color: theme.colors.text.primary}]}>Speaker Diarization Tuning</Text>
                <Text style={[styles.settingDesc, {color: theme.colors.text.tertiary, marginBottom: spacing.sm}]}>
                  Fine-tune clustering parameters for speaker identification
                </Text>

                {([
                  {key: 'similarityThreshold' as const, label: 'Similarity Threshold', min: 0.30, max: 0.80, step: 0.05},
                  {key: 'highConfidenceThreshold' as const, label: 'High Confidence', min: 0.55, max: 0.85, step: 0.05},
                  {key: 'lowConfidenceThreshold' as const, label: 'Low Confidence', min: 0.20, max: 0.50, step: 0.05},
                  {key: 'clusterMergeThreshold' as const, label: 'Merge Threshold', min: 0.45, max: 0.75, step: 0.05},
                  {key: 'temporalBiasBoost' as const, label: 'Temporal Bias Boost', min: 0.00, max: 0.20, step: 0.02},
                  {key: 'temporalBiasWindow' as const, label: 'Temporal Window (s)', min: 3, max: 30, step: 1},
                  {key: 'minUtteranceDuration' as const, label: 'Min Utterance (s)', min: 0.5, max: 3.0, step: 0.5},
                  {key: 'maxSpeakers' as const, label: 'Max Speakers', min: 2, max: 12, step: 1},
                ] as const).map(({key, label, min, max, step}) => (
                  <View key={key} style={styles.tuningRow}>
                    <Text style={[styles.tuningLabel, {color: theme.colors.text.secondary}]}>{label}</Text>
                    <View style={styles.tuningControls}>
                      <TouchableOpacity
                        onPress={() => {
                          const cur = clusterConfig[key] as number;
                          const next = Math.max(min, Math.round((cur - step) * 100) / 100);
                          updateClusterParam(key, next);
                        }}
                        style={[styles.tuningBtn, {backgroundColor: theme.colors.surface.container}]}>
                        <Text style={[styles.tuningBtnText, {color: theme.colors.text.primary}]}>−</Text>
                      </TouchableOpacity>
                      <Text style={[styles.tuningValue, {color: theme.colors.primary}]}>
                        {typeof clusterConfig[key] === 'number' && (clusterConfig[key] as number) % 1 !== 0
                          ? (clusterConfig[key] as number).toFixed(2)
                          : String(clusterConfig[key])}
                      </Text>
                      <TouchableOpacity
                        onPress={() => {
                          const cur = clusterConfig[key] as number;
                          const next = Math.min(max, Math.round((cur + step) * 100) / 100);
                          updateClusterParam(key, next);
                        }}
                        style={[styles.tuningBtn, {backgroundColor: theme.colors.surface.container}]}>
                        <Text style={[styles.tuningBtnText, {color: theme.colors.text.primary}]}>+</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                ))}

                <TouchableOpacity
                  style={[styles.resetDefaultsButton, {borderColor: theme.colors.border.subtle}]}
                  onPress={resetClusterDefaults}
                  activeOpacity={0.7}>
                  <Text style={[styles.resetDefaultsText, {color: theme.colors.text.secondary}]}>Reset to Defaults</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </View>

        {/* Privacy Section */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Privacy</Text>
          <View style={[styles.card, {backgroundColor: theme.colors.surface.primary}]}>
            <View style={styles.privacyRow}>
              <View style={styles.privacyBadge}>
                <AppIcon name="check-circle" size={20} color={theme.colors.secondary} />
                <Text style={[styles.privacyBadgeText, {color: theme.colors.secondary}]}>100% Offline</Text>
              </View>
              <Text style={[styles.privacyDesc, {color: theme.colors.text.tertiary}]}>
                All AI inference runs locally. No audio or text ever leaves your device. All data is stored in app-private sandbox — uninstalling the app permanently removes all data.
              </Text>
            </View>
          </View>
        </View>

        {/* About Section */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>About</Text>
          <View style={[styles.card, {backgroundColor: theme.colors.surface.primary}]}>
            <View style={styles.aboutRow}>
              <Text style={[styles.aboutLabel, {color: theme.colors.text.tertiary}]}>Version</Text>
              <Text style={[styles.aboutValue, {color: theme.colors.text.primary}]}>1.0.0</Text>
            </View>
            <View style={[styles.divider, {backgroundColor: theme.colors.border.subtle}]} />
            <View style={styles.aboutRow}>
              <Text style={[styles.aboutLabel, {color: theme.colors.text.tertiary}]}>AI Models</Text>
              <Text style={[styles.aboutValue, {color: theme.colors.text.primary}]}>SenseVoice + NLLB-600M</Text>
            </View>
            <View style={[styles.divider, {backgroundColor: theme.colors.border.subtle}]} />
            <View style={styles.aboutRow}>
              <Text style={[styles.aboutLabel, {color: theme.colors.text.tertiary}]}>Target</Text>
              <Text style={[styles.aboutValue, {color: theme.colors.text.primary}]}> 
                {currentLangOption.nativeLabel} ({currentLangOption.label})
              </Text>
            </View>
            <View style={[styles.divider, {backgroundColor: theme.colors.border.subtle}]} />
            <View style={styles.aboutRow}>
              <Text style={[styles.aboutLabel, {color: theme.colors.text.tertiary}]}>Developer</Text>
              <Text style={[styles.aboutValue, {color: theme.colors.text.primary}]}>Nghi Nguyen</Text>
            </View>
            <View style={[styles.divider, {backgroundColor: theme.colors.border.subtle}]} />
            <View style={styles.aboutRow}>
              <Text style={[styles.aboutLabel, {color: theme.colors.text.tertiary}]}>Contact</Text>
              <Text style={[styles.aboutValue, {color: theme.colors.text.primary}]}>nghinh@gmail.com</Text>
            </View>
          </View>
        </View>

        <View style={styles.bottomSpacer} />
      </ScrollView>

      {/* Language Selector Modal */}
      <Modal
        visible={langSelectorVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setLangSelectorVisible(false)}>
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setLangSelectorVisible(false)}>
          <View style={[styles.modalContent, {backgroundColor: theme.colors.surface.primary}]}>
            <Text style={[styles.modalTitle, {color: theme.colors.text.primary}]}>Select Target Language</Text>
            {TARGET_LANGUAGE_OPTIONS.map((langOption, index) => (
              <TouchableOpacity
                key={langOption.code}
                style={[
                  styles.langOption,
                  index < TARGET_LANGUAGE_OPTIONS.length - 1 && {borderBottomWidth: 1, borderBottomColor: theme.colors.border.subtle},
                  targetLanguage === langOption.code && {backgroundColor: theme.colors.surface.container},
                ]}
                onPress={() => {
                  setTargetLanguage(langOption.code);
                  setLangSelectorVisible(false);
                }}
                activeOpacity={0.7}>
                <Text style={[styles.langOptionFlag]}>{LANGUAGE_FLAGS[langOption.code] ?? '🌐'}</Text>
                <View style={styles.langOptionInfo}>
                  <Text style={[styles.langOptionNative, {color: theme.colors.text.primary}]}>
                    {langOption.nativeLabel}
                  </Text>
                  <Text style={[styles.langOptionLabel, {color: theme.colors.text.tertiary}]}>
                    {langOption.label}
                  </Text>
                </View>
                {targetLanguage === langOption.code && (
                  <AppIcon name="check-circle" size={20} color={theme.colors.primary} />
                )}
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>

      <AppBottomNav activeTab="network" />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
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
  },
  headerSpacer: {
    width: 40,
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    padding: spacing.lg,
  },
  section: {
    marginBottom: spacing.xl,
  },
  sectionLabel: {
    fontFamily: typography.fontFamily.label,
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.bold,
    textTransform: 'uppercase',
    letterSpacing: typography.letterSpacing.widest,
    marginBottom: spacing.xxs,
  },
  sectionSubtitle: {
    fontFamily: typography.fontFamily.label,
    fontSize: typography.fontSize.xs,
    marginBottom: spacing.md,
  },
  card: {
    borderRadius: borderRadius.xl,
    borderWidth: 1,
    overflow: 'hidden',
  },
  modelCard: {
    borderRadius: borderRadius.xl,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
  },
  modelCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  modelCardInfo: {
    flex: 1,
  },
  modelCardName: {
    fontFamily: typography.fontFamily.headline,
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
  },
  modelCardDesc: {
    fontFamily: typography.fontFamily.label,
    fontSize: typography.fontSize.xs,
    marginTop: spacing.xxs,
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
  statusBadgeText: {
    fontFamily: typography.fontFamily.label,
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.bold,
  },
  modelCardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing.md,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
  },
  modelCardSize: {
    fontFamily: typography.fontFamily.mono,
    fontSize: typography.fontSize.sm,
  },
  modelCardAction: {
    fontFamily: typography.fontFamily.label,
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.bold,
  },
  settingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.md,
  },
  settingInfo: {
    flex: 1,
    marginRight: spacing.md,
  },
  settingLabel: {
    fontFamily: typography.fontFamily.headline,
    fontSize: typography.fontSize.md,
    fontWeight: typography.fontWeight.semibold,
  },
  settingDesc: {
    fontFamily: typography.fontFamily.label,
    fontSize: typography.fontSize.xs,
    marginTop: spacing.xxs,
  },
  speakerDetectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    padding: spacing.md,
    gap: spacing.md,
  },
  sensitivityBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.lg,
  },
  sensitivityBadgeText: {
    fontFamily: typography.fontFamily.label,
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.bold,
  },
  sensitivityPresets: {
    flexDirection: 'row',
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.md,
    gap: spacing.sm,
  },
  sensitivityPresetButton: {
    flex: 1,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
    borderRadius: borderRadius.lg,
    alignItems: 'center',
    gap: spacing.xxs,
  },
  sensitivityPresetLabel: {
    fontFamily: typography.fontFamily.headline,
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
  },
  sensitivityPresetValue: {
    fontFamily: typography.fontFamily.mono,
    fontSize: typography.fontSize.xs,
  },
  sensitivityCurrentValue: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingBottom: spacing.md,
    gap: spacing.xs,
  },
  sensitivityCurrentLabel: {
    fontFamily: typography.fontFamily.label,
    fontSize: typography.fontSize.xs,
  },
  sensitivityCurrentValueText: {
    fontFamily: typography.fontFamily.mono,
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.bold,
  },
  languageSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.lg,
    gap: spacing.xs,
  },
  languageFlag: {
    fontSize: typography.fontSize.md,
  },
  languageCode: {
    fontFamily: typography.fontFamily.label,
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.bold,
  },
  storageRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.md,
  },
  storageLabel: {
    fontFamily: typography.fontFamily.body,
    fontSize: typography.fontSize.md,
  },
  storageValue: {
    fontFamily: typography.fontFamily.mono,
    fontSize: typography.fontSize.md,
    fontWeight: typography.fontWeight.bold,
  },
  divider: {
    height: 1,
    marginHorizontal: spacing.md,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.md,
  },
  totalLabel: {
    fontFamily: typography.fontFamily.headline,
    fontSize: typography.fontSize.md,
    fontWeight: typography.fontWeight.semibold,
  },
  totalValue: {
    fontFamily: typography.fontFamily.mono,
    fontSize: typography.fontSize.md,
    fontWeight: typography.fontWeight.bold,
  },
  deleteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.md,
    borderRadius: borderRadius.xl,
    borderWidth: 1,
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  deleteButtonText: {
    fontFamily: typography.fontFamily.label,
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.bold,
  },
  themeModeRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  themeModeButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: borderRadius.xl,
    borderWidth: 1,
    alignItems: 'center',
  },
  privacyRow: {
    padding: spacing.md,
    alignItems: 'center',
  },
  privacyBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  privacyBadgeText: {
    fontFamily: typography.fontFamily.headline,
    fontSize: typography.fontSize.md,
    fontWeight: typography.fontWeight.bold,
  },
  privacyDesc: {
    fontFamily: typography.fontFamily.body,
    fontSize: typography.fontSize.sm,
    textAlign: 'center',
    lineHeight: typography.fontSize.sm * typography.lineHeight.relaxed,
  },
  aboutRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.md,
  },
  aboutLabel: {
    fontFamily: typography.fontFamily.body,
    fontSize: typography.fontSize.md,
  },
  aboutValue: {
    fontFamily: typography.fontFamily.label,
    fontSize: typography.fontSize.md,
    fontWeight: typography.fontWeight.semibold,
  },
  bottomSpacer: {
    height: spacing.xxl,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
  },
  modalContent: {
    width: '100%',
    maxWidth: 320,
    borderRadius: borderRadius.xl,
    padding: spacing.lg,
  },
  modalTitle: {
    fontFamily: typography.fontFamily.headline,
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
    marginBottom: spacing.md,
    textAlign: 'center',
  },
  langOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    gap: spacing.md,
  },
  langOptionFlag: {
    fontSize: 24,
  },
  langOptionInfo: {
    flex: 1,
  },
  langOptionNative: {
    fontFamily: typography.fontFamily.headline,
    fontSize: typography.fontSize.md,
    fontWeight: typography.fontWeight.semibold,
  },
  langOptionLabel: {
    fontFamily: typography.fontFamily.label,
    fontSize: typography.fontSize.xs,
    marginTop: 2,
  },
  tuningRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.xs,
  },
  tuningLabel: {
    fontFamily: typography.fontFamily.mono,
    fontSize: typography.fontSize.xs,
    flex: 1,
  },
  tuningControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  tuningBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  tuningBtnText: {
    fontFamily: typography.fontFamily.headline,
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
    lineHeight: 22,
  },
  tuningValue: {
    fontFamily: typography.fontFamily.mono,
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.bold,
    minWidth: 40,
    textAlign: 'center',
  },
  resetDefaultsButton: {
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    marginTop: spacing.sm,
  },
  resetDefaultsText: {
    fontFamily: typography.fontFamily.label,
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.bold,
    textTransform: 'uppercase',
    letterSpacing: typography.letterSpacing.widest,
  },
});

export default SettingsScreen;
