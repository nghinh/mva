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
  mapTargetLanguageToNllb,
} from '../../../services/OnDeviceTranslator';
import {getNllbModelDir} from '../../../native/nllb/modelPaths';
import {
  getMeetingPipelineInstance,
  MeetingPipeline,
  releaseMeetingPipelineInstance,
} from '../../../native/stt/MeetingPipeline';
import {getRealSpeechRecognizer, RealSpeechRecognizer} from '../../../native/stt/RealSpeechRecognizer';
import {useTargetLanguage} from '../../../shared/store';

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
  stopMeeting: () => Promise<void>;
  updatePartialTranscript: (utteranceId: UtteranceId, text: string, language: SourceLanguage, revision: number) => void;
  finalizePartialTranscript: (utteranceId: UtteranceId, text: string, language: SourceLanguage, confidence: number) => void;
  pipelineStatus: string;
  pipelineError: string | null;
  isOffline: boolean;
  isDegraded: boolean;
}

let persistenceService: PersistenceService | null = null;
let meetingPipeline: MeetingPipeline | null = null;
let realSpeechRecognizer: RealSpeechRecognizer | null = null;

function getPersistenceService(): PersistenceService {
  if (!persistenceService) {
    persistenceService = createPersistenceService();
    persistenceService.ensureInitialized();
  }
  return persistenceService;
}

