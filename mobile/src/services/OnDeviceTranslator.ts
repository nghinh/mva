import {SourceLanguage, TargetLanguage} from '../shared/types';
import {translationService} from './TranslationService';
import {AppState, NativeEventSubscription, Platform} from 'react-native';
import {useSettingsStore} from '../shared/store/settingsStore';
import {warnLog, infoLog} from '../shared/utils/logger';

export type TranslationSourceLanguage = 'en' | 'ja' | 'ko' | 'zh' | 'vi';

export function mapSourceLanguageToNllb(source: SourceLanguage): TranslationSourceLanguage {
  switch (source) {
    case 'en':
      return 'en';
    case 'ja':
      return 'ja';
    case 'ko':
      return 'ko';
    case 'vi':
      return 'vi';
    case 'zh':
    default:
      return 'zh';
  }
}

export interface TranslationRequest {
  text: string;
  sourceLanguage: TranslationSourceLanguage;
  // Unused: translate() reads the LIVE target from the settings store on each
  // call (vi by default, any SupportedTargetLanguage otherwise). Kept in the
  // shape for callers that want to record intent.
  targetLanguage?: TargetLanguage;
  requestId?: number;
}

export class TranslationCancelledError extends Error {
  constructor() {
    super('Translation request cancelled');
    this.name = 'TranslationCancelledError';
  }
}

export class TranslationUnavailableError extends Error {
  constructor() {
    super('Native translator module is unavailable');
    this.name = 'TranslationUnavailableError';
  }
}

export class TranslationSuppressedForMemoryError extends Error {
  constructor() {
    super('Translation temporarily disabled after memory warning');
    this.name = 'TranslationSuppressedForMemoryError';
  }
}

export function isTranslationCancelledError(error: unknown): error is TranslationCancelledError {
  return error instanceof TranslationCancelledError || (
    error instanceof Error && error.name === 'TranslationCancelledError'
  );
}

type QueuedTranslation = {
  run: () => Promise<void>;
  reject: (reason?: unknown) => void;
};

export class OnDeviceTranslator {
  private static readonly IOS_MEMORY_PRESSURE_COOLDOWN_MS = 15000;
  private versionCounter = 0;
  private pending: QueuedTranslation | null = null;
  private active = false;
  private initialized = false;
  private pendingInit: Promise<boolean> | null = null;
  private warmedUp = false;
  private pendingWarmUp: Promise<boolean> | null = null;
  private readonly memoryWarningSubscription: NativeEventSubscription | null;
  private memoryPressureSuppressedUntil = 0;
  private deferredUnloadRequested = false;

  constructor() {
    this.memoryWarningSubscription =
      Platform.OS === 'ios'
        ? AppState.addEventListener('memoryWarning', () => {
            this.memoryPressureSuppressedUntil = Date.now() + OnDeviceTranslator.IOS_MEMORY_PRESSURE_COOLDOWN_MS;
            if (this.active) {
              this.deferredUnloadRequested = true;
            }
          })
        : null;
  }

  private async drainQueue(): Promise<void> {
    if (this.active) return;
    this.active = true;
    try {
      while (this.pending) {
        const next = this.pending;
        this.pending = null;
        await next.run();
      }
    } finally {
      this.active = false;
    }
  }

  private refreshMemoryPressureSuppression(): void {
    if (this.memoryPressureSuppressedUntil !== 0 && Date.now() >= this.memoryPressureSuppressedUntil) {
      this.memoryPressureSuppressedUntil = 0;
    }
  }

  async initialize(_modelDir: string): Promise<boolean> {
    infoLog('[OnDeviceTranslator] initialize() called, current initialized =', this.initialized);
    this.refreshMemoryPressureSuppression();
    if (this.memoryPressureSuppressedUntil !== 0) {
      warnLog('[OnDeviceTranslator] initialize() blocked by memory pressure');
      return false;
    }
    const ok = await translationService.initialize();
    infoLog('[OnDeviceTranslator] initialize() translationService.initialize() returned =', ok);
    if (ok) {
      this.initialized = true;
      infoLog('[OnDeviceTranslator] initialize() set this.initialized = true');
    }
    return ok;
  }

