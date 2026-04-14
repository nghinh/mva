import {TargetLanguage} from '../shared/types';
import {getNativeNllbTranslator} from '../native/NativeNllbTranslator';

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
  private versionCounter = 0;
  private queue: QueuedTranslation[] = [];
  private active = false;

  private async drainQueue(): Promise<void> {
    if (this.active) return;
    this.active = true;
    try {
      while (this.queue.length > 0) {
        const next = this.queue.shift();
        if (next) {
          await next.run();
        }
      }
    } finally {
      this.active = false;
    }
  }

  async initialize(modelDir: string): Promise<boolean> {
    return requireTranslator().initialize(modelDir);
  }

  async isLoaded(): Promise<boolean> {
    const nativeModule = getNativeNllbTranslator();
    if (!nativeModule) {
      return false;
    }
    return nativeModule.isLoaded();
  }

  async unload(): Promise<void> {
    this.cancelPending();
    const nativeModule = getNativeNllbTranslator();
    if (!nativeModule) {
      return;
    }
    await nativeModule.unload();
  }

  async translate(request: TranslationRequest): Promise<{text: string; version: number}> {
    const version = request.requestId ?? ++this.versionCounter;
    return new Promise((resolve, reject) => {
      this.queue.push({
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
          }
        },
        reject,
      });
      this.drainQueue().catch(reject);
    });
  }

  cancelPending(): void {
    const cancelled = this.queue;
    this.queue = [];
    cancelled.forEach(({reject}) => reject(new TranslationCancelledError()));
  }
}

let translatorSingleton: OnDeviceTranslator | null = null;

export function getOnDeviceTranslator(): OnDeviceTranslator {
  if (!translatorSingleton) {
    translatorSingleton = new OnDeviceTranslator();
  }
  return translatorSingleton;
}
