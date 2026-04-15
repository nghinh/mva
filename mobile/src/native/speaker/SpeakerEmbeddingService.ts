/**
 * Speaker Embedding Service
 *
 * High-level service for on-device speaker diarization.
 * Manages bundled diarization model lifecycle and exposes
 * speaker embedding extraction for the meeting pipeline.
 *
 * Architecture:
 * - Model is bundled with the app (no download flow)
 * - Initialization happens during app bootstrap/warm-up
 * - Audio samples stay memory-only (never persisted)
 * - Non-fatal failures allow pipeline to continue without diarization
 */

import {Platform} from 'react-native';
import {isSpeakerEmbeddingNativeAvailable, speakerEmbeddingBridge} from './SpeakerEmbeddingBridge';
import {
  BUNDLED_MODEL_CONFIG,
  type BundledModelId,
} from '../models/bundledModels';
import {getInstalledModelDir} from '../models/BundledModelInstaller';
import {warnLog} from '../../shared/utils/logger';

/**
 * Speaker embedding service configuration
 */
export interface SpeakerEmbeddingServiceConfig {
  /** Number of threads for inference */
  numThreads?: number;
  /** Execution provider (cpu, coreml, etc.) */
  provider?: string;
  /** Whether to fail silently (non-fatal mode) */
  failSilently?: boolean;
}

const DEFAULT_CONFIG: Required<SpeakerEmbeddingServiceConfig> = {
  numThreads: 1,
  provider: 'cpu',
  failSilently: true,
};

/**
 * Speaker embedding service state
 */
export type SpeakerEmbeddingServiceState =
  | 'uninitialized'
  | 'initializing'
  | 'ready'
  | 'error';

/**
 * Speaker Embedding Service
 *
 * Singleton service that manages speaker embedding extraction
 * for the meeting pipeline.
 */
class SpeakerEmbeddingServiceImpl {
  private state: SpeakerEmbeddingServiceState = 'uninitialized';
  private config: Required<SpeakerEmbeddingServiceConfig>;
  private modelPath: string | null = null;
  private embeddingDim: number = 0;
  private lastError: string | null = null;
  private useHeuristicFallback = false;

  constructor(config: SpeakerEmbeddingServiceConfig = {}) {
    this.config = {...DEFAULT_CONFIG, ...config};
  }

  /**
   * Get current service state
   */
  getState(): SpeakerEmbeddingServiceState {
    return this.state;
  }

  /**
   * Get the embedding dimension
   */
  getEmbeddingDim(): number {
    return this.embeddingDim;
  }

  /**
   * Get the last error message
   */
  getLastError(): string | null {
    return this.lastError;
  }

  isUsingHeuristicFallback(): boolean {
    return this.useHeuristicFallback;
  }

  /**
   * Get the bundled model path for speaker embedding
   * Returns null if no bundled diarization model is configured
   */
  getBundledModelPath(): string | null {
    const diarizationId = 'diarization' as BundledModelId;
    const config = BUNDLED_MODEL_CONFIG[diarizationId];

    if (!config) {
      return null;
    }

    if (Platform.OS === 'ios' || Platform.OS === 'android') {
      return getInstalledModelDir(diarizationId);
    }

    return null;
  }

