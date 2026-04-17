/**
 * Transcript Export Utility
 *
 * Generates a formatted text transcript from session data and opens the
 * system share sheet. Used by SessionReviewScreen.
 */

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
 * Formats a timestamp (ms since epoch) as relative time block label.
 * e.g., "Early in meeting (0-5 min)", "Mid meeting (5-15 min)", etc.
 */
function getTimeBlockLabel(timestamp: number, sessionStart: number): string {
  const elapsedMinutes = Math.floor((timestamp - sessionStart) / 60000);
  if (elapsedMinutes < 5) return 'Opening (0–5 min)';
  if (elapsedMinutes < 15) return 'Early (5–15 min)';
  if (elapsedMinutes < 30) return 'Mid (15–30 min)';
  if (elapsedMinutes < 60) return 'Late (30–60 min)';
  return 'Extended (60+ min)';
}

/**
 * Generates a meeting recap text from transcript data.
 * Groups utterances by speaker and time block to create a narrative summary.
 * No AI analysis - pure transcript-derived content.
 */
export function generateRecapText(
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
  const durationStr = formatDuration(session.startedAt, session.endedAt);
  const finalUtterances = utterances.filter((u) => u.isFinal);

  const lines: string[] = [
    `Meeting Recap — ${dateStr} ${timeStr}`,
    SEPARATOR,
    '',
    `Duration: ${durationStr} | ${finalUtterances.length} utterances`,
    'Generated from transcript on-device',
    '',
  ];

  if (finalUtterances.length === 0) {
    lines.push('No finalized utterances recorded.');
    return lines.join('\n');
  }

  // Group utterances by speaker
  const speakerGroups: Record<string, UtteranceData[]> = {};
  for (const u of finalUtterances) {
    const speaker = u.speakerId ?? 'Unknown';
    if (!speakerGroups[speaker]) speakerGroups[speaker] = [];
    speakerGroups[speaker].push(u);
  }

  // Build recap narrative per speaker
  const speakerLabels = session.speakerLabels ?? {};
  const speakerOrder = Object.keys(speakerGroups);

  for (const speakerId of speakerOrder) {
    const speakerUtterances = speakerGroups[speakerId];
    const label = speakerLabels[speakerId] ?? speakerId;

    lines.push(`• ${label} spoke ${speakerUtterances.length} time(s)`);

    // Get a sample of what they discussed (first substantial utterance)
    const sample = speakerUtterances.find(
      (u) => u.sourceText.trim().length > 20,
    ) ?? speakerUtterances[0];
    if (sample && sample.sourceText.trim() !== sample.translatedText?.trim()) {
      const preview = sample.sourceText.trim().slice(0, 100);
      const suffix = sample.sourceText.trim().length > 100 ? '…' : '';
      lines.push(`  First point: "${preview}${suffix}"`);
    }
  }

  lines.push('');
  lines.push('---');
  lines.push('Key moments:');

  // Extract notable moments (utterances with translations = significant exchanges)
  const significantUtterances = finalUtterances.filter(
    (u) => u.translatedText && u.sourceText.trim().length > 30,
  );

  if (significantUtterances.length === 0) {
    lines.push('  (No translated passages of substantial length)');
  } else {
    // Take up to 3 significant moments spread across the meeting
    const step = Math.max(1, Math.floor(significantUtterances.length / 3));
    for (let i = 0; i < significantUtterances.length && i < 3; i++) {
      const idx = Math.min(i * step, significantUtterances.length - 1);
      const u = significantUtterances[idx];
      const ts = formatTimestamp(u.timestamp);
      const text = u.sourceText.trim().slice(0, 80);
      const suffix = u.sourceText.trim().length > 80 ? '…' : '';
      lines.push(`  [${ts}] ${text}${suffix}`);
    }
  }

  return lines.join('\n');
}

/**
 * Generates structured meeting minutes from transcript data.
 * Organizes content by speaker and time blocks with bullet points.
 * No AI analysis - pure transcript-derived content.
 */
export function generateMinutesText(
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
  const durationStr = formatDuration(session.startedAt, session.endedAt);
  const finalUtterances = utterances.filter((u) => u.isFinal);

  const lines: string[] = [
    `Meeting Minutes — ${dateStr} ${timeStr}`,
    SEPARATOR,
    '',
    `Duration: ${durationStr} | ${finalUtterances.length} utterances`,
    'Generated from transcript on-device',
    '',
  ];

  if (finalUtterances.length === 0) {
    lines.push('No finalized utterances recorded.');
    return lines.join('\n');
  }

  // Group utterances by time block
  type TimeBlock = {
    label: string;
    utterances: UtteranceData[];
  };

  const timeBlocks: TimeBlock[] = [];
  let currentBlock: TimeBlock | null = null;

  for (const u of finalUtterances.sort((a, b) => a.timestamp - b.timestamp)) {
    const blockLabel = getTimeBlockLabel(u.timestamp, session.startedAt);
    if (!currentBlock || currentBlock.label !== blockLabel) {
      currentBlock = {label: blockLabel, utterances: []};
      timeBlocks.push(currentBlock);
    }
    currentBlock.utterances.push(u);
  }

  const speakerLabels = session.speakerLabels ?? {};

  for (const block of timeBlocks) {
    lines.push(`## ${block.label}`);
    lines.push('');

    // Group within block by speaker
    const blockSpeakerGroups: Record<string, UtteranceData[]> = {};
    for (const u of block.utterances) {
      const speaker = u.speakerId ?? 'Unknown';
      if (!blockSpeakerGroups[speaker]) blockSpeakerGroups[speaker] = [];
      blockSpeakerGroups[speaker].push(u);
    }

    for (const [speakerId, speakerUtts] of Object.entries(blockSpeakerGroups)) {
      const label = speakerLabels[speakerId] ?? speakerId;
      lines.push(`### ${label}`);
      for (const u of speakerUtts) {
        const ts = formatTimestamp(u.timestamp);
        const text = u.sourceText.trim();
        lines.push(`- [${ts}] ${text}`);
        if (u.translatedText?.trim()) {
          lines.push(`  → ${u.translatedText.trim()}`);
        }
      }
      lines.push('');
    }
  }

  return lines.join('\n');
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

/**
 * Exports a meeting recap by sharing via the system share sheet.
 */
export async function exportRecap(
  session: SessionData,
  utterances: UtteranceData[],
): Promise<void> {
  const content = generateRecapText(session, utterances);

  await Share.share({
    message: content,
    title: 'Meeting Recap',
  });
}

/**
 * Exports meeting minutes by sharing via the system share sheet.
 */
export async function exportMinutes(
  session: SessionData,
  utterances: UtteranceData[],
): Promise<void> {
  const content = generateMinutesText(session, utterances);

  await Share.share({
    message: content,
    title: 'Meeting Minutes',
  });
}