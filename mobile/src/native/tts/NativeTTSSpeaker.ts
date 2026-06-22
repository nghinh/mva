import {NativeModules, NativeEventEmitter, Platform} from 'react-native';

const {TTSSpeakerModule} = NativeModules;

export const NativeTTSSpeaker = TTSSpeakerModule as {
  speak(text: string, language: string, rate: number): void;
  stopAndClear(): Promise<boolean>;
  isSpeaking(): Promise<boolean>;
  checkLanguageAvailable(language: string): Promise<boolean>;
} | null;

export const TTSSpeakerEmitter =
  TTSSpeakerModule
    ? new NativeEventEmitter(TTSSpeakerModule)
    : null;

export function speakText(text: string, language: string, rate: number): void {
  NativeTTSSpeaker?.speak(text, language, rate);
}

export function stopTTS(): Promise<boolean> {
  return NativeTTSSpeaker?.stopAndClear() ?? Promise.resolve(false);
}

export function isTTSSpeaking(): Promise<boolean> {
  return NativeTTSSpeaker?.isSpeaking() ?? Promise.resolve(false);
}

export function checkAndroidTtsLanguage(lang: string): Promise<boolean> {
  if (Platform.OS !== 'android') return Promise.resolve(true);
  return NativeTTSSpeaker?.checkLanguageAvailable(lang) ?? Promise.resolve(false);
}
