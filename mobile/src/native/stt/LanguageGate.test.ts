import {
  GATE_WINDOW_MS,
  STRONG_RTF_THRESHOLD,
  GATE_EARLY_LOCK_MIN_WINS,
  scoreUtterance,
  createGateTally,
  recordWin,
  tallyLeader,
  decideLock,
  decideEarlyLock,
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

  it('short vi garble with high diacritic RATIO cannot beat a fluent en-tagged sentence', () => {
    // Field 19/08 10:02: "Alô ha" (0.167) / "Ừ d" (0.33) thắng oan tiếng Anh.
    expect(
      scoreUtterance({text: 'Hello, how are you today is we day.', lang: '<|en|>'}, {text: 'Alô ha'}, 'vi'),
    ).toBe('sense');
    expect(
      scoreUtterance({text: 'I know it is rain day.', lang: '<|en|>'}, {text: 'Ừ d'}, 'vi'),
    ).toBe('sense');
  });

  it('biasAgainstVi (target=vi): weak-evidence zones fall to sense, real vi still wins', () => {
    // Không bên nào có tín hiệu → sense thay vì leader.
    expect(scoreUtterance({text: 'abc xyz', lang: '<|ko|>'}, {text: 'abc xyz'}, 'vi', true)).toBe('sense');
    // vi strong nhưng chưa dominant+dài → sense khi bias.
    expect(
      scoreUtterance({text: 'mumble jumble words', lang: '<|ja|>'}, {text: 'sen mêu tú pi tơ bao cua li ri po'}, 'vi', true),
    ).toBe('sense');
    // vi thật (dominant + dài + stopword) vẫn thắng dù bias.
    expect(
      scoreUtterance(
        {text: 'homehelello, how are you.', lang: '<|zh|>'},
        {text: 'xin chào bạn có khỏe không năm nay là thứ tư'},
        'sense',
        true,
      ),
    ).toBe('vi');
  });

  it('vi phrase using previously-missing diacritics (ơ, ấ, ả) → vi', () => {
    expect(
      scoreUtterance(
        {text: 'cam on rat nhieu', lang: 'en'},
        {text: 'cảm ơn rất nhiều bạn nhé'},
        'sense',
      ),
    ).toBe('vi');
  });

  it('mirror zone: vi speech (sense hears zh garbage, vi text full of stopwords) → vi regardless of leader', () => {
    // Bug field 19/08: mở đầu bằng tiếng Anh → leader sense → mọi câu vi rơi
    // vùng mirror đều hiện chữ Trung. Stopword tiếng Việt phân định thay leader.
    const sense = {text: '堆满天地的感影的我对内练。', lang: '<|zh|>'};
    const vi = {text: 'bạn không thể hiển thị được tiếng việt đúng không'};
    expect(scoreUtterance(sense, vi, 'sense')).toBe('vi');
    expect(scoreUtterance(sense, vi, 'vi')).toBe('vi');
  });

  it('mirror zone: real zh speech (fluent zh, vi garbage without stopwords) → sense regardless of leader', () => {
    const sense = {text: '我们今天讨论第三季度的计划', lang: 'zh'};
    const vi = {text: 'ửa mân thén thảo lứn తె sান giây tú để kê hoặch'};
    expect(scoreUtterance(sense, vi, 'sense')).toBe('sense');
    expect(scoreUtterance(sense, vi, 'vi')).toBe('sense');
  });

  it('yue tag counts as CJK: cantonese-tagged garbage vs diacritic-free vi garble → sense', () => {
    // Field 19/08: SenseVoice tag rác CJK là <|yue|> (không phải zh) — senseCjk
    // bỏ sót yue nên mọi rule dựa trên CJK chết im với chính loại rác phổ biến nhất.
    expect(
      scoreUtterance(
        {text: '佢失去咗聯繫個屋企你就失去你個一唔可以。', lang: '<|yue|>'},
        {text: 'po instion seat inter'},
        'vi',
      ),
    ).toBe('sense');
  });

  it('yue mirror zone: vi speech (sense hears yue garbage, vi full of stopwords) → vi', () => {
    expect(
      scoreUtterance(
        {text: '似themselves係都未翻你叫時候佢in一去可是水去可。', lang: '<|yue|>'},
        {text: 'bạn không thể hiển thị được tiếng việt đúng không'},
        'sense',
      ),
    ).toBe('vi');
  });

  it('mirror zone length asymmetry: tiny yue snippet vs long fluent vi (stopword ratio just under threshold) → vi', () => {
    // Field 20/08 11:16:45: câu vi 67 từ, stopword 10/67=0.1493 hụt ngưỡng 0.15
    // đúng 0.0007 → sense thắng oan với 7 ký tự rác. CJK thật không bao giờ
    // ra 7 ký tự đối đầu một câu vi dài áp đảo.
    expect(
      scoreUtterance(
        {text: '佢将佢人佢正。', lang: '<|yue|>'},
        {
          text: 'chào mừng quý vị và các bạn đến với bản tin tiếng việt ngày mười chín tháng tám của đài truyền hình bess đài loan kính thưa quý vị người dân ở tân trúc phát hiện nghi có lao động việt nam buôn bán thịt chó trái phép sau khi nhận tin báo cơ quan bảo vệ động vật đã đến kiểm tra và bắt quả tang',
        },
        'sense',
      ),
    ).toBe('vi');
  });

  it('mirror zone length asymmetry: stopword-thin formal vi (names/titles) vs medium yue garbage → vi', () => {
    // Field 19/08 17:57:34: câu liệt kê chức danh/tên riêng, stopword thưa
    // (5/40=0.125) — trước fix yue thắng nhờ Rule 3, sau fix yue rơi vào
    // mirror zone và phải thắng bằng bất đối xứng độ dài.
    expect(
      scoreUtterance(
        {text: '佢失去咗聯繫個屋企你就失去你個一唔可以佢讀完不去可小便。', lang: '<|yue|>'},
        {
          text: 'thương binh và xã hội tấn hải nam cựu cục trưởng cục quản lý lao động ngoài nước thuộc bộ lao động thương binh và xã hội nguyễn gia liêm và phạm viết hương đều là cựu phó cục trưởng cục quản lý lao động ngoài nước về tội nhận hối lộ',
        },
        'sense',
      ),
    ).toBe('vi');
  });

  it('both empty → leader', () => {
    expect(scoreUtterance({text: ''}, {text: ''}, 'vi')).toBe('vi');
  });

  it('english WITHOUT stopwords, sense tag en, low-density vi garbage → sense', () => {
    // "send email to peter about the quarterly report" nói tiếng Anh: transducer
    // vi phát ra rác thưa dấu (ratio ~0.09, trên strong 0.08 nhưng dưới
    // dominant 0.13) — tag 'en' của SenseVoice phải thắng.
    expect(
      scoreUtterance(
        {text: 'send email to peter about quarterly report', lang: 'en'},
        {text: 'sen mêu tú pi tơ bao cua li ri po'},
        'vi',
      ),
    ).toBe('sense');
  });

  it('token-style SenseVoice tags (<|en|>) are normalized before comparison', () => {
    // Bridge iOS passthrough r.lang nguyên dạng token — bug field 18/08.
    expect(
      scoreUtterance(
        {text: 'send email to peter about quarterly report', lang: '<|en|>'},
        {text: 'sen mêu tú pi tơ bao cua li ri po'},
        'vi',
      ),
    ).toBe('sense');
    expect(
      scoreUtterance(
        {text: '我们今天讨论第三季度的计划', lang: '<|zh|>'},
        {text: 'a'},
        'vi',
      ),
    ).toBe('sense');
  });

  it('dominant vi diacritic density beats sense en tag', () => {
    expect(
      scoreUtterance(
        {text: 'hom nay chung ta hop ve ke hoach quy ba', lang: 'en'},
        {text: 'hôm nay chúng ta họp về kế hoạch quý ba'},
        'sense',
      ),
    ).toBe('vi');
  });
});

