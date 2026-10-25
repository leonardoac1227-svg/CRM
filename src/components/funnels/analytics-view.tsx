"use client";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Megaphone, Trophy } from "lucide-react";
import { api, qs } from "@/lib/client";
import { cn, formatBRL, formatPercent } from "@/lib/utils";
import { Avatar, Card, CardHeader, Skeleton } from "@/components/ui/misc";

type Analytics = {
  total: number;
  stages: { id: string; name: string; color: string; count: number; value: number; percent: number }[];
  matrix: { userId: string | null; name: string; cells: number[]; total: number }[];
  maxCell: number;
  ranking: { position: number; userId: string; name: string; received: number; visits: number; proposals: number; won: number; value: number; conversion: number }[];
};

export type FunnelFilters = { period: string; status: string; userId: string; origin: string };

export function AnalyticsView({ pipelineId, filters, canCampaign }: { pipelineId: string; filters: FunnelFilters; canCampaign: boolean }) {
  const { data, isLoading } = useQuery({
    queryKey: ["analytics", pipelineId, filters],
    queryFn: () => api<Analytics>(`/api/pipelines/${pipelineId}/analytics${qs(filters)}`),
  });
  if (isLoading || !data) return <div className="space-y-4"><Skeleton className="h-48" /><Skeleton className="h-64" /></div>;
  const cellColor = (v: number) => {
    if (!v) return "transparent";
    const a = 0.08 + (v / data.maxCell) * 0.55;
    return `rgb(var(--secondary) / ${a.toFixed(2)})`;
  };
  return (
    <div className="space-y-5">
      <Card>
        <CardHeader title="Distribuição atual por etapa" description={`${data.total} leads no funil com os filtros aplicados`} />
        <div className="p-5">
          <div className="flex h-4 w-full overflow-hidden rounded-full bg-slate-100">
            {data.stages.map((s) => s.count > 0 && <div key={s.id} title={`${s.name}: ${s.count}`} style={{ width: `${s.percent}%`, backgroundColor: s.color }} className="h-full transition-all first:rounded-l-full last:rounded-r-full" />)}
          </div>
          <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4 xl:grid-cols-7">
            {data.stages.map((s) => (
              <div key={s.id} className="rounded-lg border p-3">
                <p className="flex items-center gap-1.5 truncate text-xs font-medium text-slate-600"><span className="h-2 w-2 rounded-full" style={{ backgroundColor: s.color }} /> {s.name}</p>
                <p className="mt-2 text-2xl font-semibold">{s.count}</p>
                <p className="text-xs text-muted-foreground">{formatPercent(s.percent, 1)}{s.value ? ` · ${formatBRL(s.value, { compact: true })}` : ""}</p>
                {canCampaign && s.count > 0 && (
                  <Link href={`/campanhas?novo=1&pipeline=${pipelineId}&stage=${s.id}`} className="mt-2 flex items-center gap-1 text-[11px] font-medium text-primary hover:underline">
                    <Megaphone className="h-3 w-3" /> Criar campanha para esta etapa
                  </Link>
                )}
              </div>
            ))}
          </div>
        </div>
      </Card>

      <Card className="overflow-hidden">
        <CardHeader title="Leads por usuário e etapa" description="Onde está a carteira de cada corretor" />
        <div className="overflow-x-auto">
          <table className="w-full min-w-[800px] text-sm">
            <thead className="bg-slate-50 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-2.5 text-left">Usuário</th>
                {data.stages.map((s) => <th key={s.id} className="px-2 py-2.5 text-center">{s.name}</th>)}
                <th className="px-4 py-2.5 text-center">Total</th>
              </tr>
            </thead>
            <tbody>
              {data.matrix.map((r) => {
                const isTotal = r.userId === "total";
                return (
                  <tr key={r.userId ?? "none"} className={cn("border-t", isTotal && "bg-slate-50 font-semibold")}>
                    <td className="whitespace-nowrap px-4 py-2">
                      <span className="flex items-center gap-2">{!isTotal && <Avatar name={r.name} size={22} />} <span className={cn(r.userId === null && "italic text-muted-foreground")}>{r.name}</span></span>
                    </td>
                    {r.cells.map((v, i) => (
                      <td key={i} className="px-1 py-1 text-center">
                        <span className={cn("block rounded-md py-1.5 text-xs", v ? "font-medium" : "text-slate-300")} style={{ backgroundColor: isTotal ? undefined : cellColor(v) }}>{v}</span>
                      </td>
                    ))}
                    <td className="px-4 py-2 text-center text-sm font-semibold">{r.total}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      <Card className="overflow-hidden">
        <CardHeader title="Ranking de corretores" description="Considera a etapa atual de cada lead recebido" />
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-sm">
            <thead className="bg-slate-50 text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-2.5">#</th><th className="px-3 py-2.5">Corretor</th><th className="px-3 py-2.5 text-right">Leads recebidos</th><th className="px-3 py-2.5 text-right">Visitas</th>
                <th className="px-3 py-2.5 text-right">Propostas</th><th className="px-3 py-2.5 text-right">Vendas</th><th className="px-3 py-2.5 text-right">Valor gerado</th><th className="px-4 py-2.5 text-right">Conversão</th>
              </tr>
            </thead>
            <tbody>
              {data.ranking.map((r) => (
                <tr key={r.userId} className="border-t">
                  <td className="px-4 py-2.5">
                    {r.position <= 3 ? <span className={cn("flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold text-white", r.position === 1 ? "bg-amber-400" : r.position === 2 ? "bg-slate-400" : "bg-orange-400")}>{r.position === 1 ? <Trophy className="h-3.5 w-3.5" /> : r.position}</span> : <span className="pl-2 text-xs text-muted-foreground">{r.position}</span>}
                  </td>
                  <td className="px-3 py-2.5"><span className="flex items-center gap-2"><Avatar name={r.name} size={26} /> <span className="font-medium">{r.name}</span></span></td>
                  <td className="px-3 py-2.5 text-right">{r.received}</td>
                  <td className="px-3 py-2.5 text-right">{r.visits}</td>
                  <td className="px-3 py-2.5 text-right">{r.proposals}</td>
                  <td className="px-3 py-2.5 text-right font-semibold">{r.won}</td>
                  <td className="px-3 py-2.5 text-right">{formatBRL(r.value)}</td>
                  <td className="px-4 py-2.5 text-right">
                    <span className="inline-flex items-center gap-2">
                      <span className="hidden h-1.5 w-16 overflow-hidden rounded-full bg-slate-100 sm:block"><span className="block h-full rounded-full bg-success" style={{ width: `${Math.min(100, r.conversion)}%` }} /></span>
                      {formatPercent(r.conversion, 1)}
                    </span>
                  </td>
                </tr>
              ))}
              {!data.ranking.length && <tr><td colSpan={8} className="px-4 py-8 text-center text-xs text-muted-foreground">Sem dados para os filtros.</td></tr>}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
