export const STT_MODEL_FOLDER = 'sherpa-onnx-sense-voice-zh-en-ja-ko-yue-int8-2024-07-17';
export const STT_REQUIRED_FILES = [
  'model.int8.onnx',
  'tokens.txt',
] as const;

export const NLLB_MODEL_FOLDER = 'nllb-600m-mobile';
export const NLLB_REQUIRED_FILES = [
  'encoder_model_quantized.onnx',
  'decoder_model_quantized.onnx',
  'decoder_with_past_model_quantized.onnx',
  'sentencepiece.bpe.model',
  'vocab.json',
] as const;

export type BundledModelId = 'stt' | 'nllb';

export const BUNDLED_MODEL_CONFIG = {
  stt: {
    id: 'stt' as const,
    folder: STT_MODEL_FOLDER,
    requiredFiles: STT_REQUIRED_FILES,
    displayName: 'SenseVoice-Small',
  },
  nllb: {
    id: 'nllb' as const,
    folder: NLLB_MODEL_FOLDER,
    requiredFiles: NLLB_REQUIRED_FILES,
    displayName: 'NLLB-600M Mobile',
  },
} as const;
