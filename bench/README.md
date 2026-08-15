# Phase 0 — Benchmark STT Tiếng Việt

Cổng go/no-go trước khi tích hợp engine tiếng Việt vào app.
Bối cảnh & kế hoạch đầy đủ: xem `Ke-hoach-STT-Tieng-Viet.docx` ở gốc repo.

## Kết quả lần chạy đầu — 16/08/2026

FLEURS-vi test, 200 câu (42.4 phút audio), Mac CPU 4 threads:

| Model | WER | RTF (Mac) | Kết luận |
|---|---:|---:|---|
| **zipformer-vi** (Apache, ứng viên chính) | **10.09%** | 0.025 | ✅ Vượt chuẩn ≤15%, chỉ kém bản NC 0.58 điểm |
| zipformer-vi-30m (NC-ND, trần tham chiếu) | 9.51% | 0.023 | Đúng như WER công bố |
| sense-voice (baseline app hiện tại) | 99.71% | 0.046 | Tiếng Việt hôm nay = hỏng hoàn toàn (đã định lượng) |
| omnilingual-300m (vé số C3, fp32) | 26.77% | 0.234 | ❌ **Loại C3** — WER gấp 2.65×, chậm gấp 9× |

Lưu ý: FLEURS là giọng đọc sạch → cận trên lạc quan. Cổng go/no-go chính thức
vẫn phải chốt trên audio họp thật (mục dưới).

## Chạy

```bash
# 1. Tải model + bộ test FLEURS-vi (~600MB, một lần)
./download.sh

# 2. Môi trường (một lần)
python3 -m venv venv && venv/bin/pip install sherpa-onnx soundfile numpy

# 3. Chạy benchmark
venv/bin/python run_bench.py list                      # xem model nào đã sẵn sàng
venv/bin/python run_bench.py run --model all           # 4 model × 200 câu FLEURS
venv/bin/python run_bench.py summary                   # bảng tổng hợp
```

Kết quả: `results/summary.csv` (tổng hợp) + `results/<model>.jsonl` (từng câu,
có ref/hyp để soi lỗi cụ thể).

## Model đo

| Tên | Vai trò | License |
|---|---|---|
| `zipformer-vi` | **Ứng viên chính** — 70k giờ tiếng Việt | Apache-2.0 (đang chờ pháp chế xác nhận) |
| `zipformer-vi-30m` | Trần tham chiếu (WER công bố 8–12%) | CC-BY-NC-ND — **không được ship** |
| `sense-voice` | Baseline hiện tại của app (không có vi) | — |
| `omnilingual-300m` | Vé số phương án C3 (Meta, 1600 ngôn ngữ) | Apache-2.0 |

## Đo bằng audio họp thật (quan trọng nhất)

FLEURS là giọng đọc → con số lạc quan hơn thực tế. Cổng go/no-go phải chốt trên
audio họp thật:

1. Chuẩn bị thư mục các cặp file: `cau1.wav` (16kHz mono) + `cau1.txt` (transcript).
   Cắt theo câu/lượt nói, 30–60 phút tổng là đủ.
2. Chạy: `venv/bin/python run_bench.py run --model all --dataset meeting --meeting-dir /path/to/dir`

## Tiêu chí đạt (đã chốt trong kế hoạch)

- WER ≤ ~15% trên audio họp thật
- Phản hồi partial p95 < 2 giây trên iPhone (xem mục dưới)

## Việc còn lại của Phase 0 (ngoài script này)

- [ ] **RTF trên iPhone thật** — RTF trong summary.csv là số Mac (CPU); cần đo
      `transcribeSamples` với buffer 5/10/15s trên iPhone 12 + máy đời thấp nhất
      (viết dev-screen nhỏ trong app, Phase 1 sẽ dùng lại)
- [ ] **Audio họp nội bộ có consent** — bộ test thật (mục trên)
- [ ] **Pháp chế xác nhận license** `zzasdf/viet_iter3_pseudo_label` (Apache-2.0
      mới ở mức metadata HF) — song song, không chặn benchmark
- [ ] (Tuỳ chọn) GigaSpeech2-vi TEST — 10 giờ người gán nhãn, gần văn nói hơn FLEURS:
      https://huggingface.co/datasets/speechcolab/gigaspeech2
