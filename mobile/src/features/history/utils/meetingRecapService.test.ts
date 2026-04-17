/**
 * Unit tests for meetingRecapService
 *
 * Tests the deterministic heuristics: speaker stats, language stats,
 * overview summary, minutes building, and key moment extraction.
 */

import {
  computeMeetingRecap,
  getMomentTypeLabel,
  MOMENT_TYPE_LONGEST,
  MOMENT_TYPE_FINAL,
  MOMENT_TYPE_FIRST_UTTERANCE,
  MOMENT_TYPE_LANGUAGE_SWITCH,
  MOMENT_TYPE_REPEATED_KEYWORD,
} from './meetingRecapService';
import type {SessionData, UtteranceData} from '../../../services/persistence';

// ============================================================================
// Test Fixtures
// ============================================================================

function makeSession(overrides: Partial<SessionData> = {}): SessionData {
  return {
    id: 'session-test-001',
    startedAt: Date.parse('2026-04-15T10:00:00Z'),
    endedAt: Date.parse('2026-04-15T10:30:00Z'),
    sourceLanguage: 'EN',
    targetLanguage: 'VI',
    status: 'complete',
    speakerCount: 2,
    speakerLabels: {S1: 'Alice', S2: 'Bob'},
    ...overrides,
  };
}

function makeUtterance(overrides: Partial<UtteranceData> & {timestamp: number; sourceText: string}): UtteranceData {
  return {
    id: `u-${Math.random().toString(36).slice(2)}`,
    sessionId: 'session-test-001',
    isFinal: true,
    sourceLanguage: 'EN',
    translatedText: null,
    speakerId: 'S1',
    speakerLabel: 'Alice',
    ...overrides,
  };
}

// ============================================================================
// Tests
// ============================================================================

