import {STTProcessor} from './STTProcessor';

describe('STTProcessor', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-04-12T10:00:00Z'));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('emits increasing non-zero offsets after session start', () => {
    const processor = new STTProcessor();
    processor.setSession('session_1');

    const partialListener = jest.fn();
    processor.subscribeToPartial(partialListener);

    jest.advanceTimersByTime(250);
    processor.startUtterance('utt_1', Date.now());

    jest.advanceTimersByTime(300);

    const event = partialListener.mock.calls[0][0];
    expect(event.offset_ms).toBeGreaterThan(0);
  });
});
