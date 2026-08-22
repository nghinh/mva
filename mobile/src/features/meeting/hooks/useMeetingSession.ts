/**
 * useMeetingSession Hook
 *
 * Offline-only meeting lifecycle orchestration. STT stays on-device and
 * translation will be wired on-device in Epic 3 v3.0.
 */

import {useCallback, useEffect, useRef} from 'react';
import {AppState, Platform} from 'react-native';
import {
  startBackgroundRecording,
  stopBackgroundRecording,
  pauseBackgroundRecording,
  resumeBackgroundRecording,
  BackgroundRecordingEmitter,
} from '../../../native/backgroundRecording/NativeBackgroundRecording';
import {isAppleTranslationAvailable, getIOSVersion} from '../../../shared/utils/platformSupport';
import {useMeetingStore, TranscriptEntry, MeetingSession} from '../state/meetingStore';

import {
  createPersistenceService,
  PersistenceService,
  SessionData,
  TranslationData,
  UtteranceData,
} from '../../../services/persistence';
import {SourceLanguage, TargetLanguage, SessionId, UtteranceId} from '../../../shared/types';
import type {MeetingPipelineEvent} from '../../../shared/types/meeting';
import {debugLog, errorLog, warnLog} from '../../../shared/utils/logger';
import {useDeveloperMetricsStore} from '@features/meeting/store/developerMetricsStore';
import {
  getOnDeviceTranslator,
  isTranslationCancelledError,
  mapSourceLanguageToNllb,
} from '../../../services/OnDeviceTranslator';
import {
  getMeetingPipelineInstance,
  MeetingPipeline,
  releaseMeetingPipelineInstance,
} from '../../../native/stt/MeetingPipeline';
import {getRealSpeechRecognizer, RealSpeechRecognizer} from '../../../native/stt/RealSpeechRecognizer';
import {getDiarizationThreshold} from '../../../shared/config/runtimeConfig';
import {testLog, flushSessionTestLog, ensureDeviceTag, deviceMeta, fmtTime} from '../../../services/sessionTestLog';
import {
  getSpeakerEmbeddingService,
  releaseSpeakerEmbeddingService,
} from '../../../native/speaker/SpeakerEmbeddingService';
import {getOfflineSpeakerDiarizationService} from '../../../native/speaker/OfflineSpeakerDiarizationService';
import {getSpeakerClusterService} from '../../../services/speaker/SpeakerClusterService';
import {getSessionDiarizationWindowService} from '../../../services/speaker/SessionDiarizationWindowService';
import {useDiarizationProgressStore} from '../store/diarizationProgressStore';

export interface UseMeetingSessionReturn {
  isActive: boolean;
  isRecording: boolean;
  sessionId: SessionId | null;
  session: MeetingSession;
  status: string;
  connectivity: string;
  transcript: TranscriptEntry[];
  partialTranscript: string;
  currentUtteranceId: UtteranceId | null;
  startMeeting: (
    sourceLanguage?: SourceLanguage,
    targetLanguage?: TargetLanguage,
    options?: {gateMode?: boolean},
  ) => Promise<void>;
  stopMeeting: () => Promise<{sessionId: string | null; fallbackSession: SessionData | null; fallbackUtterances: UtteranceData[]}>;
  pauseMeeting: () => Promise<void>;
  resumeMeeting: () => Promise<void>;
  updatePartialTranscript: (utteranceId: UtteranceId, text: string, language: SourceLanguage, revision: number) => void;
  finalizePartialTranscript: (utteranceId: UtteranceId, text: string, language: SourceLanguage, confidence: number) => void;
  pipelineStatus: string;
  pipelineError: string | null;
  isOffline: boolean;
  isDegraded: boolean;
  degradedMessage: string | null;
}

let persistenceService: PersistenceService | null = null;
let meetingPipeline: MeetingPipeline | null = null;
let realSpeechRecognizer: RealSpeechRecognizer | null = null;

// Platform-native translation (Apple Translation on iOS, Opus-MT on Android) is
// memory-efficient (~30-50MB) so we don't need to disable it on iOS debug builds
function isIosDebugLiveTranslationDisabled(): boolean {
  return false;
}

const ANDROID_ENABLE_DRAFT_TRANSLATION = false;

type DeferredTranslationItem = {
  utteranceId: UtteranceId;
  sessionId: SessionId;
  sourceText: string;
  sourceLanguage: SourceLanguage;
  revision: number;
  timestampMs: number;
};

/** Single-flight translator native init; must not block STT/mic. */
let translatorInitInFlight: Promise<boolean> | null = null;

function kickOffTranslatorInitIfNeeded(): void {
  console.warn('[useMeetingSession] kickOffTranslatorInitIfNeeded() called, session status:', useMeetingStore.getState().session.status);
  if (isIosDebugLiveTranslationDisabled()) {
    console.warn('[useMeetingSession] kickOffTranslatorInitIfNeeded() early return: iOS debug disabled');
    return;
  }
  if (useMeetingStore.getState().session.status !== 'recording') {
    console.warn('[useMeetingSession] kickOffTranslatorInitIfNeeded() early return: not recording, status =', useMeetingStore.getState().session.status);
    return;
  }
  const translator = getOnDeviceTranslator();
  if (translator.isSuppressedForMemoryPressure()) {
    console.warn('[useMeetingSession] kickOffTranslatorInitIfNeeded() early return: memory pressure');
    return;
  }
  if (translatorInitInFlight) {
    console.warn('[useMeetingSession] kickOffTranslatorInitIfNeeded() early return: init already in flight');
    return;
  }
  console.warn('[useMeetingSession] kickOffTranslatorInitIfNeeded() starting init');
  translatorInitInFlight = (async (): Promise<boolean> => {
    try {
      const loaded = await translator.isLoaded();
      console.warn('[useMeetingSession] kickOffTranslatorInitIfNeeded: isLoaded =', loaded);
      if (translator.isSuppressedForMemoryPressure()) {
        warnLog('[useMeetingSession] Translation suppressed after memory warning.');
        return false;
      }
      if (!loaded) {
        console.warn('[useMeetingSession] kickOffTranslatorInitIfNeeded: calling translator.initialize()...');
        const ok = await translator.initialize('');
        console.warn('[useMeetingSession] kickOffTranslatorInitIfNeeded: translator.initialize() returned =', ok);
        if (!ok) return false;
      }
      return true;
    } catch (error) {
      warnLog('[useMeetingSession] Translator init failed; transcript-only mode.', error);
      return false;
    }
  })();
  translatorInitInFlight.finally(() => {
    translatorInitInFlight = null;
  });
}

/** Wait for on-device translator after kickOff; used on stt_final so translation is not dropped while translator loads. */
async function awaitTranslatorReadyForTranslate(timeoutMs: number): Promise<boolean> {
  if (isIosDebugLiveTranslationDisabled()) {
    return false;
  }
  kickOffTranslatorInitIfNeeded();
  // Prefer awaiting the in-flight init promise directly so final translation
  // never races ahead of native model setup.
  if (translatorInitInFlight) {
    try {
      return await Promise.race([
        translatorInitInFlight,
        new Promise<boolean>((resolve) => setTimeout(() => resolve(false), timeoutMs)),
      ]);
    } catch {
      return getOnDeviceTranslator().isLoaded();
    }
  }
  return getOnDeviceTranslator().isLoaded();
}

function getPersistenceService(): PersistenceService {
  if (!persistenceService) {
    persistenceService = createPersistenceService();
    persistenceService.ensureInitialized();
  }
  return persistenceService;
}

function prepareTranslationText(text: string, iosDebugSafeMode: boolean): string {
  const normalized = text.trim();
  if (!iosDebugSafeMode) {
    return normalized;
  }

  const collapsed = normalized.replace(/\s+/g, ' ');
  return collapsed.length <= 160 ? collapsed : `${collapsed.slice(0, 160).trimEnd()}...`;
}

