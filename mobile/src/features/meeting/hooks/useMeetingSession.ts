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
  UtteranceData,
} from '../../../services/persistence';
import {SourceLanguage, TargetLanguage, SessionId, UtteranceId} from '../../../shared/types';
import type {MeetingPipelineEvent} from '../../../shared/types/meeting';
import {debugLog, errorLog, warnLog} from '../../../shared/utils/logger';
import {
  getOnDeviceTranslator,
  isTranslationCancelledError,
  mapSourceLanguageToNllb,
} from '../../../services/OnDeviceTranslator';
import {getNllbModelDir} from '../../../native/nllb/modelPaths';
import {
  getMeetingPipelineInstance,
  MeetingPipeline,
  releaseMeetingPipelineInstance,
} from '../../../native/stt/MeetingPipeline';
import {getRealSpeechRecognizer, RealSpeechRecognizer} from '../../../native/stt/RealSpeechRecognizer';

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
    persistenceService.initialize();
  }
  return persistenceService;
}

export function useMeetingSession(): UseMeetingSessionReturn {
  const store = useMeetingStore();
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
      try {
        maybeTranslateDraft(event);
      } catch (error) {
        warnLog('[useMeetingSession] Draft translation dispatch failed:', error);
      }
    }

    if (event.type === 'stt_final') {
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
              Date.now() - startedAt,
            );
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
          });
      };

      dispatchFinalTranslation().catch((error) => {
        warnLog('[useMeetingSession] Final translation dispatch failed:', error);
      });
    }
  }, [maybeTranslateDraft]);

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
        try {
          const initialized = await translator.initialize(getNllbModelDir());
          if (!initialized) {
            warnLog('[useMeetingSession] Translator model not ready; continuing without translation for now.');
          }
        } catch (error) {
          warnLog('[useMeetingSession] Translator initialization failed; continuing with transcript only.', error);
        }
      }
      if (Platform.OS === 'ios' || Platform.OS === 'android') {
        try {
          realSpeechRecognizer = getRealSpeechRecognizer();
          realRecognizerRef.current = realSpeechRecognizer;
          await realSpeechRecognizer.start(sessionId, handleIncomingPipelineEvent);
          startedWithRealRecognizer = true;
        } catch (error) {
          warnLog('[useMeetingSession] Real recognizer failed to start:', error);
          store.setPipelineStatus('error', error instanceof Error ? error.message : 'Recognizer failed to start');
        }
      }

      if (!startedWithRealRecognizer) {
        warnLog('[useMeetingSession] Meeting started without active recognizer.');
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
    [handleIncomingPipelineEvent, store]
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
          suggestionText: null,
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
