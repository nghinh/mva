const {jest: jestGlobal} = require('@jest/globals');

/**
 * AsyncStorage mock with IN-MEMORY PERSISTENCE across calls.
 * - getItem returns the last value set by setItem (within the same test)
 * - removeItem clears the key
 * This allows persistence service instances to share data correctly in tests.
 */
const asyncStorageStore = {};

jestGlobal.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jestGlobal.fn((key) => Promise.resolve(asyncStorageStore[key] ?? null)),
  setItem: jestGlobal.fn((key, value) => { asyncStorageStore[key] = value; return Promise.resolve(); }),
  removeItem: jestGlobal.fn((key) => { delete asyncStorageStore[key]; return Promise.resolve(); }),
}));

jestGlobal.mock('react-native-safe-area-context', () => ({
  SafeAreaProvider: ({ children }: { children: React.ReactNode }) => children,
  SafeAreaView: ({ children }: { children: React.ReactNode }) => children,
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

// Silence noisy animation warnings during tests
const originalWarn = console.warn;
console.warn = (...args) => {
  if (typeof args[0] === 'string' && args[0].includes('Animated: `useNativeDriver`')) {
    return;
  }
  originalWarn.call(console, ...args);
};
