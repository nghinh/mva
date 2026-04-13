# Story 3.4: Translate partial STT results as draft translations

Status: ready-for-dev

## Story

As a user,
I want to see a draft translation while the speaker is still talking,
so that I can start understanding before the sentence is complete.

## Acceptance Criteria

1. **Given** a partial STT result reaches ≥5 words (EN) or ≥12 grapheme clusters (JA/KO)
   **When** the threshold is met
   **Then** on-device translation fires and a "draft" translation appears in the Translation Lane at 0.75 opacity with amber "draft" label.
2. **Given** a draft translation is displayed
   **When** the final STT result arrives and final translation completes
   **Then** the draft is smoothly replaced by the final translation (opacity transition 200ms), and the "draft" label disappears.
3. **Given** a draft translation is in progress
   **When** a new partial STT result arrives for the same utterance
   **Then** the previous draft translation is cancelled and a new one starts with the updated text.

## Tasks / Subtasks

- [ ] Implement partial translation trigger in PipelineOrchestrator (AC: 1, 3)
  - [ ] On `stt_partial`: check word/cluster count threshold.
  - [ ] If threshold met: call `NllbTranslator.translate()` on background thread.
  - [ ] Implement cancellation: use version counter — if new partial arrives before translation completes, increment counter and ignore stale result.
- [ ] Update store with draft translations (AC: 1)
  - [ ] Set `translation: { text, isFinal: false, source: 'device' }` in Zustand.
- [ ] Implement draft → final smooth transition in UI (AC: 2)
  - [ ] TranslationLane: render entries with `isFinal=false` at opacity 0.75 with DraftIndicator.
  - [ ] On final translation: animate opacity 0.75→0 (150ms), then replace text and animate 0→1.0 (150ms).
  - [ ] If final text identical to draft: just remove DraftIndicator (no text change animation).

## Dev Notes

- Draft translations are NOT persisted to SQLite — only final translations are saved. [Source: {ARCH_REF}#Local Storage]
- Translation cancellation is critical to avoid wasted CPU: if the speaker says 15 words but the first 5-word partial triggered a translation, that translation should be cancelled when the 10-word partial arrives. [Source: {ARCH_REF}#Pipeline Orchestrator]
