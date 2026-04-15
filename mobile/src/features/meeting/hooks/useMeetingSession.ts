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
import {getDiarizationThreshold} from '../../../shared/config/runtimeConfig';
import {getSpeakerEmbeddingService} from '../../../native/speaker/SpeakerEmbeddingService';
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
  const LIVE_SPEAKER_ASSIGNMENT_ENABLED = false;
  const store = useMeetingStore();
  const preferredTargetLanguage = useTargetLanguage();
  const session = store.session;
  const pipelineRef = useRef<MeetingPipeline | null>(null);
  const realRecognizerRef = useRef<RealSpeechRecognizer | null>(null);
  const translationVersionRef = useRef(new Map<UtteranceId, number>());

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
  }, []);

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
  }, [applyOfflineDiarizationWindow, maybeTranslateDraft, preferredTargetLanguage, trimSamplesForSpeakerEmbedding]);

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
      const translator = getOnDeviceTranslator();
      if (!(await translator.isLoaded())) {
        translator.initialize(getNllbModelDir()).then((ok) => {
          if (!ok) warnLog('[useMeetingSession] Translator model not ready; translation may be unavailable.');
        }).catch((error) => {
          warnLog('[useMeetingSession] Translator init failed; transcript-only mode.', error);
        });
      }
      if (LIVE_SPEAKER_ASSIGNMENT_ENABLED) {
        getSpeakerEmbeddingService().initialize().catch((error) => {
          warnLog('[useMeetingSession] Speaker embedding init failed; continuing without diarization.', error);
        });
      }
      // Disabled in live session for stability on-device.
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

    store.stopSession();

    if (currentSession.id) {
      await persistence.runInBatch(async () => {
        await persistence.updateSession(currentSession.id!, {
          endedAt: Date.now(),
          status: 'complete',
          speakerCount: currentSession.speakerCount,
          speakerLabels: currentSession.speakerLabels,
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
          speakerId: entry.speakerId ?? null,
          speakerLabel: entry.speakerLabel ?? null,
        }));

        for (const utterance of utterances) {
          await persistence.saveUtterance(utterance);
        }
      });

      try {
        await applyPostSessionDiarization(currentSession.id, sessionSamples);
      } catch (error) {
        warnLog('[useMeetingSession] Post-session speaker diarization failed:', error);
      }
    }

    debugLog('[useMeetingSession] Meeting stopped');
    getSpeakerClusterService().reset();
    getSessionDiarizationWindowService().reset(0, 16000);
    getOfflineSpeakerDiarizationService().unload().catch(() => undefined);
  }, [applyPostSessionDiarization, store]);

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
