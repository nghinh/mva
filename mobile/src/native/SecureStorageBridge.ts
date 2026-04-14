import {NativeModules, Platform} from 'react-native';

type SecureStorageNativeModule = {
  encrypt: (plaintext: string) => Promise<string>;
  decrypt: (ciphertext: string) => Promise<string>;
};

const nativeModule = NativeModules.SecureStorageBridge as SecureStorageNativeModule | undefined;

export function isSecureStorageBridgeAvailable(): boolean {
  return Platform.OS === 'ios' || Platform.OS === 'android'
    ? nativeModule != null
    : false;
}

export async function encryptStoredValue(value: string): Promise<string> {
  if (!nativeModule) {
    return value;
  }
  return nativeModule.encrypt(value);
}

export async function decryptStoredValue(value: string): Promise<string> {
  if (!nativeModule) {
    return value;
  }
  return nativeModule.decrypt(value);
}
