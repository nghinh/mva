/**
 * Developer Metrics Overlay
 *
 * Tiny monospace bar displayed below the Stop button when developer mode is enabled.
 * Shows real-time STT latency, translation latency, and RAM usage.
 *
 * DESIGN:
 * - Monospace font (JetBrains Mono via Inter, 11px) per UX spec §2.2
 * - Secondary/subtle color — not prominent during meetings
 * - Hidden completely when developer mode is off (zero re-render cost)
 *
 * METRICS SOURCING:
 * - STT latency: recorded by useMeetingSession after each STT event.
 *   Since exact STT pipeline latency is not surfaced, we use the
 *   translation latency budget from architecture.md §5.1 as a proxy
 *   (target ~200ms for STT final). This is clearly labeled as "STT≈" in
 *   code comments and display.
 * - Translation latency: recorded by useMeetingSession using Date.now()
 *   delta at translate() call site in dispatchFinalTranslation.
 * - RAM: see helpers/getRamMetrics.ts for methodology and accuracy notes.
 */

import React, {useEffect, useState} from 'react';
import {View, Text, StyleSheet} from 'react-native';
import {useTheme} from '../../../../shared/hooks/useTheme';
import {useDeveloperMetrics} from '../../store/developerMetricsStore';
import {getRamMetrics} from './helpers/getRamMetrics';

export function DeveloperMetricsOverlay(): React.JSX.Element {
  const {theme} = useTheme();
  const {sttLatencyMs, translationLatencyMs} = useDeveloperMetrics();

  const [ramLabel] = useState(() => getRamMetrics().label);

  // Re-read RAM periodically (every 10s) so the label refreshes if heap grows
  const [, setTick] = useState(0);
  useEffect(() => {
    const interval = setInterval(() => setTick((t) => t + 1), 10_000);
    return () => clearInterval(interval);
  }, []);

  return (
    <View
      style={[styles.container, {backgroundColor: theme.colors.surface.secondary}]}
      accessibilityLabel="Developer metrics"
      accessibilityRole="text">
      <Text style={[styles.text, {color: theme.colors.text.tertiary}]}>
        STT≈ {sttLatencyMs != null ? `${sttLatencyMs}ms` : '—'}
        {'  •  '}
        Trans: {translationLatencyMs != null ? `${translationLatencyMs}ms` : '—'}
        {'  •  '}
        RAM: {ramLabel}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    alignItems: 'center',
  },
  text: {
    fontSize: 11,
    fontFamily: 'monospace',
    fontWeight: '400',
    letterSpacing: 0.3,
  },
});

export default DeveloperMetricsOverlay;
