# Language Gate Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Tự động nhận diện ngôn ngữ input (vi vs EN/JA/KO/ZH) bằng dual-decode 5 phút đầu trên máy khỏe; popup Auto/Vi trên máy yếu; bỏ toàn bộ UI chọn input language.

**Architecture:** Module thuần `LanguageGate` (chấm điểm + tally + quyết định khóa) tách khỏi `RealSpeechRecognizer` (quản lý 2 engine, dual-decode final, khóa tại phút 5). Benchmark RTF chạy 1 lần trong bước prewarm của Splash, lưu tier vào settingsStore v12. Spec: `docs/superpowers/specs/2026-08-18-language-gate-design.md`.

**Tech Stack:** React Native + TypeScript, zustand (persist), react-native-sherpa-onnx (SenseVoice int8 + Zipformer-VI int8), jest, react-i18next.

**Chuẩn bị:** làm việc trong repo `mva`, tạo nhánh từ HEAD hiện tại (`fix/splash-language-pack-hang` — chứa spec + fix splash):
```bash
cd /Users/phamuyen/AI_CODE/mva && git checkout -b feat/language-gate
```
Mọi lệnh test/lint chạy từ `mobile/`: `cd /Users/phamuyen/AI_CODE/mva/mobile`.

---

### Task 1: LanguageGate — module thuần (score / tally / lock)

**Files:**
- Create: `mobile/src/native/stt/LanguageGate.ts`
- Test: `mobile/src/native/stt/LanguageGate.test.ts`

- [ ] **Step 1: Viết test fail**

```typescript
// mobile/src/native/stt/LanguageGate.test.ts
import {
  GATE_WINDOW_MS,
  STRONG_RTF_THRESHOLD,
  scoreUtterance,
  createGateTally,
  recordWin,
  tallyLeader,
  decideLock,
} from './LanguageGate';

describe('constants', () => {
  it('gate window is 5 minutes', () => {
    expect(GATE_WINDOW_MS).toBe(5 * 60_000);
  });
  it('strong tier threshold is 0.35', () => {
    expect(STRONG_RTF_THRESHOLD).toBe(0.35);
  });
});

describe('scoreUtterance', () => {
  it('near-empty vi output vs full sense sentence → sense', () => {
    expect(
      scoreUtterance(
        {text: 'we should review the third quarter plan', lang: 'en'},
        {text: 'à'},
        'sense',
      ),
    ).toBe('sense');
  });

  it('near-empty sense output vs full vi sentence → vi', () => {
    expect(
      scoreUtterance(
        {text: '嗯', lang: 'zh'},
        {text: 'hôm nay chúng ta họp về kế hoạch quý ba'},
        'sense',
      ),
    ).toBe('vi');
  });

  it('sense CJK (ja) with weak vi diacritics → sense', () => {
    expect(
      scoreUtterance(
        {text: '今日は第三四半期の計画について話します', lang: 'ja'},
        {text: 'con nichi oa'},
        'vi',
      ),
    ).toBe('sense');
  });

  it('strong vi diacritics with latin sense output lacking english signal → vi', () => {
    expect(
      scoreUtterance(
        {text: 'hom nay chung ta hop ve ke hoach', lang: 'en'},
        {text: 'hôm nay chúng ta họp về kế hoạch quý ba'},
        'sense',
      ),
    ).toBe('vi');
  });

  it('english sense output with common words vs weak vi → sense', () => {
    expect(
      scoreUtterance(
        {text: 'i think we should have the meeting tomorrow', lang: 'en'},
        {text: 'ai think guy sut have de mít tinh tu mô râu'},
        'vi',
      ),
    ).toBe('sense');
  });

  it('ambiguous (sense CJK AND strong vi diacritics) → falls back to leader', () => {
    const sense = {text: '我们今天讨论第三季度的计划', lang: 'zh'};
    const vi = {text: 'hôm nay chúng ta họp về kế hoạch quý ba'};
    expect(scoreUtterance(sense, vi, 'sense')).toBe('sense');
    expect(scoreUtterance(sense, vi, 'vi')).toBe('vi');
  });

  it('both empty → leader', () => {
    expect(scoreUtterance({text: ''}, {text: ''}, 'vi')).toBe('vi');
  });
});

describe('tally + lock', () => {
  it('majority wins', () => {
    const t = createGateTally();
    recordWin(t, 'vi');
    recordWin(t, 'vi');
    recordWin(t, 'sense');
    expect(tallyLeader(t)).toBe('vi');
    expect(decideLock(t)).toBe('vi');
  });

  it('tie → sense (wider language coverage)', () => {
    const t = createGateTally();
    recordWin(t, 'vi');
    recordWin(t, 'sense');
    expect(tallyLeader(t)).toBe('sense');
    expect(decideLock(t)).toBe('sense');
  });

  it('empty tally → sense', () => {
    expect(decideLock(createGateTally())).toBe('sense');
  });
});
```

- [ ] **Step 2: Chạy test, xác nhận fail**

Run: `npx jest src/native/stt/LanguageGate.test.ts`
Expected: FAIL — `Cannot find module './LanguageGate'`

- [ ] **Step 3: Implement**

