/**
 * MeetingStatusBar Component
 *
 * Top status bar showing recording state, elapsed time, detected language, and connectivity.
 * Features pulsing red dot when recording (respects reduced motion).
 */

import React, {useEffect, useState, useRef} from 'react';
import {View, Text, StyleSheet, TouchableOpacity, Animated, AccessibilityInfo} from 'react-native';
import {useTranslation} from 'react-i18next';
import {useTheme} from '../../../shared/hooks/useTheme';
import {AppIcon} from '../../../shared/components/ui';
import type {IconName} from '../../../shared/components/ui/AppIcon';
import {SessionStatus, ConnectivityStatus} from '../state/meetingStore';

// =============================================================================
// Helpers
// =============================================================================

function formatTime(startedAt: number | null, pausedTotalMs: number = 0): string {
  if (!startedAt) return '00:00:00';
  const elapsed = Math.floor((Date.now() - startedAt - pausedTotalMs) / 1000);
  const clamped = Math.max(0, elapsed);
  const hours = Math.floor(clamped / 3600);
  const minutes = Math.floor((clamped % 3600) / 60);
  const seconds = clamped % 60;
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
}

function getLanguageFlag(language: string): string {
  switch (language.toLowerCase()) {
    case 'en': return '🇬🇧';
    case 'ja': return '🇯🇵';
    case 'ko': return '🇰🇷';
    case 'zh': return '🇨🇳';
    default:   return '🌐';
  }
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
  isPaused: boolean;
  reducedMotion: boolean;
}

