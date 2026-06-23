import React, {useEffect, useRef, useState} from 'react';
import {View, Text, StyleSheet, Pressable, ActivityIndicator, SafeAreaView, Platform} from 'react-native';
import {useTranslation} from 'react-i18next';
import {useNavigation} from '../../../app/navigation/router';
import {StackNavigationProp} from '../../../app/navigation/router';
import {spacing, typography, borderRadius, shadows} from '@shared/constants';
import {useTheme} from '@shared/hooks/useTheme';
import {ReadinessStatus, ProgressCard} from '@shared/components/ui';
import {useBootstrapStore, useModelState, usePrewarmState, useBootstrapOverallStatus, useTargetLanguage} from '@shared/store';
import {ModelInfo} from '@shared/types';
import type {RootStackParamList} from '../../../app/navigation/router';
import {getSTTProcessorInstance} from '../../../native/stt/STTProcessor';
import {warnLog} from '../../../shared/utils/logger';
import {translationService} from '../../../services/TranslationService';
import {ensureBundledModelInstalled, areInstalledModelFilesPresent} from '../../../native/models/BundledModelInstaller';
import getNativeAppleTranslator from '../../../native/NativeAppleTranslator';
import {markPacksDownloaded, markPacksSkipped} from '../../../services/languagePackStatus';

const MOCK_MODEL: ModelInfo = {
  id: 'sensevoice-small',
  name: 'SenseVoice-Small',
  version: '1.2.4-stable',
  quality: 'int8',
  diskFootprintMB: 234,
  languages: ['EN', 'JA', 'KO', 'ZH'],
  inferenceSpeedRTF: 0.05,
  isOptimizedFor: ['iPhone 15 Pro'],
};

const PLATFORM_TRANSLATION_MODEL: ModelInfo = {
  id: Platform.OS === 'ios' ? 'apple-translation' : 'ml-kit-translation',
  name: Platform.OS === 'ios' ? 'Apple Translation' : 'Google ML Kit Translation',
  version: '1.0.0',
  quality: 'int8',
  diskFootprintMB: Platform.OS === 'ios' ? 0 : 30, // iOS uses built-in framework, Android uses ~30MB per language pack
  languages: ['EN', 'JA', 'KO', 'ZH', 'VI'],
  inferenceSpeedRTF: 0.1,
  isOptimizedFor: ['iPhone 15 Pro'],
};

type SplashNavigationProp = StackNavigationProp<RootStackParamList, 'Bootstrap'>;

const TARGET_LANG_KEYS: Record<string, string> = {
  vi: 'vietnameseLabel',
  en: 'englishLabel',
  zh: 'chineseLabel',
  ko: 'koreanLabel',
  ja: 'japaneseLabel',
};

const TARGET_LANGUAGE_LABELS_FALLBACK: Record<string, string> = {
  vi: 'Vietnamese',
  en: 'English',
  zh: 'Chinese',
  ko: 'Korean',
  ja: 'Japanese',
};

interface LanguagePackCheck {
  srcLang: string;
  displayName: string;
}

function getLanguagePacksToCheck(targetLang: string, tFn?: (key: string, opts?: any) => string): LanguagePackCheck[] {
  if (tFn) {
    const targetLabel = tFn(TARGET_LANG_KEYS[targetLang] ?? 'englishLabel');
    return [
      {srcLang: 'en', displayName: tFn('englishToLabel', {lang: targetLabel})},
      {srcLang: 'ja', displayName: tFn('japaneseToLabel', {lang: targetLabel})},
      {srcLang: 'ko', displayName: tFn('koreanToLabel', {lang: targetLabel})},
      {srcLang: 'zh', displayName: tFn('chineseToLabel', {lang: targetLabel})},
    ];
  }
  const targetLabel = TARGET_LANGUAGE_LABELS_FALLBACK[targetLang] || targetLang;
  return [
    {srcLang: 'en', displayName: `English → ${targetLabel}`},
    {srcLang: 'ja', displayName: `Japanese → ${targetLabel}`},
    {srcLang: 'ko', displayName: `Korean → ${targetLabel}`},
    {srcLang: 'zh', displayName: `Chinese → ${targetLabel}`},
  ];
}

