/**
 * SessionTestLog — nhật ký chẩn đoán theo phiên họp, phục vụ các đợt test field.
 *
 * Ghi lại từng bước của pipeline cho MỖI utterance: nói câu gì (ngôn ngữ nào,
 * engine nào thắng), bản dịch ra sao, và đặc biệt là CÂU NÀO KHÔNG DỊCH VÀ VÌ
 * SAO (trùng ngôn ngữ đích / chờ dịch sau họp / bị hủy / lỗi). Kèm các mốc
 * gate (active, khóa engine) và cấu hình phiên (target, gateMode, tier).
 *
 * Lưu: in-memory trong phiên; flush ra file JSONL tại
 * `<Documents>/session-test-logs/<sessionId>.jsonl` khi phiên kết thúc.
 * Đọc/chia sẻ: SessionReviewScreen (tab Export) render dạng text dễ đọc.
 */

import {Platform} from 'react-native';
import {DocumentDirectoryPath, TemporaryDirectoryPath, appendFile, exists, mkdir, readFile, writeFile} from '@dr.pogodin/react-native-fs';
import testLogToken from '../shared/config/testLogToken.local.json';
import {useSettingsStore} from '../shared/store/settingsStore';
import {warnLog} from '../shared/utils/logger';

export type TestLogKind =
  | 'session_start'
  | 'session_stop'
  | 'gate'
  | 'stt_final'
  | 'translation_ok'
  | 'translation_skip_same_lang'
  | 'translation_deferred'
  | 'translation_cancelled'
  | 'translation_error';

export interface TestLogEntry {
  /** epoch ms */
  t: number;
  kind: TestLogKind;
  utteranceId?: string;
  /** stt_final: transcript; translation_ok: bản dịch */
  text?: string;
  /** stt_final: ngôn ngữ nhận diện; session_start: target */
  lang?: string;
  /** chi tiết tự do: lý do, thông báo lỗi, latency, tally... */
  detail?: string;
}

const LOG_DIR = `${DocumentDirectoryPath}/session-test-logs`;
const DEVICE_TAG_FILE = `${DocumentDirectoryPath}/device-tag.txt`;

const buffers = new Map<string, TestLogEntry[]>();

// ---------------------------------------------------------------------------
// Định danh máy test: nhiều máy TestFlight cùng gửi log về group nên mỗi bản
// cài giữ một tag ngẫu nhiên bền (MVA-xxxx, sinh 1 lần, lưu file). Kèm OS +
// tier/RTF benchmark để đọc log biết ngay bối cảnh phần cứng.
// ---------------------------------------------------------------------------
let deviceTagCache: string | null = null;

export async function ensureDeviceTag(): Promise<string> {
  if (deviceTagCache) return deviceTagCache;
  try {
    if (await exists(DEVICE_TAG_FILE)) {
      deviceTagCache = (await readFile(DEVICE_TAG_FILE, 'utf8')).trim();
    }
  } catch {
    // đọc hỏng thì sinh mới bên dưới
  }
  if (!deviceTagCache) {
    deviceTagCache = `MVA-${Math.random().toString(16).slice(2, 6)}`;
    writeFile(DEVICE_TAG_FILE, deviceTagCache, 'utf8').catch(() => {});
  }
  return deviceTagCache;
}

/** Chuỗi mô tả máy cho header log: tag + OS + tier benchmark. */
export function deviceMeta(): string {
  const bench = useSettingsStore.getState().sttBenchmark;
  const os = `${Platform.OS} ${Platform.Version}`;
  const tier = bench ? `${bench.tier} (rtf=${bench.rtf.toFixed(3)})` : 'chưa benchmark';
  return `máy=${deviceTagCache ?? '?'}, ${os}, tier=${tier}`;
}

export function testLog(sessionId: string, entry: Omit<TestLogEntry, 't'>): void {
  let buf = buffers.get(sessionId);
  if (!buf) {
    buf = [];
    buffers.set(sessionId, buf);
  }
  buf.push({t: Date.now(), ...entry});
}

export function logFilePath(sessionId: string): string {
  return `${LOG_DIR}/${sessionId}.jsonl`;
}

/** Ghi buffer ra file và giải phóng RAM. Gọi khi phiên kết thúc. */
export async function flushSessionTestLog(sessionId: string): Promise<void> {
  const buf = buffers.get(sessionId);
  if (!buf || buf.length === 0) return;
  try {
    await mkdir(LOG_DIR);
    const lines = buf.map((e) => JSON.stringify(e)).join('\n') + '\n';
    await appendFile(logFilePath(sessionId), lines, 'utf8');
    buffers.delete(sessionId);
  } catch (error) {
    warnLog('[sessionTestLog] flush failed:', error);
  }
}

