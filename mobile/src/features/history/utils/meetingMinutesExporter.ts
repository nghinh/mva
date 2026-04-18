/**
 * Meeting Minutes Exporter
 *
 * Generates export-friendly formatted text for meeting recap and minutes,
 * in addition to raw transcript export.
 *
 * NO AI / NO CLOUD / NO LLM — all formatting is rule-based.
 *
 * Export formats supported:
 *  - `full`     — Complete recap with overview, minutes, stats, key moments
 *  - `minutes`  — Just the structured meeting minutes
 *  - `summary`  — Overview + stats only (no minute-by-minute)
 *  - `highlights` — Key moments section only
 */

import {Share} from 'react-native';
import type {MeetingRecap, KeyMoment} from './meetingRecapService';
import {getMomentTypeLabel} from './meetingRecapService';
import type {SessionData, UtteranceData} from '../../../services/persistence';
import {computeMeetingRecap} from './meetingRecapService';

export type ExportFormat = 'full' | 'minutes' | 'summary' | 'highlights';

// ============================================================================
// Formatting Utilities
// ============================================================================

const SEPARATOR = '=============================================';

function sectionHeader(title: string): string {
  return `${SEPARATOR}\n  ${title.toUpperCase()}\n${SEPARATOR}`;
}

function blank(): string {
  return '';
}

function bullet(label: string, value?: string): string {
  return value ? `  • ${label}: ${value}` : `  • ${label}`;
}

function kv(label: string, value: string): string {
  return `  ${label}: ${value}`;
}

/** Formats relative timestamp (ms since first utterance) as HH:MM:SS */
function relativeTimestamp(baseMs: number, ts: number): string {
  const diff = Math.max(0, ts - baseMs);
  const totalSeconds = Math.floor(diff / 1000);
  const hours   = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}

// ============================================================================
// Section Renderers
// ============================================================================

function renderOverview(recap: MeetingRecap): string {
  return [
    sectionHeader('Meeting Overview'),
    blank(),
    kv('Date', recap.dateLabel),
    kv('Duration', recap.durationLabel),
    kv('Total Utterances', String(recap.finalUtterances)),
    kv('Total Characters', String(recap.totalCharacters)),
    blank(),
    '  Summary:',
    `  ${recap.overviewSummary}`,
    blank(),
  ].join('\n');
}

function renderLanguageStats(recap: MeetingRecap): string {
  const lines = [
    sectionHeader('Language Distribution'),
    blank(),
  ];
  for (const lang of recap.languages) {
    lines.push(bullet(`${lang.languageCode}`, `${lang.utteranceCount} utterances (${lang.percentage}%)`));
  }
  lines.push(blank());
  return lines.join('\n');
}

function renderSpeakerStats(recap: MeetingRecap): string {
  if (recap.speakers.length === 0) return '';

  const lines = [
    sectionHeader('Speaker Statistics'),
    blank(),
  ];
  for (const sp of recap.speakers) {
    const langs = Object.entries(sp.languages).map(([l, c]) => `${l}×${c}`).join(', ');
    lines.push(bullet(sp.speakerLabel));
    lines.push(`    Utterances: ${sp.utteranceCount} | Avg length: ${sp.avgUtteranceLength} chars | Languages: ${langs}`);
    lines.push(blank());
  }
  return lines.join('\n');
}

function renderMinutes(recap: MeetingRecap): string {
  if (recap.minutes.length === 0) {
    return [sectionHeader('Meeting Minutes'), blank(), '  (no finalized utterances)'].join('\n');
  }
  const lines = [
    sectionHeader('Meeting Minutes'),
    blank(),
    '  Timestamps are relative to meeting start.',
    blank(),
    ...recap.minutes,
    blank(),
  ];
  return lines.join('\n');
}

function renderKeyMoment(moment: KeyMoment, baseMs: number): string {
  const {label, emoji} = getMomentTypeLabel(moment.type);
  const relTs = relativeTimestamp(baseMs, moment.utterance.timestamp);
  const speaker = moment.utterance.speakerLabel ?? moment.utterance.speakerId ?? 'Unknown';
  const lines: string[] = [
    `${emoji} [${relTs}] ${label}`,
    `  Reason: ${moment.reason}`,
    `  Speaker: ${speaker}`,
    `  "${moment.utterance.sourceText.trim()}"`,
  ];
  if (moment.utterance.translatedText) {
    lines.push(`  → "${moment.utterance.translatedText.trim()}"`);
  }
  return lines.join('\n');
}

