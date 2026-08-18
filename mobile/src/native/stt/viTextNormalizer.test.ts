import {normalizeViCase} from './viTextNormalizer';

describe('normalizeViCase', () => {
  it('lowercases an all-caps Vietnamese sentence and capitalizes the first letter', () => {
    expect(normalizeViCase('XIN CHÀO TÔI LÀ NAM HÔM NAY LÀ NGÀY BAO NHIÊU')).toBe(
      'Xin chào tôi là nam hôm nay là ngày bao nhiêu',
    );
  });

  it('handles Vietnamese diacritics through case conversion', () => {
    expect(normalizeViCase('ĐANG HỌP VỀ KẾ HOẠCH QUÝ BA Ạ')).toBe('Đang họp về kế hoạch quý ba ạ');
  });

  it('leaves mixed-case text untouched', () => {
    expect(normalizeViCase('Xin chào TP HCM')).toBe('Xin chào TP HCM');
  });

  it('leaves lowercase text untouched', () => {
    expect(normalizeViCase('xin chào')).toBe('xin chào');
  });

  it('leaves text without letters untouched', () => {
    expect(normalizeViCase('123 !!!')).toBe('123 !!!');
    expect(normalizeViCase('')).toBe('');
  });
});