describe('meetingRecapService', () => {

  // --------------------------------------------------------------------------
  // Speaker Statistics
  // --------------------------------------------------------------------------

  describe('deriveSpeakerStats', () => {
    it('counts utterances and characters per speaker', () => {
      const session = makeSession();
      const utterances: UtteranceData[] = [
        makeUtterance({timestamp: 1000, sourceText: 'Hello world', speakerId: 'S1', speakerLabel: 'Alice'}),
        makeUtterance({timestamp: 2000, sourceText: 'Goodbye',     speakerId: 'S2', speakerLabel: 'Bob'}),
        makeUtterance({timestamp: 3000, sourceText: 'Hello again',  speakerId: 'S1', speakerLabel: 'Alice'}),
        makeUtterance({timestamp: 4000, sourceText: 'Fine thanks',  speakerId: 'S2', speakerLabel: 'Bob'}),
      ];

      const recap = computeMeetingRecap(session, utterances);

      expect(recap.speakers).toHaveLength(2);

      const alice = recap.speakers.find((s) => s.speakerId === 'S1')!;
      expect(alice.utteranceCount).toBe(2);
      expect(alice.totalCharacters).toBe('Hello world'.length + 'Hello again'.length);
      expect(alice.avgUtteranceLength).toBe(Math.round(alice.totalCharacters / 2));

      const bob = recap.speakers.find((s) => s.speakerId === 'S2')!;
      expect(bob.utteranceCount).toBe(2);
      expect(bob.totalCharacters).toBe('Goodbye'.length + 'Fine thanks'.length);
    });

    it('tracks language breakdown per speaker', () => {
      const session = makeSession();
      const utterances: UtteranceData[] = [
        makeUtterance({timestamp: 1000, sourceText: 'Hello', sourceLanguage: 'EN', speakerId: 'S1', speakerLabel: 'Alice'}),
        makeUtterance({timestamp: 2000, sourceText: 'Konnichiwa', sourceLanguage: 'JA', speakerId: 'S1', speakerLabel: 'Alice'}),
        makeUtterance({timestamp: 3000, sourceText: 'Annyeong', sourceLanguage: 'KO', speakerId: 'S2', speakerLabel: 'Bob'}),
      ];

      const recap = computeMeetingRecap(session, utterances);

      const alice = recap.speakers.find((s) => s.speakerId === 'S1')!;
      expect(alice.languages['EN']).toBe(1);
      expect(alice.languages['JA']).toBe(1);
      expect(Object.keys(alice.languages)).toHaveLength(2);

      const bob = recap.speakers.find((s) => s.speakerId === 'S2')!;
      expect(bob.languages['KO']).toBe(1);
    });

    it('uses Anonymous speaker label when speakerId is absent', () => {
      const session = makeSession();
      const utterances: UtteranceData[] = [
        makeUtterance({timestamp: 1000, sourceText: 'Hello', speakerId: null, speakerLabel: null}),
        makeUtterance({timestamp: 2000, sourceText: 'World',  speakerId: null, speakerLabel: null}),
      ];

      const recap = computeMeetingRecap(session, utterances);

      expect(recap.speakers).toHaveLength(1);
      expect(recap.speakers[0].speakerLabel).toMatch(/^Speaker \d+$/);
    });

    it('ignores non-final utterances for stats', () => {
      const session = makeSession();
      const utterances: UtteranceData[] = [
        makeUtterance({timestamp: 1000, sourceText: 'Final',  isFinal: true}),
        makeUtterance({timestamp: 2000, sourceText: 'Partial', isFinal: false}),
      ];

      const recap = computeMeetingRecap(session, utterances);

      expect(recap.finalUtterances).toBe(1);
      expect(recap.speakers[0].utteranceCount).toBe(1);
      expect(recap.speakers[0].totalCharacters).toBe('Final'.length);
    });
  });

  // --------------------------------------------------------------------------
  // Language Statistics
  // --------------------------------------------------------------------------

  describe('deriveLanguageStats', () => {
    it('computes percentage distribution', () => {
      const session = makeSession();
      const utterances: UtteranceData[] = [
        makeUtterance({timestamp: 1000, sourceText: 'a', sourceLanguage: 'EN'}),
        makeUtterance({timestamp: 2000, sourceText: 'b', sourceLanguage: 'EN'}),
        makeUtterance({timestamp: 3000, sourceText: 'c', sourceLanguage: 'JA'}),
      ];

      const recap = computeMeetingRecap(session, utterances);

      expect(recap.languages).toHaveLength(2);
      const en = recap.languages.find((l) => l.languageCode === 'EN')!;
      expect(en.percentage).toBe(67); // 2/3 ≈ 67%
      expect(en.utteranceCount).toBe(2);

      const ja = recap.languages.find((l) => l.languageCode === 'JA')!;
      expect(ja.percentage).toBe(33);
    });

    it('normalizes various language code formats', () => {
      const session = makeSession();
      const utterances: UtteranceData[] = [
        makeUtterance({timestamp: 1000, sourceText: 'a', sourceLanguage: 'english'}),
        makeUtterance({timestamp: 2000, sourceText: 'b', sourceLanguage: 'Japanese'}),
        makeUtterance({timestamp: 3000, sourceText: 'c', sourceLanguage: 'korean'}),
      ];

      const recap = computeMeetingRecap(session, utterances);

      const codes = recap.languages.map((l) => l.languageCode).sort();
      expect(codes).toEqual(['EN', 'JA', 'KO']);
    });

    it('returns empty array when no final utterances', () => {
      const session = makeSession();
      const utterances: UtteranceData[] = [
        makeUtterance({timestamp: 1000, sourceText: 'partial', isFinal: false}),
      ];

      const recap = computeMeetingRecap(session, utterances);
      expect(recap.languages).toHaveLength(0);
    });
  });

  // --------------------------------------------------------------------------
  // Overview Summary
  // --------------------------------------------------------------------------

  describe('overviewSummary', () => {
    it('mentions date, duration, utterance count, and language split', () => {
      const session = makeSession();
      const utterances: UtteranceData[] = [
        makeUtterance({timestamp: 1000, sourceText: 'Hello world'}),
        makeUtterance({timestamp: 2000, sourceText: 'Bonjour monde', sourceLanguage: 'FR'}),
      ];

      const recap = computeMeetingRecap(session, utterances);

      expect(recap.overviewSummary).toContain('Apr 15, 2026');
      expect(recap.overviewSummary).toContain('30m');
      expect(recap.overviewSummary).toContain('2'); // utterances
      expect(recap.overviewSummary).toMatch(/EN.*JA|EN.*FR/); // language split
    });

    it('handles single participant description', () => {
      const session = makeSession();
      const utterances: UtteranceData[] = [
        makeUtterance({timestamp: 1000, sourceText: 'Only me'}),
      ];

      const recap = computeMeetingRecap(session, utterances);
      expect(recap.overviewSummary).toContain('Single participant');
    });

    it('handles multiple participants description', () => {
      const session = makeSession();
      const utterances: UtteranceData[] = [
        makeUtterance({timestamp: 1000, sourceText: 'From Alice', speakerId: 'S1', speakerLabel: 'Alice'}),
        makeUtterance({timestamp: 2000, sourceText: 'From Bob',   speakerId: 'S2', speakerLabel: 'Bob'}),
      ];

      const recap = computeMeetingRecap(session, utterances);
      expect(recap.overviewSummary).toContain('2 participants');
      expect(recap.overviewSummary).toContain('Alice');
      expect(recap.overviewSummary).toContain('Bob');
    });
  });

  // --------------------------------------------------------------------------
  // Meeting Minutes
  // --------------------------------------------------------------------------

  describe('minutes', () => {
    it('orders utterances by timestamp', () => {
      const session = makeSession();
      const utterances: UtteranceData[] = [
        makeUtterance({timestamp: 3000, sourceText: 'Third'}),
        makeUtterance({timestamp: 1000, sourceText: 'First'}),
        makeUtterance({timestamp: 2000, sourceText: 'Second'}),
      ];

      const recap = computeMeetingRecap(session, utterances);
      const minutesText = recap.minutes.join('\n');

      // All three utterances appear, ordered by timestamp
      const firstIdx  = minutesText.indexOf('First');
      const secondIdx = minutesText.indexOf('Second');
      const thirdIdx  = minutesText.indexOf('Third');
      expect(firstIdx).toBeGreaterThan(-1);
      expect(secondIdx).toBeGreaterThan(-1);
      expect(thirdIdx).toBeGreaterThan(-1);
      expect(firstIdx).toBeLessThan(secondIdx);
      expect(secondIdx).toBeLessThan(thirdIdx);
    });

    it('includes speaker and language group headers', () => {
      const session = makeSession();
      const utterances: UtteranceData[] = [
        makeUtterance({timestamp: 1000, sourceText: 'From Alice EN', speakerId: 'S1', speakerLabel: 'Alice'}),
        makeUtterance({timestamp: 2000, sourceText: 'From Bob KO',   speakerId: 'S2', speakerLabel: 'Bob', sourceLanguage: 'KO'}),
      ];

      const recap = computeMeetingRecap(session, utterances);

      const text = recap.minutes.join('\n');
      expect(text).toContain('Alice');
      expect(text).toContain('Bob');
      expect(text).toContain('[KO]');
    });

    it('includes translation when available', () => {
      const session = makeSession();
      const utterances: UtteranceData[] = [
        makeUtterance({timestamp: 1000, sourceText: 'Hello', translatedText: 'Xin chào'}),
      ];

      const recap = computeMeetingRecap(session, utterances);
      expect(recap.minutes.join('\n')).toContain('→ Xin chào');
    });

    it('skips non-final utterances', () => {
      const session = makeSession();
      const utterances: UtteranceData[] = [
        makeUtterance({timestamp: 1000, sourceText: 'Final',   isFinal: true}),
        makeUtterance({timestamp: 2000, sourceText: 'Partial', isFinal: false}),
      ];

      const recap = computeMeetingRecap(session, utterances);
      const text = recap.minutes.join('\n');
      expect(text).toContain('Final');
      expect(text).not.toContain('Partial');
    });
  });

  // --------------------------------------------------------------------------
  // Key Moments
  // --------------------------------------------------------------------------

  describe('keyMoments', () => {
    it('FIRST: captures the very first utterance', () => {
      const session = makeSession();
      const utterances: UtteranceData[] = [
        makeUtterance({timestamp: 1000, sourceText: 'First!'}),
        makeUtterance({timestamp: 2000, sourceText: 'Second'}),
      ];

      const recap = computeMeetingRecap(session, utterances);
      const first = recap.keyMoments.find((m) => m.type === MOMENT_TYPE_FIRST_UTTERANCE)!;
      expect(first).toBeDefined();
      expect(first.utterance.sourceText).toBe('First!');
    });

    it('LONGEST: captures top 3 longest utterances by character count', () => {
      const session = makeSession();
      const utterances: UtteranceData[] = [
        makeUtterance({timestamp: 1000, sourceText: 'Short one'}),                                          // 9 chars
        makeUtterance({timestamp: 2000, sourceText: 'The longest utterance in this entire meeting session'}), // 51 chars
        makeUtterance({timestamp: 3000, sourceText: 'Another quite long utterance that matters'}),           // 40 chars
        makeUtterance({timestamp: 4000, sourceText: 'Medium length text here is okay'}),                   // 30 chars
      ];

      const recap = computeMeetingRecap(session, utterances);
      const longest = recap.keyMoments.filter((m) => m.type === MOMENT_TYPE_LONGEST);

      expect(longest).toHaveLength(3);
      // All three longest utterances are captured (sorted by timestamp after extraction)
      const longestTexts = longest.map((m) => m.utterance.sourceText);
      expect(longestTexts).toContain('The longest utterance in this entire meeting session');
      expect(longestTexts).toContain('Another quite long utterance that matters');
      expect(longestTexts).toContain('Medium length text here is okay');
    });

    it('FINAL: captures last 3 utterances', () => {
      const session = makeSession();
      const utterances: UtteranceData[] = [
        makeUtterance({timestamp: 1000, sourceText: 'First'}),
        makeUtterance({timestamp: 2000, sourceText: 'Second'}),
        makeUtterance({timestamp: 3000, sourceText: 'Third'}),
        makeUtterance({timestamp: 4000, sourceText: 'Fourth'}),
        makeUtterance({timestamp: 5000, sourceText: 'Last one'}),
      ];

      const recap = computeMeetingRecap(session, utterances);
      const finals = recap.keyMoments.filter((m) => m.type === MOMENT_TYPE_FINAL);

      expect(finals).toHaveLength(3);
      const texts = finals.map((m) => m.utterance.sourceText);
      expect(texts).toContain('Third');
      expect(texts).toContain('Fourth');
      expect(texts).toContain('Last one');
    });

    it('LANGUAGE_SWITCH: detects consecutive utterances in different languages', () => {
      const session = makeSession();
      const utterances: UtteranceData[] = [
        makeUtterance({timestamp: 1000, sourceText: 'Hello everyone', sourceLanguage: 'EN'}),
        makeUtterance({timestamp: 2000, sourceText: 'Konnichiwa',     sourceLanguage: 'JA'}),
        makeUtterance({timestamp: 3000, sourceText: 'Annyeong',        sourceLanguage: 'KO'}),
      ];

      const recap = computeMeetingRecap(session, utterances);
      const switches = recap.keyMoments.filter((m) => m.type === MOMENT_TYPE_LANGUAGE_SWITCH);

      expect(switches).toHaveLength(2);
      expect(switches[0].utterance.sourceText).toBe('Konnichiwa'); // EN→JA
      expect(switches[1].utterance.sourceText).toBe('Annyeong');    // JA→KO
    });

    it('REPEATED_KEYWORD: captures utterances containing recurring keywords', () => {
      const session = makeSession();
      const utterances: UtteranceData[] = [
        makeUtterance({timestamp: 1000, sourceText: 'I would like to discuss the project timeline'}),
        makeUtterance({timestamp: 2000, sourceText: 'The project deadline is next Friday'}),
        makeUtterance({timestamp: 3000, sourceText: 'Yes that works for the project'}),
        makeUtterance({timestamp: 4000, sourceText: 'Random unrelated utterance'}),
      ];

      const recap = computeMeetingRecap(session, utterances);
      const kwMoments = recap.keyMoments.filter((m) => m.type === MOMENT_TYPE_REPEATED_KEYWORD);

      expect(kwMoments.length).toBeGreaterThan(0);
      // "project" appears 3 times
      const projectMoments = kwMoments.filter((m) => m.reason.includes('"project"'));
      expect(projectMoments.length).toBeGreaterThan(0);
    });

    it('each key moment has a human-readable reason', () => {
      const session = makeSession();
      const utterances: UtteranceData[] = [
        makeUtterance({timestamp: 1000, sourceText: 'Hello world this is a test'}),
      ];

      const recap = computeMeetingRecap(session, utterances);

      for (const moment of recap.keyMoments) {
        expect(typeof moment.reason).toBe('string');
        expect(moment.reason.length).toBeGreaterThan(5);
        expect(moment.type).toMatch(/^[a-z_]+$/);
      }
    });

    it('key moments are sorted by timestamp', () => {
      const session = makeSession();
      const utterances: UtteranceData[] = [
        makeUtterance({timestamp: 1000, sourceText: 'First'}),
        makeUtterance({timestamp: 2000, sourceText: 'Second the longest utterance here okay'}),
        makeUtterance({timestamp: 3000, sourceText: 'Last'}),
      ];

      const recap = computeMeetingRecap(session, utterances);

      // All moments sorted by their utterance's timestamp
      for (let i = 1; i < recap.keyMoments.length; i++) {
        expect(recap.keyMoments[i].utterance.timestamp).toBeGreaterThanOrEqual(
          recap.keyMoments[i - 1].utterance.timestamp,
        );
      }
    });

    it('returns empty key moments when no final utterances', () => {
      const session = makeSession();
      const utterances: UtteranceData[] = [
        makeUtterance({timestamp: 1000, sourceText: 'Partial', isFinal: false}),
      ];

      const recap = computeMeetingRecap(session, utterances);
      expect(recap.keyMoments).toHaveLength(0);
    });
  });

  // --------------------------------------------------------------------------
  // Edge Cases
  // --------------------------------------------------------------------------

  describe('edge cases', () => {
    it('handles empty utterance list', () => {
      const session = makeSession();
      const recap = computeMeetingRecap(session, []);

      expect(recap.finalUtterances).toBe(0);
      expect(recap.totalCharacters).toBe(0);
      expect(recap.languages).toHaveLength(0);
      expect(recap.speakers).toHaveLength(0);
      expect(recap.keyMoments).toHaveLength(0);
      expect(recap.overviewSummary).toContain('0');
    });

    it('derives duration label correctly for minutes-only session', () => {
      const session = makeSession({startedAt: Date.parse('2026-04-15T10:00:00Z'), endedAt: Date.parse('2026-04-15T10:12:00Z')});
      const utterances: UtteranceData[] = [
        makeUtterance({timestamp: 1000, sourceText: 'Short'}),
      ];

      const recap = computeMeetingRecap(session, utterances);
      expect(recap.durationLabel).toBe('12m');
    });

    it('derives duration label for hours', () => {
      const session = makeSession({startedAt: Date.parse('2026-04-15T10:00:00Z'), endedAt: Date.parse('2026-04-15T11:30:00Z')});
      const utterances: UtteranceData[] = [
        makeUtterance({timestamp: 1000, sourceText: 'Long'}),
      ];

      const recap = computeMeetingRecap(session, utterances);
      expect(recap.durationLabel).toBe('1h 30m');
    });

    it('gracefully handles null endedAt (live session)', () => {
      const session = makeSession({endedAt: null});
      const utterances: UtteranceData[] = [
        makeUtterance({timestamp: 1000, sourceText: 'Live'}),
      ];

      const recap = computeMeetingRecap(session, utterances);
      expect(recap.durationMs).toBeGreaterThanOrEqual(0);
      expect(recap.durationLabel).toBeTruthy();
    });
  });

  // --------------------------------------------------------------------------
  // getMomentTypeLabel
  // --------------------------------------------------------------------------

  describe('getMomentTypeLabel', () => {
    it('returns label and emoji for each known moment type', () => {
      const cases: Array<[string, string]> = [
        [MOMENT_TYPE_LONGEST,          '📝'],
        [MOMENT_TYPE_FINAL,             '🔚'],
        [MOMENT_TYPE_REPEATED_KEYWORD, '🔁'],
        [MOMENT_TYPE_LANGUAGE_SWITCH,  '🔤'],
        [MOMENT_TYPE_FIRST_UTTERANCE,  '🏁'],
      ];

      for (const [type, emoji] of cases) {
        const result = getMomentTypeLabel(type);
        expect(result.emoji).toBe(emoji);
        expect(result.label.length).toBeGreaterThan(0);
      }
    });

    it('returns default for unknown moment type', () => {
      const result = getMomentTypeLabel('unknown_type_xyz');
      expect(result.emoji).toBe('💬');
      expect(result.label).toBe('Notable Moment');
    });
  });
});
