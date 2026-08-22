import { NativeEventEmitter, NativeModules, Platform } from 'react-native';
import type { EmitterSubscription } from 'react-native';
import { fileModelPath } from 'react-native-sherpa-onnx';
import { createPcmLiveStream } from 'react-native-sherpa-onnx/audio';
import { createSTT } from 'react-native-sherpa-onnx/stt';
import type { PcmLiveStreamHandle } from 'react-native-sherpa-onnx/audio';
import type { SttEngine } from 'react-native-sherpa-onnx/stt';
import type { SessionId, SourceLanguage, UtteranceId } from '../../shared/types/common';
import type { MeetingPipelineEvent } from '../../shared/types/meeting';
import { infoLog, warnLog } from '../../shared/utils/logger';
import { LanguageDetector } from './LanguageDetector';
import { normalizeViCase } from './viTextNormalizer';
import {
  createGateTally,
  recordWin,
  scoreUtterance,
  tallyLeader,
  type GateEngine,
  type GateTally,
} from './LanguageGate';
import { ensureBundledModelInstalled } from '../models/BundledModelInstaller';
import { BUNDLED_MODEL_CONFIG, getSttModelIdForSource, type BundledModelId } from '../models/bundledModels';

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
// iOS START hạ 0.020 → 0.012 (field 20/08 13:43): giọng vi trong video event
// nhỏ hơn 0.020 nên KHÔNG BAO GIỜ mở được utterance sau quãng nghỉ — cả câu
// vi biến mất thành lỗ 7-12s, chỉ lọt vào log khi dính đuôi câu EN to đã mở
// sẵn (CONTINUE 0.008 vẫn ghi tiếp). Guard thích ứng noiseFloor×3.5 vẫn chặn
// nhiễu nền. Đường lui nếu nhiễu mở câu lung tung: trả về 0.020.
const SPEECH_START_THRESHOLD = IS_ANDROID ? 0.004 : 0.012;
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

// Cửa sổ chưa-có-bằng-chứng (câu đầu phiên gate): placeholder "đang xác định
// ngôn ngữ" chỉ được treo tối đa chừng này; sau đó partial dual-decode + chấm
// điểm để hiện live text của engine đang thắng — câu đầu dài 10-15s mà treo
// placeholder suốt thì cảm giác rất lâu (phản hồi field 19/08).
const GATE_FIRST_GUESS_AFTER_MS = 3000;

// ==== Cắt câu theo ranh giới NGÔN NGỮ (field 20/08 12:03) ====
// Video/sự kiện song ngữ nói liên tục không có khoảng lặng → utterance chỉ bị
// cắt bởi trần 15s và một chunk chứa CẢ HAI ngôn ngữ: phần thiểu số thành rác,
// thắng vi (trùng target) thì đoạn tiếng Anh bên trong mất trắng không dịch.
// Cách cắt: sau khi mini-gate chốt engine cho câu, mỗi LANG_SPLIT_CHECK_
// INTERVAL_MS dual-decode RIÊNG khúc đuôi (LANG_SPLIT_TAIL_MS cuối buffer);
// đuôi cho winner khác engine đã chốt LANG_SPLIT_CONFIRMATIONS lần liên tiếp
// → ép finalize: phần đầu (ngôn ngữ cũ) thành final, phần đuôi ~LANG_SPLIT_
// CARRY_MS (ngôn ngữ mới) chuyển làm thân utterance kế tiếp — không mất audio.
// ĐƯỜNG LUI: đặt GATE_LANG_SPLIT_ENABLED = false là trở về nguyên hành vi cũ
// (chỉ cắt theo silence/soft-cap/hard-cap), không cần revert code.
// Tham số chỉnh 20/08 sau field 13:43: câu thực tế chỉ 8-10s (silence/soft-cap
// cắt trước) nên lịch cũ (chốt 3s + 2 xác nhận × 3.5s ≈ 10.5s) KHÔNG BAO GIỜ
// kịp nổ. 1 lần xác nhận là đủ vì cắt nhầm gần như vô hại: carry cùng ngôn
// ngữ → mini-gate của câu mới pin lại đúng engine cũ, chỉ tốn một nhát cắt.
const GATE_LANG_SPLIT_ENABLED = true;
const LANG_SPLIT_CHECK_INTERVAL_MS = 2500;
const LANG_SPLIT_TAIL_MS = 4000;
const LANG_SPLIT_CONFIRMATIONS = 1;
const LANG_SPLIT_CARRY_MS = 4000;

