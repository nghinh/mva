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

import React, {useCallback, useState, useEffect, useRef} from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  Alert,
  Platform,
  ActivityIndicator,
} from 'react-native';
import {useTranslation} from 'react-i18next';
import {useNavigation} from '../../../app/navigation/router';
import {StackNavigationProp} from '../../../app/navigation/router';
import {useTheme} from '../../../shared/hooks/useTheme';
import {RootStackParamList} from '../../../app/navigation/router';
import {AppBottomNav, AppIcon} from '../../../shared/components/ui';
import {useBootstrapStore, useModelState, usePrewarmState, useTranslatorModelState} from '../../../shared/store';
import {useDeveloperMode, useTargetLanguage, useTtsEnabled} from '../../../shared/store/settingsStore';
import {ttsService} from '../../../services/tts/TTSService';
import {useTTSSpeaker} from '../hooks/useTTSSpeaker';
import {MeetingStatusBar} from '../components/MeetingStatusBar';
import {DeveloperMetricsOverlay} from '../components/DeveloperMetricsOverlay/DeveloperMetricsOverlay';
import {TranscriptLane} from '../components/TranscriptLane';
import {TranslationLane} from '../components/TranslationLane';
import {useMeetingSession} from '../hooks/useMeetingSession';
import {requestAudioPermission} from '../../../shared/utils/permissions';
import {isAppleTranslationAvailable} from '../../../shared/utils/platformSupport';
import {arePacksDownloaded} from '../../../services/languagePackStatus';
import {activateKeepAwake, deactivateKeepAwake} from '../../../native/keepAwake';
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
  const {t} = useTranslation('meeting');
  const navigation = useNavigation<MeetingNavigationProp>();
  const modelState = useModelState();
  const translatorModelState = useTranslatorModelState();
  const prewarmState = usePrewarmState();
  const {startPrewarm, completePrewarm} = useBootstrapStore();
  const developerMode = useDeveloperMode();
  const {speakerDebug} = useDeveloperMetrics();
  const targetLanguage = useTargetLanguage();
  const ttsEnabled = useTtsEnabled();
  const [ttsPaused, setTtsPaused] = useState(false);

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
    pauseMeeting,
    resumeMeeting,
    pipelineStatus,
    pipelineError,
    isOffline,
    isDegraded,
    degradedMessage,
  } = useMeetingSession();

  const {isSpeaking: isTtsSpeaking} = useTTSSpeaker(session?.translations ?? [], isActive, targetLanguage, ttsPaused);

  const isPaused = status === 'paused';

  const latestDetectedLanguage =
    transcript.length > 0
      ? transcript[transcript.length - 1]?.sourceLanguage?.toUpperCase()
      : 'AUTO';

  const [latencyMs] = useState<number | null>(45);
  const [laneFocusMode, setLaneFocusMode] = useState<LaneFocusMode>('split');
  const [isStopping, setIsStopping] = useState(false);


  // Giữ màn hình sáng khi session đang active (recording hoặc paused)
  useEffect(() => {
    if (isActive) {
      activateKeepAwake().catch(() => {});
      return () => { deactivateKeepAwake().catch(() => {}); };
    }
  }, [isActive]);

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

  const handleStartMeeting = useCallback(async () => {
    console.warn('[MeetingScreen] handleStartMeeting: pressed');
    const hasPermission = await requestAudioPermission();
    console.warn('[MeetingScreen] handleStartMeeting: permission result', {hasPermission});
    if (!hasPermission) {
      return;
    }
    console.warn('[MeetingScreen] handleStartMeeting: calling startMeeting', {targetLanguage});
    await startMeeting('en', targetLanguage);
    console.warn('[MeetingScreen] handleStartMeeting: startMeeting resolved');
  }, [startMeeting, targetLanguage]);

  const handlePauseMeeting = useCallback(async () => {
    await pauseMeeting();
  }, [pauseMeeting]);

  const handleResumeMeeting = useCallback(async () => {
    await resumeMeeting();
  }, [resumeMeeting]);

  const handleStopMeeting = useCallback(async () => {
    const confirmed = await new Promise<boolean>(resolve => {
      Alert.alert(
        t('stopConfirmTitle'),
        '',
        [
          {text: t('stopConfirmCancel'), style: 'cancel', onPress: () => resolve(false)},
          {text: t('stopConfirmDelete'), style: 'destructive', onPress: () => resolve(true)},
        ],
        {cancelable: true, onDismiss: () => resolve(false)},
      );
    });

    if (!confirmed) return;

    console.warn('[MeetingScreen] handleStopMeeting: confirmed, starting stop');
    ttsService.stop();
    setIsStopping(true);
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
      console.warn('[MeetingScreen] stopMeeting failed, staying on screen:', error);
    } finally {
      setIsStopping(false);
    }
  }, [stopMeeting, navigation]);

  const sttReady = modelState.status === 'cached-ready';
  const translatorInstalled = translatorModelState.status === 'cached-ready';
  const canStartCapture = sttReady && prewarmState.status !== 'failed';
  // Footer chỉ ẩn khi đang active/stopping; pause dùng Play button trên status bar
  const isLiveWorkspace = isActive || status === 'stopping';
  const showTranscriptLane = laneFocusMode !== 'translation';
  const showTranslationLane = laneFocusMode !== 'original';
  const transcriptLaneFlex = laneFocusMode === 'split' ? 1 : 1;
  const translationLaneFlex = laneFocusMode === 'split' ? 1 : 1;
  const laneFocusOptions: Array<{key: LaneFocusMode; label: string}> = [
    {key: 'original', label: t('laneOriginal')},
    {key: 'split', label: t('laneSplit')},
    {key: 'translation', label: t('laneTranslation')},
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

    if (Platform.OS === 'ios' && isAppleTranslationAvailable() && arePacksDownloaded() === false) {
      Alert.alert(
        t('packNotDownloadedTitle'),
        t('packNotDownloadedMessage'),
        [
          {
            text: t('packGoBack'),
            onPress: () => {
              navigation.reset({index: 0, routes: [{name: 'Bootstrap'}]});
            },
          },
          {
            text: t('packContinueWithout'),
            style: 'destructive',
            onPress: handleStartMeeting,
          },
        ],
        {cancelable: false},
      );
      return;
    }

    await handleStartMeeting();
  }, [isActive, handleStopMeeting, sttReady, navigation, handleStartMeeting]);

  const getButtonLabel = (): string => {
    if (status === 'stopping') return t('buttonStopping');
    if (isActive) return t('buttonStopMeeting');
    if (!sttReady) return t('buttonOpenSettings');
    return t('buttonStartMeeting');
  };

  const isButtonDisabled = status === 'stopping';

  return (
    <View style={[styles.outerContainer, {backgroundColor: theme.colors.background.primary}]}>
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
            {isRecording ? t('headerLive') : t('headerReady')}
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
            accessibilityLabel={t('viewHistoryLabel')}
            accessibilityHint={t('viewHistoryHint')}>
            <AppIcon name="forum" size={18} color={theme.colors.text.primary} />
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.headerButton, {backgroundColor: theme.colors.surface.secondary}]}
            onPress={() => navigation.navigate('Settings')}
            activeOpacity={0.7}
            disabled={isActive}
            accessibilityLabel={t('openSettingsLabel')}
            accessibilityHint={t('openSettingsHint')}>
            <AppIcon name="settings" size={18} color={theme.colors.text.primary} />
          </TouchableOpacity>
        </View>
      </View>

      {!canStartCapture && (
        <View
          style={[styles.readinessWarning, {backgroundColor: theme.colors.surface.secondary}]}
          accessibilityRole="alert">
          <Text style={[styles.readinessTitle, {color: theme.colors.text.primary}]}>
            {modelState.status !== 'cached-ready' ? t('readinessModelNotReady') :
             translatorModelState.status !== 'cached-ready' ? t('readinessTranslatorOptional') :
             prewarmState.status !== 'ready' ? t('readinessPrewarmPending') :
             (!translatorInstalled ? t('readinessTranslatorMissing') : t('readinessTranslatorInit'))}
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
          onPauseMeeting={handlePauseMeeting}
          onResumeMeeting={handleResumeMeeting}
          pipelineStatus={pipelineStatus}
          pipelineError={pipelineError}
          currentLanguage={latestDetectedLanguage || 'AUTO'}
          developerMode={developerMode}
          speakerDebug={speakerDebug}
          ttsEnabled={ttsEnabled && !ttsPaused}
          isTtsSpeaking={isTtsSpeaking}
          onToggleTts={ttsEnabled ? () => setTtsPaused(p => !p) : undefined}
        />
      </View>

      {/* Language pack status is managed in Settings; strip removed to maximise conversation space */}

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

      {/* Stopping overlay */}
      {isStopping && (
        <View style={styles.stoppingOverlay}>
          <ActivityIndicator size="large" color="#FFFFFF" />
          <Text style={styles.stoppingText}>{t('savingOverlay')}</Text>
        </View>
      )}

      {!isLiveWorkspace && (
        <View
          style={[
            styles.footer,
            styles.footerIdle,
            {backgroundColor: theme.colors.surface.primary},
          ]}>
          <TouchableOpacity
            style={[styles.primaryButton, {backgroundColor: '#6C5CE7'}]}
            onPress={handlePrimaryButtonPress}
            activeOpacity={0.85}
            disabled={isButtonDisabled}
            accessibilityLabel={t('buttonStartMeeting')}
            accessibilityHint={
              canStartCapture ? t('startMeetingHint') : t('startMeetingSettingsHint')
            }>
            <View style={styles.primaryButtonContent}>
              <AppIcon name="mic" size={20} color="#FFFFFF" />
              <Text style={[styles.primaryButtonText, {color: '#FFFFFF'}]}>
                {getButtonLabel()}
              </Text>
            </View>
          </TouchableOpacity>
        </View>
      )}

    </SafeAreaView>
    {!isLiveWorkspace && <AppBottomNav activeTab="live" />}
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
  ambientTopGlow: {
    position: 'absolute',
    top: 0,
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
  stoppingOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0,0,0,0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
    zIndex: 100,
  },
  stoppingText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
  },
});

export default MeetingScreen;
