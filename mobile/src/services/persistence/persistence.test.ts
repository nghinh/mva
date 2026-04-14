/**
 * Persistence Service Unit Tests
 *
 * Tests session and utterance persistence with in-memory + AsyncStorage.
 *
 * @see Story 2.1 - Persist minimum session record on stop
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  createPersistenceService,
  SessionData,
  SessionConfigSnapshot,
  TranslationData,
  UtteranceData,
} from '../persistence';

describe('Persistence Service', () => {
  let persistence: ReturnType<typeof createPersistenceService>;

  beforeEach(async () => {
    await AsyncStorage.removeItem('@vibevoice:sessions');
    persistence = createPersistenceService();
    await persistence.initialize();
    const existingSessions = await persistence.getSessions();
    await Promise.all(existingSessions.map((session) => persistence.deleteSession(session.id)));
  });

  describe('Session Management', () => {
    it('saves and retrieves a session', async () => {
      const session: SessionData = {
        id: 'session_1',
        startedAt: Date.now(),
        endedAt: null,
        sourceLanguage: 'en',
        targetLanguage: 'vi',
        status: 'live',
      };

      await persistence.saveSession(session);
      const retrieved = await persistence.getSession('session_1');

      expect(retrieved).not.toBeNull();
      expect(retrieved?.id).toBe('session_1');
      expect(retrieved?.status).toBe('live');
    });

    it('updates session status', async () => {
      const session: SessionData = {
        id: 'session_2',
        startedAt: Date.now(),
        endedAt: null,
        sourceLanguage: 'en',
        targetLanguage: 'vi',
        status: 'live',
      };

      await persistence.saveSession(session);
      await persistence.updateSession('session_2', {
        status: 'complete',
        endedAt: Date.now(),
      });

      const updated = await persistence.getSession('session_2');
      expect(updated?.status).toBe('complete');
      expect(updated?.endedAt).toBeTruthy();
    });

    it('gets all sessions sorted by start time', async () => {
      const session1: SessionData = {
        id: 'session_a',
        startedAt: 1000,
        endedAt: null,
        sourceLanguage: 'en',
        targetLanguage: 'vi',
        status: 'live',
      };
      const session2: SessionData = {
        id: 'session_b',
        startedAt: 2000,
        endedAt: null,
        sourceLanguage: 'ja',
        targetLanguage: 'vi',
        status: 'live',
      };

      await persistence.saveSession(session1);
      await persistence.saveSession(session2);

      const sessions = await persistence.getSessions();
      expect(sessions).toHaveLength(2);
      expect(sessions[0].id).toBe('session_b');
      expect(sessions[1].id).toBe('session_a');
    });

    it('deletes session and its utterances', async () => {
      const session: SessionData = {
        id: 'session_del',
        startedAt: Date.now(),
        endedAt: null,
        sourceLanguage: 'en',
        targetLanguage: 'vi',
        status: 'live',
      };
      const utterance: UtteranceData = {
        id: 'utterance_del',
        sessionId: 'session_del',
        timestamp: Date.now(),
        isFinal: true,
        sourceText: 'Hello',
        sourceLanguage: 'en',
        translatedText: null,
      };

      await persistence.saveSession(session);
      await persistence.saveUtterance(utterance);

      await persistence.deleteSession('session_del');

      const deleted = await persistence.getSession('session_del');
      expect(deleted).toBeNull();
      const utterances = await persistence.getUtterances('session_del');
      expect(utterances).toHaveLength(0);
    });

    it('deletes all sessions and clears all data', async () => {
      const session1: SessionData = {
        id: 'session_all_1',
        startedAt: Date.now(),
        endedAt: null,
        sourceLanguage: 'en',
        targetLanguage: 'vi',
        status: 'live',
      };
      const session2: SessionData = {
        id: 'session_all_2',
        startedAt: Date.now(),
        endedAt: null,
        sourceLanguage: 'ja',
        targetLanguage: 'vi',
        status: 'live',
      };
      const utterance1: UtteranceData = {
        id: 'utterance_all_1',
        sessionId: 'session_all_1',
        timestamp: Date.now(),
        isFinal: true,
        sourceText: 'Hello',
        sourceLanguage: 'en',
        translatedText: null,
      };
      const utterance2: UtteranceData = {
        id: 'utterance_all_2',
        sessionId: 'session_all_2',
        timestamp: Date.now(),
        isFinal: true,
        sourceText: 'Konnichiwa',
        sourceLanguage: 'ja',
        translatedText: null,
      };

      await persistence.saveSession(session1);
      await persistence.saveSession(session2);
      await persistence.saveUtterance(utterance1);
      await persistence.saveUtterance(utterance2);
      await persistence.saveSessionConfig({
        sessionId: 'session_all_1',
        sourceLanguage: 'en',
        targetLanguage: 'vi',
        timestampMs: Date.now(),
      });
      await persistence.saveSessionConfig({
        sessionId: 'session_all_2',
        sourceLanguage: 'ja',
        targetLanguage: 'vi',
        timestampMs: Date.now(),
      });

      await persistence.deleteAllSessions();

      const sessions = await persistence.getSessions();
      expect(sessions).toHaveLength(0);
      const utterances1 = await persistence.getUtterances('session_all_1');
      expect(utterances1).toHaveLength(0);
      const utterances2 = await persistence.getUtterances('session_all_2');
      expect(utterances2).toHaveLength(0);
      const config1 = await persistence.getSessionConfig('session_all_1');
      expect(config1).toBeNull();
      const config2 = await persistence.getSessionConfig('session_all_2');
      expect(config2).toBeNull();
    });

    it('persists and retrieves a frozen session config snapshot', async () => {
      const snapshot: SessionConfigSnapshot = {
        sessionId: 'session_cfg',
        sourceLanguage: 'en',
        targetLanguage: 'vi',
        timestampMs: 1234,
      };

      await persistence.saveSessionConfig(snapshot);

      const restored = await persistence.getSessionConfig('session_cfg');

      expect(restored).toEqual(snapshot);
    });

    it('returns defensive copies from getters', async () => {
      const session: SessionData = {
        id: 'session_copy',
        startedAt: Date.now(),
        endedAt: null,
        sourceLanguage: 'en',
        targetLanguage: 'vi',
        status: 'live',
      };
      const utterance: UtteranceData = {
        id: 'utt_copy',
        sessionId: 'session_copy',
        timestamp: Date.now(),
        isFinal: true,
        sourceText: 'Hello',
        sourceLanguage: 'en',
        translatedText: 'Xin chào',
        revision: 1,
      };

      await persistence.saveSession(session);
      await persistence.saveUtterance(utterance);

      const loadedSession = await persistence.getSession('session_copy');
      const loadedUtterances = await persistence.getUtterances('session_copy');

      loadedSession!.status = 'complete';
      loadedUtterances[0].sourceText = 'Mutated';

      const reloadedSession = await persistence.getSession('session_copy');
      const reloadedUtterances = await persistence.getUtterances('session_copy');

      expect(reloadedSession!.status).toBe('live');
      expect(reloadedUtterances[0].sourceText).toBe('Hello');
    });

    it('does not retain caller-owned object references when saving', async () => {
      const session: SessionData = {
        id: 'session_ref',
        startedAt: Date.now(),
        endedAt: null,
        sourceLanguage: 'en',
        targetLanguage: 'vi',
        status: 'live',
      };
      const utterance: UtteranceData = {
        id: 'utt_ref',
        sessionId: 'session_ref',
        timestamp: Date.now(),
        isFinal: true,
        sourceText: 'Hello',
        sourceLanguage: 'en',
        translatedText: 'Xin chào',
      };

      await persistence.saveSession(session);
      await persistence.saveUtterance(utterance);

      session.status = 'complete';
      utterance.sourceText = 'Mutated';

      const storedSession = await persistence.getSession('session_ref');
      const storedUtterances = await persistence.getUtterances('session_ref');

      expect(storedSession!.status).toBe('live');
      expect(storedUtterances[0].sourceText).toBe('Hello');
    });

    it('notifies subscribers when persistence changes', async () => {
      const listener = jest.fn();
      const unsubscribe = persistence.subscribe(listener);

      await persistence.saveSession({
        id: 'session_sub',
        startedAt: Date.now(),
        endedAt: null,
        sourceLanguage: 'en',
        targetLanguage: 'vi',
        status: 'live',
      });

      expect(listener).toHaveBeenCalled();
      unsubscribe();
    });

    it('coalesces notifications inside a batch', async () => {
      const listener = jest.fn();
      const unsubscribe = persistence.subscribe(listener);

      await persistence.runInBatch(async () => {
        await persistence.saveSession({
          id: 'session_batch',
          startedAt: Date.now(),
          endedAt: null,
          sourceLanguage: 'en',
          targetLanguage: 'vi',
          status: 'live',
        });
        await persistence.saveUtterance({
          id: 'utt_batch',
          sessionId: 'session_batch',
          timestamp: Date.now(),
          isFinal: true,
          sourceText: 'Hello',
          sourceLanguage: 'en',
          translatedText: 'Xin chào',
        });
      });

      expect(listener).toHaveBeenCalledTimes(1);
      unsubscribe();
    });
  });

  describe('Utterance Management', () => {
    it('saves and retrieves utterances', async () => {
      const utterance: UtteranceData = {
        id: 'utterance_1',
        sessionId: 'session_1',
        timestamp: Date.now(),
        isFinal: true,
        sourceText: 'Hello world',
        sourceLanguage: 'en',
        translatedText: 'Xin chào thế giới',
      };

      await persistence.saveUtterance(utterance);
      const utterances = await persistence.getUtterances('session_1');

      expect(utterances).toHaveLength(1);
      expect(utterances[0].sourceText).toBe('Hello world');
      expect(utterances[0].translatedText).toBe('Xin chào thế giới');
    });

    it('updates existing utterance', async () => {
      const utterance: UtteranceData = {
        id: 'utterance_update',
        sessionId: 'session_1',
        timestamp: Date.now(),
        isFinal: false,
        sourceText: 'Hello',
        sourceLanguage: 'en',
        translatedText: null,
      };

      await persistence.saveUtterance(utterance);

      const updated: UtteranceData = {
        ...utterance,
        isFinal: true,
        translatedText: 'Xin chào',
      };
      await persistence.saveUtterance(updated);

      const utterances = await persistence.getUtterances('session_1');
      expect(utterances).toHaveLength(1);
      expect(utterances[0].isFinal).toBe(true);
      expect(utterances[0].translatedText).toBe('Xin chào');
    });

    it('persists interrupted/offline/completed state correctly', async () => {
      const session: SessionData = {
        id: 'session_int',
        startedAt: Date.now(),
        endedAt: Date.now(),
        sourceLanguage: 'en',
        targetLanguage: 'vi',
        status: 'interrupted',
      };

      await persistence.saveSession(session);
      const retrieved = await persistence.getSession('session_int');

      expect(retrieved?.status).toBe('interrupted');
    });
  });

  describe('Crash Recovery (AC: 2)', () => {
    beforeEach(async () => {
      // Clear AsyncStorage before each crash recovery test
      await AsyncStorage.removeItem('@vibevoice:sessions');
      await AsyncStorage.removeItem('@vibevoice:utterances:session_crash');
      await AsyncStorage.removeItem('@vibevoice:utterances:session_normal');
      await AsyncStorage.removeItem('@vibevoice:translations:session_crash');
      persistence = createPersistenceService();
      await persistence.initialize();
    });

    it('recoverInterruptedSessions marks live sessions with null endedAt as interrupted', async () => {
      // Simulate a session that was recording when app crashed
      const crashedSession: SessionData = {
        id: 'session_crash',
        startedAt: Date.now() - 60000,
        endedAt: null, // App crashed before stopSession was called
        sourceLanguage: 'en',
        targetLanguage: 'vi',
        status: 'live',
      };
      const normalSession: SessionData = {
        id: 'session_normal',
        startedAt: Date.now() - 120000,
        endedAt: Date.now() - 60000,
        sourceLanguage: 'en',
        targetLanguage: 'vi',
        status: 'complete',
      };

      await persistence.saveSession(crashedSession);
      await persistence.saveSession(normalSession);

      // Run crash recovery
      const recoveredCount = await persistence.recoverInterruptedSessions();

      expect(recoveredCount).toBe(1);

      const crashed = await persistence.getSession('session_crash');
      expect(crashed?.status).toBe('interrupted');
      expect(crashed?.endedAt).not.toBeNull();

      const normal = await persistence.getSession('session_normal');
      expect(normal?.status).toBe('complete');
      expect(normal?.endedAt).not.toBeNull();
    });

    it('recoverInterruptedSessions returns 0 when no sessions need recovery', async () => {
      const session: SessionData = {
        id: 'session_ok',
        startedAt: Date.now(),
        endedAt: Date.now(),
        sourceLanguage: 'en',
        targetLanguage: 'vi',
        status: 'complete',
      };
      await persistence.saveSession(session);

      const recoveredCount = await persistence.recoverInterruptedSessions();
      expect(recoveredCount).toBe(0);
    });

    it('recoverInterruptedSessions only runs once per service lifetime via initialize', async () => {
      // When initialize() is called twice, crash recovery should only run once
      const crashedSession: SessionData = {
        id: 'session_once',
        startedAt: Date.now() - 60000,
        endedAt: null,
        sourceLanguage: 'en',
        targetLanguage: 'vi',
        status: 'live',
      };
      await persistence.saveSession(crashedSession);

      // initialize() triggers recoverInterruptedSessions internally
      const freshPersistence = createPersistenceService();
      await freshPersistence.initialize();
      // A second initialize() should not trigger recovery again (crashRecoveryRan flag)
      await freshPersistence.initialize();

      const session = await freshPersistence.getSession('session_once');
      // Should be marked interrupted by first init, second init should not re-run
      expect(session?.status).toBe('interrupted');
    });
  });

  describe('saveFinalUtteranceWithTranslation (AC: 1)', () => {
    beforeEach(async () => {
      await AsyncStorage.removeItem('@vibevoice:sessions');
      await AsyncStorage.removeItem('@vibevoice:utterances:session_atom');
      await AsyncStorage.removeItem('@vibevoice:translations:session_atom');
      persistence = createPersistenceService();
      await persistence.initialize();
      const existing = await persistence.getSessions();
      await Promise.all(existing.map((s) => persistence.deleteSession(s.id)));
    });

    it('saves both utterance and translation atomically', async () => {
      const session: SessionData = {
        id: 'session_atom',
        startedAt: Date.now(),
        endedAt: null,
        sourceLanguage: 'en',
        targetLanguage: 'vi',
        status: 'live',
      };
      await persistence.saveSession(session);

      const utterance: UtteranceData = {
        id: 'utterance_atom',
        sessionId: 'session_atom',
        timestamp: Date.now(),
        isFinal: true,
        sourceText: 'Hello world',
        sourceLanguage: 'en',
        translatedText: 'Xin chào thế giới',
        translationLatencyMs: 150,
        revision: 1,
      };
      const translation: TranslationData = {
        id: 'trans_atom',
        utteranceId: 'utterance_atom',
        text: 'Xin chào thế giới',
        latencyMs: 150,
        createdAt: Date.now(),
      };

      await persistence.saveFinalUtteranceWithTranslation(utterance, translation);

      // Verify utterance was saved
      const utterances = await persistence.getUtterances('session_atom');
      expect(utterances).toHaveLength(1);
      expect(utterances[0].sourceText).toBe('Hello world');
      expect(utterances[0].translatedText).toBe('Xin chào thế giới');
      expect(utterances[0].translationLatencyMs).toBe(150);
    });

    it('saves utterance without translation when translation is null', async () => {
      const session: SessionData = {
        id: 'session_atom',
        startedAt: Date.now(),
        endedAt: null,
        sourceLanguage: 'en',
        targetLanguage: 'vi',
        status: 'live',
      };
      await persistence.saveSession(session);

      const utterance: UtteranceData = {
        id: 'utterance_atom_no_trans',
        sessionId: 'session_atom',
        timestamp: Date.now(),
        isFinal: true,
        sourceText: 'Hello',
        sourceLanguage: 'en',
        translatedText: null,
        translationLatencyMs: null,
        revision: 1,
      };

      await persistence.saveFinalUtteranceWithTranslation(utterance, null);

      const utterances = await persistence.getUtterances('session_atom');
      expect(utterances).toHaveLength(1);
      expect(utterances[0].sourceText).toBe('Hello');
      expect(utterances[0].translatedText).toBeNull();
    });

    it('overwrites existing utterance when saving final version', async () => {
      const session: SessionData = {
        id: 'session_atom',
        startedAt: Date.now(),
        endedAt: null,
        sourceLanguage: 'en',
        targetLanguage: 'vi',
        status: 'live',
      };
      await persistence.saveSession(session);

      const partialUtterance: UtteranceData = {
        id: 'utterance_overwrite',
        sessionId: 'session_atom',
        timestamp: Date.now() - 1000,
        isFinal: false,
        sourceText: 'Hello',
        sourceLanguage: 'en',
        translatedText: null,
        revision: 1,
      };
      const finalUtterance: UtteranceData = {
        id: 'utterance_overwrite',
        sessionId: 'session_atom',
        timestamp: Date.now(),
        isFinal: true,
        sourceText: 'Hello world complete',
        sourceLanguage: 'en',
        translatedText: 'Xin chào thế giới',
        translationLatencyMs: 100,
        revision: 2,
      };
      const translation: TranslationData = {
        id: 'trans_overwrite',
        utteranceId: 'utterance_overwrite',
        text: 'Xin chào thế giới',
        latencyMs: 100,
        createdAt: Date.now(),
      };

      // Save partial first
      await persistence.saveUtterance(partialUtterance);

      // Save final
      await persistence.saveFinalUtteranceWithTranslation(finalUtterance, translation);

      const utterances = await persistence.getUtterances('session_atom');
      expect(utterances).toHaveLength(1);
      expect(utterances[0].isFinal).toBe(true);
      expect(utterances[0].sourceText).toBe('Hello world complete');
      expect(utterances[0].revision).toBe(2);
    });
  });
});
