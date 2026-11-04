"use client";
import { create } from "zustand";

type UiState = {
  commandOpen: boolean;
  setCommandOpen: (v: boolean) => void;
  contactDrawerId: string | null;
  openContact: (id: string | null) => void;
  activeChannelId: string | null;
  setActiveChannelId: (id: string | null) => void;
  sidebarCollapsed: boolean;
  setSidebarCollapsed: (v: boolean) => void;
  mobileNavOpen: boolean;
  setMobileNavOpen: (v: boolean) => void;
};

export function readCollapsed() {
  try {
    return typeof window !== "undefined" && localStorage.getItem("apice-sidebar") === "1";
  } catch {
    return false;
  }
}

export const useUi = create<UiState>((set) => ({
  commandOpen: false,
  setCommandOpen: (v) => set({ commandOpen: v }),
  contactDrawerId: null,
  openContact: (id) => set({ contactDrawerId: id }),
  activeChannelId: null,
  setActiveChannelId: (id) => set({ activeChannelId: id }),
  sidebarCollapsed: false,
  setSidebarCollapsed: (v) => {
    try {
      localStorage.setItem("apice-sidebar", v ? "1" : "0");
    } catch {
      /* sem storage: vale só nesta sessão */
    }
    set({ sidebarCollapsed: v });
  },
  mobileNavOpen: false,
  setMobileNavOpen: (v) => set({ mobileNavOpen: v }),
}));
