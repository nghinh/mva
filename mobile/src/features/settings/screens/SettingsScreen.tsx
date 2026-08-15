/**
 * Settings Screen
 *
 * Professional settings layout for offline model management and app preferences.
 * All AI inference runs locally — no network dependency.
 */

import React, {useState, useCallback, useEffect, useRef} from 'react';
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
  ActivityIndicator,
  LayoutAnimation,
} from 'react-native';
import {useTranslation} from 'react-i18next';
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
  useAppLanguage,
  useTtsEnabled,
  useTtsRate,
  useInputLanguage,
} from '../../../shared/store';
import type {TtsRate} from '../../../shared/store/settingsStore';
import {SUPPORTED_LANGUAGES, LANGUAGE_LABELS, type AppLanguage} from '../../../i18n';
import {
  formatDiarizationThreshold,
  getDiarizationThresholdLabel,
  getDiarizationThresholdDescription,
} from '../../../shared/config/runtimeConfig';
import {getPersistenceService} from '../../../services/persistence';
import getNativeAppleTranslator, {LanguagePackStatus} from '../../../native/NativeAppleTranslator';
import {getSpeakerClusterService, type SpeakerClusterConfig} from '../../../services/speaker/SpeakerClusterService';
import {spacing, borderRadius, typography} from '../../../shared/constants';
import {AppBottomNav, AppIcon} from '../../../shared/components/ui';
import {Platform} from 'react-native';
import {isAppleTranslationAvailable, getIOSVersion} from '../../../shared/utils/platformSupport';

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

  const {t} = useTranslation('settings');
  const appLanguage = useAppLanguage();
  const {setAppLanguage} = useSettingsStore();
  const ttsEnabled = useTtsEnabled();
  const ttsRate = useTtsRate();
  const inputLanguage = useInputLanguage();
  const {setTtsEnabled, setTtsRate, setInputLanguage} = useSettingsStore();

  const [sessionDataSizeMB, setSessionDataSizeMB] = useState<number>(0);
  const [langSelectorVisible, setLangSelectorVisible] = useState(false);
  const [appLangSelectorVisible, setAppLangSelectorVisible] = useState(false);
  const [devUnlockTapCount, setDevUnlockTapCount] = useState(0);

  type PackRowStatus = LanguagePackStatus | 'loading';
  const LANG_PACKS: {srcLang: string; flag: string; labelKey: string; toKey: string}[] = [
    {srcLang: 'en', flag: '🇬🇧', labelKey: 'englishLabel', toKey: 'englishToLabel'},
    {srcLang: 'ja', flag: '🇯🇵', labelKey: 'japaneseLabel', toKey: 'japaneseToLabel'},
    {srcLang: 'ko', flag: '🇰🇷', labelKey: 'koreanLabel', toKey: 'koreanToLabel'},
    {srcLang: 'zh', flag: '🇨🇳', labelKey: 'chineseLabel', toKey: 'chineseToLabel'},
  ];
  const [packStatuses, setPackStatuses] = useState<Record<string, PackRowStatus>>({});

  const refreshPackStatuses = useCallback(async () => {
    if (Platform.OS !== 'ios') { return; }
    const nativeModule = getNativeAppleTranslator();
    if (!nativeModule) { return; }
    const results: Record<string, PackRowStatus> = {};
    await Promise.all(
      LANG_PACKS.map(async ({srcLang}) => {
        try {
          results[srcLang] = await nativeModule.getLanguagePackStatus(srcLang, targetLanguage);
        } catch {
          results[srcLang] = 'unknown';
        }
      }),
    );
    setPackStatuses(results);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetLanguage]);

  const handleDownloadPack = useCallback(async (srcLang: string) => {
    const nativeModule = getNativeAppleTranslator();
    if (!nativeModule) { return; }
    setPackStatuses(prev => ({...prev, [srcLang]: 'loading'}));
    try {
      await nativeModule.downloadLanguageIfNeeded(srcLang, targetLanguage);
    } catch { /* ignore */ }
    // Re-check status after Apple sheet closes
    try {
      const status = await nativeModule.getLanguagePackStatus(srcLang, targetLanguage);
      setPackStatuses(prev => ({...prev, [srcLang]: status}));
    } catch {
      setPackStatuses(prev => ({...prev, [srcLang]: 'unknown'}));
    }
  }, [targetLanguage]);

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

  useEffect(() => {
    refreshPackStatuses();
  }, [refreshPackStatuses]);

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
    {label: t('sensitivityLow'), value: 0.40, description: t('sensitivityLowDesc')},
    {label: t('sensitivityMedium'), value: 0.55, description: t('sensitivityMediumDesc')},
    {label: t('sensitivityHigh'), value: 0.70, description: t('sensitivityHighDesc')},
  ];

  const currentSensitivityLabel = diarizationThreshold <= 0.45
    ? t('sensitivityLow')
    : diarizationThreshold <= 0.75
    ? t('sensitivityMedium')
    : t('sensitivityHigh');

  const handleSensitivityChange = useCallback((value: number) => {
    setDiarizationThreshold(value);
  }, [setDiarizationThreshold]);

  const handleDeleteAllSessions = useCallback(async () => {
    Alert.alert(
      t('deleteAllSessionsTitle'),
      t('deleteAllSessionsMessage'),
      [
        {text: t('deleteAllSessionsCancel'), style: 'cancel'},
        {
          text: t('deleteAllSessionsConfirm'),
          style: 'destructive',
          onPress: async () => {
            try {
              const persistence = getPersistenceService();
              await persistence.deleteAllSessions();
            } catch (error) {
              console.warn('[SettingsScreen] Failed to delete all sessions:', error);
              Alert.alert(t('deleteSessionsError'), t('deleteSessionsErrorMessage'));
            }
          },
        },
      ],
    );
  }, [t]);

  const handleDeveloperUnlock = useCallback(() => {
    const nextCount = devUnlockTapCount + 1;
    if (developerMode) {
      return;
    }
    if (nextCount >= 7) {
      setDeveloperMode(true);
      setDevUnlockTapCount(0);
      Alert.alert(t('developerUnlockTitle'), t('developerUnlockMessage'));
      return;
    }
    setDevUnlockTapCount(nextCount);
  }, [devUnlockTapCount, developerMode, setDeveloperMode]);

  const getModelStatusDisplay = (status: string, isReady: boolean) => {
    if (isReady || status === 'cached-ready') {
      return {icon: 'check-circle', color: theme.colors.secondary, label: t('modelStatusReady')};
    }
    if (status === 'downloading') {
      return {icon: 'download', color: theme.colors.primary, label: t('modelStatusPreparing')};
    }
    if (status === 'deleting') {
      return {icon: 'delete', color: theme.colors.error, label: t('modelStatusRemoving')};
    }
    if (status === 'invalid') {
      return {icon: 'error', color: theme.colors.error, label: t('modelStatusInvalid')};
    }
    return {icon: 'cloud-off', color: theme.colors.text.tertiary, label: t('modelStatusUnavailable')};
  };

  const sttStatus = getModelStatusDisplay(modelState.status, modelState.status === 'cached-ready');

  const translationStatus = translatorModelState.status === 'cached-ready'
    ? {icon: 'check-circle', color: theme.colors.secondary, label: t('modelStatusReady')}
    : translatorModelState.status === 'missing'
    ? {icon: 'cloud-off', color: theme.colors.text.tertiary, label: t('modelStatusUnavailable')}
    : {icon: 'error', color: theme.colors.error, label: t('modelStatusUnavailable')};

  return (
    <View style={[styles.outerContainer, {backgroundColor: theme.colors.background.primary}]}>
      <SafeAreaView style={[styles.container, {backgroundColor: theme.colors.background.primary}]}>
      {/* Header */}
      <View style={[styles.header, {backgroundColor: theme.colors.surface.primary}]}>
        <TouchableOpacity onPress={() => navigation.goBack()} activeOpacity={0.7} style={styles.backButton}>
          <AppIcon name="back" size={24} color={theme.colors.text.primary} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, {color: theme.colors.text.primary}]}>{t('title')}</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView style={styles.content} contentContainerStyle={styles.scrollContent}>
        {/* General Section */}
        <View style={styles.section}>
          <Text style={[styles.sectionLabel, {color: theme.colors.text.tertiary}]}>{t('sectionGeneral')}</Text>

          <View style={[styles.card, {backgroundColor: theme.colors.surface.primary}]}>
            {/* App Language */}
            <TouchableOpacity
              style={styles.settingRow}
              onPress={() => setAppLangSelectorVisible(true)}
              activeOpacity={0.7}>
              <View style={styles.settingInfo}>
                <Text style={[styles.settingLabel, {color: theme.colors.text.primary}]}>{t('appLanguage')}</Text>
                <Text style={[styles.settingDesc, {color: theme.colors.text.tertiary}]}>{t('appLanguageDesc')}</Text>
              </View>
              <View style={[styles.languageSelector, {backgroundColor: theme.colors.surface.container}]}>
                <Text style={styles.languageFlag}>{LANGUAGE_LABELS[appLanguage]?.flag ?? '🌐'}</Text>
                <Text style={[styles.languageCode, {color: theme.colors.text.primary}]}>
                  {appLanguage.toUpperCase()}
                </Text>
                <AppIcon name="chevron-down" size={16} color={theme.colors.text.tertiary} />
              </View>
            </TouchableOpacity>

            <View style={[styles.divider, {backgroundColor: theme.colors.border.subtle}]} />

            {/* Target Language */}
            <TouchableOpacity
              style={styles.settingRow}
              onPress={() => setLangSelectorVisible(true)}
              activeOpacity={0.7}>
              <View style={styles.settingInfo}>
                <Text style={[styles.settingLabel, {color: theme.colors.text.primary}]}>{t('targetLanguage')}</Text>
                <Text style={[styles.settingDesc, {color: theme.colors.text.tertiary}]}>{t('targetLanguageDesc')}</Text>
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
                <Text style={[styles.settingLabel, {color: theme.colors.text.primary}]}>{t('translationEngine')}</Text>
                <Text style={[styles.settingDesc, {color: theme.colors.text.tertiary}]}>
                  {Platform.OS === 'ios' ? t('translationEngineDescIos') : t('translationEngineDescAndroid')}
                </Text>
              </View>
              <View style={[styles.inlineBadge, {backgroundColor: theme.colors.surface.container}]}>
                <Text style={[styles.inlineBadgeText, {color: theme.colors.text.secondary}]}>{translationEngineLabel}</Text>
              </View>
            </View>

            <View style={[styles.divider, {backgroundColor: theme.colors.border.subtle}]} />

            <View style={styles.sttEngineCard}>
              <View style={styles.settingInfoNoMargin}>
                <Text style={[styles.settingLabel, {color: theme.colors.text.primary}]}>{t('speechRecognition')}</Text>
                <Text style={[styles.settingDesc, {color: theme.colors.text.tertiary}]}>{t('speechRecognitionDesc')}</Text>
              </View>
              <View style={styles.sttEngineRow}>
                <View style={[
                  styles.sttEngineButton,
                  {backgroundColor: theme.colors.primary + '25', borderColor: theme.colors.primary},
                ]}>
                  <Text style={[styles.sttEngineLabel, {color: theme.colors.primary}]}>{t('sttEngineName')}</Text>
                  <Text style={[styles.sttEngineLangs, {color: theme.colors.primary}]}>{t('sttEngineLangs')}</Text>
                </View>
              </View>

              {/* Input Language (iOS only — ViSpeechModule uses SFSpeechRecognizer) */}
              {Platform.OS === 'ios' && (
                <>
                  <View style={[styles.divider, {backgroundColor: theme.colors.border.subtle}]} />
                  <View style={styles.settingInfoNoMargin}>
                    <Text style={[styles.settingLabel, {color: theme.colors.text.primary}]}>{t('inputLanguage')}</Text>
                    <Text style={[styles.settingDesc, {color: theme.colors.text.tertiary}]}>{t('inputLanguageDesc')}</Text>
                  </View>
                  <View style={styles.sttEngineRow}>
                    {(['auto', 'vi'] as const).map((mode) => {
                      const isActive = inputLanguage === mode;
                      return (
                        <TouchableOpacity
                          key={mode}
                          style={[
                            styles.sttEngineButton,
                            isActive
                              ? {backgroundColor: theme.colors.primary + '25', borderColor: theme.colors.primary}
                              : {backgroundColor: theme.colors.surface.secondary, borderColor: theme.colors.border.subtle},
                          ]}
                          onPress={() => {
                            setInputLanguage(mode);
                            // If switching to Vietnamese input while target is also Vietnamese,
                            // auto-switch target to English so translation is not a no-op.
                            if (mode === 'vi' && targetLanguage === 'vi') {
                              setTargetLanguage('en');
                            }
                          }}
                          activeOpacity={0.75}>
                          <Text style={[styles.sttEngineLabel, {color: isActive ? theme.colors.primary : theme.colors.text.secondary}]}>
                            {mode === 'auto' ? t('inputLangAuto') : t('inputLangVietnamese')}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </>
              )}
            </View>
          </View>
        </View>

        {/* Voice Output Section (iOS only) */}
        {Platform.OS === 'ios' && (
          <View style={styles.section}>
            <Text style={[styles.sectionLabel, {color: theme.colors.text.tertiary}]}>{t('sectionVoiceOutput')}</Text>
            <Text style={[styles.sectionSubtitle, {color: theme.colors.text.tertiary}]}>{t('sectionVoiceOutputSubtitle')}</Text>

            <View style={[styles.card, {backgroundColor: theme.colors.surface.primary}]}>
              {/* Read aloud toggle */}
              <View style={styles.settingRow}>
                <View style={styles.settingInfo}>
                  <Text style={[styles.settingLabel, {color: theme.colors.text.primary}]}>{t('ttsEnabled')}</Text>
                  <Text style={[styles.settingDesc, {color: theme.colors.text.tertiary}]}>{t('ttsEnabledDesc')}</Text>
                </View>
                <Switch
                  value={ttsEnabled}
                  onValueChange={(v) => {
                    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                    setTtsEnabled(v);
                  }}
                  trackColor={{false: theme.colors.border.subtle, true: theme.colors.primary + '80'}}
                  thumbColor={ttsEnabled ? theme.colors.primary : theme.colors.text.tertiary}
                />
              </View>

              {/* Sub-options — visible only when enabled */}
              {ttsEnabled && (
                <>
                  <View style={[styles.divider, {backgroundColor: theme.colors.border.subtle}]} />

                  {/* Speaking rate */}
                  <View style={styles.settingRow}>
                    <View style={styles.settingInfo}>
                      <Text style={[styles.settingLabel, {color: theme.colors.text.primary}]}>{t('ttsSpeakingRate')}</Text>
                    </View>
                    <View style={styles.segmentedControl}>
                      {(['slow', 'normal', 'fast'] as TtsRate[]).map((r) => (
                        <TouchableOpacity
                          key={r}
                          style={[
                            styles.segmentItem,
                            {backgroundColor: ttsRate === r
                              ? theme.colors.primary
                              : theme.colors.surface.secondary},
                          ]}
                          onPress={() => setTtsRate(r)}
                          activeOpacity={0.8}>
                          <Text style={[styles.segmentText, {color: ttsRate === r ? '#FFFFFF' : theme.colors.text.secondary}]}>
                            {t(`ttsRate${r.charAt(0).toUpperCase() + r.slice(1)}` as any)}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>

                  <View style={[styles.divider, {backgroundColor: theme.colors.border.subtle}]} />

                  {/* Voice engine — current badge */}
                  <View style={styles.settingRow}>
                    <View style={styles.settingInfo}>
                      <Text style={[styles.settingLabel, {color: theme.colors.text.primary}]}>{t('ttsVoiceEngine')}</Text>
                    </View>
                    <View style={[styles.inlineBadge, {backgroundColor: theme.colors.primary + '20', borderColor: theme.colors.primary + '40'}]}>
                      <Text style={[styles.inlineBadgeText, {color: theme.colors.primary}]}>
                        {t('ttsEngineSystem')}
                      </Text>
                    </View>
                  </View>
                </>
              )}
            </View>
          </View>
        )}

        {/* AI Models Section */}
        <View style={styles.section}>
          <Text style={[styles.sectionLabel, {color: theme.colors.text.tertiary}]}>{t('sectionAiModels')}</Text>
          <Text style={[styles.sectionSubtitle, {color: theme.colors.text.tertiary}]}>{t('sectionAiModelsSubtitle')}</Text>

          <View style={[styles.card, {backgroundColor: theme.colors.surface.primary}]}>
            <View style={styles.aiSummaryHeader}>
              <View style={styles.settingInfo}>
                <Text style={[styles.settingLabel, {color: theme.colors.text.primary}]}>{t('modelSummaryTitle')}</Text>
                <Text style={[styles.settingDesc, {color: theme.colors.text.tertiary}]}>{t('modelSummaryDesc')}</Text>
              </View>
              <TouchableOpacity
                style={[styles.manageModelsButton, {backgroundColor: theme.colors.surface.container}]}
                onPress={() => navigation.navigate('ModelRepository')}
                activeOpacity={0.7}>
                <Text style={[styles.manageModelsText, {color: theme.colors.primary}]}>{t('manageModelsButton')}</Text>
              </TouchableOpacity>
            </View>

            <View style={[styles.divider, {backgroundColor: theme.colors.border.subtle}]} />

            <View style={styles.summaryRow}>
              <Text style={[styles.summaryLabel, {color: theme.colors.text.tertiary}]}>{t('modelSpeechRecognition')}</Text>
              <View style={[styles.statusBadge, {backgroundColor: sttStatus.color + '20', borderColor: sttStatus.color + '40'}]}>
                <AppIcon name={sttStatus.icon as any} size={12} color={sttStatus.color} />
                <Text style={[styles.statusBadgeText, {color: sttStatus.color}]}>{sttStatus.label}</Text>
              </View>
            </View>
            <View style={[styles.divider, {backgroundColor: theme.colors.border.subtle}]} />
            <View style={styles.summaryRow}>
              <Text style={[styles.summaryLabel, {color: theme.colors.text.tertiary}]}>{t('modelTranslation')}</Text>
              <View style={[styles.statusBadge, {backgroundColor: translationStatus.color + '20', borderColor: translationStatus.color + '40'}]}>
                <AppIcon name={translationStatus.icon as any} size={12} color={translationStatus.color} />
                <Text style={[styles.statusBadgeText, {color: translationStatus.color}]}>{translationStatus.label}</Text>
              </View>
            </View>
            <View style={[styles.divider, {backgroundColor: theme.colors.border.subtle}]} />
            <View style={styles.summaryRow}>
              <Text style={[styles.summaryLabel, {color: theme.colors.text.tertiary}]}>{t('modelSpeakerDetection')}</Text>
              <View style={[styles.statusBadge, {backgroundColor: theme.colors.secondary + '20', borderColor: theme.colors.secondary + '40'}]}>
                <AppIcon name="check-circle" size={12} color={theme.colors.secondary} />
                <Text style={[styles.statusBadgeText, {color: theme.colors.secondary}]}>{t('modelBundled')}</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Translation Language Packs (iOS only) */}
        {Platform.OS === 'ios' && (
          <View style={styles.section}>
            <Text style={[styles.sectionLabel, {color: theme.colors.text.tertiary}]}>{t('sectionLanguagePacks')}</Text>
            <Text style={[styles.sectionSubtitle, {color: theme.colors.text.tertiary}]}>{t('sectionLanguagePacksSubtitle')}</Text>

            {!isAppleTranslationAvailable() && (
              <View style={[styles.iosWarningBanner, {backgroundColor: theme.colors.error + '18', borderColor: theme.colors.error + '50'}]}>
                <AppIcon name="error" size={18} color={theme.colors.error} />
                <View style={styles.iosWarningText}>
                  <Text style={[styles.iosWarningTitle, {color: theme.colors.error}]}>{t('iosVersionWarningTitle')}</Text>
                  <Text style={[styles.iosWarningDesc, {color: theme.colors.text.secondary}]}>
                    {t('iosVersionWarningDesc', {version: getIOSVersion()})}
                  </Text>
                </View>
              </View>
            )}

            <View style={[styles.card, {backgroundColor: theme.colors.surface.primary}]}>
              {LANG_PACKS.map(({srcLang, flag, labelKey, toKey}, index) => {
                const status = packStatuses[srcLang];
                const isInstalled = status === 'installed';
                const isLoading = status === 'loading';
                const isAvailable = status === 'available';
                return (
                  <React.Fragment key={srcLang}>
                    {index > 0 && <View style={[styles.divider, {backgroundColor: theme.colors.border.subtle}]} />}
                    <View style={styles.packRow}>
                      <View style={styles.settingInfo}>
                        <Text style={[styles.settingLabel, {color: theme.colors.text.primary}]}>{flag} {t(labelKey, {ns: 'splash'})}</Text>
                        <Text style={[styles.settingDesc, {color: theme.colors.text.tertiary}]}>
                          {t(toKey, {ns: 'splash', lang: currentLangOption.nativeLabel})}
                        </Text>
                      </View>
                      {isLoading ? (
                        <ActivityIndicator size="small" color={theme.colors.primary} />
                      ) : isInstalled ? (
                        <View style={[styles.statusBadge, {backgroundColor: theme.colors.secondary + '20', borderColor: theme.colors.secondary + '40'}]}>
                          <AppIcon name="check-circle" size={12} color={theme.colors.secondary} />
                          <Text style={[styles.statusBadgeText, {color: theme.colors.secondary}]}>{t('packInstalled')}</Text>
                        </View>
                      ) : isAvailable ? (
                        <TouchableOpacity
                          style={[styles.packDownloadBtn, {backgroundColor: theme.colors.primary + '20', borderColor: theme.colors.primary + '60'}]}
                          onPress={() => handleDownloadPack(srcLang)}
                          activeOpacity={0.7}>
                          <Text style={[styles.packDownloadBtnText, {color: theme.colors.primary}]}>{t('packDownload')}</Text>
                        </TouchableOpacity>
                      ) : (
                        <View style={[styles.statusBadge, {backgroundColor: theme.colors.text.tertiary + '20', borderColor: theme.colors.border.subtle}]}>
                          <Text style={[styles.statusBadgeText, {color: theme.colors.text.tertiary}]}>
                            {status === 'unsupported' ? t('packUnavailable') : '—'}
                          </Text>
                        </View>
                      )}
                    </View>
                  </React.Fragment>
                );
              })}
            </View>
          </View>
        )}

        {/* Appearance Section */}
        <View style={styles.section}>
          <Text style={[styles.sectionLabel, {color: theme.colors.text.tertiary}]}>{t('sectionAppearance')}</Text>
          <View style={[styles.card, {backgroundColor: theme.colors.surface.primary}]}>
            <View style={styles.themeCardContent}>
              <View style={styles.settingInfoNoMargin}>
              <Text style={[styles.settingLabel, {color: theme.colors.text.primary}]}>{t('settingTheme')}</Text>
              <Text style={[styles.settingDesc, {color: theme.colors.text.tertiary}]}>{t('settingThemeDesc')}</Text>
              </View>
              <View style={styles.themeModeRow}>
                {([
                  {key: 'system', label: t('themeSystem')},
                  {key: 'light', label: t('themeLight')},
                  {key: 'dark', label: t('themeDark')},
                ] as {key: 'system' | 'light' | 'dark'; label: string}[]).map((option) => {
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
          <Text style={[styles.sectionLabel, {color: theme.colors.text.tertiary}]}>{t('sectionSpeakerDetection')}</Text>
          <View style={[styles.card, {backgroundColor: theme.colors.surface.primary}]}>
            <View style={styles.speakerDetectionHeader}>
              <View style={styles.settingInfo}>
                <Text style={[styles.settingLabel, {color: theme.colors.text.primary}]}>{t('settingSensitivity')}</Text>
                <Text style={[styles.settingDesc, {color: theme.colors.text.tertiary}]}>
                  {t('sensitivityDescription')}
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
                {t('currentSensitivity')}
              </Text>
              <Text style={[styles.sensitivityCurrentValueText, {color: theme.colors.text.primary}]}>
                {formatDiarizationThreshold(diarizationThreshold)}
              </Text>
            </View>
          </View>
        </View>

        {/* Local Data Section */}
        <View style={styles.section}>
          <Text style={[styles.sectionLabel, {color: theme.colors.text.tertiary}]}>{t('sectionLocalData')}</Text>
          <View style={[styles.card, {backgroundColor: theme.colors.surface.primary}]}>
            <View style={styles.storageRow}>
              <Text style={[styles.storageLabel, {color: theme.colors.text.tertiary}]}>{t('storageAiModels')}</Text>
              <Text style={[styles.storageValue, {color: theme.colors.text.primary}]}>{TOTAL_MODELS_SIZE_MB} MB</Text>
            </View>
            <View style={[styles.divider, {backgroundColor: theme.colors.border.subtle}]} />
            <View style={styles.storageRow}>
              <Text style={[styles.storageLabel, {color: theme.colors.text.tertiary}]}>{t('storageSessionData')}</Text>
              <Text style={[styles.storageValue, {color: theme.colors.text.primary}]}>
                {sessionDataSizeMB > 0 ? `${sessionDataSizeMB} MB` : '—'}
              </Text>
            </View>
            <View style={[styles.divider, {backgroundColor: theme.colors.border.subtle}]} />
            <View style={styles.totalRow}>
              <Text style={[styles.totalLabel, {color: theme.colors.text.primary}]}>{t('storageTotalLocal')}</Text>
              <Text style={[styles.totalValue, {color: theme.colors.primary}]}>
                {TOTAL_MODELS_SIZE_MB + sessionDataSizeMB} MB
              </Text>
            </View>
            <View style={[styles.divider, {backgroundColor: theme.colors.border.subtle}]} />
            <View style={styles.localDataNoteRow}>
              <View style={styles.privacyBadge}>
                <AppIcon name="check-circle" size={18} color={theme.colors.secondary} />
                <Text style={[styles.privacyBadgeText, {color: theme.colors.secondary}]}>{t('storageOfflineBadge')}</Text>
              </View>
              <Text style={[styles.localDataNote, {color: theme.colors.text.tertiary}]}>{t('storageOfflineNote')}</Text>
            </View>
          </View>

          <TouchableOpacity
            style={[styles.deleteButton, {borderColor: theme.colors.error + '40'}]}
            onPress={handleDeleteAllSessions}
            activeOpacity={0.7}>
            <AppIcon name="delete" size={18} color={theme.colors.error} />
            <Text style={[styles.deleteButtonText, {color: theme.colors.error}]}>{t('deleteAllSessions')}</Text>
          </TouchableOpacity>
        </View>

        {/* Developer Mode Section */}
        {developerMode && (
          <View style={styles.section}>
            <Text style={[styles.sectionLabel, {color: theme.colors.text.tertiary}]}>{t('sectionDeveloper')}</Text>
            <View style={[styles.card, {backgroundColor: theme.colors.surface.primary}]}>
              <View style={styles.settingRow}>
                <View style={styles.settingInfo}>
                  <Text style={[styles.settingLabel, {color: theme.colors.text.primary}]}>{t('developerMode')}</Text>
                  <Text style={[styles.settingDesc, {color: theme.colors.text.tertiary}]}>{t('developerModeDesc')}</Text>
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
                <Text style={[styles.settingLabel, {color: theme.colors.text.primary}]}>{t('developerDiarizationTuning')}</Text>
                <Text style={[styles.settingDesc, {color: theme.colors.text.tertiary, marginBottom: spacing.sm}]}>
                  {t('developerDiarizationDesc')}
                </Text>

                {([
                  {key: 'similarityThreshold' as const, label: t('developerSimilarityThreshold'), min: 0.30, max: 0.80, step: 0.05},
                  {key: 'highConfidenceThreshold' as const, label: t('developerHighConfidence'), min: 0.55, max: 0.85, step: 0.05},
                  {key: 'lowConfidenceThreshold' as const, label: t('developerLowConfidence'), min: 0.20, max: 0.50, step: 0.05},
                  {key: 'clusterMergeThreshold' as const, label: t('developerMergeThreshold'), min: 0.45, max: 0.75, step: 0.05},
                  {key: 'temporalBiasBoost' as const, label: t('developerTemporalBias'), min: 0.00, max: 0.20, step: 0.02},
                  {key: 'temporalBiasWindow' as const, label: t('developerTemporalWindow'), min: 3, max: 30, step: 1},
                  {key: 'minUtteranceDuration' as const, label: t('developerMinUtterance'), min: 0.5, max: 3.0, step: 0.5},
                  {key: 'maxSpeakers' as const, label: t('developerMaxSpeakers'), min: 2, max: 12, step: 1},
                ] as {key: keyof SpeakerClusterConfig; label: string; min: number; max: number; step: number}[]).map(({key, label, min, max, step}) => (
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
                  <Text style={[styles.resetDefaultsText, {color: theme.colors.text.secondary}]}>{t('developerResetDefaults')}</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        )}

        {/* About Section */}
        <View style={styles.section}>
          <Text style={[styles.sectionLabel, {color: theme.colors.text.tertiary}]}>{t('sectionAbout')}</Text>
          <View style={[styles.card, {backgroundColor: theme.colors.surface.primary}]}>
            <TouchableOpacity style={styles.aboutRow} onPress={handleDeveloperUnlock} activeOpacity={0.7}>
              <Text style={[styles.aboutLabel, {color: theme.colors.text.tertiary}]}>{t('aboutVersion')}</Text>
              <Text style={[styles.aboutValue, {color: theme.colors.text.primary}]}>{t('aboutVersionValue')}</Text>
            </TouchableOpacity>
            <View style={[styles.divider, {backgroundColor: theme.colors.border.subtle}]} />
            <View style={styles.aboutRow}>
              <Text style={[styles.aboutLabel, {color: theme.colors.text.tertiary}]}>{t('aboutTranslation')}</Text>
              <Text style={[styles.aboutValue, {color: theme.colors.text.primary}]}>
                {currentLangOption.nativeLabel}
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.bottomSpacer} />
      </ScrollView>

      {/* App Language Selector Modal */}
      <Modal
        visible={appLangSelectorVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setAppLangSelectorVisible(false)}>
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setAppLangSelectorVisible(false)}>
          <View style={[styles.modalContent, {backgroundColor: theme.colors.surface.primary}]}>
            <Text style={[styles.modalTitle, {color: theme.colors.text.primary}]}>{t('appLanguageSelectorTitle')}</Text>
            {SUPPORTED_LANGUAGES.map((langCode, index) => {
              const info = LANGUAGE_LABELS[langCode as AppLanguage];
              return (
                <TouchableOpacity
                  key={langCode}
                  style={[
                    styles.langOption,
                    index < SUPPORTED_LANGUAGES.length - 1 && {borderBottomWidth: 1, borderBottomColor: theme.colors.border.subtle},
                    appLanguage === langCode && {backgroundColor: theme.colors.surface.container},
                  ]}
                  onPress={() => {
                    setAppLanguage(langCode as AppLanguage);
                    setAppLangSelectorVisible(false);
                  }}
                  activeOpacity={0.7}>
                  <Text style={styles.langOptionFlag}>{info?.flag ?? '🌐'}</Text>
                  <View style={styles.langOptionInfo}>
                    <Text style={[styles.langOptionNative, {color: theme.colors.text.primary}]}>
                      {info?.nativeLabel ?? langCode}
                    </Text>
                    <Text style={[styles.langOptionLabel, {color: theme.colors.text.tertiary}]}>
                      {info?.label ?? langCode}
                    </Text>
                  </View>
                  {appLanguage === langCode && (
                    <AppIcon name="check-circle" size={20} color={theme.colors.primary} />
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        </TouchableOpacity>
      </Modal>

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
            <Text style={[styles.modalTitle, {color: theme.colors.text.primary}]}>{t('languageSelectorTitle')}</Text>
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

      </SafeAreaView>
      <AppBottomNav activeTab="network" />
    </View>
  );
}

const styles = StyleSheet.create({
  outerContainer: {
    flex: 1,
  },
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
  iosWarningBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: borderRadius.xl,
    borderWidth: 1,
    marginBottom: spacing.md,
  },
  iosWarningText: {
    flex: 1,
    gap: spacing.xxs,
  },
  iosWarningTitle: {
    fontFamily: typography.fontFamily.headline,
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.bold,
  },
  iosWarningDesc: {
    fontFamily: typography.fontFamily.body,
    fontSize: typography.fontSize.xs,
    lineHeight: typography.fontSize.xs * typography.lineHeight.relaxed,
  },
  packRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.md,
    gap: spacing.md,
  },
  packDownloadBtn: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.full,
    borderWidth: 1,
  },
  packDownloadBtnText: {
    fontFamily: typography.fontFamily.label,
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.bold,
  },
  sttEngineCard: {
    padding: spacing.md,
    gap: spacing.md,
  },
  sttEngineRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  sttEngineButton: {
    flex: 1,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.xs,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    alignItems: 'center',
    gap: spacing.xxs,
  },
  sttEngineLabel: {
    fontFamily: typography.fontFamily.headline,
    fontSize: typography.fontSize.sm,
    fontWeight: '700',
  },
  sttEngineLangs: {
    fontFamily: typography.fontFamily.mono,
    fontSize: 9,
    textAlign: 'center',
  },
  segmentedControl: {
    flexDirection: 'row',
    borderRadius: borderRadius.lg,
    overflow: 'hidden',
    gap: 2,
  },
  segmentItem: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  segmentText: {
    fontFamily: typography.fontFamily.label,
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.bold,
  },
  modalCard: {
    width: '100%',
    borderRadius: borderRadius.xl,
    padding: spacing.xl,
    alignItems: 'center',
    gap: spacing.md,
  },
  modalSubText: {
    fontFamily: typography.fontFamily.body,
    fontSize: typography.fontSize.sm,
  },
  progressTrack: {
    width: '100%',
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
    marginTop: spacing.xs,
  },
  progressFill: {
    height: '100%',
    borderRadius: 4,
  },
  progressPercent: {
    fontFamily: typography.fontFamily.label,
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
  },
  modalCancelButton: {
    marginTop: spacing.xs,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.xl,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
  },
  modalCancelText: {
    fontFamily: typography.fontFamily.label,
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
  },
});

export default SettingsScreen;