function buildUntranslatedUtteranceData(
  sessionId: SessionId,
  utteranceId: UtteranceId,
  text: string,
  sourceLanguage: SourceLanguage,
  revision: number,
  timestampMs: number,
): UtteranceData {
  return {
    id: utteranceId,
    sessionId,
    timestamp: timestampMs,
    isFinal: true,
    sourceText: text,
    sourceLanguage,
    translatedText: null,
    translationLatencyMs: null,
    revision,
  };
}

export function useMeetingSession(): UseMeetingSessionReturn {
  const LIVE_SPEAKER_ASSIGNMENT_ENABLED = false;
  const IOS_DEBUG_TRANSLATION_SAFE_MODE = isIosDebugLiveTranslationDisabled();
  const store = useMeetingStore();
  const session = store.session;
  const pipelineRef = useRef<MeetingPipeline | null>(null);
  const realRecognizerRef = useRef<RealSpeechRecognizer | null>(null);
  const stoppingSessionRef = useRef(false);
  const isInBackgroundRef = useRef(false);
  const lastPersistedSessionMetaRef = useRef<string | null>(null);
  const translationVersionRef = useRef(new Map<UtteranceId, number>());
  const deferredTranslationsRef = useRef(new Map<UtteranceId, DeferredTranslationItem>());
  // Per-utterance draft throttling: only translate partials when the text has
  // grown enough AND enough time has passed since the last draft, so translation does
  // not starve STT CPU.
  const draftLastSizeRef = useRef(new Map<UtteranceId, number>());
  const draftLastTimestampRef = useRef(new Map<UtteranceId, number>());
  // Language used for the last size measurement above, so a gate-leader flip
  // mid-utterance (see maybeTranslateDraft) can be detected and reset.
  const draftLastLangRef = useRef(new Map<UtteranceId, SourceLanguage>());

  const trimSamplesForSpeakerEmbedding = useCallback((samples: number[], sampleRate: number): number[] => {
    if (samples.length === 0) {
      return samples;
    }

    // VAD for Diarization: Extract the most energetic contiguous window
    // to prevent background noise or silence from dominating the CAM++ embedding.
    // 2.0 seconds is ideal for CAM++ to get a pure voice print.
    const TARGET_WINDOW_SEC = 2.0;
    const windowSize = Math.floor(sampleRate * TARGET_WINDOW_SEC);

    // If audio is shorter than target, just trim leading/trailing absolute silence
    if (samples.length <= windowSize) {
      const silenceThreshold = 0.005;
      let first = 0;
      while (first < samples.length && Math.abs(samples[first] ?? 0) < silenceThreshold) first++;
      let last = samples.length - 1;
      while (last > first && Math.abs(samples[last] ?? 0) < silenceThreshold) last--;

      if (first >= last) return samples;
      const pad = Math.floor(sampleRate * 0.1);
      return samples.slice(Math.max(0, first - pad), Math.min(samples.length, last + pad + 1));
    }

    // For longer audio, slide a 2.0s window and find the one with maximum energy
    let maxEnergy = -1;
    let maxStartIndex = 0;
    const step = Math.floor(sampleRate * 0.1); // 100ms step

    for (let i = 0; i <= samples.length - windowSize; i += step) {
      let energy = 0;
      for (let j = 0; j < windowSize; j++) {
        const v = samples[i + j] ?? 0;
        energy += v * v;
      }
      if (energy > maxEnergy) {
        maxEnergy = energy;
        maxStartIndex = i;
      }
    }

    return samples.slice(maxStartIndex, maxStartIndex + windowSize);
  }, []);

  const applyOfflineDiarizationWindow = useCallback(async (sessionId: SessionId) => {
    const diarizationService = getOfflineSpeakerDiarizationService();
    if (!diarizationService.isReady()) {
      return false;
    }

    const window = getSessionDiarizationWindowService().buildWindow();
    if (!window || window.samples.length < window.sampleRate * 3) {
      return false;
    }

    const result = await diarizationService.process(window.samples);
    if (!result.segments.length) {
      return false;
    }

    const storeState = useMeetingStore.getState();
    const labels = {...storeState.session.speakerLabels};
    let nextSpeakerIndex = Math.max(1, Object.keys(labels).length + 1);

    const utteranceToLocalSpeaker = new Map<UtteranceId, number>();
    for (const utterance of window.utterances) {
      let bestSpeaker: number | null = null;
      let bestOverlap = 0;
      for (const segment of result.segments) {
        const segStartMs = window.windowStartMs + segment.startSec * 1000;
        const segEndMs = window.windowStartMs + segment.endSec * 1000;
        const overlap = Math.max(0, Math.min(utterance.endMs, segEndMs) - Math.max(utterance.startMs, segStartMs));
        if (overlap > bestOverlap) {
          bestOverlap = overlap;
          bestSpeaker = segment.speaker;
        }
      }
      if (bestSpeaker != null && bestOverlap > 0) {
        utteranceToLocalSpeaker.set(utterance.utteranceId, bestSpeaker);
      }
    }

    const diarizedSpeakerCount = new Set(result.segments.map((segment) => `S${segment.speaker + 1}`)).size;
    if (utteranceToLocalSpeaker.size === 0) {
      storeState.setSpeakerLabels(labels);
      storeState.updateSpeakerCount(Math.max(storeState.session.speakerCount, diarizedSpeakerCount));
      useDeveloperMetricsStore.getState().recordSpeakerDebug(
        `offline c=${result.numSpeakers} seg=${result.segments.length} mapped=0`,
      );
      return false;
    }

    const localVotes = new Map<number, Map<string, number>>();
    for (const [utteranceId, localSpeaker] of utteranceToLocalSpeaker.entries()) {
      const existing = storeState.session.transcript.find((entry) => entry.id === utteranceId)?.speakerId;
      if (!existing) continue;
      if (!localVotes.has(localSpeaker)) localVotes.set(localSpeaker, new Map());
      const bucket = localVotes.get(localSpeaker)!;
      bucket.set(existing, (bucket.get(existing) ?? 0) + 1);
    }

    const localToGlobal = new Map<number, string>();
    const usedGlobal = new Set<string>();
    for (const [localSpeaker, votes] of localVotes.entries()) {
      const ranked = Array.from(votes.entries()).sort((a, b) => b[1] - a[1]);
      const chosen = ranked.find(([speakerId]) => !usedGlobal.has(speakerId))?.[0];
      if (chosen) {
        localToGlobal.set(localSpeaker, chosen);
        usedGlobal.add(chosen);
      }
    }

    for (const localSpeaker of new Set(result.segments.map((s) => s.speaker))) {
      if (!localToGlobal.has(localSpeaker)) {
        const speakerId = `S${nextSpeakerIndex++}`;
        labels[speakerId] = `Speaker ${nextSpeakerIndex - 1}`;
        localToGlobal.set(localSpeaker, speakerId);
      }
    }

    const assignments = new Map<string, {speakerId: string; speakerLabel: string}>();
    for (const [utteranceId, localSpeaker] of utteranceToLocalSpeaker.entries()) {
      const globalSpeakerId = localToGlobal.get(localSpeaker);
      if (!globalSpeakerId) continue;
      assignments.set(utteranceId, {
        speakerId: globalSpeakerId,
        speakerLabel: labels[globalSpeakerId] ?? globalSpeakerId.replace('S', 'Speaker '),
      });
    }

    if (assignments.size === 0) {
      return false;
    }

    storeState.bulkUpdateSpeakers(assignments);
    storeState.setSpeakerLabels(labels);
    storeState.updateSpeakerCount(Math.max(storeState.session.speakerCount, diarizedSpeakerCount));

    const persistence = getPersistenceService();
    await Promise.all(
      Array.from(assignments.entries()).map(([utteranceId, assignment]) => {
        const entry = useMeetingStore.getState().session.transcript.find((item) => item.id === utteranceId);
        if (!entry) {
          return Promise.resolve();
        }
        return persistence.saveUtterance({
            id: entry.id,
            sessionId,
            timestamp: entry.timestamp,
            isFinal: entry.isFinal,
            sourceText: entry.sourceText,
            sourceLanguage: entry.sourceLanguage,
            translatedText: entry.translatedText,
            translationLatencyMs:
              useMeetingStore.getState().session.translations.find((translation) => translation.utteranceId === entry.id)?.latencyMs ?? null,
            revision: entry.revision,
            speakerId: assignment.speakerId,
            speakerLabel: assignment.speakerLabel,
          });
      }),
    );
    await persistence.updateSession(sessionId, {
      speakerCount: useMeetingStore.getState().session.speakerCount,
      speakerLabels: useMeetingStore.getState().session.speakerLabels,
    });

    useDeveloperMetricsStore.getState().recordSpeakerDebug(
      `offline c=${result.numSpeakers} seg=${result.segments.length} mapped=${assignments.size}`,
    );
    return true;
  }, []);

  const applyPostSessionDiarization = useCallback(async (sessionId: SessionId, sessionSamples: number[]) => {
    const CHUNK_SAMPLES = 16000 * 180; // 3 minutes per chunk (~11 MB bridge transfer)
    const SAMPLE_RATE = 16000;

    const sessionAudio = getSessionDiarizationWindowService().buildWindow();
    if (!sessionAudio || sessionSamples.length < SAMPLE_RATE * 3) {
      useDeveloperMetricsStore.getState().recordSpeakerDebug(
        `post no-window samples=${sessionSamples.length}`,
      );
      return false;
    }

    // Initialize diarization and embedding services
    const diarizationService = getOfflineSpeakerDiarizationService();
    const initialized = diarizationService.isReady() ? true : await diarizationService.initialize();
    if (!initialized) {
      useDeveloperMetricsStore.getState().recordSpeakerDebug('post init-failed');
      return false;
    }
    const speakerService = getSpeakerEmbeddingService();
    await speakerService.initialize();
    const clusterService = getSpeakerClusterService();
    clusterService.reset();

    // Split session audio into 3-minute chunks
    const chunks: Array<{samples: number[]; startSampleOffset: number}> = [];
    for (let start = 0; start < sessionSamples.length; start += CHUNK_SAMPLES) {
      chunks.push({
        samples: sessionSamples.slice(start, start + CHUNK_SAMPLES),
        startSampleOffset: start,
      });
    }

    useDeveloperMetricsStore.getState().recordSpeakerDebug(
      `post chunked chunks=${chunks.length} utt=${sessionAudio.utterances.length}`,
    );

    // Start progress tracking — SessionReviewScreen subscribes to this
    useDiarizationProgressStore.getState().startProgress(sessionId, chunks.length);

    const persistence = getPersistenceService();

    const saveUtteranceAssignments = async (
      assignments: Map<string, {speakerId: string; speakerLabel: string}>,
    ) => {
      if (assignments.size === 0) return;
      const storeState = useMeetingStore.getState();
      storeState.bulkUpdateSpeakers(assignments);
      await Promise.all(
        Array.from(assignments.entries()).map(([utteranceId, assignment]) => {
          const entry = storeState.session.transcript.find((t) => t.id === utteranceId);
          if (!entry) return Promise.resolve();
          return persistence.saveUtterance({
            id: entry.id, sessionId,
            timestamp: entry.timestamp, isFinal: entry.isFinal,
            sourceText: entry.sourceText, sourceLanguage: entry.sourceLanguage,
            translatedText: entry.translatedText,
            translationLatencyMs:
              storeState.session.translations.find((t) => t.utteranceId === entry.id)?.latencyMs ?? null,
            revision: entry.revision,
            speakerId: assignment.speakerId,
            speakerLabel: assignment.speakerLabel,
          });
        }),
      );
    };

    for (let chunkIdx = 0; chunkIdx < chunks.length; chunkIdx++) {
      const chunk = chunks[chunkIdx];
      const chunkStartMs = sessionAudio.windowStartMs + (chunk.startSampleOffset / SAMPLE_RATE) * 1000;
      const chunkEndMs = chunkStartMs + (chunk.samples.length / SAMPLE_RATE) * 1000;

      // Utterances whose start falls within this chunk's time window
      const chunkUtterances = sessionAudio.utterances.filter(
        (u) => u.startMs >= chunkStartMs - 1000 && u.startMs < chunkEndMs + 1000,
      );

      // PyAnnote segmentation for this chunk (ignore local speaker IDs)
      const diarizationResult = await diarizationService.processChunk(chunk.samples);

      const chunkAssignments = new Map<string, {speakerId: string; speakerLabel: string}>();

      if (diarizationResult.segments.length > 0 && speakerService.isReady()) {
        // Hybrid path: PyAnnote segment boundaries → CAM++ → SpeakerClusterService (global IDs)
        for (let segIdx = 0; segIdx < diarizationResult.segments.length; segIdx++) {
          const seg = diarizationResult.segments[segIdx];
          const segAbsStartMs = chunkStartMs + seg.startSec * 1000;
          const segAbsEndMs = chunkStartMs + seg.endSec * 1000;

          const segStartSample = Math.floor(seg.startSec * SAMPLE_RATE);
          const segEndSample = Math.floor(seg.endSec * SAMPLE_RATE);
          const segAudio = chunk.samples.slice(segStartSample, segEndSample);
          if (segAudio.length < SAMPLE_RATE) continue;

          const trimmed = trimSamplesForSpeakerEmbedding(segAudio, SAMPLE_RATE);
          if (trimmed.length < SAMPLE_RATE) continue;

          const embedding = await speakerService.extractEmbedding(trimmed, SAMPLE_RATE);
          if (!embedding) continue;

          const segKey = `c${chunkIdx}_s${segIdx}`;
          const decision = clusterService.addEmbedding(
            segKey,
            Array.from(embedding),
            segAbsEndMs,
            segAudio.length / SAMPLE_RATE,
          );
          if (!decision.speakerId) continue;

          // Map utterances overlapping this segment
          for (const utt of chunkUtterances) {
            const overlap = Math.max(
              0,
              Math.min(utt.endMs, segAbsEndMs) - Math.max(utt.startMs, segAbsStartMs),
            );
            if (overlap > 0) {
              chunkAssignments.set(utt.utteranceId, {
                speakerId: decision.speakerId,
                speakerLabel: decision.speakerLabel,
              });
            }
          }
        }
      }
      // Không còn nhánh fallback theo utterance boundaries: `sessionAudio.utterances`
      // chỉ mang {utteranceId, startMs, endMs} nên nhánh cũ truy cập `utt.samples`
      // (undefined) sẽ ném lỗi ngay khi PyAnnote trả về 0 segment. Khi không có
      // segment, chunk này đơn giản là không có assignment.

      // Persist immediately → triggers SessionReview progressive reveal
      await saveUtteranceAssignments(chunkAssignments);

      useDeveloperMetricsStore.getState().recordSpeakerDebug(
        `post chunk=${chunkIdx + 1}/${chunks.length} seg=${diarizationResult.segments.length} mapped=${chunkAssignments.size}`,
      );

      // Advance progress chip in SessionReviewScreen
      useDiarizationProgressStore.getState().advanceChunk();
    }

    // Finalize: update session-level speaker labels + count
    const labels = Object.fromEntries(
      clusterService.getClusters().map((c) => [c.speakerId, c.speakerLabel]),
    );
    const storeState = useMeetingStore.getState();
    storeState.setSpeakerLabels(labels);
    storeState.updateSpeakerCount(clusterService.getSpeakerCount());
    await persistence.updateSession(sessionId, {
      speakerCount: clusterService.getSpeakerCount(),
      speakerLabels: labels,
    });

    useDiarizationProgressStore.getState().complete();
    useDeveloperMetricsStore.getState().recordSpeakerDebug(
      `post complete speakers=${clusterService.getSpeakerCount()}`,
    );
    return true;
  }, [trimSamplesForSpeakerEmbedding]);

  const queueDeferredTranslation = useCallback((item: DeferredTranslationItem) => {
    deferredTranslationsRef.current.set(item.utteranceId, item);
  }, []);

  const persistUntranslatedFinal = useCallback(async (item: DeferredTranslationItem) => {
    const persistence = getPersistenceService();
    await persistence.saveFinalUtteranceWithTranslation(
      buildUntranslatedUtteranceData(
        item.sessionId,
        item.utteranceId,
        item.sourceText,
        item.sourceLanguage,
        item.revision,
        item.timestampMs,
      ),
      null,
    );
  }, []);

  const processDeferredTranslationsAfterMeeting = useCallback(async (sessionId: SessionId, _targetLanguage: TargetLanguage) => {
    const pendingItems = Array.from(deferredTranslationsRef.current.values())
      .filter((item) => item.sessionId === sessionId)
      .sort((a, b) => a.timestampMs - b.timestampMs);
    if (!pendingItems.length) {
      return;
    }

    const translator = getOnDeviceTranslator();
    translator.clearMemoryPressureSuppression();

    const ready = await translator.ensureLoaded('').catch(() => false);
    if (!ready) {
      warnLog('[useMeetingSession] Deferred translation init failed; leaving untranslated backlog persisted.');
      return;
    }

    const persistence = getPersistenceService();

    try {
      for (const item of pendingItems) {
        const translatedText = await translator.translate({
          text: item.sourceText.trim(),
          sourceLanguage: mapSourceLanguageToNllb(item.sourceLanguage),
        });

        const translationId = `trans_${item.utteranceId}_final`;
        await persistence.saveFinalUtteranceWithTranslation(
          {
            id: item.utteranceId,
            sessionId: item.sessionId,
            timestamp: item.timestampMs,
            isFinal: true,
            sourceText: item.sourceText,
            sourceLanguage: item.sourceLanguage,
            translatedText: translatedText.text,
            translationLatencyMs: null,
            revision: item.revision,
          },
          {
            id: translationId,
            utteranceId: item.utteranceId,
            text: translatedText.text,
            latencyMs: null,
            createdAt: Date.now(),
          },
        );

        deferredTranslationsRef.current.delete(item.utteranceId);
      }
    } catch (error) {
      warnLog('[useMeetingSession] Deferred translation processing stopped early:', error);
    } finally {
      await translator.unload().catch(() => undefined);
    }
  }, []);

  const maybeTranslateDraft = useCallback((event: Extract<MeetingPipelineEvent, {type: 'stt_partial'}>) => {
    if (IOS_DEBUG_TRANSLATION_SAFE_MODE) {
      return;
    }
    // Câu nói trùng ngôn ngữ đích (vd gate nhận vi, target=vi): không chạy
    // translator, nhưng MIRROR nguyên văn sang lane Dịch (yêu cầu UX 19/08 —
    // lane trống làm user tưởng lỗi). Chi phí 0ms vì không dịch thật.
    if (event.language === useMeetingStore.getState().session.targetLanguage) {
      if (event.text.trim()) {
        useMeetingStore.getState().handleTranslationMessage(
          event.utterance_id,
          event.text,
          false,
          event.revision,
          event.text,
          event.timestamp_ms,
        );
      }
      return;
    }
    const translator = getOnDeviceTranslator();
    // HARD GATE 1: until splash/meeting has warmed the translator, drafts would pay the
    // ~multi-second decoder_model lazy-load themselves and stall every
    // subsequent partial behind them. Let the final translate absorb that cost
    // instead; later utterances will run on a hot model.
    if (!translator.isWarmedUp()) {
      return;
    }
    // HARD GATE 2: if translator is still crunching the previous draft, bail out NOW.
    // Translation has no cancellation — every queued call WILL run to
    // completion (~500-800ms each). For a 10s utterance with partials every
    // 300ms this stacks ~12s of cumulative work, which is exactly the ~13s
    // lag users observe. Letting the next partial trigger a draft once the
    // translator is free produces a smoother cadence and, crucially, keeps
    // the final translation latency bounded to ONE translation run after stt_final.
    if (translator.isTranslating()) {
      return;
    }

    const isEnglish = event.language === 'en';
    // Fire the first draft as soon as the partial has a couple of words.
    const minSize = isEnglish ? 3 : 8;
    // Retranslate on fairly small growth so drafts track the transcript closely.
    const growthGate = isEnglish ? 2 : 4;
    // Soft interval gate (redundant with isTranslating above but keeps a floor
    // in case translate() is very fast).
    const MIN_INTERVAL_MS = 400;

    const size = isEnglish
      ? event.text.trim().split(/\s+/).filter(Boolean).length
      : Array.from(event.text.trim()).length;
    if (size < minSize) {
      return;
    }

    const now = Date.now();
    // In gate mode the gate leader can flip mid-utterance (e.g. vi -> en between
    // partials), which flips the measurement unit above (words vs characters).
    // Comparing sizes across that flip goes deeply negative and would stall
    // drafts for the rest of the utterance, so treat a language change as a
    // fresh utterance for growth-tracking purposes.
    const lastLang = draftLastLangRef.current.get(event.utterance_id);
    const languageFlipped = lastLang !== undefined && lastLang !== event.language;
    const lastSize = languageFlipped ? 0 : draftLastSizeRef.current.get(event.utterance_id) ?? 0;
    const lastAt = draftLastTimestampRef.current.get(event.utterance_id) ?? 0;
    const grewEnough = size - lastSize >= growthGate;
    const elapsedEnough = now - lastAt >= MIN_INTERVAL_MS;
    if (!(grewEnough && elapsedEnough)) {
      return;
    }
    draftLastSizeRef.current.set(event.utterance_id, size);
    draftLastTimestampRef.current.set(event.utterance_id, now);
    draftLastLangRef.current.set(event.utterance_id, event.language);

    const dispatchDraftTranslation = async () => {
      const translator = getOnDeviceTranslator();
      // Wait for warm-up instead of silently dropping the draft. If Splash has
      // already loaded translator, this resolves instantly; otherwise we await the
      // shared in-flight promise so the first few partials still get translated.
      const translatorReady = await translator
        .ensureLoaded('')
        .catch(() => false);
      if (!translatorReady) {
        return;
      }
      const nextVersion = (translationVersionRef.current.get(event.utterance_id) ?? 0) + 1;
      translationVersionRef.current.set(event.utterance_id, nextVersion);
      // Drop any older queued draft — only the freshest partial matters.
      translator.cancelPending();

      translator.translate({
        text: event.text,
        sourceLanguage: mapSourceLanguageToNllb(event.language),
        requestId: nextVersion,
      }).then((result) => {
        const activeVersion = translationVersionRef.current.get(event.utterance_id);
        if (activeVersion !== result.version) return;
        useMeetingStore.getState().handleTranslationMessage(
          event.utterance_id,
          result.text,
          false,
          event.revision,
          event.text,
          event.timestamp_ms,
        );
      }).catch((error) => {
        if (isTranslationCancelledError(error)) {
          return;
        }
        warnLog('[useMeetingSession] Draft translation failed:', error);
      });
    };

    dispatchDraftTranslation().catch((error) => warnLog('[useMeetingSession] Draft translation dispatch failed:', error));
  }, [IOS_DEBUG_TRANSLATION_SAFE_MODE]);

  const handleIncomingPipelineEvent = useCallback((event: MeetingPipelineEvent) => {
    // Khi đang stop, chỉ chặn PARTIAL (không còn ý nghĩa hiển thị). stt_final
    // PHẢI được cho qua: recognizer.stop() drain chính là để bắn final của
    // utterance dở dang — chặn nó sẽ mất câu cuối và (trong cửa sổ gate) lưu
    // hàng placeholder trống vào history.
    if (stoppingSessionRef.current && event.type === 'stt_partial') {
      return;
    }
    useMeetingStore.getState().handlePipelineEvent(event);

    // Log test: các mốc gate (active / locked) đi qua pipeline_status.
    if (event.type === 'pipeline_status' && event.details && /gate/i.test(event.details)) {
      testLog(event.session_id, {kind: 'gate', detail: event.details});
    }

    if (event.type === 'utterance_cancel') {
      // Purge per-utterance throttle state; the store drops the translation
      // entry itself.
      draftLastSizeRef.current.delete(event.utterance_id);
      draftLastTimestampRef.current.delete(event.utterance_id);
      draftLastLangRef.current.delete(event.utterance_id);
      translationVersionRef.current.delete(event.utterance_id);
    }

    if (event.type === 'stt_partial') {
      // Keep Android focused on STT quality first; draft translation is iOS-only
      // for now to avoid CPU contention with live recognition.
      if (Platform.OS !== 'android' || ANDROID_ENABLE_DRAFT_TRANSLATION) {
        maybeTranslateDraft(event);
      }

      // Record STT latency proxy: time from event timestamp to JS receipt.
      // architecture.md §5.1 targets STT partial ~200ms. This is the best available
      // proxy since exact per-chunk processing time is not surfaced by sherpa-onnx.
      const eventTime = event.timestamp_ms ?? Date.now();
      const processingLatencyMs = Math.max(1, Date.now() - eventTime);
      useDeveloperMetricsStore.getState().recordSttLatency(processingLatencyMs);
    }

    if (event.type === 'stt_final') {
      // Release draft throttle state for this utterance — no more partials
      // will arrive for it.
      draftLastSizeRef.current.delete(event.utterance_id);
      draftLastTimestampRef.current.delete(event.utterance_id);
      draftLastLangRef.current.delete(event.utterance_id);

      // Record STT latency for final emissions as well
      const eventTime = event.timestamp_ms ?? Date.now();
      const processingLatencyMs = Math.max(1, Date.now() - eventTime);
      useDeveloperMetricsStore.getState().recordSttLatency(processingLatencyMs);

      const dispatchFinalTranslation = async () => {
        const currentStore = useMeetingStore.getState();
        const sessionId = currentStore.session.id ?? event.session_id;
        // Timing đầy đủ để đọc độ trễ từ log: bắt đầu nói → hết nói (thời
        // lượng câu) → STT (decode + dispatch tới UI). Phần dịch xem entry
        // translation_ok của cùng utterance.
        const sttTiming = `nói ${fmtTime(event.start_ms)}→${fmtTime(event.end_ms)} (${((event.end_ms - event.start_ms) / 1000).toFixed(1)}s) · STT +${Date.now() - event.end_ms}ms`;
        testLog(sessionId, {kind: 'stt_final', utteranceId: event.utterance_id, text: event.text, lang: event.language, detail: `engine=${event.engine ?? '?'} | ${sttTiming}${event.gate_debug ? ` | ${event.gate_debug}` : ''}`});

        const assignSpeakerAsync = async () => {
          if (!event.audio_samples || !event.sample_rate || event.audio_samples.length < Math.floor(event.sample_rate * 1.0)) {
            return;
          }

          // Always retain utterance audio for post-session diarization, even when
          // live speaker assignment is disabled for stability.
          getSessionDiarizationWindowService().addUtterance(
            event.utterance_id,
            event.start_ms,
            event.end_ms,
            event.audio_samples,
          );

          if (!LIVE_SPEAKER_ASSIGNMENT_ENABLED) {
            return;
          }

          try {
            const usedOfflineDiarization = await applyOfflineDiarizationWindow(sessionId);
            if (usedOfflineDiarization) {
              return;
            }

            const trimmedSamples = trimSamplesForSpeakerEmbedding(event.audio_samples, event.sample_rate);
            if (trimmedSamples.length < Math.floor(event.sample_rate * 1.0)) {
              return;
            }

            const speakerService = getSpeakerEmbeddingService();
            const embedding = await speakerService.extractEmbedding(trimmedSamples, event.sample_rate);
            if (!embedding) {
              return;
            }

            const clusterService = getSpeakerClusterService();
            const threshold = getDiarizationThreshold();
            const utteranceDuration = trimmedSamples.length / event.sample_rate;
            const decision = clusterService.addEmbedding(
              event.utterance_id,
              Array.from(embedding),
              event.timestamp_ms,
              utteranceDuration,
            );
            const speakerId = decision.speakerId;
            const metadata = clusterService.getSpeakerMetadata(speakerId);
            if (!metadata) {
              return;
            }

            const clusters = clusterService.getClusters();
            const similarities = clusters
              .map((cluster) => {
                const normalizedEmbedding = Array.from(embedding);
                const norm = Math.sqrt(normalizedEmbedding.reduce((sum, value) => sum + value * value, 0)) || 1;
                const unit = normalizedEmbedding.map((value) => value / norm);
                const cosine = cluster.centroid.reduce((sum: number, value: number, index: number) => sum + value * (unit[index] ?? 0), 0);
                return `${cluster.speakerId}:${cosine.toFixed(2)}`;
              })
              .join(' ');
            useDeveloperMetricsStore.getState().recordSpeakerDebug(
              `${speakerService.isUsingHeuristicFallback() ? 'heur' : 'native'} c=${clusters.length} thr=${threshold.toFixed(2)} cos=${decision.bestCosine.toFixed(2)}/${decision.secondBestCosine.toFixed(2)} ${decision.reason} dim=${embedding.length} samp=${trimmedSamples.length} dur=${utteranceDuration.toFixed(1)}s -> ${speakerId} | ${similarities}`,
            );

            const meetingStore = useMeetingStore.getState();
            meetingStore.assignSpeakerToUtterance(event.utterance_id, metadata.speakerId, metadata.speakerLabel);
            const labels = Object.fromEntries(
              clusterService.getClusters().map((cluster) => [cluster.speakerId, cluster.speakerLabel]),
            );
            meetingStore.setSpeakerLabels(labels);
            meetingStore.updateSpeakerCount(clusterService.getSpeakerCount());

            const transcriptEntry = meetingStore.session.transcript.find((entry) => entry.id === event.utterance_id);
            if (!transcriptEntry) {
              return;
            }

            const persistence = getPersistenceService();
            await persistence.saveUtterance({
              id: transcriptEntry.id,
              sessionId,
              timestamp: transcriptEntry.timestamp,
              isFinal: transcriptEntry.isFinal,
              sourceText: transcriptEntry.sourceText,
              sourceLanguage: transcriptEntry.sourceLanguage,
              translatedText: transcriptEntry.translatedText,
              translationLatencyMs:
                meetingStore.session.translations.find((translation) => translation.utteranceId === transcriptEntry.id)?.latencyMs ?? null,
              revision: transcriptEntry.revision,
              speakerId: metadata.speakerId,
              speakerLabel: metadata.speakerLabel,
            });
            await persistence.updateSession(sessionId, {
              speakerCount: clusterService.getSpeakerCount(),
              speakerLabels: labels,
            });
          } catch (speakerError) {
            warnLog('[useMeetingSession] Speaker diarization failed:', speakerError);
          }
        };

        assignSpeakerAsync().catch((speakerError) =>
          warnLog('[useMeetingSession] Speaker assignment task failed:', speakerError),
        );

        const translator = getOnDeviceTranslator();
        const untranslatedItem: DeferredTranslationItem = {
          utteranceId: event.utterance_id,
          sessionId,
          sourceText: event.text,
          sourceLanguage: event.language,
          revision: event.revision,
          timestampMs: event.timestamp_ms,
        };

        // Câu nói trùng ngôn ngữ đích (vd vi khi target=vi) → không dịch,
        // không tạo entry ở lane Dịch; chỉ lưu utterance với translatedText
        // null. KHÔNG đưa vào deferred queue — không có gì để dịch về sau.
        if (event.language === currentStore.session.targetLanguage) {
          testLog(sessionId, {kind: 'translation_skip_same_lang', utteranceId: event.utterance_id, detail: `target=${currentStore.session.targetLanguage}, hiển thị nguyên văn`});
          // Mirror nguyên văn vào lane Dịch + lưu history đồng nhất (latency 0,
          // không chạy translator).
          useMeetingStore.getState().handleTranslationMessage(
            event.utterance_id,
            event.text,
            true,
            event.revision,
            event.text,
            event.timestamp_ms,
          );
          const persistence = getPersistenceService();
          persistence
            .saveFinalUtteranceWithTranslation(
              {
                ...buildUntranslatedUtteranceData(
                  sessionId,
                  event.utterance_id,
                  event.text,
                  event.language,
                  event.revision,
                  event.timestamp_ms,
                ),
                // Mirror: history hiển thị đồng nhất với lane Dịch.
                translatedText: event.text,
                translationLatencyMs: 0,
              },
              {
                id: `trans_${event.utterance_id}_final`,
                utteranceId: event.utterance_id,
                text: event.text,
                latencyMs: 0,
                createdAt: Date.now(),
              },
            )
            .catch((err) =>
              warnLog('[useMeetingSession] Failed to persist same-language utterance:', err),
            );
          return;
        }

        if (IOS_DEBUG_TRANSLATION_SAFE_MODE) {
          queueDeferredTranslation(untranslatedItem);
          persistUntranslatedFinal(untranslatedItem).catch((err) =>
            warnLog('[useMeetingSession] Failed to persist deferred untranslated utterance:', err),
          );
          return;
        }

        const translatorReady = await awaitTranslatorReadyForTranslate(180_000);
        if (!translatorReady) {
          warnLog('[useMeetingSession] Translator not ready after wait; skipping translation for utterance.');
          testLog(sessionId, {kind: 'translation_deferred', utteranceId: event.utterance_id, detail: 'translator chưa sẵn sàng sau 180s'});
          queueDeferredTranslation(untranslatedItem);
          persistUntranslatedFinal(untranslatedItem).catch((err) =>
            warnLog('[useMeetingSession] Failed to persist untranslated utterance:', err),
          );
          return;
        }
        const nextVersion = (translationVersionRef.current.get(event.utterance_id) ?? 0) + 1;
        translationVersionRef.current.set(event.utterance_id, nextVersion);
        translator.cancelPending();
        const startedAt = Date.now();
        const translationInputText = prepareTranslationText(event.text, IOS_DEBUG_TRANSLATION_SAFE_MODE);

        translator
          .translate({
            text: translationInputText,
            sourceLanguage: mapSourceLanguageToNllb(event.language),
            requestId: nextVersion,
          })
          .then((result) => {
            const activeVersion = translationVersionRef.current.get(event.utterance_id);
            if (activeVersion !== result.version) {
              testLog(sessionId, {kind: 'translation_cancelled', utteranceId: event.utterance_id, detail: 'kết quả cũ, đã có bản mới hơn'});
              return;
            }
            testLog(sessionId, {kind: 'translation_ok', utteranceId: event.utterance_id, text: result.text, detail: `dịch ${Date.now() - startedAt}ms · bắt đầu +${startedAt - event.end_ms}ms sau hết nói`});

            useMeetingStore.getState().handleTranslationMessage(
              event.utterance_id,
              result.text,
              true,
              event.revision,
              translationInputText,
              event.timestamp_ms,
            );

            // Persist utterance + translation atomically within 100ms of translation ready (AC: 1)
            // Using runInBatch would defer writes; direct call ensures immediate persistence.
            const latencyMs = Date.now() - startedAt;

            // Record translation latency for developer metrics overlay
            useDeveloperMetricsStore.getState().recordTranslationLatency(latencyMs);

            const persistence = getPersistenceService();
            const activeSessionId = useMeetingStore.getState().session.id ?? event.session_id;
            const utteranceData: UtteranceData = {
              id: event.utterance_id,
              sessionId: activeSessionId,
              timestamp: event.timestamp_ms,
              isFinal: true,
               sourceText: event.text,
               sourceLanguage: event.language,
               translatedText: result.text,
              translationLatencyMs: latencyMs,
              revision: event.revision,
            };
            const translationId = `trans_${event.utterance_id}_final`;
            const translationData: TranslationData = {
              id: translationId,
              utteranceId: event.utterance_id,
              text: result.text,
              latencyMs,
              createdAt: Date.now(),
            };
            persistence
              .saveFinalUtteranceWithTranslation(utteranceData, translationData)
              .catch((err) => warnLog('[useMeetingSession] Failed to persist final utterance+translation:', err));
          })
          .catch((error) => {
            if (isTranslationCancelledError(error)) {
              testLog(sessionId, {kind: 'translation_cancelled', utteranceId: event.utterance_id, detail: 'bị hủy bởi yêu cầu dịch mới hơn'});
              return;
            }
            testLog(sessionId, {kind: 'translation_error', utteranceId: event.utterance_id, detail: error instanceof Error ? `${error.name}: ${error.message}` : String(error)});
            queueDeferredTranslation(untranslatedItem);

            const translatorPausedForMemory =
              error instanceof Error && error.name === 'TranslationSuppressedForMemoryError';

            warnLog('[useMeetingSession] On-device translation failed:', error);
            if (!translatorPausedForMemory) {
              useMeetingStore.getState().handleTranslationMessage(
                event.utterance_id,
                'Translation failed',
                true,
                event.revision,
                translationInputText,
                event.timestamp_ms,
              );
            }

            persistUntranslatedFinal(untranslatedItem).catch((err) =>
              warnLog('[useMeetingSession] Failed to persist utterance after translation failure:', err),
            );
          });
      };

      dispatchFinalTranslation().catch((error) => {
        warnLog('[useMeetingSession] Final translation dispatch failed:', error);
      });
    }
  }, [IOS_DEBUG_TRANSLATION_SAFE_MODE, LIVE_SPEAKER_ASSIGNMENT_ENABLED, applyOfflineDiarizationWindow, maybeTranslateDraft, persistUntranslatedFinal, queueDeferredTranslation, trimSamplesForSpeakerEmbedding]);

  useEffect(() => {
    meetingPipeline = getMeetingPipelineInstance();
    pipelineRef.current = meetingPipeline;
    const unsubscribe = meetingPipeline.subscribe(handleIncomingPipelineEvent);

    return () => {
      const currentSession = useMeetingStore.getState().session;
      const recognizer = realRecognizerRef.current ?? realSpeechRecognizer;
      const pipeline = pipelineRef.current ?? meetingPipeline;

      getOnDeviceTranslator().cancelPending();

      if (currentSession.status === 'recording' || currentSession.status === 'stopping') {
        (async () => {
          if (currentSession.id) {
            const persistence = getPersistenceService();
            await persistence.updateSession(currentSession.id, {
              status: 'interrupted',
              endedAt: Date.now(),
            });
          }

          try {
            await recognizer?.stop();
          } catch (error) {
            warnLog('[useMeetingSession] Failed to stop recognizer during cleanup:', error);
          }


          try {
            await pipeline?.stop();
          } catch (error) {
            warnLog('[useMeetingSession] Failed to stop pipeline during cleanup:', error);
          }

          releaseMeetingPipelineInstance();
        })().catch((error) => warnLog('[useMeetingSession] Cleanup task failed:', error));
      }

      unsubscribe();
    };
  }, [handleIncomingPipelineEvent]);

  // Track app foreground/background transitions during an active recording.
  // With UIBackgroundModes:audio the native audio capture and JS processing
  // continue uninterrupted — this effect only updates a flag used for logging
  // and ensures no side-effects are skipped when the app returns to foreground.
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState) => {
      const currentSession = useMeetingStore.getState().session;
      const isRecording = currentSession.status === 'recording' || currentSession.status === 'paused';

      if (nextState === 'background' || nextState === 'inactive') {
        isInBackgroundRef.current = true;
        if (isRecording) {
          debugLog('[useMeetingSession] App backgrounded — recording continues via UIBackgroundModes:audio.');
        }
      } else if (nextState === 'active') {
        const wasInBackground = isInBackgroundRef.current;
        isInBackgroundRef.current = false;
        if (wasInBackground && isRecording) {
          debugLog('[useMeetingSession] App foregrounded — resuming normal operation.');
        }
      }
    });

    return () => subscription.remove();
  }, []);

  useEffect(() => {
    if (!session.id) {
      lastPersistedSessionMetaRef.current = null;
      return;
    }

    const normalizedStatus =
      session.status === 'recording' || session.status === 'stopping'
        ? 'live'
        : session.status === 'complete'
          ? 'complete'
          : 'interrupted';
    const persistKey = `${session.id}:${normalizedStatus}:${session.endedAt ?? 'null'}`;

    if (lastPersistedSessionMetaRef.current === persistKey) {
      return;
    }
    lastPersistedSessionMetaRef.current = persistKey;

    const persistence = getPersistenceService();
    persistence.updateSession(session.id, {
      endedAt: session.endedAt,
      status: normalizedStatus,
    }).catch((error) => {
      warnLog('[useMeetingSession] Failed to persist active session:', error);
      lastPersistedSessionMetaRef.current = null;
    });
  }, [session.id, session.status, session.endedAt]);

  const finalizePartialTranscript = useCallback(
    (utteranceId: UtteranceId, text: string, language: SourceLanguage, _confidence: number) => {
      const currentSession = store.session;
      if (!currentSession.id) return;

      const existingIndex = currentSession.transcript.findIndex((t) => t.id === utteranceId);
      const currentRevision = currentSession.transcript.find((entry) => entry.id === utteranceId)?.revision ?? 0;
      const finalRevision = currentRevision + 1;

      const finalizedEntry: TranscriptEntry = {
        id: utteranceId,
        sessionId: currentSession.id,
        timestamp: Date.now(),
        isFinal: true,
        sourceText: text,
        partialText: '',
        sourceLanguage: language,
        translatedText: null,
        revision: finalRevision,
      };

      if (existingIndex >= 0) {
        store.updateTranscriptEntry(utteranceId, finalizedEntry);
      } else {
        store.addTranscriptEntry({
          id: utteranceId,
          timestamp: Date.now(),
          isFinal: true,
          sourceText: text,
          partialText: '',
          sourceLanguage: language,
          translatedText: null,
          revision: finalRevision,
        });
      }
    },
    [store]
  );

  const startMeeting = useCallback(
    async (
      sourceLanguage: SourceLanguage = 'en',
      targetLanguage: TargetLanguage = 'vi',
      options?: {gateMode?: boolean},
    ) => {
      const effectiveSourceLanguage: SourceLanguage = sourceLanguage;

      console.warn('[useMeetingSession] startMeeting: entered', {effectiveSourceLanguage, targetLanguage});
      const persistence = getPersistenceService();
      const translator = getOnDeviceTranslator();
      translator.cancelPending();
      translator.clearMemoryPressureSuppression();
      stoppingSessionRef.current = false;
      if (IOS_DEBUG_TRANSLATION_SAFE_MODE) {
        console.warn('[useMeetingSession] iOS debug live translation disabled; final utterances will be backfilled after stopMeeting.');
      }
      getSpeakerClusterService().reset();
      getSessionDiarizationWindowService().reset(Date.now(), 16000);
      const sessionId = store.startSession(effectiveSourceLanguage, targetLanguage);
      if (!sessionId) return;
      await ensureDeviceTag();
      testLog(sessionId, {kind: 'session_start', lang: targetLanguage, detail: `source=${effectiveSourceLanguage}, gateMode=${options?.gateMode === true}, ${deviceMeta()}`});

      const currentSession = {
        ...store.session,
        id: sessionId,
        status: 'recording' as const,
        startedAt: Date.now(),
        sourceLanguage: effectiveSourceLanguage,
        targetLanguage,
      };

      let startedWithRealRecognizer = false;
      let recognizerStartError: unknown = null;
      if (LIVE_SPEAKER_ASSIGNMENT_ENABLED) {
        getSpeakerEmbeddingService().initialize().catch((error) => {
          warnLog('[useMeetingSession] Speaker embedding init failed; continuing without diarization.', error);
        });
      }
      // Engine theo ngôn ngữ input: 'vi' → Zipformer-VI transducer, còn lại →
      // SenseVoice auto-detect (EN/JA/KO/ZH). Chọn trong RealSpeechRecognizer.start().
      if (Platform.OS === 'ios' || Platform.OS === 'android') {
        try {
          console.warn('[useMeetingSession] real recognizer start: entering', {platform: Platform.OS, sessionId});
          realSpeechRecognizer = getRealSpeechRecognizer();
          console.warn('[useMeetingSession] real recognizer start: instance ready', {hasInstance: !!realSpeechRecognizer});
          realRecognizerRef.current = realSpeechRecognizer;
          await realSpeechRecognizer.start(
            sessionId,
            handleIncomingPipelineEvent,
            effectiveSourceLanguage,
            {gateMode: options?.gateMode === true, targetLanguage},
          );
          console.warn('[useMeetingSession] real recognizer start: success', {sessionId});
          startedWithRealRecognizer = true;
        } catch (error) {
          recognizerStartError = error;
          console.warn('[useMeetingSession] real recognizer start: failed', {sessionId, error});
          warnLog('[useMeetingSession] Real recognizer failed to start:', error);
        }
      }

      if (!startedWithRealRecognizer) {
        const message =
          recognizerStartError instanceof Error
            ? recognizerStartError.message
            : 'Real speech recognizer failed to start.';
        if (!__DEV__) {
          warnLog('[useMeetingSession] Real recognizer unavailable in release build; simulated fallback is disabled.', recognizerStartError);
          store.setPipelineStatus('error', message);
          store.interruptSession();
          return;
        }

        warnLog('[useMeetingSession] Falling back to simulated pipeline');
        try {
          const pipeline = pipelineRef.current ?? meetingPipeline;
          console.warn('[useMeetingSession] fallback pipeline start', {sessionId, hasPipeline: !!pipeline});
          if (pipeline) {
            await pipeline.start(sessionId);
            console.warn('[useMeetingSession] fallback pipeline start: success', {sessionId});
          }
        } catch (error) {
          console.warn('[useMeetingSession] fallback pipeline start: failed', {sessionId, error});
          warnLog('[useMeetingSession] Simulated pipeline also failed:', error);
          store.setPipelineStatus('error', error instanceof Error ? error.message : 'No recognizer available');
        }
      }

      // Do not eagerly load translator here. On iOS devices this competes with the
      // already-live STT model and can trigger critical memory pressure before
      // the first translation is even needed. Translation initialization stays
      // lazy and is awaited by the actual translation path.

      const sessionData: SessionData = {
        id: sessionId,
        startedAt: currentSession.startedAt!,
        endedAt: null,
        sourceLanguage,
        targetLanguage,
        status: 'live',
      };
      await persistence.saveSession(sessionData);
      if (Platform.OS === 'android') {
        startBackgroundRecording(
          'MVA',
          useMeetingStore.getState().session.startedAt ?? Date.now(),
        ).catch(() => undefined);
      }
      debugLog('[useMeetingSession] Meeting started:', currentSession.id);
    },
    [IOS_DEBUG_TRANSLATION_SAFE_MODE, LIVE_SPEAKER_ASSIGNMENT_ENABLED, handleIncomingPipelineEvent, store]
  );

  const pauseMeeting = useCallback(async () => {
    const recognizer = realRecognizerRef.current;
    if (!recognizer) return;
    store.pauseSession();
    await recognizer.pause();
    if (Platform.OS === 'android') pauseBackgroundRecording();
  }, [store]);

  useEffect(() => {
    if (Platform.OS !== 'android') return;
    console.warn('[BG] registering meeting_bg_pause listener, emitter=', !!BackgroundRecordingEmitter);
    const sub = BackgroundRecordingEmitter?.addListener(
      'meeting_bg_pause',
      () => {
        console.warn('[BG] meeting_bg_pause received');
        useMeetingStore.getState().pauseSession();
        realRecognizerRef.current?.pause();
      },
    );
    return () => sub?.remove();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const resumeMeeting = useCallback(async () => {
    const recognizer = realRecognizerRef.current;
    if (!recognizer) return;
    await recognizer.resume();
    store.resumeSession();
    if (Platform.OS === 'android') {
      const {pausedTotalMs} = useMeetingStore.getState().session;
      resumeBackgroundRecording(pausedTotalMs);
    }
  }, [store]);

  useEffect(() => {
    if (Platform.OS !== 'android') return;
    console.warn('[BG] registering meeting_bg_resume listener, emitter=', !!BackgroundRecordingEmitter);
    const sub = BackgroundRecordingEmitter?.addListener(
      'meeting_bg_resume',
      () => {
        console.warn('[BG] meeting_bg_resume received');
        realRecognizerRef.current?.resume();
        useMeetingStore.getState().resumeSession();
      },
    );
    return () => sub?.remove();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const stopMeeting = useCallback(async () => {
    const persistence = getPersistenceService();
    const translator = getOnDeviceTranslator();
    store.beginStop();
    stoppingSessionRef.current = true;
    translator.cancelPending();

    const recognizer = realRecognizerRef.current ?? realSpeechRecognizer;
    const sessionSamples = recognizer?.getSessionAudioBuffer() ?? [];

    if (recognizer) {
      try {
        await recognizer.stop();
      } catch (error) {
        errorLog('[useMeetingSession] Failed to stop real recognizer:', error);
      }
    }

    const pipeline = pipelineRef.current ?? meetingPipeline;
    if (pipeline) {
      try {
        await pipeline.stop();
      } catch (error) {
        errorLog('[useMeetingSession] Failed to stop pipeline:', error);
      }
    }

    releaseMeetingPipelineInstance();
    await translator.unload().catch(() => undefined);
    await translator.waitForIdle(5000).catch(() => false);

    // Snapshot session AFTER recognizer/pipeline stop so any flushed final
    // utterance is included before we hand off to the review screen.
    const currentSession = useMeetingStore.getState().session;
    if (Platform.OS === 'android') {
      stopBackgroundRecording();
    }
    store.stopSession();

    if (!currentSession.id) {
      getSpeakerClusterService().reset();
      getSessionDiarizationWindowService().reset(0, 16000);
      getOfflineSpeakerDiarizationService().unload().catch(() => undefined);
      releaseSpeakerEmbeddingService();
      stoppingSessionRef.current = false;
      return {sessionId: null, fallbackSession: null, fallbackUtterances: []};
    }

    const endedAt = Date.now();
    const finalSessionData: SessionData = {
      id: currentSession.id,
      startedAt: currentSession.startedAt ?? endedAt,
      endedAt,
      sourceLanguage: currentSession.sourceLanguage,
      targetLanguage: currentSession.targetLanguage,
      status: 'complete',
      speakerCount: currentSession.speakerCount,
      speakerLabels: currentSession.speakerLabels,
    };

    // Chỉ lưu utterance đã final — entry non-final còn sót (partial/placeholder
    // gate) không được phép vào history.
    const utterances: UtteranceData[] = currentSession.transcript
      .filter((entry) => entry.isFinal)
      .map((entry) => ({
      id: entry.id,
      sessionId: entry.sessionId,
      timestamp: entry.timestamp,
      isFinal: entry.isFinal,
      sourceText: entry.sourceText,
      sourceLanguage: entry.sourceLanguage,
      translatedText: entry.translatedText,
      translationLatencyMs:
        currentSession.translations.find((t) => t.utteranceId === entry.id)?.latencyMs ?? null,
      revision: entry.revision,
      speakerId: entry.speakerId ?? null,
      speakerLabel: entry.speakerLabel ?? null,
    }));

    // Fast save: session + all utterances in parallel — user sees SessionReview immediately.
    await persistence.saveSession(finalSessionData);
    await Promise.all(utterances.map((u) => persistence.saveUtterance(u)));

    // Chốt log test của phiên và ghi ra file để xem/chia sẻ từ màn Review.
    if (currentSession.id) {
      const logSessionId = currentSession.id;
      testLog(logSessionId, {kind: 'session_stop', detail: `${utterances.length} utterance đã lưu`});
      flushSessionTestLog(logSessionId).catch(() => {});
    }

    debugLog('[useMeetingSession] Meeting stopped, navigating. Background post-processing will continue.');

    // Heavy post-processing runs in the background after navigation.
    // It updates speaker labels and deferred translations in the DB;
    // SessionReview re-reads the session on focus if it needs the latest data.
    const capturedSessionId = currentSession.id;
    const capturedTargetLanguage = currentSession.targetLanguage;
    ;(async () => {
      try {
        await applyPostSessionDiarization(capturedSessionId, sessionSamples);
        await processDeferredTranslationsAfterMeeting(capturedSessionId, capturedTargetLanguage);
      } catch (error) {
        warnLog('[useMeetingSession] Background post-processing error:', error);
      } finally {
        getSpeakerClusterService().reset();
        getSessionDiarizationWindowService().reset(0, 16000);
        getOfflineSpeakerDiarizationService().unload().catch(() => undefined);
        releaseSpeakerEmbeddingService();
        stoppingSessionRef.current = false;
      }
    })().catch(() => undefined);

    return {
      sessionId: capturedSessionId,
      fallbackSession: finalSessionData,
      fallbackUtterances: utterances,
    };
  }, [applyPostSessionDiarization, processDeferredTranslationsAfterMeeting, store]);

  return {
    isActive: session.status === 'recording' || session.status === 'paused' || session.status === 'stopping',
    isRecording: session.status === 'recording',
    sessionId: session.id,
    session,
    status: session.status,
    connectivity: 'online',
    transcript: session.transcript,
    partialTranscript: session.partialTranscript,
    currentUtteranceId: session.currentUtteranceId,
    startMeeting,
    stopMeeting,
    pauseMeeting,
    resumeMeeting,
    updatePartialTranscript: store.updatePartialTranscript,
    finalizePartialTranscript,
    pipelineStatus: store.pipelineStatus,
    pipelineError: store.pipelineError,
    isOffline: false,
    isDegraded: IOS_DEBUG_TRANSLATION_SAFE_MODE || getOnDeviceTranslator().isSuppressedForMemoryPressure() || (Platform.OS === 'ios' && !isAppleTranslationAvailable()),
    degradedMessage: (Platform.OS === 'ios' && !isAppleTranslationAvailable())
      ? `Translation is not available on iOS ${getIOSVersion()}. iOS 18 or later is required.`
      : IOS_DEBUG_TRANSLATION_SAFE_MODE
        ? 'Live translation is deferred during recording on iOS debug builds to keep the meeting stable. Transcript stays real-time, and queued translations finish automatically after you stop the meeting.'
        : getOnDeviceTranslator().isSuppressedForMemoryPressure()
          ? `Translation paused temporarily while the device frees memory. Live translation will resume automatically in about ${Math.max(1, Math.ceil(getOnDeviceTranslator().getMemoryPressureCooldownRemainingMs() / 1000))}s.`
          : null,
  };
}
