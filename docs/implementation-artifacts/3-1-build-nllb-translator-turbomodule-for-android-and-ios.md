# Story 3.1: Build NllbTranslator TurboModule for Android and iOS

Status: ready-for-dev

## Story

As a developer,
I want a React Native TurboModule that wraps ONNX Runtime Mobile for NLLB-600M inference,
so that on-device translation is available from JavaScript with native performance.

## Acceptance Criteria

1. **Given** NLLB ONNX model files are in local storage
   **When** JS calls `NllbTranslator.initialize(modelDir)`
   **Then** three ONNX Runtime sessions are created (encoder, decoder, decoder_with_past) and the SentencePiece tokenizer is loaded.
2. **Given** the module is initialized
   **When** JS calls `NllbTranslator.translate("Hello world", "eng_Latn", "vie_Latn")`
   **Then** a Vietnamese translation string is returned within 2 seconds on a flagship device.
3. **Given** inference is running
   **When** inspecting the main thread
   **Then** all ONNX inference runs on a background thread — the UI thread is never blocked.
4. **Given** both Android and iOS builds
   **When** the same JS API is called
   **Then** both platforms produce equivalent translations using identical ONNX models.

## Tasks / Subtasks

- [ ] Implement Android TurboModule (AC: 1, 2, 3)
  - [ ] Create `NllbTranslatorModule.kt` — TurboModule entry, expose `initialize()`, `translate()`, `isLoaded()`, `unload()`.
  - [ ] Create `NllbTranslatorHelper.kt` — Load 3 ONNX sessions with NNAPI execution provider (fallback to CPU/XNNPACK).
  - [ ] Create `SentencePieceTokenizer.kt` — Pure Kotlin BPE encode/decode from `sentencepiece.bpe.model`. No JNI dependencies.
  - [ ] Create `NllbTranslatorPackage.kt` — Module registration.
  - [ ] Run inference on `Dispatchers.Default` coroutine (background thread).
- [ ] Implement iOS TurboModule (AC: 1, 2, 3, 4)
  - [ ] Create `NllbTranslatorModule.swift` — TurboModule entry.
  - [ ] Create `NllbTranslatorHelper.swift` — ONNX Runtime with CoreML execution provider for Apple Neural Engine.
  - [ ] Create `SentencePieceTokenizer.swift` — Pure Swift BPE encode/decode.
  - [ ] Create `NllbTranslatorModule.mm` — ObjC++ bridge for TurboModule registration.
  - [ ] Run inference on `Task.detached` (background thread).
- [ ] Create TypeScript interface (AC: 1, 2)
  - [ ] `native/NativeNllbTranslator.ts` — TurboModule spec: `initialize(modelDir: string): Promise<boolean>`, `translate(text: string, srcLang: string, tgtLang: string): Promise<string>`, `isLoaded(): boolean`, `unload(): void`.
- [ ] Test on both platforms (AC: 2, 4)
  - [ ] Unit test: translate 10 sample sentences EN→VI, JA→VI, KO→VI.
  - [ ] Benchmark: measure p50/p99 latency per language pair.
  - [ ] Memory test: verify RAM stays within budget (~500-800MB for NLLB).

## Dev Notes

- Split decoder is mandatory: ONNX Runtime Mobile crashes with If-node in merged decoder. Use `decoder_model_quantized.onnx` (first token, no KV cache) + `decoder_with_past_model_quantized.onnx` (subsequent tokens with KV cache). [Source: {ARCH_REF}#ADR-004]
- Reference implementations: RTranslator (github.com/niedev/RTranslator) for ONNX + KV cache pattern, InstantVoiceTranslate (github.com/IliyaBrook/InstantVoiceTranslate) for split decoder + pure Kotlin SentencePiece tokenizer. [Source: {ARCH_REF}#Component Architecture]
- NLLB language codes: eng_Latn, jpn_Jpan, kor_Hang → vie_Latn. [Source: {ARCH_REF}#Component Architecture]
- This is the highest-risk story (13 story points) and the critical path of the entire project. [Source: {EPICS_REF}#Story Dependency Graph]
