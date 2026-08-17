import {getLanguageFlag} from './languageFlag';

describe('getLanguageFlag', () => {
  it('covers every supported source language', () => {
    // Vietnamese was missing from two of the three copies of this mapping,
    // so Vietnamese utterances rendered the 🌐 fallback while the pipeline
    // was transcribing them correctly.
    expect(getLanguageFlag('vi')).toBe('🇻🇳');
    expect(getLanguageFlag('en')).toBe('🇬🇧');
    expect(getLanguageFlag('ja')).toBe('🇯🇵');
    expect(getLanguageFlag('ko')).toBe('🇰🇷');
    expect(getLanguageFlag('zh')).toBe('🇨🇳');
  });

  it('is case insensitive — the copies disagreed on upper vs lower', () => {
    expect(getLanguageFlag('VI')).toBe('🇻🇳');
    expect(getLanguageFlag('Vi')).toBe('🇻🇳');
    expect(getLanguageFlag('EN')).toBe('🇬🇧');
  });

  it('falls back to the globe only for genuinely unknown input', () => {
    expect(getLanguageFlag('fr')).toBe('🌐');
    expect(getLanguageFlag('')).toBe('🌐');
    expect(getLanguageFlag(null)).toBe('🌐');
    expect(getLanguageFlag(undefined)).toBe('🌐');
  });
});
