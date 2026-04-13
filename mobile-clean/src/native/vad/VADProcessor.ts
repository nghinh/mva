/**
 * VAD (Voice Activity Detection) Processor
 *
 * Processes audio chunks to detect speech vs silence.
 * Applies native VAD to each chunk or chunk window.
 * Filters silence/non-speech before passing data to STT runtime.
 *
 * Performance targets (per NFR1):
 * - VAD decision ≤50ms
 * - Chunk readiness ≤100ms
 */

import type { SessionId, UtteranceId } from '../../shared/types/common';
import type { VADState, VADStateChangeEvent, VADSegmentEvent } from '../../shared/types/meeting';
import type { ChunkBuffer } from '../stt/ChunkProcessor';

export interface VADConfig {
  /** Speech probability threshold (0-1) */
  threshold: number;
  /** Minimum speech duration in ms to trigger speech_start */
  minSpeechDurationMs: number;
  /** Maximum speech duration in ms before forcing speech_end */
  maxSpeechDurationMs: number;
  /** Silence duration in ms to trigger speech_end */
  silenceDurationMs: number;
  /** Sample rate expected by VAD */
  sampleRate: number;
}

const DEFAULT_VAD_CONFIG: VADConfig = {
  threshold: 0.18,
  minSpeechDurationMs: 250,
  maxSpeechDurationMs: 30000,
  silenceDurationMs: 800,
  sampleRate: 16000,
};

export interface VADResult {
  utteranceId: UtteranceId;
  state: VADState;
  speechProb: number;
  timestampMs: number;
  /** Duration of detected speech in current segment */
  speechDurationMs: number;
  /** Duration of silence since last speech */
  silenceDurationMs: number;
}

export interface VADSegment {
  utteranceId: UtteranceId;
  startMs: number;
  endMs: number;
  durationMs: number;
}

/**
 * VADProcessor
 *
 * Simulates on-device VAD processing.
 * In production, this would use react-native-sherpa-onnx VAD model
 * through TurboModules/JSI.
 *
 * Architecture rules (per AC 2.3):
 * - Raw audio stays local to native runtime only
 * - Exposes only speech-state/status or transcript-ready outputs
 * - No code path sends audio to backend transport
 */
export class VADProcessor {
  private config: VADConfig;
  private currentState: VADState = 'silence';
  private currentUtteranceId: UtteranceId | null = null;
  private sessionId: SessionId | null = null;
  private speechStartMs: number | null = null;
  private lastSpeechMs: number | null = null;
  private stateListeners: Set<(event: VADStateChangeEvent) => void> = new Set();
  private segmentListeners: Set<(segment: VADSegmentEvent) => void> = new Set();
  private segments: Map<UtteranceId, VADSegment> = new Map();

  constructor(config: Partial<VADConfig> = {}) {
    this.config = { ...DEFAULT_VAD_CONFIG, ...config };
  }

  /**
   * Set the active session
   */
  setSession(sessionId: SessionId): void {
    this.sessionId = sessionId;
  }

  /**
   * Reset VAD state
   */
  reset(): void {
    this.currentState = 'silence';
    this.currentUtteranceId = null;
    this.speechStartMs = null;
    this.lastSpeechMs = null;
    this.segments.clear();
  }

  /**
   * Process an audio buffer and return VAD result
   *
   * In production, this would run the actual VAD model inference.
   * The simulator generates plausible VAD-like output for testing.
   */
  processBuffer(buffer: ChunkBuffer): VADResult | null {
    if (!this.sessionId || buffer.sessionId !== this.sessionId) {
      console.warn('[VADProcessor] Buffer session mismatch');
      return null;
    }

    const nowMs = Date.now();
    const speechProb = this.calculateSpeechProbability(buffer);

    // State machine for VAD transitions
    const previousState = this.currentState;
    let newState = this.currentState;

    switch (this.currentState) {
      case 'silence':
        if (speechProb >= this.config.threshold) {
          newState = 'speech_start';
          this.currentUtteranceId = buffer.utteranceId;
          this.speechStartMs = nowMs;
          this.lastSpeechMs = nowMs;
        }
        break;

      case 'speech_start':
      case 'speech':
        if (speechProb < this.config.threshold) {
          // Check silence duration
          const silenceMs = nowMs - (this.lastSpeechMs ?? nowMs);
          if (silenceMs >= this.config.silenceDurationMs) {
            newState = 'speech_end';
          }
        } else {
          this.lastSpeechMs = nowMs;
          // Check max speech duration
          const speechDuration = nowMs - (this.speechStartMs ?? nowMs);
          if (speechDuration >= this.config.maxSpeechDurationMs) {
            newState = 'speech_end';
          }
        }
        break;

      case 'speech_end':
        // Wait for next speech_start
        if (speechProb >= this.config.threshold) {
          newState = 'speech_start';
          this.currentUtteranceId = buffer.utteranceId;
          this.speechStartMs = nowMs;
          this.lastSpeechMs = nowMs;
        }
        break;
    }

    // Handle state transitions
    if (newState !== previousState) {
      this.currentState = newState;

      if (newState === 'speech_start' && this.currentUtteranceId) {
        // Create new segment
        this.segments.set(this.currentUtteranceId, {
          utteranceId: this.currentUtteranceId,
          startMs: this.speechStartMs!,
          endMs: nowMs,
          durationMs: 0,
        });
      }

      if (newState === 'speech_end' && this.currentUtteranceId) {
        // Finalize segment
        const segment = this.segments.get(this.currentUtteranceId);
        if (segment) {
          segment.endMs = nowMs;
          segment.durationMs = segment.endMs - segment.startMs;

          // Emit segment event
          this.emitSegment(segment);
        }
      }

      // Emit state change event
      if (this.currentUtteranceId) {
        this.emitStateChange(this.currentUtteranceId, newState, speechProb);
      }
    }

    // Calculate durations
    const speechDurationMs = this.lastSpeechMs
      ? nowMs - (this.speechStartMs ?? nowMs)
      : 0;
    const silenceDurationMs = this.lastSpeechMs ? nowMs - this.lastSpeechMs : 0;

    return {
      utteranceId: this.currentUtteranceId ?? buffer.utteranceId,
      state: this.currentState,
      speechProb,
      timestampMs: nowMs,
      speechDurationMs,
      silenceDurationMs,
    };
  }

