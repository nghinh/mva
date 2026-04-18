import { Platform } from 'react-native';
import { fileModelPath } from 'react-native-sherpa-onnx';
import { createPcmLiveStream } from 'react-native-sherpa-onnx/audio';
import { createSTT } from 'react-native-sherpa-onnx/stt';
import type { PcmLiveStreamHandle } from 'react-native-sherpa-onnx/audio';
import type { SttEngine } from 'react-native-sherpa-onnx/stt';
import type { SessionId, SourceLanguage, UtteranceId } from '../../shared/types/common';
import type { MeetingPipelineEvent } from '../../shared/types/meeting';
import { infoLog } from '../../shared/utils/logger';
import { LanguageDetector } from './LanguageDetector';
import { ensureBundledModelInstalled } from '../models/BundledModelInstaller';

const SAMPLE_RATE = 16000;
const IS_ANDROID = Platform.OS === 'android';
const ANDROID_CAPTURE_CALIBRATION_MS = 1500;

// STT-input gain (applied only to the audio fed to SenseVoice + session
// buffer, NOT to the signal used for speech detection). iOS gets AGC'd
// samples from the OS already; Android's react-native-sherpa-onnx capture
// path picks MediaRecorder.AudioSource.UNPROCESSED and delivers raw mic
// levels, which SenseVoice handles but is unnecessarily quiet. A modest
// boost gives the model a cleaner signal without the distortion that a
// larger gain would introduce by clipping plosives hard.
const STT_INPUT_GAIN = IS_ANDROID ? 6 : 1;

// Detection operates on RAW RMS (pre-gain). Thresholds are platform-specific
// because the two capture paths produce very different absolute levels:
//   - iOS (AGC on): speech ~0.05, silence ~0.002
//   - Android (UNPROCESSED, no AGC): speech ~0.003–0.020, silence ~0.0003–0.001
// Using a single set of thresholds after applying a fixed gain never works
// across devices: gain that is big enough to lift quiet speech above the
// threshold also lifts the silent background above the continue threshold,
// which prevents end-of-utterance from ever firing. Keeping detection on the
// raw signal with platform-tuned thresholds sidesteps that entirely.
//
// Hysteresis: START is the higher bar that ENGAGES the detector; CONTINUE
// is the lower bar that keeps us engaged through intra-word energy dips
// (fricatives, voiceless consonants, inter-syllable pauses). Without the
// two-threshold setup Android fragments sentences into 1–2 word pieces.
const SPEECH_START_THRESHOLD = IS_ANDROID ? 0.004 : 0.020;
const SPEECH_CONTINUE_THRESHOLD = IS_ANDROID ? 0.0015 : 0.008;

// In addition to the absolute thresholds, we maintain a running estimate of
// the noise floor (raw RMS) and require that engagement also beat the noise
// floor by a comfortable ratio. This lets the detector auto-adjust to
// devices that are either noisier or quieter than our baseline assumption.
const NOISE_FLOOR_START_RATIO = 3.5; // RMS must be ≥ noiseFloor * 3.5 to START
const NOISE_FLOOR_CONT_RATIO = 1.8; // and ≥ noiseFloor * 1.8 to CONTINUE
// Seed: a value that sits between typical Android silence (~0.0005) and
// typical Android speech (~0.005). The noise-floor tracker converges to the
// real silence level within ~1–2 s of capture.
const NOISE_FLOOR_SEED = 0.0015;
// EWMA alphas for noise-floor tracking. Fast "follow-down" (when we see a
// quieter chunk than the current estimate) so we settle onto true silence
// quickly at session start. Slow "drift-up" (between speech bursts) so a
// stray noise event doesn't raise the floor and block subsequent speech.
const NOISE_FLOOR_DOWN_ALPHA = 0.2;
const NOISE_FLOOR_UP_ALPHA = 0.005;

// Intra-sentence pauses (breathing, clause boundaries) are 300–700ms. 900ms
// accommodates them while still responding to real sentence boundaries.
const SILENCE_END_MS = IS_ANDROID ? 1400 : 900;

