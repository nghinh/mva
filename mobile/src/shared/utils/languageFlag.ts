/**
 * Flag for a source-language code.
 *
 * This used to exist as three near-identical copies — TranscriptLane,
 * MeetingStatusBar and HistoryListScreen — with two different casing
 * conventions between them. Two of the three were never updated when the
 * Vietnamese engine was added, so Vietnamese utterances rendered the 🌐
 * fallback even though the pipeline had transcribed them correctly.
 *
 * Keep this the only copy. `SourceLanguage` in shared/types is the set it
 * must cover.
 */
const FLAGS: Record<string, string> = {
  en: '🇬🇧',
  ja: '🇯🇵',
  ko: '🇰🇷',
  zh: '🇨🇳',
  vi: '🇻🇳',
};

/** Globe means "we do not recognise this code" — never "Vietnamese". */
export const UNKNOWN_LANGUAGE_FLAG = '🌐';

export function getLanguageFlag(language: string | null | undefined): string {
  if (!language) {
    return UNKNOWN_LANGUAGE_FLAG;
  }
  return FLAGS[language.toLowerCase()] ?? UNKNOWN_LANGUAGE_FLAG;
}
