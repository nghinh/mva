import {
  decryptStoredValue,
  encryptStoredValue,
  isSecureStorageBridgeAvailable,
} from '../../native/SecureStorageBridge';

type AsyncStorageLike = {
  getItem: (key: string) => Promise<string | null>;
  setItem: (key: string, value: string) => Promise<void>;
  removeItem: (key: string) => Promise<void>;
};

const ENCRYPTED_PREFIX = 'enc:v1:';
const memoryStore = new Map<string, string>();

let asyncStorageRef: AsyncStorageLike | null | undefined;

function getAsyncStorage(): AsyncStorageLike | null {
  if (asyncStorageRef !== undefined) {
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
