# Story 1.4: Pre-warm STT and translation models before first use

Status: ready-for-dev

## Story

As a user,
I want both the STT and translation models warmed up during splash screen,
so that the first real utterance is transcribed and translated without cold-start delay.

## Acceptance Criteria

1. **Given** models are cached and app launches
   **When** splash screen is displayed
   **Then** SenseVoice STT model is loaded into memory and a dummy inference is executed.
2. **Given** STT warm-up completes
   **When** NLLB model warm-up begins
   **Then** NLLB encoder, decoder, and decoder_with_past sessions are loaded and a dummy translation ("Hello" → Vietnamese) is executed.
3. **Given** both warm-ups complete
   **When** first real speech occurs
   **Then** STT latency is ≤400ms and translation latency is within normal range (no >200ms cold-start penalty).

## Tasks / Subtasks

- [ ] Implement STT model warm-up via react-native-sherpa-onnx (AC: 1)
  - [ ] Call sherpa-onnx initialize with SenseVoice model path.
  - [ ] Run dummy audio buffer through STT pipeline.
- [ ] Implement NLLB model warm-up via NllbTranslatorModule (AC: 2)
  - [ ] Call `NllbTranslator.initialize(modelDir)` to load ONNX sessions.
  - [ ] Run dummy translation: `translate("Hello", "eng_Latn", "vie_Latn")`.
  - [ ] Verify all 3 ONNX sessions (encoder, decoder, decoder_with_past) are loaded.
- [ ] Show warm-up progress on splash screen (AC: 1, 2)
  - [ ] Display "Loading AI models..." with progress indicator.
  - [ ] Navigate to Home when both models are ready.
- [ ] Measure and log warm-up time (AC: 3)
  - [ ] Log time for each model load + dummy inference.
  - [ ] Target: total warm-up ≤5s on flagship device.

## Dev Notes

- Both models share device CPU/RAM. Total RAM budget: ~1.1-1.3GB for both. [Source: {ARCH_REF}#Resource Budget]
- ONNX Runtime on Android uses NNAPI execution provider for hardware acceleration. On iOS, CoreML execution provider targets Apple Neural Engine. [Source: {ARCH_REF}#Component Architecture]
- Warm-up is critical because first ONNX Runtime inference allocates memory and optimizes graph. Subsequent inferences are 2-3x faster. [Source: {ARCH_REF}#ADR-003]
