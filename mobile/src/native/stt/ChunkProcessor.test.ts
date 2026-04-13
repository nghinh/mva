import {ChunkProcessor} from './ChunkProcessor';

describe('ChunkProcessor', () => {
  it('marks buffers as expired after max buffer duration', () => {
    const processor = new ChunkProcessor();
    processor.setSession('session_1');

    const chunk = {
      sessionId: 'session_1',
      timestampMs: 1000,
      data: new Float32Array([0, 1, 2]),
      sampleRate: 16000,
      sequence: 1,
      durationMs: 100,
    };

    processor.addChunk(chunk, 'utt_1');
    const buffer = processor.getBuffer('utt_1');

    expect(buffer).toBeDefined();
    expect(processor.isBufferExpired(buffer!, 7001)).toBe(true);
  });
});
