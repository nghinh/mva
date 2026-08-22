import {useSettingsStore} from './settingsStore';

describe('settingsStore sttBenchmark (v12)', () => {
  afterEach(() => {
    useSettingsStore.setState({sttBenchmark: null});
  });

  it('defaults to null', () => {
    expect(useSettingsStore.getState().sttBenchmark).toBeNull();
  });

  it('setter stores result', () => {
    useSettingsStore.getState().setSttBenchmark({rtf: 0.2, tier: 'strong'});
    expect(useSettingsStore.getState().sttBenchmark).toEqual({rtf: 0.2, tier: 'strong'});
  });

  it('migrate from v11 keeps inputLanguage and adds null benchmark', () => {
    const migrate = useSettingsStore.persist.getOptions().migrate!;
    const migrated = migrate({inputLanguage: 'vi'}, 11) as any;
    expect(migrated.inputLanguage).toBe('vi');
    expect(migrated.sttBenchmark).toBeNull();
  });
});
