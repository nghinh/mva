import {runLanguagePackSetup, PackTranslatorPort} from './languagePackSetup';

const PACKS = [
  {srcLang: 'en', displayName: 'English → Vietnamese'},
  {srcLang: 'ja', displayName: 'Japanese → Vietnamese'},
];

/**
 * Builds a translator port whose per-language behaviour is described by a table.
 * `status` is what LanguageAvailability reports, `usable` is the ground truth
 * that a real translation attempt would reveal.
 */
function makeTranslator(
  table: Record<string, {status: string; usable: boolean}>,
): PackTranslatorPort & {downloadCalls: string[]} {
  const downloadCalls: string[] = [];
  return {
    downloadCalls,
    getStatus: async (srcLang: string) => (table[srcLang]?.status ?? 'unknown') as never,
    download: async (srcLang: string) => {
      downloadCalls.push(srcLang);
      return true;
    },
    isAvailable: async (srcLang: string) => table[srcLang]?.usable ?? false,
  };
}

const noDelay = async () => undefined;

describe('runLanguagePackSetup', () => {
  it('terminates instead of looping when a pack never reports installed', async () => {
    // The regression this whole module exists for: Apple keeps reporting
    // 'available' and the pack is genuinely not usable. The old implementation
    // spun forever here and trapped the user on the splash screen.
    const translator = makeTranslator({
      en: {status: 'available', usable: false},
      ja: {status: 'installed', usable: true},
    });

    const result = await runLanguagePackSetup({
      packs: PACKS,
      targetLang: 'vi',
      translator,
      maxAttemptsPerPack: 2,
      delay: noDelay,
    });

    expect(translator.downloadCalls.filter(l => l === 'en')).toHaveLength(2);
    expect(result.failed).toEqual(['English → Vietnamese']);
    expect(result.installed).toEqual(['Japanese → Vietnamese']);
  });

  it('accepts a pack that works even when status never says installed', async () => {
    // LanguageAvailability.status() is documented in AppleTranslatorModule as
    // inconsistently reporting .supported for packs that are actually present,
    // so a usable pack must not be reported as failed.
    const translator = makeTranslator({
      en: {status: 'available', usable: true},
    });

    const result = await runLanguagePackSetup({
      packs: [PACKS[0]],
      targetLang: 'vi',
      translator,
      maxAttemptsPerPack: 3,
      delay: noDelay,
    });

    expect(result.installed).toEqual(['English → Vietnamese']);
    expect(result.failed).toEqual([]);
    // And it must not present the system sheet for a pack that already works.
    expect(translator.downloadCalls).toEqual([]);
  });

  it('never downloads a pack that is already installed', async () => {
    const translator = makeTranslator({
      en: {status: 'installed', usable: true},
      ja: {status: 'installed', usable: true},
    });

    const result = await runLanguagePackSetup({
      packs: PACKS,
      targetLang: 'vi',
      translator,
      delay: noDelay,
    });

    expect(translator.downloadCalls).toEqual([]);
    expect(result.installed).toHaveLength(2);
  });

  it('skips a pack whose source language equals the target language', async () => {
    // With target = English the en→en pair is meaningless. It used to poison
    // the whole check and silently suppress the other packs.
    const translator = makeTranslator({
      en: {status: 'unsupported', usable: false},
      ja: {status: 'installed', usable: true},
    });

    const result = await runLanguagePackSetup({
      packs: PACKS,
      targetLang: 'en',
      translator,
      delay: noDelay,
    });

    expect(translator.downloadCalls).not.toContain('en');
    expect(result.skipped).toEqual(['English → Vietnamese']);
    expect(result.installed).toEqual(['Japanese → Vietnamese']);
  });

  it('gives up on an unsupported pair without attempting a download', async () => {
    const translator = makeTranslator({
      en: {status: 'unsupported', usable: false},
    });

    const result = await runLanguagePackSetup({
      packs: [PACKS[0]],
      targetLang: 'vi',
      translator,
      delay: noDelay,
    });

    expect(translator.downloadCalls).toEqual([]);
    expect(result.failed).toEqual(['English → Vietnamese']);
  });

  it('stops immediately when the user cancels', async () => {
    const translator = makeTranslator({
      en: {status: 'available', usable: false},
      ja: {status: 'available', usable: false},
    });
    const signal = {cancelled: false};

    const result = await runLanguagePackSetup({
      packs: PACKS,
      targetLang: 'vi',
      translator,
      maxAttemptsPerPack: 5,
      delay: noDelay,
      signal,
      onPackAttempt: () => {
        signal.cancelled = true;
      },
    });

    expect(result.cancelled).toBe(true);
    expect(translator.downloadCalls).toHaveLength(1);
  });

  it('stops when the overall deadline passes', async () => {
    const translator = makeTranslator({
      en: {status: 'available', usable: false},
      ja: {status: 'available', usable: false},
    });
    let clock = 0;

    const result = await runLanguagePackSetup({
      packs: PACKS,
      targetLang: 'vi',
      translator,
      maxAttemptsPerPack: 10,
      deadlineMs: 1000,
      delay: noDelay,
      now: () => {
        clock += 400;
        return clock;
      },
    });

    expect(result.timedOut).toBe(true);
    expect(result.failed.length).toBeGreaterThan(0);
  });

  it('reports progress for every pack it touches', async () => {
    const translator = makeTranslator({
      en: {status: 'installed', usable: true},
      ja: {status: 'available', usable: true},
    });
    const seen: string[] = [];

    await runLanguagePackSetup({
      packs: PACKS,
      targetLang: 'vi',
      translator,
      delay: noDelay,
      onPackResolved: (srcLang, outcome) => seen.push(`${srcLang}:${outcome}`),
    });

    expect(seen).toEqual(['en:installed', 'ja:installed']);
  });

  it('survives a translator that throws', async () => {
    const translator: PackTranslatorPort = {
      getStatus: async () => {
        throw new Error('bridge died');
      },
      download: async () => {
        throw new Error('bridge died');
      },
      isAvailable: async () => {
        throw new Error('bridge died');
      },
    };

    const result = await runLanguagePackSetup({
      packs: [PACKS[0]],
      targetLang: 'vi',
      translator,
      maxAttemptsPerPack: 2,
      delay: noDelay,
    });

    expect(result.failed).toEqual(['English → Vietnamese']);
  });
});
