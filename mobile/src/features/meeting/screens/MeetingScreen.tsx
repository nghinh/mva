/**
 * MeetingScreen
 *
 * Main meeting screen with start/stop controls and live two-lane transcript/translation UI.
 *
 * @see Stories 4-1, 4-2, 4-3, 4-4, 4-5, 4-6
 * @see docs/implementation-artifacts/4-1-build-meeting-screen-with-two-lane-layout.md
 * @see docs/implementation-artifacts/4-2-implement-recording-indicator-and-session-timer.md
 * @see docs/implementation-artifacts/4-3-implement-auto-scroll-and-jump-to-latest.md
 * @see docs/implementation-artifacts/4-4-implement-stop-meeting-and-session-save-flow.md
 * @see docs/implementation-artifacts/4-5-build-waiting-state-before-speech-detected.md
 * @see docs/implementation-artifacts/4-6-deliver-accessibility-and-dark-mode-for-meeting-screen.md
 */

import React, {useCallback, useState, useRef, useEffect} from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  AccessibilityInfo,
  SafeAreaView,
} from 'react-native';
import {useNavigation} from '../../../app/navigation/router';
import {StackNavigationProp} from '../../../app/navigation/router';
import {useTheme} from '../../../shared/hooks/useTheme';
import {RootStackParamList} from '../../../app/navigation/router';
import {AppIcon} from '../../../shared/components/ui';
import {useBootstrapOverallStatus, useBootstrapStore, useModelState, usePrewarmState, useTranslatorModelState} from '../../../shared/store';
import {MeetingStatusBar} from '../components/MeetingStatusBar';
import {TranscriptLane} from '../components/TranscriptLane';
import {TranslationLane} from '../components/TranslationLane';
import {useMeetingSession} from '../hooks/useMeetingSession';
import type {SessionStatus, ConnectivityStatus} from '../state/meetingStore';

type MeetingNavigationProp = StackNavigationProp<RootStackParamList, 'Meeting'>;

const APP_NAME = 'Executive MVA';

// =============================================================================
// WaitingStateOverlay
// Shown when meeting starts but before any speech is detected.
// Calm, non-distracting visual with sound wave animation.
// =============================================================================

function SoundWaveBar({
  index,
  baseHeight,
}: {
  index: number;
  baseHeight: number;
}): React.JSX.Element {
  const {theme, isReduceMotionEnabled} = useTheme();
  const anim = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    if (isReduceMotionEnabled) {
      // Static bar when reduced motion is enabled
      anim.setValue(1);
      return undefined;
    }
    // Animate from 0.3 → 1 with staggered timing per bar index
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(anim, {
          toValue: 1,
          duration: 600 + index * 150,
          useNativeDriver: false,
        }),
        Animated.timing(anim, {
          toValue: 0.3,
          duration: 600 + index * 150,
          useNativeDriver: false,
        }),
      ]),
    );
    animation.start();
    return () => animation.stop();
  }, [anim, index, isReduceMotionEnabled]);

  return (
    <Animated.View
      style={[
        styles.soundWaveBar,
        {
          backgroundColor: theme.colors.primary,
          opacity: anim,
          height: baseHeight,
        },
      ]}
    />
  );
}

