const fs = require('fs');
const path = require('path');
const os = require('os');
const { execFileSync } = require('child_process');

const projectRoot = path.resolve(__dirname, '..');
const defaultModelSrcRoot = path.join(projectRoot, 'assets', 'models');
const defaultAndroidModelRoot = path.join(
  projectRoot,
  'android',
  'app',
  'src',
  'main',
  'assets',
  'models',
);

// Maps target folder name → { url, archiveFolder }
// archiveFolder: folder name inside the .tar.bz2 (may differ from target folder)
const MODEL_ARCHIVE_CONFIG = {
  'sherpa-onnx-sense-voice-zh-en-ja-ko-yue-int8-2024-07-17': {
    url: 'https://github.com/k2-fsa/sherpa-onnx/releases/download/asr-models/sherpa-onnx-sense-voice-zh-en-ja-ko-yue-int8-2024-07-17.tar.bz2',
    archiveFolder: 'sherpa-onnx-sense-voice-zh-en-ja-ko-yue-int8-2024-07-17',
  },
  // Vietnamese input engine (Zipformer transducer int8, Apache-2.0, ~74MB).
  // Must stay in sync with STT_VI_* in src/native/models/bundledModels.ts.
  'sherpa-onnx-zipformer-vi-int8-2025-04-20': {
    url: 'https://github.com/k2-fsa/sherpa-onnx/releases/download/asr-models/sherpa-onnx-zipformer-vi-int8-2025-04-20.tar.bz2',
    archiveFolder: 'sherpa-onnx-zipformer-vi-int8-2025-04-20',
  },
};

const requiredModels = [
  {
    folder: 'sherpa-onnx-sense-voice-zh-en-ja-ko-yue-int8-2024-07-17',
    files: ['model.int8.onnx', 'tokens.txt'],
  },
  {
    folder: 'sherpa-onnx-zipformer-vi-int8-2025-04-20',
    files: [
      'encoder-epoch-12-avg-8.int8.onnx',
      'decoder-epoch-12-avg-8.onnx',
      'joiner-epoch-12-avg-8.int8.onnx',
      'tokens.txt',
      'bpe.model',
    ],
  },
  {
    folder: 'speaker-diarization',
    files: ['model.onnx', '3dspeaker_speech_campplus_sv_en_voxceleb_16k.onnx'],
  },
];

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function ensureFileFromAndroid(model, file, roots) {
  const { modelSrcRoot, androidModelRoot } = roots;
  const srcFile = path.join(androidModelRoot, model.folder, file);
  const dstFile = path.join(modelSrcRoot, model.folder, file);

  if (!fs.existsSync(srcFile)) {
    return false;
  }

  ensureDir(path.dirname(dstFile));
  fs.copyFileSync(srcFile, dstFile);
  return true;
}

function ensureModelArchiveFiles(model, roots) {
  const { modelSrcRoot } = roots;
  const missingFiles = model.files.filter(
    file => !fs.existsSync(path.join(modelSrcRoot, model.folder, file)),
  );

  if (missingFiles.length === 0) {
    return;
  }

  const archiveConfig = MODEL_ARCHIVE_CONFIG[model.folder];
  if (!archiveConfig) {
    throw new Error(`No download URL configured for model: ${model.folder}`);
  }

  const { url, archiveFolder } = archiveConfig;
  const tmpRoot = fs.mkdtempSync(
    path.join(os.tmpdir(), `mva-${model.folder}-`),
  );
  const archivePath = path.join(tmpRoot, `${archiveFolder}.tar.bz2`);

  console.log(`[models] Downloading ${model.folder} for iOS bundle assets...`);
  execFileSync(
    'curl',
    ['-L', '--fail', '--silent', '--show-error', '-o', archivePath, url],
    {
      stdio: 'inherit',
    },
  );

  execFileSync(
    'tar',
    [
      '-xjf',
      archivePath,
      '-C',
      tmpRoot,
      ...missingFiles.map(file => `${archiveFolder}/${file}`),
    ],
    {
      stdio: 'inherit',
    },
  );

  for (const file of missingFiles) {
    const extractedFile = path.join(tmpRoot, archiveFolder, file);
    const dstFile = path.join(modelSrcRoot, model.folder, file);

    if (!fs.existsSync(extractedFile)) {
      throw new Error(
        `Downloaded archive did not contain required model file: ${archiveFolder}/${file}`,
      );
    }

    ensureDir(path.dirname(dstFile));
    fs.copyFileSync(extractedFile, dstFile);
  }
}

function ensureRequiredSourceAssets({
  modelSrcRoot = defaultModelSrcRoot,
  androidModelRoot = defaultAndroidModelRoot,
  models = requiredModels,
} = {}) {
  const roots = { modelSrcRoot, androidModelRoot };

  for (const model of models) {
    for (const file of model.files) {
      const srcFile = path.join(modelSrcRoot, model.folder, file);

      if (fs.existsSync(srcFile)) {
        continue;
      }

      if (ensureFileFromAndroid(model, file, roots)) {
        continue;
      }

      if (MODEL_ARCHIVE_CONFIG[model.folder]) {
        ensureModelArchiveFiles(model, roots);
        continue;
      }

      throw new Error(`Missing required bundled model file: ${srcFile}`);
    }
  }
}

function copyRequiredModelAssets({
  modelDstRoot,
  modelSrcRoot = defaultModelSrcRoot,
  androidModelRoot = defaultAndroidModelRoot,
  models = requiredModels,
}) {
  if (!modelDstRoot) {
    throw new Error('Missing destination models directory argument');
  }

  ensureRequiredSourceAssets({ modelSrcRoot, androidModelRoot, models });

  for (const model of models) {
    const srcDir = path.join(modelSrcRoot, model.folder);
    const dstDir = path.join(modelDstRoot, model.folder);

    ensureDir(dstDir);

    for (const file of model.files) {
      const srcFile = path.join(srcDir, file);
      const dstFile = path.join(dstDir, file);

      if (!fs.existsSync(srcFile)) {
        throw new Error(`Missing required bundled model file: ${srcFile}`);
      }

      fs.copyFileSync(srcFile, dstFile);
    }
  }
}

if (require.main === module) {
  copyRequiredModelAssets({ modelDstRoot: process.argv[2] });
}

module.exports = {
  copyRequiredModelAssets,
  ensureRequiredSourceAssets,
};