// Shortest utterance worth transcribing. 200ms keeps single-word replies
// ("yes", "có", "ok") instead of cancelling them as too_short.
const MIN_UTTERANCE_MS = 200;
const PARTIAL_INTERVAL_MS = IS_ANDROID ? 900 : 500;
const ANDROID_MIN_PARTIAL_BUFFER_MS = 1200;

// Preroll: when speech starts, prepend the last N ms so we don't lose soft
// onsets (fricatives, low-energy starts of words). The first chunk to cross
// the START threshold is rarely the true beginning of the word.
const PREROLL_MS = 400;
const PREROLL_SAMPLES = Math.floor((SAMPLE_RATE * PREROLL_MS) / 1000);
const ANDROID_UTTERANCE_OVERLAP_MS = 600;
const ANDROID_UTTERANCE_OVERLAP_SAMPLES = Math.floor((SAMPLE_RATE * ANDROID_UTTERANCE_OVERLAP_MS) / 1000);

// Soft cap: once we're past SOFT_MAX, accept a shorter pause as the boundary
// instead of waiting the full SILENCE_END_MS window.
const SOFT_MAX_UTTERANCE_MS = IS_ANDROID ? 14_000 : 10_000;
const SOFT_MAX_SILENCE_MS = IS_ANDROID ? 900 : 250;
// Hard cap — forces a cut to protect downstream latency (SenseVoice re-
// transcribes the full buffer on every partial, and translator output also
// drifts beyond ~15 s).
const MAX_UTTERANCE_SAMPLES = SAMPLE_RATE * (IS_ANDROID ? 20 : 15);

// Periodic diagnostic: emit raw-RMS stats every RMS_STATS_WINDOW_MS so a
// field user can confirm their mic levels match our threshold expectations.
const RMS_STATS_WINDOW_MS = 2000;

interface FinalTranscriptionJob {
  snapshot: number[];
  utteranceId: UtteranceId;
  sessionId: SessionId;
  startMs: number;
  elapsedMs: number;
  revisionAtScheduling: number;
  now: number;
  emit: (event: MeetingPipelineEvent) => void;
}

export class RealSpeechRecognizer {
  private engine: SttEngine | null = null;
  private mic: PcmLiveStreamHandle | null = null;
  private unsubscribeData: (() => void) | null = null;
  private unsubscribeError: (() => void) | null = null;
  private sessionId: SessionId | null = null;
  private detector = new LanguageDetector();
  private utteranceCounter = 0;
  private currentUtteranceId: UtteranceId | null = null;
  private currentRevision = 0;
  private currentText = '';
  private utteranceStartMs = 0;
  private lastSpeechMs = 0;
  private lastPartialMs = 0;
  private sampleBuffer: number[] = [];
  private sessionAudioBuffer: number[] = [];
  private processingChain: Promise<void> = Promise.resolve();
  private inferenceActive = false;
  private emitFn: ((event: MeetingPipelineEvent) => void) | null = null;
  private nextUtteranceSeed: number[] = [];

  // Preroll ring: stores the most recent PREROLL_SAMPLES of STT-ready
  // (gain-adjusted) audio. Rolls continuously so we always have ~400 ms of
  // context available to prepend to the next utterance.
  private prerollRing = new Float32Array(PREROLL_SAMPLES);
  private prerollWritePos = 0;
  private prerollFilled = false;

  // Hysteresis flag: true while the detector is engaged.
  private inSpeech = false;

  // Noise-floor tracker (raw RMS, updated outside of speech).
  private noiseFloorRms = NOISE_FLOOR_SEED;

  // Periodic RMS stats so the pipeline is observable without rebuilding.
  private rmsStatsWindowStart = 0;
  private rmsStatsMin = Infinity;
  private rmsStatsMax = 0;
  private rmsStatsSum = 0;
  private rmsStatsCount = 0;
  private captureCalibrationEndsAt = 0;
  private speechCalibrationWindow: number[] = [];
  private utteranceCalibrationStartMs = 0;
  private lastFinalizeReason: 'silence' | 'soft_cap' | 'hard_cap' | 'stop' | 'too_short' | 'empty_result' | null = null;
  private hardCapCount = 0;

