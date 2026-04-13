/**
 * Bootstrap and Model Lifecycle Types
 *
 * These types define the state shape for:
 * - Model availability and download lifecycle
 * - Pre-warm state for STT cold-start mitigation
 * - Offline model readiness only
 */

// ============================================================================
// Model State
// ============================================================================

export type ModelStatus =
  | 'missing'       // Model not yet downloaded
  | 'downloading'   // Currently downloading
  | 'cached-ready'   // Model is ready to use
  | 'invalid'        // Model corrupted or invalid
  | 'deleting';     // Model is being removed

export type ModelQuality = 'int8' | 'int4' | 'float16';

export interface ModelInfo {
  id: string;
  name: string;
  version: string;
  quality: ModelQuality;
  diskFootprintMB: number;
  languages: string[];
  inferenceSpeedRTF: number; // Real-time factor
  isOptimizedFor: string[];
}

export interface ModelDownloadProgress {
  bytesDownloaded: number;
  totalBytes: number;
  percentage: number;
}

export interface ModelState {
  status: ModelStatus;
  currentModel: ModelInfo | null;
  downloadProgress: ModelDownloadProgress | null;
  error: string | null;
}

// ============================================================================
// Pre-Warm State
// ============================================================================

export type PrewarmStatus =
  | 'pending'   // Pre-warm not yet started
  | 'warming'   // Pre-warm in progress
  | 'ready'     // Pre-warm complete, ready for first utterance
  | 'failed';   // Pre-warm failed

export interface PrewarmState {
  status: PrewarmStatus;
  startedAt: number | null;
  completedAt: number | null;
  error: string | null;
}

// ============================================================================
// Combined Bootstrap State
// ============================================================================

export type BootstrapOverallStatus =
  | 'initializing'
  | 'ready'
  | 'error';

export interface BootstrapState {
  model: ModelState;
  translatorModel: ModelState;
  prewarm: PrewarmState;
  overallStatus: BootstrapOverallStatus;
  initializedAt: number | null;
}

// ============================================================================
// Readiness Domain
// ============================================================================

export type ReadinessDomain = 'model' | 'prewarm';

export interface ReadinessDomainState {
  isReady: boolean;
  label: string;
  description: string;
  status: ModelStatus | PrewarmStatus;
}

export interface ReadinessSummary {
  domains: {
    model: ReadinessDomainState;
    translatorModel: ReadinessDomainState;
    prewarm: ReadinessDomainState;
  };
  overallReady: boolean;
  actionableMessage: string | null;
}

// ============================================================================
// Bootstrap Actions
// ============================================================================

export type BootstrapAction =
  | { type: 'MODEL_STATUS_UPDATE'; payload: Partial<ModelState> }
  | { type: 'MODEL_DOWNLOAD_START' }
  | { type: 'MODEL_DOWNLOAD_PROGRESS'; payload: ModelDownloadProgress }
  | { type: 'MODEL_DOWNLOAD_COMPLETE'; payload: ModelInfo }
  | { type: 'MODEL_DOWNLOAD_ERROR'; payload: string }
  | { type: 'MODEL_DELETE_START' }
  | { type: 'MODEL_DELETE_COMPLETE' }
  | { type: 'PREWARM_START' }
  | { type: 'PREWARM_COMPLETE' }
  | { type: 'PREWARM_ERROR'; payload: string }
  | { type: 'BOOTSTRAP_RESET' };

// ============================================================================
// Bootstrap Screen Navigation Params
// ============================================================================

export type BootstrapScreenParams = {
  Bootstrap: undefined;
  Splash: undefined;
};

export type SettingsStackParams = {
  ModelRepository: undefined;
  SettingsHome: undefined;
};
