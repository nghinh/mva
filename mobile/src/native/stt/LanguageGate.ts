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
