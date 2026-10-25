"use client";
import { create } from "zustand";

type UiState = {
  commandOpen: boolean;
  setCommandOpen: (v: boolean) => void;
  contactDrawerId: string | null;
  openContact: (id: string | null) => void;
  activeChannelId: string | null;
  setActiveChannelId: (id: string | null) => void;
};

export const useUi = create<UiState>((set) => ({
  commandOpen: false,
  setCommandOpen: (v) => set({ commandOpen: v }),
  contactDrawerId: null,
  openContact: (id) => set({ contactDrawerId: id }),
  activeChannelId: null,
  setActiveChannelId: (id) => set({ activeChannelId: id }),
}));