describe('tally + lock', () => {
  it('one-sided tally locks to that engine', () => {
    const vi = createGateTally();
    recordWin(vi, 'vi');
    recordWin(vi, 'vi');
    expect(decideLock(vi)).toBe('vi');
    const sense = createGateTally();
    recordWin(sense, 'sense');
    expect(decideLock(sense)).toBe('sense');
  });

  it('mixed tally never locks — bilingual sessions must keep switching', () => {
    // Phàn nàn field 19-20/08: phiên trộn Vi/En bị khóa theo đa số sau 5 phút,
    // ngôn ngữ còn lại thành rác đến hết phiên. Trộn → giữ gate suốt phiên.
    const t = createGateTally();
    recordWin(t, 'vi');
    recordWin(t, 'vi');
    recordWin(t, 'sense');
    expect(tallyLeader(t)).toBe('vi');
    expect(decideLock(t)).toBeNull();
    const tie = createGateTally();
    recordWin(tie, 'vi');
    recordWin(tie, 'sense');
    expect(tallyLeader(tie)).toBe('sense');
    expect(decideLock(tie)).toBeNull();
  });

  it('empty tally → sense', () => {
    expect(decideLock(createGateTally())).toBe('sense');
  });

  it('early lock: unanimous after minimum wins', () => {
    const t = createGateTally();
    for (let i = 0; i < GATE_EARLY_LOCK_MIN_WINS; i += 1) recordWin(t, 'vi');
    expect(decideEarlyLock(t)).toBe('vi');
  });

  it('early lock: not before minimum wins', () => {
    const t = createGateTally();
    for (let i = 0; i < GATE_EARLY_LOCK_MIN_WINS - 1; i += 1) recordWin(t, 'sense');
    expect(decideEarlyLock(t)).toBeNull();
  });

  it('early lock: mixed evidence never locks early', () => {
    const t = createGateTally();
    for (let i = 0; i < GATE_EARLY_LOCK_MIN_WINS; i += 1) recordWin(t, 'sense');
    recordWin(t, 'vi');
    expect(decideEarlyLock(t)).toBeNull();
  });
});