function PulsingDot({isRecording, isPaused, reducedMotion}: PulsingDotProps): React.JSX.Element {
  const {theme} = useTheme();
  const pulseAnim = useRef(new Animated.Value(0.6)).current;

  useEffect(() => {
    if (!isRecording || reducedMotion) {
      pulseAnim.setValue(1);
      return;
    }

    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {toValue: 1, duration: 500, useNativeDriver: true}),
        Animated.timing(pulseAnim, {toValue: 0.6, duration: 500, useNativeDriver: true}),
      ]),
    );
    pulse.start();
    return () => { pulse.stop(); pulseAnim.setValue(0.6); };
  }, [isRecording, reducedMotion, pulseAnim]);

  const dotColor = isRecording
    ? theme.colors.error
    : isPaused
      ? '#F59E0B'
      : theme.colors.text.tertiary;

  return (
    <Animated.View
      style={[
        styles.recordingIndicator,
        {backgroundColor: dotColor, opacity: isRecording && !reducedMotion ? pulseAnim : 1},
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
    <View style={styles.languageBadge}>
      <Text style={styles.languageFlag}>
        {getLanguageFlag(language)}
      </Text>
    </View>
  );
}

function ConnectivityIndicator({connectivity, compact}: {connectivity: ConnectivityStatus; compact?: boolean}): React.JSX.Element {
  const {theme} = useTheme();
  const {t} = useTranslation('meeting');
  const dotColor: string = theme.colors.success;
  const label = connectivity === 'online' ? t('statusBarOnDevice') : t('statusBarConnected');

  return (
    <View style={[styles.connectivityBadge, {backgroundColor: theme.colors.surface.secondary}]}>
      <View style={[styles.connectivityDot, {backgroundColor: dotColor}]} />
      {!compact && <Text style={[styles.connectivityText, {color: theme.colors.text.secondary}]}>{label}</Text>}
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
  pausedTotalMs?: number;
  pausedAt?: number | null;
  latencyMs?: number | null;
  onStopMeeting?: () => void;
  onPauseMeeting?: () => void;
  onResumeMeeting?: () => void;
  pipelineStatus?: string;
  pipelineError?: string | null;
  currentLanguage?: string;
  developerMode?: boolean;
  speakerDebug?: string | null;
  ttsEnabled?: boolean;
  isTtsSpeaking?: boolean;
  onToggleTts?: () => void;
}

export function MeetingStatusBar({
  sessionStatus,
  connectivity,
  startedAt,
  pausedTotalMs = 0,
  pausedAt = null,
  latencyMs,
  onStopMeeting,
  onPauseMeeting,
  onResumeMeeting,
  pipelineStatus,
  pipelineError,
  currentLanguage = 'EN',
  developerMode = false,
  speakerDebug = null,
  ttsEnabled = false,
  isTtsSpeaking = false,
  onToggleTts,
}: MeetingStatusBarProps): React.JSX.Element {
  const {theme} = useTheme();
  const {t} = useTranslation('meeting');
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

  // Timer: only counts active recording time (excludes paused duration)
  useEffect(() => {
    if (sessionStatus === 'recording' && startedAt) {
      const updateTime = () => setElapsedTime(formatTime(startedAt, pausedTotalMs));
      updateTime();
      intervalRef.current = setInterval(updateTime, 1000);
      return () => {
        if (intervalRef.current) clearInterval(intervalRef.current);
      };
    }
    if (sessionStatus === 'paused' && startedAt && pausedAt) {
      // Freeze at the moment pause started
      const frozenMs = pausedAt - startedAt - pausedTotalMs;
      const elapsed = Math.floor(Math.max(0, frozenMs) / 1000);
      const pad = (n: number) => n.toString().padStart(2, '0');
      setElapsedTime(`${pad(Math.floor(elapsed / 3600))}:${pad(Math.floor((elapsed % 3600) / 60))}:${pad(elapsed % 60)}`);
    }
    if (sessionStatus !== 'recording' && sessionStatus !== 'paused') {
      setElapsedTime('00:00:00');
    }
  }, [sessionStatus, startedAt, pausedTotalMs, pausedAt]);

  const isRecording = sessionStatus === 'recording';
  const isPaused = sessionStatus === 'paused';
  const canStop = (isRecording || isPaused) && onStopMeeting;
  const canPause = isRecording && onPauseMeeting;
  const canResume = isPaused && onResumeMeeting;
  const isCompactLive = isRecording || isPaused;

  const getStatusText = (): string => {
    if (sessionStatus === 'idle') return t('statusReady');
    if (sessionStatus === 'recording') return t('statusRecording');
    if (sessionStatus === 'paused') return t('statusPaused');
    if (sessionStatus === 'stopping') return t('statusStopping');
    if (sessionStatus === 'complete') return t('statusComplete');
    if (sessionStatus === 'interrupted') return t('statusInterrupted');
    return t('statusReady');
  };

  return (
    <View
      style={[
        styles.container,
        isCompactLive && styles.containerCompact,
        {backgroundColor: theme.colors.surface.primary},
      ]}>
      <View style={[styles.topRow, isCompactLive && styles.topRowCompact]}>
        {/* Left: Pulsing dot + status + timer */}
        <View style={[styles.leftSection, isCompactLive && styles.leftSectionCompact]}>
          <PulsingDot isRecording={isRecording} isPaused={isPaused} reducedMotion={reducedMotion} />
          <Text
            style={[
              styles.recordingLabel,
              {color: isRecording ? theme.colors.error : isPaused ? '#F59E0B' : theme.colors.text.secondary},
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
          {(isRecording || isPaused) && <LanguageBadge language={currentLanguage} />}
        </View>

        {/* Right: Connectivity + TTS + pause + stop buttons */}
        <View style={styles.rightSection}>
          <ConnectivityIndicator connectivity={connectivity} compact={isCompactLive} />
          {isCompactLive && onToggleTts && (
            <TouchableOpacity
              style={[
                styles.iconButton,
                {backgroundColor: ttsEnabled
                  ? theme.colors.primary + '33'
                  : theme.colors.surface.secondary},
              ]}
              onPress={onToggleTts}
              activeOpacity={0.8}
              accessibilityLabel={t('ttsToggleLabel')}>
              <AppIcon name="headphones" size={12} color={ttsEnabled ? theme.colors.primary : theme.colors.text.tertiary} />
              {ttsEnabled && isTtsSpeaking && (
                <View style={[styles.speakingDot, {backgroundColor: theme.colors.success}]} />
              )}
            </TouchableOpacity>
          )}
          {canPause && (
            <TouchableOpacity
              style={[styles.iconButton, {backgroundColor: '#F59E0B'}]}
              onPress={onPauseMeeting}
              activeOpacity={0.8}
              accessibilityLabel={t('statusBarPauseLabel')}>
              <AppIcon name="pause" size={12} color="#FFFFFF" />
            </TouchableOpacity>
          )}
          {canResume && (
            <TouchableOpacity
              style={[styles.iconButton, {backgroundColor: '#16A34A'}]}
              onPress={onResumeMeeting}
              activeOpacity={0.8}
              accessibilityLabel={t('resumeButtonLabel')}>
              <AppIcon name="play" size={12} color="#FFFFFF" />
            </TouchableOpacity>
          )}
          {canStop && (
            <TouchableOpacity
              style={[styles.iconButton, {backgroundColor: theme.colors.error}]}
              onPress={onStopMeeting}
              activeOpacity={0.8}
              accessibilityLabel={t('statusBarStopLabel')}>
              <AppIcon name="stop" size={12} color="#FFFFFF" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {!isCompactLive && !!(pipelineStatus || pipelineError) && (
        <Text
          style={[
            styles.pipelineText,
            {color: pipelineError ? theme.colors.error : theme.colors.text.tertiary},
          ]}>
          {pipelineError ?? pipelineStatus}
        </Text>
      )}
      {!isCompactLive && latencyMs != null && (
        <Text style={[styles.metaText, {color: theme.colors.text.tertiary}]}> 
          {`${latencyMs}ms`}
        </Text>
      )}
      {!isCompactLive && developerMode && speakerDebug ? (
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
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 14,
    marginBottom: 10,
    minHeight: 52,
    gap: 6,
  },
  containerCompact: {
    paddingVertical: 6,
    minHeight: 44,
    gap: 0,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 10,
  },
  topRowCompact: {
    gap: 8,
  },
  leftSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexShrink: 1,
    minWidth: 0,
    flexWrap: 'wrap',
  },
  leftSectionCompact: {
    flex: 1,
    flexWrap: 'nowrap',
    gap: 5,
  },
  rightSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexShrink: 0,
    marginLeft: 6,
  },
  recordingIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  recordingLabel: {
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  timerPill: {
    fontSize: 12,
    fontWeight: '700',
    fontFamily: 'monospace',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    overflow: 'hidden',
    flexShrink: 0,
  },
  languageBadge: {
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 7,
    flexShrink: 0,
  },
  languageFlag: {
    fontSize: 16,
    lineHeight: 20,
  },
  pipelineText: {
    fontSize: 9,
    fontWeight: '500',
  },
  metaText: {
    fontSize: 9,
    fontWeight: '500',
  },
  speakerDebugText: {
    fontFamily: 'monospace',
    lineHeight: 14,
  },
  connectivityBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 7,
    paddingVertical: 4,
    borderRadius: 9,
  },
  connectivityDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
  },
  connectivityText: {
    fontSize: 8,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
  iconButton: {
    width: 30,
    height: 30,
    borderRadius: 15,
    justifyContent: 'center',
    alignItems: 'center',
  },
  speakingDot: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 6,
    height: 6,
    borderRadius: 3,
  },
});

export default MeetingStatusBar;
