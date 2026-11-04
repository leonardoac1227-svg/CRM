"use client";
import { useEffect } from "react";
import { create } from "zustand";

export type Theme = "dark" | "light";

type ThemeState = { theme: Theme; setTheme: (t: Theme) => void; toggle: () => void };

function apply(t: Theme) {
  if (typeof document === "undefined") return;
  document.documentElement.classList.toggle("dark", t === "dark");
  try {
    localStorage.setItem("apice-theme", t);
  } catch {
    /* navegação privada: segue só na sessão */
  }
}

export const useThemeStore = create<ThemeState>((set, get) => ({
  theme: "dark",
  setTheme: (t) => {
    apply(t);
    set({ theme: t });
  },
  toggle: () => get().setTheme(get().theme === "dark" ? "light" : "dark"),
}));

/** Sincroniza o estado com a classe aplicada pelo script do <head>. */
export function useTheme() {
  const s = useThemeStore();
  useEffect(() => {
    const current: Theme = document.documentElement.classList.contains("dark") ? "dark" : "light";
    if (current !== useThemeStore.getState().theme) useThemeStore.setState({ theme: current });
  }, []);
  return s;
}
