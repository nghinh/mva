/**
 * Meeting Recap Service
 *
 * Deterministic on-device derivation of meeting recap, summary, minutes,
 * statistics, and key moments from session utterances.
 *
 * NO AI / NO CLOUD / NO LLM — all heuristics are rule-based and deterministic.
 *
 * Heuristics used:
 * - Longest utterances  → likely substantive contributions or explanations
 * - Final utterances     → recent discussion before meeting ended
 * - Repeated keywords   → topics of recurring importance
 * - Speaker balance      → language + utterance-count distribution per speaker
 * - Language split       → EN/JA/KO utterance counts
 *
 * The output is practical and explainable: each highlight is labeled with
 * the deterministic rule that selected it.
 */

import type {SessionData, UtteranceData} from '../../../services/persistence';

// ============================================================================
// Output Types
// ============================================================================

/** Speaker-level statistics */
export interface SpeakerStats {
  speakerId: string;
  speakerLabel: string;
  utteranceCount: number;
  totalCharacters: number;
  languages: Record<string, number>; // lang code → count
  avgUtteranceLength: number;       // characters
}

/** Language-level statistics */
export interface LanguageStats {
  languageCode: string;
  utteranceCount: number;
  totalCharacters: number;
  percentage: number; // 0–100
}

/** A "key moment" is a deterministic highlight with an explainable label. */
export interface KeyMoment {
  /** One of the MOMENT_TYPE_* constants below */
  type: string;
  /** Human-readable explanation of why this was selected */
  reason: string;
  utterance: UtteranceData;
  /** Optional sortable score (higher = more "prominent" by that moment type) */
  score?: number;
}

/** Main recap output */
export interface MeetingRecap {
  /** Session metadata */
  sessionId: string;
  startedAt: number;
  endedAt: number | null;
  durationMs: number;
  durationLabel: string;           // e.g. "12m" or "1h 5m"
  dateLabel: string;               // e.g. "Apr 15, 2026"

  /** Overview summary — one descriptive paragraph, no AI reasoning */
  overviewSummary: string;

  /** Structured meeting minutes, ordered by time */
  minutes: string[];

  /** Per-speaker breakdown */
  speakers: SpeakerStats[];

  /** Language distribution */
  languages: LanguageStats[];

  /** Deterministic key moments */
  keyMoments: KeyMoment[];

  /** Overall word-count / character-count */
  totalUtterances: number;
  finalUtterances: number;
  totalCharacters: number;
}

// ============================================================================
// Moment Type Constants
// ============================================================================

export const MOMENT_TYPE_LONGEST = 'longest_utterance';
export const MOMENT_TYPE_FINAL    = 'final_utterance';
export const MOMENT_TYPE_REPEATED_KEYWORD = 'repeated_keyword';
export const MOMENT_TYPE_LANGUAGE_SWITCH  = 'language_switch';
export const MOMENT_TYPE_FIRST_UTTERANCE  = 'first_utterance';

// ============================================================================
// Internal Utilities
// ============================================================================

/** Returns a label suitable for display for a speaker ID. */
function deriveSpeakerLabel(speakerId: string | null | undefined, fallbackIndex: number): string {
  if (speakerId && speakerId.trim()) return speakerId;
  return `Speaker ${fallbackIndex + 1}`;
}

/** Formats milliseconds as "Xm" or "Xh Ym". */
function formatDuration(ms: number): string {
  const totalMinutes = Math.max(1, Math.round(ms / 60000));
  if (totalMinutes >= 60) {
    const h = Math.floor(totalMinutes / 60);
    const m = totalMinutes % 60;
    return m > 0 ? `${h}h ${m}m` : `${h}h`;
  }
  return `${totalMinutes}m`;
}

/** Formats a timestamp as HH:MM:SS */
function formatTimestamp(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const hours   = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}

/** Normalizes language codes to our canonical set. */
function canonicalLanguage(lang: string): string {
  const upper = lang.toUpperCase();
  if (upper === 'ENGLISH' || upper === 'EN') return 'EN';
  if (upper === 'JAPANESE' || upper === 'JA') return 'JA';
  if (upper === 'KOREAN'   || upper === 'KO') return 'KO';
  if (upper === 'CHINESE'  || upper === 'ZH') return 'ZH';
  return upper.slice(0, 2);
}

/**
 * Extracts significant words (length >= 4, lowercase) from text,
 * filtering out common stop-words.
 */
