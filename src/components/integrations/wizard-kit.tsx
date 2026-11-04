"use client";
import { useState } from "react";
import { toast } from "sonner";
import { Check, Copy, ExternalLink, Info, TriangleAlert } from "lucide-react";
import { cn } from "@/lib/utils";

/** Barra de progresso dos passos do assistente. */
export function StepRail({ steps, current, onJump }: { steps: string[]; current: number; onJump?: (i: number) => void }) {
  return (
    <ol className="flex gap-1.5" aria-label="Passos">
      {steps.map((s, i) => (
        <li key={s} className="min-w-0 flex-1">
          <button
            type="button"
            disabled={!onJump || i > current}
            onClick={() => onJump?.(i)}
            className="group block w-full text-left disabled:cursor-default"
            aria-current={i === current ? "step" : undefined}
          >
            <span className={cn("block h-1.5 rounded-full transition-colors", i < current ? "bg-primary" : i === current ? "bg-gradient-to-r from-primary to-secondary" : "bg-muted")} />
            <span className={cn("mt-1.5 hidden truncate text-[10.5px] font-bold sm:block", i === current ? "text-foreground" : "text-muted-foreground")}>
              {i + 1}. {s}
            </span>
          </button>
        </li>
      ))}
    </ol>
  );
}

/** Um passo numerado de instrução ("faça isto, depois aquilo"). */
export function Instruction({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <li className="flex gap-3">
      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/15 text-[11px] font-extrabold text-primary dark:text-secondary">{n}</span>
      <div className="min-w-0 flex-1 pt-0.5 text-[13.5px] leading-relaxed text-foreground/85">{children}</div>
    </li>
  );
}

export function Instructions({ items }: { items: React.ReactNode[] }) {
  return <ol className="space-y-3">{items.map((it, i) => <Instruction key={i} n={i + 1}>{it}</Instruction>)}</ol>;
}

/** Nome de botão/menu da tela de outro site, destacado. */
export function Ui({ children }: { children: React.ReactNode }) {
  return <strong className="rounded-md border bg-muted/70 px-1.5 py-0.5 text-[12.5px] font-bold text-foreground">{children}</strong>;
}

export function ExtLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a href={href} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-bold text-primary underline-offset-2 hover:underline dark:text-secondary">
      {children} <ExternalLink className="h-3 w-3" />
    </a>
  );
}

/** Valor para o usuário copiar e colar em outro site. */
export function CopyField({ label, value, secret, mono = true }: { label: string; value: string; secret?: boolean; mono?: boolean }) {
  const [done, setDone] = useState(false);
  const [show, setShow] = useState(!secret);
  return (
    <div>
      <p className="mb-1 text-xs font-bold text-foreground/75">{label}</p>
      <div className="flex items-center gap-2 rounded-xl border bg-background p-1.5 pl-3">
        <code className={cn("min-w-0 flex-1 truncate text-[12.5px]", !mono && "font-sans")}>{show ? value : "•".repeat(Math.min(24, value.length))}</code>
        {secret && <button type="button" onClick={() => setShow(!show)} className="rounded-md px-2 py-1 text-[11px] font-bold text-muted-foreground hover:bg-muted">{show ? "Ocultar" : "Mostrar"}</button>}
        <button
          type="button"
          onClick={() => {
            navigator.clipboard.writeText(value);
            setDone(true);
            toast.success(`${label} copiado`);
            setTimeout(() => setDone(false), 1800);
          }}
          className={cn("flex h-8 items-center gap-1.5 rounded-lg px-3 text-xs font-extrabold transition-colors", done ? "bg-success text-white" : "bg-primary text-primary-foreground hover:brightness-110")}
        >
          {done ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />} {done ? "Copiado" : "Copiar"}
        </button>
      </div>
    </div>
  );
}

export function Callout({ tone = "info", title, children }: { tone?: "info" | "warn" | "ok"; title?: string; children: React.ReactNode }) {
  const cls = tone === "warn" ? "border-amber-200 bg-amber-500/10" : tone === "ok" ? "border-emerald-200 bg-emerald-500/10" : "border-primary/25 bg-primary/10";
  const Icon = tone === "warn" ? TriangleAlert : tone === "ok" ? Check : Info;
  const ic = tone === "warn" ? "text-amber-600" : tone === "ok" ? "text-emerald-600" : "text-primary dark:text-secondary";
  return (
    <div className={cn("flex gap-3 rounded-xl border p-3.5 text-[13px] leading-relaxed", cls)}>
      <Icon className={cn("mt-0.5 h-4 w-4 shrink-0", ic)} />
      <div className="min-w-0">
        {title && <p className="mb-0.5 font-extrabold">{title}</p>}
        <div className="text-foreground/85">{children}</div>
      </div>
    </div>
  );
}

/** Checklist "já tenho isto?" com caixas marcáveis. */
export function Checklist({ items, value, onChange }: { items: { key: string; label: React.ReactNode; hint?: React.ReactNode }[]; value: Record<string, boolean>; onChange: (v: Record<string, boolean>) => void }) {
  return (
    <div className="space-y-2">
      {items.map((i) => (
        <label key={i.key} className={cn("flex cursor-pointer gap-3 rounded-xl border p-3 transition-colors", value[i.key] ? "border-primary/50 bg-primary/5" : "hover:border-primary/30")}>
          <input type="checkbox" checked={!!value[i.key]} onChange={(e) => onChange({ ...value, [i.key]: e.target.checked })} className="mt-0.5 h-4 w-4 accent-[rgb(var(--primary))]" />
          <span className="text-[13.5px]">
            <span className="font-bold">{i.label}</span>
            {i.hint && <span className="mt-0.5 block text-xs text-muted-foreground">{i.hint}</span>}
          </span>
        </label>
      ))}
    </div>
  );
}
