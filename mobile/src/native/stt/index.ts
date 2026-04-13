/**
 * STT Native Module
 *
 * On-device speech-to-text using react-native-sherpa-onnx
 *
 * @see docs/planning-artifacts/architecture.md#Technical Constraints
 */

// Re-export all STT components
export { AudioCaptureSimulator, getAudioCaptureInstance, releaseAudioCaptureInstance } from './AudioCapture';
export type { PCMChunk, AudioCaptureConfig } from './AudioCapture';

export { ChunkProcessor, getChunkProcessorInstance, releaseChunkProcessorInstance } from './ChunkProcessor';
export type { ChunkBuffer, ProcessedChunk } from './ChunkProcessor';

export { STTProcessor, getSTTProcessorInstance, releaseSTTProcessorInstance } from './STTProcessor';
export type { STTConfig, STTResult } from './STTProcessor';

export { LanguageDetector, getLanguageDetectorInstance, releaseLanguageDetectorInstance, getLanguageLabel, getLanguageName } from './LanguageDetector';
export type { LanguageDetectionResult, LanguageConfig } from './LanguageDetector';

export { getMeetingEventEmitter, releaseMeetingEventEmitter } from './MeetingEventEmitter';
export type { EventEmitterSubscription } from './MeetingEventEmitter';

export { MeetingPipeline, getMeetingPipelineInstance, releaseMeetingPipelineInstance } from './MeetingPipeline';
export type { MeetingPipelineConfig, PipelineState, PipelineError } from './MeetingPipeline';