```typescript
// mobile/src/native/stt/LanguageGate.ts
/**
 * Language Gate — Phase 2 (spec: docs/superpowers/specs/2026-08-18-language-gate-design.md)
 *
 * Pure scoring/tally logic deciding, per finalized utterance, whether the
 * SenseVoice (EN/JA/KO/ZH) or Zipformer-VI transcription is the plausible one.
 * No engine references, no side effects — RealSpeechRecognizer owns lifecycle.
 *
 * Heuristic limitation (accepted in spec §7): khi speech là zh thật sự thì
 * output Zipformer vẫn là "tiếng Việt rác" có dấu, và ngược lại vi thật sự cho
 * ra zh rác từ SenseVoice — vùng mờ này rơi về leader hiện tại của tally,
 * nên một phiên đơn ngữ luôn hội tụ đúng sau vài utterance rõ ràng.
 */

export const GATE_WINDOW_MS = 5 * 60_000;
export const STRONG_RTF_THRESHOLD = 0.35;

export type GateEngine = 'sense' | 'vi';

export interface GateUtteranceOutput {
  text: string;
  /** SenseVoice language tag (en/ja/ko/zh/…). Absent for the vi engine. */
  lang?: string;
}

export interface GateTally {
  sense: number;
  vi: number;
}

// Reused shape from LanguageDetector's vi heuristic, as a counting regex.
const VI_DIACRITICS_RE =
  /[àáâãèéêìíòóôõùúýăắằẳẵặầẩẫậếềểễệỉịọỏốồổỗộớờởỡợụủứừửữựỳỷỹđ]/gi;
const CJK_KANA_HANGUL_RE = /[一-鿿぀-ゟ゠-ヿ가-힯]/;
const EN_COMMON_WORDS = [
  'the', 'is', 'are', 'was', 'were', 'have', 'has', 'will', 'would', 'could',
  'should', 'think', 'believe', 'consider', 'meeting', 'we', 'you', 'and',
];

const NEAR_EMPTY_MAX = 2;
const FULL_SENTENCE_MIN = 6;
const VI_DIACRITIC_STRONG_RATIO = 0.08;
const EN_SIGNAL_STRONG = 0.5;

function viDiacriticRatio(text: string): number {
  if (!text) return 0;
  const matches = text.match(VI_DIACRITICS_RE);
  return (matches?.length ?? 0) / text.length;
}

function enSignal(out: GateUtteranceOutput): number {
  const words = out.text.toLowerCase().split(/\s+/).filter(Boolean);
  if (words.length === 0) return 0;
  const hits = words.filter((w) => EN_COMMON_WORDS.includes(w)).length;
  const langBoost = (out.lang ?? '').toLowerCase().startsWith('en') ? 0.25 : 0;
  return Math.min(1, langBoost + hits / Math.max(4, words.length) * 2);
}

/**
 * Decide which engine transcribed this utterance correctly.
 * `leader` là engine đang dẫn tally — dùng làm tie-break để chống dao động.
 */
export function scoreUtterance(
  sense: GateUtteranceOutput,
  vi: GateUtteranceOutput,
  leader: GateEngine,
): GateEngine {
  const senseText = sense.text.trim();
  const viText = vi.text.trim();

  // Rule 1: one side near-empty, the other a full sentence → longer side wins.
  if (senseText.length <= NEAR_EMPTY_MAX && viText.length >= FULL_SENTENCE_MIN) return 'vi';
  if (viText.length <= NEAR_EMPTY_MAX && senseText.length >= FULL_SENTENCE_MIN) return 'sense';

  const senseLang = (sense.lang ?? '').toLowerCase();
  const senseCjk =
    (senseLang.startsWith('ja') || senseLang.startsWith('ko') ||
      senseLang.startsWith('zh') || senseLang.startsWith('cn')) &&
    CJK_KANA_HANGUL_RE.test(senseText);
  const viStrong = viDiacriticRatio(viText) >= VI_DIACRITIC_STRONG_RATIO;

  // Rule 2: exactly one side shows its native-script signal.
  if (senseCjk && !viStrong) return 'sense';
  if (viStrong && !senseCjk) {
    // Latin sense output: only a strong English signal outranks vi diacritics.
    return enSignal(sense) >= EN_SIGNAL_STRONG ? 'sense' : 'vi';
  }

  // Rule 3: sense has strong English signal and vi is not strong → sense.
  // (Cần thiết cho fixture 'english sense output…': viDiacriticRatio 0.0698
  // dưới ngưỡng 0.08 nên rơi khỏi Rule 2 — không có nhánh này sẽ trả 'vi' sai.)
  if (!viStrong && enSignal(sense) >= EN_SIGNAL_STRONG) return 'sense';

  // Rule 4: both signals present (garbage-mirror zone) or neither → leader.
  return leader;
}

export function createGateTally(): GateTally {
  return {sense: 0, vi: 0};
}

export function recordWin(tally: GateTally, winner: GateEngine): void {
  tally[winner] += 1;
}

/** Engine currently leading; ties go to sense (wider coverage). */
export function tallyLeader(tally: GateTally): GateEngine {
  return tally.vi > tally.sense ? 'vi' : 'sense';
}

/** Final lock decision at end of gate window. Tie → sense. */
export function decideLock(tally: GateTally): GateEngine {
  return tallyLeader(tally);
}
```

- [ ] **Step 4: Chạy test, xác nhận pass**

