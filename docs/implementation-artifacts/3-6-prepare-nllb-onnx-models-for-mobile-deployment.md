# Story 3.6: Prepare NLLB ONNX models for mobile deployment

Status: ready-for-dev

## Story

As a developer,
I want a script that converts NLLB-600M to optimized int8 ONNX with split decoder,
so that model files are ready for mobile deployment.

## Acceptance Criteria

1. **Given** the `prepare_nllb_mobile.py` script is run
   **When** it completes
   **Then** 4 files are produced: `encoder_model_quantized.onnx`, `decoder_model_quantized.onnx`, `decoder_with_past_model_quantized.onnx`, `sentencepiece.bpe.model`.
2. **Given** the quantized models
   **When** compared to float32 originals
   **Then** BLEU score degradation is ≤2 points on FLORES-200 EN→VI.
3. **Given** the output files
   **When** loaded on mobile
   **Then** total ONNX file size is ≤800MB and RAM usage is ≤800MB.

## Tasks / Subtasks

- [ ] Create `scripts/prepare_nllb_mobile.py` (AC: 1)
  - [ ] Download NLLB-200-distilled-600M from HuggingFace.
  - [ ] Export to ONNX via `optimum` library with separate encoder/decoder exports.
  - [ ] Quantize to int8 via ONNX Runtime quantization tools.
  - [ ] Split decoder into no-cache and with-past variants.
  - [ ] Copy `sentencepiece.bpe.model` to output directory.
- [ ] Validate model quality (AC: 2)
  - [ ] Run BLEU evaluation on FLORES-200 devtest for all 3 language pairs.
  - [ ] Compare float32 vs int8 scores.
- [ ] Validate mobile compatibility (AC: 3)
  - [ ] Load models on Android emulator and iOS simulator.
  - [ ] Measure file sizes and RAM consumption.
  - [ ] Generate SHA-256 checksums for download verification.

## Dev Notes

- This script runs ONCE on a dev machine, not on mobile. Output files are hosted for user download. [Source: {ARCH_REF}#Component Architecture]
- Reference: RTranslator's model conversion approach for selective int8 quantization (keeping some weights in float32 for quality). [Source: {ARCH_REF}#Component Architecture]
