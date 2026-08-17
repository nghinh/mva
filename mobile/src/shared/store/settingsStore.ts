import AsyncStorage from '@react-native-async-storage/async-storage';
import {create} from 'zustand';
import {createJSONStorage, persist} from 'zustand/middleware';
import {type AppLanguage, detectDeviceLanguage, changeAppLanguage} from '../../i18n';
import type {TtsRate} from '../../services/tts/TTSService';

export type AppThemeMode = 'system' | 'dark' | 'light';

/**
 * Supported target translation languages.
 * Currently limited to Vietnamese (v1 offline build).
 * Expansion path: add 'zh', 'ko', 'ja', etc. when native translation models support them.
 */
export type SupportedTargetLanguage = 'en' | 'vi' | 'zh' | 'ko' | 'ja';

export interface LanguageOption {
  code: SupportedTargetLanguage;
  label: string;
  nativeLabel: string;
}

/**
 * Available target language options.
 * Vietnamese is default per Story S-602 AC.
 */
export const TARGET_LANGUAGE_OPTIONS: LanguageOption[] = [
  {code: 'en', label: 'English', nativeLabel: 'English'},
  {code: 'vi', label: 'Vietnamese', nativeLabel: 'Tiếng Việt'},
  {code: 'zh', label: 'Chinese', nativeLabel: '中文'},
  {code: 'ko', label: 'Korean', nativeLabel: '한국어'},
  {code: 'ja', label: 'Japanese', nativeLabel: '日本語'},
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

export type SttEngineType = 'sense_voice';
export const DEFAULT_STT_ENGINE: SttEngineType = 'sense_voice';

/**
 * Input language mode.
 * - 'auto'  : SenseVoice handles EN / JA / KO / ZH with auto-detection (default).
 * - 'vi'    : iOS SFSpeechRecognizer (vi-VN) handles Vietnamese input offline.
 */
export type InputLanguageMode = 'auto' | 'vi';
export const DEFAULT_INPUT_LANGUAGE: InputLanguageMode = 'auto';

export type {AppLanguage};

interface SettingsState {
  developerMode: boolean;
  setDeveloperMode: (enabled: boolean) => void;
  themeMode: AppThemeMode;
  setThemeMode: (mode: AppThemeMode) => void;
  /** Target translation language preference (default: Vietnamese) */
  targetLanguage: SupportedTargetLanguage;
  setTargetLanguage: (lang: SupportedTargetLanguage) => void;
  /** Speaker diarization sensitivity threshold (default: 0.55, range: 0.3-0.9) */
  diarizationThreshold: number;
  setDiarizationThreshold: (threshold: number) => void;
  /** STT engine: SenseVoice (EN/JA/KO/ZH). */
  sttEngine: SttEngineType;
  setSttEngine: (engine: SttEngineType) => void;
  /** App UI language — detected from device on first install, then only changed via app settings. */
  appLanguage: AppLanguage;
  setAppLanguage: (lang: AppLanguage) => void;
  /** Read translations aloud through earphones (default: false) */
  ttsEnabled: boolean;
  setTtsEnabled: (v: boolean) => void;
  /** TTS playback rate (default: 'normal') */
  ttsRate: TtsRate;
  setTtsRate: (r: TtsRate) => void;
  /**
   * Input language mode (default: 'auto').
   * 'auto' uses SenseVoice for EN/JA/KO/ZH; 'vi' uses iOS SFSpeechRecognizer.
   */
  inputLanguage: InputLanguageMode;
  setInputLanguage: (mode: InputLanguageMode) => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      developerMode: false,
      setDeveloperMode: (enabled) => set({developerMode: enabled}),
      themeMode: 'system',
      setThemeMode: (mode) => set({themeMode: mode}),
      targetLanguage: DEFAULT_TARGET_LANGUAGE,
      setTargetLanguage: (lang) => set({targetLanguage: lang}),
      diarizationThreshold: DEFAULT_DIARIZATION_THRESHOLD,
      setDiarizationThreshold: (threshold) =>
        set({diarizationThreshold: Math.max(DIARIZATION_THRESHOLD_MIN, Math.min(DIARIZATION_THRESHOLD_MAX, threshold))}),
      sttEngine: DEFAULT_STT_ENGINE,
      setSttEngine: (engine) => set({sttEngine: engine}),
      appLanguage: detectDeviceLanguage(),
      setAppLanguage: (lang) => {
        set({appLanguage: lang});
        changeAppLanguage(lang);
      },
      ttsEnabled: false,
      setTtsEnabled: (v) => set({ttsEnabled: v}),
      ttsRate: 'normal',
      setTtsRate: (r) => set({ttsRate: r}),
      inputLanguage: DEFAULT_INPUT_LANGUAGE,
      setInputLanguage: (mode) => set({inputLanguage: mode}),
    }),
    {
      name: 'vibevoice-settings-store',
      version: 11,
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        developerMode: state.developerMode,
        themeMode: state.themeMode,
        targetLanguage: state.targetLanguage,
        diarizationThreshold: state.diarizationThreshold,
        sttEngine: state.sttEngine,
        appLanguage: state.appLanguage,
        ttsEnabled: state.ttsEnabled,
        ttsRate: state.ttsRate,
        inputLanguage: state.inputLanguage,
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
          themeMode: state.themeMode ?? 'system',
          targetLanguage: state.targetLanguage ?? DEFAULT_TARGET_LANGUAGE,
          diarizationThreshold: upgradedThreshold,
          sttEngine: DEFAULT_STT_ENGINE,
          appLanguage: version < 5 ? detectDeviceLanguage() : ((state as SettingsState).appLanguage ?? detectDeviceLanguage()),
          // Reset ttsEnabled to false on upgrade from v9 (VITS testing left it ON).
          ttsEnabled: version < 10 ? false : ((state as SettingsState).ttsEnabled ?? false),
          ttsRate: (state as SettingsState).ttsRate ?? 'normal',
          // New in v11 — default to 'auto' (SenseVoice) for all existing installs.
          inputLanguage: (state as SettingsState).inputLanguage ?? DEFAULT_INPUT_LANGUAGE,
        } as SettingsState;
      },
    }
  )
);

export const useDeveloperMode = () => useSettingsStore((state) => state.developerMode);
export const useThemeMode = () => useSettingsStore((state) => state.themeMode);
export const useTargetLanguage = () => useSettingsStore((state) => state.targetLanguage);
export const useDiarizationThreshold = () => useSettingsStore((state) => state.diarizationThreshold);
export const useSttEngine = () => useSettingsStore((state) => state.sttEngine);
export const useAppLanguage = () => useSettingsStore((state) => state.appLanguage);
export const useTtsEnabled = () => useSettingsStore((state) => state.ttsEnabled);
export const useTtsRate = () => useSettingsStore((state) => state.ttsRate);
export const useInputLanguage = () => useSettingsStore((state) => state.inputLanguage);
export type {TtsRate};
