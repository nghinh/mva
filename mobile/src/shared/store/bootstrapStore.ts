/**
 * Bootstrap Store
 *
 * Offline-only bootstrap state for model and prewarm readiness.
 */

import {localStorage as AsyncStorage} from '../utils/localStorage';
import {create} from 'zustand';
import {createJSONStorage, persist} from 'zustand/middleware';
import {
  BootstrapState,
  ModelState,
  PrewarmState,
  ModelStatus,
  BootstrapOverallStatus,
  ModelInfo,
  ModelDownloadProgress,
} from '../types/bootstrap';

const initialModelState: ModelState = {
  status: 'missing',
  currentModel: null,
  downloadProgress: null,
  error: null,
};

const initialPrewarmState: PrewarmState = {
  status: 'pending',
  startedAt: null,
  completedAt: null,
  error: null,
};

const initialBootstrapState: BootstrapState = {
  model: initialModelState,
  translatorModel: initialModelState,
  prewarm: initialPrewarmState,
  overallStatus: 'initializing',
  initializedAt: null,
};

function calculateOverallStatus(state: BootstrapState): BootstrapOverallStatus {
  const {model, translatorModel, prewarm} = state;

  if (model.status === 'invalid' || translatorModel.status === 'invalid' || prewarm.status === 'failed') {
    return 'error';
  }

  if (model.status === 'cached-ready' && translatorModel.status === 'cached-ready' && prewarm.status === 'ready') {
    return 'ready';
  }

  return 'initializing';
}

interface BootstrapStore {
  state: BootstrapState;
  setModelStatus: (status: ModelStatus) => void;
  setModelDownloading: (model: ModelInfo) => void;
  setModelDownloadProgress: (progress: ModelDownloadProgress) => void;
  setModelReady: (model: ModelInfo) => void;
  setModelError: (error: string) => void;
  setModelDeleting: () => void;
  setModelDeleted: () => void;
  setTranslatorModelDownloading: (model: ModelInfo) => void;
  setTranslatorModelDownloadProgress: (progress: ModelDownloadProgress) => void;
  setTranslatorModelReady: (model: ModelInfo) => void;
  setTranslatorModelError: (error: string) => void;
  setTranslatorModelDeleting: () => void;
  setTranslatorModelDeleted: () => void;
  startPrewarm: () => void;
  completePrewarm: () => void;
  setPrewarmError: (error: string) => void;
  reset: () => void;
  initialize: () => void;
}

