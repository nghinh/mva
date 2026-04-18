/**
 * useMeetingSession Hook
 *
 * Offline-only meeting lifecycle orchestration. STT stays on-device and
 * translation will be wired on-device in Epic 3 v3.0.
 */

import {useCallback, useEffect, useRef} from 'react';
import {Platform} from 'react-native';
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
import {
  getSpeakerEmbeddingService,
  releaseSpeakerEmbeddingService,
} from '../../../native/speaker/SpeakerEmbeddingService';
import {getOfflineSpeakerDiarizationService} from '../../../native/speaker/OfflineSpeakerDiarizationService';
import {getSpeakerClusterService} from '../../../services/speaker/SpeakerClusterService';
import {getSessionDiarizationWindowService} from '../../../services/speaker/SessionDiarizationWindowService';

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
  startMeeting: (sourceLanguage?: SourceLanguage, targetLanguage?: TargetLanguage) => Promise<void>;
  stopMeeting: () => Promise<{sessionId: string | null; fallbackSession: SessionData | null; fallbackUtterances: UtteranceData[]}>;
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
  const lastPersistedSessionMetaRef = useRef<string | null>(null);
  const translationVersionRef = useRef(new Map<UtteranceId, number>());
  const deferredTranslationsRef = useRef(new Map<UtteranceId, DeferredTranslationItem>());
  // Per-utterance draft throttling: only translate partials when the text has
  // grown enough AND enough time has passed since the last draft, so translation does
  // not starve STT CPU.
  const draftLastSizeRef = useRef(new Map<UtteranceId, number>());
  const draftLastTimestampRef = useRef(new Map<UtteranceId, number>());

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
    const diarizationService = getOfflineSpeakerDiarizationService();
    const initialized = diarizationService.isReady() ? true : await diarizationService.initialize();
    if (!initialized) {
      useDeveloperMetricsStore.getState().recordSpeakerDebug('post init-failed');
      return false;
    }

    const sessionAudio = getSessionDiarizationWindowService().buildWindow();
    if (!sessionAudio || sessionSamples.length < sessionAudio.sampleRate * 3) {
      useDeveloperMetricsStore.getState().recordSpeakerDebug(
        `post no-window samples=${sessionSamples.length}`,
      );
      return false;
    }

    useDeveloperMetricsStore.getState().recordSpeakerDebug(
      `post start samples=${sessionSamples.length} utt=${sessionAudio.utterances.length}`,
    );

    const result = await diarizationService.processPostSession(sessionSamples);
    if (!result.segments.length) {
      const speakerService = getSpeakerEmbeddingService();
      await speakerService.initialize();
      const utteranceEntries = getSessionDiarizationWindowService().getUtteranceEntries();
      if (!speakerService.isReady() || utteranceEntries.length === 0) {
        useDeveloperMetricsStore.getState().recordSpeakerDebug(
          `post no-segments speakers=${result.numSpeakers}`,
        );
        return false;
      }

      const clusterService = getSpeakerClusterService();
      clusterService.reset();
      const assignments = new Map<string, {speakerId: string; speakerLabel: string}>();
      for (const utterance of utteranceEntries) {
        if (utterance.samples.length < 16000) continue;
        const trimmed = trimSamplesForSpeakerEmbedding(utterance.samples, sessionAudio.sampleRate);
        if (trimmed.length < 16000) continue;
        const embedding = await speakerService.extractEmbedding(trimmed, sessionAudio.sampleRate);
        if (!embedding) continue;
        const decision = clusterService.addEmbedding(
          utterance.utteranceId,
          Array.from(embedding),
          utterance.endMs,
          trimmed.length / sessionAudio.sampleRate,
        );
        if (decision.speakerId) {
          assignments.set(utterance.utteranceId, {
            speakerId: decision.speakerId,
            speakerLabel: decision.speakerLabel,
          });
        }
      }

      if (assignments.size === 0) {
        useDeveloperMetricsStore.getState().recordSpeakerDebug(
          `post no-segments speakers=${result.numSpeakers}`,
        );
        return false;
      }

      const labels = Object.fromEntries(
        clusterService.getClusters().map((cluster) => [cluster.speakerId, cluster.speakerLabel]),
      );
      const storeState = useMeetingStore.getState();
      storeState.bulkUpdateSpeakers(assignments);
      storeState.setSpeakerLabels(labels);
      storeState.updateSpeakerCount(clusterService.getSpeakerCount());

      const persistence = getPersistenceService();
      await Promise.all(
        Array.from(assignments.entries()).map(([utteranceId, assignment]) => {
          const entry = useMeetingStore.getState().session.transcript.find((item) => item.id === utteranceId);
          if (!entry) return Promise.resolve();
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
        speakerCount: clusterService.getSpeakerCount(),
        speakerLabels: labels,
      });

      useDeveloperMetricsStore.getState().recordSpeakerDebug(
        `post fallback-cluster mapped=${assignments.size} speakers=${clusterService.getSpeakerCount()}`,
      );
      return true;
    }

    const utteranceToLocalSpeaker = new Map<UtteranceId, number>();
    for (const utterance of sessionAudio.utterances) {
      let bestSpeaker: number | null = null;
      let bestOverlap = 0;
      for (const segment of result.segments) {
        const segStartMs = sessionAudio.windowStartMs + segment.startSec * 1000;
        const segEndMs = sessionAudio.windowStartMs + segment.endSec * 1000;
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
    if (utteranceToLocalSpeaker.size === 0) {
      useDeveloperMetricsStore.getState().recordSpeakerDebug(
        `post no-map seg=${result.segments.length} utt=${sessionAudio.utterances.length}`,
      );
      return false;
    }

    const labels: Record<string, string> = {};
    const localToGlobal = new Map<number, string>();
    let nextSpeakerIndex = 1;
    for (const localSpeaker of new Set(result.segments.map((s) => s.speaker))) {
      const speakerId = `S${nextSpeakerIndex}`;
      labels[speakerId] = `Speaker ${nextSpeakerIndex}`;
      localToGlobal.set(localSpeaker, speakerId);
      nextSpeakerIndex += 1;
    }

    const assignments = new Map<string, {speakerId: string; speakerLabel: string}>();
    for (const [utteranceId, localSpeaker] of utteranceToLocalSpeaker.entries()) {
      const globalSpeakerId = localToGlobal.get(localSpeaker);
      if (!globalSpeakerId) continue;
      assignments.set(utteranceId, {speakerId: globalSpeakerId, speakerLabel: labels[globalSpeakerId]});
    }

    const storeState = useMeetingStore.getState();
    storeState.bulkUpdateSpeakers(assignments);
    storeState.setSpeakerLabels(labels);
    storeState.updateSpeakerCount(Object.keys(labels).length);

    const persistence = getPersistenceService();
    await Promise.all(
      Array.from(assignments.entries()).map(([utteranceId, assignment]) => {
        const entry = useMeetingStore.getState().session.transcript.find((item) => item.id === utteranceId);
        if (!entry) return Promise.resolve();
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
      speakerCount: Object.keys(labels).length,
      speakerLabels: labels,
    });
    useDeveloperMetricsStore.getState().recordSpeakerDebug(
      `post ok c=${result.numSpeakers} seg=${result.segments.length} mapped=${assignments.size}`,
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
    const lastSize = draftLastSizeRef.current.get(event.utterance_id) ?? 0;
    const lastAt = draftLastTimestampRef.current.get(event.utterance_id) ?? 0;
    const grewEnough = size - lastSize >= growthGate;
    const elapsedEnough = now - lastAt >= MIN_INTERVAL_MS;
    if (!(grewEnough && elapsedEnough)) {
      return;
    }
    draftLastSizeRef.current.set(event.utterance_id, size);
    draftLastTimestampRef.current.set(event.utterance_id, now);

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
    if (stoppingSessionRef.current && (event.type === 'stt_partial' || event.type === 'stt_final')) {
      return;
    }
    useMeetingStore.getState().handlePipelineEvent(event);

    if (event.type === 'utterance_cancel') {
      // Purge per-utterance throttle state; the store drops the translation
      // entry itself.
      draftLastSizeRef.current.delete(event.utterance_id);
      draftLastTimestampRef.current.delete(event.utterance_id);
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

      // Record STT latency for final emissions as well
      const eventTime = event.timestamp_ms ?? Date.now();
      const processingLatencyMs = Math.max(1, Date.now() - eventTime);
      useDeveloperMetricsStore.getState().recordSttLatency(processingLatencyMs);

      const dispatchFinalTranslation = async () => {
        const currentStore = useMeetingStore.getState();
        const sessionId = currentStore.session.id ?? event.session_id;

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
              return;
            }

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
              return;
            }
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
    async (sourceLanguage: SourceLanguage = 'en', targetLanguage: TargetLanguage = 'vi') => {
      console.warn('[useMeetingSession] startMeeting: entered', {sourceLanguage, targetLanguage});
      const persistence = getPersistenceService();
      getOnDeviceTranslator().clearMemoryPressureSuppression();
      stoppingSessionRef.current = false;
      if (IOS_DEBUG_TRANSLATION_SAFE_MODE) {
        console.warn('[useMeetingSession] iOS debug live translation disabled; final utterances will be backfilled after stopMeeting.');
      }
      getSpeakerClusterService().reset();
      getSessionDiarizationWindowService().reset(Date.now(), 16000);
      const sessionId = store.startSession(sourceLanguage, targetLanguage);
      if (!sessionId) return;

      const currentSession = {
        ...store.session,
        id: sessionId,
        status: 'recording' as const,
        startedAt: Date.now(),
        sourceLanguage,
        targetLanguage,
      };

      let startedWithRealRecognizer = false;
      if (LIVE_SPEAKER_ASSIGNMENT_ENABLED) {
        getSpeakerEmbeddingService().initialize().catch((error) => {
          warnLog('[useMeetingSession] Speaker embedding init failed; continuing without diarization.', error);
        });
      }
      // Disabled in live session for stability on-device.
      if (Platform.OS === 'ios' || Platform.OS === 'android') {
        try {
          console.warn('[useMeetingSession] real recognizer start: entering', {platform: Platform.OS, sessionId});
          realSpeechRecognizer = getRealSpeechRecognizer();
          console.warn('[useMeetingSession] real recognizer start: instance ready', {hasInstance: !!realSpeechRecognizer});
          realRecognizerRef.current = realSpeechRecognizer;
          await realSpeechRecognizer.start(sessionId, handleIncomingPipelineEvent);
          console.warn('[useMeetingSession] real recognizer start: success', {sessionId});
          startedWithRealRecognizer = true;
        } catch (error) {
          console.warn('[useMeetingSession] real recognizer start: failed', {sessionId, error});
          warnLog('[useMeetingSession] Real recognizer failed to start:', error);
        }
      }

      if (!startedWithRealRecognizer) {
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
      debugLog('[useMeetingSession] Meeting started:', currentSession.id);
    },
    [IOS_DEBUG_TRANSLATION_SAFE_MODE, LIVE_SPEAKER_ASSIGNMENT_ENABLED, handleIncomingPipelineEvent, store]
  );

  const stopMeeting = useCallback(async () => {
    console.warn('[useMeetingSession] stopMeeting CALLED');
    const persistence = getPersistenceService();
    const translator = getOnDeviceTranslator();
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
    await translator.waitForIdle(30000).catch(() => false);

    // Capture the freshest possible session snapshot AFTER recognizer/pipeline stop,
    // so any flushed final utterance is included in persistence/review/export.
    const currentSession = useMeetingStore.getState().session;
    store.stopSession();

    if (currentSession.id) {
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

      console.warn('[useMeetingSession] About to persist final session', {
        sessionId: currentSession.id,
        transcriptCount: currentSession.transcript.length,
        translationCount: currentSession.translations.length,
        speakerCount: currentSession.speakerCount,
        speakerLabels: currentSession.speakerLabels,
      });

      await persistence.runInBatch(async () => {
        await persistence.saveSession(finalSessionData);

        const utterances: UtteranceData[] = currentSession.transcript.map((entry) => ({
          id: entry.id,
          sessionId: entry.sessionId,
          timestamp: entry.timestamp,
          isFinal: entry.isFinal,
          sourceText: entry.sourceText,
          sourceLanguage: entry.sourceLanguage,
          translatedText: entry.translatedText,
          translationLatencyMs:
            currentSession.translations.find((translation) => translation.utteranceId === entry.id)?.latencyMs ?? null,
          revision: entry.revision,
          speakerId: entry.speakerId ?? null,
          speakerLabel: entry.speakerLabel ?? null,
        }));

        console.warn('[useMeetingSession] Saving', utterances.length, 'utterances for session', currentSession.id);
        for (const utterance of utterances) {
          await persistence.saveUtterance(utterance);
        }
        console.warn('[useMeetingSession] All utterances saved');
      });

      // Verify session was saved by re-reading it immediately
      const savedSession = await persistence.getSession(currentSession.id);
      console.warn('[useMeetingSession] Saved session verification', {
        sessionId: currentSession.id,
        found: !!savedSession,
        speakerCount: savedSession?.speakerCount,
        speakerLabels: savedSession?.speakerLabels,
        utteranceCount: savedSession ? (await persistence.getUtterances(savedSession.id)).length : 0,
      });

      const persistedSessionCheck = await persistence.getSession(currentSession.id);
      if (!persistedSessionCheck) {
        console.warn('[useMeetingSession] Final session missing after first save, retrying', currentSession.id);
        await persistence.saveSession(finalSessionData);
      }

      await applyPostSessionDiarization(currentSession.id, sessionSamples);
      await processDeferredTranslationsAfterMeeting(currentSession.id, currentSession.targetLanguage);

      const latestSession = (await persistence.getSession(currentSession.id)) ?? finalSessionData;
      const latestUtterances = await persistence.getUtterances(currentSession.id);

      debugLog('[useMeetingSession] Meeting stopped');
      getSpeakerClusterService().reset();
      getSessionDiarizationWindowService().reset(0, 16000);
      getOfflineSpeakerDiarizationService().unload().catch(() => undefined);
      releaseSpeakerEmbeddingService();
      stoppingSessionRef.current = false;
      return {
        sessionId: currentSession.id,
        fallbackSession: latestSession,
        fallbackUtterances: latestUtterances,
      };
    }

    debugLog('[useMeetingSession] Meeting stopped');
    getSpeakerClusterService().reset();
    getSessionDiarizationWindowService().reset(0, 16000);
    getOfflineSpeakerDiarizationService().unload().catch(() => undefined);
    releaseSpeakerEmbeddingService();
    stoppingSessionRef.current = false;
    return {sessionId: null, fallbackSession: null, fallbackUtterances: []};
  }, [applyPostSessionDiarization, processDeferredTranslationsAfterMeeting, store]);

  return {
    isActive: session.status === 'recording' || session.status === 'stopping',
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
    updatePartialTranscript: store.updatePartialTranscript,
    finalizePartialTranscript,
    pipelineStatus: store.pipelineStatus,
    pipelineError: store.pipelineError,
    isOffline: false,
    isDegraded: IOS_DEBUG_TRANSLATION_SAFE_MODE || getOnDeviceTranslator().isSuppressedForMemoryPressure(),
    degradedMessage: IOS_DEBUG_TRANSLATION_SAFE_MODE
      ? 'Live translation is deferred during recording on iOS debug builds to keep the meeting stable. Transcript stays real-time, and queued translations finish automatically after you stop the meeting.'
      : getOnDeviceTranslator().isSuppressedForMemoryPressure()
        ? `Translation paused temporarily while the device frees memory. Live translation will resume automatically in about ${Math.max(1, Math.ceil(getOnDeviceTranslator().getMemoryPressureCooldownRemainingMs() / 1000))}s.`
        : null,
  };
}