function extractKeywords(text: string): string[] {
  const STOP_WORDS = new Set([
    'the','this','that','with','from','have','has','been','were','was',
    'are','but','not','you','your','for','and','into','what','when',
    'where','which','their','there','will','would','could','should',
    'about','also','more','some','them','they','just','like','than',
    'then','only','over','after','before','between','each','other',
    'such','any','all','can','its','it','very','one','two','three',
  ]);
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length >= 4 && !STOP_WORDS.has(w));
}

// Internal counter for anonymous speakers — incremented only when first anonymous utterance is encountered
let _anonCounter = 0;

/** Merges keyword counts across all texts, returning top N by frequency. */
function topKeywords(texts: string[], topN = 5): Array<{word: string; count: number}> {
  const freq: Record<string, number> = {};
  for (const text of texts) {
    for (const kw of extractKeywords(text)) {
      freq[kw] = (freq[kw] ?? 0) + 1;
    }
  }
  return Object.entries(freq)
    .filter(([, count]) => count >= 2) // must appear at least twice
    .sort((a, b) => b[1] - a[1])
    .slice(0, topN)
    .map(([word, count]) => ({word, count}));
}

// ============================================================================
// Core Derivation Functions
// ============================================================================

/**
 * Computes per-speaker statistics from a list of finalized utterances.
 */
function deriveSpeakerStats(utterances: UtteranceData[]): SpeakerStats[] {
  const speakerMap = new Map<string, {
    speakerId: string;
    speakerLabel: string;
    utteranceCount: number;
    totalChars: number;
    languages: Record<string, number>;
  }>();

  for (const u of utterances) {
    if (!u.isFinal) continue;
    const id = u.speakerId ?? '__anon__';
    if (!speakerMap.has(id)) {
      speakerMap.set(id, {
        speakerId: id,
        speakerLabel: deriveSpeakerLabel(u.speakerId, speakerMap.size),
        utteranceCount: 0,
        totalChars: 0,
        languages: {},
      });
    }
    const s = speakerMap.get(id)!;
    s.utteranceCount++;
    s.totalChars += u.sourceText.length;
    const lang = canonicalLanguage(u.sourceLanguage);
    s.languages[lang] = (s.languages[lang] ?? 0) + 1;
    // Update label if we get a better one from utterances
    if (u.speakerLabel) {
      s.speakerLabel = u.speakerLabel;
    }
  }

  return Array.from(speakerMap.values()).map((s) => ({
    speakerId: s.speakerId,
    speakerLabel: s.speakerLabel,
    utteranceCount: s.utteranceCount,
    totalCharacters: s.totalChars,
    languages: s.languages,
    avgUtteranceLength: Math.round(s.totalChars / Math.max(1, s.utteranceCount)),
  }));
}

/**
 * Computes language-level statistics from utterances.
 */
function deriveLanguageStats(utterances: UtteranceData[]): LanguageStats[] {
  const final = utterances.filter((u) => u.isFinal);
  if (final.length === 0) return [];

  const langMap: Record<string, {count: number; chars: number}> = {};
  for (const u of final) {
    const lang = canonicalLanguage(u.sourceLanguage);
    if (!langMap[lang]) langMap[lang] = {count: 0, chars: 0};
    langMap[lang].count++;
    langMap[lang].chars += u.sourceText.length;
  }

  return Object.entries(langMap)
    .map(([languageCode, data]) => ({
      languageCode,
      utteranceCount: data.count,
      totalCharacters: data.chars,
      percentage: Math.round((data.count / final.length) * 100),
    }))
    .sort((a, b) => b.utteranceCount - a.utteranceCount);
}

/**
 * Builds the overview summary paragraph.
 * Deterministic: based on duration, totals, speaker count, top language,
 * top keyword (if any), and closing statement.
 */
function buildOverviewSummary(recap: Pick<MeetingRecap, 'durationLabel' | 'totalUtterances' | 'finalUtterances' | 'languages' | 'speakers' | 'dateLabel'>): string {
  const topLang = recap.languages[0];
  const topLangLabel = topLang ? topLang.languageCode : 'mixed';
  const speakerDescs = recap.speakers.map((s) => {
    const langKeys = Object.keys(s.languages);
    const langStr = langKeys.length > 1 ? ` (multi-language: ${langKeys.join('/')})` : ` (${langKeys[0] ?? 'EN'})`;
    return `${s.speakerLabel}${langStr}: ${s.utteranceCount} utterances`;
  });

  const langSummary = recap.languages
    .map((l) => `${l.languageCode} ${l.percentage}%`)
    .join(', ');

  const summaryParts: string[] = [
    `Meeting on ${recap.dateLabel} lasted ${recap.durationLabel} ` +
      `and produced ${recap.finalUtterances} finalized utterances ` +
      `(${langSummary} split).`,
  ];

  if (recap.speakers.length === 1) {
    summaryParts.push(
      `Single participant ${recap.speakers[0].speakerLabel} contributed all ${recap.speakers[0].utteranceCount} utterances.`,
    );
  } else if (recap.speakers.length > 1) {
    summaryParts.push(
      `${recap.speakers.length} participants: ${speakerDescs.join('; ')}.`,
    );
  }

  if (topLang) {
    summaryParts.push(
      `Primary language detected: ${topLangLabel} (${topLang.percentage}% of utterances).`,
    );
  }

  return summaryParts.join(' ');
}

