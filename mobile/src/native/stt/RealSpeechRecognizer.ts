import {fileModelPath} from 'react-native-sherpa-onnx';
import {createPcmLiveStream} from 'react-native-sherpa-onnx/audio';
import {createSTT} from 'react-native-sherpa-onnx/stt';
import {
  MainBundlePath,
  DocumentDirectoryPath,
  copyFile,
  exists,
  mkdir,
  readDir,
} from '@dr.pogodin/react-native-fs';
import type {PcmLiveStreamHandle} from 'react-native-sherpa-onnx/audio';
import type {SttEngine} from 'react-native-sherpa-onnx/stt';
import type {SessionId, SourceLanguage, UtteranceId} from '../../shared/types/common';
import type {MeetingPipelineEvent} from '../../shared/types/meeting';
import {LanguageDetector} from './LanguageDetector';

const LOCAL_MODEL_FOLDER = 'sherpa-onnx-sense-voice-zh-en-ja-ko-yue-int8-2024-07-17';
const SAMPLE_RATE = 16000;
const SPEECH_THRESHOLD = 0.02;
const SILENCE_END_MS = 600;
const MIN_UTTERANCE_MS = 300;
const PARTIAL_INTERVAL_MS = 500;
const MAX_UTTERANCE_SAMPLES = SAMPLE_RATE * 5; // 5 seconds max

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

        if (this.sampleBuffer.length >= MAX_UTTERANCE_SAMPLES) {
          this.scheduleInference(() => this.emitFinal(Date.now(), emit));
          return;
        }

        if (isSpeech && !this.inferenceActive && now - this.lastPartialMs >= PARTIAL_INTERVAL_MS) {
          this.lastPartialMs = now;
          this.scheduleInference(() => this.emitPartial(Date.now(), emit));
        }

        if (!isSpeech && this.lastSpeechMs && now - this.lastSpeechMs >= SILENCE_END_MS) {
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
    this.sessionId = null;
    this.emitFn = null;
  }

  private async prepareModelDirectory(emit: (event: MeetingPipelineEvent) => void): Promise<string> {
    if (!MainBundlePath) {
      throw new Error('MainBundlePath unavailable on iOS; cannot resolve bundled SenseVoice model');
    }
    const bundleModelDir = `${MainBundlePath}/models/${LOCAL_MODEL_FOLDER}`;
    const bundleExists = await exists(bundleModelDir);

    emit({
      type: 'pipeline_status',
      session_id: this.sessionId!,
      status: 'processing',
      timestamp_ms: Date.now(),
      details: `Bundle model exists: ${bundleExists ? 'yes' : 'no'}`,
    });

    if (!bundleExists) {
      throw new Error(`Bundled model directory not found at ${bundleModelDir}`);
    }

    const bundleEntries = await readDir(bundleModelDir);
    const modelFile = bundleEntries.find(file => file.name.startsWith('model') && file.name.endsWith('.onnx'))?.name;
    const tokens = bundleEntries.find(file => file.name === 'tokens.txt')?.name;

    if (!modelFile) throw new Error('Bundled SenseVoice model file missing: model*.onnx');
    if (!tokens) throw new Error('Bundled SenseVoice model file missing: tokens.txt');

    const requiredFiles = [modelFile, tokens];

    const localBase = `${DocumentDirectoryPath}/models`;
    const localModelDir = `${localBase}/${LOCAL_MODEL_FOLDER}`;
    await mkdir(localBase, {NSURLIsExcludedFromBackupKey: true});
    await mkdir(localModelDir, {NSURLIsExcludedFromBackupKey: true});

    const currentFiles = await readDir(localModelDir).catch(() => []);
    const currentNames = new Set(currentFiles.map(file => file.name));

    for (const file of requiredFiles) {
      if (!currentNames.has(file)) {
        await copyFile(`${bundleModelDir}/${file}`, `${localModelDir}/${file}`);
      }
    }

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
