/**
 * PCM Chunk Processor
 *
 * Buffers incoming PCM chunks and prepares them for VAD processing.
 * Maintains timing and ordering guarantees per architecture requirements.
 *
 * Performance targets (per NFR1):
 * - Audio chunk readiness ≤100ms
 * - VAD decision ≤50ms
 */

import type { SessionId, UtteranceId } from '../../shared/types/common';
import type { PCMChunk } from './AudioCapture';

export interface ChunkBuffer {
  sessionId: SessionId;
  utteranceId: UtteranceId;
  chunks: PCMChunk[];
  totalSamples: number;
  startTimeMs: number;
  latestTimeMs: number;
  isFinalized: boolean;
}

export interface ProcessedChunk {
  buffer: ChunkBuffer;
  /** Ready for VAD processing */
  isReady: boolean;
  /** Chunk count in buffer */
  chunkCount: number;
}

const MIN_CHUNKS_FOR_VAD = 3; // 300ms minimum for VAD window
const MAX_BUFFER_DURATION_MS = 5000; // 5 second max buffer

/**
 * ChunkProcessor
 *
 * Manages PCM buffering and prepares speech segments for STT.
 * Keeps raw audio in native memory only - exposes only speech-ready chunks.
 */
export class ChunkProcessor {
  private buffers: Map<UtteranceId, ChunkBuffer> = new Map();
  private sessionId: SessionId | null = null;
  private vadListeners: Set<(buffer: ChunkBuffer) => void> = new Set();
  private processedListeners: Set<(result: ProcessedChunk) => void> = new Set();

  /**
   * Set the active session
   */
  setSession(sessionId: SessionId): void {
    this.sessionId = sessionId;
  }

  /**
   * Clear session and reset buffers
   */
  clearSession(): void {
    this.buffers.clear();
    this.sessionId = null;
  }

  /**
   * Add a PCM chunk to the buffer for a given utterance
   */
  addChunk(chunk: PCMChunk, utteranceId: UtteranceId): ProcessedChunk | null {
    if (!this.sessionId || chunk.sessionId !== this.sessionId) {
      console.warn('[ChunkProcessor] Chunk session mismatch or no active session');
      return null;
    }

    let buffer = this.buffers.get(utteranceId);

    if (!buffer) {
      buffer = {
        sessionId: this.sessionId,
        utteranceId,
        chunks: [],
        totalSamples: 0,
        startTimeMs: chunk.timestampMs,
        latestTimeMs: chunk.timestampMs,
        isFinalized: false,
      };
      this.buffers.set(utteranceId, buffer);
    }

    if (buffer.isFinalized) {
      console.warn('[ChunkProcessor] Cannot add chunk to finalized buffer');
      return null;
    }

    buffer.chunks.push(chunk);
    buffer.totalSamples += chunk.data.length;
    buffer.latestTimeMs = chunk.timestampMs;

    // Notify processed listeners
    const result: ProcessedChunk = {
      buffer,
      isReady: this.isBufferReady(buffer),
      chunkCount: buffer.chunks.length,
    };

    this.processedListeners.forEach((listener) => {
      listener(result);
    });

    // If buffer is ready, notify VAD listeners
    if (result.isReady) {
      this.vadListeners.forEach((listener) => {
        listener(buffer);
      });
    }

    return result;
  }

  /**
   * Check if a buffer has enough data for VAD processing
   */
  private isBufferReady(buffer: ChunkBuffer): boolean {
    return buffer.chunks.length >= MIN_CHUNKS_FOR_VAD;
  }

  /**
   * Check if buffer duration exceeds maximum
   */
  isBufferExpired(buffer: ChunkBuffer, currentTimeMs: number): boolean {
    return currentTimeMs - buffer.startTimeMs > MAX_BUFFER_DURATION_MS;
  }

  /**
   * Get buffer for an utterance
   */
  getBuffer(utteranceId: UtteranceId): ChunkBuffer | undefined {
    return this.buffers.get(utteranceId);
  }

  /**
   * Finalize a buffer (no more chunks will be added)
   */
  finalizeBuffer(utteranceId: UtteranceId): ChunkBuffer | undefined {
    const buffer = this.buffers.get(utteranceId);
    if (buffer) {
      buffer.isFinalized = true;
    }
    return buffer;
  }

  /**
   * Remove a buffer
   */
  removeBuffer(utteranceId: UtteranceId): void {
    this.buffers.delete(utteranceId);
  }

  /**
   * Get all active buffers
   */
  getActiveBuffers(): ChunkBuffer[] {
    return Array.from(this.buffers.values()).filter((b) => !b.isFinalized);
  }

  /**
   * Subscribe to buffers ready for VAD
   * Returns unsubscribe function
   */
  subscribeToVADReady(listener: (buffer: ChunkBuffer) => void): () => void {
    this.vadListeners.add(listener);
    return () => {
      this.vadListeners.delete(listener);
    };
  }

  /**
   * Subscribe to processed chunk results
   * Returns unsubscribe function
   */
  subscribeToProcessed(listener: (result: ProcessedChunk) => void): () => void {
    this.processedListeners.add(listener);
    return () => {
      this.processedListeners.delete(listener);
    };
  }

  /**
   * Release resources
   */
  release(): void {
    this.buffers.clear();
    this.vadListeners.clear();
    this.processedListeners.clear();
    this.sessionId = null;
  }
}

/**
 * Singleton instance
 */
let chunkProcessorInstance: ChunkProcessor | null = null;

export function getChunkProcessorInstance(): ChunkProcessor {
  if (!chunkProcessorInstance) {
    chunkProcessorInstance = new ChunkProcessor();
  }
  return chunkProcessorInstance;
}

export function releaseChunkProcessorInstance(): void {
  if (chunkProcessorInstance) {
    chunkProcessorInstance.release();
    chunkProcessorInstance = null;
  }
}