  async start(sessionId: SessionId, emit: (event: MeetingPipelineEvent) => void): Promise<void> {
    this.sessionId = sessionId;
    this.emitFn = emit;
    this.detector.setSession(sessionId);
    this.noiseFloorRms = NOISE_FLOOR_SEED;
    this.captureCalibrationEndsAt = Date.now() + (IS_ANDROID ? ANDROID_CAPTURE_CALIBRATION_MS : 0);
    this.speechCalibrationWindow = [];
    this.lastFinalizeReason = null;
    this.hardCapCount = 0;

    emit({
      type: 'pipeline_status',
      session_id: sessionId,
      status: 'processing',
      timestamp_ms: Date.now(),
      details: 'Preparing SenseVoice bundled model',
    });

    const modelDir = await this.prepareModelDirectory(emit);

    this.engine = await createSTT({
      modelPath: fileModelPath(modelDir),
      modelType: 'sense_voice',
      preferInt8: true,
      provider: 'cpu',
      numThreads: 2,
      modelOptions: {
        senseVoice: {
          useItn: true,
        },
      },
    });

    emit({
      type: 'pipeline_status',
      session_id: sessionId,
      status: 'processing',
      timestamp_ms: Date.now(),
      details: 'SenseVoice recognizer initialized',
    });

    this.mic = createPcmLiveStream({ sampleRate: SAMPLE_RATE, channelCount: 1 });

    let hasSeenPcm = false;
    this.unsubscribeData = this.mic.onData((rawSamples: Float32Array) => {
      if (!hasSeenPcm) {
        hasSeenPcm = true;
        infoLog('[RealSTT] first PCM chunk', {
          platform: Platform.OS,
          size: rawSamples.length,
          sttInputGain: STT_INPUT_GAIN,
          startThreshold: SPEECH_START_THRESHOLD,
          continueThreshold: SPEECH_CONTINUE_THRESHOLD,
          noiseFloorSeed: NOISE_FLOOR_SEED,
        });
        emit({
          type: 'pipeline_status',
          session_id: sessionId,
          status: 'processing',
          timestamp_ms: Date.now(),
          details: 'Microphone PCM received',
        });
      }
      this.handlePcmChunk(rawSamples, emit);
    });

    this.unsubscribeError = this.mic.onError((message: string) => {
      if (!this.sessionId) return;
      emit({
        type: 'pipeline_status',
        session_id: this.sessionId,
        status: 'error',
        timestamp_ms: Date.now(),
        details: message,
      });
    });

    await this.mic.start();

    emit({
      type: 'pipeline_status',
      session_id: sessionId,
      status: 'capturing',
      timestamp_ms: Date.now(),
      details: 'Microphone active',
    });
  }

  async stop(): Promise<void> {
    const emit = this.emitFn ?? (() => undefined);
    // Drain any in-flight utterance via the same snapshot-and-reset path so
    // we don't lose the final sentence when the user stops.
    if (this.currentUtteranceId && this.sampleBuffer.length > 0 && this.sessionId) {
      this.lastFinalizeReason = 'stop';
      this.finalizeUtterance(Date.now(), emit);
      await this.processingChain.catch(() => undefined);
    }
    if (this.unsubscribeData) {
      this.unsubscribeData();
      this.unsubscribeData = null;
    }
    if (this.unsubscribeError) {
      this.unsubscribeError();
      this.unsubscribeError = null;
    }
    if (this.mic) {
      await this.mic.stop();
      this.mic = null;
    }
    if (this.engine) {
      await this.engine.destroy();
      this.engine = null;
    }
    if (this.sessionId) {
      emit({
        type: 'pipeline_status',
        session_id: this.sessionId,
        status: 'idle',
        timestamp_ms: Date.now(),
        details: 'Recognizer stopped',
      });
    }
    this.resetUtterance();
    this.sessionAudioBuffer = [];
    this.prerollWritePos = 0;
    this.prerollFilled = false;
    this.sessionId = null;
    this.emitFn = null;
  }

  getSessionAudioBuffer(): number[] {
    return [...this.sessionAudioBuffer];
  }

