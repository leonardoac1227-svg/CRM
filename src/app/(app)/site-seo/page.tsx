"use client";
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Bot, Check, Code2, Copy, ExternalLink, Globe, MousePointerClick, Palette, Search, Sparkles, Trophy, Users } from "lucide-react";
import { api } from "@/lib/client";
import { ORIGIN_LABELS } from "@/lib/constants";
import { formatBRL, formatDate, formatPercent } from "@/lib/utils";
import { useCan, useMe } from "@/hooks/use-me";
import { Button } from "@/components/ui/button";
import { Checkbox, Field, Input, Select } from "@/components/ui/input";
import { Badge, Card, CardHeader, PageHeader, Skeleton, Stat } from "@/components/ui/misc";
import { ColumnChart, HBar } from "@/components/shared/charts";

type Seo = {
  seoLeads: number; allLeads: number; seoShare: number; trackedSessions: number; aiQualificationRate: number; wonValue: number; wonCount: number;
  topPages: { page: string; leads: number; conversations: number; wonValue: number }[];
  topKeywords: { keyword: string; leads: number }[];
  byOrigin: { origin: string; leads: number }[];
  series: { week: string; leads: number }[];
  recentSessions: { id: string; code: string; origin: string; landingPage: string; keyword: string | null; event: string; contactId: string | null; createdAt: string }[];
  tracker: { key: string; snippet: string; url: string };
  siteUrl: string | null;
};

function path(u: string) {
  try { return new URL(u).pathname; } catch { return u; }
}

function WhiteLabel() {
  const qc = useQueryClient();
  const { data: me } = useMe();
  const [f, setF] = useState({ name: "", logoUrl: "", primaryColor: "#2563EB", secondaryColor: "#4F46E5", assistantDefaultName: "Téo", customDomain: "" });
  useEffect(() => {
    if (me) setF({ name: me.agency.name, logoUrl: me.agency.logoUrl ?? "", primaryColor: me.agency.primaryColor, secondaryColor: me.agency.secondaryColor, assistantDefaultName: me.agency.assistantDefaultName, customDomain: me.agency.customDomain ?? "" });
  }, [me]);
  const save = useMutation({
    mutationFn: () => api("/api/agency", { method: "PATCH", body: f }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["me"] }); toast.success("Marca atualizada — recarregando o tema"); setTimeout(() => window.location.reload(), 600); },
    onError: (e: Error) => toast.error(e.message),
  });
  const presets = [["#2563EB", "#4F46E5"], ["#0F766E", "#0EA5E9"], ["#DC2626", "#F97316"], ["#7C3AED", "#DB2777"], ["#111827", "#2563EB"]];
  return (
    <Card>
      <CardHeader title={<span className="flex items-center gap-2"><Palette className="h-4 w-4 text-primary" /> Configuração White-Label</span>} description="A marca da agência aparece no topo, no login e no atendimento de todos os clientes." />
      <div className="grid gap-5 p-5 lg:grid-cols-[1fr_280px]">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Nome da marca"><Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field>
          <Field label="Nome padrão do assistente"><Input value={f.assistantDefaultName} onChange={(e) => setF({ ...f, assistantDefaultName: e.target.value })} /></Field>
          <Field label="URL da logomarca" className="sm:col-span-2"><Input value={f.logoUrl} onChange={(e) => setF({ ...f, logoUrl: e.target.value })} placeholder="https://suaagencia.com.br/logo.svg" /></Field>
          <Field label="Cor primária">
            <div className="flex gap-2"><input type="color" value={f.primaryColor} onChange={(e) => setF({ ...f, primaryColor: e.target.value })} className="h-9 w-12 cursor-pointer rounded border p-0.5" /><Input value={f.primaryColor} onChange={(e) => setF({ ...f, primaryColor: e.target.value })} className="font-mono" /></div>
          </Field>
          <Field label="Cor secundária">
            <div className="flex gap-2"><input type="color" value={f.secondaryColor} onChange={(e) => setF({ ...f, secondaryColor: e.target.value })} className="h-9 w-12 cursor-pointer rounded border p-0.5" /><Input value={f.secondaryColor} onChange={(e) => setF({ ...f, secondaryColor: e.target.value })} className="font-mono" /></div>
          </Field>
          <div className="sm:col-span-2">
            <p className="mb-1.5 text-xs font-medium text-slate-600">Paletas sugeridas</p>
            <div className="flex gap-2">{presets.map(([a, b]) => <button key={a + b} onClick={() => setF({ ...f, primaryColor: a, secondaryColor: b })} className="h-8 w-14 rounded-md ring-1 ring-slate-200" style={{ background: `linear-gradient(90deg, ${a} 50%, ${b} 50%)` }} />)}</div>
          </div>
          <Field label="Domínio personalizado (opcional)" className="sm:col-span-2" hint="Aponte um CNAME para este servidor (ex.: crm.suaagencia.com.br)."><Input value={f.customDomain} onChange={(e) => setF({ ...f, customDomain: e.target.value })} /></Field>
        </div>
        <div>
          <p className="mb-1.5 text-xs font-medium text-slate-600">Prévia</p>
          <div className="overflow-hidden rounded-lg border">
            <div className="flex items-center gap-2 border-b bg-white px-3 py-2.5">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {f.logoUrl ? <img src={f.logoUrl} alt="" className="h-5 max-w-[110px] object-contain" /> : <span className="flex h-6 w-6 items-center justify-center rounded-md text-white" style={{ background: `linear-gradient(135deg, ${f.primaryColor}, ${f.secondaryColor})` }}><Sparkles className="h-3.5 w-3.5" /></span>}
              <span className="text-sm font-bold">{f.name}</span>
            </div>
            <div className="space-y-2 bg-slate-50 p-3">
              <span className="inline-block rounded-md px-3 py-1.5 text-xs font-medium text-white" style={{ backgroundColor: f.primaryColor }}>Botão principal</span>
              <div className="rounded-lg bg-white p-2 text-xs shadow-sm"><p className="mb-0.5 font-semibold" style={{ color: f.secondaryColor }}>🤖 IA: {f.assistantDefaultName}</p>Olá! Tudo bem? Posso te ajudar?</div>
            </div>
          </div>
          <Button className="mt-3 w-full" onClick={() => save.mutate()} loading={save.isPending}><Check /> Salvar marca</Button>
        </div>
      </div>
    </Card>
  );
}

