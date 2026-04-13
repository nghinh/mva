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
        suggestionText: null,
      };

      await persistence.saveSession(session);
      await persistence.saveUtterance(utterance);

      await persistence.deleteSession('session_del');

      const deleted = await persistence.getSession('session_del');
      expect(deleted).toBeNull();
      const utterances = await persistence.getUtterances('session_del');
      expect(utterances).toHaveLength(0);
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
        suggestionText: null,
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
        suggestionText: null,
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
          suggestionText: null,
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
        suggestionText: null,
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
        suggestionText: null,
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
});
