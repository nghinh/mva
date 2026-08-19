/**
 * Đảm bảo các gói Apple Translation cho NGÔN NGỮ ĐÍCH vừa chọn ở popup bắt
 * đầu họp. Gói chỉ được tải ở splash (theo target lúc đó) hoặc bấm tay trong
 * Settings — đổi target qua popup trước đây không kích hoạt tải gì, nên phiên
 * họp đầu tiên sau khi đổi target rơi vào "transcript-only" im lặng (bug field
 * 19/08: target vi, nói tiếng Anh, lane Dịch trống vì thiếu gói en→vi).
 *
 * Fire-and-forget từ beginMeeting: kiểm tra từng cặp src→target, cặp nào
 * 'available' (chưa cài) thì gọi downloadLanguageIfNeeded — iOS có thể hiện
 * sheet xác nhận của hệ thống, người dùng đồng ý là gói về nền trong lúc họp
 * đã bắt đầu; final nào lỡ mất bản dịch sẽ được dịch bù ở bước deferred sau
 * khi họp kết thúc. Android: ML Kit tự tải khi dịch lần đầu — không cần gì.
 */

import {Platform} from 'react-native';
import getNativeAppleTranslator from '../native/NativeAppleTranslator';
import type {SupportedTargetLanguage} from '../shared/store/settingsStore';
import {infoLog, warnLog} from '../shared/utils/logger';

const ALL_SOURCES = ['en', 'ja', 'ko', 'zh', 'vi'] as const;

export async function ensureTargetLanguagePacks(target: SupportedTargetLanguage): Promise<void> {
  if (Platform.OS !== 'ios') return;
  const native = getNativeAppleTranslator();
  if (!native) return;
  for (const src of ALL_SOURCES) {
    if (src === target) continue;
    try {
      const status = await native.getLanguagePackStatus(src, target);
      if (status === 'available') {
        infoLog('[ensureTargetLanguagePacks] downloading pack', {src, target});
        await native.downloadLanguageIfNeeded(src, target);
      }
    } catch (error) {
      // Không chặn cuộc họp vì gói dịch — thiếu gói thì final đi đường deferred.
      warnLog('[ensureTargetLanguagePacks] pack check/download failed:', {src, target}, error);
    }
  }
}