  private handlePcmChunk(rawSamples: Float32Array, emit: (event: MeetingPipelineEvent) => void): void {
    const sessionId = this.sessionId;
    if (!sessionId || rawSamples.length === 0) return;

    const now = Date.now();
    // Detection uses RAW RMS so thresholds reference the actual mic level.
    const rawRms = this.computeRms(rawSamples);
    // Audio fed to SenseVoice / session buffer / preroll is gain-adjusted.
    const sttSamples = this.applySttInputGain(rawSamples);

    // Session buffer receives everything (post-session diarization consumes it).
    this.appendSamples(this.sessionAudioBuffer, sttSamples);

    // Periodic RMS telemetry so a field user can verify their device's mic
    // levels match our threshold calibration without rebuilding with a
    // bespoke log line.
    this.accumulateRmsStats(rawRms, now);

    // Dynamic threshold: require either the absolute floor OR a comfortable
    // multiple of the tracked noise floor, whichever is stricter. This gives
    // us a reasonable default while also adapting to loud / quiet devices.
    const startThresh = Math.max(
      SPEECH_START_THRESHOLD,
      this.noiseFloorRms * NOISE_FLOOR_START_RATIO,
    );
    const continueThresh = Math.max(
      SPEECH_CONTINUE_THRESHOLD,
      this.noiseFloorRms * NOISE_FLOOR_CONT_RATIO,
    );

    if (!this.inSpeech && rawRms >= startThresh) {
      this.inSpeech = true;
      infoLog('[RealSTT] speech engaged', {
        rawRms: Number(rawRms.toFixed(5)),
        noiseFloor: Number(this.noiseFloorRms.toFixed(5)),
        startThresh: Number(startThresh.toFixed(5)),
      });
    }
    const isSpeech = this.inSpeech && rawRms >= continueThresh;

    // Noise-floor tracker: update ONLY when we're not in speech, so bursts
    // of loud talk don't corrupt the estimate. Asymmetric EWMA: fast down
    // (converge onto true silence level at session start), slow up (don't
    // ratchet the threshold above real background between utterances).
    if (!this.inSpeech) {
      if (rawRms < this.noiseFloorRms) {
        this.noiseFloorRms =
          this.noiseFloorRms * (1 - NOISE_FLOOR_DOWN_ALPHA) + rawRms * NOISE_FLOOR_DOWN_ALPHA;
      } else {
        this.noiseFloorRms =
          this.noiseFloorRms * (1 - NOISE_FLOOR_UP_ALPHA) + rawRms * NOISE_FLOOR_UP_ALPHA;
      }
    }

    if (IS_ANDROID && now < this.captureCalibrationEndsAt && !this.inSpeech) {
      this.speechCalibrationWindow.push(rawRms);
      if (this.speechCalibrationWindow.length > 30) {
        this.speechCalibrationWindow.shift();
      }
      if (this.speechCalibrationWindow.length >= 10) {
        const avgCalibrationRms =
          this.speechCalibrationWindow.reduce((sum, value) => sum + value, 0) /
          this.speechCalibrationWindow.length;
        this.noiseFloorRms = Math.min(this.noiseFloorRms, avgCalibrationRms);
      }
    }

    if (isSpeech) {
      if (!this.currentUtteranceId) {
        this.currentUtteranceId = `${sessionId}-sense-${++this.utteranceCounter}`;
        this.currentRevision = 0;
        this.currentText = '';
        this.utteranceStartMs = now;
        this.utteranceCalibrationStartMs = now;
        this.sampleBuffer = [];
        if (IS_ANDROID && this.nextUtteranceSeed.length > 0) {
          this.sampleBuffer.push(...this.nextUtteranceSeed);
          this.nextUtteranceSeed = [];
        }
        // Drain preroll BEFORE writing the current chunk to it, so the
        // current chunk is appended exactly once (below). Earlier versions
        // wrote-then-drained-then-appended and produced a duplicated first
        // chunk, which is mild but confuses SenseVoice on short utterances.
        this.drainPrerollInto(this.sampleBuffer);
        this.lastPartialMs = now;
        infoLog('[RealSTT] utterance start', {
          id: this.currentUtteranceId,
          prerollSamples: this.sampleBuffer.length,
          rawRms: Number(rawRms.toFixed(5)),
          noiseFloor: Number(this.noiseFloorRms.toFixed(5)),
        });
      }
      this.lastSpeechMs = now;
    }

    // Preroll always rolls with the STT-ready signal, AFTER any drain above.
    this.writePreroll(sttSamples);

    if (!this.currentUtteranceId) {
      return;
    }

    this.appendSamples(this.sampleBuffer, sttSamples);
    const utteranceDurationMs = now - this.utteranceStartMs;
    const silenceSinceSpeech = this.lastSpeechMs ? now - this.lastSpeechMs : 0;

    if (this.sampleBuffer.length >= MAX_UTTERANCE_SAMPLES) {
      this.hardCapCount += 1;
      this.lastFinalizeReason = 'hard_cap';
      infoLog('[RealSTT] hard-cap final', {
        id: this.currentUtteranceId,
        samples: this.sampleBuffer.length,
        hardCapCount: this.hardCapCount,
      });
      this.finalizeUtterance(now, emit);
      return;
    }

    const partialBufferReady =
      !IS_ANDROID || utteranceDurationMs >= ANDROID_MIN_PARTIAL_BUFFER_MS;
    if (isSpeech && partialBufferReady && !this.inferenceActive && now - this.lastPartialMs >= PARTIAL_INTERVAL_MS) {
      this.lastPartialMs = now;
      this.scheduleInference(() => this.emitPartial(Date.now(), emit));
    }

    if (!isSpeech && silenceSinceSpeech >= SILENCE_END_MS) {
      this.lastFinalizeReason = 'silence';
      infoLog('[RealSTT] silence-final', {
        id: this.currentUtteranceId,
        silenceMs: silenceSinceSpeech,
        samples: this.sampleBuffer.length,
      });
      this.finalizeUtterance(now, emit);
      return;
    }

    if (
      !isSpeech &&
      utteranceDurationMs >= SOFT_MAX_UTTERANCE_MS &&
      silenceSinceSpeech >= SOFT_MAX_SILENCE_MS
    ) {
      infoLog('[RealSTT] soft-cap final', { id: this.currentUtteranceId, utteranceDurationMs });
      this.finalizeUtterance(now, emit);
    }
  }

