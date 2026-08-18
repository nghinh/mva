import {
  GATE_WINDOW_MS,
  STRONG_RTF_THRESHOLD,
  scoreUtterance,
  createGateTally,
  recordWin,
  tallyLeader,
  decideLock,
} from './LanguageGate';

describe('constants', () => {
  it('gate window is 5 minutes', () => {
    expect(GATE_WINDOW_MS).toBe(5 * 60_000);
  });
  it('strong tier threshold is 0.35', () => {
    expect(STRONG_RTF_THRESHOLD).toBe(0.35);
  });
});

describe('scoreUtterance', () => {
  it('near-empty vi output vs full sense sentence → sense', () => {
    expect(
      scoreUtterance(
        {text: 'we should review the third quarter plan', lang: 'en'},
        {text: 'à'},
        'sense',
      ),
    ).toBe('sense');
  });

  it('near-empty sense output vs full vi sentence → vi', () => {
    expect(
      scoreUtterance(
        {text: '嗯', lang: 'zh'},
        {text: 'hôm nay chúng ta họp về kế hoạch quý ba'},
        'sense',
      ),
    ).toBe('vi');
  });

  it('sense CJK (ja) with weak vi diacritics → sense', () => {
    expect(
      scoreUtterance(
        {text: '今日は第三四半期の計画について話します', lang: 'ja'},
        {text: 'con nichi oa'},
        'vi',
      ),
    ).toBe('sense');
  });

  it('strong vi diacritics with latin sense output lacking english signal → vi', () => {
    expect(
      scoreUtterance(
        {text: 'hom nay chung ta hop ve ke hoach', lang: 'en'},
        {text: 'hôm nay chúng ta họp về kế hoạch quý ba'},
        'sense',
      ),
    ).toBe('vi');
  });

  it('english sense output with common words vs weak vi → sense', () => {
    expect(
      scoreUtterance(
        {text: 'i think we should have the meeting tomorrow', lang: 'en'},
        {text: 'ai think guy sut have de mít tinh tu mô râu'},
        'vi',
      ),
    ).toBe('sense');
  });

  it('ambiguous (sense CJK AND strong vi diacritics) → falls back to leader', () => {
    const sense = {text: '我们今天讨论第三季度的计划', lang: 'zh'};
    const vi = {text: 'hôm nay chúng ta họp về kế hoạch quý ba'};
    expect(scoreUtterance(sense, vi, 'sense')).toBe('sense');
    expect(scoreUtterance(sense, vi, 'vi')).toBe('vi');
  });

  it('both empty → leader', () => {
    expect(scoreUtterance({text: ''}, {text: ''}, 'vi')).toBe('vi');
  });
});

describe('tally + lock', () => {
  it('majority wins', () => {
    const t = createGateTally();
    recordWin(t, 'vi');
    recordWin(t, 'vi');
    recordWin(t, 'sense');
    expect(tallyLeader(t)).toBe('vi');
    expect(decideLock(t)).toBe('vi');
  });

  it('tie → sense (wider language coverage)', () => {
    const t = createGateTally();
    recordWin(t, 'vi');
    recordWin(t, 'sense');
    expect(tallyLeader(t)).toBe('sense');
    expect(decideLock(t)).toBe('sense');
  });

  it('empty tally → sense', () => {
    expect(decideLock(createGateTally())).toBe('sense');
  });
});
