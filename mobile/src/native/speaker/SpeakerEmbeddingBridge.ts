/**
 * Speaker Embedding Bridge
 *
 * TypeScript bridge to the native speaker embedding module.
 * Wraps the sherpa-onnx speaker embedding extractor C API
 * exposed through React Native native modules.
 */

import {NativeModules} from 'react-native';

const {SpeakerEmbeddingModule} = NativeModules;
const FORCE_HEURISTIC_FALLBACK = false;

/**
 * Result of initializing the speaker embedding extractor
 */
export interface SpeakerEmbeddingInitResult {
  success: boolean;
  embeddingDim: number;
  error?: string;
}

/**
 * Native speaker embedding extractor interface
 */
export interface SpeakerEmbeddingNative {
  /**
   * Initialize the speaker embedding extractor with a model path.
   */
  initialize(
    modelPath: string,
    numThreads?: number,
    provider?: string,
  ): Promise<SpeakerEmbeddingInitResult>;

  /**
   * Extract speaker embedding from audio samples.
   * @param samples Float array of audio samples (range [-1, 1])
   * @param sampleRate Sample rate in Hz (e.g., 16000)
   * @returns Promise resolving to embedding vector as number array
   */
  extractEmbedding(samples: number[], sampleRate: number): Promise<number[]>;

  /**
   * Get the embedding dimension for the loaded model.
   */
  getEmbeddingDim(): Promise<number>;

  /**
   * Check if the extractor is initialized and ready.
   */
  isReady(): Promise<boolean>;

  /**
   * Release all resources.
   */
  unload(): void;
}

export function isSpeakerEmbeddingNativeAvailable(): boolean {
  return !FORCE_HEURISTIC_FALLBACK && SpeakerEmbeddingModule != null;
}

/**
 * Speaker embedding bridge with fallback for when native module is unavailable
 */
class SpeakerEmbeddingBridgeImpl implements SpeakerEmbeddingNative {
  private isInitialized = false;
  private nativeModule: SpeakerEmbeddingNative | null = null;

  constructor() {
    if (!FORCE_HEURISTIC_FALLBACK && SpeakerEmbeddingModule) {
      this.nativeModule = SpeakerEmbeddingModule as SpeakerEmbeddingNative;
    } else {
      console.warn(
        '[SpeakerEmbeddingBridge] Native module unavailable or disabled, using heuristic fallback',
      );
    }
  }

  async initialize(
    modelPath: string,
    numThreads: number = 1,
    provider: string = 'cpu',
  ): Promise<SpeakerEmbeddingInitResult> {
    if (!this.nativeModule) {
      // Return success with default dim for simulator/no-op mode
      return {success: true, embeddingDim: 512};
    }

    const result = await this.nativeModule.initialize(modelPath, numThreads, provider);
    if (result.success) {
      this.isInitialized = true;
    }
    return result;
  }

  async extractEmbedding(
    samples: number[],
    sampleRate: number,
  ): Promise<number[]> {
    if (!this.nativeModule) {
      // Return zero vector for simulator/no-op mode
      return new Array(512).fill(0);
    }

    if (!this.isInitialized) {
      throw new Error(
        'SpeakerEmbeddingBridge: not initialized. Call initialize() first.',
      );
    }

    return this.nativeModule.extractEmbedding(samples, sampleRate);
  }

  async getEmbeddingDim(): Promise<number> {
    if (!this.nativeModule) {
      return 512; // Default dim for simulator
    }

    return this.nativeModule.getEmbeddingDim();
  }

  async isReady(): Promise<boolean> {
    if (!this.nativeModule) {
      return true; // Simulator is always ready
    }

    return this.nativeModule.isReady();
  }

  unload(): void {
    if (this.nativeModule) {
      this.nativeModule.unload();
    }
    this.isInitialized = false;
  }
}

/**
 * Singleton instance of the speaker embedding bridge
 */
export const speakerEmbeddingBridge = new SpeakerEmbeddingBridgeImpl();

/**
 * Default export for convenience
 */
export default speakerEmbeddingBridge;
