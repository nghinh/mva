# Language Gate — tự động nhận diện ngôn ngữ input (Phase 2)

- **Ngày:** 2026-08-18
- **Trạng thái:** Design đã được duyệt, chờ implementation plan
- **Tiền đề:** Phase 1 (commit `2be7538`) — engine Zipformer-VI + chọn tay input language

## 1. Mục tiêu

Bỏ hoàn toàn UI chọn ngôn ngữ input (pair-picker trên MeetingScreen, row Input
Language trong Settings). Thay bằng:

- **Máy khỏe** (qua benchmark): gate tự nhận diện — dual-decode 2 engine trong
  **5 phút đầu** phiên họp, sau đó chốt engine thắng, không đổi lại trong phiên.
- **Máy yếu**: popup chọn `Auto (EN/JA/KO/ZH)` / `Tiếng Việt` mỗi lần bấm bắt
  đầu họp, preselect lựa chọn lần trước.
- **Ngôn ngữ đầu ra (target)**: giữ nguyên theo Settings, ngoài phạm vi.

Ngoài phạm vi (đã cân nhắc và loại): re-check sau khi chốt engine; xử lý
code-switching từng câu sau phút thứ 5; spoken-LID model riêng (lib
react-native-sherpa-onnx chưa expose).

## 2. Quyết định thiết kế đã chốt (kèm lý do)

| Quyết định | Lựa chọn | Lý do chính |
|---|---|---|
| Cơ chế gate | Dual-decode từng utterance trong cửa sổ, rồi khóa | Không bao giờ hiển thị rác trong cửa sổ; logic đơn giản hơn giám-sát-điểm |
| Độ dài cửa sổ | 5 phút (hằng số `GATE_WINDOW_MS`) | 25–50 utterance là đủ bằng chứng; chi phí pin x2 bị chặn trần 5 phút |
| Sau khi chốt | Unload engine thua, không đổi lại | Trả ~230–305 MB RAM; tránh độ phức tạp đổi engine giữa phiên (chạm translator + transcript) |
| Phân loại máy | Benchmark RTF lúc splash prewarm, đo 1 lần/bản cài | Không thêm dependency; đo đúng năng lực thật; bước prewarm hiện đang trống |
| Popup máy yếu | Hiện mỗi lần start, nhớ lựa chọn cũ | Họp đổi ngôn ngữ giữa các cuộc; 1 tap xác nhận nếu không đổi |
| Benchmark lỗi | Coi là máy yếu | Đường popup luôn an toàn, không bao giờ chặn cuộc họp |

Số liệu nền: SenseVoice int8 228 MB (mù tiếng Việt, WER 99.7% FLEURS-vi);
Zipformer-VI int8 ~74 MB (chỉ tiếng Việt, WER 10.09%). Dual-decode **tuần tự**
trên cùng `processingChain` nên đỉnh RAM activation ≈ chạy 1 engine; chỉ trọng
số của cả 2 model thường trú trong cửa sổ (~305–390 MB).

## 3. Kiến trúc

```
Splash prewarm ──đo RTF, lưu tier──▶ MeetingScreen bấm Start
  ├─ tier = strong: không popup
  │   └▶ RealSpeechRecognizer(gateMode) load CẢ 2 engine
  │        ├─ 0–5p: final decode qua CẢ 2 engine (tuần tự, cùng snapshot)
  │        │        → LanguageGate.scoreUtterance → hiển thị bản thắng → tally
  │        │        (partial chỉ decode bằng engine đang dẫn tally)
  │        └─ hết 5p: chốt engine theo tally → destroy engine thua
  │                   → phần còn lại phiên y hệt hành vi hiện tại
  └─ tier = low: modal Auto/Vi (preselect lần trước) → chạy 1 engine như Phase 1
```

## 4. Thành phần

### 4.1 Benchmark tier — SplashScreen + settingsStore v12

- Vị trí: bước prewarm hiện tại của `SplashScreen.tsx` (hiện chỉ
  `startPrewarm → delay(300) → completePrewarm`).
- Cách đo: tạo engine SenseVoice (model đã cài xong ở bước trước), decode ~4 s
  audio tổng hợp (noise/sine — RTF không phụ thuộc nội dung), đo
  `RTF = thời_gian_decode / 4`. Destroy engine ngay sau đo.
- Phân loại: `tier = RTF ≤ STRONG_RTF_THRESHOLD (0.35) ? 'strong' : 'low'`.
  Ngưỡng 0.35: hai engine tuần tự ≈ 2×RTF vẫn ≤ 0.7, dưới realtime có dư địa.
- Lưu `sttBenchmark: {rtf: number, tier: 'strong' | 'low'} | null` vào
  settingsStore (migration v11→v12, default `null` = chưa đo). Chỉ đo khi
  `null`; các lần mở app sau bỏ qua. Đo lỗi/timeout → lưu tier `'low'`.
- Giữ nguyên field `inputLanguage` — tái sử dụng làm lựa chọn ghi nhớ của popup.

### 4.2 LanguageGate — `mobile/src/native/stt/LanguageGate.ts`

Module mới, chứa toàn bộ logic chấm điểm + tally + quyết định khóa. Hàm thuần,
không side effect, không giữ tham chiếu engine.

`scoreUtterance(senseOut: {text, lang}, viOut: {text}): 'sense' | 'vi'` — quy
tắc v1 theo thứ tự (đã reconcile với implementation + fixture tests):

1. Một bên rỗng/≤2 ký tự, bên kia ra câu hoàn chỉnh (≥6 ký tự) → bên dài thắng.
2. Đúng một bên có tín hiệu chữ viết bản địa: SenseVoice tag `ja/ko/zh` + text
   chứa CJK/Kana/Hangul thật → `'sense'`; mật độ dấu tiếng Việt ≥ 0.08 trên
   output Zipformer → `'vi'`, trừ khi output SenseVoice có tín hiệu tiếng Anh
   mạnh (tag `en` + từ thông dụng, điểm ≥ 0.5) → `'sense'`.
