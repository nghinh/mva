import {fileModelPath} from 'react-native-sherpa-onnx';
import {createSTT} from 'react-native-sherpa-onnx/stt';
import {warnLog} from '../../shared/utils/logger';
import {ensureBundledModelInstalled} from '../models/BundledModelInstaller';
import {STRONG_RTF_THRESHOLD} from './LanguageGate';
import type {DeviceSttTier, SttBenchmarkResult} from '../../shared/store/settingsStore';

export const BENCHMARK_AUDIO_SECONDS = 4;
export const BENCHMARK_TIMEOUT_MS = 30_000;
const SAMPLE_RATE = 16000;

export function classifyTier(rtf: number): DeviceSttTier {
  return rtf >= 0 && rtf <= STRONG_RTF_THRESHOLD ? 'strong' : 'low';
}

/**
 * 220Hz sine với biên độ điều biến nhẹ. Nội dung không quan trọng cho RTF —
 * SenseVoice chạy cùng khối lượng tính toán per-frame bất kể audio là gì.
 */
export function makeBenchmarkSamples(
  seconds: number = BENCHMARK_AUDIO_SECONDS,
  sampleRate: number = SAMPLE_RATE,
): Float32Array {
  const n = seconds * sampleRate;
  const out = new Float32Array(n);
  for (let i = 0; i < n; i += 1) {
    const mod = 0.6 + 0.4 * Math.sin((2 * Math.PI * 3 * i) / sampleRate);
    out[i] = 0.1 * mod * Math.sin((2 * Math.PI * 220 * i) / sampleRate);
  }
  return out;
}

interface BenchmarkEngine {
  transcribeSamples: (samples: number[], sampleRate: number) => Promise<unknown>;
  destroy: () => Promise<void>;
}

interface BenchmarkDeps {
  createEngine: () => Promise<BenchmarkEngine>;
  now: () => number;
  timeoutMs: number;
}

async function createRealEngine(): Promise<BenchmarkEngine> {
  const modelDir = await ensureBundledModelInstalled('stt', () => {});
  return createSTT({
    modelPath: fileModelPath(modelDir),
    modelType: 'sense_voice',
    preferInt8: true,
    provider: 'cpu',
    numThreads: 2,
    modelOptions: {senseVoice: {useItn: true}},
  });
}

const FAILED: SttBenchmarkResult = {rtf: -1, tier: 'low'};

/**
 * Đo RTF của SenseVoice trên audio tổng hợp. Mọi lỗi/timeout → tier 'low'
 * (đường popup luôn an toàn, không bao giờ chặn cuộc họp). Gọi 1 lần mỗi bản
 * cài từ SplashScreen khi settingsStore.sttBenchmark === null.
 */
export async function runSttBenchmark(
  deps: BenchmarkDeps = {createEngine: createRealEngine, now: Date.now, timeoutMs: BENCHMARK_TIMEOUT_MS},
): Promise<SttBenchmarkResult> {
  let engine: BenchmarkEngine | null = null;
  try {
    const timeout = new Promise<'timeout'>((resolve) =>
      setTimeout(() => resolve('timeout'), deps.timeoutMs),
    );
    const run = (async (): Promise<SttBenchmarkResult> => {
      engine = await deps.createEngine();
      const samples = Array.from(makeBenchmarkSamples());
      const t0 = deps.now();
      await engine.transcribeSamples(samples, SAMPLE_RATE);
      const rtf = (deps.now() - t0) / (BENCHMARK_AUDIO_SECONDS * 1000);
      return {rtf, tier: classifyTier(rtf)};
    })();
    const result = await Promise.race([run, timeout]);
    if (result === 'timeout') {
      warnLog('[sttBenchmark] timed out — classifying device as low tier');
      return FAILED;
    }
    return result;
  } catch (error) {
    warnLog('[sttBenchmark] failed — classifying device as low tier:', error);
    return FAILED;
  } finally {
    // destroy sau khi race xong; engine treo trong nhánh timeout sẽ bị hủy ở đây.
    try {
      await (engine as BenchmarkEngine | null)?.destroy();
    } catch {
      // engine chết cùng process nếu destroy fail — không chặn splash.
    }
  }
}
