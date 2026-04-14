/**
 * Common Types
 *
 * Base types used across the application.
 * These must be defined first to avoid circular dependency issues.
 */

export type SessionId = string;
export type UtteranceId = string;
export type SourceLanguage = 'en' | 'ja' | 'ko' | 'zh';

/**
 * Target translation language.
 * Expandable: add 'zh', 'ko', 'ja' as NLLB models are validated.
 * Default is Vietnamese ('vi').
 *
 * @note When adding languages:
 * 1. Add to this union type
 * 2. Update TARGET_LANGUAGE_OPTIONS in settingsStore
 * 3. Update mapSourceLanguageToNllb in OnDeviceTranslator if NLLB codes differ
 * 4. Update SettingsScreen language selector UI
 */
export type TargetLanguage = 'vi' | 'zh' | 'ko' | 'ja';

// ============================================================================
// Meeting Session State Types
// ============================================================================

export type MeetingCaptureStatus =
  | 'idle'
  | 'starting'
  | 'recording'
  | 'paused'
  | 'stopping'
  | 'stopped';

export type ConnectivityStatus =
  | 'connected';

export interface ConnectivityState {
  status: ConnectivityStatus;
  last_connected_at_ms: number | null;
  reconnect_attempts: number;
  max_reconnect_attempts: number;
}

// ============================================================================
// AI Suggestion Availability (Story 3.4)
// ============================================================================

/**
 * Legacy comment retained from the old architecture. Offline-only v3.0 no longer
 * uses any suggestion lane or backend suggestion status.
 */
