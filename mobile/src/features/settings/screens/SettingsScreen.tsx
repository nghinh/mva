/**
 * Settings Screen
 *
 * Professional settings layout for offline model management and app preferences.
 * All AI inference runs locally — no network dependency.
 */

import React, {useState, useCallback, useEffect} from 'react';
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
} from '../../../shared/config/runtimeConfig';
import {getPersistenceService} from '../../../services/persistence';
import {getSpeakerClusterService, type SpeakerClusterConfig} from '../../../services/speaker/SpeakerClusterService';
import {spacing, borderRadius, typography} from '../../../shared/constants';
import {AppBottomNav, AppIcon} from '../../../shared/components/ui';
import {Platform} from 'react-native';

type SettingsNavigationProp = StackNavigationProp<RootStackParamList, 'Settings'>;

// Bundled model info (sizes are fixed for bundled models)
const SENSEVOICE_SIZE_MB = 234;
const DIARIZATION_SIZE_MB = 35;
const TOTAL_MODELS_SIZE_MB = SENSEVOICE_SIZE_MB + DIARIZATION_SIZE_MB;

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
  const translationEngineLabel = Platform.OS === 'ios' ? 'Apple Translate' : 'Opus-MT';

  const [sessionDataSizeMB, setSessionDataSizeMB] = useState<number>(0);
  const [langSelectorVisible, setLangSelectorVisible] = useState(false);
  const [devUnlockTapCount, setDevUnlockTapCount] = useState(0);

  useEffect(() => {
    let mounted = true;
    getPersistenceService()
      .getStorageSizeBytes()
      .then((bytes) => {
        if (mounted) {
          setSessionDataSizeMB(Math.round(bytes / (1024 * 1024) * 100) / 100);
        }
      })
      .catch(() => {
        if (mounted) {
          setSessionDataSizeMB(0);
        }
      });
    return () => {
      mounted = false;
    };
  }, []);

  // Diarization tuning state (dev mode only)
  const [clusterConfig, setClusterConfig] = useState<SpeakerClusterConfig>(() => getSpeakerClusterService().getConfig());
  const updateClusterParam = useCallback(<K extends keyof SpeakerClusterConfig>(key: K, value: SpeakerClusterConfig[K]) => {
    const updated = {...clusterConfig, [key]: value};
    setClusterConfig(updated);
    getSpeakerClusterService().setConfig({[key]: value});
  }, [clusterConfig]);
  const resetClusterDefaults = useCallback(() => {
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

  const handleDeveloperUnlock = useCallback(() => {
    const nextCount = devUnlockTapCount + 1;
    if (developerMode) {
      return;
    }
    if (nextCount >= 7) {
      setDeveloperMode(true);
      setDevUnlockTapCount(0);
      Alert.alert('Developer Mode Enabled', 'Advanced diagnostics and tuning options are now visible.');
      return;
    }
    setDevUnlockTapCount(nextCount);
  }, [devUnlockTapCount, developerMode, setDeveloperMode]);

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

  const translationStatus = translatorModelState.status === 'cached-ready'
    ? {icon: 'check-circle', color: theme.colors.secondary, label: 'Ready'}
    : translatorModelState.status === 'missing'
    ? {icon: 'cloud-off', color: theme.colors.text.tertiary, label: 'Not Available'}
    : {icon: 'error', color: theme.colors.error, label: 'Unavailable'};

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
        {/* General Section */}
        <View style={styles.section}>
          <Text style={[styles.sectionLabel, {color: theme.colors.text.tertiary}]}>General</Text>

          <View style={[styles.card, {backgroundColor: theme.colors.surface.primary}]}> 
            <TouchableOpacity
              style={styles.settingRow}
              onPress={() => setLangSelectorVisible(true)}
              activeOpacity={0.7}>
              <View style={styles.settingInfo}>
                <Text style={[styles.settingLabel, {color: theme.colors.text.primary}]}>Target Language</Text>
                <Text style={[styles.settingDesc, {color: theme.colors.text.tertiary}]}>Translate all meeting output into this language.</Text>
              </View>
              <View style={[styles.languageSelector, {backgroundColor: theme.colors.surface.container}]}> 
                <Text style={[styles.languageFlag]}>{LANGUAGE_FLAGS[targetLanguage] ?? '🇻🇳'}</Text>
                <Text style={[styles.languageCode, {color: theme.colors.text.primary}]}> 
                  {targetLanguage.toUpperCase()}
                </Text>
                <AppIcon name="chevron-down" size={16} color={theme.colors.text.tertiary} />
              </View>
            </TouchableOpacity>

            <View style={[styles.divider, {backgroundColor: theme.colors.border.subtle}]} />

            <View style={styles.settingRow}>
              <View style={styles.settingInfo}>
                <Text style={[styles.settingLabel, {color: theme.colors.text.primary}]}>Translation Engine</Text>
                <Text style={[styles.settingDesc, {color: theme.colors.text.tertiary}]}>Uses {translationEngineLabel} for on-device meeting translation.</Text>
              </View>
              <View style={[styles.inlineBadge, {backgroundColor: theme.colors.surface.container}]}> 
                <Text style={[styles.inlineBadgeText, {color: theme.colors.text.secondary}]}>{translationEngineLabel}</Text>
              </View>
            </View>
          </View>
        </View>

        {/* AI Models Section */}
        <View style={styles.section}>
          <Text style={[styles.sectionLabel, {color: theme.colors.text.tertiary}]}>On-Device AI</Text>
          <Text style={[styles.sectionSubtitle, {color: theme.colors.text.tertiary}]}>Speech recognition and speaker detection are stored locally on your device.</Text>

          <View style={[styles.card, {backgroundColor: theme.colors.surface.primary}]}> 
            <View style={styles.aiSummaryHeader}>
              <View style={styles.settingInfo}>
                <Text style={[styles.settingLabel, {color: theme.colors.text.primary}]}>Model Summary</Text>
                <Text style={[styles.settingDesc, {color: theme.colors.text.tertiary}]}>Core speech models are installed locally. Translation uses the device-native engine.</Text>
              </View>
              <TouchableOpacity
                style={[styles.manageModelsButton, {backgroundColor: theme.colors.surface.container}]}
                onPress={() => navigation.navigate('ModelRepository')}
                activeOpacity={0.7}>
                <Text style={[styles.manageModelsText, {color: theme.colors.primary}]}>Manage Models</Text>
              </TouchableOpacity>
            </View>

            <View style={[styles.divider, {backgroundColor: theme.colors.border.subtle}]} />

            <View style={styles.summaryRow}>
              <Text style={[styles.summaryLabel, {color: theme.colors.text.tertiary}]}>Speech Recognition</Text>
              <View style={[styles.statusBadge, {backgroundColor: sttStatus.color + '20', borderColor: sttStatus.color + '40'}]}>
                <AppIcon name={sttStatus.icon as any} size={12} color={sttStatus.color} />
                <Text style={[styles.statusBadgeText, {color: sttStatus.color}]}>{sttStatus.label}</Text>
              </View>
            </View>
            <View style={[styles.divider, {backgroundColor: theme.colors.border.subtle}]} />
            <View style={styles.summaryRow}>
              <Text style={[styles.summaryLabel, {color: theme.colors.text.tertiary}]}>Translation</Text>
              <View style={[styles.statusBadge, {backgroundColor: translationStatus.color + '20', borderColor: translationStatus.color + '40'}]}>
                <AppIcon name={translationStatus.icon as any} size={12} color={translationStatus.color} />
                <Text style={[styles.statusBadgeText, {color: translationStatus.color}]}>{translationStatus.label}</Text>
              </View>
            </View>
            <View style={[styles.divider, {backgroundColor: theme.colors.border.subtle}]} />
            <View style={styles.summaryRow}>
              <Text style={[styles.summaryLabel, {color: theme.colors.text.tertiary}]}>Speaker Detection</Text>
              <View style={[styles.statusBadge, {backgroundColor: theme.colors.secondary + '20', borderColor: theme.colors.secondary + '40'}]}>
                <AppIcon name="check-circle" size={12} color={theme.colors.secondary} />
                <Text style={[styles.statusBadgeText, {color: theme.colors.secondary}]}>Bundled</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Appearance Section */}
        <View style={styles.section}>
          <Text style={[styles.sectionLabel, {color: theme.colors.text.tertiary}]}>Appearance</Text>
          <View style={[styles.card, {backgroundColor: theme.colors.surface.primary}]}> 
            <View style={styles.themeCardContent}>
              <View style={styles.settingInfoNoMargin}>
              <Text style={[styles.settingLabel, {color: theme.colors.text.primary}]}>Theme</Text>
              <Text style={[styles.settingDesc, {color: theme.colors.text.tertiary}]}>Choose how the app appears across all screens.</Text>
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
        </View>

        {/* Speaker Detection Section */}
        <View style={styles.section}>
          <Text style={[styles.sectionLabel, {color: theme.colors.text.tertiary}]}>Speaker Detection</Text>
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

        {/* Local Data Section */}
        <View style={styles.section}>
          <Text style={[styles.sectionLabel, {color: theme.colors.text.tertiary}]}>Local Data</Text>
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
            <View style={[styles.divider, {backgroundColor: theme.colors.border.subtle}]} />
            <View style={styles.localDataNoteRow}>
              <View style={styles.privacyBadge}>
                <AppIcon name="check-circle" size={18} color={theme.colors.secondary} />
                <Text style={[styles.privacyBadgeText, {color: theme.colors.secondary}]}>100% Offline</Text>
              </View>
              <Text style={[styles.localDataNote, {color: theme.colors.text.tertiary}]}>Audio, transcripts, and translations stay on this device. Removing the app deletes locally stored data.</Text>
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
        {developerMode && (
          <View style={styles.section}>
            <Text style={[styles.sectionLabel, {color: theme.colors.text.tertiary}]}>Developer Options</Text>
            <View style={[styles.card, {backgroundColor: theme.colors.surface.primary}]}> 
              <View style={styles.settingRow}>
                <View style={styles.settingInfo}>
                  <Text style={[styles.settingLabel, {color: theme.colors.text.primary}]}>Developer Mode</Text>
                  <Text style={[styles.settingDesc, {color: theme.colors.text.tertiary}]}>Show performance metrics overlay during meetings.</Text>
                </View>
                <Switch
                  value={developerMode}
                  onValueChange={setDeveloperMode}
                  trackColor={{false: theme.colors.surface.container, true: theme.colors.primary + '60'}}
                  thumbColor={developerMode ? theme.colors.primary : theme.colors.text.tertiary}
                />
              </View>
            </View>

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
          </View>
        )}

        {/* About Section */}
        <View style={styles.section}>
          <Text style={[styles.sectionLabel, {color: theme.colors.text.tertiary}]}>About</Text>
          <View style={[styles.card, {backgroundColor: theme.colors.surface.primary}]}> 
            <TouchableOpacity style={styles.aboutRow} onPress={handleDeveloperUnlock} activeOpacity={0.7}>
              <Text style={[styles.aboutLabel, {color: theme.colors.text.tertiary}]}>Version</Text>
              <Text style={[styles.aboutValue, {color: theme.colors.text.primary}]}>1.0.0</Text>
            </TouchableOpacity>
            <View style={[styles.divider, {backgroundColor: theme.colors.border.subtle}]} />
            <View style={styles.aboutRow}>
              <Text style={[styles.aboutLabel, {color: theme.colors.text.tertiary}]}>Translation</Text>
              <Text style={[styles.aboutValue, {color: theme.colors.text.primary}]}> 
                {currentLangOption.nativeLabel}
              </Text>
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
  inlineBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.full,
  },
  inlineBadgeText: {
    fontFamily: typography.fontFamily.label,
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.bold,
  },
  card: {
    borderRadius: borderRadius.xl,
    borderWidth: 1,
    overflow: 'hidden',
  },
  aiSummaryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.md,
    gap: spacing.md,
  },
  manageModelsButton: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.full,
  },
  manageModelsText: {
    fontFamily: typography.fontFamily.label,
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.bold,
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    padding: spacing.md,
  },
  summaryLabel: {
    fontFamily: typography.fontFamily.body,
    fontSize: typography.fontSize.md,
    flex: 1,
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
    paddingRight: spacing.sm,
  },
  modelCardName: {
    fontFamily: typography.fontFamily.headline,
    fontSize: typography.fontSize.md,
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
    marginTop: spacing.sm,
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
  settingInfoNoMargin: {
    width: '100%',
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
  localDataNoteRow: {
    padding: spacing.md,
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  localDataNote: {
    fontFamily: typography.fontFamily.body,
    fontSize: typography.fontSize.sm,
    lineHeight: typography.fontSize.sm * typography.lineHeight.relaxed,
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
  themeCardContent: {
    padding: spacing.md,
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
    maxWidth: 300,
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
    flexShrink: 1,
    textAlign: 'right',
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
