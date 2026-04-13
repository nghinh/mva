import {create} from 'zustand';
import {SessionId, UtteranceId, SourceLanguage, TargetLanguage} from '../../../shared/types';
import {debugLog} from '../../../shared/utils/logger';
import type {PipelineStatus, MeetingPipelineEvent} from '../../../shared/types/meeting';

export type SessionStatus = 'idle' | 'recording' | 'stopping' | 'complete' | 'interrupted';
export type ConnectivityStatus = 'online';

export interface TranscriptEntry {
  id: UtteranceId;
  sessionId: SessionId;
  timestamp: number;
  isFinal: boolean;
  sourceText: string;
  partialText: string;
  sourceLanguage: SourceLanguage;
  translatedText: string | null;
  revision: number;
}

export interface TranslationEntry {
  id: string;
  utteranceId: UtteranceId;
  sessionId: SessionId | null;
  originalText: string;
  translatedText: string;
  timestamp: number;
  isFinal: boolean;
  isProcessing: boolean;
  sttRevision: number;
  source: 'device';
  latencyMs?: number | null;
}

export interface MeetingSession {
  id: SessionId | null;
  status: SessionStatus;
  connectivity: ConnectivityStatus;
  startedAt: number | null;
  endedAt: number | null;
  sourceLanguage: SourceLanguage;
  targetLanguage: TargetLanguage;
  transcript: TranscriptEntry[];
  partialTranscript: string;
  translations: TranslationEntry[];
  currentUtteranceId: UtteranceId | null;
}

const initialMeetingSession: MeetingSession = {
  id: null,
  status: 'idle',
  connectivity: 'online',
  startedAt: null,
  endedAt: null,
  sourceLanguage: 'en',
  targetLanguage: 'vi',
  transcript: [],
  partialTranscript: '',
  translations: [],
  currentUtteranceId: null,
};

interface MeetingStore {
  session: MeetingSession;
  pipelineStatus: PipelineStatus;
  pipelineError: string | null;
  startSession: (sourceLanguage: SourceLanguage, targetLanguage: TargetLanguage) => SessionId;
  stopSession: () => void;
  interruptSession: () => void;
  resetSession: () => void;
  setConnectivity: (_status: ConnectivityStatus) => void;
  setPipelineStatus: (status: PipelineStatus, error?: string) => void;
  addTranscriptEntry: (entry: Omit<TranscriptEntry, 'sessionId'>) => void;
  updateTranscriptEntry: (id: UtteranceId, updates: Partial<TranscriptEntry>) => void;
  finalizePartialTranscript: () => void;
  appendPartialTranscript: (text: string) => void;
  clearPartialTranscript: () => void;
  setCurrentUtteranceId: (utteranceId: UtteranceId | null) => void;
  updatePartialTranscript: (utteranceId: UtteranceId, text: string, language: SourceLanguage, revision: number) => void;
  handlePipelineEvent: (event: MeetingPipelineEvent) => void;
  addTranslation: (utteranceId: UtteranceId, originalText: string, translatedText: string, isFinal: boolean, sttRevision?: number) => void;
  updateTranslation: (utteranceId: UtteranceId, translatedText: string, isFinal: boolean) => void;
  handleTranslationMessage: (utteranceId: UtteranceId, translatedText: string, isFinal: boolean, sttRevision: number, originalText?: string, timestampMs?: number, latencyMs?: number) => void;
  cancelTranslation: (utteranceId: UtteranceId) => void;
}