async function checkLanguagePacksStatus(targetLang: string, tFn?: (key: string, opts?: any) => string): Promise<{installed: string[]; missing: string[]; allSupported: boolean}> {
  const installed: string[] = [];
  const missing: string[] = [];
  let allSupported = true;

  const packsToCheck = getLanguagePacksToCheck(targetLang, tFn);

  if (Platform.OS === 'ios') {
    const nativeModule = getNativeAppleTranslator();
    if (!nativeModule || typeof nativeModule.getLanguagePackStatus !== 'function') {
      return {installed: [], missing: [], allSupported: true};
    }

    for (const pack of packsToCheck) {
      try {
        const status = await nativeModule.getLanguagePackStatus(pack.srcLang, targetLang);
        if (status === 'installed') {
          installed.push(pack.displayName);
        } else if (status === 'available') {
          missing.push(pack.displayName);
        } else if (status === 'unsupported') {
          allSupported = false;
          missing.push(`${pack.displayName} (not supported)`);
        } else {
          missing.push(pack.displayName);
        }
      } catch (error) {
        warnLog(`[SplashScreen] Failed to check ${pack.displayName}:`, error);
        missing.push(pack.displayName);
      }
    }
  } else {
    // Android with ML Kit
    try {
      const packStatus = await translationService.getPackStatus();
      for (const pack of packsToCheck) {
        const key = `${pack.srcLang}-vi`;
        if (packStatus[key]) {
          installed.push(pack.displayName);
        } else {
          missing.push(pack.displayName);
        }
      }
    } catch (error) {
      warnLog(`[SplashScreen] Failed to check ML Kit language packs:`, error);
      // On Android, if check fails, we still allow proceeding
      // ML Kit will auto-download on first use
      return {installed: [], missing: [], allSupported: true};
    }
  }

  return {installed, missing, allSupported};
}

