import { NativeModules } from 'react-native';

interface MLKitTranslatorSpec {
    translate(text: string, srcLang: string, tgtLang: string): Promise<string>;
    translateBatch(texts: string[], srcLang: string, tgtLang: string): Promise<string[]>;
    isLanguageAvailable(srcLang: string, tgtLang: string): Promise<boolean>;
    downloadLanguagePack(srcLang: string, tgtLang: string): Promise<boolean>;
    downloadAllLanguagePacks(): Promise<boolean>;
    getPackStatus(): Promise<Record<string, boolean>>;
    deleteAllPacks(): Promise<boolean>;
    cleanup(): void;
}

export default NativeModules.MLKitTranslator as MLKitTranslatorSpec;