export function useMeetingSession(): UseMeetingSessionReturn {
  const store = useMeetingStore();
  const preferredTargetLanguage = useTargetLanguage();
  const session = store.session;
  const pipelineRef = useRef<MeetingPipeline | null>(null);
  const realRecognizerRef = useRef<RealSpeechRecognizer | null>(null);
  const translationVersionRef = useRef(new Map<UtteranceId, number>());

  const maybeTranslateDraft = useCallback((event: Extract<MeetingPipelineEvent, {type: 'stt_partial'}>) => {
    const threshold = event.language === 'en' ? 5 : 12;
    const size = event.language === 'en' ? event.text.trim().split(/\s+/).filter(Boolean).length : Array.from(event.text.trim()).length;
    if (size < threshold) {
      return;
    }

    const dispatchDraftTranslation = async () => {
      const translator = getOnDeviceTranslator();
      if (!(await translator.isLoaded())) {
        return;
      }
      const nextVersion = (translationVersionRef.current.get(event.utterance_id) ?? 0) + 1;
      translationVersionRef.current.set(event.utterance_id, nextVersion);
      translator.cancelPending();

        translator.translate({
          text: event.text,
          sourceLanguage: mapSourceLanguageToNllb(event.language),
          targetLanguage: mapTargetLanguageToNllb(preferredTargetLanguage),
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
  }, []);

  const handleIncomingPipelineEvent = useCallback((event: MeetingPipelineEvent) => {
    useMeetingStore.getState().handlePipelineEvent(event);

    if (event.type === 'stt_partial') {
      // Draft translation disabled: NLLB inference on every partial starves STT CPU.
      // Translation runs only on stt_final below.

      // Record STT latency proxy: time from event timestamp to JS receipt.
      // architecture.md §5.1 targets STT partial ~200ms. This is the best available
      // proxy since exact per-chunk processing time is not surfaced by sherpa-onnx.
      const eventTime = event.timestamp_ms ?? Date.now();
      const processingLatencyMs = Math.max(1, Date.now() - eventTime);
      useDeveloperMetricsStore.getState().recordSttLatency(processingLatencyMs);
    }

    if (event.type === 'stt_final') {
      // Record STT latency for final emissions as well
      const eventTime = event.timestamp_ms ?? Date.now();
      const processingLatencyMs = Math.max(1, Date.now() - eventTime);
      useDeveloperMetricsStore.getState().recordSttLatency(processingLatencyMs);

      const dispatchFinalTranslation = async () => {
        const translator = getOnDeviceTranslator();
        if (!(await translator.isLoaded())) {
          return;
        }
        const nextVersion = (translationVersionRef.current.get(event.utterance_id) ?? 0) + 1;
        translationVersionRef.current.set(event.utterance_id, nextVersion);
        translator.cancelPending();
        const startedAt = Date.now();

        translator
          .translate({
            text: event.text,
            sourceLanguage: mapSourceLanguageToNllb(event.language),
            targetLanguage: mapTargetLanguageToNllb(preferredTargetLanguage),
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
              event.text,
              event.timestamp_ms,
            );

            // Persist utterance + translation atomically within 100ms of translation ready (AC: 1)
            // Using runInBatch would defer writes; direct call ensures immediate persistence.
            const latencyMs = Date.now() - startedAt;

            // Record translation latency for developer metrics overlay
            useDeveloperMetricsStore.getState().recordTranslationLatency(latencyMs);

            const persistence = getPersistenceService();
            const sessionId = useMeetingStore.getState().session.id ?? event.session_id;
            const utteranceData: UtteranceData = {
              id: event.utterance_id,
              sessionId,
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
            warnLog('[useMeetingSession] On-device translation failed:', error);
            useMeetingStore.getState().handleTranslationMessage(
              event.utterance_id,
              'Translation failed',
              true,
              event.revision,
              event.text,
              event.timestamp_ms,
            );

            // Persist utterance even when translation fails (AC: 2 — crash recovery still needs the utterance)
            const persistence = getPersistenceService();
            const sessionId = useMeetingStore.getState().session.id ?? event.session_id;
            const utteranceData: UtteranceData = {
              id: event.utterance_id,
              sessionId,
              timestamp: event.timestamp_ms,
              isFinal: true,
              sourceText: event.text,
              sourceLanguage: event.language,
              translatedText: null,
              translationLatencyMs: null,
              revision: event.revision,
            };
            persistence
              .saveFinalUtteranceWithTranslation(utteranceData, null)
              .catch((err) => warnLog('[useMeetingSession] Failed to persist utterance after translation failure:', err));
          });
      };

      dispatchFinalTranslation().catch((error) => {
        warnLog('[useMeetingSession] Final translation dispatch failed:', error);
      });
    }
  }, [maybeTranslateDraft, preferredTargetLanguage]);

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
    const currentSession = session;
    if (!currentSession.id) {
      return;
    }

    const persistence = getPersistenceService();
    persistence.updateSession(currentSession.id, {
      endedAt: currentSession.endedAt,
      status:
        currentSession.status === 'recording' || currentSession.status === 'stopping'
          ? 'live'
          : currentSession.status === 'complete'
            ? 'complete'
            : 'interrupted',
    }).catch((error) => {
      warnLog('[useMeetingSession] Failed to persist active session:', error);
    });
  }, [session]);

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
      const persistence = getPersistenceService();
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
      const translator = getOnDeviceTranslator();
      if (!(await translator.isLoaded())) {
        translator.initialize(getNllbModelDir()).then((ok) => {
          if (!ok) warnLog('[useMeetingSession] Translator model not ready; translation may be unavailable.');
        }).catch((error) => {
          warnLog('[useMeetingSession] Translator init failed; transcript-only mode.', error);
        });
      }
      if (Platform.OS === 'ios' || Platform.OS === 'android') {
        try {
          realSpeechRecognizer = getRealSpeechRecognizer();
          realRecognizerRef.current = realSpeechRecognizer;
          await realSpeechRecognizer.start(sessionId, handleIncomingPipelineEvent);
          startedWithRealRecognizer = true;
        } catch (error) {
          warnLog('[useMeetingSession] Real recognizer failed to start:', error);
        }
      }

      if (!startedWithRealRecognizer) {
        warnLog('[useMeetingSession] Falling back to simulated pipeline');
        try {
          const pipeline = pipelineRef.current ?? meetingPipeline;
          if (pipeline) {
            await pipeline.start(sessionId);
          }
        } catch (error) {
          warnLog('[useMeetingSession] Simulated pipeline also failed:', error);
          store.setPipelineStatus('error', error instanceof Error ? error.message : 'No recognizer available');
        }
      }

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
    [handleIncomingPipelineEvent, preferredTargetLanguage, store]
  );

  const stopMeeting = useCallback(async () => {
    const persistence = getPersistenceService();
    const currentSession = store.session;

    const recognizer = realRecognizerRef.current ?? realSpeechRecognizer;
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

    store.stopSession();

    if (currentSession.id) {
      await persistence.runInBatch(async () => {
        await persistence.updateSession(currentSession.id!, {
          endedAt: Date.now(),
          status: 'complete',
        });

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
        }));

        for (const utterance of utterances) {
          await persistence.saveUtterance(utterance);
        }
      });
    }

    debugLog('[useMeetingSession] Meeting stopped');
  }, [store]);

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
    isDegraded: false,
  };
}
