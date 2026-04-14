import * as RNFS from '@dr.pogodin/react-native-fs';
import {getNllbModelDir, NLLB_REQUIRED_FILES} from './modelPaths';

const LAN_SERVER_BASE = 'http://192.168.0.102:9090';

export async function areModelsPresent(): Promise<boolean> {
  const dir = getNllbModelDir();
  for (const file of NLLB_REQUIRED_FILES) {
    const exists = await RNFS.exists(`${dir}/${file}`);
    if (!exists) return false;
  }
  return true;
}

export async function downloadModelsFromLAN(
  onProgress?: (file: string, index: number, total: number) => void,
): Promise<void> {
  const dir = getNllbModelDir();
  await RNFS.mkdir(dir);

  const files = [...NLLB_REQUIRED_FILES];
  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const dest = `${dir}/${file}`;
    const exists = await RNFS.exists(dest);
    if (exists) {
      console.log(`[ModelDownloader] ${file} already exists, skipping`);
      onProgress?.(file, i + 1, files.length);
      continue;
    }

    console.log(`[ModelDownloader] Downloading ${file} ...`);
    onProgress?.(file, i, files.length);

    const result = await RNFS.downloadFile({
      fromUrl: `${LAN_SERVER_BASE}/${file}`,
      toFile: dest,
      background: false,
      discretionary: false,
    }).promise;

    if (result.statusCode !== 200) {
      throw new Error(`Failed to download ${file}: HTTP ${result.statusCode}`);
    }
    console.log(`[ModelDownloader] ${file} downloaded (${result.bytesWritten} bytes)`);
  }
}
