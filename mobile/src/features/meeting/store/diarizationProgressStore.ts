import {create} from 'zustand';

interface DiarizationProgressState {
  /** Session currently being diarized, null when idle. */
  sessionId: string | null;
  chunksProcessed: number;
  totalChunks: number;
  isProcessing: boolean;
  startProgress: (sessionId: string, totalChunks: number) => void;
  advanceChunk: () => void;
  complete: () => void;
  reset: () => void;
}

export const useDiarizationProgressStore = create<DiarizationProgressState>((set) => ({
  sessionId: null,
  chunksProcessed: 0,
  totalChunks: 0,
  isProcessing: false,

  startProgress: (sessionId, totalChunks) =>
    set({sessionId, chunksProcessed: 0, totalChunks, isProcessing: true}),

  advanceChunk: () =>
    set((s) => ({chunksProcessed: s.chunksProcessed + 1})),

  complete: () =>
    set((s) => ({isProcessing: false, chunksProcessed: s.totalChunks})),

  reset: () =>
    set({sessionId: null, chunksProcessed: 0, totalChunks: 0, isProcessing: false}),
}));
