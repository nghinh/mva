import { create } from 'zustand';

type ExampleStore = {
  selectedId?: string;
  setSelectedId: (value?: string) => void;
};

export const useExampleStore = create<ExampleStore>((set) => ({
  selectedId: undefined,
  setSelectedId: (value) => set({ selectedId: value }),
}));
