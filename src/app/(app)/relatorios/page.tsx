"use client";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Bot, Clock, MessageSquare, Target, TrendingUp, Trophy, Users, XCircle } from "lucide-react";
import { api } from "@/lib/client";
import { ORIGIN_LABELS } from "@/lib/constants";
import { formatBRL, formatPercent } from "@/lib/utils";
import { useMe } from "@/hooks/use-me";
import { Select } from "@/components/ui/input";
import { Card, CardHeader, PageHeader, Skeleton, Stat } from "@/components/ui/misc";
import { ColumnChart, HBar } from "@/components/shared/charts";

type Reports = {
  days: number;
  kpis: { newLeads: number; won: number; wonValue: number; lost: number; conversations: number; aiQualified: number; aiQualificationRate: number; avgFirstResponseMinutes: number | null };
  byOrigin: { origin: string; leads: number }[];
  daily: { day: string; leads: number; seo: number }[];
  messages: { senderType: string; count: number }[];
  campaigns: { id: string; name: string; status: string; totalRecipients: number; sentCount: number; repliedCount: number; estimatedCost: number }[];
};

const SENDER: Record<string, string> = { CONTACT: "Clientes", USER: "Equipe", AI_AGENT: "IA", SYSTEM: "Campanhas/Sistema" };

export default function Relatorios() {
  const { data: me } = useMe();
  const [days, setDays] = useState("30");
  const { data } = useQuery({ queryKey: ["reports", days], queryFn: () => api<Reports>(`/api/reports?days=${days}`) });
  const k = data?.kpis;
  const maxOrigin = Math.max(1, ...(data?.byOrigin.map((o) => o.leads) ?? [1]));
  const totalMsgs = data?.messages.reduce((a, m) => a + m.count, 0) ?? 0;
  return (
    <div className="mx-auto max-w-7xl px-4 py-6">
      <PageHeader title="Relatórios" description={`Visão geral de ${me?.workspace.name ?? ""}`} actions={<Select value={days} onChange={(e) => setDays(e.target.value)} className="w-auto"><option value="7">Últimos 7 dias</option><option value="30">Últimos 30 dias</option><option value="90">Últimos 90 dias</option></Select>} />
      {!data ? <Skeleton className="h-96" /> : (
        <div className="space-y-5">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Stat label="Novos leads" value={k!.newLeads} icon={<Users className="h-4 w-4" />} />
            <Stat label="Vendas fechadas" value={k!.won} hint={formatBRL(k!.wonValue)} icon={<Trophy className="h-4 w-4" />} />
            <Stat label="Qualificados pela IA" value={k!.aiQualified} hint={`${formatPercent(k!.aiQualificationRate, 1)} dos novos leads`} icon={<Bot className="h-4 w-4" />} />
            <Stat label="Tempo médio de 1ª resposta" value={k!.avgFirstResponseMinutes === null ? "—" : k!.avgFirstResponseMinutes < 1 ? "< 1 min" : `${Math.round(k!.avgFirstResponseMinutes)} min`} icon={<Clock className="h-4 w-4" />} />
            <Stat label="Conversas iniciadas" value={k!.conversations} icon={<MessageSquare className="h-4 w-4" />} />
            <Stat label="Perdidos" value={k!.lost} icon={<XCircle className="h-4 w-4" />} />
            <Stat label="Conversão (ganhos/novos)" value={formatPercent(k!.newLeads ? (k!.won / k!.newLeads) * 100 : 0, 1)} icon={<Target className="h-4 w-4" />} />
            <Stat label="Ticket médio" value={formatBRL(k!.won ? k!.wonValue / k!.won : 0)} icon={<TrendingUp className="h-4 w-4" />} />
          </div>
          <div className="grid gap-5 lg:grid-cols-3">
            <Card className="lg:col-span-2">
              <CardHeader title="Leads por dia" description={<span className="flex items-center gap-3"><span className="flex items-center gap-1"><span className="h-2 w-2 rounded-sm bg-primary" /> Total</span><span className="flex items-center gap-1"><span className="h-2 w-2 rounded-sm bg-emerald-500" /> Google Orgânico</span></span>} />
              <div className="p-5">
                <ColumnChart data={data.daily.map((d) => ({ label: d.day.split("-").reverse().slice(0, 2).join("/"), value: d.leads, value2: d.seo }))} secondary="#10B981" />
                <div className="mt-2 flex justify-between text-[10px] text-muted-foreground"><span>{data.daily[0]?.day.split("-").reverse().slice(0, 2).join("/")}</span><span>Hoje</span></div>
              </div>
            </Card>
            <Card>
              <CardHeader title="Leads por origem" />
              <div className="space-y-3 p-5">
                {data.byOrigin.map((o) => <HBar key={o.origin} label={ORIGIN_LABELS[o.origin]} value={o.leads} max={maxOrigin} color={o.origin === "SEO_ORGANICO" ? "#10B981" : undefined} />)}
                {!data.byOrigin.length && <p className="text-xs text-muted-foreground">Sem leads no período.</p>}
              </div>
            </Card>
          </div>
          <div className="grid gap-5 lg:grid-cols-3">
            <Card>
              <CardHeader title="Mensagens por remetente" description={`${totalMsgs} mensagens no período`} />
              <div className="space-y-3 p-5">{data.messages.map((m) => <HBar key={m.senderType} label={SENDER[m.senderType]} value={m.count} max={totalMsgs} suffix={`${m.count} · ${formatPercent((m.count / Math.max(1, totalMsgs)) * 100)}`} color={m.senderType === "AI_AGENT" ? "rgb(var(--secondary))" : undefined} />)}</div>
            </Card>
            <Card className="overflow-hidden lg:col-span-2">
              <CardHeader title="Campanhas no período" />
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-left text-[11px] uppercase text-muted-foreground"><tr><th className="px-4 py-2">Campanha</th><th className="px-3 py-2 text-right">Enviadas</th><th className="px-3 py-2 text-right">Respostas</th><th className="px-3 py-2 text-right">Taxa</th><th className="px-4 py-2 text-right">Custo</th></tr></thead>
                <tbody>
                  {data.campaigns.map((c) => <tr key={c.id} className="border-t"><td className="px-4 py-2">{c.name}</td><td className="px-3 py-2 text-right">{c.sentCount}</td><td className="px-3 py-2 text-right">{c.repliedCount}</td><td className="px-3 py-2 text-right">{formatPercent(c.sentCount ? (c.repliedCount / c.sentCount) * 100 : 0, 1)}</td><td className="px-4 py-2 text-right">{formatBRL(c.estimatedCost)}</td></tr>)}
                  {!data.campaigns.length && <tr><td colSpan={5} className="px-4 py-6 text-center text-xs text-muted-foreground">Nenhuma campanha no período.</td></tr>}
                </tbody>
              </table>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}
