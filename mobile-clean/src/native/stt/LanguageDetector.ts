/**
 * Language Detector
 *
 * Detects the source language (EN/JA/KO/ZH) from audio or transcript input.
 * Normalizes language values to stable contract for UI badges and downstream events.
 *
 * Per architecture: Keep EN/JA/KO/ZH-focused display while keeping contract extensible.
 */

import type { SessionId, UtteranceId, SourceLanguage } from '../../shared/types/common';
import type { LanguageDetectedEvent } from '../../shared/types/meeting';

export interface LanguageDetectionResult {
  language: SourceLanguage;
  confidence: number;
  timestampMs: number;
}

export interface LanguageConfig {
  /** Supported languages in priority order */
  supportedLanguages: SourceLanguage[];
  /** Minimum confidence to accept detection */
  minConfidence: number;
}

const DEFAULT_LANGUAGE_CONFIG: LanguageConfig = {
  supportedLanguages: ['en', 'ja', 'ko', 'zh'],
  minConfidence: 0.6,
};

/**
 * LanguageDetector
 *
 * Simulates on-device language detection.
 * In production, this would use language identification model from the STT stack.
 *
 * Architecture rules:
 * - Language values normalized to stable contract (en/ja/ko/zh)
 * - Contract extensible for future languages
 * - Language badges readable in UI per UX spec
 */
export class LanguageDetector {
  private config: LanguageConfig;
  private sessionId: SessionId | null = null;
  private lastDetectedLanguage: SourceLanguage = 'en';
  private lastDetectedAtMs: number = 0;
  private languageListeners: Set<(event: LanguageDetectedEvent) => void> = new Set();

  constructor(config: Partial<LanguageConfig> = {}) {
    this.config = { ...DEFAULT_LANGUAGE_CONFIG, ...config };
  }

  /**
   * Set the active session
   */
  setSession(sessionId: SessionId): void {
    this.sessionId = sessionId;
  }

  /**
   * Detect language from text input
   *
   * Primary detection method using transcript text.
   * In production, would use actual language identification model.
   */
  detectFromText(text: string, utteranceId: UtteranceId): LanguageDetectionResult {
    const result = this.performDetection(text);
    this.lastDetectedLanguage = result.language;
    this.lastDetectedAtMs = result.timestampMs;

    // Emit event
    this.emitDetection(utteranceId, result);

    return result;
  }

  /**
   * Get the last detected language
   */
  getLastDetected(): SourceLanguage {
    return this.lastDetectedLanguage;
  }

  /**
   * Get last detection confidence
   */
  getLastConfidence(): number {
    return 0.85; // Simulated
  }

  /**
   * Subscribe to language detection events
   * Returns unsubscribe function
   */
  subscribe(listener: (event: LanguageDetectedEvent) => void): () => void {
    this.languageListeners.add(listener);
    return () => {
      this.languageListeners.delete(listener);
    };
  }

  private performDetection(text: string): LanguageDetectionResult {
    const timestampMs = Date.now();

    if (!text || text.length === 0) {
      return {
        language: 'en',
        confidence: 0,
        timestampMs,
      };
    }

    // Simple heuristic-based language detection for simulation.
    // Distinguish Japanese Kana from Han-only text so Chinese isn't mislabeled as Japanese.
    const hasHan = /[\u4E00-\u9FFF]/.test(text);
    const hasJapanese = /[\u3040-\u309F\u30A0-\u30FF]/.test(text);
    const hasKorean = /[\uAC00-\uD7AF\u1100-\u11FF]/.test(text);
    const hasHiragana = /[\u3040-\u309F]/.test(text);
    const hasKatakana = /[\u30A0-\u30FF]/.test(text);

    if (hasJapanese && !hasKorean) {
      return {
        language: 'ja',
        confidence: hasHiragana || hasKatakana ? 0.92 : 0.75,
        timestampMs,
      };
    }

    if (hasKorean) {
      return {
        language: 'ko',
        confidence: 0.9,
        timestampMs,
      };
    }

    if (hasHan) {
      return {
        language: 'zh',
        confidence: 0.86,
        timestampMs,
      };
    }

    // Default to English for Latin script
    // Check for common English words as additional signal
    const commonEnglishWords = ['the', 'is', 'are', 'was', 'were', 'have', 'has', 'will', 'would', 'could', 'should', 'think', 'believe', 'consider'];
    const lowerText = text.toLowerCase();
    const hasEnglishSignal = commonEnglishWords.some((word) => lowerText.includes(word));

    return {
      language: 'en',
      confidence: hasEnglishSignal ? 0.88 : 0.72,
      timestampMs,
    };
  }

  private emitDetection(utteranceId: UtteranceId, result: LanguageDetectionResult): void {
    if (!this.sessionId) return;

    const event: LanguageDetectedEvent = {
      type: 'language_detected',
      session_id: this.sessionId,
      utterance_id: utteranceId,
      language: result.language,
      confidence: result.confidence,
      timestamp_ms: result.timestampMs,
    };

    this.languageListeners.forEach((listener) => listener(event));
  }

  /**
   * Release resources
   */
  release(): void {
    this.languageListeners.clear();
    this.sessionId = null;
  }
}

/**
 * Map language code to display label
 */
export function getLanguageLabel(language: SourceLanguage): string {
  const labels: Record<SourceLanguage, string> = {
    en: 'EN',
    ja: 'JA',
    ko: 'KO',
    zh: 'ZH',
  };
  return labels[language] ?? language.toUpperCase();
}

/**
 * Map language code to full name
 */
export function getLanguageName(language: SourceLanguage): string {
  const names: Record<SourceLanguage, string> = {
    en: 'English',
    ja: 'Japanese',
    ko: 'Korean',
    zh: 'Chinese',
  };
  return names[language] ?? language;
}

/**
 * Singleton instance
 */
let languageDetectorInstance: LanguageDetector | null = null;

export function getLanguageDetectorInstance(): LanguageDetector {
  if (!languageDetectorInstance) {
    languageDetectorInstance = new LanguageDetector();
  }
  return languageDetectorInstance;
}

export function releaseLanguageDetectorInstance(): void {
  if (languageDetectorInstance) {
    languageDetectorInstance.release();
    languageDetectorInstance = null;
  }
}