Run: `npx jest src/native/stt/LanguageGate.test.ts`
Expected: PASS (12 tests). Nếu fixture `english sense output…` fail vì enSignal < 0.5: đếm lại hits trong câu fixture (`i think we should have the meeting`… có `think/we/should/have/the/meeting` = 6 hits / 8 từ → 0.25 + 1.5 capped 1 → pass).

- [ ] **Step 5: Commit**

```bash
git add mobile/src/native/stt/LanguageGate.ts mobile/src/native/stt/LanguageGate.test.ts
git commit -m "feat(gate): LanguageGate scoring, tally and lock decision (pure module)"
```

---

### Task 2: settingsStore v12 — field `sttBenchmark`

**Files:**
- Modify: `mobile/src/shared/store/settingsStore.ts`
- Test: `mobile/src/shared/store/settingsStore.test.ts` (mới)

- [ ] **Step 1: Viết test fail**

```typescript
// mobile/src/shared/store/settingsStore.test.ts
import {useSettingsStore} from './settingsStore';

describe('settingsStore sttBenchmark (v12)', () => {
  it('defaults to null', () => {
    expect(useSettingsStore.getState().sttBenchmark).toBeNull();
  });

  it('setter stores result', () => {
    useSettingsStore.getState().setSttBenchmark({rtf: 0.2, tier: 'strong'});
    expect(useSettingsStore.getState().sttBenchmark).toEqual({rtf: 0.2, tier: 'strong'});
    useSettingsStore.getState().setSttBenchmark(null);
  });

  it('migrate from v11 keeps inputLanguage and adds null benchmark', () => {
    const migrate = useSettingsStore.persist.getOptions().migrate!;
    const migrated = migrate({inputLanguage: 'vi'}, 11) as ReturnType<typeof useSettingsStore.getState>;
    expect(migrated.inputLanguage).toBe('vi');
    expect(migrated.sttBenchmark).toBeNull();
  });
});
```

- [ ] **Step 2: Chạy test, xác nhận fail**

Run: `npx jest src/shared/store/settingsStore.test.ts`
Expected: FAIL — `sttBenchmark` undefined. (Nếu fail vì AsyncStorage mock: xem `jest.setup.js` — dự án đã mock sẵn cho các store test khác; nếu chưa có, thêm `jest.mock('@react-native-async-storage/async-storage', () => require('@react-native-async-storage/async-storage/jest/async-storage-mock'));` vào đầu file test.)

- [ ] **Step 3: Implement — sửa `settingsStore.ts`**

Thêm sau khối `export type InputLanguageMode …` (dòng ~64-65):

```typescript
/** Device STT capability tier, measured once per install at splash prewarm. */
export type DeviceSttTier = 'strong' | 'low';

export interface SttBenchmarkResult {
  /** Real-time factor đo được của SenseVoice; -1 nếu đo lỗi/timeout. */
  rtf: number;
  tier: DeviceSttTier;
}
```

Trong `interface SettingsState` thêm:

```typescript
  /** STT benchmark result — null = chưa đo (đo 1 lần ở splash prewarm). */
  sttBenchmark: SttBenchmarkResult | null;
  setSttBenchmark: (result: SttBenchmarkResult | null) => void;
```

Trong creator (cạnh `inputLanguage` dòng ~123-124) thêm:

```typescript
      sttBenchmark: null,
      setSttBenchmark: (result) => set({sttBenchmark: result}),
```

Trong `partialize` thêm `sttBenchmark: state.sttBenchmark,`. Đổi `version: 11` → `version: 12`. Trong `migrate` return object thêm:

```typescript
          // New in v12 — null buộc splash đo lại benchmark cho bản cài cũ.
          sttBenchmark: version < 12 ? null : ((state as SettingsState).sttBenchmark ?? null),
```

Cuối file thêm hook:

```typescript
export const useSttBenchmark = () => useSettingsStore((state) => state.sttBenchmark);
```

- [ ] **Step 4: Chạy test, xác nhận pass**

Run: `npx jest src/shared/store/settingsStore.test.ts`
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add mobile/src/shared/store/settingsStore.ts mobile/src/shared/store/settingsStore.test.ts
git commit -m "feat(gate): settingsStore v12 — persisted sttBenchmark tier"
```

---

### Task 3: sttBenchmark — đo RTF và phân tier

**Files:**
- Create: `mobile/src/native/stt/sttBenchmark.ts`
- Test: `mobile/src/native/stt/sttBenchmark.test.ts`

- [ ] **Step 1: Viết test fail**

```typescript
// mobile/src/native/stt/sttBenchmark.test.ts
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
```

- [ ] **Step 2: Chạy test, xác nhận fail**

Run: `npx jest src/native/stt/sttBenchmark.test.ts`
Expected: FAIL — `Cannot find module './sttBenchmark'`

- [ ] **Step 3: Implement**

```typescript
// mobile/src/native/stt/sttBenchmark.ts
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
```

- [ ] **Step 4: Chạy test, xác nhận pass**

Run: `npx jest src/native/stt/sttBenchmark.test.ts`
Expected: PASS (6 tests)

- [ ] **Step 5: Commit**

```bash
git add mobile/src/native/stt/sttBenchmark.ts mobile/src/native/stt/sttBenchmark.test.ts
git commit -m "feat(gate): one-shot SenseVoice RTF benchmark with tier classification"
```

---

### Task 4: SplashScreen — chạy benchmark trong bước prewarm

**Files:**
- Modify: `mobile/src/features/bootstrap/screens/SplashScreen.tsx` (quanh dòng 390-401)

- [ ] **Step 1: Sửa code**

Thêm import (đầu file, cạnh các import khác):

```typescript
import {runSttBenchmark} from '../../../native/stt/sttBenchmark';
import {useSettingsStore} from '../../../shared/store/settingsStore';
```

(Nếu `useSettingsStore` đã được import sẵn thì giữ nguyên.) Thay khối hiện tại:

```typescript
        startPrewarm();

        await delay(300);
        completePrewarm();
