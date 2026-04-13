/**
 * Transcript Entry Types
 *
 * Defines the normalized transcript entry model stored in meeting state.
 * Keyed by session_id and utterance_id per architecture requirements.
 */

import type { SessionId, UtteranceId, SourceLanguage, MeetingCaptureStatus } from './common';

// ============================================================================
// Transcript Entry Model
// ============================================================================

export interface TranscriptEntry {
  session_id: SessionId;
  utterance_id: UtteranceId;
  text: string;
  partial_text: string;
  language: SourceLanguage | null;
  confidence: number;
  is_final: boolean;
  offset_ms: number;
  start_ms: number;
  end_ms: number;
  updated_at_ms: number;
}

export interface PartialTranscriptEntry extends TranscriptEntry {
  is_final: false;
}

export interface FinalTranscriptEntry extends TranscriptEntry {
  is_final: true;
}

// ============================================================================
// Translation Entry
// ============================================================================

export interface TranslationEntry {
  session_id: SessionId;
  utterance_id: UtteranceId;
  original_text: string;
  translated_text: string;
  target_language: 'vi';
  offset_ms: number;
  timestamp_ms: number;
  is_final: boolean;
  is_processing: boolean;
}

// ============================================================================
// Meeting Session State
// ============================================================================

export interface MeetingSession {
  session_id: SessionId | null;
  status: MeetingCaptureStatus;
  started_at_ms: number | null;
  stopped_at_ms: number | null;
  current_language: SourceLanguage | null;
  current_utterance_id: UtteranceId | null;
  utterances: Map<UtteranceId, TranscriptEntry>;
  translations: Map<UtteranceId, TranslationEntry>;
  error: string | null;
}

// ============================================================================
// Permission State
// ============================================================================

export type MicrophonePermissionStatus =
  | 'granted'
  | 'denied'
  | 'restricted'
  | 'undetermined';

// ============================================================================
// Export Union Type
// ============================================================================

export type AnyTranscriptEntry = PartialTranscriptEntry | FinalTranscriptEntry;
