import {DocumentDirectoryPath} from '@dr.pogodin/react-native-fs';
import {NLLB_MODEL_FOLDER, NLLB_REQUIRED_FILES} from '../models/bundledModels';

export {NLLB_MODEL_FOLDER, NLLB_REQUIRED_FILES};

export function getNllbModelDir(): string {
  return `${DocumentDirectoryPath}/models/${NLLB_MODEL_FOLDER}`;
}
