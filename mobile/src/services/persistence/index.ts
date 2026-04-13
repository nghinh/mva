/**
 * Persistence Service
 *
 * Local session and utterance storage using an in-memory store backed by
 * AsyncStorage when the native module is available.
 */

import {localStorage as AsyncStorage} from '../../shared/utils/localStorage';
import {SessionId, UtteranceId} from '../../shared/types';
import {debugLog, warnLog} from '../../shared/utils/logger';

export interface SessionData {
  id: SessionId;
  startedAt: number;
  endedAt: number | null;
  sourceLanguage: string;
  targetLanguage: string;
  status: 'live' | 'complete' | 'interrupted';
}

export interface UtteranceData {
  id: UtteranceId;
  sessionId: SessionId;
  timestamp: number;
  isFinal: boolean;
  sourceText: string;
  sourceLanguage: string;
  translatedText: string | null;
  suggestionText: string | null;
  translationLatencyMs?: number | null;
  revision?: number;
}

export interface SessionConfigSnapshot {
  sessionId: SessionId;
  sourceLanguage: string;
  targetLanguage: string;
  timestampMs: number;
}

type PersistenceListener = () => void;

const SESSIONS_KEY = '@vibevoice:sessions';
const UTTERANCES_KEY_PREFIX = '@vibevoice:utterances:';
const SESSION_CONFIG_KEY_PREFIX = '@vibevoice:session-config:';
let hasWarnedStorageFallback = false;

function logStorageFallbackOnce(reason: unknown) {
  if (!hasWarnedStorageFallback) {
    hasWarnedStorageFallback = true;
    warnLog('[Persistence] AsyncStorage unavailable, using in-memory fallback only.', reason);
  }
}

async function safeGetItem(key: string): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(key);
  } catch (err) {
    logStorageFallbackOnce(err);
    return null;
  }
}

async function safeSetItem(key: string, value: string): Promise<void> {
  try {
    await AsyncStorage.setItem(key, value);
  } catch (err) {
    logStorageFallbackOnce(err);
  }
}

async function safeRemoveItem(key: string): Promise<void> {
  try {
    await AsyncStorage.removeItem(key);
  } catch (err) {
    logStorageFallbackOnce(err);
  }
}