export const useBootstrapStore = create<BootstrapStore>()(
  persist(
    (set) => ({
      state: initialBootstrapState,

      setModelStatus: (status) => {
        set((store) => {
          const newState: BootstrapState = {
            ...store.state,
            model: {
              ...store.state.model,
              status,
              error: status === 'missing' ? null : store.state.model.error,
            },
          };
          return {state: {...newState, overallStatus: calculateOverallStatus(newState)}};
        });
      },

      setModelDownloading: (model) => {
        set((store) => {
          const newState: BootstrapState = {
            ...store.state,
            model: {
              ...store.state.model,
              status: 'downloading',
              currentModel: model,
              downloadProgress: {
                bytesDownloaded: 0,
                totalBytes: model.diskFootprintMB * 1024 * 1024,
                percentage: 0,
              },
              error: null,
            },
          };
          return {state: {...newState, overallStatus: calculateOverallStatus(newState)}};
        });
      },

      setModelDownloadProgress: (progress) => {
        set((store) => {
          if (store.state.model.status !== 'downloading') {
            return store;
          }
          return {
            state: {
              ...store.state,
              model: {...store.state.model, downloadProgress: progress},
            },
          };
        });
      },

      setModelReady: (model) => {
        set((store) => {
          const newState: BootstrapState = {
            ...store.state,
            model: {
              status: 'cached-ready',
              currentModel: model,
              downloadProgress: null,
              error: null,
            },
          };
          return {state: {...newState, overallStatus: calculateOverallStatus(newState)}};
        });
      },

      setModelError: (error) => {
        set((store) => {
          const newState: BootstrapState = {
            ...store.state,
            model: {
              ...store.state.model,
              status: 'invalid',
              error,
              downloadProgress: null,
            },
          };
          return {state: {...newState, overallStatus: calculateOverallStatus(newState)}};
        });
      },

      setModelDeleting: () => {
        set((store) => {
          const newState: BootstrapState = {
            ...store.state,
            model: {...store.state.model, status: 'deleting'},
          };
          return {state: {...newState, overallStatus: calculateOverallStatus(newState)}};
        });
      },

      setModelDeleted: () => {
        set((store) => {
          const newState: BootstrapState = {
            ...store.state,
            model: initialModelState,
            prewarm: initialPrewarmState,
          };
          return {state: {...newState, overallStatus: calculateOverallStatus(newState)}};
        });
      },

      setTranslatorModelDownloading: (model) => {
        set((store) => {
          const newState: BootstrapState = {
            ...store.state,
            translatorModel: {
              ...store.state.translatorModel,
              status: 'downloading',
              currentModel: model,
              downloadProgress: {
                bytesDownloaded: 0,
                totalBytes: model.diskFootprintMB * 1024 * 1024,
                percentage: 0,
              },
              error: null,
            },
          };
          return {state: {...newState, overallStatus: calculateOverallStatus(newState)}};
        });
      },

      setTranslatorModelDownloadProgress: (progress) => {
        set((store) => ({
          state: {
            ...store.state,
            translatorModel: {...store.state.translatorModel, downloadProgress: progress},
          },
        }));
      },

      setTranslatorModelReady: (model) => {
        set((store) => {
          const newState: BootstrapState = {
            ...store.state,
            translatorModel: {
              status: 'cached-ready',
              currentModel: model,
              downloadProgress: null,
              error: null,
            },
          };
          return {state: {...newState, overallStatus: calculateOverallStatus(newState)}};
        });
      },

      setTranslatorModelError: (error) => {
        set((store) => {
          const newState: BootstrapState = {
            ...store.state,
            translatorModel: {
              ...store.state.translatorModel,
              status: 'invalid',
              error,
              downloadProgress: null,
            },
          };
          return {state: {...newState, overallStatus: calculateOverallStatus(newState)}};
        });
      },

      setTranslatorModelDeleting: () => {
        set((store) => ({
          state: {
            ...store.state,
            translatorModel: {...store.state.translatorModel, status: 'deleting'},
          },
        }));
      },

      setTranslatorModelDeleted: () => {
        set((store) => {
          const newState: BootstrapState = {
            ...store.state,
            translatorModel: initialModelState,
            prewarm: initialPrewarmState,
          };
          return {state: {...newState, overallStatus: calculateOverallStatus(newState)}};
        });
      },

      startPrewarm: () => {
        set((store) => {
          if (store.state.model.status !== 'cached-ready') {
            return {
              state: {
                ...store.state,
                prewarm: {
                  ...store.state.prewarm,
                  status: 'failed',
                  error: 'Model must be ready before pre-warm starts.',
                },
                overallStatus: 'error' as BootstrapOverallStatus,
              },
            };
          }
          const newState: BootstrapState = {
            ...store.state,
            prewarm: {
              status: 'warming',
              startedAt: Date.now(),
              completedAt: null,
              error: null,
            },
          };
          return {state: {...newState, overallStatus: calculateOverallStatus(newState)}};
        });
      },

      completePrewarm: () => {
        set((store) => {
          if (store.state.model.status !== 'cached-ready') {
            return {
              state: {
                ...store.state,
                prewarm: {
                  ...store.state.prewarm,
                  status: 'failed',
                  error: 'Pre-warm cannot complete without a cached-ready model.',
                },
                overallStatus: 'error' as BootstrapOverallStatus,
              },
            };
          }
          const newState: BootstrapState = {
            ...store.state,
            prewarm: {
              status: 'ready',
              startedAt: store.state.prewarm.startedAt,
              completedAt: Date.now(),
              error: null,
            },
          };
          return {state: {...newState, overallStatus: calculateOverallStatus(newState)}};
        });
      },

      setPrewarmError: (error) => {
        set((store) => {
          const newState: BootstrapState = {
            ...store.state,
            prewarm: {
              status: 'failed',
              startedAt: store.state.prewarm.startedAt,
              completedAt: null,
              error,
            },
          };
          return {state: {...newState, overallStatus: calculateOverallStatus(newState)}};
        });
      },

      reset: () => {
        set(() => ({
          state: {
            ...initialBootstrapState,
            initializedAt: null,
          },
        }));
      },

      initialize: () => {
        set((store) => ({
          state: {
            ...store.state,
            initializedAt: Date.now(),
          },
        }));
      },
    }),
    {
      name: 'vibevoice-bootstrap-store',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (store) => ({
        state: {
          ...store.state,
          overallStatus: store.state.overallStatus,
          initializedAt: store.state.initializedAt,
        },
      }),
    }
  )
);

export const useModelState = () => useBootstrapStore((store) => store.state.model);
export const useTranslatorModelState = () => useBootstrapStore((store) => store.state.translatorModel);
export const usePrewarmState = () => useBootstrapStore((store) => store.state.prewarm);
export const useBootstrapOverallStatus = () => useBootstrapStore((store) => store.state.overallStatus);
