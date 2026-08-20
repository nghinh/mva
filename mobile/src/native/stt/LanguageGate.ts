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

// Từ chức năng tiếng Việt phổ biến — tiếng Việt THẬT dày đặc những từ này,
// còn "rác-vi" do transducer nghe nhầm ngôn ngữ khác thì gần như không có.
// Dùng để phân định vùng garbage-mirror (sense ra CJK VÀ vi ra dấu):
// speech vi thật → SenseVoice ra zh rác nhưng vi text đầy stopword → vi thắng;
// speech zh thật → vi text là rác không stopword → sense thắng.
const VI_COMMON_WORDS = new Set([
  'không', 'được', 'tôi', 'bạn', 'là', 'có', 'của', 'và', 'rồi', 'đang',
  'cho', 'với', 'này', 'thì', 'mà', 'muốn', 'làm', 'nói', 'đúng', 'gì',
  'đã', 'sẽ', 'ở', 'đi', 'em', 'anh', 'chúng', 'ta', 'về', 'trên',
  'trong', 'bị', 'các', 'một', 'người', 'nhé',
]);
const VI_COMMON_MIN_HITS = 2;
const VI_COMMON_MIN_RATIO = 0.15;

function viCommonWordStrong(text: string): boolean {
  const words = text.toLowerCase().split(/\s+/).filter(Boolean);
  if (words.length === 0) return false;
  const hits = words.filter((w) => VI_COMMON_WORDS.has(w)).length;
  return hits >= VI_COMMON_MIN_HITS && hits / words.length >= VI_COMMON_MIN_RATIO;
}