export const SplashScreen: React.FC = () => {
  const navigation = useNavigation<SplashNavigationProp>();
  const {theme, isDark} = useTheme();
  const {t} = useTranslation('splash');
  const modelState = useModelState();
  const prewarmState = usePrewarmState();
  const overallStatus = useBootstrapOverallStatus();
  const targetLanguage = useTargetLanguage();
  const activeSttModel = MOCK_MODEL;
  const activeSttModelId = 'stt' as const;
  const activeSttLabel = t('sttModelLabel');
  const {
    setModelDownloading,
    setModelDownloadProgress,
    setModelReady,
    setModelError,
    setTranslatorModelDownloading,
    setTranslatorModelReady,
    setTranslatorModelError,
    startPrewarm,
    completePrewarm,
    initialize,
  } = useBootstrapStore();

  const [isInitializing, setIsInitializing] = useState(true);
  const [langPackStep, setLangPackStep] = useState<'idle' | 'needs-download' | 'downloading' | 'retry'>('idle');
  const [missingPackObjs, setMissingPackObjs] = useState<LanguagePackCheck[]>([]);
  const [failedPacks, setFailedPacks] = useState<string[]>([]);
  const [selectedSrcLangs, setSelectedSrcLangs] = useState<Set<string>>(new Set());
  const selectedSrcLangsRef = useRef<Set<string>>(new Set());
  const [packDownloadItems, setPackDownloadItems] = useState<{srcLang: string; displayName: string; status: 'pending' | 'downloading' | 'done'}[]>([]);
  const [isVerifying, setIsVerifying] = useState(false);
  const userChoiceRef = useRef<((confirmed: boolean) => void) | null>(null);
  const hasBootstrappedRef = useRef(false);
  const navigationRef = useRef(navigation);
  navigationRef.current = navigation;

  const handleSkipDownload = () => userChoiceRef.current?.(false);
  const handleStartDownload = () => {
    selectedSrcLangsRef.current = selectedSrcLangs;
    userChoiceRef.current?.(true);
  };
  const handleRetryDownload = () => userChoiceRef.current?.(true);
  const handleToggleLang = (srcLang: string) => {
    setSelectedSrcLangs(prev => {
      const next = new Set(prev);
      if (next.has(srcLang)) { next.delete(srcLang); } else { next.add(srcLang); }
      selectedSrcLangsRef.current = next;
      return next;
    });
  };

  useEffect(() => {
    if (hasBootstrappedRef.current) {
      return;
    }
    hasBootstrappedRef.current = true;

    const run = async () => {
      try {
        initialize();

        // Step 1: Install STT model
        const resolvedModelId = activeSttModelId;
        const resolvedModel = activeSttModel;
        // Check if already installed to avoid flashing a progress bar that disappears instantly
        const sttAlreadyInstalled = await areInstalledModelFilesPresent(resolvedModelId);
        if (!sttAlreadyInstalled) {
          setModelDownloading(resolvedModel);
        }
        try {
          await ensureBundledModelInstalled(
            resolvedModelId,
            sttAlreadyInstalled
              ? undefined
              : (completed, total) => {
                  setModelDownloadProgress({bytesDownloaded: completed, totalBytes: total, percentage: total > 0 ? completed / total : 0});
                },
          );
          await getSTTProcessorInstance().loadModel();
          setModelReady(resolvedModel);
        } catch (error) {
          const message = error instanceof Error ? error.message : 'STT model install/load failed.';
          warnLog('[SplashScreen] STT model install/load failed:', error);
          setModelError(message);
          setIsInitializing(false);
          return;
        }

        // Step 2: Initialize platform-native translation (Apple Translation on iOS, ML Kit on Android)
        // Apple Translation requires language packs to be downloaded on iOS 26+
        // ML Kit auto-downloads language packs on first use
        setTranslatorModelDownloading(PLATFORM_TRANSLATION_MODEL);
        try {
          // Check language packs availability
          const {installed, missing, allSupported} = await checkLanguagePacksStatus(targetLanguage, t);
          warnLog(`[SplashScreen] Language packs: ${installed.length} installed, ${missing.length} missing for target ${targetLanguage}`);

          if (installed.length === 0 && missing.length > 0 && allSupported) {
            const nativeModule = Platform.OS === 'ios' ? getNativeAppleTranslator() : null;
            const allPacks = getLanguagePacksToCheck(targetLanguage, t);
            const missingObjs = allPacks.filter(p => missing.includes(p.displayName));

            // Show language selection UI — all missing packs selected by default
            setMissingPackObjs(missingObjs);
            const initSelected = new Set<string>(missingObjs.map(p => p.srcLang));
            selectedSrcLangsRef.current = initSelected;
            setSelectedSrcLangs(initSelected);
            setLangPackStep('needs-download');

            const confirmed = await new Promise<boolean>(resolve => {
              userChoiceRef.current = resolve;
            });

            if (!confirmed || selectedSrcLangsRef.current.size === 0) {
              markPacksSkipped();
              warnLog('[SplashScreen] User skipped language pack download');
            } else {
              const selectedPacks = allPacks.filter(p => selectedSrcLangsRef.current.has(p.srcLang));
              let pendingPacks = [...selectedPacks];
              let keepRetrying = true;

              setPackDownloadItems(selectedPacks.map(p => ({...p, status: 'pending' as const})));

              while (keepRetrying && pendingPacks.length > 0) {
                if (Platform.OS === 'ios') {
                  // --- iOS: Pre-check to avoid flashing progress when packs already installed ---
                  // Apple LanguageAvailability.status() can inconsistently report .supported
                  // for installed packs, so re-verify before showing progress UI.
                  if (nativeModule) {
                    const preCheckStatuses = await Promise.all(
                      pendingPacks.map(p =>
                        nativeModule.getLanguagePackStatus(p.srcLang, targetLanguage).catch(() => 'unknown'),
                      ),
                    );
                    const alreadyAllInstalled = preCheckStatuses.every(s => s === 'installed');
                    if (alreadyAllInstalled) {
                      markPacksDownloaded();
                      warnLog('[SplashScreen] All packs already installed, skipping download UI');
                      keepRetrying = false;
                      break;
                    }
                    pendingPacks = pendingPacks.filter((_, i) => preCheckStatuses[i] !== 'installed');
                  }

                  // --- iOS download: uses Apple system sheet, poll until confirmed installed ---
                  const PACK_DOWNLOAD_TIMEOUT_MS = 185_000;
                  setLangPackStep('downloading');

                  for (let i = 0; i < pendingPacks.length; i++) {
                    const pack = pendingPacks[i];
                    let packInstalled = false;

                    setPackDownloadItems(prev => prev.map(item =>
                      item.srcLang === pack.srcLang ? {...item, status: 'downloading' as const} : item,
                    ));

                    while (!packInstalled && nativeModule) {
                      try {
                        await Promise.race([
                          nativeModule.downloadLanguageIfNeeded(pack.srcLang, targetLanguage),
                          new Promise<void>(r => setTimeout(r, PACK_DOWNLOAD_TIMEOUT_MS)),
                        ]);
                      } catch {
                        warnLog(`[SplashScreen] downloadLanguageIfNeeded threw for ${pack.displayName}`);
                      }

                      const s = await nativeModule
                        .getLanguagePackStatus(pack.srcLang, targetLanguage)
                        .catch(() => 'unknown' as const);
                      if (s === 'installed') {
                        packInstalled = true;
                      } else {
                        await delay(700);
                      }
                    }

                    setPackDownloadItems(prev => prev.map(item =>
                      item.srcLang === pack.srcLang ? {...item, status: 'done' as const} : item,
                    ));
                    if (i < pendingPacks.length - 1) {
                      await delay(500);
                    }
                  }
                } else {
                  // --- Android: direct ML Kit download, no system sheet ---
                  setLangPackStep('downloading');

                  for (let i = 0; i < pendingPacks.length; i++) {
                    const pack = pendingPacks[i];
                    setPackDownloadItems(prev => prev.map(item =>
                      item.srcLang === pack.srcLang ? {...item, status: 'downloading' as const} : item,
                    ));
                    try {
                      await translationService.downloadLanguagePack(pack.srcLang, targetLanguage);
                    } catch (err) {
                      warnLog(`[SplashScreen] ML Kit download failed for ${pack.displayName}:`, err);
                    }
                    setPackDownloadItems(prev => prev.map(item =>
                      item.srcLang === pack.srcLang ? {...item, status: 'done' as const} : item,
                    ));
                    if (i < pendingPacks.length - 1) {
                      await delay(300);
                    }
                  }
                }

                // --- Verify phase (both platforms) ---
                await delay(1000);
                setIsVerifying(true);
                const nowFailed: string[] = [];
                for (const pack of selectedPacks) {
                  try {
                    const ok = await translationService.isAvailable(pack.srcLang as any, targetLanguage as any);
                    if (!ok) { nowFailed.push(pack.displayName); }
                  } catch {
                    nowFailed.push(pack.displayName);
                  }
                }
                setIsVerifying(false);

                if (nowFailed.length === 0) {
                  markPacksDownloaded();
                  warnLog('[SplashScreen] All selected language packs verified');
                  keepRetrying = false;
                } else {
                  setFailedPacks(nowFailed);
                  setLangPackStep('retry');
                  warnLog(`[SplashScreen] ${nowFailed.length} pack(s) failed: ${nowFailed.join(', ')}`);
                  const retry = await new Promise<boolean>(resolve => { userChoiceRef.current = resolve; });
                  if (!retry) {
                    markPacksSkipped();
                    keepRetrying = false;
                  } else {
                    pendingPacks = selectedPacks.filter(p => nowFailed.includes(p.displayName));
                    setPackDownloadItems(pendingPacks.map(p => ({...p, status: 'pending' as const})));
                  }
                }
              }
            }

            setLangPackStep('idle');
          }

          const translatorReady = await translationService.initialize();
          if (translatorReady) {
            warnLog('[SplashScreen] Platform translation initialized successfully');
          } else {
            warnLog('[SplashScreen] Platform translation not available on this device');
            setTranslatorModelError('Translation not available on this device');
          }
        } catch (error) {
          warnLog('[SplashScreen] Platform translation init failed:', error);
          setTranslatorModelError(error instanceof Error ? error.message : 'Translation init failed');
        }

        setTranslatorModelReady(PLATFORM_TRANSLATION_MODEL);

        // Step 3: Mark prewarm complete.
        // Speaker embedding is intentionally NOT warmed here because loading
        // STT + translation + diarization together pushes iOS into critical memory
        // pressure on physical devices. Diarization is only needed after the
        // meeting or when live speaker assignment is explicitly enabled, so it
        // is initialized lazily at point-of-use instead.
        startPrewarm();

        await delay(300);
        completePrewarm();
        setIsInitializing(false);
        navigationRef.current.replace('Meeting');
      } catch (error) {
        warnLog('[SplashScreen] Bootstrap sequence failed:', error);
        setIsInitializing(false);
      }
    };

    run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const getProgressPercentage = (): number => {
    if (modelState.status === 'cached-ready') {
      return prewarmState.status === 'ready' ? 100 : 90;
    }
    if (modelState.status === 'downloading' && modelState.downloadProgress) {
      return Math.round(modelState.downloadProgress.percentage * 0.7);
    }
    return 0;
  };

  // Palette pulled from the active theme so light mode doesn't get the
  // dark-only tokens that were hardcoded here originally.
  const glowTint = isDark ? 'rgba(162,155,254,0.06)' : 'rgba(91,78,217,0.07)';
  const ringBorderColor = isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.10)';
  const waveBarColor = isDark ? 'rgba(162,155,254,0.7)' : 'rgba(91,78,217,0.55)';

  return (
    <SafeAreaView style={[styles.container, {backgroundColor: theme.colors.background.secondary}]}>
      <View style={styles.backgroundGlow}>
        <View style={[styles.glowCenter, {backgroundColor: glowTint}]} />
      </View>
      <View style={styles.content}>
        <View style={styles.logoSection}>
          <View style={styles.logoContainer}>
            <View style={[styles.logoOuterRing, {borderColor: ringBorderColor}]} />
            <View style={[styles.micCore, {borderColor: theme.colors.secondary}]}>
              <Text style={[styles.micCoreText, {color: theme.colors.secondary}]}>◉</Text>
            </View>
            <View style={styles.waveformBars}>
              <View style={[styles.waveformBar, {backgroundColor: waveBarColor}]} />
              <View style={[styles.waveformBar, styles.waveformBarTall, {backgroundColor: waveBarColor}]} />
              <View style={[styles.waveformBar, {backgroundColor: waveBarColor}]} />
              <View style={[styles.waveformBar, styles.waveformBarTall, {backgroundColor: waveBarColor}]} />
              <View style={[styles.waveformBar, {backgroundColor: waveBarColor}]} />
            </View>
          </View>
          <View style={styles.titleSection}>
            <Text style={[styles.appName, {color: theme.colors.text.primary}]}>{t('appName')}</Text>
            <Text style={[styles.tagline, {color: theme.colors.text.tertiary}]}>{t('appTagline')}</Text>
          </View>
        </View>

        <View style={styles.statusSection}>
          {langPackStep === 'needs-download' ? (
            <View style={[styles.langPackCard, {borderColor: ringBorderColor, backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)'}]}>
              <Text style={[styles.langPackTitle, {color: theme.colors.text.primary}]}>
                {t('langPackSelectionTitle')}
              </Text>
              <Text style={[styles.langPackBody, {color: theme.colors.text.secondary}]}>
                {t('langPackSelectionBody')}
              </Text>
              <View style={styles.langPackList}>
                {missingPackObjs.map(pack => (
                  <Pressable
                    key={pack.srcLang}
                    style={styles.langPackItem}
                    onPress={() => handleToggleLang(pack.srcLang)}>
                    <View style={[
                      styles.checkbox,
                      {borderColor: theme.colors.secondary},
                      selectedSrcLangs.has(pack.srcLang) && {backgroundColor: theme.colors.secondary},
                    ]}>
                      {selectedSrcLangs.has(pack.srcLang) && (
                        <Text style={[styles.checkboxTick, {color: isDark ? '#0a1a14' : '#ffffff'}]}>✓</Text>
                      )}
                    </View>
                    <Text style={[styles.langPackItemText, {color: theme.colors.text.secondary}]}>{pack.displayName}</Text>
                  </Pressable>
                ))}
              </View>
              <Text style={[styles.langPackNote, {color: theme.colors.text.tertiary}]}>
                {t('langPackNote')}
              </Text>
              <View style={styles.langPackActions}>
                <Pressable
                  style={[styles.skipBtn, {borderColor: ringBorderColor}]}
                  onPress={handleSkipDownload}>
                  <Text style={[styles.skipBtnText, {color: theme.colors.text.secondary}]}>{t('langPackSkip')}</Text>
                </Pressable>
                <Pressable
                  style={[styles.confirmBtn, {backgroundColor: theme.colors.secondary}, selectedSrcLangs.size === 0 && {opacity: 0.4}]}
                  onPress={handleStartDownload}
                  disabled={selectedSrcLangs.size === 0}>
                  <Text style={[styles.confirmBtnText, {color: isDark ? '#0a1a14' : '#ffffff'}]}>{t('langPackConfirm')}</Text>
                </Pressable>
              </View>
            </View>
          ) : langPackStep === 'downloading' ? (
            <View style={[styles.langPackCard, {borderColor: ringBorderColor, backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)'}]}>
              <Text style={[styles.langPackTitle, {color: theme.colors.text.primary}]}>
                {isVerifying ? t('langPackVerifyingTitle') : t('langPackDownloadingTitle')}
              </Text>
              <View style={styles.langPackList}>
                {packDownloadItems.map(item => (
                  <View key={item.srcLang} style={styles.langPackItem}>
                    {item.status === 'done' ? (
                      <Text style={[styles.packStatusIcon, {color: theme.colors.secondary}]}>✓</Text>
                    ) : item.status === 'downloading' ? (
                      <ActivityIndicator size="small" color={theme.colors.secondary} style={styles.packStatusSpinner} />
                    ) : (
                      <Text style={[styles.packStatusIcon, {color: theme.colors.text.tertiary}]}>○</Text>
                    )}
                    <Text style={[styles.langPackItemText, {color: theme.colors.text.secondary}]}>{item.displayName}</Text>
                  </View>
                ))}
              </View>
            </View>
          ) : langPackStep === 'retry' ? (
            <View style={[styles.langPackCard, {borderColor: '#ffb4ab', backgroundColor: isDark ? 'rgba(255,180,171,0.06)' : 'rgba(255,180,171,0.08)'}]}>
              <Text style={[styles.langPackTitle, {color: theme.colors.text.primary}]}>
                {t('langPackFailedTitle')}
              </Text>
              <Text style={[styles.langPackBody, {color: theme.colors.text.secondary}]}>
                {t('langPackFailedMessage')}
              </Text>
              <View style={styles.langPackList}>
                {failedPacks.map(pack => (
                  <View key={pack} style={styles.langPackItem}>
                    <Text style={[styles.langPackItemDot, {color: '#ff6b6b'}]}>✗</Text>
                    <Text style={[styles.langPackItemText, {color: theme.colors.text.secondary}]}>{pack}</Text>
                  </View>
                ))}
              </View>
              <View style={styles.langPackActions}>
                <Pressable
                  style={[styles.skipBtn, {borderColor: ringBorderColor}]}
                  onPress={handleSkipDownload}>
                  <Text style={[styles.skipBtnText, {color: theme.colors.text.secondary}]}>{t('langPackSkip')}</Text>
                </Pressable>
                <Pressable
                  style={[styles.confirmBtn, {backgroundColor: theme.colors.secondary}]}
                  onPress={handleRetryDownload}>
                  <Text style={[styles.confirmBtnText, {color: isDark ? '#0a1a14' : '#ffffff'}]}>{t('langPackRetry')}</Text>
                </Pressable>
              </View>
            </View>
          ) : (
            <>
              {isInitializing || modelState.status === 'downloading' || useBootstrapStore.getState().state.translatorModel.status === 'downloading' ? (
                <ProgressCard
                  title={t('loadingModelsTitle')}
                  subtitle={`${activeSttModel.name} + ${PLATFORM_TRANSLATION_MODEL.name}`}
                  progress={getProgressPercentage()}
                  bytesDownloaded={modelState.downloadProgress?.bytesDownloaded ?? 0}
                  totalBytes={modelState.downloadProgress?.totalBytes ?? activeSttModel.diskFootprintMB * 1024 * 1024}
                  status={modelState.status === 'downloading' ? 'downloading' : 'processing'}
                />
              ) : (
                <View style={styles.readinessGrid}>
                  <ReadinessStatus
                    domain="model"
                    status={modelState.status}
                    label={t('modelReadinessAiModel')}
                    description={modelState.currentModel ? `${modelState.currentModel.name} loaded` : undefined}
                  />
                  <ReadinessStatus
                    domain="model"
                    status={useBootstrapStore.getState().state.translatorModel.status}
                    label={t('modelReadinessTranslation')}
                    description={useBootstrapStore.getState().state.translatorModel.currentModel ? `${useBootstrapStore.getState().state.translatorModel.currentModel?.name} loaded` : undefined}
                  />
                  <ReadinessStatus
                    domain="prewarm"
                    status={prewarmState.status}
                    label={t('modelReadinessSpeechRecognition')}
                    description={t('modelReadinessDescription')}
                  />
                </View>
              )}
              <Text style={[styles.statusMessage, {color: theme.colors.text.tertiary}]}>
                {isInitializing ? t('statusInitializing') : overallStatus === 'ready' ? t('statusReady') : t('statusSetupRequired')}
              </Text>
            </>
          )}
        </View>
      </View>

      {langPackStep === 'idle' && (
        <View style={styles.footer}>
          <View style={[styles.metadataContainer, {borderColor: ringBorderColor}]}>
            <Text style={[styles.metadataIconGlyph, {color: theme.colors.secondary}]}>◈</Text>
            <Text style={[styles.metadataText, {color: theme.colors.text.tertiary}]}>{activeSttLabel}</Text>
          </View>

          {isInitializing && (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="small" color={theme.colors.secondary} />
            </View>
          )}

          {!isInitializing && overallStatus === 'ready' && (
            <View style={styles.readyFooter}>
              <Pressable
                style={({pressed}) => [
                  styles.readyButton,
                  {backgroundColor: theme.colors.secondary},
                  pressed && styles.readyButtonPressed,
                ]}
                onPress={() => navigation.replace('Meeting')}>
                <Text style={[styles.readyButtonText, {color: isDark ? theme.colors.text.primary : '#FFFFFF'}]}>{t('startMeetingButton')}</Text>
              </Pressable>
            </View>
          )}
        </View>
      )}
    </SafeAreaView>
  );
};

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}


const styles = StyleSheet.create({
  container: {flex: 1},
  backgroundGlow: {position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center'},
  glowCenter: {marginTop: 80, width: 320, height: 320, borderRadius: 160},
  content: {flex: 1, justifyContent: 'center', paddingHorizontal: spacing.lg},
  logoSection: {alignItems: 'center', marginBottom: spacing.xl},
  logoContainer: {width: 180, height: 180, alignItems: 'center', justifyContent: 'center'},
  logoOuterRing: {position: 'absolute', width: 180, height: 180, borderRadius: 90, borderWidth: 1},
  micCore: {width: 56, height: 56, borderRadius: 28, borderWidth: 2, alignItems: 'center', justifyContent: 'center'},
  micCoreText: {fontSize: 26},
  waveformBars: {position: 'absolute', bottom: 42, flexDirection: 'row', gap: 6},
  waveformBar: {width: 4, height: 24, borderRadius: 2},
  waveformBarTall: {height: 36},
  titleSection: {marginTop: spacing.md, alignItems: 'center'},
  appName: {fontFamily: typography.fontFamily.headline, fontSize: 24, fontWeight: '700', textAlign: 'center'},
  tagline: {fontFamily: typography.fontFamily.label, fontSize: 12, letterSpacing: 2, textTransform: 'uppercase', marginTop: 8},
  statusSection: {gap: spacing.md},
  readinessGrid: {gap: spacing.md},
  statusMessage: {textAlign: 'center', fontFamily: typography.fontFamily.body, fontSize: typography.fontSize.xl, marginTop: spacing.sm},
  footer: {paddingHorizontal: spacing.lg, paddingBottom: spacing.xl, alignItems: 'center'},
  metadataContainer: {flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: borderRadius.full, borderWidth: 1, marginBottom: spacing.lg},
  metadataIconGlyph: {},
  metadataText: {},
  loadingContainer: {marginTop: spacing.md},
  readyFooter: {width: '100%', marginTop: spacing.md},
  readyButton: {borderRadius: borderRadius.lg, paddingVertical: spacing.md, alignItems: 'center', ...shadows.card.elevated},
  readyButtonPressed: {opacity: 0.9},
  readyButtonText: {fontWeight: '700'},
  // Language pack explanation card
  langPackCard: {borderRadius: borderRadius.lg, borderWidth: 1, padding: spacing.lg, gap: spacing.md},
  langPackTitle: {fontFamily: typography.fontFamily.headline, fontSize: typography.fontSize.xl, fontWeight: '700'},
  langPackBody: {fontFamily: typography.fontFamily.body, fontSize: typography.fontSize.md, lineHeight: 22},
  langPackList: {gap: spacing.sm},
  langPackItem: {flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.xs},
  langPackItemDot: {fontSize: 8},
  langPackItemText: {fontFamily: typography.fontFamily.body, fontSize: typography.fontSize.md, flex: 1},
  checkbox: {width: 20, height: 20, borderRadius: 4, borderWidth: 2, alignItems: 'center', justifyContent: 'center'},
  checkboxTick: {fontSize: 12, fontWeight: '700', lineHeight: 14},
  packStatusIcon: {fontSize: 14, width: 20, textAlign: 'center'},
  packStatusSpinner: {width: 20},
  langPackNote: {fontFamily: typography.fontFamily.label, fontSize: typography.fontSize.sm, textAlign: 'center'},
  langPackActions: {flexDirection: 'row', gap: spacing.md, marginTop: spacing.xs},
  skipBtn: {flex: 1, borderWidth: 1, borderRadius: borderRadius.md, paddingVertical: spacing.md, alignItems: 'center'},
  skipBtnText: {fontFamily: typography.fontFamily.body, fontSize: typography.fontSize.md, fontWeight: '600'},
  confirmBtn: {flex: 1, borderRadius: borderRadius.md, paddingVertical: spacing.md, alignItems: 'center', ...shadows.card.elevated},
  confirmBtnText: {fontFamily: typography.fontFamily.body, fontSize: typography.fontSize.md, fontWeight: '700'},
});

export default SplashScreen;