```

bằng:

```typescript
        startPrewarm();

        // Benchmark STT một lần mỗi bản cài để phân tier máy (language gate).
        // Mọi lỗi bên trong runSttBenchmark đã được nuốt → tier 'low' an toàn.
        const {sttBenchmark, setSttBenchmark} = useSettingsStore.getState();
        if (!sttBenchmark) {
          const benchmarkResult = await runSttBenchmark();
          setSttBenchmark(benchmarkResult);
          warnLog('[SplashScreen] STT benchmark:', benchmarkResult);
        }

        completePrewarm();
```

- [ ] **Step 2: Verify**

Run: `npx tsc --noEmit && npx eslint src/features/bootstrap/screens/SplashScreen.tsx`
Expected: 0 lỗi mới. Kiểm tra `delay` còn được dùng chỗ khác trong file không — nếu không còn, xoá luôn helper/import `delay` để khỏi lint unused.

- [ ] **Step 3: Commit**

```bash
git add mobile/src/features/bootstrap/screens/SplashScreen.tsx
git commit -m "feat(gate): run STT tier benchmark once during splash prewarm"
```

---

### Task 5: RealSpeechRecognizer — chế độ gate (2 engine, dual-decode final, khóa phút 5)

**Files:**
- Modify: `mobile/src/native/stt/RealSpeechRecognizer.ts`

Không có unit test cho class này (bound native, không có test sẵn); logic quyết định đã test ở Task 1. Verify bằng tsc/eslint + manual (Task 9).

- [ ] **Step 1: Import + field mới**

Thêm import:

```typescript
import {
  GATE_WINDOW_MS,
  createGateTally,
  decideLock,
  recordWin,
  scoreUtterance,
  tallyLeader,
  type GateEngine,
  type GateTally,
} from './LanguageGate';
```

Thêm field sau `private enginePrefix: 'sense' | 'vi' = 'sense';` (dòng ~166):

```typescript
  // Gate mode (máy khỏe): giữ engine VI thứ hai trong 5 phút đầu, dual-decode
  // final từng utterance, khóa engine thắng đa số tại GATE_WINDOW_MS.
  private gateActive = false;
  private gateStartMs = 0;
  private gateTally: GateTally = createGateTally();
  private viGateEngine: SttEngine | null = null;