/**
 * Builds structured meeting minutes: one line per finalized utterance,
 * grouped in natural blocks separated by language/speaker changes.
 */
function buildMinutes(utterances: UtteranceData[]): string[] {
  const lines: string[] = [];
  const final = [...utterances].filter((u) => u.isFinal).sort((a, b) => a.timestamp - b.timestamp);

  let lastSpeaker: string | null = null;
  let lastLang: string | null = null;

  for (const u of final) {
    const speaker = u.speakerLabel ?? u.speakerId ?? null;
    const lang   = canonicalLanguage(u.sourceLanguage);

    // Add a separator header on speaker or language change
    if (speaker !== lastSpeaker || lang !== lastLang) {
      if (lines.length > 0) lines.push('');
      const speakerDesc = speaker ?? 'Unknown speaker';
      const langDesc    = lang !== 'EN' && lang !== 'JA' && lang !== 'KO' && lang !== 'ZH' ? '' : `[${lang}] `;
      lines.push(`── ${langDesc}${speakerDesc} ──`);
      lastSpeaker = speaker;
      lastLang     = lang;
    }

    const ts = formatTimestamp(u.timestamp - (final[0]?.timestamp ?? 0)); // relative time
    const text = u.sourceText.trim();
    const translation = u.translatedText?.trim();

    lines.push(`[${ts}] ${text}`);
    if (translation) {
      lines.push(`    → ${translation}`);
    }
  }

  return lines;
}

/**
 * Extracts deterministic key moments from the utterances.
 *
 * Rules applied (in order of precedence):
 * 1. FIRST_UTTERANCE   — first finalized utterance
 * 2. LONGEST           — top 3 longest by character count
 * 3. FINAL             — last 3 finalized utterances
 * 4. LANGUAGE_SWITCH   — utterances where sourceLanguage differs from previous
 * 5. REPEATED_KEYWORD  — utterances containing a keyword that appears multiple times
 */
