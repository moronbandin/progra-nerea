import { create } from "zustand";

export type SaveState = "saved" | "saving" | "pending" | "error";

interface UiState {
  saveState: SaveState;
  setSaveState: (state: SaveState) => void;
}

export const useUiStore = create<UiState>((set) => ({
  saveState: "saved",
  setSaveState: (saveState) => set({ saveState })
}));
