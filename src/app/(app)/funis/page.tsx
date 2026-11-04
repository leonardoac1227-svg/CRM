"use client";
import { Suspense, useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { BarChart3, KanbanSquare, Pencil, Plus, Search, Star } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/client";
import { ORIGIN_LABELS } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { useCan, usePipelines, useTeam } from "@/hooks/use-me";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/misc";
import { AnalyticsView, type FunnelFilters } from "@/components/funnels/analytics-view";
import { KanbanView } from "@/components/funnels/kanban-view";
import { PipelineDialog } from "@/components/funnels/pipeline-dialog";

function Funis() {
  const qc = useQueryClient();
  const { data: pipelines, isLoading } = usePipelines();
  const { data: team } = useTeam();
  const { isManager, can, me } = useCan();
  const [pid, setPid] = useState<string | null>(null);
  const [view, setView] = useState<"analise" | "kanban">("analise");
  const [filters, setFilters] = useState<FunnelFilters>({ period: "all", status: "", userId: "", origin: "" });
  const [q, setQ] = useState("");
  const [dialog, setDialog] = useState<"new" | "edit" | null>(null);

  useEffect(() => {
    try {
      const v = localStorage.getItem("funis:view");
      if (v === "kanban" || v === "analise") setView(v);
    } catch {}
  }, []);
  useEffect(() => { if (!pid && pipelines?.length) setPid(pipelines.find((p) => p.isDefault)?.id ?? pipelines[0].id); }, [pipelines, pid]);
  const pipeline = pipelines?.find((p) => p.id === pid) ?? null;
  const setF = (k: keyof FunnelFilters) => (e: React.ChangeEvent<HTMLSelectElement>) => setFilters({ ...filters, [k]: e.target.value });
  const changeView = (v: "analise" | "kanban") => {
    setView(v);
    try { localStorage.setItem("funis:view", v); } catch {}
  };

  return (
    <div className="min-h-app">
      <div className="min-w-0 px-4 py-6 md:px-8 md:py-8">
        <div className="mb-4 flex flex-wrap items-center gap-3 animate-rise">
          <span className="hidden h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-primary/25 bg-primary/10 text-primary dark:text-secondary sm:flex"><KanbanSquare className="h-6 w-6" /></span>
          <div className="min-w-0">
            <p className="eyebrow mb-1">Vender · Funis</p>
            <h1 className="display text-[28px] leading-none sm:text-[32px]">{pipeline?.name ?? "Funis"}</h1>
          </div>
          {isManager && pipeline && (
            <>
              <Button size="icon-sm" variant="ghost" onClick={() => setDialog("edit")} title="Editar funil"><Pencil /></Button>
              {!pipeline.isDefault && <Button size="xs" variant="ghost" onClick={async () => { await api(`/api/pipelines/${pipeline.id}`, { method: "PATCH", body: { isDefault: true } }); qc.invalidateQueries({ queryKey: ["pipelines"] }); toast.success("Definido como padrão"); }}><Star /> Tornar padrão</Button>}
            </>
          )}
          <div className="ml-auto inline-flex rounded-xl border bg-card p-1">
            <button onClick={() => changeView("analise")} className={cn("flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-xs font-bold transition-colors", view === "analise" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground")}><BarChart3 className="h-3.5 w-3.5" /> Análise</button>
            <button onClick={() => changeView("kanban")} className={cn("flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-xs font-bold transition-colors", view === "kanban" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground")}><KanbanSquare className="h-3.5 w-3.5" /> Kanban</button>
          </div>
        </div>
        <div className="mb-4 flex gap-1.5 overflow-x-auto pb-1 scrollbar-thin">
          {isLoading && <Skeleton className="h-9 w-64" />}
          {pipelines?.map((p) => (
            <button key={p.id} onClick={() => setPid(p.id)} className={cn("flex shrink-0 items-center gap-2 rounded-full border px-4 py-2 text-[13px] font-bold transition-colors", pid === p.id ? "border-primary bg-primary text-primary-foreground" : "bg-card text-foreground/75 hover:border-primary/50")}>
              {p.isDefault && <Star className={cn("h-3 w-3", pid === p.id ? "fill-current" : "fill-amber-400 text-amber-400")} />}
              {p.name}
              <span className={cn("rounded-full px-1.5 text-[10px] font-extrabold", pid === p.id ? "bg-black/15" : "bg-muted")}>{p.contactsCount}</span>
            </button>
          ))}
          {isManager && <button onClick={() => setDialog("new")} className="flex shrink-0 items-center gap-1.5 rounded-full border border-dashed border-primary/50 px-4 py-2 text-[13px] font-bold text-primary hover:bg-primary/10 dark:text-secondary"><Plus className="h-4 w-4" /> Novo funil</button>}
        </div>
        <div className="mb-5 flex flex-wrap items-center gap-2">
          {view === "analise" && (
            <Select value={filters.period} onChange={setF("period")} className="w-auto">
              <option value="all">Todo o período</option>
              <option value="7">Últimos 7 dias</option>
              <option value="30">Últimos 30 dias</option>
              <option value="90">Últimos 90 dias</option>
            </Select>
          )}
          <Select value={filters.status} onChange={setF("status")} className="w-auto">
            <option value="">Todos os status</option>
            <option value="OPEN">Em aberto</option>
            <option value="WON">Ganhos</option>
            <option value="LOST">Perdidos</option>
          </Select>
          {!me?.seesOnlyOwn && (
            <Select value={filters.userId} onChange={setF("userId")} className="w-auto">
              <option value="">Todos os usuários</option>
              <option value="none">Sem responsável</option>
              {team?.filter((u) => u.isActive).map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
            </Select>
          )}
          <Select value={filters.origin} onChange={setF("origin")} className={cn("w-auto", filters.origin === "SEO_ORGANICO" && "border-emerald-400 bg-emerald-50 text-emerald-800")}>
            <option value="">Todas as origens</option>
            {Object.entries(ORIGIN_LABELS).map(([k, v]) => <option key={k} value={k}>{k === "SEO_ORGANICO" ? "🌐 " : ""}{v}</option>)}
          </Select>
          {view === "kanban" && (
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar card…" className="h-9 w-52 rounded-md border bg-card pl-8 pr-3 text-sm outline-none focus:border-primary/50" />
            </div>
          )}
          {filters.origin === "SEO_ORGANICO" && <span className="text-xs font-medium text-emerald-700">Mostrando apenas leads do Google Orgânico — o ROI do seu SEO.</span>}
        </div>
        {pipeline && (view === "analise" ? <AnalyticsView pipelineId={pipeline.id} filters={filters} canCampaign={can("campanhas")} /> : <KanbanView pipelineId={pipeline.id} filters={filters} q={q} />)}
      </div>
      <PipelineDialog
        open={!!dialog}
        onOpenChange={(o) => !o && setDialog(null)}
        pipeline={dialog === "edit" ? pipeline : null}
        onSaved={(id) => { qc.invalidateQueries({ queryKey: ["pipelines"] }); qc.invalidateQueries({ queryKey: ["board"] }); qc.invalidateQueries({ queryKey: ["analytics"] }); setPid(id); }}
      />
    </div>
  );
}

export default function Page() {
  return (
    <Suspense>
      <Funis />
    </Suspense>
  );
}
