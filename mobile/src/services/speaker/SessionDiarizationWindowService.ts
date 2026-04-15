import type {UtteranceId} from '../../shared/types';

interface WindowUtterance {
  utteranceId: UtteranceId;
  startMs: number;
  endMs: number;
  samples: number[];
}

export interface DiarizationWindow {
  windowStartMs: number;
  sampleRate: number;
  samples: number[];
  utterances: Array<{utteranceId: UtteranceId; startMs: number; endMs: number}>;
}

class SessionDiarizationWindowService {
  private utterances: WindowUtterance[] = [];
  private sessionStartMs = 0;
  private sampleRate = 16000;

  reset(sessionStartMs: number, sampleRate = 16000) {
    this.utterances = [];
    this.sessionStartMs = sessionStartMs;
    this.sampleRate = sampleRate;
  }

  addUtterance(utteranceId: UtteranceId, startMs: number, endMs: number, samples: number[]) {
    this.utterances.push({utteranceId, startMs, endMs, samples});
  }

  buildWindow(): DiarizationWindow | null {
    if (this.utterances.length === 0) return null;
    const active = this.utterances;
    const windowStartMs = 0;
    const interUtteranceGapSamples = Math.floor(this.sampleRate * 0.2); // 200ms synthetic gap
    const totalSamples = active.reduce((sum, utt) => sum + utt.samples.length, 0)
      + Math.max(0, active.length - 1) * interUtteranceGapSamples;
    const mixed = new Array(Math.max(1, totalSamples)).fill(0);
    const mappedUtterances: Array<{utteranceId: UtteranceId; startMs: number; endMs: number}> = [];

    let cursor = 0;
    for (const utt of active) {
      for (let i = 0; i < utt.samples.length; i += 1) {
        mixed[cursor + i] = utt.samples[i];
      }
      const startMs = (cursor / this.sampleRate) * 1000;
      const endMs = ((cursor + utt.samples.length) / this.sampleRate) * 1000;
      mappedUtterances.push({utteranceId: utt.utteranceId, startMs, endMs});
      cursor += utt.samples.length + interUtteranceGapSamples;
    }

    return {
      windowStartMs,
      sampleRate: this.sampleRate,
      samples: mixed,
      utterances: mappedUtterances,
    };
  }

  getUtteranceEntries(): Array<{utteranceId: UtteranceId; startMs: number; endMs: number; samples: number[]}> {
    return this.utterances.map((u) => ({
      utteranceId: u.utteranceId,
      startMs: u.startMs,
      endMs: u.endMs,
      samples: [...u.samples],
    }));
  }
}

let instance: SessionDiarizationWindowService | null = null;
export function getSessionDiarizationWindowService(): SessionDiarizationWindowService {
  if (!instance) instance = new SessionDiarizationWindowService();
  return instance;
}
