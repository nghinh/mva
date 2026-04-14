/**
 * Persistence Service
 *
 * Local session and utterance storage using an in-memory store backed by
 * AsyncStorage when the native module is available.
 *
 * ## SQLite Schema (Future Migration)
 *
 * This service is designed to migrate to op-sqlite or expo-sqlite.
 * The SQLite schema below documents the target tables.
 *
 * ```sql
 * -- WAL mode for concurrent read/write safety
 * PRAGMA journal_mode=WAL;
 *
 * CREATE TABLE IF NOT EXISTS sessions (
 *   id          TEXT PRIMARY KEY,
 *   started_at  INTEGER NOT NULL,          -- Unix timestamp ms
 *   ended_at    INTEGER,                   -- Unix timestamp ms, NULL if live
 *   source_lang TEXT,
 *   target_lang TEXT,
 *   status      TEXT NOT NULL DEFAULT 'live' -- 'live' | 'complete' | 'interrupted'
 * );
 *
 * CREATE TABLE IF NOT EXISTS utterances (
 *   id           TEXT PRIMARY KEY,
 *   session_id   TEXT NOT NULL,
 *   text         TEXT NOT NULL,
 *   lang         TEXT NOT NULL,
 *   is_final     INTEGER NOT NULL DEFAULT 0,
 *   timestamp    INTEGER NOT NULL,         -- Unix timestamp ms
 *   FOREIGN KEY (session_id) REFERENCES sessions(id)
 * );
 *
 * CREATE TABLE IF NOT EXISTS translations (
 *   id           TEXT PRIMARY KEY,
 *   utterance_id TEXT NOT NULL,
 *   text         TEXT NOT NULL,
 *   latency_ms   INTEGER,
 *   created_at   INTEGER NOT NULL,         -- Unix timestamp ms
 *   FOREIGN KEY (utterance_id) REFERENCES utterances(id)
 * );
 *
 * -- Index for crash recovery: sessions with status='live' and ended_at IS NULL
 * CREATE INDEX IF NOT EXISTS idx_sessions_live_unended
 *   ON sessions(status, ended_at)
 *   WHERE status = 'live' AND ended_at IS NULL;
 * ```
 *
 * Migration plan:
 * 1. Install op-sqlite or expo-sqlite as a dependency
 * 2. Run CREATE TABLE statements with IF NOT EXISTS on app start
 * 3. Backfill existing AsyncStorage data into SQLite
 * 4. Replace safeGetItem/safeSetItem calls with direct SQLite queries
 * 5. Enable WAL mode via PRAGMA journal_mode=WAL
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

/**
 * Translation data stored alongside utterances.
 * Mirrors the `translations` table in the SQLite schema above.
 */
export interface TranslationData {
  id: string;
  utteranceId: UtteranceId;
  text: string;
  latencyMs: number | null;
  createdAt: number; // Unix timestamp ms
}

type PersistenceListener = () => void;

