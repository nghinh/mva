import {NativeModules} from 'react-native';

type OfflineSpeakerDiarizationModule = {
  initialize: (
    segmentationModelPath: string,
    embeddingModelPath: string,
    segmentationThreads: number,
    embeddingThreads: number,
    threshold: number,
  ) => Promise<{success: boolean; sampleRate: number}>;
  process: (samples: number[]) => Promise<{
    numSpeakers: number;
    segments: Array<{startSec: number; endSec: number; speaker: number}>;
  }>;
  updateThreshold: (threshold: number) => Promise<boolean>;
  unload: () => void;
};

export const offlineSpeakerDiarizationNative =
  NativeModules.OfflineSpeakerDiarizationModule as OfflineSpeakerDiarizationModule | undefined;

export function isOfflineSpeakerDiarizationAvailable(): boolean {
  return offlineSpeakerDiarizationNative != null;
}
