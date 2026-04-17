import {TargetLanguage} from '../shared/types';
import {getNativeNllbTranslator} from '../native/NativeNllbTranslator';
import {AppState, NativeEventSubscription, Platform} from 'react-native';

export type TranslationSourceLanguage = 'eng_Latn' | 'jpn_Jpan' | 'kor_Hang' | 'zho_Hans';
export type TranslationTargetLanguage = 'eng_Latn' | 'vie_Latn' | 'zho_Hans' | 'kor_Hang' | 'jpn_Jpan';

export function mapSourceLanguageToNllb(source: 'en' | 'ja' | 'ko' | 'zh'): TranslationSourceLanguage {
  switch (source) {
    case 'en':
      return 'eng_Latn';
    case 'ja':
      return 'jpn_Jpan';
    case 'ko':
      return 'kor_Hang';
    case 'zh':
    default:
      return 'zho_Hans';
  }
}

export function mapTargetLanguageToNllb(target: TargetLanguage): TranslationTargetLanguage {
  switch (target) {
    case 'en':
      return 'eng_Latn';
    case 'zh':
      return 'zho_Hans';
    case 'ko':
      return 'kor_Hang';
    case 'ja':
      return 'jpn_Jpan';
    case 'vi':
    default:
      return 'vie_Latn';
  }
}

export interface TranslationRequest {
  text: string;
  sourceLanguage: TranslationSourceLanguage;
  targetLanguage?: TranslationTargetLanguage;
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
    super('Native NLLB translator module is unavailable');
    this.name = 'TranslationUnavailableError';
  }
}

export class TranslationSuppressedForMemoryError extends Error {
  constructor() {
    super('Translation temporarily disabled after iOS memory warning');
    this.name = 'TranslationSuppressedForMemoryError';
  }
}

export function isTranslationCancelledError(error: unknown): error is TranslationCancelledError {
  return error instanceof TranslationCancelledError || (
    error instanceof Error && error.name === 'TranslationCancelledError'
  );
}

function requireTranslator() {
  const nativeModule = getNativeNllbTranslator();
  if (!nativeModule) {
    throw new TranslationUnavailableError();
  }
  return nativeModule;
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
  private loadedModelDir: string | null = null;
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
            } else {
              this.unload().catch(() => undefined);
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

  async initialize(modelDir: string): Promise<boolean> {
    this.refreshMemoryPressureSuppression();
    if (this.memoryPressureSuppressedUntil !== 0) {
      return false;
    }
    const ok = await requireTranslator().initialize(modelDir);
    if (ok) {
      this.loadedModelDir = modelDir;
    }
    return ok;
  }

  /**
   * Idempotent, race-safe load. Splash and Meeting call this concurrently; we
   * memoize the in-flight native initialize() promise so only one load happens.
   */
  ensureLoaded(modelDir: string): Promise<boolean> {
    this.refreshMemoryPressureSuppression();
    if (this.memoryPressureSuppressedUntil !== 0) {
      return Promise.resolve(false);
    }
    if (this.loadedModelDir === modelDir) {
      return Promise.resolve(true);
    }
    if (this.pendingInit) {
      return this.pendingInit;
    }
    const task = (async () => {
      try {
        const nativeLoaded = await this.isLoaded().catch(() => false);
        if (nativeLoaded && this.loadedModelDir === modelDir) {
          return true;
        }
        const ok = await requireTranslator().initialize(modelDir);
        if (ok) {
          this.loadedModelDir = modelDir;
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
    const nativeModule = getNativeNllbTranslator();
    if (!nativeModule) {
      return false;
    }
    return nativeModule.isLoaded();
  }

  /**
   * True while a translate() call is currently executing on the native side.
   * Draft callers use this to skip enqueueing another NLLB run while the
   * previous one is still grinding — native NLLB has no cancellation token,
   * so queued drafts would otherwise serialise and pile up (a 10s utterance
   * with partials every 300ms + 800ms/call NLLB = ~13s of cumulative work).
   */
  isTranslating(): boolean {
    return this.active;
  }

  /**
   * True once warmUp() has completed at least once. Callers that can afford to
   * skip their work (e.g. draft translations) should gate on this — otherwise
   * the very first draft pays the decoder_model lazy-load (~several seconds)
   * and every subsequent partial piles up behind the hard gate.
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
    this.loadedModelDir = null;
    this.pendingInit = null;
    this.warmedUp = false;
    this.pendingWarmUp = null;
    const nativeModule = getNativeNllbTranslator();
    if (!nativeModule) {
      return;
    }
    await nativeModule.unload();
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
   * Idempotent warm-up. Native iOS lazy-loads the decoder_model ONNX session on
   * the first translate() call (~multi-second cold start) — see
   * ios/NllbTranslatorHelper.swift:177. Calling this once during splash forces
   * that load (and the ONNX kernel JIT) to happen off the user's critical path,
   * so the first in-meeting translation is fast.
   */
  warmUp(): Promise<boolean> {
    if (this.warmedUp) return Promise.resolve(true);
    if (this.pendingWarmUp) return this.pendingWarmUp;
    const task = (async () => {
      try {
        const nativeModule = getNativeNllbTranslator();
        if (!nativeModule) return false;
        await nativeModule.translate('Hello', 'eng_Latn', 'vie_Latn');
        this.warmedUp = true;
        return true;
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
    this.refreshMemoryPressureSuppression();
    if (this.memoryPressureSuppressedUntil !== 0) {
      throw new TranslationSuppressedForMemoryError();
    }
    const version = request.requestId ?? ++this.versionCounter;
    return new Promise((resolve, reject) => {
      if (this.pending) {
        this.pending.reject(new TranslationCancelledError());
      }
      this.pending = {
        run: async () => {
          try {
            const translated = await requireTranslator().translate(
              request.text,
              request.sourceLanguage,
              request.targetLanguage ?? 'vie_Latn',
            );
            resolve({text: translated, version});
          } catch (error) {
            reject(error);
          } finally {
            if (this.deferredUnloadRequested) {
              try {
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
