import {localStorage as AsyncStorage} from '../utils/localStorage';
import {create} from 'zustand';
import {createJSONStorage, persist} from 'zustand/middleware';

/**
 * Supported target translation languages.
 * Currently limited to Vietnamese (v1 offline build).
 * Expansion path: add 'zh', 'ko', 'ja', etc. when NLLB models support them.
 *
 * @note When adding new languages:
 * 1. Add to this union type
 * 2. Update TARGET_LANGUAGE_OPTIONS in this file
 * 3. Update mapSourceLanguageToNllb in OnDeviceTranslator if NLLB codes differ
 * 4. Update SettingsScreen language selector UI
 */
export type SupportedTargetLanguage = 'en' | 'vi' | 'zh' | 'ko' | 'ja';

export interface LanguageOption {
  code: SupportedTargetLanguage;
  label: string;
  nativeLabel: string;
  nllbCode: string;
}

/**
 * Available target language options.
 * Vietnamese is default per Story S-602 AC.
 * Expansion: add more languages here as NLLB models are validated.
 */
export const TARGET_LANGUAGE_OPTIONS: LanguageOption[] = [
  {code: 'en', label: 'English', nativeLabel: 'English', nllbCode: 'eng_Latn'},
  {code: 'vi', label: 'Vietnamese', nativeLabel: 'Tiếng Việt', nllbCode: 'vie_Latn'},
  {code: 'zh', label: 'Chinese', nativeLabel: '中文', nllbCode: 'zho_Hans'},
  {code: 'ko', label: 'Korean', nativeLabel: '한국어', nllbCode: 'kor_Hang'},
  {code: 'ja', label: 'Japanese', nativeLabel: '日本語', nllbCode: 'jpn_Jpan'},
];

export const DEFAULT_TARGET_LANGUAGE: SupportedTargetLanguage = 'vi';

export function getLanguageOption(code: SupportedTargetLanguage): LanguageOption {
  return TARGET_LANGUAGE_OPTIONS.find((opt) => opt.code === code) ?? TARGET_LANGUAGE_OPTIONS[0];
}

/**
 * Speaker diarization sensitivity threshold.
 * Controls how aggressively the model clusters speaker segments.
 * - Lower values (0.3): Fewer speaker labels — may merge different speakers into one
 * - Higher values (0.9): More speaker labels — may split same speaker into multiple
 *
 * The algorithm blends this value (30%) with its internal calibrated default (70%),
 * so the slider adjusts sensitivity without over-riding the core clustering logic.
 *
 * @default 0.55
 * @range [0.3, 0.9]
 */
export const DIARIZATION_THRESHOLD_MIN = 0.3;
export const DIARIZATION_THRESHOLD_MAX = 0.9;
export const DEFAULT_DIARIZATION_THRESHOLD = 0.55;

interface SettingsState {
  developerMode: boolean;
  setDeveloperMode: (enabled: boolean) => void;
  /** Target translation language preference (default: Vietnamese) */
  targetLanguage: SupportedTargetLanguage;
  setTargetLanguage: (lang: SupportedTargetLanguage) => void;
  /** Speaker diarization sensitivity threshold (default: 0.55, range: 0.3-0.9) */
  diarizationThreshold: number;
  setDiarizationThreshold: (threshold: number) => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      developerMode: false,
      setDeveloperMode: (enabled) => set({developerMode: enabled}),
      targetLanguage: DEFAULT_TARGET_LANGUAGE,
      setTargetLanguage: (lang) => set({targetLanguage: lang}),
      diarizationThreshold: DEFAULT_DIARIZATION_THRESHOLD,
      setDiarizationThreshold: (threshold) =>
        set({diarizationThreshold: Math.max(DIARIZATION_THRESHOLD_MIN, Math.min(DIARIZATION_THRESHOLD_MAX, threshold))}),
    }),
    {
      name: 'vibevoice-settings-store',
      version: 3,
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        developerMode: state.developerMode,
        targetLanguage: state.targetLanguage,
        diarizationThreshold: state.diarizationThreshold,
      }),
      migrate: (persistedState: unknown, version) => {
        const state = (persistedState ?? {}) as Partial<SettingsState>;
        const persistedThreshold = typeof state.diarizationThreshold === 'number'
          ? state.diarizationThreshold
          : DEFAULT_DIARIZATION_THRESHOLD;

        const upgradedThreshold =
          version < 3
            ? DEFAULT_DIARIZATION_THRESHOLD
            : Math.max(DIARIZATION_THRESHOLD_MIN, Math.min(DIARIZATION_THRESHOLD_MAX, persistedThreshold));

        return {
          developerMode: state.developerMode ?? false,
          targetLanguage: state.targetLanguage ?? DEFAULT_TARGET_LANGUAGE,
          diarizationThreshold: upgradedThreshold,
        } as SettingsState;
      },
    }
  )
);

export const useDeveloperMode = () => useSettingsStore((state) => state.developerMode);
export const useTargetLanguage = () => useSettingsStore((state) => state.targetLanguage);
export const useDiarizationThreshold = () => useSettingsStore((state) => state.diarizationThreshold);
