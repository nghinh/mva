/**
 * Speaker Embedding Module
 *
 * On-device speaker diarization using bundled sherpa-onnx models.
 *
 * @example
 * ```typescript
 * import { getSpeakerEmbeddingService } from './native/speaker';
 *
 * const service = getSpeakerEmbeddingService();
 * await service.initialize();
 *
 * const embedding = await service.extractEmbedding(samples, 16000);
 * ```
 */

// Re-export bridge and service
export {
  speakerEmbeddingBridge,
  default as speakerEmbeddingBridgeDefault,
} from './SpeakerEmbeddingBridge';
export type {SpeakerEmbeddingNative, SpeakerEmbeddingInitResult} from './SpeakerEmbeddingBridge';

export {
  getSpeakerEmbeddingService,
  releaseSpeakerEmbeddingService,
  default as speakerEmbeddingServiceDefault,
} from './SpeakerEmbeddingService';
export type {
  SpeakerEmbeddingServiceConfig,
  SpeakerEmbeddingServiceState,
} from './SpeakerEmbeddingService';
