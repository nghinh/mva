import {BUNDLED_MODEL_CONFIG, getSttModelIdForSource} from './bundledModels';

describe('getSttModelIdForSource', () => {
  it('routes vi to the dedicated Vietnamese engine', () => {
    expect(getSttModelIdForSource('vi')).toBe('stt_vi');
  });

  it('keeps every other source on the SenseVoice auto engine', () => {
    expect(getSttModelIdForSource('en')).toBe('stt');
    expect(getSttModelIdForSource('ja')).toBe('stt');
    expect(getSttModelIdForSource('ko')).toBe('stt');
    expect(getSttModelIdForSource('zh')).toBe('stt');
    expect(getSttModelIdForSource(undefined)).toBe('stt');
  });

  it('routed ids resolve to bundled configs with required files', () => {
    for (const source of ['vi', 'en'] as const) {
      const cfg = BUNDLED_MODEL_CONFIG[getSttModelIdForSource(source)];
      expect(cfg.folder.length).toBeGreaterThan(0);
      expect(cfg.requiredFiles.length).toBeGreaterThan(0);
    }
  });

  it('vi engine bundle ships the hotwords prerequisites (Phase 2)', () => {
    const files = BUNDLED_MODEL_CONFIG.stt_vi.requiredFiles as readonly string[];
    expect(files).toContain('tokens.txt');
    expect(files).toContain('bpe.model');
  });
});
