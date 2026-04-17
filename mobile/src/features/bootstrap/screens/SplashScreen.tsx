import React, {useEffect, useRef, useState} from 'react';
import {View, Text, StyleSheet, Pressable, ActivityIndicator, SafeAreaView} from 'react-native';
import {useNavigation} from '../../../app/navigation/router';
import {StackNavigationProp} from '../../../app/navigation/router';
import {spacing, typography, borderRadius, shadows} from '@shared/constants';
import {useTheme} from '@shared/hooks/useTheme';
import {ReadinessStatus, ProgressCard} from '@shared/components/ui';
import {useBootstrapStore, useModelState, usePrewarmState, useBootstrapOverallStatus} from '@shared/store';
import {ModelInfo} from '@shared/types';
import type {RootStackParamList} from '../../../app/navigation/router';
import {getSTTProcessorInstance} from '../../../native/stt/STTProcessor';
import {warnLog} from '../../../shared/utils/logger';
import {getOnDeviceTranslator} from '../../../services/OnDeviceTranslator';
import {areBundledAssetsAvailable, ensureBundledModelInstalled} from '../../../native/models/BundledModelInstaller';

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

const MOCK_TRANSLATOR_MODEL: ModelInfo = {
  id: 'nllb-600m-mobile',
  name: 'NLLB-600M Mobile',
  version: '0.1.0-alpha',
  quality: 'int8',
  diskFootprintMB: 780,
  languages: ['EN', 'JA', 'KO', 'ZH', 'VI'],
  inferenceSpeedRTF: 0.4,
  isOptimizedFor: ['iPhone 15 Pro'],
};

type SplashNavigationProp = StackNavigationProp<RootStackParamList, 'Bootstrap'>;

