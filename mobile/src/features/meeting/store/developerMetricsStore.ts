/**
 * Developer Metrics Store
 *
 * Lightweight in-memory store for developer-mode metrics.
 * Values are updated by the pipeline hook and read by the overlay component.
 * This store is NOT persisted — it resets on each app launch.
 *
 * Metrics are updated on every STT/translation event and decay to null
 * after a 5-second timeout to avoid stale display after the pipeline stops.
 */

import {create} from 'zustand';

interface DeveloperMetrics {
  /** STT latency: time from audio chunk start to text emission, in ms. Null when no recent event. */
  sttLatencyMs: number | null;
  /** Translation latency: time from translate() call start to result, in ms. Null when no recent event. */
  translationLatencyMs: number | null;
  /** Timestamp of the last STT event (Date.now()). Used to age out stale values. */
  lastSttAt: number | null;
  /** Timestamp of the last translation event. Used to age out stale values. */
  lastTranslationAt: number | null;
  /** Latest speaker diarization debug summary. */
  speakerDebug: string | null;
  lastSpeakerDebugAt: number | null;
}

interface DeveloperMetricsStore extends DeveloperMetrics {
  /** Record STT latency (called after each stt_partial or stt_final) */
  recordSttLatency: (latencyMs: number) => void;
  /** Record translation latency (called after each translation result) */
  recordTranslationLatency: (latencyMs: number) => void;
  /** Reset all metrics to initial state */
  reset: () => void;
  recordSpeakerDebug: (summary: string) => void;
}

const STALE_TIMEOUT_MS = 5000;

/** Initial null state — overlay shows "—" until first event */
const initialMetrics: DeveloperMetrics = {
  sttLatencyMs: null,
  translationLatencyMs: null,
  lastSttAt: null,
  lastTranslationAt: null,
  speakerDebug: null,
  lastSpeakerDebugAt: null,
};

export const useDeveloperMetricsStore = create<DeveloperMetricsStore>((set) => ({
  ...initialMetrics,

  recordSttLatency: (latencyMs: number) => {
    set({
      sttLatencyMs: latencyMs,
      lastSttAt: Date.now(),
    });
  },

  recordTranslationLatency: (latencyMs: number) => {
    set({
      translationLatencyMs: latencyMs,
      lastTranslationAt: Date.now(),
    });
  },

  recordSpeakerDebug: (summary: string) => {
    set({
      speakerDebug: summary,
      lastSpeakerDebugAt: Date.now(),
    });
  },

  reset: () => set(initialMetrics),
}));

/**
 * Hook to get the latest non-stale metrics for display.
 * Returns null values if the last event is older than STALE_TIMEOUT_MS.
 */
export function useDeveloperMetrics(): {
  sttLatencyMs: number | null;
  translationLatencyMs: number | null;
  speakerDebug: string | null;
} {
  const {sttLatencyMs, lastSttAt, translationLatencyMs, lastTranslationAt, speakerDebug, lastSpeakerDebugAt} =
    useDeveloperMetricsStore();

  const now = Date.now();

  const displaySttLatency =
    lastSttAt && now - lastSttAt > STALE_TIMEOUT_MS ? null : sttLatencyMs;
  const displayTranslationLatency =
    lastTranslationAt && now - lastTranslationAt > STALE_TIMEOUT_MS
      ? null
      : translationLatencyMs;
  const displaySpeakerDebug =
    lastSpeakerDebugAt && now - lastSpeakerDebugAt > STALE_TIMEOUT_MS
      ? null
      : speakerDebug;

  return {
    sttLatencyMs: displaySttLatency,
    translationLatencyMs: displayTranslationLatency,
    speakerDebug: displaySpeakerDebug,
  };
}
