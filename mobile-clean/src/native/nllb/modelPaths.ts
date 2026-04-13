import {DocumentDirectoryPath} from '@dr.pogodin/react-native-fs';

export const NLLB_MODEL_FOLDER = 'nllb-600m-mobile';
export const NLLB_REQUIRED_FILES = [
  'encoder_model_quantized.onnx',
  'decoder_model_quantized.onnx',
  'decoder_with_past_model_quantized.onnx',
  'sentencepiece.bpe.model',
] as const;

export function getNllbModelDir(): string {
  return `${DocumentDirectoryPath}/models/${NLLB_MODEL_FOLDER}`;
}
