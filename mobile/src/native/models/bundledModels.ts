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

// Speaker diarization models bundled in app.
// `model.onnx` is the segmentation model placeholder and
// `3dspeaker_speech_campplus_sv_en_voxceleb_16k.onnx` is the embedding model.
// Current v1 diarization flow uses utterance boundaries from VAD + the embedding model.
export const DIARIZATION_MODEL_FOLDER = 'speaker-diarization';
export const DIARIZATION_REQUIRED_FILES = [
  'model.onnx',
  '3dspeaker_speech_campplus_sv_en_voxceleb_16k.onnx',
] as const;

export type BundledModelId = 'stt' | 'nllb' | 'diarization';

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
  diarization: {
    id: 'diarization' as const,
    folder: DIARIZATION_MODEL_FOLDER,
    requiredFiles: DIARIZATION_REQUIRED_FILES,
    displayName: '3D-Speaker-CampPlus',
  },
} as const;