  /**
   * Idempotent, race-safe load.
   */
  ensureLoaded(_modelDir: string): Promise<boolean> {
    this.refreshMemoryPressureSuppression();
    if (this.memoryPressureSuppressedUntil !== 0) {
      return Promise.resolve(false);
    }
    if (this.initialized) {
      return Promise.resolve(true);
    }
    if (this.pendingInit) {
      return this.pendingInit;
    }
    const task = (async () => {
      try {
        const ok = await translationService.initialize();
        if (ok) {
          this.initialized = true;
        }
        return ok;
      } finally {
        this.pendingInit = null;
      }
    })();
    this.pendingInit = task;
    return task;
  }

  async isLoaded(): Promise<boolean> {
    infoLog('[OnDeviceTranslator] isLoaded() returning =', this.initialized);
    return this.initialized;
  }

  /**
   * True while a translate() call is currently executing.
   */
  isTranslating(): boolean {
    return this.active;
  }

  /**
   * True once warmUp() has completed at least once.
   */
  isWarmedUp(): boolean {
    return this.warmedUp;
  }

  isSuppressedForMemoryPressure(): boolean {
    this.refreshMemoryPressureSuppression();
    return this.memoryPressureSuppressedUntil !== 0;
  }

  getMemoryPressureCooldownRemainingMs(): number {
    this.refreshMemoryPressureSuppression();
    return this.memoryPressureSuppressedUntil === 0
      ? 0
      : Math.max(0, this.memoryPressureSuppressedUntil - Date.now());
  }

  clearMemoryPressureSuppression(): void {
    this.memoryPressureSuppressedUntil = 0;
  }

  async unload(): Promise<void> {
    this.cancelPending();
    this.deferredUnloadRequested = false;
    this.initialized = false;
    this.pendingInit = null;
    this.warmedUp = false;
    this.pendingWarmUp = null;
    await translationService.unload();
  }

  async waitForIdle(timeoutMs: number): Promise<boolean> {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      if (!this.active) {
        return true;
      }
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    return !this.active;
  }

  /**
   * Idempotent warm-up. Platform-native translation (Apple Translation / Opus-MT)
   * loads instantly, so warmup just verifies initialization.
   */
  warmUp(): Promise<boolean> {
    if (this.warmedUp) return Promise.resolve(true);
    if (this.pendingWarmUp) return this.pendingWarmUp;
    const task = (async () => {
      try {
        const ok = await translationService.initialize();
        this.warmedUp = ok;
        return ok;
      } catch {
        return false;
      } finally {
        this.pendingWarmUp = null;
      }
    })();
    this.pendingWarmUp = task;
    return task;
  }

  async translate(request: TranslationRequest): Promise<{text: string; version: number}> {
    infoLog('[OnDeviceTranslator] translate() called for text:', request.text.substring(0, 50));
    this.refreshMemoryPressureSuppression();
    if (this.memoryPressureSuppressedUntil !== 0) {
      warnLog('[OnDeviceTranslator] translate() blocked by memory pressure');
      throw new TranslationSuppressedForMemoryError();
    }
    const version = request.requestId ?? ++this.versionCounter;

    // Get target language from settings store
    const targetLang = useSettingsStore.getState().targetLanguage;

    return new Promise((resolve, reject) => {
      if (this.pending) {
        warnLog('[OnDeviceTranslator] translate() cancelling pending translation');
        this.pending.reject(new TranslationCancelledError());
      }
      this.pending = {
        run: async () => {
          try {
            infoLog('[OnDeviceTranslator] translate() calling translationService.translate()');
            const translated = await translationService.translate(
              request.text,
              request.sourceLanguage as SourceLanguage,
              targetLang,
            );
            infoLog('[OnDeviceTranslator] translate() translationService.translate() returned:', translated.text.substring(0, 50));
            resolve({text: translated.text, version});
          } catch (error) {
            warnLog('[OnDeviceTranslator] translate() error:', error);
            reject(error);
          } finally {
            if (this.deferredUnloadRequested) {
              try {
                warnLog('[OnDeviceTranslator] translate() executing deferred unload');
                await this.unload();
              } catch {
                // Best-effort unload for debug stability.
              }
            }
          }
        },
        reject,
      };
      this.drainQueue().catch(reject);
    });
  }

  cancelPending(): void {
    if (this.pending) {
      this.pending.reject(new TranslationCancelledError());
      this.pending = null;
    }
  }
}

let translatorSingleton: OnDeviceTranslator | null = null;

export function getOnDeviceTranslator(): OnDeviceTranslator {
  if (!translatorSingleton) {
    translatorSingleton = new OnDeviceTranslator();
  }
  return translatorSingleton;
}