```

- [ ] **Step 2: Mở rộng `start()`**

Đổi chữ ký:

```typescript
  async start(
    sessionId: SessionId,
    emit: (event: MeetingPipelineEvent) => void,
    sourceLanguage?: SourceLanguage,
    options?: {gateMode?: boolean},
  ): Promise<void> {
```

Sau dòng `this.enginePrefix = ...` (dòng ~178) thêm reset gate state:

```typescript
    this.gateActive = false;
    this.gateStartMs = 0;
    this.gateTally = createGateTally();
```

Ngay sau khối tạo engine SenseVoice (else-branch, sau dòng ~218), thêm — chỉ chạy khi gateMode và không forced vi:

```typescript
    if (options?.gateMode === true && this.forcedLanguage === null) {
      try {
        const viModelDir = await this.prepareModelDirectory(
          emit,
          'stt_vi',
          BUNDLED_MODEL_CONFIG.stt_vi.displayName,
        );
        this.viGateEngine = await createSTT({
          modelPath: fileModelPath(viModelDir),
          modelType: 'transducer',
          preferInt8: true,
          provider: 'cpu',
          numThreads: 2,
        });
        this.gateActive = true;
        this.gateStartMs = Date.now();
        emit({
          type: 'pipeline_status',
          session_id: sessionId,
          status: 'processing',
          timestamp_ms: Date.now(),
          details: 'Language gate active (dual-decode window)',
        });
      } catch (error) {
        // Fallback an toàn: chạy 1 engine SenseVoice như hiện tại.
        warnLog('[RealSTT] Gate: failed to load Zipformer-VI, running single-engine:', error);
        this.viGateEngine = null;
        this.gateActive = false;
      }
    }
```

Lưu ý: khối này đặt SAU `this.engine = await createSTT({... sense_voice ...})` và TRƯỚC `emit({... recognizer initialized})`.

- [ ] **Step 3: Partial decode theo leader**

Trong `emitPartial()` (dòng ~659), thay hai chỗ:

1. Guard đầu hàm `if (!this.engine || …)` giữ nguyên. Sau guard, thêm:

```typescript
    const leader: GateEngine = this.gateActive ? tallyLeader(this.gateTally) : 'sense';
    const partialEngine =
      this.gateActive && leader === 'vi' && this.viGateEngine ? this.viGateEngine : this.engine;
```

2. `const result = await this.engine.transcribeSamples(...)` → `const result = await partialEngine.transcribeSamples(bufferToTranscribe, SAMPLE_RATE);`

3. `const lang = this.detectLanguage(text, result.lang);` → 

```typescript
    const lang =
      this.gateActive && leader === 'vi' ? 'vi' : this.detectLanguage(text, result.lang);
```

- [ ] **Step 4: Final dual-decode + khóa**

Trong `runFinalTranscription()` (dòng ~694), thay đoạn từ `const result = await this.engine.transcribeSamples(...)` đến hết phần tính `lang` bằng:

```typescript
    let text: string;
    let lang: SourceLanguage;
    if (this.gateActive && this.viGateEngine) {
      // Dual-decode tuần tự trên cùng snapshot — đỉnh RAM activation không đổi.
      const senseResult = await this.engine.transcribeSamples(snapshot, SAMPLE_RATE);
      const viResult = await this.viGateEngine.transcribeSamples(snapshot, SAMPLE_RATE);
      const senseText = (senseResult.text ?? '').trim();
      const viText = (viResult.text ?? '').trim();
      if (!senseText && !viText) {
        text = '';
        lang = 'en';
      } else {
        const winner = scoreUtterance(
          {text: senseText, lang: senseResult.lang},
          {text: viText},
          tallyLeader(this.gateTally),
        );
        recordWin(this.gateTally, winner);
        if (winner === 'vi') {
          text = viText;
          lang = 'vi';
        } else {
          text = senseText;
          lang = this.detectLanguage(senseText, senseResult.lang, utteranceId);
        }
      }
    } else {
      const result = await this.engine.transcribeSamples(snapshot, SAMPLE_RATE);
      text = (result.text ?? '').trim();
      lang = text ? this.detectLanguage(text, result.lang, utteranceId) : 'en';
    }
    if (!text) {
      // giữ nguyên khối utterance_cancel empty_result hiện tại
```

(Khối `empty_result` và `stt_final` phía dưới giữ nguyên, chỉ đổi biến `result`-derived sang `text`/`lang` đã tính ở trên.)

Cuối `runFinalTranscription`, sau `infoLog('[RealSTT] stt_final', …)`, thêm:

```typescript
    if (this.gateActive && Date.now() - this.gateStartMs >= GATE_WINDOW_MS) {
      await this.lockGate(emit);
    }
```

Thêm method mới:

```typescript
  // Chốt engine tại cuối cửa sổ gate. Chạy BÊN TRONG processingChain (được gọi
  // từ runFinalTranscription) nên không có inference nào khác in-flight —
  // destroy engine thua ở đây là an toàn.
  private async lockGate(emit: (event: MeetingPipelineEvent) => void): Promise<void> {
    if (!this.gateActive || !this.viGateEngine) return;
    const winner = decideLock(this.gateTally);
    const loser = winner === 'vi' ? this.engine : this.viGateEngine;
    infoLog('[RealSTT] gate lock', {winner, tally: {...this.gateTally}});
    if (winner === 'vi') {
      this.engine = this.viGateEngine;
      this.forcedLanguage = 'vi';
      this.enginePrefix = 'vi';
    }
    this.viGateEngine = null;
    this.gateActive = false;
    try {
      await loser?.destroy();
    } catch (error) {
      warnLog('[RealSTT] gate: failed to destroy losing engine (leaked until stop):', error);
    }
    if (this.sessionId) {
      emit({
        type: 'pipeline_status',
        session_id: this.sessionId,
        status: 'processing',
        timestamp_ms: Date.now(),
        details: `Gate locked: ${winner === 'vi' ? BUNDLED_MODEL_CONFIG.stt_vi.displayName : BUNDLED_MODEL_CONFIG.stt.displayName}`,
      });
    }
  }
```

- [ ] **Step 5: `stop()` dọn engine gate**

Trong `stop()`, sau khối destroy `this.engine` (dòng ~266-269), thêm:

```typescript
    if (this.viGateEngine) {
      await this.viGateEngine.destroy();
      this.viGateEngine = null;
    }
    this.gateActive = false;
    this.gateTally = createGateTally();
```

- [ ] **Step 6: Verify**

Run: `npx tsc --noEmit && npx eslint src/native/stt/RealSpeechRecognizer.ts`
Expected: 0 lỗi. Chú ý: `SttEngine` type đã import sẵn; `fileModelPath`/`createSTT` đã import sẵn.

- [ ] **Step 7: Commit**

```bash
git add mobile/src/native/stt/RealSpeechRecognizer.ts
git commit -m "feat(gate): dual-engine gate mode in RealSpeechRecognizer with 5-minute lock"
```

---

### Task 6: useMeetingSession — truyền `gateMode`

**Files:**
- Modify: `mobile/src/features/meeting/hooks/useMeetingSession.ts` (dòng 62 và 1126-1170)

- [ ] **Step 1: Sửa interface (dòng 62)**

```typescript
  startMeeting: (
    sourceLanguage?: SourceLanguage,
    targetLanguage?: TargetLanguage,
    options?: {gateMode?: boolean},
  ) => Promise<void>;
```

- [ ] **Step 2: Sửa implementation (dòng ~1126-1127)**

```typescript
  const startMeeting = useCallback(
    async (
      sourceLanguage: SourceLanguage = 'en',
      targetLanguage: TargetLanguage = 'vi',
      options?: {gateMode?: boolean},
    ) => {
```

và chỗ gọi recognizer (dòng ~1169):

```typescript
          await realSpeechRecognizer.start(
            sessionId,
            handleIncomingPipelineEvent,
            effectiveSourceLanguage,
            {gateMode: options?.gateMode === true},
          );
```

- [ ] **Step 3: Verify + Commit**

Run: `npx tsc --noEmit`
Expected: 0 lỗi.

```bash
git add mobile/src/features/meeting/hooks/useMeetingSession.ts
git commit -m "feat(gate): plumb gateMode from startMeeting to recognizer"
```

---

### Task 7: i18n — key cho popup máy yếu (5 locale)

**Files:**
- Modify: `mobile/src/i18n/locales/{en,vi,ja,ko,zh}.json` — thêm vào namespace `meeting`

- [ ] **Step 1: Thêm key**

Thêm vào object `"meeting"` của từng file (cạnh các key modal target sẵn có):

`en.json`:
```json
    "inputLangModalTitle": "Input language for this meeting",
    "inputLangModalAuto": "Auto (EN · JA · KO · ZH)",
    "inputLangModalVi": "Vietnamese",
    "inputLangModalStart": "Start Meeting",
    "inputLangModalCancel": "Cancel"
```

`vi.json`:
```json
    "inputLangModalTitle": "Ngôn ngữ đầu vào cho cuộc họp",
    "inputLangModalAuto": "Tự động (EN · JA · KO · ZH)",
    "inputLangModalVi": "Tiếng Việt",
    "inputLangModalStart": "Bắt đầu họp",
    "inputLangModalCancel": "Hủy"
```

`ja.json`:
```json
    "inputLangModalTitle": "この会議の入力言語",
    "inputLangModalAuto": "自動 (EN · JA · KO · ZH)",
    "inputLangModalVi": "ベトナム語",
    "inputLangModalStart": "会議を開始",
    "inputLangModalCancel": "キャンセル"
```

`ko.json`:
```json
    "inputLangModalTitle": "이 회의의 입력 언어",
    "inputLangModalAuto": "자동 (EN · JA · KO · ZH)",
    "inputLangModalVi": "베트남어",
    "inputLangModalStart": "회의 시작",
    "inputLangModalCancel": "취소"
```

`zh.json`:
```json
    "inputLangModalTitle": "本次会议的输入语言",
    "inputLangModalAuto": "自动 (EN · JA · KO · ZH)",
    "inputLangModalVi": "越南语",
    "inputLangModalStart": "开始会议",
    "inputLangModalCancel": "取消"
```

- [ ] **Step 2: Verify + Commit**

Run: `node -e "['en','vi','ja','ko','zh'].forEach(l => JSON.parse(require('fs').readFileSync('src/i18n/locales/'+l+'.json')))" && npx jest src/i18n --passWithNoTests`
Expected: không lỗi parse JSON.

```bash
git add mobile/src/i18n/locales/
git commit -m "feat(gate): i18n keys for low-tier input language modal (5 locales)"
```

---

### Task 8: MeetingScreen — bỏ picker input, thêm modal máy yếu, start theo tier

**Files:**
- Create: `mobile/src/features/meeting/components/InputLanguageModal.tsx`
- Modify: `mobile/src/features/meeting/screens/MeetingScreen.tsx`

- [ ] **Step 1: Tạo `InputLanguageModal.tsx`**

```typescript
// mobile/src/features/meeting/components/InputLanguageModal.tsx
import React, {useState} from 'react';
import {Modal, Text, TouchableOpacity, View, StyleSheet} from 'react-native';
import {useTranslation} from 'react-i18next';
import {useTheme} from '../../../shared/theme';
import type {InputLanguageMode} from '../../../shared/store/settingsStore';

interface Props {
  visible: boolean;
  initialChoice: InputLanguageMode;
  onConfirm: (choice: InputLanguageMode) => void;
  onCancel: () => void;
}

/**
 * Popup chọn ngôn ngữ input — CHỈ hiện trên máy tier 'low' (không đủ sức chạy
 * language gate dual-decode). Máy strong đi thẳng vào gate, không thấy modal.
 */
export function InputLanguageModal({visible, initialChoice, onConfirm, onCancel}: Props) {
  const {t} = useTranslation('meeting');
  const theme = useTheme();
  const [choice, setChoice] = useState<InputLanguageMode>(initialChoice);

  // Sync lại lựa chọn ghi nhớ mỗi lần mở modal.
  React.useEffect(() => {
    if (visible) setChoice(initialChoice);
  }, [visible, initialChoice]);

  const options: Array<{mode: InputLanguageMode; label: string; flag: string}> = [
    {mode: 'auto', label: t('inputLangModalAuto'), flag: '🌐'},
    {mode: 'vi', label: t('inputLangModalVi'), flag: '🇻🇳'},
  ];

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View style={styles.overlay}>
        <View style={[styles.card, {backgroundColor: theme.colors.surface.primary}]}>
          <Text style={[styles.title, {color: theme.colors.text.primary}]}>
            {t('inputLangModalTitle')}
          </Text>
          {options.map((opt) => {
            const active = choice === opt.mode;
            return (
              <TouchableOpacity
                key={opt.mode}
                style={[
                  styles.option,
                  active
                    ? {backgroundColor: theme.colors.primary + '20', borderColor: theme.colors.primary}
                    : {backgroundColor: theme.colors.surface.secondary, borderColor: theme.colors.border.subtle},
                ]}
                onPress={() => setChoice(opt.mode)}
                activeOpacity={0.75}>
                <Text style={styles.optionFlag}>{opt.flag}</Text>
                <Text
                  style={[
                    styles.optionLabel,
                    {color: active ? theme.colors.primary : theme.colors.text.primary},
                  ]}>
                  {opt.label}
                </Text>
              </TouchableOpacity>
            );
          })}
          <View style={styles.actions}>
            <TouchableOpacity style={styles.actionBtn} onPress={onCancel} activeOpacity={0.75}>
              <Text style={[styles.actionText, {color: theme.colors.text.secondary}]}>
                {t('inputLangModalCancel')}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionBtn, styles.actionPrimary, {backgroundColor: '#6C5CE7'}]}
              onPress={() => onConfirm(choice)}
              activeOpacity={0.85}>
              <Text style={[styles.actionText, {color: '#FFFFFF'}]}>
                {t('inputLangModalStart')}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 24},
  card: {borderRadius: 16, padding: 20},
  title: {fontSize: 17, fontWeight: '600', marginBottom: 16},
  option: {
    flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: 12,
    paddingVertical: 14, paddingHorizontal: 16, marginBottom: 10,
  },
  optionFlag: {fontSize: 20, marginRight: 12},
  optionLabel: {fontSize: 15, fontWeight: '500'},
  actions: {flexDirection: 'row', justifyContent: 'flex-end', marginTop: 8, gap: 12},
  actionBtn: {paddingVertical: 12, paddingHorizontal: 18, borderRadius: 10},
  actionPrimary: {},
  actionText: {fontSize: 15, fontWeight: '600'},
});
```

Chỉnh import `useTheme` theo đúng đường dẫn theme của dự án (xem cách `MeetingScreen.tsx` import — dùng y hệt).

- [ ] **Step 2: Sửa MeetingScreen**

1. Import: thêm `InputLanguageModal` và `useSttBenchmark`; bỏ import không còn dùng sau khi xoá toggle (kiểm tra `Platform` còn dùng chỗ khác không trước khi bỏ).

```typescript
import {InputLanguageModal} from '../components/InputLanguageModal';
import {useSttBenchmark} from '../../../shared/store/settingsStore';
```

2. Xoá `handleInputLanguageToggle` (dòng ~83-89).

3. Thêm state + hook (cạnh `targetLangModalVisible`):

```typescript
  const sttBenchmark = useSttBenchmark();
  const [inputLangModalVisible, setInputLangModalVisible] = useState(false);
