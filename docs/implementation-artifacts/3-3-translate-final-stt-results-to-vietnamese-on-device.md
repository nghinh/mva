# Story 3.3: Translate final STT results to Vietnamese on-device

Status: ready-for-dev

## Story

As a user,
I want each finalized transcript automatically translated to Vietnamese on my phone,
so that I can understand what was said without any internet connection.

## Acceptance Criteria

1. **Given** STT emits a final result with text="The quarterly report shows growth" and lang="en"
   **When** the pipeline orchestrator receives it
   **Then** on-device NLLB translates to Vietnamese and displays result in the Translation Lane within 2 seconds.
2. **Given** speech in Japanese "四半期の報告書は成長を示しています"
   **When** translated on-device
   **Then** Vietnamese translation appears with correct meaning and BLEU ≥20 on test set.
3. **Given** the device has no internet connection (airplane mode)
   **When** translation runs
   **Then** it works identically to when internet is available — zero difference in behavior.

## Tasks / Subtasks

- [ ] Wire PipelineOrchestrator to trigger translation on STT final (AC: 1, 3)
  - [ ] On `stt_final` event: extract text + lang, map to NLLB language code, call `NllbTranslator.translate()`.
  - [ ] On result: update Zustand store with `translation: { text, isFinal: true, source: 'device' }`.
  - [ ] On error: log warning, display "Translation failed" placeholder.
- [ ] Implement language code mapping (AC: 1, 2)
  - [ ] `en` → `eng_Latn`, `ja` → `jpn_Jpan`, `ko` → `kor_Hang`, target always `vie_Latn`.
- [ ] Persist translation alongside utterance (AC: 1)
  - [ ] Write to SQLite `translations` table: utterance_id, text, latency_ms.
- [ ] Quality validation per language pair (AC: 2)
  - [ ] Test with FLORES-200 devtest sentences for EN→VI, JA→VI, KO→VI.
  - [ ] Target BLEU scores: EN→VI ≥25, JA→VI ≥20, KO→VI ≥18.

## Dev Notes

- If KO→VI BLEU < 18, consider two-hop translation: KO→EN→VI (run NLLB twice). [Source: {PRD_REF}#Risks]
- Translation runs on background thread. UI continues to receive STT events during translation. [Source: {ARCH_REF}#Pipeline Orchestrator]