function WaitingStateOverlay({
  opacity,
  isRecording,
}: {
  opacity: Animated.Value;
  isRecording: boolean;
}): React.JSX.Element {
  const {theme} = useTheme();
  const waveHeights = [12, 20, 14, 24, 16, 22, 10];

  return (
    <Animated.View
      style={[styles.waitingOverlay, {opacity}]}
      pointerEvents="box-none"
      accessibilityLabel="Waiting for speech. Speak in English, Japanese, or Korean."
      accessibilityLiveRegion="polite">
      <View style={styles.waitingContent}>
        {/* Sound wave animation */}
        <View style={styles.soundWaveContainer}>
          {waveHeights.map((h, i) => (
            <SoundWaveBar key={i} index={i} baseHeight={h} />
          ))}
        </View>

        {/* Listening text */}
        <Text style={[styles.waitingTitle, {color: theme.colors.text.secondary}]}>
          Listening...
        </Text>
        <Text style={[styles.waitingHint, {color: theme.colors.text.tertiary}]}>
          Speak in English, Japanese, or Korean
        </Text>

        {/* Language hint pills */}
        <View style={styles.languageHintRow}>
          <View
            style={[
              styles.languageHintPill,
              {backgroundColor: theme.colors.surface.secondary},
            ]}>
            <Text style={[styles.languageHintFlag]}>🇬🇧</Text>
            <Text
              style={[styles.languageHintText, {color: theme.colors.text.tertiary}]}>
              EN
            </Text>
          </View>
          <View
            style={[
              styles.languageHintPill,
              {backgroundColor: theme.colors.surface.secondary},
            ]}>
            <Text style={[styles.languageHintFlag]}>🇯🇵</Text>
            <Text
              style={[styles.languageHintText, {color: theme.colors.text.tertiary}]}>
              JA
            </Text>
          </View>
          <View
            style={[
              styles.languageHintPill,
              {backgroundColor: theme.colors.surface.secondary},
            ]}>
            <Text style={[styles.languageHintFlag]}>🇰🇷</Text>
            <Text
              style={[styles.languageHintText, {color: theme.colors.text.tertiary}]}>
              KO
            </Text>
          </View>
        </View>
      </View>
    </Animated.View>
  );
}

// =============================================================================
// Main MeetingScreen
// =============================================================================

