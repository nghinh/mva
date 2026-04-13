/**
 * STT (Speech-to-Text) Processor
 *
 * Processes VAD-detected speech segments and produces partial/final transcripts.
 * Emits streaming partial transcript during active speech and final transcript
 * at utterance end.
 *
 * Performance targets (per NFR2):
 * - Partial STT latency ≤400ms
 * - Final STT latency ≤400ms
 */

import type { SessionId, UtteranceId, SourceLanguage } from '../../shared/types/common';
import type { STTPartialEvent, STTFinalEvent } from '../../shared/types/meeting';
import type { ChunkBuffer } from './ChunkProcessor';
import type { VADSegment } from '../vad/VADProcessor';

export interface STTConfig {
  /** Sample rate expected by STT model */
  sampleRate: number;
  /** Whether to enable partial results */
  enablePartial: boolean;
  /** Minimum confidence for final acceptance */
  minConfidence: number;
}

const DEFAULT_STT_CONFIG: STTConfig = {
  sampleRate: 16000,
  enablePartial: true,
  minConfidence: 0.6,
};

export interface STTResult {
  text: string;
  language: SourceLanguage;
  confidence: number;
  isFinal: boolean;
  offsetMs: number;
  startMs: number;
  endMs: number;
}

/**
 * STTProcessor
 *
 * Simulates on-device STT processing using the native STT runtime.
 * In production, this would use react-native-sherpa-onnx through TurboModules/JSI.
 *
 * Architecture rules:
 * - All rendering-affecting messages correlated by utterance_id and session_id
 * - Partial/final state explicit (is_final field)
 * - Event types use snake_case per naming conventions
 */
export class STTProcessor {
  private config: STTConfig;
  private sessionId: SessionId | null = null;
  private isModelLoaded: boolean = false;
  private partialListeners: Set<(event: STTPartialEvent) => void> = new Set();
  private finalListeners: Set<(event: STTFinalEvent) => void> = new Set();
  private activeUtterances: Map<UtteranceId, { partialText: string; startMs: number }> = new Map();
  private partialIntervals: Map<UtteranceId, ReturnType<typeof setInterval>> = new Map();
  private detectedLanguage: SourceLanguage = 'en';
  private utteranceRevisions: Map<UtteranceId, number> = new Map();
  private sessionStartedAtMs: number | null = null;

  constructor(config: Partial<STTConfig> = {}) {
    this.config = { ...DEFAULT_STT_CONFIG, ...config };
  }

  /**
   * Set the active session
   */
  setSession(sessionId: SessionId): void {
    this.sessionId = sessionId;
    this.sessionStartedAtMs = sessionId ? Date.now() : null;
    this.activeUtterances.clear();
  }

  /**
   * Check if STT model is loaded and ready
   */
  isReady(): boolean {
    return this.isModelLoaded;
  }

  /**
   * Load the STT model
   *
   * Simulator-safe: just marks model as loaded.
   * In production, this would initialize the sherpa-onnx model.
   */
  async loadModel(): Promise<void> {
    console.log('[STTProcessor] Loading STT model...');
    // Simulate model loading delay
    await new Promise((resolve) => setTimeout(resolve, 100));
    this.isModelLoaded = true;
    console.log('[STTProcessor] STT model loaded');
  }

  unloadModel(): void {
    this.isModelLoaded = false;
    this.activeUtterances.clear();
    this.partialIntervals.forEach((handle) => clearInterval(handle));
    this.partialIntervals.clear();
    this.utteranceRevisions.clear();
    console.log('[STTProcessor] STT model unloaded');
  }

  /**
   * Start processing an utterance
   *
   * Called when VAD detects speech_start.
   * Begins partial transcript emission for streaming preview.
   */
  startUtterance(utteranceId: UtteranceId, startMs: number): void {
    if (!this.sessionId) {
      console.warn('[STTProcessor] No active session');
      return;
    }

    this.activeUtterances.set(utteranceId, {
      partialText: '',
      startMs,
    });
    this.utteranceRevisions.set(utteranceId, 0);

    // Start emitting partial transcripts periodically
    if (this.config.enablePartial) {
      const intervalHandle = setInterval(() => {
        this.emitPartial(utteranceId);
      }, 300); // Emit partial every 300ms

      this.partialIntervals.set(utteranceId, intervalHandle);
    }
  }

