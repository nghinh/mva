export const STT_MODEL_FOLDER = 'sherpa-onnx-sense-voice-zh-en-ja-ko-yue-int8-2024-07-17';
export const STT_REQUIRED_FILES = [
  'model.int8.onnx',
  'tokens.txt',
] as const;

// Vietnamese offline transducer (Zipformer RNN-T, int8, Apache-2.0).
// Benchmarked in bench/: WER 10.09% on FLEURS-vi vs 99.71% for SenseVoice.
// bpe.model is not needed for plain decoding but ships now so Phase 2
// (hotwords contextual biasing) does not require a new bundle.
export const STT_VI_MODEL_FOLDER = 'sherpa-onnx-zipformer-vi-int8-2025-04-20';
export const STT_VI_REQUIRED_FILES = [
  'encoder-epoch-12-avg-8.int8.onnx',
  'decoder-epoch-12-avg-8.onnx',
  'joiner-epoch-12-avg-8.int8.onnx',
  'tokens.txt',
  'bpe.model',
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

export type BundledModelId = 'stt' | 'stt_vi' | 'diarization';

export const BUNDLED_MODEL_CONFIG = {
  stt: {
    id: 'stt' as const,
    folder: STT_MODEL_FOLDER,
    requiredFiles: STT_REQUIRED_FILES,
    displayName: 'SenseVoice-Small',
  },
  stt_vi: {
    id: 'stt_vi' as const,
    folder: STT_VI_MODEL_FOLDER,
    requiredFiles: STT_VI_REQUIRED_FILES,
    displayName: 'Zipformer-VI',
  },
  diarization: {
    id: 'diarization' as const,
    folder: DIARIZATION_MODEL_FOLDER,
    requiredFiles: DIARIZATION_REQUIRED_FILES,
    displayName: '3D-Speaker-CampPlus',
  },
} as const;

/**
 * Which bundled STT model serves a given meeting source language.
 * 'vi' → dedicated Vietnamese transducer; everything else stays on the
 * SenseVoice auto-detect engine (EN/JA/KO/ZH).
 */
export function getSttModelIdForSource(sourceLanguage?: string): BundledModelId {
  return sourceLanguage === 'vi' ? 'stt_vi' : 'stt';
}
