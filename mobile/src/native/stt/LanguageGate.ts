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
  /[àáảãạăằắẳẵặâầấẩẫậèéẻẽẹêềếểễệìíỉĩịòóỏõọôồốổỗộơờớởỡợùúủũụưừứửữựỳýỷỹỵđ]/gi;
const CJK_KANA_HANGUL_RE = /[一-鿿぀-ゟ゠-ヿ가-힯]/;
const EN_COMMON_WORDS = [
  'the', 'is', 'are', 'was', 'were', 'have', 'has', 'will', 'would', 'could',
  'should', 'think', 'believe', 'consider', 'meeting', 'we', 'you', 'and',
];

const NEAR_EMPTY_MAX = 2;
const FULL_SENTENCE_MIN = 6;
const VI_DIACRITIC_STRONG_RATIO = 0.08;
// Tiếng Việt THẬT có mật độ dấu ~0.15–0.3; rác-vi do transducer nghe tiếng Anh
// thường < 0.12. Trên ngưỡng này vi thắng bất chấp lang tag của SenseVoice.
const VI_DIACRITIC_DOMINANT_RATIO = 0.13;
const EN_SIGNAL_STRONG = 0.5;

/** Số final tối thiểu để khóa sớm khi bằng chứng tuyệt đối một chiều. */
export const GATE_EARLY_LOCK_MIN_WINS = 6;

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

  // SenseVoice trả lang dạng TOKEN `<|en|>` / `<|zh|>` (bridge passthrough) —
  // phải lột ký tự không phải chữ trước khi so sánh, nếu không mọi rule dựa
  // trên tag chết im lặng (bug field 18/08: tiếng Anh thua rác-vi hàng loạt).
  const senseLang = (sense.lang ?? '').toLowerCase().replace(/[^a-z]/g, '');
  const senseCjk =
    (senseLang.startsWith('ja') || senseLang.startsWith('ko') ||
      senseLang.startsWith('zh') || senseLang.startsWith('cn')) &&
    CJK_KANA_HANGUL_RE.test(senseText);
  const viRatio = viDiacriticRatio(viText);
  const viStrong = viRatio >= VI_DIACRITIC_STRONG_RATIO;
  const viDominant = viRatio >= VI_DIACRITIC_DOMINANT_RATIO;
  const senseEnTag = senseLang.startsWith('en');

  // Rule 2: sense shows CJK script and vi lacks its signal → sense.
  if (senseCjk && !viStrong) return 'sense';

  // Rule 3: mật độ dấu ÁP ĐẢO = tiếng Việt thật (rác-vi từ tiếng Anh hiếm khi
  // đạt mức này) → vi thắng, kể cả khi SenseVoice tag 'en'.
  if (viDominant && !senseCjk) return 'vi';

  // Rule 4: SenseVoice có LID head thật — tag 'en' với text Latin đáng tin hơn
  // rác-vi mật độ dấu thấp. Đây là fix cho "nói tiếng Anh nhận thành tiếng
  // Việt": câu Anh không chứa stopword trước đây thua oan ở Rule 5.
  if (senseEnTag && !senseCjk) return 'sense';

  // Rule 5: vi có dấu (nhưng chưa áp đảo) và sense không có tín hiệu gì → vi,
  // trừ khi stopword tiếng Anh dày đặc.
  if (viStrong && !senseCjk) {
    return enSignal(sense) >= EN_SIGNAL_STRONG ? 'sense' : 'vi';
  }

  // Rule 6: sense has strong English signal and vi is not strong → sense.
  if (!viStrong && enSignal(sense) >= EN_SIGNAL_STRONG) return 'sense';

  // Rule 7: both signals present (garbage-mirror zone) or neither → leader.
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

/** Final lock decision at end of gate window. Tie → sense. Kept separate from tallyLeader as an intentional seam for future lock policies (e.g., minimum-utterance-count). */
export function decideLock(tally: GateTally): GateEngine {
  return tallyLeader(tally);
}

/**
 * Khóa SỚM (trước GATE_WINDOW_MS) khi bằng chứng tuyệt đối một chiều: đủ
 * GATE_EARLY_LOCK_MIN_WINS final và phía kia trắng tay. Họp đơn ngữ — trường
 * hợp phổ biến nhất — nhờ đó thoát chi phí dual-decode (độ trễ final x2) sau
 * ~1 phút thay vì chịu đủ 5 phút; phiên trộn ngôn ngữ (cả hai phía có điểm)
 * vẫn giữ nguyên cửa sổ đầy đủ. Trả về engine thắng, hoặc null nếu chưa đủ.
 */
export function decideEarlyLock(tally: GateTally): GateEngine | null {
  if (tally.sense + tally.vi < GATE_EARLY_LOCK_MIN_WINS) return null;
  if (tally.vi === 0) return 'sense';
  if (tally.sense === 0) return 'vi';
  return null;
}