export function MeetingScreen(): React.JSX.Element {
  const {theme} = useTheme();
  const navigation = useNavigation<MeetingNavigationProp>();
  const bootstrapStatus = useBootstrapOverallStatus();
  const modelState = useModelState();
  const translatorModelState = useTranslatorModelState();
  const prewarmState = usePrewarmState();
  const {startPrewarm, completePrewarm} = useBootstrapStore();

  const {
    session,
    status,
    connectivity,
    transcript,
    partialTranscript,
    currentUtteranceId,
    isActive,
    isRecording,
    startMeeting,
    stopMeeting,
    pipelineStatus,
    pipelineError,
    isOffline,
    isDegraded,
  } = useMeetingSession();

  const [latencyMs] = useState<number | null>(45);
  const waitingOpacity = useRef(new Animated.Value(1)).current;
  const hasShownFirstSpeech = useRef(false);

  // Transition out waiting overlay when first speech is detected
  useEffect(() => {
    const hasSpeech = partialTranscript.length > 0 || transcript.length > 0;
    if (hasSpeech && !hasShownFirstSpeech.current) {
      hasShownFirstSpeech.current = true;
      Animated.timing(waitingOpacity, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }).start();
    }
    if (!hasSpeech && hasShownFirstSpeech.current) {
      hasShownFirstSpeech.current = false;
      waitingOpacity.setValue(1);
    }
  }, [partialTranscript, transcript, waitingOpacity]);

  useEffect(() => {
    const modelsReady = modelState.status === 'cached-ready';

    if (modelsReady && prewarmState.status === 'pending') {
      startPrewarm();
      const timer = setTimeout(() => {
        completePrewarm();
      }, 250);
      return () => clearTimeout(timer);
    }
  }, [modelState.status, prewarmState.status, startPrewarm, completePrewarm]);

  // Show waiting state when: idle, or recording but no speech yet
  const showWaiting = status === 'idle' || (isRecording && transcript.length === 0 && !partialTranscript);

  const handleStartMeeting = useCallback(() => {
    startMeeting('en', 'vi');
  }, [startMeeting]);

  const handleStopMeeting = useCallback(async () => {
    await stopMeeting();
  }, [stopMeeting]);

  const sttReady = modelState.status === 'cached-ready';
  const translatorInstalled = translatorModelState.status === 'cached-ready';
  const canStartCapture = sttReady && prewarmState.status !== 'failed';

  const handlePrimaryButtonPress = useCallback(async () => {
    if (isActive) {
      await handleStopMeeting();
      return;
    }

    if (!sttReady) {
      navigation.navigate('Settings');
      return;
    }

    handleStartMeeting();
  }, [isActive, handleStopMeeting, canStartCapture, navigation, handleStartMeeting]);

  const getButtonLabel = (): string => {
    if (status === 'stopping') return 'Stopping...';
    if (isActive) return 'Stop Meeting';
    if (!sttReady) return 'Open Settings';
    return 'Start Meeting';
  };

  const isButtonDisabled = status === 'stopping';

  return (
    <SafeAreaView
      style={[styles.container, {backgroundColor: theme.colors.background.primary}]}
      accessibilityLabel="Meeting screen"
      accessibilityRole="none">
      {/* Ambient Top Glow */}
      <View style={styles.ambientTopGlow} />

      {/* Header */}
      <View
        style={[styles.header, {backgroundColor: theme.colors.surface.primary}]}
        accessibilityLabel="Header">
        <View style={styles.headerLeft}>
          <Text
            style={[styles.headerEyebrow, {color: theme.colors.text.tertiary}]}>
            {isRecording ? 'LIVE SESSION' : 'READY'}
          </Text>
          <Text
            style={[
              styles.headerTitle,
              theme.typography.screenTitle,
              {color: theme.colors.text.primary},
            ]}>
            {APP_NAME}
          </Text>
        </View>
        <View style={styles.headerActions}>
          <TouchableOpacity
            style={[styles.headerButton, {backgroundColor: theme.colors.surface.secondary}]}
            onPress={() => navigation.navigate('History')}
            activeOpacity={0.7}
            disabled={isActive}
            accessibilityLabel="View meeting history"
            accessibilityHint="Shows past meeting transcripts and translations">
            <AppIcon name="forum" size={18} color={theme.colors.text.primary} />
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.headerButton, {backgroundColor: theme.colors.surface.secondary}]}
            onPress={() => navigation.navigate('Settings')}
            activeOpacity={0.7}
            disabled={isActive}
            accessibilityLabel="Open settings"
            accessibilityHint="Configure model downloads and meeting preferences">
            <AppIcon name="settings" size={18} color={theme.colors.text.primary} />
          </TouchableOpacity>
        </View>
      </View>

      {!canStartCapture && (
        <View
          style={[styles.readinessWarning, {backgroundColor: theme.colors.surface.secondary}]}
          accessibilityLabel="Meeting setup incomplete"
          accessibilityRole="alert">
          <Text style={[styles.readinessTitle, {color: theme.colors.text.primary}]}>
            Meeting setup incomplete
          </Text>
          <Text style={[styles.readinessCopy, {color: theme.colors.text.tertiary}]}>
            {modelState.status !== 'cached-ready'
              ? 'Download a valid on-device model before recording.'
              : translatorModelState.status !== 'cached-ready'
                ? 'Translation model is optional. Install it to enable in-meeting translation.'
              : prewarmState.status !== 'ready'
                ? 'Finalizing speech recognition warm-up...'
                : (!translatorInstalled
                    ? 'Translation may take a moment to initialize when the meeting starts.'
                    : 'Translation model will initialize when the meeting starts.')}
          </Text>
        </View>
      )}

      {/* Status Bar */}
      <View style={styles.statusBarContainer}>
        <MeetingStatusBar
          sessionStatus={status as SessionStatus}
          connectivity={connectivity as ConnectivityStatus}
          startedAt={session.startedAt}
          latencyMs={latencyMs}
          onStopMeeting={handleStopMeeting}
          pipelineStatus={pipelineStatus}
          pipelineError={pipelineError}
        />
      </View>

      {/* Two-Lane Content - Each lane independently scrollable */}
      <View
        style={[styles.lanesContainer, {backgroundColor: theme.colors.surface.primary}]}
        accessibilityLabel="Meeting content">
        <TranscriptLane
          entries={transcript}
          partialTranscript={partialTranscript}
          currentUtteranceId={currentUtteranceId}
          isRecording={isRecording}
          isOffline={isOffline}
          suppressPlaceholder={showWaiting}
        />
        <TranslationLane
          entries={session.translations}
          isOffline={isOffline}
          isDegraded={isDegraded}
          translationAvailable={true}
          degradedMessage={null}
          isActive={isActive}
          isRecording={isRecording}
          suppressPlaceholder={showWaiting}
        />

        {/* Waiting State Overlay */}
        {showWaiting && (
          <WaitingStateOverlay opacity={waitingOpacity} isRecording={isRecording} />
        )}
      </View>

      {/* Footer with Controls */}
      <View style={[styles.footer, {backgroundColor: theme.colors.surface.primary}]}>
        {/* Primary Start/Stop Button */}
        <TouchableOpacity
          style={[
            styles.primaryButton,
            {
              backgroundColor: isActive
                ? theme.colors.error
                : theme.colors.primary,
            },
          ]}
          onPress={handlePrimaryButtonPress}
          activeOpacity={0.85}
          disabled={isButtonDisabled}
          accessibilityLabel={isActive ? 'Stop meeting' : 'Start meeting'}
          accessibilityHint={
            isActive
              ? 'Ends the current recording session'
              : canStartCapture
                ? 'Begins a new recording session'
                : 'Navigate to settings to configure models'
          }>
          <View style={styles.primaryButtonContent}>
            <AppIcon
              name={isActive ? 'stop' : 'mic'}
              size={20}
              color={theme.colors.text.primary}
            />
            <Text style={[styles.primaryButtonText, {color: theme.colors.text.primary}]}>
              {getButtonLabel()}
            </Text>
          </View>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  ambientTopGlow: {
    position: 'absolute',
    top: -120,
    right: -60,
    width: 240,
    height: 240,
    borderRadius: 120,
    backgroundColor: 'rgba(108, 92, 231, 0.08)',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  headerLeft: {
    gap: 2,
  },
  headerEyebrow: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  headerTitle: {},
  headerActions: {
    flexDirection: 'row',
    gap: 10,
  },
  headerButton: {
    width: 44,
    height: 44,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  statusBarContainer: {
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  lanesContainer: {
    flex: 1,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  readinessWarning: {
    marginHorizontal: 16,
    marginTop: 8,
    marginBottom: 4,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  readinessTitle: {
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 4,
  },
  readinessCopy: {
    fontSize: 12,
    lineHeight: 18,
  },
  footer: {
    padding: 16,
    paddingBottom: 24,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(255,255,255,0.06)',
    gap: 12,
  },
  primaryButton: {
    height: 56,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#6C5CE7',
    shadowOffset: {width: 0, height: 8},
    shadowOpacity: 0.25,
    shadowRadius: 24,
  },
  primaryButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  primaryButtonText: {
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  // Waiting state overlay styles
  waitingOverlay: {
    position: 'absolute',
    top: 40,
    left: 0,
    right: 0,
    bottom: '50%',
    justifyContent: 'flex-start',
    alignItems: 'center',
    zIndex: 10,
    paddingHorizontal: 24,
    paddingTop: 40,
  },
  waitingContent: {
    alignItems: 'center',
    gap: 14,
    width: '100%',
    maxWidth: 320,
  },
  soundWaveContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    height: 40,
  },
  soundWaveBar: {
    width: 3,
    borderRadius: 2,
  },
  waitingTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  waitingHint: {
    fontSize: 14,
    fontWeight: '400',
    textAlign: 'center',
    lineHeight: 20,
    maxWidth: 260,
  },
  languageHintRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 2,
  },
  languageHintPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
  },
  languageHintFlag: {
    fontSize: 12,
  },
  languageHintText: {
    fontSize: 10,
    fontWeight: '600',
  },
});

export default MeetingScreen;
