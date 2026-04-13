/**
 * Common Types
 *
 * Base types used across the application.
 * These must be defined first to avoid circular dependency issues.
 */

export type SessionId = string;
export type UtteranceId = string;
export type SourceLanguage = 'en' | 'ja' | 'ko' | 'zh';
export type TargetLanguage = 'vi';

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
