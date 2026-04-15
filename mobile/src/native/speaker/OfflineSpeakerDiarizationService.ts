import {ensureBundledModelInstalled} from '../models/BundledModelInstaller';
import {getDiarizationThreshold} from '../../shared/config/runtimeConfig';
import {
  isOfflineSpeakerDiarizationAvailable,
  offlineSpeakerDiarizationNative,
} from './OfflineSpeakerDiarizationBridge';

export interface DiarizationSegment {
  startSec: number;
  endSec: number;
  speaker: number;
}

class OfflineSpeakerDiarizationService {
  private ready = false;
  private threshold = 0.55;
  private inFlight = false;
  private lastProcessedAt = 0;
  private readonly minProcessIntervalMs = 8000;
  private readonly maxProcessSamples = 16000 * 6;

  async initialize(): Promise<boolean> {
    if (!isOfflineSpeakerDiarizationAvailable() || !offlineSpeakerDiarizationNative) {
      this.ready = false;
      console.warn('[OfflineSpeakerDiarizationService] Native module unavailable');
      return false;
    }
    const modelDir = await ensureBundledModelInstalled('diarization');
    this.threshold = getDiarizationThreshold() || 0.55;
    const result = await offlineSpeakerDiarizationNative.initialize(
      `${modelDir}/model.onnx`,
      `${modelDir}/3dspeaker_speech_campplus_sv_en_voxceleb_16k.onnx`,
      2,
      2,
      this.threshold,
    );
    this.ready = !!result?.success;
    if (!this.ready) {
      console.warn('[OfflineSpeakerDiarizationService] Native diarizer failed to initialize');
    }
    return this.ready;
  }

  async process(samples: number[]): Promise<{numSpeakers: number; segments: DiarizationSegment[]}> {
    if (!this.ready || !offlineSpeakerDiarizationNative) {
      return {numSpeakers: 0, segments: []};
    }
    if (samples.length > this.maxProcessSamples) {
      return {numSpeakers: 0, segments: []};
    }
    const now = Date.now();
    if (this.inFlight || now - this.lastProcessedAt < this.minProcessIntervalMs) {
      return {numSpeakers: 0, segments: []};
    }
    const nextThreshold = getDiarizationThreshold() || 0.55;
    if (Math.abs(nextThreshold - this.threshold) > 0.0001) {
      const ok = await offlineSpeakerDiarizationNative.updateThreshold(nextThreshold);
      if (ok) {
        this.threshold = nextThreshold;
      } else {
        console.warn('[OfflineSpeakerDiarizationService] Failed to update native threshold');
      }
    }
    this.inFlight = true;
    this.lastProcessedAt = now;
    try {
      return await offlineSpeakerDiarizationNative.process(samples);
    } finally {
      this.inFlight = false;
    }
  }

  async processPostSession(samples: number[]): Promise<{numSpeakers: number; segments: DiarizationSegment[]}> {
    if (!this.ready || !offlineSpeakerDiarizationNative) {
      return {numSpeakers: 0, segments: []};
    }
    const nextThreshold = getDiarizationThreshold() || 0.55;
    if (Math.abs(nextThreshold - this.threshold) > 0.0001) {
      const ok = await offlineSpeakerDiarizationNative.updateThreshold(nextThreshold);
      if (ok) {
        this.threshold = nextThreshold;
      } else {
        console.warn('[OfflineSpeakerDiarizationService] Failed to update native threshold');
      }
    }

    // Post-session path is allowed to process longer audio because it runs after
    // the meeting stops, not inside the live transcription loop.
    return offlineSpeakerDiarizationNative.process(samples);
  }

  async unload(): Promise<void> {
    this.ready = false;
    this.inFlight = false;
    this.lastProcessedAt = 0;
    offlineSpeakerDiarizationNative?.unload();
  }

  isReady(): boolean {
    return this.ready;
  }
}

let instance: OfflineSpeakerDiarizationService | null = null;
export function getOfflineSpeakerDiarizationService(): OfflineSpeakerDiarizationService {
  if (!instance) instance = new OfflineSpeakerDiarizationService();
  return instance;
}