```

4. Thay `handleStartMeeting` (dòng ~144-153):

```typescript
  const beginMeeting = useCallback(
    async (choice: 'auto' | 'vi' | 'gate') => {
      if (choice === 'gate') {
        await startMeeting('en', targetLanguage, {gateMode: true});
        return;
      }
      setInputLanguage(choice);
      // Input vi mà target cũng vi → chuyển target sang en để bản dịch không no-op.
      const effectiveTarget = choice === 'vi' && targetLanguage === 'vi' ? 'en' : targetLanguage;
      if (effectiveTarget !== targetLanguage) setTargetLanguage(effectiveTarget);
      await startMeeting(choice === 'vi' ? 'vi' : 'en', effectiveTarget);
    },
    [startMeeting, targetLanguage, setInputLanguage, setTargetLanguage],
  );

  const handleStartMeeting = useCallback(async () => {
    const hasPermission = await requestAudioPermission();
    if (!hasPermission) {
      return;
    }
    if (sttBenchmark?.tier === 'strong') {
      await beginMeeting('gate');
    } else {
      // Máy yếu (hoặc chưa benchmark): hỏi input language, nhớ lựa chọn cũ.
      setInputLangModalVisible(true);
    }
  }, [beginMeeting, sttBenchmark]);
```

5. Xoá khối source chip trong JSX (từ comment `{/* Source: 🌐 Auto ▾ or 🇻🇳 ▾ */}` đến hết `</TouchableOpacity>` của chip đó, dòng ~450-472) và mũi tên `↓` nếu layout không còn cần (giữ target chip). Kiểm tra style `langArrowCol` còn dùng không.

6. Thêm modal vào JSX (cạnh Target Language Modal):

```tsx
      <InputLanguageModal
        visible={inputLangModalVisible}
        initialChoice={inputLanguage}
        onConfirm={(choice) => {
          setInputLangModalVisible(false);
          beginMeeting(choice);
        }}
        onCancel={() => setInputLangModalVisible(false)}
      />
