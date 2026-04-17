/**
 * MeetingStatusBar Component
 *
 * Top status bar showing recording state, elapsed time, detected language, and connectivity.
 * Features pulsing red dot when recording (respects reduced motion).
 */

import React, {useEffect, useState, useRef} from 'react';
import {View, Text, StyleSheet, TouchableOpacity, Animated, AccessibilityInfo} from 'react-native';
import {useTheme} from '../../../shared/hooks/useTheme';
import {AppIcon} from '../../../shared/components/ui';
import type {IconName} from '../../../shared/components/ui/AppIcon';
import {SessionStatus, ConnectivityStatus} from '../state/meetingStore';

// =============================================================================
// Helpers
// =============================================================================

function formatTime(startedAt: number | null): string {
  if (!startedAt) return '00:00:00';
  const elapsed = Math.floor((Date.now() - startedAt) / 1000);
  const hours = Math.floor(elapsed / 3600);
  const minutes = Math.floor((elapsed % 3600) / 60);
  const seconds = elapsed % 60;
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
}

// Language badge colors: AUTO neutral, EN blue, JA red, KO green, ZH amber
function getLanguageBadgeStyle(
  language: string,
  palette: {auto: string; en: string; ja: string; ko: string; zh: string},
): {backgroundColor: string; textColor: string} {
  switch (language.toLowerCase()) {
    case 'auto':
      return {backgroundColor: palette.auto, textColor: '#FFFFFF'};
    case 'en':
      return {backgroundColor: palette.en, textColor: '#FFFFFF'};
    case 'ja':
      return {backgroundColor: palette.ja, textColor: '#FFFFFF'};
    case 'ko':
      return {backgroundColor: palette.ko, textColor: '#FFFFFF'};
    case 'zh':
      return {backgroundColor: palette.zh, textColor: '#FFFFFF'};
    default:
      return {backgroundColor: palette.auto, textColor: '#FFFFFF'};
  }
}

// =============================================================================
// Sub-components
// =============================================================================

interface PulsingDotProps {
  isRecording: boolean;
  reducedMotion: boolean;
}

function PulsingDot({isRecording, reducedMotion}: PulsingDotProps): React.JSX.Element {
  const {theme} = useTheme();
  const pulseAnim = useRef(new Animated.Value(0.6)).current;

  useEffect(() => {
    if (!isRecording || reducedMotion) {
      pulseAnim.setValue(1);
      return;
    }

    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 500,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 0.6,
          duration: 500,
          useNativeDriver: true,
        }),
      ]),
    );

    pulse.start();

    return () => {
      pulse.stop();
      pulseAnim.setValue(0.6);
    };
  }, [isRecording, reducedMotion, pulseAnim]);

  if (!isRecording) {
    return (
      <View
        style={[
          styles.recordingIndicator,
          {backgroundColor: theme.colors.text.tertiary},
        ]}
      />
    );
  }

  return (
    <Animated.View
      style={[
        styles.recordingIndicator,
        {
          backgroundColor: theme.colors.error,
          opacity: reducedMotion ? 1 : pulseAnim,
        },
      ]}
    />
  );
}

interface LanguageBadgeProps {
  language: string;
}

function LanguageBadge({language}: LanguageBadgeProps): React.JSX.Element {
  const badgeStyle = getLanguageBadgeStyle(language, {
    auto: '#8B8BA3',
    en: '#3B82F6', // blue
    ja: '#EF4444', // red
    ko: '#16A34A', // green
    zh: '#F59E0B', // amber
  });

  return (
    <View style={[styles.languageBadge, {backgroundColor: badgeStyle.backgroundColor}]}>
      <Text style={[styles.languageText, {color: badgeStyle.textColor}]}>
        {language.toUpperCase()}
      </Text>
    </View>
  );
}

function ConnectivityIndicator({connectivity}: {connectivity: ConnectivityStatus}): React.JSX.Element {
  const {theme} = useTheme();
  const dotColor: string = theme.colors.success;
  const label = connectivity === 'online' ? 'On Device' : 'Connected';
  const icon: IconName = 'check-circle';

  return (
    <View style={[styles.connectivityBadge, {backgroundColor: theme.colors.surface.secondary}]}>
      <View style={[styles.connectivityDot, {backgroundColor: dotColor}]} />
      <AppIcon name={icon} size={12} color={dotColor} />
      <Text style={[styles.connectivityText, {color: theme.colors.text.secondary}]}>{label}</Text>
    </View>
  );
}

// =============================================================================
// Main Component
// =============================================================================

export interface MeetingStatusBarProps {
  sessionStatus: SessionStatus;
  connectivity: ConnectivityStatus;
  startedAt: number | null;
  latencyMs?: number | null;
  onStopMeeting?: () => void;
  pipelineStatus?: string;
  pipelineError?: string | null;
  currentLanguage?: string;
  developerMode?: boolean;
  speakerDebug?: string | null;
}

