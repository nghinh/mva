import {NativeModules, Platform, TurboModuleRegistry} from 'react-native';
import {
  decryptStoredValue,
  encryptStoredValue,
  isSecureStorageBridgeAvailable,
} from '../../native/SecureStorageBridge';

type NativeAsyncStorageLike = {
  multiGet?: (
    keys: string[],
    callback: (errors?: unknown[] | null, result?: Array<[string, string | null]>) => void,
  ) => void;
  multiSet?: (keyValuePairs: Array<[string, string]>, callback: (errors?: unknown[] | null) => void) => void;
  multiRemove?: (keys: string[], callback: (errors?: unknown[] | null) => void) => void;
  getItem?: (key: string) => Promise<string | null>;
  setItem?: (key: string, value: string) => Promise<void>;
  removeItem?: (key: string) => Promise<void>;
};

type AsyncStorageLike = {
  getItem: (key: string) => Promise<string | null>;
  setItem: (key: string, value: string) => Promise<void>;
  removeItem: (key: string) => Promise<void>;
};

const ENCRYPTED_PREFIX = 'enc:v1:';
const memoryStore = new Map<string, string>();

let asyncStorageRef: AsyncStorageLike | null | undefined;

function wrapNativeAsyncStorage(nativeStorage: NativeAsyncStorageLike): AsyncStorageLike {
  if (nativeStorage.getItem && nativeStorage.setItem && nativeStorage.removeItem) {
    return {
      getItem: (key: string) => nativeStorage.getItem!(key),
      setItem: (key: string, value: string) => nativeStorage.setItem!(key, value),
      removeItem: (key: string) => nativeStorage.removeItem!(key),
    };
  }

  if (nativeStorage.multiGet && nativeStorage.multiSet && nativeStorage.multiRemove) {
    return {
      getItem: (key: string) =>
        new Promise((resolve, reject) => {
          nativeStorage.multiGet!([key], (errors, result) => {
            if (errors?.length) {
              reject(errors[0]);
              return;
            }
            resolve(result?.[0]?.[1] ?? null);
          });
        }),
      setItem: (key: string, value: string) =>
        new Promise((resolve, reject) => {
          nativeStorage.multiSet!([[key, value]], (errors) => {
            if (errors?.length) {
              reject(errors[0]);
              return;
            }
            resolve();
          });
        }),
      removeItem: (key: string) =>
        new Promise((resolve, reject) => {
          nativeStorage.multiRemove!([key], (errors) => {
            if (errors?.length) {
              reject(errors[0]);
              return;
            }
            resolve();
          });
        }),
    };
  }

  throw new Error('Unsupported native AsyncStorage module shape');
}

function resolveNativeAsyncStorage(): AsyncStorageLike | null {
  const turboStorage = TurboModuleRegistry
    ? (TurboModuleRegistry.get('PlatformLocalStorage') ||
        TurboModuleRegistry.get('RNC_AsyncSQLiteDBStorage') ||
        TurboModuleRegistry.get('RNCAsyncStorage') ||
        TurboModuleRegistry.get('AsyncSQLiteDBStorage') ||
        TurboModuleRegistry.get('AsyncLocalStorage'))
    : null;

  const legacyStorage =
    NativeModules.PlatformLocalStorage ||
    NativeModules.RNC_AsyncSQLiteDBStorage ||
    NativeModules.RNCAsyncStorage ||
    NativeModules.AsyncSQLiteDBStorage ||
    NativeModules.AsyncLocalStorage;

  const resolved = (turboStorage ?? legacyStorage ?? null) as NativeAsyncStorageLike | null;
  return resolved ? wrapNativeAsyncStorage(resolved) : null;
}

function getAsyncStorage(): AsyncStorageLike | null {
  if (asyncStorageRef !== undefined) {
    return asyncStorageRef;
  }

  const nativeStorage = resolveNativeAsyncStorage();
  if (nativeStorage) {
    asyncStorageRef = nativeStorage;
    return asyncStorageRef;
  }

  try {
    // Lazy require so the app can still boot even if the native module is absent.
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const mod = require('@react-native-async-storage/async-storage');
    asyncStorageRef = (mod?.default ?? mod) as AsyncStorageLike;
  } catch {
    asyncStorageRef = null;
  }

  return asyncStorageRef;
}

function isAsyncStorageUnavailableError(error: unknown): boolean {
  return error instanceof Error && error.message.includes('Native Module: AsyncStorage is null');
}

export const localStorage: AsyncStorageLike = {
  async getItem(key: string) {
    let stored: string | null = null;
    try {
      const storage = getAsyncStorage();
      stored = storage ? await storage.getItem(key) : memoryStore.has(key) ? memoryStore.get(key)! : null;
    } catch (error) {
      if (isAsyncStorageUnavailableError(error)) {
        stored = memoryStore.has(key) ? memoryStore.get(key)! : null;
      } else {
        throw error;
      }
    }
    if (stored == null) {
      return null;
    }

    if (!stored.startsWith(ENCRYPTED_PREFIX)) {
      return stored;
    }

    const encryptedPayload = stored.slice(ENCRYPTED_PREFIX.length);
    return decryptStoredValue(encryptedPayload);
  },
  async setItem(key: string, value: string) {
    const payload = isSecureStorageBridgeAvailable()
      ? `${ENCRYPTED_PREFIX}${await encryptStoredValue(value)}`
      : value;
    try {
      const storage = getAsyncStorage();
      if (!storage) {
        memoryStore.set(key, payload);
        return;
      }
      await storage.setItem(key, payload);
    } catch (error) {
      if (isAsyncStorageUnavailableError(error)) {
        memoryStore.set(key, payload);
        return;
      }
      throw error;
    }
  },
  async removeItem(key: string) {
    try {
      const storage = getAsyncStorage();
      if (!storage) {
        memoryStore.delete(key);
        return;
      }
      await storage.removeItem(key);
    } catch (error) {
      if (isAsyncStorageUnavailableError(error)) {
        memoryStore.delete(key);
        return;
      }
      throw error;
    }
  },
};
