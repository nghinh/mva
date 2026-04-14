import {
  copyFile,
  copyFileAssets,
  DocumentDirectoryPath,
  exists,
  existsAssets,
  MainBundlePath,
  mkdir,
  readDir,
  unlink,
} from '@dr.pogodin/react-native-fs';
import {Platform} from 'react-native';
import {BUNDLED_MODEL_CONFIG, BundledModelId} from './bundledModels';

async function ensureDir(path: string): Promise<void> {
  if (Platform.OS === 'ios') {
    await mkdir(path, {NSURLIsExcludedFromBackupKey: true});
    return;
  }

  await mkdir(path);
}

export function getInstalledModelDir(modelId: BundledModelId): string {
  return `${DocumentDirectoryPath}/models/${BUNDLED_MODEL_CONFIG[modelId].folder}`;
}

export function getBundledModelBundlePath(modelId: BundledModelId): string | null {
  const folder = BUNDLED_MODEL_CONFIG[modelId].folder;
  if (Platform.OS === 'ios') {
    if (!MainBundlePath) {
      return null;
    }
    return `${MainBundlePath}/models/${folder}`;
  }

  if (Platform.OS === 'android') {
    return `models/${folder}`;
  }

  return null;
}

export async function areBundledAssetsAvailable(modelId: BundledModelId): Promise<boolean> {
  const config = BUNDLED_MODEL_CONFIG[modelId];
  const bundlePath = getBundledModelBundlePath(modelId);
  if (!bundlePath) {
    return false;
  }

  if (Platform.OS === 'ios') {
    for (const file of config.requiredFiles) {
      const fileExists = await exists(`${bundlePath}/${file}`);
      if (!fileExists) {
        return false;
      }
    }
    return true;
  }

  if (Platform.OS === 'android') {
    for (const file of config.requiredFiles) {
      const fileExists =
        (await existsAssets(`${bundlePath}/${file}`)) ||
        (await existsAssets(`${config.folder}/${file}`));
      if (!fileExists) {
        return false;
      }
    }
    return true;
  }

  return false;
}

export async function areInstalledModelFilesPresent(modelId: BundledModelId): Promise<boolean> {
  const config = BUNDLED_MODEL_CONFIG[modelId];
  const targetDir = getInstalledModelDir(modelId);

  for (const file of config.requiredFiles) {
    const fileExists = await exists(`${targetDir}/${file}`);
    if (!fileExists) {
      return false;
    }
  }

  return true;
}

export async function ensureBundledModelInstalled(
  modelId: BundledModelId,
  onProgress?: (completed: number, total: number, file: string) => void,
): Promise<string> {
  const config = BUNDLED_MODEL_CONFIG[modelId];
  const targetBaseDir = `${DocumentDirectoryPath}/models`;
  const targetDir = getInstalledModelDir(modelId);
  const assetsAvailable = await areBundledAssetsAvailable(modelId);

  if (!assetsAvailable) {
    throw new Error(
      `Bundled assets for ${config.displayName} are missing. Expected folder: mobile/assets/models/${config.folder}`,
    );
  }

  await ensureDir(targetBaseDir);
  await ensureDir(targetDir);

  const existingEntries = await readDir(targetDir).catch(() => []);
  const existingNames = new Set(existingEntries.map((entry) => entry.name));

  for (let index = 0; index < config.requiredFiles.length; index += 1) {
    const file = config.requiredFiles[index];
    const targetFile = `${targetDir}/${file}`;

    if (!existingNames.has(file)) {
      if (Platform.OS === 'ios') {
        const bundlePath = getBundledModelBundlePath(modelId);
        if (!bundlePath) {
          throw new Error('MainBundlePath unavailable; cannot install bundled model on iOS');
        }
        await copyFile(`${bundlePath}/${file}`, targetFile);
      } else if (Platform.OS === 'android') {
        if (await existsAssets(`models/${config.folder}/${file}`)) {
          await copyFileAssets(`models/${config.folder}/${file}`, targetFile);
        } else {
          await copyFileAssets(`${config.folder}/${file}`, targetFile);
        }
      } else {
        throw new Error(`Unsupported platform for bundled model install: ${Platform.OS}`);
      }
    }

    onProgress?.(index + 1, config.requiredFiles.length, file);
  }

  return targetDir;
}

export async function deleteInstalledModelFiles(modelId: BundledModelId): Promise<void> {
  const targetDir = getInstalledModelDir(modelId);
  if (await exists(targetDir)) {
    await unlink(targetDir);
  }
}
