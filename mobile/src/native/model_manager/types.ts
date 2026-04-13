/**
 * Native Model Manager
 *
 * This module provides the interface for native model lifecycle operations.
 * The actual implementation will be in the native layer (iOS/Android).
 *
 * Architecture: Keep native audio/STT logic isolated from visual components.
 * UI components should consume pre-warm state, not perform warmup behavior.
 *
 * @see docs/planning-artifacts/architecture.md#Complete Project Directory Structure
 */

/**
 * Model Manager Service Interface
 *
 * Defines the contract for model lifecycle operations at the native layer.
 * This allows the JS layer to interact with native model management
 * without coupling to specific native implementations.
 */
export interface IModelManager {
  /**
   * Check if a model is downloaded and valid
   */
  isModelAvailable(modelId: string): Promise<boolean>;

  /**
   * Get the download progress for a model
   */
  getDownloadProgress(modelId: string): Promise<DownloadProgress | null>;

  /**
   * Start downloading a model
   */
  downloadModel(modelId: string): Promise<void>;

  /**
   * Delete a downloaded model
   */
  deleteModel(modelId: string): Promise<void>;

  /**
   * Verify model integrity
   */
  verifyModelIntegrity(modelId: string): Promise<boolean>;

  /**
   * Pre-warm the model for first utterance
   */
  prewarmModel(modelId: string): Promise<void>;

  /**
   * Get model metadata
   */
  getModelInfo(modelId: string): Promise<ModelMetadata | null>;
}

/**
 * Download progress information
 */
export interface DownloadProgress {
  bytesDownloaded: number;
  totalBytes: number;
  percentage: number;
  speedBytesPerSecond?: number;
  estimatedTimeRemainingMs?: number;
}

/**
 * Model metadata from native layer
 */
export interface ModelMetadata {
  id: string;
  name: string;
  version: string;
  sizeBytes: number;
  languages: string[];
  quality: 'int8' | 'int4' | 'float16';
  checksum: string;
  createdAt: number;
  lastUsedAt: number | null;
}

/**
 * Model lifecycle events emitted by native layer
 */
export type ModelLifecycleEvent =
  | { type: 'download-started'; modelId: string }
  | { type: 'download-progress'; modelId: string; progress: DownloadProgress }
  | { type: 'download-complete'; modelId: string }
  | { type: 'download-failed'; modelId: string; error: string }
  | { type: 'deleted'; modelId: string }
  | { type: 'prewarm-started'; modelId: string }
  | { type: 'prewarm-complete'; modelId: string }
  | { type: 'prewarm-failed'; modelId: string; error: string }
  | { type: 'integrity-verified'; modelId: string; valid: boolean };

/**
 * Model Manager Event Observer
 */
export type ModelLifecycleObserver = (event: ModelLifecycleEvent) => void;

/**
 * Mock implementation for development/testing
 *
 * This implementation is used when native integration is not available.
 * It simulates the behavior of the native model manager.
 */
export class MockModelManager implements IModelManager {
  private observers: Set<ModelLifecycleObserver> = new Set();

  async isModelAvailable(_modelId: string): Promise<boolean> {
    // Mock: always return false for unknown models
    return false;
  }

  async getDownloadProgress(_modelId: string): Promise<DownloadProgress | null> {
    return null;
  }

  async downloadModel(modelId: string): Promise<void> {
    // Emit download started
    this.emit({ type: 'download-started', modelId });

    // Simulate download progress
    const totalBytes = 234 * 1024 * 1024; // 234 MB
    let bytesDownloaded = 0;

    while (bytesDownloaded < totalBytes) {
      await this.delay(100);
      bytesDownloaded += totalBytes * 0.1; // 10% at a time
      const progress: DownloadProgress = {
        bytesDownloaded: Math.min(bytesDownloaded, totalBytes),
        totalBytes,
        percentage: Math.min((bytesDownloaded / totalBytes) * 100, 100),
      };
      this.emit({ type: 'download-progress', modelId, progress });
    }

    // Emit download complete
    this.emit({ type: 'download-complete', modelId });
  }

  async deleteModel(modelId: string): Promise<void> {
    this.emit({ type: 'deleted', modelId });
  }

  async verifyModelIntegrity(_modelId: string): Promise<boolean> {
    // Mock: always return true
    return true;
  }

  async prewarmModel(modelId: string): Promise<void> {
    this.emit({ type: 'prewarm-started', modelId });
    await this.delay(1500); // Simulate prewarm time
    this.emit({ type: 'prewarm-complete', modelId });
  }

  async getModelInfo(_modelId: string): Promise<ModelMetadata | null> {
    // Mock implementation
    return null;
  }

  /**
   * Subscribe to lifecycle events
   */
  subscribe(observer: ModelLifecycleObserver): () => void {
    this.observers.add(observer);
    return () => this.observers.delete(observer);
  }

  /**
   * Emit event to all observers
   */
  private emit(event: ModelLifecycleEvent): void {
    this.observers.forEach((observer) => observer(event));
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

// Singleton instance for the app
export const modelManager = new MockModelManager();