  /**
   * Process audio buffer and generate partial transcript
   *
   * Called during active speech to generate streaming partial results.
   */
  processBuffer(buffer: ChunkBuffer): STTResult | null {
    if (!this.sessionId || buffer.sessionId !== this.sessionId) {
      return null;
    }

    const utteranceInfo = this.activeUtterances.get(buffer.utteranceId);
    if (!utteranceInfo) {
      return null;
    }

    // Generate simulated partial transcript
    const text = this.generateSimulatedTranscript(buffer, false);
    const nowMs = Date.now();

    utteranceInfo.partialText = text;

    return {
      text,
      language: this.detectedLanguage,
      confidence: 0.7,
      isFinal: false,
      offsetMs: nowMs - (this.sessionStartMs ?? nowMs),
      startMs: utteranceInfo.startMs,
      endMs: nowMs,
    };
  }

  /**
   * Finalize an utterance
   *
   * Called when VAD detects speech_end.
   * Stops partial emission and produces final transcript.
   */
  finalizeUtterance(segment: VADSegment): STTResult | null {
    if (!this.sessionId) {
      return null;
    }

    const utteranceId = segment.utteranceId;
    const utteranceInfo = this.activeUtterances.get(utteranceId);
    if (!utteranceInfo) {
      return null;
    }

    // Stop partial emission interval
    const intervalHandle = this.partialIntervals.get(utteranceId);
    if (intervalHandle) {
      clearInterval(intervalHandle);
      this.partialIntervals.delete(utteranceId);
    }

    // Generate final transcript
    const text = this.generateSimulatedTranscriptFromSegment(segment);
    const confidence = 0.85 + Math.random() * 0.1; // 0.85-0.95 confidence

    const result: STTResult = {
      text,
      language: this.detectedLanguage,
      confidence,
      isFinal: true,
      offsetMs: utteranceInfo.startMs - (this.sessionStartMs ?? utteranceInfo.startMs),
      startMs: segment.startMs,
      endMs: segment.endMs,
    };

    // Emit final transcript
    this.emitFinal(utteranceId, result);

    // Clean up
    this.activeUtterances.delete(utteranceId);
    this.utteranceRevisions.delete(utteranceId);

    return result;
  }

  /**
   * Cancel an utterance without producing final transcript
   */
  cancelUtterance(utteranceId: UtteranceId): void {
    const intervalHandle = this.partialIntervals.get(utteranceId);
    if (intervalHandle) {
      clearInterval(intervalHandle);
      this.partialIntervals.delete(utteranceId);
    }
    this.activeUtterances.delete(utteranceId);
    this.utteranceRevisions.delete(utteranceId);
  }

  /**
   * Set detected language for next utterances
   */
  setLanguage(language: SourceLanguage): void {
    this.detectedLanguage = language;
  }

  /**
   * Get detected language
   */
  getLanguage(): SourceLanguage {
    return this.detectedLanguage;
  }

  private get sessionStartMs(): number | null {
    return this.sessionStartedAtMs;
  }

  private emitPartial(utteranceId: UtteranceId): void {
    if (!this.sessionId) return;

    const utteranceInfo = this.activeUtterances.get(utteranceId);
    if (!utteranceInfo) return;

    const nowMs = Date.now();
    const partialText = this.generateIncrementalPartial(utteranceInfo.partialText);

    const revision = (this.utteranceRevisions.get(utteranceId) ?? 0) + 1;
    this.utteranceRevisions.set(utteranceId, revision);

    const event: STTPartialEvent = {
      type: 'stt_partial',
      session_id: this.sessionId,
      utterance_id: utteranceId,
      text: partialText,
      timestamp_ms: nowMs,
      language: this.detectedLanguage,
      offset_ms: nowMs - (this.sessionStartMs ?? nowMs),
      revision,
    };

    this.partialListeners.forEach((listener) => listener(event));
  }