```

- [ ] **Step 3: Verify**

Run: `npx tsc --noEmit && npx eslint src/features/meeting/`
Expected: 0 lỗi (chú ý unused: `handleInputLanguageToggle` đã xoá, style không dùng, import `Platform` nếu hết chỗ dùng).

- [ ] **Step 4: Commit**

```bash
git add mobile/src/features/meeting/
git commit -m "feat(gate): tier-aware meeting start — gate on strong, language modal on low"
```

---

### Task 9: SettingsScreen — bỏ row Input Language

**Files:**
- Modify: `mobile/src/features/settings/screens/SettingsScreen.tsx` (dòng ~394-432)
- Modify: `mobile/src/i18n/locales/{en,vi,ja,ko,zh}.json` — xoá 4 key khỏi namespace `settings`

- [ ] **Step 1: Xoá khối UI**

Xoá toàn bộ fragment `{Platform.OS === 'ios' && (<>…</>)}` chứa Input Language (từ comment `{/* Input Language (iOS only — ViSpeechModule uses SFSpeechRecognizer) */}` đến `)}`). Xoá `useInputLanguage` import + `const inputLanguage = …` (dòng 43, 93) và `setInputLanguage` khỏi destructuring (dòng 94) nếu không còn chỗ dùng.

- [ ] **Step 2: Xoá i18n key mồ côi**

Xoá 4 key khỏi namespace `settings` của cả 5 locale: `inputLanguage`, `inputLanguageDesc`, `inputLangAuto`, `inputLangVietnamese`.

Kiểm tra không còn ai dùng: `grep -rn "inputLangAuto\|inputLangVietnamese\|'inputLanguage'\|\"inputLanguageDesc\"" src/ --include="*.tsx" --include="*.ts"` → chỉ được phép còn matches ở settingsStore (field `inputLanguage` của store thì GIỮ — popup dùng làm lựa chọn ghi nhớ).

- [ ] **Step 3: Verify + Commit**

Run: `npx tsc --noEmit && npx eslint src/features/settings/ && node -e "['en','vi','ja','ko','zh'].forEach(l => JSON.parse(require('fs').readFileSync('src/i18n/locales/'+l+'.json')))"`
Expected: 0 lỗi.

```bash
git add mobile/src/features/settings/ mobile/src/i18n/locales/
git commit -m "feat(gate): remove input language row from Settings"
```

---

### Task 10: Verify toàn cục + manual checklist

- [ ] **Step 1: Full suite**

Run (từ `mobile/`):
```bash
npx tsc --noEmit && npx eslint . && npx jest
```
Expected: 0 lỗi tsc/eslint mới so với baseline nhánh; toàn bộ jest pass (baseline hiện tại: xem output đầu tiên khi chạy — mọi suite đang pass trước Task 1 phải còn pass).

- [ ] **Step 2: Manual trên máy thật (checklist — ghi kết quả vào PR description)**

1. Cài fresh (hoặc xoá app data) → mở app → splash: log `[SplashScreen] STT benchmark:` xuất hiện đúng 1 lần; mở app lần 2 không đo lại.
2. Máy strong: bấm Start — KHÔNG có popup; log `Language gate active`; nói tiếng Việt ~1 phút → transcript vi đúng, badge VI; nói tiếp tiếng Anh → utterance en hiển thị đúng trong cửa sổ.
3. Đợi qua phút 5 (nói thêm 1 câu sau mốc) → log `gate lock` + status `Gate locked: …`; phần còn lại phiên chạy đúng engine thắng.
4. Phiên toàn tiếng Anh từ đầu → gate chốt SenseVoice, transcript en/ja/ko/zh vẫn auto-detect như cũ.
5. Ép tier low (tạm sửa `STRONG_RTF_THRESHOLD = 0` trong LanguageGate.ts, rebuild, HOẶC xoá app data trên máy yếu thật): bấm Start → popup hiện, preselect đúng lựa chọn lần trước; chọn Tiếng Việt → phiên vi như Phase 1; restore lại threshold sau khi test.
6. Settings không còn row Input Language; MeetingScreen không còn chip 🌐/🇻🇳 bên cạnh nút Start; chip target vẫn hoạt động.
7. Stop giữa cửa sổ gate (phút 2) → không crash, log `Recognizer stopped`, cả 2 engine được destroy (không còn tiến trình inference).

- [ ] **Step 3: Commit cuối + gộp nhánh**

```bash
git add -A && git status   # xác nhận chỉ còn file thuộc feature
git commit -m "feat(gate): language gate — auto input language detection (Phase 2)" --allow-empty
```
Dùng skill superpowers:finishing-a-development-branch để chọn merge/PR.

---

## Self-review đã chạy

- **Spec coverage:** §4.1 benchmark → Task 2/3/4; §4.2 LanguageGate → Task 1; §4.3 recognizer → Task 5/6; §4.4 UI → Task 7/8/9; §5 error handling → Task 3 (timeout/fail→low), Task 5 Step 2 (vi engine fail→fallback), Step 4 (destroy fail→log); §6 testing → test từng task + Task 10 manual. Không có gap.
- **Type consistency:** `GateEngine`/`GateTally`/`SttBenchmarkResult`/`DeviceSttTier`/`InputLanguageMode` dùng nhất quán xuyên các task; `startMeeting(source, target, options)` khớp Task 6↔8; `start(sessionId, emit, sourceLanguage, options)` khớp Task 5↔6.
- **Known-fuzzy:** heuristic `scoreUtterance` vùng garbage-mirror rơi về leader (đã ghi trong doc-comment + spec §7); tinh chỉnh sau bằng transcript thật từ field/bench.
