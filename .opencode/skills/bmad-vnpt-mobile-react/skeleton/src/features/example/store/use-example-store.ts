import { create } from 'zustand';

type ExampleState = {
  selectedId?: string;
  setSelectedId: (selectedId?: string) => void;
};

export const useExampleStore = create<ExampleState>((set) => ({
  selectedId: undefined,
  setSelectedId: (selectedId) => set({ selectedId }),
}));
