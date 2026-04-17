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

import React, {useCallback, useState, useEffect} from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
} from 'react-native';
import {useNavigation} from '../../../app/navigation/router';
import {StackNavigationProp} from '../../../app/navigation/router';
import {useTheme} from '../../../shared/hooks/useTheme';
import {RootStackParamList} from '../../../app/navigation/router';
import {AppBottomNav, AppIcon} from '../../../shared/components/ui';
import {useBootstrapStore, useModelState, usePrewarmState, useTranslatorModelState} from '../../../shared/store';
import {useDeveloperMode, useTargetLanguage} from '../../../shared/store/settingsStore';
import {MeetingStatusBar} from '../components/MeetingStatusBar';
import {DeveloperMetricsOverlay} from '../components/DeveloperMetricsOverlay/DeveloperMetricsOverlay';
import {TranscriptLane} from '../components/TranscriptLane';
import {TranslationLane} from '../components/TranslationLane';
import {useMeetingSession} from '../hooks/useMeetingSession';
import type {SessionStatus, ConnectivityStatus} from '../state/meetingStore';
import {useDeveloperMetrics} from '../store/developerMetricsStore';

type MeetingNavigationProp = StackNavigationProp<RootStackParamList, 'Meeting'>;
type LaneFocusMode = 'original' | 'split' | 'translation';

const APP_NAME = 'Executive MVA';

// =============================================================================
// Main MeetingScreen
// =============================================================================

