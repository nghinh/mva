import {fileModelPath} from 'react-native-sherpa-onnx';
import {createPcmLiveStream} from 'react-native-sherpa-onnx/audio';
import {createSTT} from 'react-native-sherpa-onnx/stt';
import {DocumentDirectoryPath} from '@dr.pogodin/react-native-fs';
import type {PcmLiveStreamHandle} from 'react-native-sherpa-onnx/audio';
import type {SttEngine} from 'react-native-sherpa-onnx/stt';
import type {SessionId, SourceLanguage, UtteranceId} from '../../shared/types/common';
import type {MeetingPipelineEvent} from '../../shared/types/meeting';
import {LanguageDetector} from './LanguageDetector';
import {ensureBundledModelInstalled} from '../models/BundledModelInstaller';

const SAMPLE_RATE = 16000;
const SPEECH_THRESHOLD = 0.02;
// Natural intra-sentence pauses (breathing, thinking, clause boundaries) are
// typically 300-700ms. 400ms was cutting those off and fragmenting sentences.
// 900ms lets speakers breathe without ending the utterance, while still keeping
// endpoint detection responsive for genuine sentence boundaries.
const SILENCE_END_MS = 900;
const MIN_UTTERANCE_MS = 300;
const PARTIAL_INTERVAL_MS = 500;
// Soft cap: once past this, we prefer to end the utterance at the next quiet
// chunk (even a brief <900ms pause) rather than waiting the full silence
// window. Prevents run-on utterances from rambling speakers while still
// respecting natural boundaries.
const SOFT_MAX_UTTERANCE_MS = 10_000;
const SOFT_MAX_SILENCE_MS = 250;
// Hard cap: at 15s we force a cut regardless of speech state. Protects STT
// latency (SenseVoice re-transcribes the full buffer on every partial, and
// beyond ~15s the translator output also starts drifting in quality).
const MAX_UTTERANCE_SAMPLES = SAMPLE_RATE * 15;

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

  async start(sessionId: SessionId, emit: (event: MeetingPipelineEvent) => void): Promise<void> {
    this.sessionId = sessionId;
    this.emitFn = emit;
    this.detector.setSession(sessionId);

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

    this.mic = createPcmLiveStream({sampleRate: SAMPLE_RATE, channelCount: 1});

    let hasSeenPcm = false;
    this.unsubscribeData = this.mic.onData((samples: Float32Array) => {
      if (!hasSeenPcm) {
        hasSeenPcm = true;
        emit({
          type: 'pipeline_status',
          session_id: sessionId,
          status: 'processing',
          timestamp_ms: Date.now(),
          details: 'Microphone PCM received',
        });
      }
      const now = Date.now();
      const rms = this.computeRms(samples);
      const isSpeech = rms >= SPEECH_THRESHOLD;
      this.sessionAudioBuffer.push(...Array.from(samples));

      if (isSpeech) {
        if (!this.currentUtteranceId) {
          this.currentUtteranceId = `${sessionId}-sense-${++this.utteranceCounter}`;
          this.currentRevision = 0;
          this.currentText = '';
          this.utteranceStartMs = now;
          this.sampleBuffer = [];
          this.lastPartialMs = now;
        }
        this.lastSpeechMs = now;
      }

      if (this.currentUtteranceId) {
        this.sampleBuffer.push(...Array.from(samples));
        const utteranceDurationMs = now - this.utteranceStartMs;
        const silenceSinceSpeech = this.lastSpeechMs ? now - this.lastSpeechMs : 0;

        // Hard cap — force cut regardless of speech state. Protects the
        // downstream pipeline from unbounded buffers.
        if (this.sampleBuffer.length >= MAX_UTTERANCE_SAMPLES) {
          this.scheduleInference(() => this.emitFinal(Date.now(), emit));
          return;
        }

        if (isSpeech && !this.inferenceActive && now - this.lastPartialMs >= PARTIAL_INTERVAL_MS) {
          this.lastPartialMs = now;
          this.scheduleInference(() => this.emitPartial(Date.now(), emit));
        }

        // Natural endpoint: full silence window after speech.
        if (!isSpeech && this.lastSpeechMs && silenceSinceSpeech >= SILENCE_END_MS) {
          this.scheduleInference(() => this.emitFinal(Date.now(), emit));
          return;
        }

        // Soft cap: once the utterance is long enough that we'd rather end it
        // than keep accumulating, grab the next shortish pause (~250ms) as a
        // boundary instead of waiting for the full 900ms silence window.
        if (
          !isSpeech &&
          this.lastSpeechMs &&
          utteranceDurationMs >= SOFT_MAX_UTTERANCE_MS &&
          silenceSinceSpeech >= SOFT_MAX_SILENCE_MS
        ) {
          this.scheduleInference(() => this.emitFinal(Date.now(), emit));
        }
      }
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
    if (this.currentUtteranceId && this.sampleBuffer.length > 0) {
      await this.emitFinal(Date.now(), emit);
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
    this.sessionId = null;
    this.emitFn = null;
  }

  getSessionAudioBuffer(): number[] {
    return [...this.sessionAudioBuffer];
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
    const result = await this.engine.transcribeSamples(this.sampleBuffer, SAMPLE_RATE);
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
      utterance_id: this.currentUtteranceId,
      text,
      timestamp_ms: now,
      language: lang,
      offset_ms: now - this.utteranceStartMs,
      revision: this.currentRevision,
    });
  }

  private async emitFinal(now: number, emit: (event: MeetingPipelineEvent) => void): Promise<void> {
    if (!this.engine || !this.sessionId || !this.currentUtteranceId || this.sampleBuffer.length === 0) {
      this.resetUtterance();
      return;
    }
    const elapsed = now - this.utteranceStartMs;
    if (elapsed < MIN_UTTERANCE_MS) {
      emit({
        type: 'utterance_cancel',
        session_id: this.sessionId,
        utterance_id: this.currentUtteranceId,
        timestamp_ms: now,
        revision: this.currentRevision + 1,
        reason: 'too_short',
      });
      this.resetUtterance();
      return;
    }

    const result = await this.engine.transcribeSamples(this.sampleBuffer, SAMPLE_RATE);
    const text = (result.text ?? '').trim();
    if (!text) {
      emit({
        type: 'utterance_cancel',
        session_id: this.sessionId,
        utterance_id: this.currentUtteranceId,
        timestamp_ms: now,
        revision: this.currentRevision + 1,
        reason: 'empty_result',
      });
      this.resetUtterance();
      return;
    }

    this.currentRevision += 1;
    const lang = this.detectLanguage(text, result.lang);
    emit({
      type: 'stt_final',
      session_id: this.sessionId,
      utterance_id: this.currentUtteranceId,
      text,
      language: lang,
      confidence: 0.9,
      timestamp_ms: now,
      offset_ms: now - this.utteranceStartMs,
      start_ms: this.utteranceStartMs,
      end_ms: now,
      revision: this.currentRevision,
      audio_samples: [...this.sampleBuffer],
      sample_rate: SAMPLE_RATE,
    });
    this.resetUtterance();
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

  private resetUtterance(): void {
    this.currentUtteranceId = null;
    this.currentText = '';
    this.currentRevision = 0;
    this.utteranceStartMs = 0;
    this.lastSpeechMs = 0;
    this.lastPartialMs = 0;
    this.sampleBuffer = [];
    this.inferenceActive = false;
  }

  private detectLanguage(text: string, langFromModel?: string): SourceLanguage {
    const normalized = (langFromModel ?? '').toLowerCase();
    if (normalized.startsWith('en')) return 'en';
    if (normalized.startsWith('ja') || normalized.startsWith('jp')) return 'ja';
    if (normalized.startsWith('ko')) return 'ko';
    if (normalized.startsWith('zh') || normalized.startsWith('cn')) return 'zh';
    const detected = this.detector.detectFromText(text, this.currentUtteranceId ?? 'unknown');
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