export const useMeetingStore = create<MeetingStore>((set, get) => ({
  session: initialMeetingSession,
  pipelineStatus: 'idle',
  pipelineError: null,

  startSession: (sourceLanguage, targetLanguage) => {
    const id = `session_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
    set({
      session: {
        ...initialMeetingSession,
        id,
        status: 'recording',
        startedAt: Date.now(),
        sourceLanguage,
        targetLanguage,
      },
      pipelineStatus: 'idle',
      pipelineError: null,
    });
    debugLog('[MeetingStore] Session started:', id);
    return id;
  },

  stopSession: () => {
    const {session} = get();
    if (session.id && session.status === 'recording') {
      const stoppingSessionId = session.id;
      set({session: {...session, status: 'stopping'}});
      setTimeout(() => {
        set((state) => ({
          session:
            state.session.id === stoppingSessionId
              ? {...state.session, status: 'complete', endedAt: Date.now(), connectivity: 'online'}
              : state.session,
        }));
        debugLog('[MeetingStore] Session stopped:', session.id);
      }, 100);
    }
  },

  interruptSession: () => {
    const {session} = get();
    if (session.id) {
      set({session: {...session, status: 'interrupted', endedAt: Date.now(), connectivity: 'online'}});
      debugLog('[MeetingStore] Session interrupted:', session.id);
    }
  },

  resetSession: () => {
    set({session: initialMeetingSession, pipelineStatus: 'idle', pipelineError: null});
    debugLog('[MeetingStore] Session reset');
  },

  setConnectivity: () => {
    set((state) => ({session: {...state.session, connectivity: 'online'}}));
  },

  setPipelineStatus: (status, error) => {
    set({pipelineStatus: status, pipelineError: error ?? null});
    if (status === 'capturing') {
      set((state) => ({session: {...state.session, status: 'recording'}}));
    }
    debugLog('[MeetingStore] Pipeline status:', status, error ?? '');
  },

  addTranscriptEntry: (entry) => {
    const {session} = get();
    if (!session.id) return;
    set({session: {...session, transcript: [...session.transcript, {...entry, sessionId: session.id}], partialTranscript: ''}});
  },

  updateTranscriptEntry: (id, updates) => {
    set((state) => ({
      session: {
        ...state.session,
        transcript: state.session.transcript.map((entry) => (entry.id === id ? {...entry, ...updates} : entry)),
      },
    }));
  },

  finalizePartialTranscript: () => {
    const {session} = get();
    if (!session.id || !session.partialTranscript.trim()) return;
    get().addTranscriptEntry({
      id: `utterance_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
      timestamp: Date.now(),
      isFinal: true,
      sourceText: session.partialTranscript.trim(),
      partialText: '',
      sourceLanguage: session.sourceLanguage,
      translatedText: null,
      revision: 1,
    });
  },

  appendPartialTranscript: (text) => set((state) => ({session: {...state.session, partialTranscript: state.session.partialTranscript + text}})),
  clearPartialTranscript: () => set((state) => ({session: {...state.session, partialTranscript: ''}})),
  setCurrentUtteranceId: (utteranceId) => set((state) => ({session: {...state.session, currentUtteranceId: utteranceId}})),

  updatePartialTranscript: (utteranceId, text, language, revision) => {
    const {session} = get();
    if (!session.id) return;
    const existingIndex = session.transcript.findIndex((t) => t.id === utteranceId && !t.isFinal);
    if (existingIndex >= 0) {
      const existing = session.transcript[existingIndex];
      if (revision < existing.revision) return;
      set((state) => ({
        session: {
          ...state.session,
          transcript: state.session.transcript.map((entry, idx) =>
            idx === existingIndex ? {...entry, partialText: text, sourceText: text, sourceLanguage: language, revision} : entry,
          ),
          partialTranscript: text,
        },
      }));
    } else {
      set((state) => ({
        session: {
          ...state.session,
          transcript: [
            ...state.session.transcript,
            {id: utteranceId, sessionId: session.id!, timestamp: Date.now(), isFinal: false, sourceText: text, partialText: text, sourceLanguage: language, translatedText: null, revision},
          ],
          partialTranscript: text,
          currentUtteranceId: utteranceId,
        },
      }));
    }
  },

  handlePipelineEvent: (event) => {
    const {session} = get();
    switch (event.type) {
      case 'stt_partial':
        if (session.id !== event.session_id) return;
        get().updatePartialTranscript(event.utterance_id, event.text, event.language, event.revision);
        break;
      case 'stt_final':
        if (session.id !== event.session_id) return;
        const existingIndex = session.transcript.findIndex((t) => t.id === event.utterance_id);
        if (existingIndex >= 0) {
          get().updateTranscriptEntry(event.utterance_id, {isFinal: true, sourceText: event.text, partialText: '', sourceLanguage: event.language, revision: event.revision});
        } else {
          get().addTranscriptEntry({id: event.utterance_id, timestamp: event.timestamp_ms, isFinal: true, sourceText: event.text, partialText: '', sourceLanguage: event.language, translatedText: null, revision: event.revision});
        }
        get().setCurrentUtteranceId(null);
        break;
      case 'utterance_cancel':
        if (session.id !== event.session_id) return;
        set((state) => ({
          session: {
            ...state.session,
            transcript: state.session.transcript.filter((entry) => entry.id !== event.utterance_id),
            currentUtteranceId: state.session.currentUtteranceId === event.utterance_id ? null : state.session.currentUtteranceId,
            partialTranscript: state.session.currentUtteranceId === event.utterance_id ? '' : state.session.partialTranscript,
          },
        }));
        get().cancelTranslation(event.utterance_id);
        break;
      case 'language_detected':
        if (session.id !== event.session_id) return;
        set((state) => ({
          session: {
            ...state.session,
            sourceLanguage: event.language,
            transcript: state.session.transcript.map((entry) => (entry.id === event.utterance_id ? {...entry, sourceLanguage: event.language} : entry)),
          },
        }));
        break;
      case 'audio_capture_start':
        if (session.id !== event.session_id) return;
        get().setPipelineStatus('capturing');
        break;
      case 'audio_capture_stop':
        if (session.id !== event.session_id) return;
        get().setPipelineStatus('idle');
        break;
      case 'audio_capture_status':
        if (session.id !== event.session_id) return;
        get().setPipelineStatus(event.status === 'capturing' ? 'capturing' : event.status === 'paused' ? 'processing' : 'idle');
        break;
      case 'pipeline_status':
        if (session.id !== event.session_id) return;
        get().setPipelineStatus(event.status, event.details);
        break;
      default:
        break;
    }
  },

  addTranslation: (utteranceId, originalText, translatedText, isFinal, sttRevision = 0) => {
    const {session} = get();
    const existingIndex = session.translations.findIndex((t) => t.utteranceId === utteranceId);
    const entry: TranslationEntry = {
      id: existingIndex >= 0 ? session.translations[existingIndex].id : `trans_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
      utteranceId,
      sessionId: session.id,
      originalText,
      translatedText,
      timestamp: Date.now(),
      isFinal,
      isProcessing: !isFinal,
      sttRevision,
      source: 'device',
    };
    set((state) => ({
      session: {
        ...state.session,
        transcript: state.session.transcript.map((entryTranscript) => (entryTranscript.id === utteranceId ? {...entryTranscript, translatedText} : entryTranscript)),
        translations: existingIndex >= 0 ? state.session.translations.map((t, idx) => (idx === existingIndex ? entry : t)) : [...state.session.translations, entry],
      },
    }));
  },

  updateTranslation: (utteranceId, translatedText, isFinal) => {
    const {session} = get();
    const existingIndex = session.translations.findIndex((t) => t.utteranceId === utteranceId);
    if (existingIndex >= 0) {
      set((state) => ({
        session: {
          ...state.session,
          translations: state.session.translations.map((t, idx) => (idx === existingIndex ? {...t, translatedText, isFinal, isProcessing: !isFinal} : t)),
        },
      }));
    }
  },

  handleTranslationMessage: (utteranceId, translatedText, isFinal, sttRevision, originalText, timestampMs, latencyMs) => {
    const {session} = get();
    const existingIndex = session.translations.findIndex((t) => t.utteranceId === utteranceId);
    const linkedTranscript = session.transcript.find((entry) => entry.id === utteranceId);
    if (existingIndex < 0 && !linkedTranscript) {
      return;
    }
    const stableTimestamp = existingIndex >= 0 ? session.translations[existingIndex].timestamp : linkedTranscript?.timestamp ?? timestampMs ?? Date.now();
    if (existingIndex >= 0) {
      const existing = session.translations[existingIndex];
      if (existing.sttRevision > sttRevision) return;
      if (existing.isFinal && existing.sttRevision >= sttRevision) return;
    }
    const entry: TranslationEntry = {
      id: existingIndex >= 0 ? session.translations[existingIndex].id : `trans_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
      utteranceId,
      sessionId: session.id,
      originalText: originalText ?? (existingIndex >= 0 ? session.translations[existingIndex].originalText : ''),
      translatedText,
      timestamp: stableTimestamp,
      isFinal,
      isProcessing: false,
      sttRevision,
      source: 'device',
      latencyMs: latencyMs ?? null,
    };
    set((state) => ({
      session: {
        ...state.session,
        transcript: state.session.transcript.map((entryTranscript) => (entryTranscript.id === utteranceId ? {...entryTranscript, translatedText} : entryTranscript)),
        translations: existingIndex >= 0 ? state.session.translations.map((t, idx) => (idx === existingIndex ? entry : t)) : [...state.session.translations, entry],
      },
    }));
    debugLog('[MeetingStore] Translation', isFinal ? 'final' : 'draft', 'for utterance:', utteranceId, 'revision:', sttRevision);
  },

  cancelTranslation: (utteranceId) => {
    const {session} = get();
    set((state) => ({session: {...state.session, translations: session.translations.filter((t) => t.utteranceId !== utteranceId)}}));
  },
}));

export const useMeetingSession = () => useMeetingStore((store) => store.session);
export const useSessionStatus = () => useMeetingStore((store) => store.session.status);
export const useConnectivityStatus = () => useMeetingStore((store) => store.session.connectivity);
export const useTranscript = () => useMeetingStore((store) => store.session.transcript);
export const usePartialTranscript = () => useMeetingStore((store) => store.session.partialTranscript);
export const useIsSessionActive = () => useMeetingStore((store) => store.session.status === 'recording');
export const useTranslations = () => useMeetingStore((store) => store.session.translations);
export const useCurrentUtteranceId = () => useMeetingStore((store) => store.session.currentUtteranceId);
export const usePipelineStatus = () => useMeetingStore((store) => ({status: store.pipelineStatus, error: store.pipelineError}));