  /**
   * Calculate speech probability from audio buffer
   *
   * Simulator-safe approximation of VAD output.
   * In production, this would be actual model inference result.
   */
  private calculateSpeechProbability(buffer: ChunkBuffer): number {
    if (!buffer.chunks.length) return 0;

    // Calculate RMS (Root Mean Square) as a proxy for speech energy
    // This is a simplification - real VAD uses mel-filterbank features
    let sumSquares = 0;
    let sampleCount = 0;

    for (const chunk of buffer.chunks) {
      for (let i = 0; i < chunk.data.length; i++) {
        sumSquares += chunk.data[i] * chunk.data[i];
        sampleCount++;
      }
    }

    if (sampleCount === 0) return 0;

    const rms = Math.sqrt(sumSquares / sampleCount);

    // Convert RMS to approximate speech probability
    // -60dBFS (0.001) = silence, -20dBFS (0.1) = loud speech
    // Map to 0-1 range with threshold at 0.02 (approx -34dBFS)
    const minRms = 0.001;
    const maxRms = 0.1;
    const normalizedRms = Math.max(0, Math.min(1, (rms - minRms) / (maxRms - minRms)));

    // Add some simulated variation for realism
    const noise = (Math.random() - 0.5) * 0.1;

    return Math.max(0, Math.min(1, normalizedRms + noise));
  }

  /**
   * Get current VAD state
   */
  getState(): VADState {
    return this.currentState;
  }

  /**
   * Get current utterance ID
   */
  getCurrentUtteranceId(): UtteranceId | null {
    return this.currentUtteranceId;
  }

  /**
   * Get all recorded segments
   */
  getSegments(): VADSegment[] {
    return Array.from(this.segments.values());
  }

  /**
   * Get segment for an utterance
   */
  getSegment(utteranceId: UtteranceId): VADSegment | undefined {
    return this.segments.get(utteranceId);
  }

  /**
   * Subscribe to VAD state changes
   * Returns unsubscribe function
   */
  subscribeToStateChanges(listener: (event: VADStateChangeEvent) => void): () => void {
    this.stateListeners.add(listener);
    return () => {
      this.stateListeners.delete(listener);
    };
  }

  /**
   * Subscribe to VAD segment events
   * Returns unsubscribe function
   */
  subscribeToSegments(listener: (segment: VADSegmentEvent) => void): () => void {
    this.segmentListeners.add(listener);
    return () => {
      this.segmentListeners.delete(listener);
    };
  }

  private emitStateChange(utteranceId: UtteranceId, state: VADState, speechProb: number): void {
    const event: VADStateChangeEvent = {
      type: 'vad_state_change',
      session_id: this.sessionId!,
      utterance_id: utteranceId,
      state,
      timestamp_ms: Date.now(),
      speech_prob: speechProb,
    };

    this.stateListeners.forEach((listener) => listener(event));
  }

  private emitSegment(segment: VADSegment): void {
    if (!this.sessionId) return;

    const event: VADSegmentEvent = {
      type: 'vad_segment',
      session_id: this.sessionId,
      utterance_id: segment.utteranceId,
      start_ms: segment.startMs,
      end_ms: segment.endMs,
      duration_ms: segment.durationMs,
    };

    this.segmentListeners.forEach((listener) => listener(event));
  }

  /**
   * Release resources
   */
  release(): void {
    this.reset();
    this.stateListeners.clear();
    this.segmentListeners.clear();
    this.sessionId = null;
  }
}

/**
 * Singleton instance
 */
let vadProcessorInstance: VADProcessor | null = null;

export function getVADProcessorInstance(): VADProcessor {
  if (!vadProcessorInstance) {
    vadProcessorInstance = new VADProcessor();
  }
  return vadProcessorInstance;
}

export function releaseVADProcessorInstance(): void {
  if (vadProcessorInstance) {
    vadProcessorInstance.release();
    vadProcessorInstance = null;
  }
}
