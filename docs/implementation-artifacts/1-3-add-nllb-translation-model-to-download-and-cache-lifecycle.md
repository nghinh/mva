# Story 1.3: Add NLLB translation model to download and cache lifecycle

Status: ready-for-dev

## Story

As a developer,
I want the NLLB-600M translation model files downloaded, cached, and managed alongside the STT model,
so that on-device translation is available offline after first setup.

## Acceptance Criteria

1. **Given** the user triggers model download
   **When** STT model download completes
   **Then** NLLB model download begins automatically with progress indicator showing 4 files (encoder, decoder, decoder_with_past, sentencepiece.bpe.model).
2. **Given** all NLLB model files are cached
   **When** app launches subsequently
   **Then** NLLB models load from cache without re-download.
3. **Given** user wants to free storage
   **When** user goes to Settings > Model Management
   **Then** they can see storage used by each model and delete individual models.

## Tasks / Subtasks

- [ ] Define NLLB model manifest (AC: 1)
  - [ ] Create model config: file names, sizes, URLs, SHA-256 checksums.
  - [ ] Files: `encoder_model_quantized.onnx` (~350MB), `decoder_model_quantized.onnx` (~200MB), `decoder_with_past_model_quantized.onnx` (~200MB), `sentencepiece.bpe.model` (~5MB).
- [ ] Extend ModelManager service for multi-model download (AC: 1, 2)
  - [ ] Download files sequentially within each model group.
  - [ ] Track per-file and per-model progress.
  - [ ] Cache to `models/nllb-600m-int8/` directory.
- [ ] Implement model deletion and storage reporting (AC: 3)
  - [ ] Calculate total size per model group.
  - [ ] Delete model files and clear cache on user request.
  - [ ] Show "Model not ready" state if translation model is deleted.

## Dev Notes

- NLLB model uses split decoder architecture: 3 separate ONNX files to avoid ONNX Runtime crash with If-node in merged decoder. [Source: {ARCH_REF}#ADR-004]
- Model files sourced from RTranslator/InstantVoiceTranslate conversion pipeline or prepared via `scripts/prepare_nllb_mobile.py`. [Source: {ARCH_REF}#Component Architecture]
