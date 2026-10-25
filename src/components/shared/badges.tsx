import { Globe, Sparkles } from "lucide-react";
import { ORIGIN_BADGE, ORIGIN_SHORT } from "@/lib/constants";
import { cn } from "@/lib/utils";

export function OriginBadge({ origin, page, className }: { origin: string; page?: string | null; className?: string }) {
  let path: string | null = null;
  if (page) {
    try {
      path = new URL(page).pathname;
    } catch {
      path = page;
    }
  }
  return (
    <span className={cn("inline-flex max-w-full flex-col gap-0.5", className)}>
      <span className={cn("inline-flex w-fit items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset", ORIGIN_BADGE[origin] ?? ORIGIN_BADGE.MANUAL)}>
        {origin === "SEO_ORGANICO" && <Globe className="h-3 w-3" />}
        {ORIGIN_SHORT[origin] ?? origin}
      </span>
      {path && origin === "SEO_ORGANICO" && (
        <span className="truncate text-[10px] text-muted-foreground" title={page ?? undefined}>
          ↳ {path.length > 34 ? `${path.slice(0, 34)}…` : path}
        </span>
      )}
    </span>
  );
}

export function StageDot({ color }: { color: string }) {
  return <span className="inline-block h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: color }} />;
}

export function AiBadge({ name = "Téo", className }: { name?: string; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full bg-gradient-to-r from-primary/10 to-secondary/10 px-2 py-0.5 text-[10px] font-semibold text-secondary ring-1 ring-inset ring-secondary/20", className)}>
      <Sparkles className="h-3 w-3" /> {name}
    </span>
  );
}

export function TagChip({ tag, onRemove }: { tag: string; onRemove?: () => void }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-1.5 py-0.5 text-[11px] font-medium text-slate-600">
      #{tag}
      {onRemove && (
        <button onClick={onRemove} className="text-slate-400 hover:text-slate-700" aria-label={`Remover ${tag}`}>
          ×
        </button>
      )}
    </span>
  );
}
