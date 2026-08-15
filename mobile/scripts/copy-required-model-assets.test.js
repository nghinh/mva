const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

jest.mock('child_process', () => ({
  execFileSync: jest.fn(),
}));

const {
  ensureRequiredSourceAssets,
} = require('./copy-required-model-assets');

describe('copy-required-model-assets', () => {
  let tmpRoot;

  beforeEach(() => {
    tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'model-assets-test-'));
    execFileSync.mockReset();
    execFileSync.mockImplementation((command, args) => {
      if (command !== 'curl') {
        throw new Error(`Unexpected command: ${command}`);
      }

      const outputIndex = args.indexOf('-o');
      const outputPath = args[outputIndex + 1];
      fs.mkdirSync(path.dirname(outputPath), { recursive: true });
      fs.writeFileSync(outputPath, 'model');
    });
  });

  afterEach(() => {
    fs.rmSync(tmpRoot, { recursive: true, force: true });
  });

  it('does not require or download Whisper when preparing default bundled models', () => {
    const modelSrcRoot = path.join(tmpRoot, 'ios-models');
    const androidModelRoot = path.join(tmpRoot, 'android-models');

    const androidModels = [
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
        files: [
          'model.onnx',
          '3dspeaker_speech_campplus_sv_en_voxceleb_16k.onnx',
        ],
      },
    ];

    for (const model of androidModels) {
      for (const file of model.files) {
        const sourcePath = path.join(androidModelRoot, model.folder, file);
        fs.mkdirSync(path.dirname(sourcePath), { recursive: true });
        fs.writeFileSync(sourcePath, 'model');
      }
    }

    ensureRequiredSourceAssets({
      modelSrcRoot,
      androidModelRoot,
    });

    expect(
      fs.existsSync(path.join(modelSrcRoot, 'sherpa-onnx-whisper-small-int8')),
    ).toBe(false);
    expect(execFileSync).not.toHaveBeenCalled();
  });

  it('throws for unknown missing model files instead of downloading unrelated assets', () => {
    expect(() =>
      ensureRequiredSourceAssets({
        modelSrcRoot: path.join(tmpRoot, 'ios-models'),
        androidModelRoot: path.join(tmpRoot, 'android-models'),
        models: [{ folder: 'unknown-model', files: ['model.onnx'] }],
      }),
    ).toThrow(/Missing required bundled model file/);
    expect(execFileSync).not.toHaveBeenCalled();
  });
});
