# Story 2.5: Emit final transcript and detected language at utterance end

Status: ready-for-dev

## Story

As a user,
I want to see the finalized transcription with correct language label when a speaker finishes,
so that I have an accurate record of what was said.

## Acceptance Criteria

1. **Given** a speaker finishes a sentence (VAD detects >600ms silence)
   **When** the STT engine processes the final audio
   **Then** a final transcript result is emitted with `is_final=true`, complete text, and detected language code.
2. **Given** the final result is emitted
   **When** compared to the previous partial
   **Then** the final text may differ from the last partial (more accurate) and replaces it cleanly in the UI.
3. **Given** the detected language
   **When** displayed
   **Then** a language badge (EN blue / JA red / KO green) appears next to the utterance.

## Tasks / Subtasks

- [ ] Configure final result emission from sherpa-onnx (AC: 1)
  - [ ] Final result includes: text, lang ("en"/"ja"/"ko"), utterance_id, timestamp, is_final=true.
  - [ ] SenseVoice auto-detect provides language code with ≥95% accuracy for utterances ≥3 words.
- [ ] Handle partial → final transition in store (AC: 2)
  - [ ] Replace current partial utterance with final version.
  - [ ] Mark `isFinal: true` in conversation store.
  - [ ] Trigger final on-device translation (cancels any in-progress partial translation for this utterance).
- [ ] Render language badge in Transcript Lane (AC: 3)
  - [ ] LangBadge component: EN (#3B82F6), JA (#EF4444), KO (#22C55E).
  - [ ] Badge positioned at start of utterance text.
- [ ] Persist final utterance to SQLite (AC: 1, 2)
  - [ ] Write utterance record: id, session_id, text, lang, timestamp.

## Dev Notes

- Final result triggers on-device translation via NllbTranslatorModule. No server call. [Source: {ARCH_REF}#Data Flow]
- Language detection accuracy is critical for NLLB — wrong source language code produces garbage translation. [Source: {ARCH_REF}#Component Architecture]
