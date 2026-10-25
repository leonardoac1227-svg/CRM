import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function toNumber(v: unknown): number {
  if (v === null || v === undefined || v === "") return 0;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : 0;
}

const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const brlCompact = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", notation: "compact", maximumFractionDigits: 1 });

export function formatBRL(v: unknown, opts?: { compact?: boolean; decimals?: number }) {
  const n = toNumber(v);
  if (opts?.compact) return brlCompact.format(n);
  if (opts?.decimals !== undefined)
    return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: opts.decimals, maximumFractionDigits: opts.decimals }).format(n);
  return brl.format(n);
}

export function formatPercent(v: number, digits = 0) {
  return `${(Number.isFinite(v) ? v : 0).toFixed(digits).replace(".", ",")}%`;
}

/** Normaliza para E.164 sem "+" (padrão do WhatsApp). Assume Brasil (55) quando faltar DDI. */
export function normalizePhone(raw: string): string {
  let d = (raw || "").replace(/\D/g, "");
  if (!d) return "";
  if (d.startsWith("00")) d = d.slice(2);
  if (d.length === 10 || d.length === 11) d = `55${d}`;
  return d;
}

export function formatPhone(raw?: string | null): string {
  if (!raw) return "";
  const d = raw.replace(/\D/g, "");
  if (d.startsWith("55") && (d.length === 12 || d.length === 13)) {
    const ddd = d.slice(2, 4);
    const rest = d.slice(4);
    const a = rest.length === 9 ? rest.slice(0, 5) : rest.slice(0, 4);
    const b = rest.length === 9 ? rest.slice(5) : rest.slice(4);
    return `+55 (${ddd}) ${a}-${b}`;
  }
  return raw.startsWith("+") ? raw : `+${d}`;
}

export function firstName(name?: string | null): string {
  if (!name) return "";
  const n = name.trim().split(/\s+/)[0] ?? "";
  return n.charAt(0).toUpperCase() + n.slice(1).toLowerCase();
}

export function initials(name?: string | null): string {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? "") + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase() || "?";
}

export function timeAgo(date?: string | Date | null): string {
  if (!date) return "—";
  const d = typeof date === "string" ? new Date(date) : date;
  const diff = Date.now() - d.getTime();
  const m = Math.round(diff / 60000);
  if (m < 1) return "agora";
  if (m < 60) return `${m} min`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} h`;
  const days = Math.round(h / 24);
  if (days < 30) return `${days} d`;
  const months = Math.round(days / 30);
  return `${months} m`;
}

export function formatDate(date?: string | Date | null, withTime = false): string {
  if (!date) return "—";
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleString("pt-BR", withTime ? { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" } : { day: "2-digit", month: "2-digit", year: "numeric" });
}

export function chatTime(date?: string | Date | null): string {
  if (!date) return "";
  const d = typeof date === "string" ? new Date(date) : date;
  const now = new Date();
  if (d.toDateString() === now.toDateString()) return d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  const y = new Date(now);
  y.setDate(now.getDate() - 1);
  if (d.toDateString() === y.toDateString()) return "Ontem";
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}

export function slugify(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 512);
}

export function hexToRgbTriplet(hex: string): string {
  const h = hex.replace("#", "");
  const full = h.length === 3 ? h.split("").map((c) => c + c).join("") : h.padEnd(6, "0");
  const n = parseInt(full.slice(0, 6), 16);
  if (Number.isNaN(n)) return "37 99 235";
  return `${(n >> 16) & 255} ${(n >> 8) & 255} ${n & 255}`;
}

export function groupBy<T, K extends string | number>(arr: T[], key: (t: T) => K): Record<K, T[]> {
  return arr.reduce((acc, item) => {
    const k = key(item);
    (acc[k] ||= []).push(item);
    return acc;
  }, {} as Record<K, T[]>);
}