3. Không bên nào có tín hiệu nhưng SenseVoice có tín hiệu tiếng Anh mạnh →
   `'sense'`.
4. Cả hai cùng có tín hiệu (vùng "garbage-mirror") hoặc không phân định được →
   nghiêng về engine đang dẫn tally (chống dao động).

`GateTally`: đếm số utterance thắng mỗi engine trong cửa sổ;
`decideLock(tally): 'sense' | 'vi'` — đa số thắng; hòa → `'sense'` (phạm vi
ngôn ngữ rộng hơn).

### 4.3 RealSpeechRecognizer — chế độ gate

- `start(sessionId, emit, sourceLanguage?, gateMode?)`. `gateMode = true` chỉ
  khi tier strong (khi đó `sourceLanguage` bỏ qua).
- Gate active: giữ `engineSense` + `engineVi` đồng thời (cả hai
  `createSTT` lúc start; load engine 2 fail → fallback 1 engine SenseVoice +
  `warnLog`, không chặn phiên).
- **Partial**: chỉ decode bằng engine đang dẫn tally (leader khởi đầu:
  `'sense'`). Giữ cadence/backpressure (`inferenceActive`, `PARTIAL_INTERVAL_MS`)
  như hiện tại.
- **Final**: decode cả 2 engine tuần tự trong cùng `processingChain`, đưa 2 kết
  quả qua `scoreUtterance`, emit `stt_final` với text + `language` của bản
  thắng; prefix utterance id (`sense-`/`vi-`) giữ nguyên semantics hiện có.
- **Khóa**: tại utterance final đầu tiên có `now - sessionStartMs ≥
  GATE_WINDOW_MS` → `decideLock(tally)`, destroy engine thua **sau khi drain**
  `processingChain` (pattern sẵn có trong `stop()`), emit `pipeline_status`
  `"Gate locked: <displayName>"`. Từ đây hành vi = code hiện tại
  (forcedLanguage `'vi'` nếu VI thắng, ngược lại SenseVoice auto EN/JA/KO/ZH).
- Phiên ngắn hơn 5 phút: không khóa, phiên sau probe lại từ đầu — chấp nhận.

### 4.4 UI

- **MeetingScreen**: bỏ pair-picker input (khối `inputLanguage === 'vi' ? …`
  quanh dòng 453–464 và `handleToggleInputLanguage`). `handleStartMeeting`:
  - tier strong → `startMeeting(undefined, targetLanguage, {gateMode: true})`.
  - tier low → mở modal Auto/Vi (preselect `inputLanguage` từ store), xác nhận
    → `setInputLanguage(choice)` + `startMeeting(choice === 'vi' ? 'vi' : 'en',
    targetLanguage)` (mapping `'en'` giữ nguyên semantics Phase 1).
- **SettingsScreen**: bỏ row Input Language.
- **i18n**: key mới cho modal (title, option auto, option vi, nút xác nhận/hủy)
  × 5 locale (en/ja/ko/vi/zh); xóa key của row/picker cũ nếu không còn dùng.
- **Translator/TTS**: không đổi — pipeline đã dịch theo `event.language` từng
  utterance; Phase 1 đã fix các assumption vi-as-target.

## 5. Error handling

| Tình huống | Hành vi |
|---|---|
| Benchmark lỗi/timeout | tier `'low'` → luôn đi đường popup |
| Load engine thứ 2 fail (gate) | Fallback 1 engine SenseVoice, `warnLog`, phiên vẫn chạy |
| Destroy engine thua fail | Log, giữ engine thắng chạy tiếp (rò RAM tạm chấp nhận, phiên vẫn đúng) |
| Cả 2 output rỗng | `utterance_cancel` `empty_result` như hiện tại |
| App background trong cửa sổ | Không xử lý riêng — dual-decode tuần tự không đổi đỉnh activation; rủi ro jetsam ghi nhận ở §7 |

## 6. Testing

- **Unit** (`jest`):
  - `scoreUtterance`: fixture vi sạch / en / ja / "vi bị SenseVoice đọc thành
    zh-garbage" / một bên rỗng / hòa (tie-break theo tally).
  - `GateTally` + `decideLock`: đa số, hòa, cửa sổ 0 utterance.
  - settingsStore migration v11→v12 (giữ `inputLanguage`, thêm `sttBenchmark`).
  - Tier từ RTF: biên 0.35, lỗi đo → low.
- **Component**: modal máy yếu — hiện đúng khi tier low, preselect đúng, lưu
  lựa chọn; tier strong không hiện.
- **Manual trên máy thật** (checklist trong plan): phiên toàn vi, phiên toàn
  en, phiên đổi vi→en ở phút 2 (cửa sổ phải bắt được), phiên >5 phút xác nhận
  khóa + RAM giảm, máy yếu xác nhận popup.

## 7. Rủi ro còn lại (chấp nhận ở v1)

- Người nói ngôn ngữ khác xuất hiện **sau phút 5** → nhận sai đến hết phiên;
  lối thoát: stop và start phiên mới.
- RAM cửa sổ 5 phút (~305–390 MB trọng số STT) cộng jetsam khi background trên
  các máy sát ngưỡng benchmark — theo dõi qua field log, hạ
  `STRONG_RTF_THRESHOLD` nếu thực tế báo OOM.
- Heuristic chấm điểm là phần mờ nhất — bọc trong hàm thuần + fixture test để
  chỉnh nhanh khi có transcript thật từ field.
