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

interface SettingsState {
  developerMode: boolean;
  setDeveloperMode: (enabled: boolean) => void;
  /** Target translation language preference (default: Vietnamese) */
  targetLanguage: SupportedTargetLanguage;
  setTargetLanguage: (lang: SupportedTargetLanguage) => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      developerMode: false,
      setDeveloperMode: (enabled) => set({developerMode: enabled}),
      targetLanguage: DEFAULT_TARGET_LANGUAGE,
      setTargetLanguage: (lang) => set({targetLanguage: lang}),
    }),
    {
      name: 'vibevoice-settings-store',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        developerMode: state.developerMode,
        targetLanguage: state.targetLanguage,
      }),
    }
  )
);

export const useDeveloperMode = () => useSettingsStore((state) => state.developerMode);
export const useTargetLanguage = () => useSettingsStore((state) => state.targetLanguage);