export function createPersistenceService() {
  let sessionsCache: SessionData[] = [];
  let utterancesCache: Map<SessionId, UtteranceData[]> = new Map();
  let sessionConfigCache: Map<SessionId, SessionConfigSnapshot> = new Map();
  let initialized = false;
  const listeners = new Set<PersistenceListener>();
  let batchDepth = 0;
  let pendingNotify = false;

  const notifyListeners = () => {
    listeners.forEach((listener) => listener());
  };

  const requestNotify = () => {
    if (batchDepth > 0) {
      pendingNotify = true;
      return;
    }
    notifyListeners();
  };

  const cloneSession = (session: SessionData): SessionData => ({...session});
  const cloneUtterance = (utterance: UtteranceData): UtteranceData => ({...utterance});
  const cloneSnapshot = (snapshot: SessionConfigSnapshot): SessionConfigSnapshot => ({...snapshot});

  const service = {
    ensureInitialized: async () => {
      if (!initialized) {
        await service.initialize();
      }
    },

    initialize: async () => {
      if (initialized) return;
      debugLog('[Persistence] Initializing...');
      const stored = await safeGetItem(SESSIONS_KEY);
      if (stored) {
        try {
          sessionsCache = JSON.parse(stored);
        } catch (err) {
          warnLog('[Persistence] Failed to parse sessions cache, resetting.', err);
          sessionsCache = [];
        }
      }
      initialized = true;
      debugLog('[Persistence] Initialized with', sessionsCache.length, 'sessions');
    },

    subscribe: (listener: PersistenceListener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },

    runInBatch: async <T>(work: () => Promise<T>): Promise<T> => {
      batchDepth += 1;
      try {
        return await work();
      } finally {
        batchDepth -= 1;
        if (batchDepth === 0 && pendingNotify) {
          pendingNotify = false;
          notifyListeners();
        }
      }
    },

    persistSessions: async () => {
      await service.ensureInitialized();
      await safeSetItem(SESSIONS_KEY, JSON.stringify(sessionsCache));
    },

    persistUtterances: async (sessionId: SessionId) => {
      await service.ensureInitialized();
      const utterances = utterancesCache.get(sessionId) ?? [];
      await safeSetItem(UTTERANCES_KEY_PREFIX + sessionId, JSON.stringify(utterances));
    },

    loadUtterances: async (sessionId: SessionId): Promise<UtteranceData[]> => {
      await service.ensureInitialized();
      const stored = await safeGetItem(UTTERANCES_KEY_PREFIX + sessionId);
      if (!stored) return [];
      try {
        return JSON.parse(stored);
      } catch (err) {
        warnLog('[Persistence] Failed to parse utterances cache, resetting.', err);
        return [];
      }
    },

    saveSession: async (session: SessionData): Promise<void> => {
      await service.ensureInitialized();
      const exists = sessionsCache.findIndex((s) => s.id === session.id);
      const nextSession = cloneSession(session);
      if (exists >= 0) {
        sessionsCache[exists] = nextSession;
      } else {
        sessionsCache.push(nextSession);
      }
      await service.persistSessions();
      requestNotify();
      debugLog('[Persistence] Saved session:', session.id, session.status);
    },

    updateSession: async (id: SessionId, updates: Partial<SessionData>): Promise<void> => {
      await service.ensureInitialized();
      const idx = sessionsCache.findIndex((s) => s.id === id);
      if (idx >= 0) {
        sessionsCache[idx] = {...sessionsCache[idx], ...updates};
        await service.persistSessions();
        requestNotify();
        debugLog('[Persistence] Updated session:', id, updates);
      }
    },

    getSessions: async (): Promise<SessionData[]> => {
      await service.ensureInitialized();
      return [...sessionsCache].map(cloneSession).sort((a, b) => b.startedAt - a.startedAt);
    },

    getSession: async (id: SessionId): Promise<SessionData | null> => {
      await service.ensureInitialized();
      const session = sessionsCache.find((s) => s.id === id);
      return session ? cloneSession(session) : null;
    },

    saveSessionConfig: async (snapshot: SessionConfigSnapshot): Promise<void> => {
      await service.ensureInitialized();
      const nextSnapshot = cloneSnapshot(snapshot);
      sessionConfigCache.set(snapshot.sessionId, nextSnapshot);
      await safeSetItem(
        SESSION_CONFIG_KEY_PREFIX + snapshot.sessionId,
        JSON.stringify(nextSnapshot),
      );
    },

    getSessionConfig: async (sessionId: SessionId): Promise<SessionConfigSnapshot | null> => {
      await service.ensureInitialized();
      if (sessionConfigCache.has(sessionId)) {
        const snapshot = sessionConfigCache.get(sessionId);
        return snapshot ? cloneSnapshot(snapshot) : null;
      }

      const stored = await safeGetItem(SESSION_CONFIG_KEY_PREFIX + sessionId);
      if (!stored) {
        return null;
      }

      try {
        const snapshot = JSON.parse(stored) as SessionConfigSnapshot;
        sessionConfigCache.set(sessionId, snapshot);
        return cloneSnapshot(snapshot);
      } catch (err) {
        warnLog('[Persistence] Failed to parse session config snapshot, resetting.', err);
        await safeRemoveItem(SESSION_CONFIG_KEY_PREFIX + sessionId);
        return null;
      }
    },

    deleteSessionConfig: async (sessionId: SessionId): Promise<void> => {
      await service.ensureInitialized();
      sessionConfigCache.delete(sessionId);
      await safeRemoveItem(SESSION_CONFIG_KEY_PREFIX + sessionId);
    },

    saveUtterance: async (utterance: UtteranceData): Promise<void> => {
      await service.ensureInitialized();
      const existing = utterancesCache.get(utterance.sessionId) ?? [];
      const existIdx = existing.findIndex((u) => u.id === utterance.id);
      const nextUtterance = cloneUtterance(utterance);
      if (existIdx >= 0) {
        existing[existIdx] = nextUtterance;
      } else {
        existing.push(nextUtterance);
      }
      utterancesCache.set(utterance.sessionId, existing);
      await service.persistUtterances(utterance.sessionId);
      requestNotify();
      debugLog('[Persistence] Saved utterance:', utterance.id);
    },

    getUtterances: async (sessionId: SessionId): Promise<UtteranceData[]> => {
      await service.ensureInitialized();
      if (utterancesCache.has(sessionId)) {
        return utterancesCache.get(sessionId)!.map(cloneUtterance);
      }
      const loaded = await service.loadUtterances(sessionId);
      if (loaded.length > 0) {
        utterancesCache.set(sessionId, loaded);
      }
      return loaded.map(cloneUtterance);
    },

    deleteSession: async (id: SessionId): Promise<void> => {
      await service.ensureInitialized();
      sessionsCache = sessionsCache.filter((s) => s.id !== id);
      utterancesCache.delete(id);
      await Promise.all([
        service.persistSessions(),
        service.deleteSessionConfig(id),
        safeRemoveItem(UTTERANCES_KEY_PREFIX + id),
      ]);
      requestNotify();
      debugLog('[Persistence] Deleted session:', id);
    },
  };

  return service;
}

let persistenceServiceSingleton: PersistenceService | null = null;

export function getPersistenceService(): PersistenceService {
  if (!persistenceServiceSingleton) {
    persistenceServiceSingleton = createPersistenceService();
  }
  return persistenceServiceSingleton;
}

export type PersistenceService = ReturnType<typeof createPersistenceService>;
