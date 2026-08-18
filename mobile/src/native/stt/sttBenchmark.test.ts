jest.mock('react-native-sherpa-onnx', () => ({
  fileModelPath: jest.fn((path) => path),
}));

jest.mock('react-native-sherpa-onnx/stt', () => ({
  createSTT: jest.fn(),
}));

jest.mock('../models/BundledModelInstaller', () => ({
  ensureBundledModelInstalled: jest.fn(),
}));

import {classifyTier, makeBenchmarkSamples, runSttBenchmark, BENCHMARK_AUDIO_SECONDS} from './sttBenchmark';

describe('classifyTier', () => {
  it('at threshold → strong', () => expect(classifyTier(0.35)).toBe('strong'));
  it('above threshold → low', () => expect(classifyTier(0.36)).toBe('low'));
  it('negative (failed run) → low', () => expect(classifyTier(-1)).toBe('low'));
});

describe('makeBenchmarkSamples', () => {
  it('produces 4s of 16k mono in [-1, 1]', () => {
    const s = makeBenchmarkSamples();
    expect(s.length).toBe(BENCHMARK_AUDIO_SECONDS * 16000);
    expect(Math.max(...Array.from(s.slice(0, 1000)).map(Math.abs))).toBeLessThanOrEqual(1);
  });
});

describe('runSttBenchmark', () => {
  it('computes rtf from measured decode time', async () => {
    let t = 0;
    const result = await runSttBenchmark({
      createEngine: async () => ({
        transcribeSamples: async () => {
          t += 1000; // decode giả lập tốn 1000ms
          return {text: '', lang: ''};
        },
        destroy: async () => {},
      }),
      now: () => t,
      timeoutMs: 30_000,
    });
    expect(result.rtf).toBeCloseTo(1000 / (BENCHMARK_AUDIO_SECONDS * 1000));
    expect(result.tier).toBe('strong');
  });

  it('engine creation failure → tier low, rtf -1', async () => {
    const result = await runSttBenchmark({
      createEngine: async () => {
        throw new Error('no model');
      },
      now: Date.now,
      timeoutMs: 30_000,
    });
    expect(result).toEqual({rtf: -1, tier: 'low'});
  });

  it('decode slower than timeout → tier low', async () => {
    const result = await runSttBenchmark({
      createEngine: async () => ({
        transcribeSamples: () => new Promise(() => {}), // never resolves
        destroy: async () => {},
      }),
      now: Date.now,
      timeoutMs: 50,
    });
    expect(result).toEqual({rtf: -1, tier: 'low'});
  });
});