function renderKeyMoments(recap: MeetingRecap): string {
  if (recap.keyMoments.length === 0) {
    return [sectionHeader('Key Moments'), blank(), '  (no key moments detected)'].join('\n');
  }

  const baseMs = recap.startedAt;
  const lines = [
    sectionHeader('Key Moments'),
    blank(),
    '  Deterministic selection criteria: longest utterances, final statements,',
    '  language switches, repeated keywords, and meeting opening.',
    blank(),
  ];

  for (const moment of recap.keyMoments) {
    lines.push(renderKeyMoment(moment, baseMs));
    lines.push(blank());
  }

  return lines.join('\n');
}

function renderTranscriptCompact(session: SessionData, utterances: UtteranceData[]): string {
  const final = [...utterances].filter((u) => u.isFinal).sort((a, b) => a.timestamp - b.timestamp);
  if (final.length === 0) return '';

  const lines = [
    sectionHeader('Full Transcript'),
    blank(),
  ];

  for (const u of final) {
    const relTs = relativeTimestamp(final[0].timestamp, u.timestamp);
    const speaker = u.speakerLabel ?? u.speakerId ?? '';
    const speakerTag = speaker ? `[${speaker}] ` : '';
    const lang = u.sourceLanguage.toUpperCase().slice(0, 2);
    lines.push(`[${relTs}] ${speakerTag}[${lang}] ${u.sourceText.trim()}`);
    if (u.translatedText) {
      lines.push(`  → ${u.translatedText.trim()}`);
    }
  }

  lines.push(blank());
  return lines.join('\n');
}

// ============================================================================
// Main Export Functions
// ============================================================================

/**
 * Generates the export title banner.
 */
function renderBanner(session: SessionData): string {
  const date = new Date(session.startedAt).toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
  const time = new Date(session.startedAt).toLocaleTimeString('en-US', {
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
  });
  return [
    blank(),
    '🏢 Meeting Voice Assistant — Meeting Recap',
    `📅 ${date} at ${time}`,
    blank(),
    'Generated on-device | No AI analysis | Deterministic heuristics',
    blank(),
  ].join('\n');
}

/**
 * Computes recap and generates the full exportable text for a given format.
 *
 * @param session    - Session metadata
 * @param utterances - All utterances
 * @param format     - Which section to export
 */
export function generateMeetingExportText(
  session: SessionData,
  utterances: UtteranceData[],
  format: ExportFormat,
): string {
  const recap = computeMeetingRecap(session, utterances);

  switch (format) {
    case 'full':
      return [
        renderBanner(session),
        renderOverview(recap),
        renderLanguageStats(recap),
        renderSpeakerStats(recap),
        renderMinutes(recap),
        renderKeyMoments(recap),
        renderTranscriptCompact(session, utterances),
        blank(),
        SEPARATOR,
        'END OF REPORT',
        SEPARATOR,
      ].join('\n');

    case 'minutes':
      return [
        renderBanner(session),
        renderMinutes(recap),
        blank(),
        SEPARATOR,
        'END OF MINUTES',
        SEPARATOR,
      ].join('\n');

    case 'summary':
      return [
        renderBanner(session),
        renderOverview(recap),
        renderLanguageStats(recap),
        renderSpeakerStats(recap),
        renderKeyMoments(recap),
        blank(),
        SEPARATOR,
        'END OF SUMMARY',
        SEPARATOR,
      ].join('\n');

    case 'highlights':
      return [
        renderBanner(session),
        renderKeyMoments(recap),
        blank(),
        SEPARATOR,
        'END OF HIGHLIGHTS',
        SEPARATOR,
      ].join('\n');

    default:
      return generateMeetingExportText(session, utterances, 'full');
  }
}

/**
 * Returns a suggested filename for a given export format.
 */
export function deriveExportFilename(session: SessionData, format: ExportFormat): string {
  const date = new Date(session.startedAt);
  const yyyy  = date.getFullYear();
  const mm    = (date.getMonth() + 1).toString().padStart(2, '0');
  const dd   = date.getDate().toString().padStart(2, '0');
  const hhhh = date.getHours().toString().padStart(2, '0');
  const min  = date.getMinutes().toString().padStart(2, '0');

  const suffix = format === 'full' ? '' : `-${format}`;
  return `MVA-recap${suffix}-${yyyy}-${mm}-${dd}-${hhhh}${min}.txt`;
}

/**
 * Shares the meeting export via the system share sheet.
 *
 * Uses message content rather than file attachment for maximum compatibility.
 */
export async function shareMeetingExport(
  session: SessionData,
  utterances: UtteranceData[],
  format: ExportFormat = 'full',
): Promise<void> {
  const content = generateMeetingExportText(session, utterances, format);
  const filename = deriveExportFilename(session, format);

  await Share.share(
    {
      message: content,
      title: filename.replace('.txt', ''),
    },
  );
}