const NEAR_EMPTY_MAX = 2;
const FULL_SENTENCE_MIN = 6;
const VI_DIACRITIC_STRONG_RATIO = 0.08;
// Tiếng Việt THẬT có mật độ dấu ~0.15–0.3; rác-vi do transducer nghe tiếng Anh
// thường < 0.12. Trên ngưỡng này vi thắng bất chấp lang tag của SenseVoice.
const VI_DIACRITIC_DOMINANT_RATIO = 0.13;
// Mật độ dấu là TỶ LỆ — chuỗi càng ngắn thì một dấu càng nặng ký ("Alô ha" =
// 0.167!). Bug field 19/08 10:02: tiếng Anh bị vi-engine nghe thành mẩu ngắn
// có dấu và đè luôn tag en. Dominant chỉ được đè tag en khi đủ vật liệu.
const MIN_VI_EVIDENCE_CHARS = 12;
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
  /**
   * true khi ngôn ngữ dịch sang là tiếng Việt: người dùng kỳ vọng speech
   * ngoại ngữ, nên các vùng bằng chứng YẾU nghiêng về sense — vi muốn thắng
   * phải có bằng chứng thật (dấu dày + đủ dài, hoặc stopword dày).
   */
  biasAgainstVi: boolean = false,
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
  // 'yue' (tiếng Quảng) là tag SenseVoice hay gán nhất cho rác CJK khi speech
  // thật sự là vi — bỏ sót nó làm mọi rule CJK chết im (bug field 19-20/08).
  const senseCjk =
    (senseLang.startsWith('ja') || senseLang.startsWith('ko') ||
      senseLang.startsWith('zh') || senseLang.startsWith('cn') ||
      senseLang.startsWith('yue')) &&
    CJK_KANA_HANGUL_RE.test(senseText);
  const viRatio = viDiacriticRatio(viText);
  const viStrong = viRatio >= VI_DIACRITIC_STRONG_RATIO;
  const viDominant = viRatio >= VI_DIACRITIC_DOMINANT_RATIO;
  const senseEnTag = senseLang.startsWith('en');

  // Rule 2: sense shows CJK script and vi lacks its signal → sense.
  if (senseCjk && !viStrong) return 'sense';

  // Rule 3: mật độ dấu ÁP ĐẢO + ĐỦ DÀI = tiếng Việt thật → vi thắng, kể cả
  // khi SenseVoice tag 'en'. Mẩu ngắn (< MIN_VI_EVIDENCE_CHARS) không đủ tư
  // cách đè tag en — rơi xuống Rule 4.
  const viSubstantial = viText.length >= MIN_VI_EVIDENCE_CHARS;
  if (viDominant && viSubstantial && !senseCjk) return 'vi';

  // Rule 4: SenseVoice có LID head thật — tag 'en' với text Latin đáng tin hơn
  // rác-vi mật độ dấu thấp. Đây là fix cho "nói tiếng Anh nhận thành tiếng
  // Việt": câu Anh không chứa stopword trước đây thua oan ở Rule 5.
  if (senseEnTag && !senseCjk) return 'sense';

  // Rule 5: vi có dấu (nhưng chưa áp đảo+đủ dài) và sense không có tín hiệu
  // gì → vi, trừ khi stopword tiếng Anh dày đặc — hoặc đang bias theo target
  // vi mà bằng chứng vi vẫn yếu.
  if (viStrong && !senseCjk) {
    if (enSignal(sense) >= EN_SIGNAL_STRONG) return 'sense';
    if (biasAgainstVi && !(viDominant && viSubstantial)) return 'sense';
    return 'vi';
  }

  // Rule 6: sense has strong English signal and vi is not strong → sense.
  if (!viStrong && enSignal(sense) >= EN_SIGNAL_STRONG) return 'sense';

  // Rule 7: garbage-mirror zone (sense ra CJK VÀ vi có dấu) — leader nói lên
  // lịch sử EN-vs-VI, không nói được gì về zh-vs-vi, nên KHÔNG dùng leader ở
  // đây (bug field 19/08: mở đầu 4 câu EN → leader sense → mọi câu vi sau đó
  // hiện chữ Trung). Phân định bằng stopword tiếng Việt trên output Zipformer.
  if (senseCjk && viStrong) {
    if (viCommonWordStrong(viText)) return 'vi';
    // Bất đối xứng độ dài (field 20/08 11:16:45): speech vi thật làm SenseVoice
    // sụp về vài ký tự yue rác, còn zh thật cho ra CJK DÀI tương xứng thời
    // lượng nói. vi dominant + đủ dài mà áp đảo ≥4× độ dài text CJK → vi,
    // kể cả khi stopword hụt ngưỡng (câu trang trọng liệt kê tên riêng).
    if (viDominant && viSubstantial && viText.length >= 4 * senseText.length) return 'vi';
    // Tag <|yue|> = LID đoán mò: qua 2 log field (19-20/08), zh THẬT luôn tag
    // <|zh|>, còn TOÀN BỘ rác-CJK sinh từ speech vi đều tag <|yue|> — nên yue
    // + vi dominant đủ dài là đủ thắng, không cần chờ stopword/asymmetry vốn
    // hay hụt ngưỡng sát nút (0.149 vs 0.15, 3.6× vs 4×). Đánh đổi chấp nhận:
    // tiếng Quảng thật với rác-vi dày dấu sẽ misroute — ngoài tập user mục tiêu.
    if (senseLang.startsWith('yue') && viDominant && viSubstantial) return 'vi';
    return 'sense';
  }

  // Rule 8: neither side shows a signal → bias theo target nếu có, không thì
  // leader.
  if (biasAgainstVi) return 'sense';
  return leader;
}

export function createGateTally(): GateTally {
  return {sense: 0, vi: 0};
}

export function recordWin(tally: GateTally, winner: GateEngine): void {
  tally[winner] += 1;
}

/**
 * Engine currently leading; ties go to sense (wider coverage). Tally KHÔNG
 * còn dùng để khóa engine — bài học field 20/08 11:52: video mở đầu 6 câu vi
 * liền làm early-lock 6-0 destroy SenseVoice, mọi đoạn Anh/Trung sau đó bị ép
 * decode như vi đến hết phiên. Gate giữ dual-decode suốt phiên (giá đo được:
 * final chậm thêm ~0.4-0.6s so với đơn engine); leader chỉ là tie-break và
 * engine hiển thị tạm trong 3s đầu mỗi câu.
 */
export function tallyLeader(tally: GateTally): GateEngine {
  return tally.vi > tally.sense ? 'vi' : 'sense';
}
