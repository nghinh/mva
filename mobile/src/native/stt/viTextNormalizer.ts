/**
 * Zipformer-VI phát ra TOÀN CHỮ HOA: model được train trên corpus tiếng Việt
 * uppercase nên bộ token (BPE vocab) chỉ chứa chữ hoa — đây là giới hạn của
 * model, không phải bug pipeline. SenseVoice train trên text có case bình
 * thường nên không cần xử lý.
 *
 * Hạ về chữ thường + viết hoa chữ cái đầu câu, CHỈ khi chuỗi thực sự toàn-hoa
 * để không phá text đã đúng case đến từ engine khác. Đánh đổi chấp nhận:
 * danh từ riêng giữa câu cũng bị hạ thường ("nam" thay vì "Nam") — vẫn dễ đọc
 * hơn hẳn nguyên câu viết hoa.
 */
export function normalizeViCase(text: string): string {
  if (!text) return text;
  const hasLetters = text.toLowerCase() !== text.toUpperCase();
  if (!hasLetters || text !== text.toUpperCase()) return text;
  const lower = text.toLowerCase();
  return lower.charAt(0).toUpperCase() + lower.slice(1);
}
