type AsyncStorageLike = {
  getItem: (key: string) => Promise<string | null>;
  setItem: (key: string, value: string) => Promise<void>;
  removeItem: (key: string) => Promise<void>;
};

const memoryStore = new Map<string, string>();

export const localStorage: AsyncStorageLike = {
  async getItem(key: string) {
    return memoryStore.has(key) ? memoryStore.get(key)! : null;
  },
  async setItem(key: string, value: string) {
    memoryStore.set(key, value);
  },
  async removeItem(key: string) {
    memoryStore.delete(key);
  },
};
