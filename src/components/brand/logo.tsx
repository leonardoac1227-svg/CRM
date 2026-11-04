"use client";
import { useId } from "react";
import { cn } from "@/lib/utils";

/** Símbolo do Ápice: o "<" e as barras subindo, em dourado (inspirado na marca CRAP Digital). */
export function ApiceMark({ size = 36, className }: { size?: number; className?: string }) {
  const id = useId().replace(/:/g, "");
  return (
    <svg width={size} height={size} viewBox="0 0 60 60" aria-hidden="true" className={cn("shrink-0", className)}>
      <defs>
        <linearGradient id={`g${id}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#F0D9A0" />
          <stop offset="0.5" stopColor="#C9A35B" />
          <stop offset="1" stopColor="#8E6A2E" />
        </linearGradient>
      </defs>
      <path d="M32 6 L10 30 L32 54" fill="none" stroke={`url(#g${id})`} strokeWidth="8" strokeLinejoin="round" strokeLinecap="round" />
      <path d="M30 42 V34 M39 42 V27 M48 42 V18" fill="none" stroke={`url(#g${id})`} strokeWidth="6" strokeLinecap="round" />
    </svg>
  );
}

export function ApiceWordmark({ by, className, compact }: { by?: string | null; className?: string; compact?: boolean }) {
  return (
    <span className={cn("flex min-w-0 flex-col leading-none", className)}>
      <span className={cn("font-display font-semibold tracking-[0.16em] text-gold", compact ? "text-lg" : "text-[22px]")}>ÁPICE</span>
      <span className="mt-1 truncate text-[9.5px] font-bold uppercase tracking-[0.28em] text-sidebar-muted">by {by || "CRAP Digital"}</span>
    </span>
  );
}
