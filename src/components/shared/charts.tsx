import { cn } from "@/lib/utils";

/** Gráfico de colunas simples (sem dependências) com tooltip nativo. */
export function ColumnChart({ data, height = 160, className, color = "rgb(var(--primary))", secondary }: { data: { label: string; value: number; value2?: number }[]; height?: number; className?: string; color?: string; secondary?: string }) {
  const max = Math.max(1, ...data.map((d) => d.value));
  return (
    <div className={cn("flex items-end gap-[3px]", className)} style={{ height }}>
      {data.map((d, i) => (
        <div key={i} className="group relative flex h-full flex-1 flex-col justify-end" title={`${d.label}: ${d.value}${d.value2 !== undefined ? ` (${d.value2})` : ""}`}>
          <div className="relative w-full rounded-t-sm transition-opacity group-hover:opacity-80" style={{ height: `${(d.value / max) * 100}%`, backgroundColor: color, minHeight: d.value ? 2 : 0 }}>
            {secondary && d.value2 ? <div className="absolute bottom-0 w-full rounded-t-sm" style={{ height: `${(d.value2 / Math.max(1, d.value)) * 100}%`, backgroundColor: secondary }} /> : null}
          </div>
        </div>
      ))}
    </div>
  );
}

export function HBar({ label, value, max, suffix, color = "rgb(var(--primary))" }: { label: React.ReactNode; value: number; max: number; suffix?: React.ReactNode; color?: string }) {
  return (
    <div>
      <div className="mb-1 flex justify-between gap-2 text-xs">
        <span className="truncate font-medium">{label}</span>
        <span className="shrink-0 text-muted-foreground">{suffix ?? value}</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-slate-100">
        <div className="h-full rounded-full" style={{ width: `${max ? (value / max) * 100 : 0}%`, backgroundColor: color }} />
      </div>
    </div>
  );
}
