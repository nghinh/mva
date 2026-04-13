import AsyncStorage from '@react-native-async-storage/async-storage';

export const preferencesStorage = {
  getItem: (key: string) => AsyncStorage.getItem(key),
  setItem: (key: string, value: string) => AsyncStorage.setItem(key, value),
  deleteItem: (key: string) => AsyncStorage.removeItem(key),
};
