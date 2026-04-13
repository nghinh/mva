import {useMeetingStore} from './meetingStore';

describe('MeetingStore', () => {
  beforeEach(() => {
    useMeetingStore.getState().resetSession();
  });

  describe('Session Lifecycle', () => {
    it('starts session with correct state', () => {
      const store = useMeetingStore.getState();
      store.setPipelineStatus('error', 'old error');
      store.startSession('en', 'vi');

      const session = useMeetingStore.getState().session;
      expect(session.status).toBe('recording');
      expect(session.id).toBeTruthy();
      expect(session.startedAt).toBeTruthy();
      expect(session.sourceLanguage).toBe('en');
      expect(session.targetLanguage).toBe('vi');
      expect(session.transcript).toHaveLength(0);
      expect(session.partialTranscript).toBe('');
      expect(useMeetingStore.getState().pipelineStatus).toBe('idle');
      expect(useMeetingStore.getState().pipelineError).toBeNull();
    });

    it('stops session and transitions to complete', async () => {
      const store = useMeetingStore.getState();
      store.startSession('en', 'vi');
      store.stopSession();

      expect(useMeetingStore.getState().session.status).toBe('stopping');
      await new Promise((resolve) => setTimeout(resolve, 150));
      expect(useMeetingStore.getState().session.status).toBe('complete');
      expect(useMeetingStore.getState().session.endedAt).toBeTruthy();
    });

    it('interrupts session correctly', () => {
      const store = useMeetingStore.getState();
      store.startSession('en', 'vi');
      store.interruptSession();

      const session = useMeetingStore.getState().session;
      expect(session.status).toBe('interrupted');
      expect(session.endedAt).toBeTruthy();
      expect(session.connectivity).toBe('online');
    });
  });

  describe('Transcript + Translation', () => {
    it('updates partial transcript from pipeline event', () => {
      const store = useMeetingStore.getState();
      const sessionId = store.startSession('en', 'vi');
      store.handlePipelineEvent({
        type: 'stt_partial',
        session_id: sessionId,
        utterance_id: 'utt_1' as any,
        text: 'Hello world',
        timestamp_ms: Date.now(),
        language: 'en',
        offset_ms: 0,
        revision: 1,
      });

      expect(useMeetingStore.getState().session.partialTranscript).toBe('Hello world');
      expect(useMeetingStore.getState().session.transcript[0].isFinal).toBe(false);
    });

    it('finalizes transcript from pipeline event', () => {
      const store = useMeetingStore.getState();
      const sessionId = store.startSession('en', 'vi');
      store.handlePipelineEvent({
        type: 'stt_final',
        session_id: sessionId,
        utterance_id: 'utt_1' as any,
        text: 'Hello world',
        language: 'en',
        confidence: 0.9,
        timestamp_ms: 1234,
        offset_ms: 0,
        start_ms: 0,
        end_ms: 1234,
        revision: 1,
      });

      expect(useMeetingStore.getState().session.transcript[0].isFinal).toBe(true);
      expect(useMeetingStore.getState().session.currentUtteranceId).toBeNull();
    });

    it('stores final on-device translation on linked utterance', () => {
      const store = useMeetingStore.getState();
      store.startSession('en', 'vi');
      store.addTranscriptEntry({
        id: 'utt_ts',
        timestamp: 1234,
        isFinal: true,
        sourceText: 'Original transcript',
        partialText: '',
        sourceLanguage: 'en',
        translatedText: null,
        revision: 1,
      });

      store.handleTranslationMessage('utt_ts', 'Bản dịch cuối', true, 2, 'Original transcript', 10000);

      expect(useMeetingStore.getState().session.translations[0].translatedText).toBe('Bản dịch cuối');
      expect(useMeetingStore.getState().session.translations[0].source).toBe('device');
      expect(useMeetingStore.getState().session.translations[0].timestamp).toBe(1234);
      expect(useMeetingStore.getState().session.transcript[0].translatedText).toBe('Bản dịch cuối');
    });

    it('cancels translations when utterance is cancelled', () => {
      const store = useMeetingStore.getState();
      const sessionId = store.startSession('en', 'vi');
      store.addTranscriptEntry({
        id: 'utt_cancel',
        timestamp: Date.now(),
        isFinal: true,
        sourceText: 'temporary',
        partialText: '',
        sourceLanguage: 'en',
        translatedText: null,
        revision: 1,
      });
      store.handleTranslationMessage('utt_cancel', 'tam dich', false, 1, 'temporary');

      store.handlePipelineEvent({
        type: 'utterance_cancel',
        session_id: sessionId,
        utterance_id: 'utt_cancel' as any,
        timestamp_ms: Date.now(),
        revision: 2,
        reason: 'cancelled',
      });

      expect(useMeetingStore.getState().session.translations).toHaveLength(0);
      expect(useMeetingStore.getState().session.transcript).toHaveLength(0);
    });

    it('ignores late translation results after utterance cancellation', () => {
      const store = useMeetingStore.getState();
      const sessionId = store.startSession('en', 'vi');
      store.addTranscriptEntry({
        id: 'utt_late',
        timestamp: Date.now(),
        isFinal: true,
        sourceText: 'temporary',
        partialText: '',
        sourceLanguage: 'en',
        translatedText: null,
        revision: 1,
      });

      store.handlePipelineEvent({
        type: 'utterance_cancel',
        session_id: sessionId,
        utterance_id: 'utt_late' as any,
        timestamp_ms: Date.now(),
        revision: 2,
        reason: 'cancelled',
      });

      store.handleTranslationMessage('utt_late', 'late translation', true, 2, 'temporary');

      expect(useMeetingStore.getState().session.translations).toHaveLength(0);
      expect(useMeetingStore.getState().session.transcript).toHaveLength(0);
    });
  });
});
