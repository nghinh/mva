import {localStorage as AsyncStorage} from '../utils/localStorage';
import {create} from 'zustand';
import {createJSONStorage, persist} from 'zustand/middleware';

interface SettingsState {
  developerMode: boolean;
  setDeveloperMode: (enabled: boolean) => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      developerMode: false,
      setDeveloperMode: (enabled) => set({developerMode: enabled}),
    }),
    {
      name: 'vibevoice-settings-store',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        developerMode: state.developerMode,
      }),
    }
  )
);

export const useDeveloperMode = () => useSettingsStore((state) => state.developerMode);
