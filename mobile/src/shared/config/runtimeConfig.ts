/**
 * Runtime Configuration
 *
 * Centralizes access to runtime configuration values that may be
 * adjusted during app lifecycle. These values are typically read from
 * settings store but provided as a flat config object for components
 * that need runtime access without direct store coupling.
 *
 * @note Clustering code and pipeline components should import
 * getRuntimeConfig() rather than directly importing the store.
 */

import {useSettingsStore} from '../store/settingsStore';
import {
  DEFAULT_DIARIZATION_THRESHOLD,
  DIARIZATION_THRESHOLD_MIN,
  DIARIZATION_THRESHOLD_MAX,
} from '../store/settingsStore';

// Re-export threshold constants for convenience
export {DIARIZATION_THRESHOLD_MIN, DIARIZATION_THRESHOLD_MAX, DEFAULT_DIARIZATION_THRESHOLD};

export interface RuntimeConfig {
  /** Speaker diarization sensitivity threshold (0.3-0.9) */
  diarizationThreshold: number;
  /** Minimum allowed diarization threshold */
  diarizationThresholdMin: number;
  /** Maximum allowed diarization threshold */
  diarizationThresholdMax: number;
}

/**
 * Get the current runtime configuration snapshot.
 * Returns live values from the settings store.
 *
 * Usage:
 *   const config = getRuntimeConfig();
 *   const threshold = config.diarizationThreshold;
 */
export function getRuntimeConfig(): RuntimeConfig {
  const store = useSettingsStore.getState();
  return {
    diarizationThreshold: store.diarizationThreshold,
    diarizationThresholdMin: DIARIZATION_THRESHOLD_MIN,
    diarizationThresholdMax: DIARIZATION_THRESHOLD_MAX,
  };
}

/**
 * Get the diarization threshold for speaker clustering.
 * Convenience helper that delegates to getRuntimeConfig().
 *
 * @returns The current diarization sensitivity threshold (0.3-0.9)
 */
export function getDiarizationThreshold(): number {
  return useSettingsStore.getState().diarizationThreshold;
}

/**
 * Format the diarization threshold for display.
 * Converts the numeric value to a percentage string.
 *
 * @param threshold - The threshold value (0.3-0.9)
 * @returns Formatted string like "60%"
 */
export function formatDiarizationThreshold(threshold: number): string {
  return `${Math.round(threshold * 100)}%`;
}

/**
 * Get a human-readable label for the diarization threshold.
 *
 * @param threshold - The threshold value (0.3-0.9)
 * @returns Descriptive label: 'Low', 'Medium', or 'High'
 */
export function getDiarizationThresholdLabel(threshold: number): string {
  if (threshold <= 0.45) return 'Low';
  if (threshold <= 0.75) return 'Medium';
  return 'High';
}

/**
 * Get descriptive text explaining what the threshold does.
 * Suitable for tooltips or explanatory copy.
 */
export function getDiarizationThresholdDescription(): string {
  return 'Lower values detect more speaker changes; higher values merge similar speakers. Adjust based on meeting size and speaking patterns.';
}