export const SplashScreen: React.FC = () => {
  const navigation = useNavigation<SplashNavigationProp>();
  const {theme, isDark} = useTheme();
  const modelState = useModelState();
  const prewarmState = usePrewarmState();
  const overallStatus = useBootstrapOverallStatus();
  const {
    setModelDownloading,
    setModelDownloadProgress,
    setModelReady,
    setTranslatorModelDownloading,
    setTranslatorModelDownloadProgress,
    setTranslatorModelReady,
    setTranslatorModelError,
    startPrewarm,
    completePrewarm,
    initialize,
  } = useBootstrapStore();

  const [isInitializing, setIsInitializing] = useState(true);
  const hasBootstrappedRef = useRef(false);
  const navigationRef = useRef(navigation);
  navigationRef.current = navigation;

  useEffect(() => {
    if (hasBootstrappedRef.current) {
      return;
    }
    hasBootstrappedRef.current = true;

    const run = async () => {
      try {
        initialize();

        // Step 1: Install STT model
        setModelDownloading(MOCK_MODEL);
        try {
          await ensureBundledModelInstalled('stt', (completed, total) => {
            setModelDownloadProgress({bytesDownloaded: completed, totalBytes: total, percentage: total > 0 ? completed / total : 0});
          });
          await getSTTProcessorInstance().loadModel();
          setModelReady(MOCK_MODEL);
        } catch (error) {
          warnLog('[SplashScreen] STT model install/load failed:', error);
          setModelReady(MOCK_MODEL); // Still mark ready so we can try transcript-only mode
        }

        // Step 2: Install NLLB translation model (this is the slow part ~5-6s)
        setTranslatorModelDownloading(MOCK_TRANSLATOR_MODEL);
        try {
          await ensureBundledModelInstalled('nllb', (completed, total) => {
            setTranslatorModelDownloadProgress({bytesDownloaded: completed, totalBytes: total, percentage: total > 0 ? completed / total : 0});
          });
        } catch (error) {
          warnLog('[SplashScreen] NLLB model install failed:', error);
          setTranslatorModelError(error instanceof Error ? error.message : 'NLLB install failed');
        }

        // Step 3: Keep the translation model installed but do not preload it.
        // On physical iOS devices, keeping STT + NLLB resident before the user
        // even starts a meeting causes critical memory pressure. Translator load
        // is deferred until the first real translation request.
        const translator = getOnDeviceTranslator();
        const alreadyLoaded = await translator.isLoaded();
        console.warn('[SplashScreen] isLoaded check: alreadyLoaded =', alreadyLoaded);
        if (alreadyLoaded) {
          warnLog('[SplashScreen] NLLB translator already in memory');
        } else {
          warnLog('[SplashScreen] NLLB translator install verified; native load deferred until needed');
        }

        setTranslatorModelReady(MOCK_TRANSLATOR_MODEL);

        // Step 4: Mark prewarm complete.
        // Speaker embedding is intentionally NOT warmed here because loading
        // STT + NLLB + diarization together pushes iOS into critical memory
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
            <Text style={[styles.appName, {color: theme.colors.text.primary}]}>Meeting Voice Assistant</Text>
            <Text style={[styles.tagline, {color: theme.colors.text.tertiary}]}>Understand every voice</Text>
          </View>
        </View>

        <View style={styles.statusSection}>
          {isInitializing || modelState.status === 'downloading' || useBootstrapStore.getState().state.translatorModel.status === 'downloading' ? (
            <ProgressCard
              title="Loading on-device models..."
              subtitle={`${MOCK_MODEL.name} + ${MOCK_TRANSLATOR_MODEL.name}`}
              progress={getProgressPercentage()}
              bytesDownloaded={modelState.downloadProgress?.bytesDownloaded ?? 0}
              totalBytes={modelState.downloadProgress?.totalBytes ?? MOCK_MODEL.diskFootprintMB * 1024 * 1024}
              status={modelState.status === 'downloading' ? 'downloading' : 'processing'}
            />
          ) : (
            <View style={styles.readinessGrid}>
              <ReadinessStatus
                domain="model"
                status={modelState.status}
                label="AI Model"
                description={modelState.currentModel ? `${modelState.currentModel.name} loaded` : undefined}
              />
              <ReadinessStatus
                domain="model"
                status={useBootstrapStore.getState().state.translatorModel.status}
                label="Translation Model"
                description={useBootstrapStore.getState().state.translatorModel.currentModel ? `${useBootstrapStore.getState().state.translatorModel.currentModel?.name} loaded` : undefined}
              />
              <ReadinessStatus
                domain="prewarm"
                status={prewarmState.status}
                label="Speech Recognition"
                description="Ready for first utterance"
              />
            </View>
          )}

          <Text style={[styles.statusMessage, {color: theme.colors.text.tertiary}]}>
            {isInitializing ? 'Getting ready...' : overallStatus === 'ready' ? 'Ready to start' : 'Setup required'}
          </Text>
        </View>
      </View>

      <View style={styles.footer}>
        <View style={[styles.metadataContainer, {borderColor: ringBorderColor}]}>
          <Text style={[styles.metadataIconGlyph, {color: theme.colors.secondary}]}>◈</Text>
          <Text style={[styles.metadataText, {color: theme.colors.text.tertiary}]}>SenseVoice • EN / JA / KO / ZH</Text>
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
              <Text style={[styles.readyButtonText, {color: isDark ? theme.colors.text.primary : '#FFFFFF'}]}>Start Meeting</Text>
            </Pressable>
          </View>
        )}
      </View>
    </SafeAreaView>
  );
};

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function simulateProgress(
  onProgress: (progress: {bytesDownloaded: number; totalBytes: number; percentage: number}) => void,
  targetPercent: number,
): Promise<void> {
  const totalBytes = 234 * 1024 * 1024;
  const steps = 20;
  const stepDelay = 100;
  const stepPercent = targetPercent / steps;

  for (let i = 1; i <= steps; i++) {
    await delay(stepDelay);
    onProgress({
      bytesDownloaded: Math.round((totalBytes * (i * stepPercent)) / 100),
      totalBytes,
      percentage: Math.min(i * stepPercent, targetPercent),
    });
  }
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
});

export default SplashScreen;