  private emitFinal(utteranceId: UtteranceId, result: STTResult): void {
    if (!this.sessionId) return;

    const revision = (this.utteranceRevisions.get(utteranceId) ?? 0) + 1;
    this.utteranceRevisions.set(utteranceId, revision);

    const event: STTFinalEvent = {
      type: 'stt_final',
      session_id: this.sessionId,
      utterance_id: utteranceId,
      text: result.text,
      language: result.language,
      confidence: result.confidence,
      timestamp_ms: Date.now(),
      offset_ms: result.offsetMs,
      start_ms: result.startMs,
      end_ms: result.endMs,
      revision,
    };

    this.finalListeners.forEach((listener) => listener(event));
  }

  /**
   * Generate simulated partial transcript
   *
   * Simulator-safe: produces plausible partial output for UI testing.
   * In production, this would be actual STT inference result.
   */
  private generateSimulatedTranscript(_buffer: ChunkBuffer, _isFinal: boolean): string {
    // Simulate partial transcript building up
    const partialPhrases = [
      'I think ',
      'I think we ',
      'I think we should ',
      'I think we should consider ',
      'I think we should consider the ',
      'I think we should consider the implications ',
      'I think we should consider the implications of ',
    ];

    // Return random partial phrase based on buffer timestamp
    const index = Math.floor((Date.now() / 100) % partialPhrases.length);
    return partialPhrases[index];
  }

  /**
   * Generate incremental partial that builds on previous
   */
  private generateIncrementalPartial(currentText: string): string {
    const continuations = [
      'that ',
      'that the ',
      'that the decision ',
      'that the decision was ',
      'that the decision was correct ',
      'that the decision was correct and ',
      'that the decision was correct and we ',
      'that the decision was correct and we should ',
      'that the decision was correct and we should proceed ',
    ];

    if (!currentText) {
      return continuations[0];
    }

    // Find where we are in the continuations
    let foundIndex = -1;
    for (let i = 0; i < continuations.length; i++) {
      if (currentText.includes(continuations[i].slice(0, 10))) {
        foundIndex = i;
      }
    }

    if (foundIndex < continuations.length - 1) {
      return currentText + continuations[foundIndex + 1].slice(-10);
    }

    return currentText + continuations[Math.floor(Math.random() * 5)].slice(-10);
  }

  /**
   * Generate simulated final transcript from segment
   */
  private generateSimulatedTranscriptFromSegment(segment: VADSegment): string {
    const durationSec = (segment.endMs - segment.startMs) / 1000;

    // Generate plausible transcript based on duration
    if (durationSec < 2) {
      return 'Yes, that makes sense.';
    } else if (durationSec < 5) {
      return 'I think we should consider the implications of this decision carefully.';
    } else if (durationSec < 10) {
      return 'Looking at the data, I believe we need to take immediate action on this matter. The evidence suggests we should proceed with caution.';
    } else {
      return 'Based on our analysis and the feedback we have received from multiple stakeholders, I think the best approach would be to implement the proposed solution while monitoring the results closely. We should also prepare contingency measures in case adjustments are needed.';
    }
  }

  /**
   * Subscribe to partial transcript events
   * Returns unsubscribe function
   */
  subscribeToPartial(listener: (event: STTPartialEvent) => void): () => void {
    this.partialListeners.add(listener);
    return () => {
      this.partialListeners.delete(listener);
    };
  }

  /**
   * Subscribe to final transcript events
   * Returns unsubscribe function
   */
  subscribeToFinal(listener: (event: STTFinalEvent) => void): () => void {
    this.finalListeners.add(listener);
    return () => {
      this.finalListeners.delete(listener);
    };
  }

  /**
   * Release resources
   */
  release(): void {
    // Clear all intervals
    this.partialIntervals.forEach((handle) => clearInterval(handle));
    this.partialIntervals.clear();
    this.activeUtterances.clear();
    this.partialListeners.clear();
    this.finalListeners.clear();
    this.isModelLoaded = false;
    this.sessionId = null;
  }
}

/**
 * Singleton instance
 */
let sttProcessorInstance: STTProcessor | null = null;

export function getSTTProcessorInstance(): STTProcessor {
  if (!sttProcessorInstance) {
    sttProcessorInstance = new STTProcessor();
  }
  return sttProcessorInstance;
}

export function releaseSTTProcessorInstance(): void {
  if (sttProcessorInstance) {
    sttProcessorInstance.release();
    sttProcessorInstance = null;
  }
}