export function MeetingScreen(): React.JSX.Element {
  const {theme} = useTheme();
  const navigation = useNavigation<MeetingNavigationProp>();
  const modelState = useModelState();
  const translatorModelState = useTranslatorModelState();
  const prewarmState = usePrewarmState();
  const {startPrewarm, completePrewarm} = useBootstrapStore();
  const developerMode = useDeveloperMode();
  const {speakerDebug} = useDeveloperMetrics();
  const targetLanguage = useTargetLanguage();

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
    degradedMessage,
  } = useMeetingSession();

  const latestDetectedLanguage =
    transcript.length > 0
      ? transcript[transcript.length - 1]?.sourceLanguage?.toUpperCase()
      : 'AUTO';

  const [latencyMs] = useState<number | null>(45);
  const [laneFocusMode, setLaneFocusMode] = useState<LaneFocusMode>('split');

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

  const handleStartMeeting = useCallback(() => {
    // Use target language from user preferences (defaults to Vietnamese)
    startMeeting('en', targetLanguage);
  }, [startMeeting, targetLanguage]);

  const handleStopMeeting = useCallback(async () => {
    console.warn('[MeetingScreen] handleStopMeeting: starting');
    try {
      console.warn('[MeetingScreen] calling stopMeeting()...');
      const result = await stopMeeting();
      console.warn('[MeetingScreen] stopMeeting resolved sessionId=', result.sessionId, 'fallbackSession=', !!result.fallbackSession);
      if (result.sessionId) {
        console.warn('[MeetingScreen] Calling navigation.navigate(SessionReview, sessionId=', result.sessionId, ')');
        navigation.navigate('SessionReview', {
          sessionId: result.sessionId,
          fallbackSession: result.fallbackSession ?? undefined,
          fallbackUtterances: result.fallbackUtterances ?? undefined,
        });
        console.warn('[MeetingScreen] navigation.navigate returned');
      } else {
        console.warn('[MeetingScreen] sessionId is null, not navigating');
      }
    } catch (error) {
      // If stopMeeting itself throws (not just warns), do not navigate -
      // something went wrong that the user should see on the meeting screen.
      console.warn('[MeetingScreen] stopMeeting failed, staying on screen:', error);
    }
  }, [stopMeeting, navigation]);

  const sttReady = modelState.status === 'cached-ready';
  const translatorInstalled = translatorModelState.status === 'cached-ready';
  const canStartCapture = sttReady && prewarmState.status !== 'failed';
  const isLiveWorkspace = isActive || status === 'stopping';
  const showTranscriptLane = laneFocusMode !== 'translation';
  const showTranslationLane = laneFocusMode !== 'original';
  const transcriptLaneFlex = laneFocusMode === 'split' ? 1 : 1;
  const translationLaneFlex = laneFocusMode === 'split' ? 1 : 1;
  const laneFocusOptions: Array<{key: LaneFocusMode; label: string}> = [
    {key: 'original', label: 'Original'},
    {key: 'split', label: 'Split'},
    {key: 'translation', label: 'Translation'},
  ];

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
            ]}
            numberOfLines={1}>
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
            accessibilityHint="Configure bundled models and meeting preferences">
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
              ? 'Speech recognition model not ready. Please wait for preparation to complete.'
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
          currentLanguage={latestDetectedLanguage || 'AUTO'}
          developerMode={developerMode}
          speakerDebug={speakerDebug}
        />
      </View>

      {/* Two-Lane Content - Each lane independently scrollable */}
      <View
        style={[styles.lanesContainer, {backgroundColor: theme.colors.surface.primary}]}
        accessibilityLabel="Meeting content">
        <View
          style={[
            styles.laneFocusToggle,
            {backgroundColor: theme.colors.surface.secondary, borderColor: theme.colors.border.subtle},
          ]}>
          {laneFocusOptions.map((option) => {
            const isActiveOption = laneFocusMode === option.key;
            return (
              <TouchableOpacity
                key={option.key}
                style={[
                  styles.laneFocusOption,
                  isActiveOption && {backgroundColor: theme.colors.surface.primary},
                ]}
                onPress={() => setLaneFocusMode(option.key)}
                activeOpacity={0.8}
                accessibilityRole="button"
                accessibilityState={{selected: isActiveOption}}
                accessibilityLabel={`Focus ${option.label.toLowerCase()} lane`}>
                <Text
                  style={[
                    styles.laneFocusOptionText,
                    {color: isActiveOption ? theme.colors.text.primary : theme.colors.text.tertiary},
                  ]}>
                  {option.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
        {showTranscriptLane && (
          <TranscriptLane
            style={{flex: transcriptLaneFlex}}
            entries={transcript}
            partialTranscript={partialTranscript}
            currentUtteranceId={currentUtteranceId}
            isRecording={isRecording}
            isOffline={isOffline}
          />
        )}
        {showTranslationLane && (
          <TranslationLane
            style={{flex: translationLaneFlex}}
            entries={session.translations}
            isOffline={isOffline}
            isDegraded={isDegraded}
            translationAvailable={true}
            degradedMessage={degradedMessage}
            isActive={isActive}
            isRecording={isRecording}
          />
        )}
      </View>

      {/* Developer Metrics Overlay — visible only when dev mode is on */}
      {developerMode && isActive && <DeveloperMetricsOverlay />}

      {!isLiveWorkspace && (
        <View
          style={[
            styles.footer,
            styles.footerIdle,
            {backgroundColor: theme.colors.surface.primary},
          ]}>
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

          <View style={styles.bottomNavWrap}>
            <AppBottomNav activeTab="live" />
          </View>
        </View>
      )}
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
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  headerLeft: {
    gap: 2,
    flex: 1,
    minWidth: 0,
  },
  headerEyebrow: {
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  headerTitle: {
    fontSize: 20,
    lineHeight: 28,
  },
  headerActions: {
    flexDirection: 'row',
    gap: 8,
    marginLeft: 12,
  },
  headerButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  statusBarContainer: {
    paddingHorizontal: 16,
    paddingTop: 6,
  },
  lanesContainer: {
    flex: 1,
    paddingHorizontal: 12,
    paddingVertical: 4,
    gap: 10,
  },
  laneFocusToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    padding: 4,
    borderRadius: 12,
    borderWidth: 1,
  },
  laneFocusOption: {
    flex: 1,
    minHeight: 36,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  laneFocusOptionText: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  readinessWarning: {
    marginHorizontal: 16,
    marginTop: 6,
    marginBottom: 4,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  readinessTitle: {
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 2,
  },
  readinessCopy: {
    fontSize: 11,
    lineHeight: 16,
  },
  footer: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 0,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(255,255,255,0.06)',
    gap: 8,
  },
  footerIdle: {
    paddingBottom: 0,
  },
  bottomNavWrap: {
    marginHorizontal: -16,
  },
  primaryButton: {
    height: 52,
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
    gap: 8,
  },
  primaryButtonText: {
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
});

export default MeetingScreen;
