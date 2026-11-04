import * as React from "react";
import { cn, initials } from "@/lib/utils";

export function Badge({ className, tone = "slate", ...props }: React.HTMLAttributes<HTMLSpanElement> & { tone?: "slate" | "blue" | "green" | "amber" | "red" | "violet" | "primary" }) {
  const tones = {
    slate: "bg-muted text-foreground/80 ring-border",
    blue: "bg-blue-50 text-blue-700 ring-blue-200",
    green: "bg-emerald-50 text-emerald-700 ring-emerald-200",
    amber: "bg-amber-50 text-amber-700 ring-amber-200",
    red: "bg-red-50 text-red-700 ring-red-200",
    violet: "bg-violet-50 text-violet-700 ring-violet-200",
    primary: "bg-primary/10 text-primary ring-primary/25 dark:text-secondary",
  };
  return <span className={cn("inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset", tones[tone], className)} {...props} />;
}

export function Card({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("rounded-xl border bg-card shadow-[0_1px_0_rgb(255_255_255/0.03)_inset,0_8px_24px_-16px_rgb(0_0_0/0.35)]", className)} {...props} />;
}

export function CardHeader({ title, description, actions, className }: { title: React.ReactNode; description?: React.ReactNode; actions?: React.ReactNode; className?: string }) {
  return (
    <div className={cn("flex items-start justify-between gap-4 border-b px-5 py-4", className)}>
      <div>
        <h3 className="text-sm font-bold">{title}</h3>
        {description && <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>}
      </div>
      {actions}
    </div>
  );
}

const AVATAR_COLORS = ["bg-amber-100 text-amber-800", "bg-sky-100 text-sky-800", "bg-emerald-100 text-emerald-800", "bg-violet-100 text-violet-800", "bg-rose-100 text-rose-800", "bg-cyan-100 text-cyan-800", "bg-orange-100 text-orange-800"];

export function Avatar({ name, size = 36, className }: { name?: string | null; size?: number; className?: string }) {
  const code = (name ?? "?").split("").reduce((a, c) => a + c.charCodeAt(0), 0);
  return (
    <span
      className={cn("inline-flex shrink-0 select-none items-center justify-center rounded-full font-bold", AVATAR_COLORS[code % AVATAR_COLORS.length], className)}
      style={{ width: size, height: size, fontSize: Math.max(10, size * 0.36) }}
    >
      {initials(name)}
    </span>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-lg bg-muted", className)} />;
}

export function EmptyState({ icon, title, description, action, className }: { icon?: React.ReactNode; title: string; description?: string; action?: React.ReactNode; className?: string }) {
  return (
    <div className={cn("flex flex-col items-center justify-center px-6 py-14 text-center", className)}>
      {icon && <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-2xl border border-primary/25 bg-primary/10 text-primary dark:text-secondary">{icon}</div>}
      <p className="text-sm font-bold">{title}</p>
      {description && <p className="mt-1 max-w-sm text-xs text-muted-foreground">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function PageHeader({ title, description, actions, eyebrow, icon, className }: { title: React.ReactNode; description?: React.ReactNode; actions?: React.ReactNode; eyebrow?: string; icon?: React.ReactNode; className?: string }) {
  return (
    <div className={cn("mb-6 flex flex-wrap items-end justify-between gap-4 animate-rise", className)}>
      <div className="flex min-w-0 items-center gap-4">
        {icon && (
          <span className="hidden h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-primary/25 bg-primary/10 text-primary dark:text-secondary sm:flex [&_svg]:h-6 [&_svg]:w-6">
            {icon}
          </span>
        )}
        <div className="min-w-0">
          {eyebrow && <p className="eyebrow mb-1">{eyebrow}</p>}
          <h1 className="display text-[28px] leading-none sm:text-[32px]">{title}</h1>
          {description && <p className="mt-2 max-w-2xl text-sm text-muted-foreground">{description}</p>}
        </div>
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function Stat({ label, value, hint, icon, className }: { label: string; value: React.ReactNode; hint?: React.ReactNode; icon?: React.ReactNode; className?: string }) {
  return (
    <Card className={cn("card-hover relative overflow-hidden p-5", className)}>
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-bold text-muted-foreground">{label}</p>
        {icon && <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary dark:text-secondary [&_svg]:h-4 [&_svg]:w-4">{icon}</span>}
      </div>
      <p className="mt-2 font-display text-[32px] font-semibold leading-none tracking-tight">{value}</p>
      {hint && <p className="mt-2 text-xs font-medium text-muted-foreground">{hint}</p>}
    </Card>
  );
}

export function Kbd({ children }: { children: React.ReactNode }) {
  return <kbd className="rounded border bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">{children}</kbd>;
}
