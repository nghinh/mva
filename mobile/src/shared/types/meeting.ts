/**
 * Meeting Pipeline Event Types
 *
 * Defines the event contracts for the native-to-JS boundary.
 * Follows architecture naming rules (snake_case for event types and fields).
 */

import type { SessionId, UtteranceId, SourceLanguage, MeetingCaptureStatus } from './common';

// ============================================================================
// Audio Capture Events
// ============================================================================

export type AudioCaptureStatus =
  | 'idle'
  | 'starting'
  | 'capturing'
  | 'paused'
  | 'stopping'
  | 'stopped'
  | 'error';

export interface AudioCaptureStartEvent {
  type: 'audio_capture_start';
  session_id: SessionId;
  timestamp_ms: number;
}

export interface AudioCaptureStopEvent {
  type: 'audio_capture_stop';
  session_id: SessionId;
  timestamp_ms: number;
  reason?: 'user_action' | 'interruption' | 'error';
}

export interface AudioCaptureStatusEvent {
  type: 'audio_capture_status';
  session_id: SessionId;
  status: AudioCaptureStatus;
  timestamp_ms: number;
  error?: string;
}

export interface AudioCaptureErrorEvent {
  type: 'audio_capture_error';
  session_id: SessionId;
  error: string;
  timestamp_ms: number;
}

export type AudioCaptureEvent =
  | AudioCaptureStartEvent
  | AudioCaptureStopEvent
  | AudioCaptureStatusEvent
  | AudioCaptureErrorEvent;

// ============================================================================
// VAD / Speech Segmentation Events
// ============================================================================

export type VADState = 'silence' | 'speech_start' | 'speech' | 'speech_end';

export interface VADStateChangeEvent {
  type: 'vad_state_change';
  session_id: SessionId;
  utterance_id: UtteranceId;
  state: VADState;
  timestamp_ms: number;
  speech_prob?: number;
}

export interface VADSegmentEvent {
  type: 'vad_segment';
  session_id: SessionId;
  utterance_id: UtteranceId;
  start_ms: number;
  end_ms: number;
  duration_ms: number;
}

// ============================================================================
// STT / Transcript Events
// ============================================================================

export interface STTPartialEvent {
  type: 'stt_partial';
  session_id: SessionId;
  utterance_id: UtteranceId;
  text: string;
  timestamp_ms: number;
  language: SourceLanguage;
  offset_ms: number;
  revision: number;
}

export interface STTFinalEvent {
  type: 'stt_final';
  session_id: SessionId;
  utterance_id: UtteranceId;
  text: string;
  language: SourceLanguage;
  confidence: number;
  timestamp_ms: number;
  offset_ms: number;
  start_ms: number;
  end_ms: number;
  revision: number;
  /**
   * Raw audio samples for this utterance (Float32Array as number array).
   * Used for speaker embedding extraction during finalization.
   * Memory-only: not persisted to disk.
   */
  audio_samples?: number[];
  sample_rate?: number;
}

export type STTEvent = STTPartialEvent | STTFinalEvent;

/** Utterance cancel event when partial is dropped before final (Story 3.1) */
export interface UtteranceCancelEvent {
  type: 'utterance_cancel';
  session_id: SessionId;
  utterance_id: UtteranceId;
  timestamp_ms: number;
  revision?: number;
  reason?: 'too_short' | 'empty_result' | 'cancelled';
}

// ============================================================================
// Language Detection Events
// ============================================================================

export interface LanguageDetectedEvent {
  type: 'language_detected';
  session_id: SessionId;
  utterance_id: UtteranceId;
  language: SourceLanguage;
  confidence: number;
  timestamp_ms: number;
}

// ============================================================================
// Pipeline Status Events
// ============================================================================

export type PipelineStatus =
  | 'idle'
  | 'ready'
  | 'capturing'
  | 'processing'
  | 'error';

export interface PipelineStatusEvent {
  type: 'pipeline_status';
  session_id: SessionId;
  status: PipelineStatus;
  timestamp_ms: number;
  details?: string;
}

// ============================================================================
// Union Type for All Meeting Pipeline Events
// ============================================================================

export type MeetingPipelineEvent =
  | AudioCaptureEvent
  | VADStateChangeEvent
  | VADSegmentEvent
  | STTEvent
  | UtteranceCancelEvent
  | LanguageDetectedEvent
  | PipelineStatusEvent;

// ============================================================================
// Meeting Session State (for UI)
// ============================================================================

export interface TranscriptEntryUI {
  id: string;
  utterance_id: UtteranceId;
  text: string;
  partial_text: string;
  language: SourceLanguage | null;
  confidence: number;
  is_final: boolean;
  timestamp_ms: number;
  offset_ms: number;
  revision: number;
}

export interface TranslationEntryUI {
  id: string;
  utterance_id: UtteranceId;
  original_text: string;
  translated_text: string;
  is_final: boolean;
  is_processing: boolean;
  timestamp_ms: number;
}

export interface MeetingSessionState {
  session_id: SessionId | null;
  status: MeetingCaptureStatus;
  started_at_ms: number | null;
  stopped_at_ms: number | null;
  current_language: SourceLanguage | null;
  current_utterance_id: UtteranceId | null;
  transcripts: TranscriptEntryUI[];
  translations: TranslationEntryUI[];
  error: string | null;
}

// ============================================================================
// Meeting Status Bar State
// ============================================================================

export type MeetingStatusState =
  | 'idle'
  | 'ready'
  | 'recording'
  | 'reconnecting'
  | 'offline'
  | 'degraded';

export interface MeetingStatusBarState {
  status: MeetingStatusState;
  sessionId: string | null;
  elapsedTimeMs: number;
  isServerConnected: boolean;
  currentLanguage: string | null;
}

// ============================================================================
// Lane States
// ============================================================================

export type LaneStatus =
  | 'active'
  | 'processing'
  | 'waiting'
  | 'unavailable'
  | 'offline';

export interface TranscriptLaneState {
  status: LaneStatus;
  activeUtteranceId: string | null;
  entries: TranscriptEntryUI[];
}

export interface TranslationLaneState {
  status: LaneStatus;
  entries: TranslationEntryUI[];
  offlineMessage: string | null;
}