  // Close the current utterance *synchronously* and queue its transcription.
  // Earlier revisions scheduled emitFinal asynchronously while leaving
  // currentUtteranceId/sampleBuffer live — any chunks arriving before the
  // async task ran were appended to the OLD buffer and then wiped by
  // resetUtterance(), dropping the onset of the next sentence. Snapshot-
  // and-reset here guarantees the next chunk starts a fresh utterance with
  // a clean preroll.
  private finalizeUtterance(now: number, emit: (event: MeetingPipelineEvent) => void): void {
    const utteranceId = this.currentUtteranceId;
    const sessionId = this.sessionId;
    if (!utteranceId || !sessionId) {
      this.resetUtterance();
      return;
    }
    const snapshot = this.sampleBuffer;
    const startMs = this.utteranceStartMs;
    const elapsedMs = Math.max(0, now - startMs);
    const revisionAtScheduling = this.currentRevision;
    if (IS_ANDROID && snapshot.length > 0) {
      const overlapStart = Math.max(0, snapshot.length - ANDROID_UTTERANCE_OVERLAP_SAMPLES);
      this.nextUtteranceSeed = snapshot.slice(overlapStart);
    } else {
      this.nextUtteranceSeed = [];
    }
    this.resetUtterance();
    this.scheduleInference(() =>
      this.runFinalTranscription({
        snapshot,
        utteranceId,
        sessionId,
        startMs,
        elapsedMs,
        revisionAtScheduling,
        now,
        emit,
      }),
    );
  }

  private async prepareModelDirectory(emit: (event: MeetingPipelineEvent) => void): Promise<string> {
    const localModelDir = await ensureBundledModelInstalled('stt', (completed, total, file) => {
      emit({
        type: 'pipeline_status',
        session_id: this.sessionId!,
        status: 'processing',
        timestamp_ms: Date.now(),
        details: `Installing bundled SenseVoice (${completed}/${total}): ${file}`,
      });
    });

    emit({
      type: 'pipeline_status',
      session_id: this.sessionId!,
      status: 'processing',
      timestamp_ms: Date.now(),
      details: `Local model path prepared: ${localModelDir}`,
    });

    return localModelDir;
  }