function deriveKeyMoments(utterances: UtteranceData[]): KeyMoment[] {
  const final = [...utterances].filter((u) => u.isFinal).sort((a, b) => a.timestamp - b.timestamp);
  if (final.length === 0) return [];

  const moments: KeyMoment[] = [];
  const seenTypes = new Set<string>();

  // ── 1. First utterance ──────────────────────────────────────────────────
  {
    const u = final[0];
    const key = MOMENT_TYPE_FIRST_UTTERANCE;
    moments.push({
      type: key,
      reason: `First utterance of the meeting (${formatTimestamp(u.timestamp - (final[0]?.timestamp ?? 0))} elapsed)`,
      utterance: u,
      score: 100,
    });
    seenTypes.add(`${key}:${u.id}`);
  }

  // ── 2. Longest utterances (top 3) ──────────────────────────────────────
  const sortedByLen = [...final]
    .sort((a, b) => b.sourceText.length - a.sourceText.length);
  let longestCount = 0;
  for (const u of sortedByLen) {
    if (longestCount >= 3) break;
    const key = `${MOMENT_TYPE_LONGEST}:${u.id}`;
    if (seenTypes.has(key)) continue;
    moments.push({
      type: MOMENT_TYPE_LONGEST,
      reason: `Longest utterance in the meeting (${u.sourceText.length} characters, ${formatTimestamp(u.timestamp - (final[0]?.timestamp ?? 0))} elapsed)`,
      utterance: u,
      score: u.sourceText.length,
    });
    seenTypes.add(key);
    longestCount++;
  }

  // ── 3. Final utterances (last 3) ───────────────────────────────────────
  let finalCount = 0;
  for (let i = final.length - 1; i >= 0; i--) {
    if (finalCount >= 3) break;
    const u = final[i];
    const key = `${MOMENT_TYPE_FINAL}:${u.id}`;
    if (seenTypes.has(key)) continue;
    moments.push({
      type: MOMENT_TYPE_FINAL,
      reason: `Final utterance near end of meeting (${formatTimestamp(u.timestamp - (final[0]?.timestamp ?? 0))} elapsed)`,
      utterance: u,
      score: final.length - i,
    });
    seenTypes.add(key);
    finalCount++;
  }

  // ── 4. Language switches ───────────────────────────────────────────────
  let switchCount = 0;
  for (let i = 1; i < final.length; i++) {
    if (switchCount >= 3) break;
    const prev = canonicalLanguage(final[i - 1].sourceLanguage);
    const curr = canonicalLanguage(final[i].sourceLanguage);
    if (prev !== curr) {
      const key = `${MOMENT_TYPE_LANGUAGE_SWITCH}:${final[i].id}`;
      if (seenTypes.has(key)) continue;
      moments.push({
        type: MOMENT_TYPE_LANGUAGE_SWITCH,
        reason: `Language switched from ${prev} to ${curr} (${formatTimestamp(final[i].timestamp - (final[0]?.timestamp ?? 0))} elapsed)`,
        utterance: final[i],
        score: i,
      });
      seenTypes.add(key);
      switchCount++;
    }
  }

  // ── 5. Repeated keywords ───────────────────────────────────────────────
  const texts = final.map((u) => u.sourceText);
  const keywords = topKeywords(texts, 3);
  let kwCount = 0;
  for (const {word} of keywords) {
    if (kwCount >= 2) break;
    for (const u of final) {
      const key = `${MOMENT_TYPE_REPEATED_KEYWORD}:${word}:${u.id}`;
      if (seenTypes.has(key)) continue;
      if (extractKeywords(u.sourceText).includes(word)) {
        moments.push({
          type: MOMENT_TYPE_REPEATED_KEYWORD,
          reason: `Contains keyword "${word}" that recurred across multiple utterances`,
          utterance: u,
          score: keywords.find((k) => k.word === word)?.count ?? 0,
        });
        seenTypes.add(key);
        kwCount++;
        break; // one utterance per keyword
      }
    }
  }

  // Sort moments by their timestamp in the meeting
  const baseTs = final[0]?.timestamp ?? 0;
  return moments.sort((a, b) => (a.utterance.timestamp - baseTs) - (b.utterance.timestamp - baseTs));
}

// ============================================================================
// Main Service
// ============================================================================

/**
 * Computes a full deterministic meeting recap from session + utterances.
 *
 * @param session  - The session metadata
 * @param utterances - All utterances (final and partial); only final ones are used for stats/minutes
 */
export function computeMeetingRecap(
  session: SessionData,
  utterances: UtteranceData[],
): MeetingRecap {
  const finalUtterances = utterances.filter((u) => u.isFinal);
  const endMs   = session.endedAt ?? session.startedAt;
  const durationMs = Math.max(0, endMs - session.startedAt);

  const dateLabel = new Date(session.startedAt).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  const speakers = deriveSpeakerStats(utterances);
  const languages = deriveLanguageStats(utterances);

  const recap: Pick<MeetingRecap, Exclude<keyof MeetingRecap, 'overviewSummary' | 'minutes' | 'keyMoments'>> = {
    sessionId: session.id,
    startedAt: session.startedAt,
    endedAt: session.endedAt,
    durationMs,
    durationLabel: formatDuration(durationMs),
    dateLabel,
    speakers,
    languages,
    totalUtterances: utterances.length,
    finalUtterances: finalUtterances.length,
    totalCharacters: finalUtterances.reduce((sum, u) => sum + u.sourceText.length, 0),
  };

  const overviewSummary = buildOverviewSummary(recap);
  const minutes         = buildMinutes(utterances);
  const keyMoments      = deriveKeyMoments(utterances);

  return {
    ...recap,
    overviewSummary,
    minutes,
    keyMoments,
  };
}

/**
 * Returns the highlight label and emoji for a moment type.
 */
export function getMomentTypeLabel(type: string): {label: string; emoji: string} {
  switch (type) {
    case MOMENT_TYPE_LONGEST:          return {label: 'Longest Utterance',         emoji: '📝'};
    case MOMENT_TYPE_FINAL:            return {label: 'Closing Statement',          emoji: '🔚'};
    case MOMENT_TYPE_REPEATED_KEYWORD: return {label: 'Key Topic Mention',          emoji: '🔁'};
    case MOMENT_TYPE_LANGUAGE_SWITCH:  return {label: 'Language Switch',            emoji: '🔤'};
    case MOMENT_TYPE_FIRST_UTTERANCE:  return {label: 'Meeting Opening',            emoji: '🏁'};
    default:                            return {label: 'Notable Moment',            emoji: '💬'};
  }
}
