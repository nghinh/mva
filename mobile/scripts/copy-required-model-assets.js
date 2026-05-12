const fs = require('fs');
const path = require('path');

const projectRoot = path.resolve(__dirname, '..');
const modelSrcRoot = path.join(projectRoot, 'assets', 'models');
const modelDstRoot = process.argv[2];

if (!modelDstRoot) {
  throw new Error('Missing destination models directory argument');
}

const requiredModels = [
  {
    folder: 'sherpa-onnx-sense-voice-zh-en-ja-ko-yue-int8-2024-07-17',
    files: ['model.int8.onnx', 'tokens.txt'],
  },
  {
    folder: 'speaker-diarization',
    files: ['model.onnx', '3dspeaker_speech_campplus_sv_en_voxceleb_16k.onnx'],
  },
];

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, {recursive: true});
}

for (const model of requiredModels) {
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
