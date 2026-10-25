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
    <div className="flex min-h-app">
      <aside className="hidden w-56 shrink-0 border-r bg-white p-3 md:block">
        <p className="mb-2 px-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Funis</p>
        {isLoading && <Skeleton className="h-20" />}
        {pipelines?.map((p) => (
          <button key={p.id} onClick={() => setPid(p.id)} className={cn("flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm font-medium", pid === p.id ? "bg-primary/10 text-primary" : "text-slate-600 hover:bg-muted")}>
            <span className="flex-1 truncate">{p.name}</span>
            {p.isDefault && <Star className="h-3 w-3 fill-amber-400 text-amber-400" />}
            <span className="text-[11px] text-muted-foreground">{p.contactsCount}</span>
          </button>
        ))}
        {isManager && <button onClick={() => setDialog("new")} className="mt-2 flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm font-medium text-primary hover:bg-primary/5"><Plus className="h-4 w-4" /> Novo funil</button>}
      </aside>

      <div className="min-w-0 flex-1 p-4 md:p-6">
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <Select value={pid ?? ""} onChange={(e) => setPid(e.target.value)} className="w-auto md:hidden">
            {pipelines?.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </Select>
          <h1 className="hidden text-xl font-semibold md:block">{pipeline?.name}</h1>
          {isManager && pipeline && (
            <>
              <Button size="icon-sm" variant="ghost" onClick={() => setDialog("edit")} title="Editar funil"><Pencil /></Button>
              {!pipeline.isDefault && <Button size="xs" variant="ghost" onClick={async () => { await api(`/api/pipelines/${pipeline.id}`, { method: "PATCH", body: { isDefault: true } }); qc.invalidateQueries({ queryKey: ["pipelines"] }); toast.success("Definido como padrão"); }}><Star /> Tornar padrão</Button>}
            </>
          )}
          <div className="ml-auto inline-flex rounded-lg bg-muted p-1">
            <button onClick={() => changeView("analise")} className={cn("flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium", view === "analise" ? "bg-white shadow-sm" : "text-muted-foreground")}><BarChart3 className="h-3.5 w-3.5" /> Análise</button>
            <button onClick={() => changeView("kanban")} className={cn("flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium", view === "kanban" ? "bg-white shadow-sm" : "text-muted-foreground")}><KanbanSquare className="h-3.5 w-3.5" /> Kanban</button>
          </div>
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
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar card…" className="h-9 w-52 rounded-md border bg-white pl-8 pr-3 text-sm outline-none focus:border-primary/50" />
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