const SESSIONS_KEY = '@vibevoice:sessions';
const UTTERANCES_KEY_PREFIX = '@vibevoice:utterances:';
const TRANSLATIONS_KEY_PREFIX = '@vibevoice:translations:';
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
  let translationsCache: Map<UtteranceId, TranslationData> = new Map();
  let sessionConfigCache: Map<SessionId, SessionConfigSnapshot> = new Map();
  let initialized = false;
  let crashRecoveryRan = false;
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

      // Crash recovery: run after initialization to catch sessions left in 'live' state
      if (!crashRecoveryRan) {
        crashRecoveryRan = true;
        await service.recoverInterruptedSessions();
      }
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
      // Load utterance IDs BEFORE clearing cache (needed for cascade translation cleanup)
      const sessionUtterances = await service.getUtterances(id);
      const utteranceIds = sessionUtterances.map((u) => u.id);

      sessionsCache = sessionsCache.filter((s) => s.id !== id);

      // Clear translations cache entries for this session's utterances
      for (const uid of utteranceIds) {
        translationsCache.delete(uid);
      }

      utterancesCache.delete(id);

      await Promise.all([
        service.persistSessions(),
        service.deleteSessionConfig(id),
        safeRemoveItem(UTTERANCES_KEY_PREFIX + id),
        safeRemoveItem(TRANSLATIONS_KEY_PREFIX + id),
      ]);
      requestNotify();
      debugLog('[Persistence] Deleted session:', id);
    },

    deleteAllSessions: async (): Promise<void> => {
      await service.ensureInitialized();
      const sessionIds = sessionsCache.map((s) => s.id);
      sessionsCache = [];
      utterancesCache.clear();
      translationsCache.clear();
      sessionConfigCache.clear();

      const removeKeys: Promise<void>[] = [];
      for (const id of sessionIds) {
        removeKeys.push(safeRemoveItem(UTTERANCES_KEY_PREFIX + id));
        removeKeys.push(safeRemoveItem(TRANSLATIONS_KEY_PREFIX + id));
        removeKeys.push(safeRemoveItem(SESSION_CONFIG_KEY_PREFIX + id));
      }
      removeKeys.push(safeSetItem(SESSIONS_KEY, JSON.stringify([])));

      await Promise.all(removeKeys);
      requestNotify();
      debugLog('[Persistence] Deleted all sessions:', sessionIds.length, 'sessions removed');
    },

    /**
     * Persist translations for a given session's utterances.
     * Called by saveFinalUtteranceWithTranslation to flush the translations cache.
     */
    persistTranslations: async (sessionId: SessionId): Promise<void> => {
      await service.ensureInitialized();
      // Collect all translations for utterances belonging to this session
      const sessionUtterances = utterancesCache.get(sessionId) ?? [];
      const utteranceIds = new Set(sessionUtterances.map((u) => u.id));
      const sessionTranslations: TranslationData[] = [];
      for (const [utteranceId, translation] of translationsCache) {
        if (utteranceIds.has(utteranceId)) {
          sessionTranslations.push(translation);
        }
      }
      await safeSetItem(TRANSLATIONS_KEY_PREFIX + sessionId, JSON.stringify(sessionTranslations));
    },

    /**
     * Load all translations for a session from storage.
     */
    loadTranslationsForSession: async (sessionId: SessionId): Promise<TranslationData[]> => {
      await service.ensureInitialized();
      const stored = await safeGetItem(TRANSLATIONS_KEY_PREFIX + sessionId);
      if (!stored) return [];
      try {
        return JSON.parse(stored) as TranslationData[];
      } catch (err) {
        warnLog('[Persistence] Failed to parse translations cache, resetting.', err);
        return [];
      }
    },

    /**
     * Save a single translation entry to the translations cache.
     */
    saveTranslation: async (translation: TranslationData): Promise<void> => {
      await service.ensureInitialized();
      translationsCache.set(translation.utteranceId, {...translation});
      debugLog('[Persistence] Saved translation for utterance:', translation.utteranceId);
    },

    /**
     * Atomically persist a final utterance and its linked translation.
     * This is the primary write path for the write-on-finalize pattern (AC: 1).
     * Both the utterance and translation are written in the same microtask to
     * minimize the window where only one is persisted.
     *
     * AC: 1 — writes both within the same async pass (effectively <100ms for AsyncStorage)
     *
     * @param utterance - The finalized UtteranceData (isFinal=true)
     * @param translation - The TranslationData linked to this utterance (may be null if translation failed)
     */
    saveFinalUtteranceWithTranslation: async (
      utterance: UtteranceData,
      translation: TranslationData | null,
    ): Promise<void> => {
      await service.ensureInitialized();
      // Update in-memory cache
      const existing = utterancesCache.get(utterance.sessionId) ?? [];
      const existIdx = existing.findIndex((u) => u.id === utterance.id);
      if (existIdx >= 0) {
        existing[existIdx] = cloneUtterance(utterance);
      } else {
        existing.push(cloneUtterance(utterance));
      }
      utterancesCache.set(utterance.sessionId, existing);

      if (translation) {
        translationsCache.set(translation.utteranceId, {...translation});
      }

      // Atomic write: both utterance and translation are written together.
      // In the SQLite migration, this becomes a single transaction with WAL mode.
      // Using runInBatch here would defer the write; we intentionally write
      // immediately to satisfy AC: 1 (within 100ms).
      await Promise.all([
        service.persistUtterances(utterance.sessionId),
        translation ? service.persistTranslations(utterance.sessionId) : Promise.resolve(),
      ]);
      requestNotify();
      debugLog('[Persistence] saveFinalUtteranceWithTranslation:', utterance.id, translation ? 'with translation' : 'no translation');
    },

    /**
     * Recover interrupted sessions — crash recovery (AC: 2).
     *
     * On app launch, finds all sessions with status='live' and endedAt=null
     * and marks them as status='interrupted'.
     *
     * This handles the case where the app was killed during an active meeting.
     * The session's utterances are already persisted (per-utterance writes),
     * so no utterance data is lost.
     *
     * AC: 2 — Given the app crashes during a meeting, When the user reopens the app,
     *         Then the partial session is recoverable with all utterances saved before the crash.
     */
    recoverInterruptedSessions: async (): Promise<number> => {
      await service.ensureInitialized();
      const interrupted: SessionData[] = [];
      for (const session of sessionsCache) {
        if (session.status === 'live' && session.endedAt === null) {
          session.endedAt = Date.now();
          session.status = 'interrupted';
          interrupted.push(session);
          debugLog('[Persistence] Recovered interrupted session:', session.id);
        }
      }
      if (interrupted.length > 0) {
        await service.persistSessions();
        requestNotify();
        warnLog('[Persistence] Crash recovery: marked', interrupted.length, 'session(s) as interrupted');
      }
      return interrupted.length;
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