// SenseVoice lúc nospeech hay nhả "." — text không có chữ/số nào không phải
// nội dung: coi như rỗng để không ghi tally, không emit final, không dịch
// (field 20/08: final "." vẫn được dịch thành "."). Range: latin + latin
// extended (vi có dấu) + CJK + kana + hangul.
const LEXICAL_CONTENT_RE =
  /[0-9A-Za-zÀ-ɏḀ-ỿ぀-ヿ一-鿿가-힯]/;
function lexicalOrEmpty(text: string): string {
  return LEXICAL_CONTENT_RE.test(text) ? text : '';
}

type AudioSessionNativeModule = {
  activateRecordingSession?: () => Promise<boolean>;
  deactivateRecordingSession?: () => Promise<boolean>;
  enforceBuiltInMicInput?: () => Promise<boolean>;
};

const audioSessionModule =
  NativeModules.AudioSessionModule as AudioSessionNativeModule | undefined;

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
  private interruptionSub: EmitterSubscription | null = null;
  private resumeSub: EmitterSubscription | null = null;
  private interrupted = false;

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
  private lastFinalizeReason: 'silence' | 'soft_cap' | 'hard_cap' | 'stop' | 'too_short' | 'empty_result' | 'lang_switch' | null = null;
  private hardCapCount = 0;

  // Engine selection for this session. 'vi' forces the dedicated Vietnamese
  // transducer and pins every emitted event to language 'vi' (no heuristic
  // detection); null keeps the SenseVoice auto-detect path (EN/JA/KO/ZH).
  private forcedLanguage: SourceLanguage | null = null;
  private enginePrefix: 'sense' | 'vi' = 'sense';

  // Gate mode (máy khỏe): giữ engine VI thứ hai, dual-decode final từng
  // utterance. KHÔNG BAO GIỜ khóa engine: gate sống suốt phiên (bài học field
  // 20/08 — early-lock 6-0 destroy SenseVoice làm mọi đoạn Anh/Trung sau đó
  // bị ép decode như vi). Giá đo được: final chậm thêm ~0.4-0.6s so với đơn
  // engine — chấp nhận để switch ngôn ngữ luôn hoạt động.
  private gateActive = false;
  private gateTally: GateTally = createGateTally();
  private viGateEngine: SttEngine | null = null;
  // Utterance đã emit placeholder "đang xác định ngôn ngữ" (cửa sổ tally rỗng)
  // — mỗi utterance chỉ emit đúng một lần.
  private gatePendingEmittedFor: UtteranceId | null = null;
  // Bias chấm điểm khi ngôn ngữ dịch sang là vi (xem scoreUtterance).
  private gateBiasAgainstVi = false;
  // Mini-gate mỗi câu: tại mốc GATE_FIRST_GUESS_AFTER_MS của MỖI utterance,
  // dual-decode prefix một lần để chốt engine hiển thị partial cho riêng câu
  // đó (keyed theo utterance id — sang câu mới tự hết hiệu lực). Trước đây
  // partial chạy theo leader toàn phiên: đổi ngôn ngữ giữa chừng là nhìn rác
  // suốt 10-15s tới final (phàn nàn field 19-20/08 "switch chậm").
  private gateUttEngine: GateEngine | null = null;
  private gateUttEngineFor: UtteranceId | null = null;
  // Cắt câu theo ranh giới ngôn ngữ: số lần đuôi buffer "bất đồng" liên tiếp
  // với engine đã chốt, mốc check gần nhất, và cờ chờ audio-loop thực thi
  // (keyed theo utterance id để một final khác chen ngang không làm cắt nhầm
  // câu mới).
  private langSplitDisagree = 0;
  private lastLangSplitCheckMs = 0;
  private pendingLangSplitFor: UtteranceId | null = null;

  async start(
    sessionId: SessionId,
    emit: (event: MeetingPipelineEvent) => void,
    sourceLanguage?: SourceLanguage,
    options?: {gateMode?: boolean; targetLanguage?: string},
  ): Promise<void> {
    this.sessionId = sessionId;
    this.emitFn = emit;
    this.detector.setSession(sessionId);
    this.noiseFloorRms = NOISE_FLOOR_SEED;
    this.captureCalibrationEndsAt = Date.now() + (IS_ANDROID ? ANDROID_CAPTURE_CALIBRATION_MS : 0);
    this.speechCalibrationWindow = [];
    this.lastFinalizeReason = null;
    this.hardCapCount = 0;
    this.forcedLanguage = sourceLanguage === 'vi' ? 'vi' : null;
    this.enginePrefix = this.forcedLanguage === 'vi' ? 'vi' : 'sense';
    this.gateActive = false;
    this.gateTally = createGateTally();
    this.gatePendingEmittedFor = null;
    this.gateUttEngine = null;
    this.gateUttEngineFor = null;
    this.langSplitDisagree = 0;
    this.lastLangSplitCheckMs = 0;
    this.pendingLangSplitFor = null;
    // Dịch sang tiếng Việt = kỳ vọng speech ngoại ngữ → vùng bằng chứng yếu
    // trong gate nghiêng về sense (yêu cầu UX 19/08).
    this.gateBiasAgainstVi = options?.targetLanguage === 'vi';
    if (this.viGateEngine) {
      try {
        await this.viGateEngine.destroy();
      } catch {
        // engine cũ hỏng — bỏ qua, sẽ bị thay thế bên dưới.
      }
      this.viGateEngine = null;
    }

    const modelId: BundledModelId = getSttModelIdForSource(sourceLanguage);
    const engineLabel = BUNDLED_MODEL_CONFIG[modelId].displayName;

    emit({
      type: 'pipeline_status',
      session_id: sessionId,
      status: 'processing',
      timestamp_ms: Date.now(),
      details: `Preparing ${engineLabel} bundled model`,
    });

    const modelDir = await this.prepareModelDirectory(emit, modelId, engineLabel);

    if (this.forcedLanguage === 'vi') {
      // Offline transducer (Zipformer RNN-T). Non-autoregressive enough that
      // the existing partial cadence + inferenceActive backpressure hold
      // (bench/: RTF 0.025 on Mac CPU). No ITN option exists for transducer —
      // numbers come out as words; accepted for v1 (see plan §risks).
      this.engine = await createSTT({
        modelPath: fileModelPath(modelDir),
        modelType: 'transducer',
        preferInt8: true,
        provider: 'cpu',
        numThreads: 2,
      });
    } else {
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
    }

    if (options?.gateMode === true && this.forcedLanguage === null) {
      try {
        const viModelDir = await this.prepareModelDirectory(
          emit,
          'stt_vi',
          BUNDLED_MODEL_CONFIG.stt_vi.displayName,
        );
        this.viGateEngine = await createSTT({
          modelPath: fileModelPath(viModelDir),
          modelType: 'transducer',
          preferInt8: true,
          provider: 'cpu',
          numThreads: 2,
        });
        this.gateActive = true;
        emit({
          type: 'pipeline_status',
          session_id: sessionId,
          status: 'processing',
          timestamp_ms: Date.now(),
          details: 'Language gate active (dual-decode, full session)',
        });
      } catch (error) {
        // Fallback an toàn: chạy 1 engine SenseVoice như hiện tại.
        warnLog('[RealSTT] Gate: failed to load Zipformer-VI, running single-engine:', error);
        this.viGateEngine = null;
        this.gateActive = false;
      }
    }

    emit({
      type: 'pipeline_status',
      session_id: sessionId,
      status: 'processing',
      timestamp_ms: Date.now(),
      details: `${engineLabel} recognizer initialized`,
    });

    await this.activateAudioSession(emit);

    if (Platform.OS === 'ios' && NativeModules.AudioSessionModule) {
      const emitter = new NativeEventEmitter(NativeModules.AudioSessionModule);
      this.interruptionSub = emitter.addListener('audioSessionInterrupted', this.onAudioInterrupted);
      this.resumeSub = emitter.addListener('audioSessionResumed', this.onAudioResumed);
    }

    await this.startMicStream();
  }

  async stop(): Promise<void> {
    const emit = this.emitFn ?? (() => undefined);
    if (this.interruptionSub) {
      this.interruptionSub.remove();
      this.interruptionSub = null;
    }
    if (this.resumeSub) {
      this.resumeSub.remove();
      this.resumeSub = null;
    }
    // Drain any in-flight utterance via the same snapshot-and-reset path so
    // we don't lose the final sentence when the user stops.
    if (this.currentUtteranceId && this.sampleBuffer.length > 0 && this.sessionId) {
      this.lastFinalizeReason = 'stop';
      this.finalizeUtterance(Date.now(), emit);
    }
    // Stop the PCM feed before draining so no new items enter the chain.
    await this.stopMicStream();
    // Always drain the inference chain BEFORE destroying the engine. If we
    // destroy the engine while transcribeSamples() is running the native
    // promise may never resolve, permanently stalling the chain and blocking
    // all inference in the next session.
    const drainTimeout = 60000;
    await Promise.race([
      this.processingChain.catch(() => undefined),
      new Promise<void>(resolve => setTimeout(resolve, drainTimeout)),
    ]);
    // Tắt gate và tách viGateEngine ra biến cục bộ TRƯỚC khi destroy: nếu
    // drain chạm timeout mà chain vẫn còn job, job đó không được đụng engine
    // song song với các destroy bên dưới (double-destroy / engine đã chết).
    this.gateActive = false;
    const viEngine = this.viGateEngine;
    this.viGateEngine = null;
    if (this.engine) {
      await this.engine.destroy();
      this.engine = null;
    }
    if (viEngine) {
      await viEngine.destroy();
    }
    this.gateTally = createGateTally();
    this.gatePendingEmittedFor = null;
    this.gateUttEngine = null;
    this.gateUttEngineFor = null;
    await this.deactivateAudioSession();
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
    this.nextUtteranceSeed = [];
    this.processingChain = Promise.resolve();
    this.inferenceActive = false;
    this.interrupted = false;
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
        this.currentUtteranceId = `${sessionId}-${this.enginePrefix}-${++this.utteranceCounter}`;
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

    // Cắt theo ranh giới ngôn ngữ (cờ do maybeCheckLangSplit giương lên trong
    // inference chain) — chỉ khi cờ vẫn thuộc đúng utterance hiện tại: một
    // final silence/hard-cap chen giữa làm cờ mồ côi thì bỏ.
    if (this.pendingLangSplitFor !== null) {
      const splitValid = this.pendingLangSplitFor === this.currentUtteranceId;
      this.pendingLangSplitFor = null;
      if (splitValid) {
        this.lastFinalizeReason = 'lang_switch';
        this.finalizeUtteranceForLangSwitch(now, emit);
        return;
      }
    }

    const hardCap = MAX_UTTERANCE_SAMPLES;
    if (this.sampleBuffer.length >= hardCap) {
      this.hardCapCount += 1;
      this.lastFinalizeReason = 'hard_cap';
      infoLog('[RealSTT] hard-cap final', {
        id: this.currentUtteranceId,
        samples: this.sampleBuffer.length,
        hardCapCount: this.hardCapCount,
        engine: this.enginePrefix === 'vi' ? 'transducer_vi' : 'sense_voice',
      });
      this.finalizeUtterance(now, emit);
      return;
    }

    const partialBufferReady =
      !IS_ANDROID || utteranceDurationMs >= ANDROID_MIN_PARTIAL_BUFFER_MS;
    if (
      isSpeech &&
      partialBufferReady &&
      !this.inferenceActive &&
      now - this.lastPartialMs >= PARTIAL_INTERVAL_MS
    ) {
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

  private async prepareModelDirectory(
    emit: (event: MeetingPipelineEvent) => void,
    modelId: BundledModelId = 'stt',
    engineLabel: string = 'SenseVoice',
  ): Promise<string> {
    const localModelDir = await ensureBundledModelInstalled(modelId, (completed, total, file) => {
      emit({
        type: 'pipeline_status',
        session_id: this.sessionId!,
        status: 'processing',
        timestamp_ms: Date.now(),
        details: `Installing bundled ${engineLabel} (${completed}/${total}): ${file}`,
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

  private async activateAudioSession(emit: (event: MeetingPipelineEvent) => void): Promise<void> {
    if (Platform.OS !== 'ios') {
      return;
    }
    if (!audioSessionModule?.activateRecordingSession) {
      warnLog('[RealSTT] AudioSessionModule unavailable; continuing without explicit AVAudioSession activation.');
      return;
    }
    await audioSessionModule.activateRecordingSession();
    if (this.sessionId) {
      emit({
        type: 'pipeline_status',
        session_id: this.sessionId,
        status: 'processing',
        timestamp_ms: Date.now(),
        details: 'iOS audio session active',
      });
    }
  }

  private async deactivateAudioSession(): Promise<void> {
    if (Platform.OS !== 'ios' || !audioSessionModule?.deactivateRecordingSession) {
      return;
    }
    try {
      await audioSessionModule.deactivateRecordingSession();
    } catch (error) {
      warnLog('[RealSTT] Failed to deactivate iOS audio session:', error);
    }
  }

  private async startMicStream(): Promise<void> {
    const sessionId = this.sessionId;
    const emit = this.emitFn;
    if (!sessionId || !emit) return;

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

    // Re-apply built-in mic preference after stream starts. sherpa-onnx may
    // call setCategory internally during mic setup, which resets the preferred
    // input to nil and lets iOS fall back to the headphone/Bluetooth mic.
    if (Platform.OS === 'ios') {
      await audioSessionModule?.enforceBuiltInMicInput?.();
    }

    emit({
      type: 'pipeline_status',
      session_id: sessionId,
      status: 'capturing',
      timestamp_ms: Date.now(),
      details: 'Microphone active',
    });
  }

  private async stopMicStream(): Promise<void> {
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
  }

  async pause(): Promise<void> {
    this.interrupted = true;
    this.resetUtterance();
    await this.stopMicStream();
  }

  async resume(): Promise<void> {
    if (!this.sessionId || !this.emitFn) return;
    this.interrupted = false;
    await this.activateAudioSession(this.emitFn);
    await this.startMicStream();
  }

  private readonly onAudioInterrupted = (): void => {
    infoLog('[RealSTT] audio session interrupted (phone call)');
    this.interrupted = true;
    this.resetUtterance();
    this.stopMicStream().catch(() => {});
  };

  private readonly onAudioResumed = (): void => {
    if (!this.sessionId || !this.emitFn) return;
    infoLog('[RealSTT] audio session resumed, restarting mic');
    this.interrupted = false;
    this.startMicStream().catch((err) => {
      warnLog('[RealSTT] mic restart failed after phone call resume:', err);
    });
  };

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

  // Dual-decode một buffer partial bằng cả hai engine gate rồi chấm điểm.
  // Mỗi decode bọc riêng — một engine hỏng chỉ mất phần của nó. Trả null khi
  // cả hai phía trắng tay (chưa đủ vật liệu để nói gì).
  private async gateScorePartial(
    buffer: number[],
  ): Promise<{winner: GateEngine; text: string; lang?: string} | null> {
    if (!this.engine || !this.viGateEngine) return null;
    let senseResult: {text?: string; lang?: string} = {};
    let viResult: {text?: string} = {};
    try {
      senseResult = await this.engine.transcribeSamples(buffer, SAMPLE_RATE);
    } catch (error) {
      warnLog('[RealSTT] gate: sense partial decode failed:', error);
    }
    try {
      viResult = await this.viGateEngine.transcribeSamples(buffer, SAMPLE_RATE);
    } catch (error) {
      warnLog('[RealSTT] gate: vi partial decode failed:', error);
    }
    const senseText = lexicalOrEmpty((senseResult.text ?? '').trim());
    const viText = lexicalOrEmpty((viResult.text ?? '').trim());
    if (!senseText && !viText) {
      return null;
    }
    const winner = scoreUtterance(
      {text: senseText, lang: senseResult.lang},
      {text: viText},
      tallyLeader(this.gateTally),
      this.gateBiasAgainstVi,
      Math.abs(this.gateTally.vi - this.gateTally.sense),
    );
    return winner === 'vi'
      ? {winner, text: viText}
      : {winner, text: senseText, lang: senseResult.lang};
  }

  // Check ranh giới ngôn ngữ trong câu: dual-decode khúc đuôi buffer và so
  // winner với engine đã chốt. Bất đồng đủ LANG_SPLIT_CONFIRMATIONS lần liên
  // tiếp → giương cờ để audio-loop cắt câu (không cắt trực tiếp ở đây — mọi
  // thao tác buffer/finalize phải nằm trong luồng xử lý audio như cũ).
  private async maybeCheckLangSplit(now: number, uttId: UtteranceId): Promise<void> {
    if (!GATE_LANG_SPLIT_ENABLED || !this.gateActive || !this.viGateEngine) return;
    if (this.gateUttEngineFor !== uttId || this.gateUttEngine === null) return;
    if (this.pendingLangSplitFor !== null) return;
    if (now - this.lastLangSplitCheckMs < LANG_SPLIT_CHECK_INTERVAL_MS) return;
    const tailSamples = Math.floor((SAMPLE_RATE * LANG_SPLIT_TAIL_MS) / 1000);
    // Cần thân câu (≥2s) đứng trước đuôi thì đuôi mới nói lên "đổi ngôn ngữ";
    // buffer ngắn hơn thế thì chính mini-gate lo rồi.
    if (this.sampleBuffer.length < tailSamples + SAMPLE_RATE * 2) return;
    this.lastLangSplitCheckMs = now;
    const tail = this.sampleBuffer.slice(this.sampleBuffer.length - tailSamples);
    const scored = await this.gateScorePartial(tail);
    // Utterance có thể đã bị finalize (silence/hard-cap) trong lúc decode.
    if (this.currentUtteranceId !== uttId || this.gateUttEngineFor !== uttId) return;
    if (!scored) return;
    if (scored.winner === this.gateUttEngine) {
      this.langSplitDisagree = 0;
      return;
    }
    this.langSplitDisagree += 1;
    infoLog('[RealSTT] lang-split disagree', {
      id: uttId,
      pinned: this.gateUttEngine,
      tailWinner: scored.winner,
      count: this.langSplitDisagree,
    });
    if (this.langSplitDisagree >= LANG_SPLIT_CONFIRMATIONS) {
      this.pendingLangSplitFor = uttId;
    }
  }

  // Cắt câu tại ranh giới ngôn ngữ: phần đầu (ngôn ngữ cũ) thành final như
  // thường, phần đuôi LANG_SPLIT_CARRY_MS (audio ngôn ngữ mới đã thu) trở
  // thành THÂN của utterance kế tiếp — mở ngay tại đây, không chờ VAD, vì
  // speech đang liên tục. Utterance mới chưa chốt engine nên partial kế tiếp
  // sẽ mini-gate lại từ đầu và chọn đúng engine cho ngôn ngữ mới.
  private finalizeUtteranceForLangSwitch(now: number, emit: (event: MeetingPipelineEvent) => void): void {
    const utteranceId = this.currentUtteranceId;
    const sessionId = this.sessionId;
    if (!utteranceId || !sessionId) {
      this.resetUtterance();
      return;
    }
    const carrySamples = Math.floor((SAMPLE_RATE * LANG_SPLIT_CARRY_MS) / 1000);
    if (this.sampleBuffer.length <= carrySamples + SAMPLE_RATE) {
      // Không đủ thân câu để tách — finalize nguyên khối như cũ.
      this.finalizeUtterance(now, emit);
      return;
    }
    const splitIndex = this.sampleBuffer.length - carrySamples;
    const snapshot = this.sampleBuffer.slice(0, splitIndex);
    const carry = this.sampleBuffer.slice(splitIndex);
    const startMs = this.utteranceStartMs;
    const boundaryMs = now - LANG_SPLIT_CARRY_MS;
    const elapsedMs = Math.max(0, boundaryMs - startMs);
    const revisionAtScheduling = this.currentRevision;

    // Mở utterance mới mang phần carry. KHÔNG resetUtterance: giữ inSpeech/
    // lastSpeechMs — dòng speech chưa hề đứt.
    this.currentUtteranceId = `${sessionId}-${this.enginePrefix}-${++this.utteranceCounter}`;
    this.currentRevision = 0;
    this.currentText = '';
    this.utteranceStartMs = boundaryMs;
    this.utteranceCalibrationStartMs = boundaryMs;
    this.sampleBuffer = carry;
    this.lastPartialMs = now;
    this.langSplitDisagree = 0;
    this.lastLangSplitCheckMs = now;
    this.pendingLangSplitFor = null;

    infoLog('[RealSTT] lang-split final', {
      headId: utteranceId,
      newId: this.currentUtteranceId,
      headMs: elapsedMs,
      carryMs: LANG_SPLIT_CARRY_MS,
    });
    this.scheduleInference(() =>
      this.runFinalTranscription({
        snapshot,
        utteranceId,
        sessionId,
        startMs,
        elapsedMs,
        revisionAtScheduling,
        now: boundaryMs,
        emit,
      }),
    );
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
    // Gate: partial decode bằng engine đã chốt CHO CÂU NÀY (mini-gate tại mốc
    // 3s — xem nhánh dưới), 3s đầu câu tạm theo leader. Riêng utterance đầu
    // tiên của phiên (tally rỗng, chưa có bằng chứng nào) dual-decode + chấm
    // điểm mọi partial sau placeholder để hiển thị đúng ngay từ câu đầu.
    const noEvidenceYet = this.gateTally.sense + this.gateTally.vi === 0;
    const leader: GateEngine = this.gateActive ? tallyLeader(this.gateTally) : 'sense';
    let text: string;
    let forcedVi = false;
    let modelLangHint: string | undefined;
    if (this.gateActive && this.viGateEngine && noEvidenceYet) {
      // Chưa có bằng chứng ngôn ngữ (utterance đầu phiên). 3 giây đầu: treo
      // placeholder "đang xác định ngôn ngữ" (không decode — mọi lựa chọn
      // engine đều là đoán mò). SAU mốc đó: dual-decode partial + chấm điểm
      // để hiện live text của engine đang thắng — câu đầu có thể dài tới
      // 10-15s, treo placeholder suốt thì quá lâu. Tally vẫn CHỈ ghi ở final.
      if (now - this.utteranceStartMs < GATE_FIRST_GUESS_AFTER_MS) {
        if (this.gatePendingEmittedFor === uttId) {
          return;
        }
        this.gatePendingEmittedFor = uttId;
        this.currentRevision += 1;
        emit({
          type: 'stt_partial',
          session_id: this.sessionId,
          utterance_id: uttId,
          text: '',
          gate_pending: true,
          timestamp_ms: now,
          language: 'en',
          offset_ms: now - this.utteranceStartMs,
          revision: this.currentRevision,
        });
        return;
      }
      const scored = await this.gateScorePartial(bufferToTranscribe);
      if (!scored) {
        return;
      }
      text = scored.text;
      forcedVi = scored.winner === 'vi';
      modelLangHint = scored.lang;
    } else if (
      this.gateActive &&
      this.viGateEngine &&
      this.gateUttEngineFor !== uttId &&
      now - this.utteranceStartMs >= GATE_FIRST_GUESS_AFTER_MS
    ) {
      // Mini-gate mỗi câu: tại mốc 3s của MỌI utterance trong gate, dual-decode
      // prefix MỘT LẦN để chốt engine hiển thị cho riêng câu này. Đổi ngôn ngữ
      // giữa phiên nhờ đó được nhận ra sau ~3s thay vì nhìn rác của leader
      // suốt 10-15s tới final (phàn nàn field "switch Vi↔En chậm"). Chi phí
      // thêm đúng một decode prefix ngắn mỗi câu; final vẫn dual-decode và là
      // quyết định cuối cùng.
      const scored = await this.gateScorePartial(bufferToTranscribe);
      if (!scored) {
        return;
      }
      this.gateUttEngine = scored.winner;
      this.gateUttEngineFor = uttId;
      // Nhịp check ranh giới ngôn ngữ tính từ lúc chốt engine cho câu này.
      this.langSplitDisagree = 0;
      this.lastLangSplitCheckMs = now;
      text = scored.text;
      forcedVi = scored.winner === 'vi';
      modelLangHint = scored.lang;
    } else {
      // Câu đã chốt engine bởi mini-gate → dùng đúng engine đó; chưa tới mốc
      // chốt (3s đầu câu) → tạm decode theo leader như hành vi cũ.
      const chosen: GateEngine =
        this.gateActive && this.gateUttEngineFor === uttId && this.gateUttEngine !== null
          ? this.gateUttEngine
          : leader;
      const partialEngine =
        this.gateActive && chosen === 'vi' && this.viGateEngine ? this.viGateEngine : this.engine;
      let result: Awaited<ReturnType<SttEngine['transcribeSamples']>>;
      if (this.gateActive) {
        // Trong gate, một partial hỏng chỉ được phép mất chính partial đó —
        // không được ném ra ngoài và làm hỏng processingChain.
        try {
          result = await partialEngine.transcribeSamples(bufferToTranscribe, SAMPLE_RATE);
        } catch (error) {
          warnLog('[RealSTT] gate: partial decode failed, skipping this partial:', error);
          return;
        }
      } else {
        result = await partialEngine.transcribeSamples(bufferToTranscribe, SAMPLE_RATE);
      }
      text = (result.text ?? '').trim();
      forcedVi = this.gateActive && chosen === 'vi';
      modelLangHint = result.lang;
    }
    // Cắt câu theo ranh giới ngôn ngữ — chạy TRƯỚC các guard bên dưới vì
    // partial trùng text (early-return) không được phép làm lỡ nhịp check.
    await this.maybeCheckLangSplit(now, uttId);
    // State may have changed while we awaited; re-check before emitting so
    // partials from a finalized utterance don't leak into a new one.
    if (this.currentUtteranceId !== uttId) {
      return;
    }
    if (!text || text === this.currentText) {
      return;
    }
    this.currentText = text;
    this.currentRevision += 1;
    // detectLanguage có side-effect (emit language_detected) nên chỉ gọi SAU
    // các guard ở trên — giữ đúng thứ tự của code trước gate.
    const lang: SourceLanguage = forcedVi ? 'vi' : this.detectLanguage(text, modelLangHint);
    if (lang === 'vi') {
      text = normalizeViCase(text);
    }
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

    let text: string;
    let lang: SourceLanguage;
    let engineUsed = '';
    let gateDebug: string | undefined;
    if (this.gateActive && this.viGateEngine) {
      // Dual-decode tuần tự trên cùng snapshot — đỉnh RAM activation không đổi.
      // Mỗi decode được bọc riêng: một engine hỏng chỉ làm mất phần của nó,
      // không ném ra ngoài làm hỏng processingChain của cả phiên.
      let senseResult: {text?: string; lang?: string} = {};
      let viResult: {text?: string} = {};
      let senseOk = false;
      let viOk = false;
      try {
        senseResult = await this.engine.transcribeSamples(snapshot, SAMPLE_RATE);
        senseOk = true;
      } catch (error) {
        warnLog('[RealSTT] gate: sense decode failed for this utterance:', error);
      }
      try {
        viResult = await this.viGateEngine.transcribeSamples(snapshot, SAMPLE_RATE);
        viOk = true;
      } catch (error) {
        warnLog('[RealSTT] gate: vi decode failed for this utterance:', error);
      }
      const senseText = lexicalOrEmpty((senseResult.text ?? '').trim());
      const viText = lexicalOrEmpty((viResult.text ?? '').trim());
      if (!senseText && !viText) {
        text = '';
        lang = 'en';
      } else {
        const winner = scoreUtterance(
          {text: senseText, lang: senseResult.lang},
          {text: viText},
          tallyLeader(this.gateTally),
          this.gateBiasAgainstVi,
          Math.abs(this.gateTally.vi - this.gateTally.sense),
        );
        // Chỉ ghi tally khi CẢ HAI decode đều chạy được: một lỗi kỹ thuật
        // một phía không được tính là chiến thắng cho bên còn lại, nếu không
        // một engine hỏng lặp lại sẽ làm lệch quyết định khóa. Văn bản vẫn
        // được phát bình thường — chỉ việc ghi điểm là chặt hơn.
        if (senseOk && viOk) {
          recordWin(this.gateTally, winner);
        }
        if (winner === 'vi') {
          text = viText;
          lang = 'vi';
        } else {
          text = senseText;
          lang = this.detectLanguage(senseText, senseResult.lang, utteranceId);
        }
        // Phục vụ log test: engine thắng + tally hiện tại của cửa sổ gate.
        engineUsed = `${winner} (gate ${this.gateTally.sense}-${this.gateTally.vi})`;
        gateDebug = `sense(${senseResult.lang ?? '?'})=“${senseText}” ↔ vi=“${viText}”`;
      }
    } else {
      const result = await this.engine.transcribeSamples(snapshot, SAMPLE_RATE);
      text = lexicalOrEmpty((result.text ?? '').trim());
      lang = text ? this.detectLanguage(text, result.lang, utteranceId) : 'en';
      engineUsed = this.forcedLanguage === 'vi' ? 'vi (đã khóa/chọn tay)' : 'sense (đã khóa/mặc định)';
    }
    if (lang === 'vi') {
      // Zipformer-VI phát ra toàn chữ hoa — hạ case ở tầng hiển thị.
      text = normalizeViCase(text);
    }
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

    emit({
      type: 'stt_final',
      session_id: sessionId,
      utterance_id: utteranceId,
      text,
      engine: engineUsed,
      gate_debug: gateDebug,
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
    this.langSplitDisagree = 0;
    this.lastLangSplitCheckMs = 0;
    this.pendingLangSplitFor = null;
  }

  private detectLanguage(
    text: string,
    langFromModel?: string,
    utteranceId?: UtteranceId | null,
  ): SourceLanguage {
    // Forced-language session (Zipformer-VI): the engine only knows one
    // language, so skip both the model hint and the text heuristic entirely.
    if (this.forcedLanguage) {
      return this.forcedLanguage;
    }
    // Lột token wrapper `<|en|>` của SenseVoice trước khi so sánh (xem
    // LanguageGate.scoreUtterance — cùng lý do).
    const normalized = (langFromModel ?? '').toLowerCase().replace(/[^a-z]/g, '');
    if (normalized.startsWith('en')) return 'en';
    if (normalized.startsWith('ja') || normalized.startsWith('jp')) return 'ja';
    if (normalized.startsWith('ko')) return 'ko';
    if (normalized.startsWith('zh') || normalized.startsWith('cn')) return 'zh';
    if (normalized.startsWith('vi')) return 'vi';
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
