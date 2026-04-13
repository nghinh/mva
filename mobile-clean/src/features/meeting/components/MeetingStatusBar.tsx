/**
 * MeetingStatusBar Component
 */

import React, {useEffect, useState, useRef} from 'react';
import {View, Text, StyleSheet, TouchableOpacity} from 'react-native';
import {useTheme} from '../../../shared/hooks/useTheme';
import {AppIcon} from '../../../shared/components/ui';
import type {IconName} from '../../../shared/components/ui/AppIcon';
import {SessionStatus, ConnectivityStatus} from '../state/meetingStore';

interface MeetingStatusBarProps {
  sessionStatus: SessionStatus;
  connectivity: ConnectivityStatus;
  startedAt: number | null;
  latencyMs?: number | null;
  onStopMeeting?: () => void;
  pipelineStatus?: string;
  pipelineError?: string | null;
}

function formatTime(startedAt: number | null): string {
  if (!startedAt) return '00:00:00';
  const elapsed = Math.floor((Date.now() - startedAt) / 1000);
  const hours = Math.floor(elapsed / 3600);
  const minutes = Math.floor((elapsed % 3600) / 60);
  const seconds = elapsed % 60;
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
}

function getStatusConfig(
  sessionStatus: SessionStatus,
  connectivity: ConnectivityStatus,
  palette: {idle: string; error: string; warning: string},
): {dotColor: string; statusText: string; statusDescription: string} {
  if (sessionStatus === 'idle') {
    return {dotColor: palette.idle, statusText: 'Ready', statusDescription: 'waiting for speech'};
  }
  if (sessionStatus === 'recording' && connectivity === 'online') {
    return {dotColor: palette.error, statusText: 'Recording', statusDescription: 'live session active'};
  }
  if (sessionStatus === 'stopping' || sessionStatus === 'complete') {
    return {dotColor: palette.idle, statusText: sessionStatus === 'stopping' ? 'Stopping' : 'Complete', statusDescription: 'session ended'};
  }
  if (sessionStatus === 'interrupted') {
    return {dotColor: palette.error, statusText: 'Interrupted', statusDescription: 'session interrupted'};
  }
  return {dotColor: palette.idle, statusText: 'Ready', statusDescription: 'waiting for speech'};
}

function ConnectivityIndicator({connectivity}: {connectivity: ConnectivityStatus}) {
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

export function MeetingStatusBar({
  sessionStatus,
  connectivity,
  startedAt,
  latencyMs,
  onStopMeeting,
  pipelineStatus,
  pipelineError,
}: MeetingStatusBarProps): React.JSX.Element {
  const {theme} = useTheme();
  const config = getStatusConfig(sessionStatus, connectivity, {
    idle: theme.colors.text.tertiary,
    error: theme.colors.error,
    warning: theme.colors.warning,
  });
  const [elapsedTime, setElapsedTime] = useState('00:00:00');
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

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

  return (
    <View style={[styles.container, {backgroundColor: theme.colors.surface.primary}]}> 
      <View style={styles.topRow}>
        <View style={styles.leftSection}>
          <View style={[styles.recordingIndicator, {backgroundColor: config.dotColor}]} />
          <Text style={[styles.recordingLabel, {color: isRecording ? theme.colors.error : theme.colors.text.secondary}]}> 
            {config.statusText}
          </Text>
          <Text style={[styles.timerPill, {color: theme.colors.text.primary, backgroundColor: theme.colors.surface.secondary}]}> 
            {elapsedTime}
          </Text>
        </View>

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
        <Text style={[styles.pipelineText, {color: pipelineError ? theme.colors.error : theme.colors.text.tertiary}]}> 
          {pipelineError ?? pipelineStatus}
        </Text>
      )}
      {latencyMs != null && (
        <Text style={[styles.metaText, {color: theme.colors.text.tertiary}]}> 
          {`${latencyMs}ms`}
        </Text>
      )}
    </View>
  );
}

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
  },
  rightSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flexShrink: 0,
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
  },
  pipelineText: {
    fontSize: 10,
    fontWeight: '500',
  },
  metaText: {
    fontSize: 10,
    fontWeight: '500',
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