export default function SiteSeo() {
  const { isManager } = useCan();
  const [days, setDays] = useState("90");
  const [button, setButton] = useState(true);
  const { data } = useQuery({ queryKey: ["seo", days], queryFn: () => api<Seo>(`/api/seo?days=${days}`) });
  const snippet = data ? data.tracker.snippet.replace(`k=${data.tracker.key}`, `k=${data.tracker.key}${button ? "&button=1" : ""}`) : "";
  const maxPage = Math.max(1, ...(data?.topPages.map((p) => p.leads) ?? [1]));
  const maxKw = Math.max(1, ...(data?.topKeywords.map((p) => p.leads) ?? [1]));
  return (
    <div className="mx-auto max-w-7xl space-y-5 px-4 py-6">
      <PageHeader title="Site & SEO" description="Prove o ROI do SEO: de qual página do Google veio cada conversa no WhatsApp — e quanto ela vendeu." actions={<Select value={days} onChange={(e) => setDays(e.target.value)} className="w-auto"><option value="30">30 dias</option><option value="90">90 dias</option><option value="180">180 dias</option></Select>} />
      {!data ? <Skeleton className="h-64" /> : (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Stat label="Leads via SEO Orgânico" value={data.seoLeads} hint={`${formatPercent(data.seoShare, 1)} de todos os leads`} icon={<Search className="h-4 w-4" />} />
            <Stat label="Visitas rastreadas" value={data.trackedSessions} hint="Sessões com protocolo gerado" icon={<MousePointerClick className="h-4 w-4" />} />
            <Stat label="Taxa de qualificação da IA" value={formatPercent(data.aiQualificationRate, 1)} hint="Leads SEO qualificados pelo assistente" icon={<Bot className="h-4 w-4" />} />
            <Stat label="Negócios fechados vindos do SEO" value={formatBRL(data.wonValue)} hint={`${data.wonCount} vendas`} icon={<Trophy className="h-4 w-4" />} className="border-emerald-200 bg-emerald-50/40" />
          </div>
          <div className="grid gap-5 lg:grid-cols-3">
            <Card className="overflow-hidden lg:col-span-2">
              <CardHeader title="Páginas do site que mais geraram conversas no WhatsApp" description="Cada lead traz o protocolo [Ref: #SEO-XXXX] da página onde entrou" />
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-left text-[11px] uppercase text-muted-foreground"><tr><th className="px-4 py-2">Página</th><th className="w-40 px-3 py-2">Leads</th><th className="px-3 py-2 text-right">Conversas</th><th className="px-4 py-2 text-right">Vendido</th></tr></thead>
                <tbody>
                  {data.topPages.map((p) => (
                    <tr key={p.page} className="border-t">
                      <td className="max-w-[320px] px-4 py-2.5"><a href={p.page} target="_blank" rel="noreferrer" className="flex items-center gap-1 truncate font-medium text-primary hover:underline"><Globe className="h-3.5 w-3.5 shrink-0" /> {path(p.page)}</a></td>
                      <td className="px-3 py-2.5"><HBar label="" value={p.leads} max={maxPage} suffix={p.leads} color="#10B981" /></td>
                      <td className="px-3 py-2.5 text-right">{p.conversations}</td>
                      <td className="px-4 py-2.5 text-right font-medium">{p.wonValue ? formatBRL(p.wonValue) : "—"}</td>
                    </tr>
                  ))}
                  {!data.topPages.length && <tr><td colSpan={4} className="px-4 py-8 text-center text-xs text-muted-foreground">Instale o script para começar a medir.</td></tr>}
                </tbody>
              </table>
            </Card>
            <Card>
              <CardHeader title="Leads SEO por semana" />
              <div className="p-5"><ColumnChart data={data.series.map((s) => ({ label: s.week, value: s.leads }))} color="#10B981" height={120} /></div>
              <div className="space-y-2.5 border-t p-5">
                <p className="text-xs font-semibold text-slate-600">Palavras-chave</p>
                {data.topKeywords.map((k) => <HBar key={k.keyword} label={k.keyword} value={k.leads} max={maxKw} />)}
              </div>
            </Card>
          </div>

          <Card>
            <CardHeader
              title={<span className="flex items-center gap-2"><Code2 className="h-4 w-4 text-primary" /> Script de rastreio plug & play (tracker.js)</span>}
              description="Cole antes do </body> do site do cliente (ou no Google Tag Manager)."
              actions={<Button size="sm" variant="outline" asChild><a href={`/demo-site?k=${data.tracker.key}&utm_source=google&utm_medium=organic&utm_term=minha+casa+minha+vida+feira`} target="_blank" rel="noreferrer"><ExternalLink /> Testar em um site de exemplo</a></Button>}
            />
            <div className="grid gap-5 p-5 lg:grid-cols-[1fr_340px]">
              <div>
                <div className="relative">
                  <pre className="overflow-x-auto rounded-lg bg-slate-900 p-4 text-xs leading-relaxed text-emerald-300 scrollbar-thin">{snippet}</pre>
                  <Button size="xs" variant="secondary" className="absolute right-2 top-2" onClick={() => { navigator.clipboard.writeText(snippet); toast.success("Snippet copiado"); }}><Copy /> Copiar</Button>
                </div>
                <label className="mt-3 flex items-center gap-2 text-sm"><Checkbox checked={button} onChange={(e) => setButton(e.target.checked)} /> Exibir botão flutuante de WhatsApp no site</label>
              </div>
              <ul className="space-y-2.5 text-xs text-slate-600">
                <li className="flex gap-2"><Badge tone="green">1</Badge> Detecta tráfego do Google/Bing (SEO Orgânico), Google Ads, Facebook/Instagram, OLX e portais.</li>
                <li className="flex gap-2"><Badge tone="green">2</Badge> Guarda a URL exata da página/artigo de entrada (first-touch, 30 dias).</li>
                <li className="flex gap-2"><Badge tone="green">3</Badge> Intercepta cliques em links/botões de WhatsApp e injeta o protocolo <code className="rounded bg-muted px-1">[Ref: #SEO-XXXX]</code> na mensagem.</li>
                <li className="flex gap-2"><Badge tone="green">4</Badge> Intercepta envios de formulário e cria o lead com a origem completa.</li>
                <li className="flex gap-2"><Badge tone="green">5</Badge> O webhook do WhatsApp lê o protocolo e vincula a conversa do {"Téo"} à página posicionada no Google.</li>
              </ul>
            </div>
          </Card>

          <Card className="overflow-hidden">
            <CardHeader title="Últimas sessões rastreadas" />
            <div className="overflow-x-auto">
              <table className="w-full min-w-[700px] text-sm">
                <thead className="bg-slate-50 text-left text-[11px] uppercase text-muted-foreground"><tr><th className="px-4 py-2">Protocolo</th><th className="px-3 py-2">Origem</th><th className="px-3 py-2">Página de entrada</th><th className="px-3 py-2">Evento</th><th className="px-4 py-2">Quando</th></tr></thead>
                <tbody>
                  {data.recentSessions.map((s) => (
                    <tr key={s.id} className="border-t">
                      <td className="px-4 py-2 font-mono text-xs font-semibold">#{s.code}</td>
                      <td className="px-3 py-2 text-xs">{ORIGIN_LABELS[s.origin]}</td>
                      <td className="max-w-[300px] truncate px-3 py-2 text-xs text-muted-foreground">{path(s.landingPage)}</td>
                      <td className="px-3 py-2">{s.contactId ? <Badge tone="green"><Users className="h-3 w-3" /> Virou lead</Badge> : <Badge>{s.event}</Badge>}</td>
                      <td className="px-4 py-2 text-xs text-muted-foreground">{formatDate(s.createdAt, true)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      )}
      {isManager && <WhiteLabel />}
    </div>
  );
}
