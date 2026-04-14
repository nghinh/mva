/**
 * Transcript Export Utility
 *
 * Generates a formatted text transcript from session data and opens the
 * system share sheet. Used by SessionReviewScreen.
 */

import * as RNFS from '@dr.pogodin/react-native-fs';
import {Share} from 'react-native';
import {SessionData, UtteranceData} from '../../../services/persistence';

const SEPARATOR = '=============================================';

/**
 * Formats a timestamp (ms since epoch) as HH:MM:SS in 24-hour format.
 */
function formatTimestamp(timestampMs: number): string {
  const date = new Date(timestampMs);
  const hours = date.getHours().toString().padStart(2, '0');
  const minutes = date.getMinutes().toString().padStart(2, '0');
  const seconds = date.getSeconds().toString().padStart(2, '0');
  return `${hours}:${minutes}:${seconds}`;
}

/**
 * Counts utterances by source language.
 */
function countByLanguage(utterances: UtteranceData[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const u of utterances) {
    const lang = u.sourceLanguage.toUpperCase();
    counts[lang] = (counts[lang] ?? 0) + 1;
  }
  return counts;
}

/**
 * Calculates total duration string from session start/end timestamps.
 */
function formatDuration(startedAt: number, endedAt: number | null): string {
  const end = endedAt ?? startedAt;
  const totalMs = Math.max(0, end - startedAt);
  const totalMinutes = Math.max(1, Math.round(totalMs / 60000));
  if (totalMinutes >= 60) {
    const hours = Math.floor(totalMinutes / 60);
    const mins = totalMinutes % 60;
    return `${hours}h ${mins}m`;
  }
  return `${totalMinutes}m`;
}

/**
 * Generates the full transcript text content from session and utterances.
 *
 * Format:
 *   Meeting Voice Assistant - Meeting [date] [time]
 *   ============================================
 *
 *   [HH:MM:SS] [LANG] Original text
 *   → Vietnamese translation
 *
 *   ...
 *
 *   ---
 *   Summary: N utterances | Duration: X | EN N | JA N | ...
 */
export function generateTranscriptText(
  session: SessionData,
  utterances: UtteranceData[],
): string {
  const startDate = new Date(session.startedAt);
  const dateStr = startDate.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
  const timeStr = startDate.toLocaleTimeString('en-US', {
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
  });

  const lines: string[] = [
    `Meeting Voice Assistant - Meeting ${dateStr} ${timeStr}`,
    SEPARATOR,
    '',
  ];

  for (const utterance of utterances) {
    if (!utterance.isFinal) continue; // Only export finalized utterances
    const ts = formatTimestamp(utterance.timestamp);
    const lang = utterance.sourceLanguage.toUpperCase();
    const original = utterance.sourceText.trim();
    const translation = utterance.translatedText?.trim() ?? '';

    lines.push(`[${ts}] [${lang}] ${original}`);
    if (translation) {
      lines.push(`→ ${translation}`);
    }
    lines.push('');
  }

  // Footer summary — counts ALL utterances (including non-final for completeness)
  const langCounts = countByLanguage(utterances);
  const durationStr = formatDuration(session.startedAt, session.endedAt);
  const finalCount = utterances.filter((u) => u.isFinal).length;
  const summaryParts = [
    `${finalCount} finalized utterances`,
    `Duration: ${durationStr}`,
    ...Object.entries(langCounts).map(([lang, count]) => `${lang} ${count}`),
  ];

  lines.push('---');
  lines.push(`Summary: ${summaryParts.join(' | ')}`);

  return lines.join('\n');
}

/**
 * Derives a file name for the transcript:
 * MVA-transcript-YYYY-MM-DD-HHMMSS.txt
 */
function deriveFilename(session: SessionData): string {
  const date = new Date(session.startedAt);
  const year = date.getFullYear();
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const day = date.getDate().toString().padStart(2, '0');
  const hours = date.getHours().toString().padStart(2, '0');
  const minutes = date.getMinutes().toString().padStart(2, '0');
  const seconds = date.getSeconds().toString().padStart(2, '0');
  return `MVA-transcript-${year}-${month}-${day}-${hours}${minutes}${seconds}.txt`;
}

/**
 * Exports a session transcript by sharing the text content via the
 * system share sheet (Share API).
 *
 * Uses message content rather than file attachment for maximum compatibility
 * across iOS and Android.
 *
 * Returns a promise that resolves when the share sheet is triggered.
 * Rejects if sharing is unavailable.
 */
export async function exportTranscript(
  session: SessionData,
  utterances: UtteranceData[],
): Promise<void> {
  const content = generateTranscriptText(session, utterances);

  await Share.share({
    message: content,
    title: 'Meeting Transcript',
  });
}