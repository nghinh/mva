/**
 * VAD (Voice Activity Detection) Native Module
 *
 * Detects speech vs silence using react-native-sherpa-onnx
 *
 * @see docs/planning-artifacts/architecture.md#Technical Constraints
 */

// Re-export VAD components
export { VADProcessor, getVADProcessorInstance, releaseVADProcessorInstance } from './VADProcessor';
export type { VADConfig, VADResult, VADSegment } from './VADProcessor';
