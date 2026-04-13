/**
 * Native Audio Capture Boundary
 *
 * Simulates the native audio capture pipeline that would run in iOS/Android native runtime.
 * Produces 16kHz mono 16-bit PCM chunks for downstream processing.
 *
 * This is a simulator-safe implementation that models the contract
 * without requiring actual native audio permissions or hardware.
 *
 * @see docs/planning-artifacts/architecture.md#Technical-Constraints
 */

import type { SessionId } from '../../shared/types/common';
import type { AudioCaptureStatus, AudioCaptureEvent } from '../../shared/types/meeting';

export interface AudioCaptureConfig {
  sampleRate: number;
  channels: number;
  bitsPerSample: number;
  /** Chunk duration in milliseconds */
  chunkDurationMs: number;
}

export interface PCMChunk {
  sessionId: SessionId;
  /** Audio data as Float32Array normalized to [-1, 1] */
  data: Float32Array;
  /** Chunk sequence number */
  sequence: number;
  /** Timestamp in ms when chunk was captured */
  timestampMs: number;
  /** Duration of this chunk in ms */
  durationMs: number;
}

const DEFAULT_CONFIG: AudioCaptureConfig = {
  sampleRate: 16000,
  channels: 1,
  bitsPerSample: 16,
  chunkDurationMs: 100,
};

/**
 * AudioCaptureSimulator
 *
 * Models continuous 16kHz mono 16-bit PCM audio capture in native runtime.
 * Does NOT run actual audio I/O - this is a boundary simulator for
 * meeting pipeline testing and development.
 */
export class AudioCaptureSimulator {
  private config: AudioCaptureConfig;
  private status: AudioCaptureStatus = 'idle';
  private sessionId: SessionId | null = null;
  private startTimeMs: number | null = null;
  private sequence: number = 0;
  private intervalHandle: ReturnType<typeof setInterval> | null = null;
  private listeners: Set<(chunk: PCMChunk) => void> = new Set();
  private statusListeners: Set<(event: AudioCaptureEvent) => void> = new Set();