  private scheduleInference(fn: () => Promise<void>): void {
    this.inferenceActive = true;
    this.processingChain = this.processingChain.then(async () => {
      try {
        await fn();
      } finally {
        this.inferenceActive = false;
      }
    });
  }

  private async emitPartial(now: number, emit: (event: MeetingPipelineEvent) => void): Promise<void> {
    if (!this.engine || !this.sessionId || !this.currentUtteranceId || this.sampleBuffer.length === 0) {
      return;
    }
    const elapsed = now - this.utteranceStartMs;
    if (elapsed < MIN_UTTERANCE_MS) {
      return;
    }
    const bufferToTranscribe = this.sampleBuffer;
    const uttId = this.currentUtteranceId;
    const result = await this.engine.transcribeSamples(bufferToTranscribe, SAMPLE_RATE);
    // State may have changed while we awaited; re-check before emitting so
    // partials from a finalized utterance don't leak into a new one.
    if (this.currentUtteranceId !== uttId) {
      return;
    }
    const text = (result.text ?? '').trim();
    if (!text || text === this.currentText) {
      return;
    }
    this.currentText = text;
    this.currentRevision += 1;
    const lang = this.detectLanguage(text, result.lang);
    emit({
      type: 'stt_partial',
      session_id: this.sessionId,
      utterance_id: uttId,
      text,
      timestamp_ms: now,
      language: lang,
      offset_ms: now - this.utteranceStartMs,
      revision: this.currentRevision,
    });
  }

  private async runFinalTranscription(job: FinalTranscriptionJob): Promise<void> {
    const { snapshot, utteranceId, sessionId, startMs, elapsedMs, revisionAtScheduling, now, emit } = job;
    if (!this.engine) {
      return;
    }
    if (elapsedMs < MIN_UTTERANCE_MS || snapshot.length === 0) {
      this.lastFinalizeReason = 'too_short';
      emit({
        type: 'utterance_cancel',
        session_id: sessionId,
        utterance_id: utteranceId,
        timestamp_ms: now,
        revision: revisionAtScheduling + 1,
        reason: 'too_short',
      });
      infoLog('[RealSTT] utterance_cancel too_short', { id: utteranceId, elapsedMs });
      return;
    }

    const result = await this.engine.transcribeSamples(snapshot, SAMPLE_RATE);
    const text = (result.text ?? '').trim();
    if (!text) {
      this.lastFinalizeReason = 'empty_result';
      emit({
        type: 'utterance_cancel',
        session_id: sessionId,
        utterance_id: utteranceId,
        timestamp_ms: now,
        revision: revisionAtScheduling + 1,
        reason: 'empty_result',
      });
      infoLog('[RealSTT] utterance_cancel empty_result', {
        id: utteranceId,
        samples: snapshot.length,
        durationMs: elapsedMs,
      });
      return;
    }

    const lang = this.detectLanguage(text, result.lang, utteranceId);
    emit({
      type: 'stt_final',
      session_id: sessionId,
      utterance_id: utteranceId,
      text,
      language: lang,
      confidence: 0.9,
      timestamp_ms: now,
      offset_ms: elapsedMs,
      start_ms: startMs,
      end_ms: now,
      revision: revisionAtScheduling + 1,
      audio_samples: snapshot.slice(),
      sample_rate: SAMPLE_RATE,
    });
    infoLog('[RealSTT] stt_final', {
      id: utteranceId,
      chars: text.length,
      durationMs: elapsedMs,
      finalizeReason: this.lastFinalizeReason,
      engageDelayMs: this.utteranceCalibrationStartMs > 0 ? Math.max(0, this.lastSpeechMs - this.utteranceCalibrationStartMs) : 0,
      hardCapCount: this.hardCapCount,
      avgRawRms: this.rmsStatsCount > 0 ? Number((this.rmsStatsSum / this.rmsStatsCount).toFixed(5)) : 0,
    });
  }

  private applySttInputGain(samples: Float32Array): Float32Array {
    if (STT_INPUT_GAIN === 1 || samples.length === 0) return samples;
    const out = new Float32Array(samples.length);
    for (let i = 0; i < samples.length; i += 1) {
      const v = samples[i] * STT_INPUT_GAIN;
      out[i] = v > 1 ? 1 : v < -1 ? -1 : v;
    }
    return out;
  }

