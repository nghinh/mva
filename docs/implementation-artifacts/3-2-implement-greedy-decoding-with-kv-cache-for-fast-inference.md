# Story 3.2: Implement greedy decoding with KV cache for fast inference

Status: ready-for-dev

## Story

As a developer,
I want the NLLB decoder to use greedy decoding with KV cache,
so that translation speed is maximized on mobile CPU.

## Acceptance Criteria

1. **Given** an input sentence of 20 words
   **When** greedy decoding runs with KV cache
   **Then** translation completes in ≤1500ms on flagship device (vs ~5000ms without KV cache).
2. **Given** the decoder runs autoregressively
   **When** each token is generated
   **Then** only the new token embedding is processed (not the full sequence), using cached key-value tensors from previous steps.
3. **Given** max_length is set to 128 tokens
   **When** generation reaches 128 tokens or EOS token
   **Then** decoding stops and the result is returned.

## Tasks / Subtasks

- [ ] Implement autoregressive decoding loop (AC: 1, 2, 3)
  - [ ] Step 1: Run encoder on input_ids → encoder_hidden_states (one-time).
  - [ ] Step 2: First decoder step with `decoder_model_quantized.onnx` → logits + kv_cache.
  - [ ] Step 3: Subsequent steps with `decoder_with_past_model_quantized.onnx` → logits + updated kv_cache.
  - [ ] Step 4: argmax(logits) for greedy token selection (no beam search).
  - [ ] Step 5: Stop at EOS token or max_length=128.
- [ ] Implement KV cache tensor management (AC: 2)
  - [ ] Pass kv_cache output from step N as input to step N+1.
  - [ ] Manage tensor memory lifecycle to avoid leaks.
  - [ ] Clear KV cache between translation calls.
- [ ] Benchmark with and without KV cache (AC: 1)
  - [ ] Measure latency difference on 10/20/50 word sentences.
  - [ ] Expected: 5-10x speedup with KV cache for longer sentences.

## Dev Notes

- Greedy decoding (argmax) chosen over beam search for speed. Beam search is 3-5x slower on CPU with minimal quality gain for 600M model. [Source: {ARCH_REF}#ADR-003]
- KV cache is the single most impactful optimization for autoregressive decoder speed. Without it, each step recomputes attention over all previous tokens. [Source: {ARCH_REF}#ADR-004]
