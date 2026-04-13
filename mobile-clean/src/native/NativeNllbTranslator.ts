import {TurboModule, TurboModuleRegistry} from 'react-native';

export interface Spec extends TurboModule {
  initialize(modelDir: string): Promise<boolean>;
  translate(text: string, srcLang: string, tgtLang: string): Promise<string>;
  isLoaded(): Promise<boolean>;
  unload(): Promise<void>;
}

let cachedModule: Spec | null | undefined;

export function getNativeNllbTranslator(): Spec | null {
  if (cachedModule !== undefined) {
    return cachedModule;
  }

  cachedModule = TurboModuleRegistry.get<Spec>('NllbTranslatorModule') ?? null;
  return cachedModule;
}