  private computeRms(samples: Float32Array): number {
    if (!samples.length) return 0;
    let sumSquares = 0;
    for (let i = 0; i < samples.length; i += 1) {
      const value = samples[i];
      sumSquares += value * value;
    }
    return Math.sqrt(sumSquares / samples.length);
  }

  // Tight-loop append avoids the `target.push(...Array.from(samples))`
  // pattern, which allocates an intermediate Array and risks the Hermes
  // spread-argument limit (~65k) on long utterances.
  private appendSamples(target: number[], samples: Float32Array): void {
    for (let i = 0; i < samples.length; i += 1) {
      target.push(samples[i]);
    }
  }

  private writePreroll(samples: Float32Array): void {
    const ring = this.prerollRing;
    const cap = ring.length;
    if (cap === 0) return;
    let pos = this.prerollWritePos;
    for (let i = 0; i < samples.length; i += 1) {
      ring[pos] = samples[i];
      pos += 1;
      if (pos >= cap) {
        pos = 0;
        this.prerollFilled = true;
      }
    }
    this.prerollWritePos = pos;
  }

  private drainPrerollInto(target: number[]): void {
    const ring = this.prerollRing;
    const cap = ring.length;
    if (cap === 0) return;
    if (this.prerollFilled) {
      for (let i = this.prerollWritePos; i < cap; i += 1) target.push(ring[i]);
      for (let i = 0; i < this.prerollWritePos; i += 1) target.push(ring[i]);
    } else {
      for (let i = 0; i < this.prerollWritePos; i += 1) target.push(ring[i]);
    }
  }

  private accumulateRmsStats(rawRms: number, now: number): void {
    if (this.rmsStatsWindowStart === 0) {
      this.rmsStatsWindowStart = now;
    }
    if (rawRms < this.rmsStatsMin) this.rmsStatsMin = rawRms;
    if (rawRms > this.rmsStatsMax) this.rmsStatsMax = rawRms;
    this.rmsStatsSum += rawRms;
    this.rmsStatsCount += 1;

    if (now - this.rmsStatsWindowStart >= RMS_STATS_WINDOW_MS) {
      const avg = this.rmsStatsCount > 0 ? this.rmsStatsSum / this.rmsStatsCount : 0;
      infoLog('[RealSTT] rms stats', {
        min: Number(this.rmsStatsMin.toFixed(5)),
        max: Number(this.rmsStatsMax.toFixed(5)),
        avg: Number(avg.toFixed(5)),
        noiseFloor: Number(this.noiseFloorRms.toFixed(5)),
        chunks: this.rmsStatsCount,
        windowMs: now - this.rmsStatsWindowStart,
        inSpeech: this.inSpeech,
      });
      this.rmsStatsWindowStart = now;
      this.rmsStatsMin = Infinity;
      this.rmsStatsMax = 0;
      this.rmsStatsSum = 0;
      this.rmsStatsCount = 0;
    }
  }

  private resetUtterance(): void {
    this.currentUtteranceId = null;
    this.currentText = '';
    this.currentRevision = 0;
    this.utteranceStartMs = 0;
    this.utteranceCalibrationStartMs = 0;
    this.lastSpeechMs = 0;
    this.lastPartialMs = 0;
    this.sampleBuffer = [];
    this.inSpeech = false;
  }

  private detectLanguage(
    text: string,
    langFromModel?: string,
    utteranceId?: UtteranceId | null,
  ): SourceLanguage {
    const normalized = (langFromModel ?? '').toLowerCase();
    if (normalized.startsWith('en')) return 'en';
    if (normalized.startsWith('ja') || normalized.startsWith('jp')) return 'ja';
    if (normalized.startsWith('ko')) return 'ko';
    if (normalized.startsWith('zh') || normalized.startsWith('cn')) return 'zh';
    const id = utteranceId ?? this.currentUtteranceId ?? 'unknown';
    const detected = this.detector.detectFromText(text, id);
    return detected.language;
  }
}

let recognizerInstance: RealSpeechRecognizer | null = null;
export function getRealSpeechRecognizer(): RealSpeechRecognizer {
  if (!recognizerInstance) {
    recognizerInstance = new RealSpeechRecognizer();
  }
  return recognizerInstance;
}