import {Platform} from 'react-native';
import {SourceLanguage, TargetLanguage} from '../shared/types';
import getNativeAppleTranslator from '../native/NativeAppleTranslator';
import MLKitTranslator from '../native/NativeMLKitTranslator';

export type {LiveTranslationTask, LiveTranslationResult, LiveTranslationSkipped, LiveTranslationSkippedReason} from './LiveMeetingTranslator';
export type {Adapter} from './LiveMeetingTranslator';

export interface TranslationResult {
  text: string;
  latencyMs: number;
}

type TranslationNativeModule = ReturnType<typeof getNativeAppleTranslator> | typeof MLKitTranslator;

class TranslationService {
  async initialize(): Promise<boolean> {
    if (Platform.OS === 'ios') {
      const module = getNativeAppleTranslator();
      return module?.initialize?.() ?? true;
    } else {
      // ML Kit initializes on first translate call, no explicit init needed
      return true;
    }
  }

  async translate(text: string, srcLang: SourceLanguage, targetLang: TargetLanguage = 'vi'): Promise<TranslationResult> {
    const startedAt = Date.now();

    if (srcLang === targetLang) {
      return {text, latencyMs: Date.now() - startedAt};
    }

    if (Platform.OS === 'ios') {
      const module = getNativeAppleTranslator();
      const translated = await (module?.translate?.(
        text,
        this.mapLangToApple(srcLang),
        this.mapLangToApple(targetLang),
      ) ?? Promise.resolve(text));
      return {text: translated, latencyMs: Date.now() - startedAt};
    }

    const translated = await MLKitTranslator.translate(text, srcLang, targetLang);
    return {text: translated, latencyMs: Date.now() - startedAt};
  }

  async translateBatch(texts: string[], srcLang: SourceLanguage, targetLang: TargetLanguage = 'vi'): Promise<TranslationResult[]> {
    const startedAt = Date.now();

    // Passthrough only when source and target match ('vi' is a valid SOURCE
    // now that Vietnamese input exists — never skip it unconditionally).
    if (srcLang === targetLang) {
      return texts.map((text) => ({text, latencyMs: 0}));
    }

    if (Platform.OS === 'ios') {
      const module = getNativeAppleTranslator();
      const translated = await (module?.translateBatch?.(
        texts,
        this.mapLangToApple(srcLang),
        this.mapLangToApple(targetLang),
      ) ?? Promise.resolve(texts));
      return translated.map((value) => ({text: value, latencyMs: Date.now() - startedAt}));
    }

    const translated = await MLKitTranslator.translateBatch(texts, srcLang, targetLang);
    return translated.map((value) => ({text: value, latencyMs: Date.now() - startedAt}));
  }

  async isAvailable(srcLang: SourceLanguage, tgtLang: TargetLanguage = 'vi'): Promise<boolean> {
    if (Platform.OS === 'ios') {
      const module = getNativeAppleTranslator();
      return module?.isLanguageAvailable?.(this.mapLangToApple(srcLang), this.mapLangToApple(tgtLang)) ?? false;
    }

    return MLKitTranslator.isLanguageAvailable(srcLang, tgtLang);
  }

  async downloadAllPacks(): Promise<boolean> {
    if (Platform.OS === 'ios') {
      return true;
    } else {
      return MLKitTranslator.downloadAllLanguagePacks();
    }
  }

  /**
   * Pack availability keyed `${src}-${target}`. Default target 'vi' keeps the
   * historical behavior for existing callers (Splash/Settings); pass the live
   * target when Vietnamese is the INPUT so the vi→X pairs get checked instead.
   */
  async getPackStatus(targetLang: TargetLanguage = 'vi'): Promise<Record<string, boolean>> {
    if (Platform.OS === 'ios') {
      const module = getNativeAppleTranslator();
      const sources: SourceLanguage[] = ['en', 'ja', 'ko', 'zh', 'vi'];
      const status: Record<string, boolean> = {};
      for (const src of sources) {
        if (src === targetLang) {
          continue;
        }
        status[`${src}-${targetLang}`] = await (module?.isLanguageAvailable?.(
          this.mapLangToApple(src),
          this.mapLangToApple(targetLang),
        ) ?? Promise.resolve(false));
      }
      return status;
    }

    return MLKitTranslator.getPackStatus();
  }

  async deleteAllPacks(): Promise<boolean> {
    if (Platform.OS === 'ios') {
      return true;
    } else {
      return MLKitTranslator.deleteAllPacks();
    }
  }

  async unload(): Promise<void> {
    if (Platform.OS === 'ios') {
      await (getNativeAppleTranslator()?.unload?.() ?? Promise.resolve());
      return;
    }

    MLKitTranslator.cleanup();
  }

  getNativeModule(): TranslationNativeModule | null {
    if (Platform.OS === 'ios') {
      return getNativeAppleTranslator();
    }

    return MLKitTranslator;
  }

  private mapLangToApple(lang: SourceLanguage | TargetLanguage): string {
    switch (lang) {
      case 'en': return 'en';
      case 'ja': return 'ja';
      case 'ko': return 'ko';
      case 'zh': return 'zh-Hans';
      case 'vi': return 'vi';
      default: return 'en';
    }
  }
}

export const translationService = new TranslationService();