/** Đọc log một phiên (từ RAM nếu còn, không thì từ file). */
export async function readSessionTestLog(sessionId: string): Promise<TestLogEntry[]> {
  const live = buffers.get(sessionId);
  if (live && live.length > 0) return [...live];
  try {
    const path = logFilePath(sessionId);
    if (!(await exists(path))) return [];
    const raw = await readFile(path, 'utf8');
    return raw
      .split('\n')
      .filter(Boolean)
      .map((line: string) => JSON.parse(line) as TestLogEntry);
  } catch (error) {
    warnLog('[sessionTestLog] read failed:', error);
    return [];
  }
}

function fmtTime(t: number): string {
  const d = new Date(t);
  const p = (n: number) => n.toString().padStart(2, '0');
  const ms = (t % 1000).toString().padStart(3, '0');
  return `${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}.${ms}`;
}

const KIND_LABEL: Record<TestLogKind, string> = {
  session_start: '▶️ Bắt đầu phiên',
  session_stop: '⏹ Kết thúc phiên',
  gate: '🚦 Gate',
  stt_final: '🎤 Nhận',
  translation_ok: '✅ Dịch',
  translation_skip_same_lang: '🚫 Không dịch (trùng ngôn ngữ đích)',
  translation_deferred: '⏳ Chờ dịch sau họp',
  translation_cancelled: '↩️ Bản dịch bị hủy (có bản mới hơn)',
  translation_error: '❌ Lỗi dịch',
};

/**
 * Tự động đẩy log phiên vào group Telegram [MVA] Test Log sau khi Stop.
 *
 * CHỈ hoạt động khi build có bot token trong testLogToken.local.json — file
 * này commit RỖNG trong repo (không bao giờ commit token thật; máy build nội
 * bộ điền tay + `git update-index --skip-worktree`). Token rỗng → hàm thoát
 * im lặng, app hành xử như bản public bình thường. PHẢI giữ nguyên cơ chế này
 * (hoặc gỡ hẳn) trước khi phát hành ra ngoài nhóm test nội bộ — auto-upload
 * transcript đi ngược cam kết privacy của sản phẩm.
 *
 * Gửi dạng document .txt (log dài vượt trần 4096 ký tự của sendMessage).
 */
export async function uploadSessionTestLog(sessionId: string): Promise<void> {
  const {botToken, chatId} = testLogToken as {botToken: string; chatId: string};
  if (!botToken || !chatId) return;
  try {
    const entries = await readSessionTestLog(sessionId);
    if (entries.length === 0) return;
    const tag = await ensureDeviceTag();
    const body = `MVA test log — ${deviceMeta()}\nphiên ${sessionId}\n\n${renderSessionTestLog(entries)}\n`;
    const filePath = `${TemporaryDirectoryPath}/mva-test-log-${tag}-${Date.now()}.txt`;
    await writeFile(filePath, body, 'utf8');
    const form = new FormData();
    form.append('chat_id', chatId);
    form.append('caption', `🧪 ${tag} — ${entries.length} dòng — phiên ${sessionId}`);
    form.append('document', {
      uri: filePath.startsWith('file://') ? filePath : `file://${filePath}`,
      type: 'text/plain',
      name: `test-log-${tag}.txt`,
    } as unknown as Blob);
    const res = await fetch(`https://api.telegram.org/bot${botToken}/sendDocument`, {
      method: 'POST',
      body: form,
    });
    if (!res.ok) {
      warnLog('[sessionTestLog] upload failed:', res.status, await res.text().catch(() => ''));
    }
  } catch (error) {
    // Mất mạng / group đổi quyền — không được ảnh hưởng luồng kết thúc họp.
    warnLog('[sessionTestLog] upload error:', error);
  }
}

/** Render text dễ đọc để hiển thị / chia sẻ. */
export function renderSessionTestLog(entries: TestLogEntry[]): string {
  return entries
    .map((e) => {
      const parts = [`[${fmtTime(e.t)}]`, KIND_LABEL[e.kind] ?? e.kind];
      if (e.lang) parts.push(`(${e.lang})`);
      if (e.text) parts.push(`“${e.text}”`);
      if (e.detail) parts.push(`— ${e.detail}`);
      return parts.join(' ');
    })
    .join('\n');
}
