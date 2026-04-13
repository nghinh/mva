/**
 * MeetingScreen
 *
 * Main meeting screen with start/stop controls and live two-lane transcript/translation UI.
 *
 * @see Stories 2.1, 2.4, 2.5, 2.6
 * @see docs/stich/active_meeting, core_meeting_experience, meeting_waiting_state_1,
 *      meeting_waiting_state_2, meeting_offline_state, meeting_resilience_state_offline_v2
 */

import React, {useCallback, useState} from 'react';
import {View, Text, StyleSheet, TouchableOpacity} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {useNavigation} from '../../../app/navigation/router';
import {StackNavigationProp} from '../../../app/navigation/router';
import {useTheme} from '../../../shared/hooks/useTheme';
import {RootStackParamList} from '../../../app/navigation/router';
import {AppIcon} from '../../../shared/components/ui';
import {useBootstrapOverallStatus, useModelState, usePrewarmState} from '../../../shared/store';
import {MeetingStatusBar} from '../components/MeetingStatusBar';
import {TranscriptLane} from '../components/TranscriptLane';
import {TranslationLane} from '../components/TranslationLane';
import {useMeetingSession} from '../hooks/useMeetingSession';
import type {SessionStatus, ConnectivityStatus} from '../state/meetingStore';

type MeetingNavigationProp = StackNavigationProp<RootStackParamList, 'Meeting'>;

const APP_NAME = 'Executive MVA';

export function MeetingScreen(): React.JSX.Element {
  const {theme} = useTheme();
  const navigation = useNavigation<MeetingNavigationProp>();
  const bootstrapStatus = useBootstrapOverallStatus();
  const modelState = useModelState();
  const prewarmState = usePrewarmState();

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

  const handleStartMeeting = useCallback(() => {
    startMeeting('en', 'vi');
  }, [startMeeting]);

  const handleStopMeeting = useCallback(async () => {
    await stopMeeting();
  }, [stopMeeting]);

  const canStartCapture = bootstrapStatus === 'ready';

  const handlePrimaryButtonPress = useCallback(async () => {
    if (isActive) {
      await handleStopMeeting();
      return;
    }

    if (!canStartCapture) {
      navigation.navigate('Settings');
      return;
    }

    handleStartMeeting();
  }, [isActive, handleStopMeeting, canStartCapture, navigation, handleStartMeeting]);

  const getButtonLabel = (): string => {
    if (status === 'stopping') return 'Stopping...';
    if (isActive) return 'Stop Meeting';
    if (!canStartCapture) return 'Open Settings';
    return 'Start Meeting';
  };

  const isButtonDisabled = status === 'stopping';

  return (
    <SafeAreaView style={[styles.container, {backgroundColor: theme.colors.background.primary}]}>
      {/* Ambient Top Glow */}
      <View style={styles.ambientTopGlow} />

      {/* Header */}
      <View style={[styles.header, {backgroundColor: theme.colors.surface.primary}]}>
        <View style={styles.headerLeft}>
          <Text style={[styles.headerEyebrow, {color: theme.colors.text.tertiary}]}>
            {isRecording ? 'LIVE SESSION' : 'READY'}
          </Text>
          <Text style={[styles.headerTitle, theme.typography.screenTitle, {color: theme.colors.text.primary}]}>
            {APP_NAME}
          </Text>
        </View>
        <View style={styles.headerActions}>
          <TouchableOpacity
            style={[styles.headerButton, {backgroundColor: theme.colors.surface.secondary}]}
            onPress={() => navigation.navigate('History')}
            activeOpacity={0.7}
            disabled={isActive}>
            <AppIcon name="forum" size={18} color={theme.colors.text.primary} />
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.headerButton, {backgroundColor: theme.colors.surface.secondary}]}
            onPress={() => navigation.navigate('Settings')}
            activeOpacity={0.7}
            disabled={isActive}>
            <AppIcon name="settings" size={18} color={theme.colors.text.primary} />
          </TouchableOpacity>
        </View>
      </View>

      {!canStartCapture && (
        <View style={[styles.readinessWarning, {backgroundColor: theme.colors.surface.secondary}]}>
          <Text style={[styles.readinessTitle, {color: theme.colors.text.primary}]}>Meeting setup incomplete</Text>
          <Text style={[styles.readinessCopy, {color: theme.colors.text.tertiary}]}>
            {modelState.status !== 'cached-ready'
              ? 'Download a valid on-device model before recording.'
              : prewarmState.status !== 'ready'
                ? 'Complete speech recognition warm-up before recording.'
                : 'Translation model is not ready yet. Open settings to review model readiness.'}
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

      {/* Two-Lane Content */}
      <View style={styles.lanesContainer}>
        <TranscriptLane
          entries={transcript}
          partialTranscript={partialTranscript}
          currentUtteranceId={currentUtteranceId}
          isRecording={isRecording}
          isOffline={isOffline}
        />
        <TranslationLane
          entries={session.translations}
          isOffline={isOffline}
          isDegraded={isDegraded}
          translationAvailable={true}
          degradedMessage={null}
          isActive={isActive}
          isRecording={isRecording}
        />
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
          disabled={isButtonDisabled}>
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
    gap: 12,
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
  debugRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 16,
  },
  debugButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  debugButtonText: {
    fontSize: 10,
    fontWeight: '500',
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
});

export default MeetingScreen;