export function MeetingStatusBar({
  sessionStatus,
  connectivity,
  startedAt,
  latencyMs,
  onStopMeeting,
  pipelineStatus,
  pipelineError,
  currentLanguage = 'EN',
  developerMode = false,
  speakerDebug = null,
}: MeetingStatusBarProps): React.JSX.Element {
  const {theme} = useTheme();
  const [elapsedTime, setElapsedTime] = useState('00:00:00');
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [reducedMotion, setReducedMotion] = useState(false);

  // Check for reduced motion preference
  useEffect(() => {
    const checkReducedMotion = async () => {
      try {
        const result = await AccessibilityInfo.isReduceMotionEnabled();
        setReducedMotion(result);
      } catch {
        setReducedMotion(false);
      }
    };
    checkReducedMotion();
  }, []);

  // Timer update
  useEffect(() => {
    if (sessionStatus === 'recording' && startedAt) {
      const updateTime = () => setElapsedTime(formatTime(startedAt));
      updateTime();
      intervalRef.current = setInterval(updateTime, 1000);
      return () => {
        if (intervalRef.current) clearInterval(intervalRef.current);
      };
    }
    setElapsedTime('00:00:00');
  }, [sessionStatus, startedAt]);

  const isRecording = sessionStatus === 'recording';
  const canStop = isRecording && onStopMeeting;

  const getStatusText = (): string => {
    if (sessionStatus === 'idle') return 'Ready';
    if (sessionStatus === 'recording') return 'Recording';
    if (sessionStatus === 'stopping') return 'Stopping';
    if (sessionStatus === 'complete') return 'Complete';
    if (sessionStatus === 'interrupted') return 'Interrupted';
    return 'Ready';
  };

  return (
    <View style={[styles.container, {backgroundColor: theme.colors.surface.primary}]}>
      <View style={styles.topRow}>
        {/* Left: Pulsing dot + status + timer */}
        <View style={styles.leftSection}>
          <PulsingDot isRecording={isRecording} reducedMotion={reducedMotion} />
          <Text
            style={[
              styles.recordingLabel,
              {color: isRecording ? theme.colors.error : theme.colors.text.secondary},
            ]}>
            {getStatusText()}
          </Text>
          <Text
            style={[
              styles.timerPill,
              {color: theme.colors.text.primary, backgroundColor: theme.colors.surface.secondary},
            ]}>
            {elapsedTime}
          </Text>
          {isRecording && <LanguageBadge language={currentLanguage} />}
        </View>

        {/* Right: Connectivity + stop button */}
        <View style={styles.rightSection}>
          <ConnectivityIndicator connectivity={connectivity} />
          {canStop && (
            <TouchableOpacity
              style={[styles.stopButton, {backgroundColor: theme.colors.error}]}
              onPress={onStopMeeting}
              activeOpacity={0.8}>
              <AppIcon name="stop" size={12} color="#FFFFFF" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {!!(pipelineStatus || pipelineError) && (
        <Text
          style={[
            styles.pipelineText,
            {color: pipelineError ? theme.colors.error : theme.colors.text.tertiary},
          ]}>
          {pipelineError ?? pipelineStatus}
        </Text>
      )}
      {latencyMs != null && (
        <Text style={[styles.metaText, {color: theme.colors.text.tertiary}]}> 
          {`${latencyMs}ms`}
        </Text>
      )}
      {developerMode && speakerDebug ? (
        <Text style={[styles.metaText, styles.speakerDebugText, {color: theme.colors.text.tertiary}]}> 
          {`SPK ${speakerDebug}`}
        </Text>
      ) : null}
    </View>
  );
}

// =============================================================================
// Styles
// =============================================================================

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 16,
    marginBottom: 16,
    minHeight: 60,
    gap: 8,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },
  leftSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexShrink: 1,
    minWidth: 0,
    flexWrap: 'wrap',
  },
  rightSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flexShrink: 0,
    marginLeft: 8,
  },
  recordingIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  recordingLabel: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  timerPill: {
    fontSize: 13,
    fontWeight: '700',
    fontFamily: 'monospace',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    overflow: 'hidden',
    flexShrink: 0,
  },
  languageBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    flexShrink: 0,
  },
  languageText: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  pipelineText: {
    fontSize: 10,
    fontWeight: '500',
  },
  metaText: {
    fontSize: 10,
    fontWeight: '500',
  },
  speakerDebugText: {
    fontFamily: 'monospace',
    lineHeight: 14,
  },
  connectivityBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
  },
  connectivityDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
  },
  connectivityText: {
    fontSize: 9,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
  stopButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export default MeetingStatusBar;