  constructor(config: Partial<AudioCaptureConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Start audio capture for a session
   */
  async start(sessionId: SessionId): Promise<void> {
    if (this.status === 'capturing') {
      console.warn('[AudioCapture] Already capturing');
      return;
    }

    this.sessionId = sessionId;
    this.sequence = 0;
    this.startTimeMs = Date.now();
    this.status = 'starting';

    this.emitStatus({
      type: 'audio_capture_start',
      session_id: sessionId,
      timestamp_ms: Date.now(),
    });

    this.emitStatus({
      type: 'audio_capture_status',
      session_id: sessionId,
      status: 'capturing',
      timestamp_ms: Date.now(),
    });

    this.status = 'capturing';

    // Start generating simulated PCM chunks at the configured interval
    const samplesPerChunk = Math.floor(
      (this.config.sampleRate * this.config.chunkDurationMs) / 1000
    );

    this.intervalHandle = setInterval(() => {
      if (this.status !== 'capturing' || !this.sessionId || !this.startTimeMs) {
        return;
      }

      // Generate simulated PCM data (silence with occasional speech-like patterns)
      const chunk = this.generateSimulatedChunk(samplesPerChunk);

      this.listeners.forEach((listener) => {
        listener(chunk);
      });
    }, this.config.chunkDurationMs);
  }

  /**
   * Stop audio capture
   */
  async stop(reason: 'user_action' | 'interruption' | 'error' = 'user_action'): Promise<void> {
    if (this.status !== 'capturing' && this.status !== 'starting') {
      console.warn('[AudioCapture] Not currently capturing');
      return;
    }

    this.status = 'stopping';

    if (this.intervalHandle) {
      clearInterval(this.intervalHandle);
      this.intervalHandle = null;
    }

    const sessionId = this.sessionId!;

    this.emitStatus({
      type: 'audio_capture_stop',
      session_id: sessionId,
      timestamp_ms: Date.now(),
      reason,
    });

    this.emitStatus({
      type: 'audio_capture_status',
      session_id: sessionId,
      status: 'stopped',
      timestamp_ms: Date.now(),
    });

    this.status = 'stopped';
  }

  /**
   * Pause audio capture (for app lifecycle interruptions)
   */
  async pause(): Promise<void> {
    if (this.status !== 'capturing') return;

    this.status = 'paused';
    if (this.intervalHandle) {
      clearInterval(this.intervalHandle);
      this.intervalHandle = null;
    }

    if (this.sessionId) {
      this.emitStatus({
        type: 'audio_capture_status',
        session_id: this.sessionId,
        status: 'paused',
        timestamp_ms: Date.now(),
      });
    }
  }

  /**
   * Resume audio capture after pause
   */
  async resume(): Promise<void> {
    if (this.status !== 'paused') return;

    this.status = 'capturing';

    const samplesPerChunk = Math.floor(
      (this.config.sampleRate * this.config.chunkDurationMs) / 1000
    );

    this.intervalHandle = setInterval(() => {
      if (this.status !== 'capturing' || !this.sessionId || !this.startTimeMs) {
        return;
      }

      const chunk = this.generateSimulatedChunk(samplesPerChunk);

      this.listeners.forEach((listener) => {
        listener(chunk);
      });
    }, this.config.chunkDurationMs);

    if (this.sessionId) {
      this.emitStatus({
        type: 'audio_capture_status',
        session_id: this.sessionId,
        status: 'capturing',
        timestamp_ms: Date.now(),
      });
    }
  }

  /**
   * Get current capture status
   */
  getStatus(): AudioCaptureStatus {
    return this.status;
  }

  /**
   * Get current session ID
   */
  getSessionId(): SessionId | null {
    return this.sessionId;
  }

  /**
   * Subscribe to PCM chunks
   * Returns unsubscribe function
   */
  subscribeToChunks(listener: (chunk: PCMChunk) => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  /**
   * Subscribe to capture status events
   * Returns unsubscribe function
   */
  subscribeToStatus(listener: (event: AudioCaptureEvent) => void): () => void {
    this.statusListeners.add(listener);
    return () => {
      this.statusListeners.delete(listener);
    };
  }

  /**
   * Release resources
   */
  release(): void {
    if (this.intervalHandle) {
      clearInterval(this.intervalHandle);
      this.intervalHandle = null;
    }
    this.listeners.clear();
    this.statusListeners.clear();
    this.status = 'idle';
  }

  private emitStatus(event: AudioCaptureEvent): void {
    this.statusListeners.forEach((listener) => {
      listener(event);
    });
  }

  /**
   * Generate simulated PCM audio data
   *
   * In a real implementation, this would come from native audio buffers.
   * For simulator safety, we generate plausible audio-like data patterns.
   */
  private generateSimulatedChunk(samplesCount: number): PCMChunk {
    const data = new Float32Array(samplesCount);

    this.sequence++;

    // Simulate speech bursts so the pipeline produces transcript events on simulator.
    const speechWindow = this.sequence % 24 >= 4 && this.sequence % 24 <= 14;

    for (let i = 0; i < samplesCount; i++) {
      if (speechWindow) {
        const t = i / this.config.sampleRate;
        const tone = Math.sin(2 * Math.PI * 220 * t) * 0.09;
        const overtone = Math.sin(2 * Math.PI * 440 * t) * 0.045;
        const noise = (Math.random() - 0.5) * 0.02;
        data[i] = tone + overtone + noise;
      } else {
        data[i] = (Math.random() - 0.5) * 0.002;
      }
    }

    return {
      sessionId: this.sessionId!,
      data,
      sequence: this.sequence,
      timestampMs: Date.now(),
      durationMs: this.config.chunkDurationMs,
    };
  }
}

/**
 * Singleton instance for app-wide audio capture
 */
let audioCaptureInstance: AudioCaptureSimulator | null = null;

export function getAudioCaptureInstance(): AudioCaptureSimulator {
  if (!audioCaptureInstance) {
    audioCaptureInstance = new AudioCaptureSimulator();
  }
  return audioCaptureInstance;
}

export function releaseAudioCaptureInstance(): void {
  if (audioCaptureInstance) {
    audioCaptureInstance.release();
    audioCaptureInstance = null;
  }
}