  /**
   * Initialize the speaker embedding service
   *
   * Called during bootstrap/warm-up phase.
   * Non-fatal: failures are logged but don't throw.
   */
  async initialize(): Promise<void> {
    if (this.state === 'ready') {
      warnLog('[SpeakerEmbeddingService] Already initialized');
      return;
    }

    if (this.state === 'initializing') {
      warnLog('[SpeakerEmbeddingService] Initialization in progress');
      return;
    }

    this.state = 'initializing';
    this.lastError = null;

    try {
      // Get bundled model path
      const modelPath = this.getBundledModelPath();

      if (!modelPath) {
        // No bundled diarization model - use no-op mode
        warnLog(
          '[SpeakerEmbeddingService] No bundled diarization model found. Diarization disabled.',
        );
        this.state = 'ready';
        this.embeddingDim = 512; // Default dim for no-op mode
        return;
      }

      // Current utterance-level diarization uses CAM++ embedding model.
      // Segmentation model is bundled for future use but not required here because
      // VAD already provides utterance boundaries.
      const fullModelPath = `${modelPath}/3dspeaker_speech_campplus_sv_en_voxceleb_16k.onnx`;

      warnLog(`[SpeakerEmbeddingService] Initializing with model: ${fullModelPath}`);

      if (!isSpeakerEmbeddingNativeAvailable()) {
        this.useHeuristicFallback = true;
        this.state = 'ready';
        this.embeddingDim = 16;
        warnLog('[SpeakerEmbeddingService] Native bridge unavailable, using heuristic PCM embedding fallback.');
        return;
      }

      const result = await speakerEmbeddingBridge.initialize(
        fullModelPath,
        this.config.numThreads,
        this.config.provider,
      );

        if (result.success) {
          this.modelPath = fullModelPath;
          this.embeddingDim = result.embeddingDim;
          this.state = 'ready';
          this.useHeuristicFallback = false;
        warnLog(
          `[SpeakerEmbeddingService] Initialized successfully. Embedding dim: ${this.embeddingDim}`,
        );
      } else {
        throw new Error(result.error || 'Unknown initialization error');
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      this.lastError = errorMessage;

      warnLog(`[SpeakerEmbeddingService] Initialization failed: ${errorMessage}`);

      if (this.config.failSilently) {
        // Non-fatal mode - continue without diarization
        this.state = 'ready';
        this.embeddingDim = 16;
        this.useHeuristicFallback = true;
      } else {
        this.state = 'error';
        throw error;
      }
    }
  }

  /**
   * Extract speaker embedding from audio samples
   *
   * @param samples Float32Array or number array of audio samples (range [-1, 1])
   * @param sampleRate Sample rate in Hz (e.g., 16000)
   * @returns Promise resolving to embedding vector (Float32Array), or null if not ready
   *
   * Note: Audio stays memory-only, never persisted to disk
   */
  async extractEmbedding(
    samples: number[] | Float32Array,
    sampleRate: number,
  ): Promise<Float32Array | null> {
    if (this.state !== 'ready') {
      warnLog(
        `[SpeakerEmbeddingService] Cannot extract embedding - state is ${this.state}`,
      );
      return null;
    }

    // Convert to plain number array if Float32Array
    const sampleArray = Array.isArray(samples)
      ? samples
      : Array.from(samples);

    if (this.useHeuristicFallback) {
      return new Float32Array(this.computeHeuristicEmbedding(sampleArray, sampleRate));
    }

    try {
      const embedding = await speakerEmbeddingBridge.extractEmbedding(
        sampleArray,
        sampleRate,
      );

      return new Float32Array(embedding);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      warnLog(`[SpeakerEmbeddingService] Embedding extraction failed: ${errorMessage}`);

      // Return null on failure - caller should handle gracefully
      return null;
    }
  }

  private computeHeuristicEmbedding(samples: number[], sampleRate: number): number[] {
    if (samples.length < Math.floor(sampleRate * 0.35)) {
      throw new Error('Not enough audio for speaker embedding');
    }

    const frameSize = 512;
    const frameCount = Math.max(1, Math.floor(samples.length / frameSize));
    let rmsMean = 0;
    let zcrMean = 0;
    let absMean = 0;
    let peak = 0;
    const bandEnergy = new Array(8).fill(0);

    for (let f = 0; f < frameCount; f += 1) {
      const start = f * frameSize;
      const end = Math.min(samples.length, start + frameSize);
      let sumSq = 0;
      let sumAbs = 0;
      let zcr = 0;
      let localPeak = 0;
      for (let i = start; i < end; i += 1) {
        const v = samples[i] ?? 0;
        sumSq += v * v;
        sumAbs += Math.abs(v);
        localPeak = Math.max(localPeak, Math.abs(v));
        if (i > start) {
          const prev = samples[i - 1] ?? 0;
          if ((prev >= 0 && v < 0) || (prev < 0 && v >= 0)) {
            zcr += 1;
          }
        }
      }
      const len = Math.max(1, end - start);
      rmsMean += Math.sqrt(sumSq / len);
      absMean += sumAbs / len;
      zcrMean += zcr / len;
      peak += localPeak;

      // Lightweight 8-bin energy summary without FFT.
      const segment = Math.max(1, Math.floor(len / 8));
      for (let b = 0; b < 8; b += 1) {
        let energy = 0;
        const bStart = start + b * segment;
        const bEnd = Math.min(end, bStart + segment);
        for (let i = bStart; i < bEnd; i += 1) {
          const v = samples[i] ?? 0;
          energy += v * v;
        }
        bandEnergy[b] += energy / Math.max(1, bEnd - bStart);
      }
    }

    rmsMean /= frameCount;
    absMean /= frameCount;
    zcrMean /= frameCount;
    peak /= frameCount;
    const durationSec = samples.length / sampleRate;

    const embedding = [rmsMean, absMean, zcrMean, peak, durationSec, samples.length / 16000, ...bandEnergy];
    const mean = embedding.reduce((sum, v) => sum + v, 0) / embedding.length;
    const centered = embedding.map((v) => v - mean);
    const norm = Math.sqrt(centered.reduce((sum, v) => sum + v * v, 0)) || 1;
    return centered.map((v) => v / norm);
  }

  /**
   * Check if the service is ready for embedding extraction
   */
  isReady(): boolean {
    return this.state === 'ready';
  }

  /**
   * Release all resources
   */
  release(): void {
    if (this.state !== 'uninitialized') {
      speakerEmbeddingBridge.unload();
      this.state = 'uninitialized';
      this.modelPath = null;
      this.embeddingDim = 0;
      this.useHeuristicFallback = false;
      warnLog('[SpeakerEmbeddingService] Released');
    }
  }
}

/**
 * Singleton instance
 */
let speakerEmbeddingServiceInstance: SpeakerEmbeddingServiceImpl | null = null;

export function getSpeakerEmbeddingService(): SpeakerEmbeddingServiceImpl {
  if (!speakerEmbeddingServiceInstance) {
    speakerEmbeddingServiceInstance = new SpeakerEmbeddingServiceImpl();
  }
  return speakerEmbeddingServiceInstance;
}

export function releaseSpeakerEmbeddingService(): void {
  if (speakerEmbeddingServiceInstance) {
    speakerEmbeddingServiceInstance.release();
    speakerEmbeddingServiceInstance = null;
  }
}

/**
 * Default export for convenience
 */
export default getSpeakerEmbeddingService;
