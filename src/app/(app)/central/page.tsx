"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, ArrowUpRight, CalendarDays, Clock, Inbox, PlayCircle, Sparkles, Target, TrendingUp, Trophy, Users } from "lucide-react";
import { api, qs } from "@/lib/client";
import { cn, formatBRL, formatPercent, timeAgo } from "@/lib/utils";
import { TASK_TYPE_LABELS } from "@/lib/constants";
import { useMe, usePipelines } from "@/hooks/use-me";
import { useNavBadges } from "@/hooks/use-nav-badges";
import { Avatar, Card, Skeleton } from "@/components/ui/misc";
import { NAV_GROUPS, navAllowed, type NavItem } from "@/components/layout/nav-config";
import type { ConversationListItem, Task } from "@/lib/types";

type Reports = {
  kpis: { newLeads: number; won: number; wonValue: number; conversations: number; aiQualified: number; aiQualificationRate: number; avgFirstResponseMinutes: number | null };
  byOrigin: { origin: string; leads: number }[];
};
type Analytics = { total: number; stages: { id: string; name: string; color: string; count: number; value: number; isWonStage: boolean }[] };
type Seo = { seoShare: number; seoLeads?: number };

const SHORTCUTS = [
  { q: "Relatório dos corretores", label: "Relatório dos corretores" },
  { q: "Quais leads estão sem resposta?", label: "Leads sem resposta" },
  { q: "Visitas da semana", label: "Visitas da semana" },
  { q: "Tarefas atrasadas", label: "Tarefas atrasadas" },
  { q: "Sugira uma campanha", label: "Sugira uma campanha" },
];

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? "Bom dia" : h < 18 ? "Boa tarde" : "Boa noite";
}

function Kpi({ label, value, hint, icon, href, tone = "muted", delay = 0 }: { label: string; value: React.ReactNode; hint?: React.ReactNode; icon: React.ReactNode; href: string; tone?: "muted" | "warn" | "good" | "brand"; delay?: number }) {
  const toneCls = { muted: "text-muted-foreground", warn: "text-orange-600", good: "text-emerald-600", brand: "text-primary dark:text-secondary" }[tone];
  return (
    <Link href={href} className="group animate-rise" style={{ animationDelay: `${delay}ms` }}>
      <Card className="card-hover h-full p-5">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-muted-foreground">{label}</span>
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary transition-transform group-hover:scale-110 dark:text-secondary [&_svg]:h-4 [&_svg]:w-4">{icon}</span>
        </div>
        <p className="mt-3 font-display text-[34px] font-semibold leading-none">{value}</p>
        {hint && <p className={cn("mt-2 text-xs font-bold", toneCls)}>{hint}</p>}
      </Card>
    </Link>
  );
}

function ModuleCard({ item, group, stat, assistant, delay }: { item: NavItem; group: string; stat?: string | null; assistant: string; delay: number }) {
  const Icon = item.icon;
  return (
    <Link href={item.href} className="group animate-rise" style={{ animationDelay: `${delay}ms` }}>
      <Card className="card-hover flex h-full flex-col gap-3 p-5">
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-primary/25 bg-primary/10 text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground dark:text-secondary">
            <Icon className="h-5 w-5" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[15px] font-extrabold">{item.ai ? `${assistant} · ${item.label}` : item.label}</span>
            <span className="block text-[10px] font-extrabold uppercase tracking-[0.16em] text-muted-foreground">{group}</span>
          </span>
          <ArrowUpRight className="h-4 w-4 text-muted-foreground transition-all group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-primary" />
        </div>
        <p className="text-[13px] leading-relaxed text-muted-foreground">{item.description.replace("da IA", `da ${assistant}`).replace("a IA usam", `a ${assistant} usam`)}</p>
        {stat && <span className="mt-auto w-fit rounded-full border bg-background px-2.5 py-1 text-[11.5px] font-bold text-primary dark:text-secondary">{stat}</span>}
      </Card>
    </Link>
  );
}

export default function Central() {
  const router = useRouter();
  const { data: me } = useMe();
  const { badges, counts, pendencias } = useNavBadges();
  const { data: pipelines } = usePipelines();
  const [ask, setAsk] = useState("");
  const has = (m: string) => !!me?.modules.includes(m);
  const assistant = me?.assistantName ?? "Zeni";
  const firstName = me?.user.name.split(" ")[0] ?? "";
  const pipeline = pipelines?.find((p) => p.isDefault) ?? pipelines?.[0];

  const week = useMemo(() => {
    const from = new Date();
    from.setHours(0, 0, 0, 0);
    return { from: from.toISOString(), to: new Date(from.getTime() + 7 * 86400000).toISOString() };
  }, []);

  const reports = useQuery({ queryKey: ["central-reports"], queryFn: () => api<Reports>("/api/reports?days=7"), enabled: has("relatorios") });
  const queue = useQuery({ queryKey: ["conv-counts"], queryFn: () => api<{ items: ConversationListItem[]; counts: { reply: number; ai: number; unread: number; all: number } }>("/api/conversations?tab=reply"), enabled: has("atendimento") });
  const aiConvs = useQuery({ queryKey: ["central-ai"], queryFn: () => api<{ items: ConversationListItem[] }>("/api/conversations?tab=ai"), enabled: has("atendimento") });
  const tasks = useQuery({ queryKey: ["central-tasks", week.from], queryFn: () => api<Task[]>(`/api/tasks${qs(week)}`), enabled: has("agenda") });
  const funnel = useQuery({ queryKey: ["central-funnel", pipeline?.id], queryFn: () => api<Analytics>(`/api/pipelines/${pipeline!.id}/analytics`), enabled: has("funis") && !!pipeline });
  const contacts = useQuery({ queryKey: ["central-contacts"], queryFn: () => api<{ total: number }>("/api/contacts?pageSize=10"), enabled: has("contatos") });
  const seo = useQuery({ queryKey: ["central-seo"], queryFn: () => api<Seo>("/api/seo?days=30"), enabled: has("site-seo") });

  const today = (tasks.data ?? []).filter((t) => new Date(t.dueDate).toDateString() === new Date().toDateString() && !t.isCompleted);
  const visits = (tasks.data ?? []).filter((t) => t.type === "VISIT" && !t.isCompleted);
  const openDeals = funnel.data ? funnel.data.stages.filter((s) => !s.isWonStage).reduce((a, s) => a + s.count, 0) : null;
  const maxStage = Math.max(1, ...(funnel.data?.stages.map((s) => s.count) ?? [1]));
  const k = reports.data?.kpis;

  const stats: Record<string, string | null> = {
    "/atendimento": counts ? `${counts.reply} esperando resposta · ${counts.ai} com a ${assistant}` : null,
    "/contatos": contacts.data ? `${contacts.data.total} contatos${badges.unassigned ? ` · ${badges.unassigned} sem responsável` : ""}` : null,
    "/funis": openDeals !== null ? `${openDeals} negócios em aberto` : null,
    "/agenda": tasks.data ? `${today.length} para hoje · ${visits.length} visitas na semana` : null,
    "/imoveis": "Catálogo da equipe",
    "/campanhas": badges.rejected ? `${badges.rejected} modelo(s) rejeitado(s)` : "Disparos oficiais da Meta",
    "/site-seo": seo.data ? `${formatPercent(seo.data.seoShare, 0)} dos leads via Google` : null,
    "/relatorios": k ? (k.avgFirstResponseMinutes !== null ? `1ª resposta em ${k.avgFirstResponseMinutes < 1 ? "<1" : Math.round(k.avgFirstResponseMinutes)} min` : `${k.newLeads} leads na semana`) : null,
    "/ia": "6 relatórios prontos",
    "/ia/automacoes": "Trabalha 24 horas por dia",
    "/integracoes": badges.attention ? `${badges.attention} número(s) pedem atenção` : "Tudo conectado",
    "/equipe": "Roleta de distribuição",
    "/clientes": me?.workspaces.length ? `${me.workspaces.length} empresa(s) na agência` : null,
  };

  function submitAsk(q: string) {
    if (!q.trim()) return;
    router.push(`/ia?q=${encodeURIComponent(q.trim())}`);
  }

  const dateLabel = new Date().toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" });
  const waiting = (queue.data?.items ?? []).slice(0, 5);
  const withAi = (aiConvs.data?.items ?? []).slice(0, 3);

  return (
    <div className="mx-auto w-full max-w-[1400px] space-y-8 px-4 py-6 md:px-8 md:py-8">
      {/* Saudação */}
      <section className="animate-rise">
        <p className="text-sm font-semibold capitalize text-muted-foreground">{dateLabel}</p>
        <h1 className="display mt-1 text-[34px] leading-tight sm:text-[44px]">
          {greeting()}, <span className="text-gradient">{firstName}.</span>
        </h1>
        <p className="mt-2 max-w-2xl text-[15px] text-muted-foreground">
          {pendencias
            ? pendencias.total
              ? `Você tem ${pendencias.total} ${pendencias.total === 1 ? "pendência" : "pendências"} agora. A ${assistant} já organizou tudo abaixo.`
              : `Tudo em dia por aqui. A ${assistant} continua atendendo os novos leads.`
            : `Aqui está o resumo de ${me?.workspace.name ?? "sua empresa"} e tudo o que o Ápice faz por você.`}
        </p>
      </section>

      {/* Copiloto em destaque */}
      {has("teo") && (
        <section className="glow-gold animate-rise rounded-2xl border border-primary/25 p-5 md:p-6" style={{ animationDelay: "60ms" }}>
          <div className="flex flex-wrap items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-secondary to-primary text-primary-foreground"><Sparkles className="h-4 w-4" /></span>
            <span className="text-sm font-extrabold text-primary dark:text-secondary">{assistant} · sua copiloto</span>
            <span className="text-sm text-muted-foreground">Pergunte qualquer coisa sobre leads, equipe, agenda e campanhas.</span>
          </div>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              submitAsk(ask);
            }}
            className="mt-4 flex items-center gap-2 rounded-xl border bg-background p-1.5 pl-4 transition-colors focus-within:border-primary/60"
          >
            <label htmlFor="central-ask" className="sr-only">Pergunte à {assistant}</label>
            <input id="central-ask" value={ask} onChange={(e) => setAsk(e.target.value)} placeholder="Ex.: quais corretores estão com mais leads sem resposta?" className="h-11 min-w-0 flex-1 bg-transparent text-[15px] outline-none placeholder:text-muted-foreground" />
            <button type="submit" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground transition-all hover:brightness-110 active:scale-95" aria-label="Perguntar">
              <ArrowRight className="h-5 w-5" />
            </button>
          </form>
          <div className="mt-3 flex flex-wrap gap-2">
            {SHORTCUTS.map((s) => (
              <button key={s.label} onClick={() => submitAsk(s.q)} className="rounded-full border bg-card px-3 py-1.5 text-xs font-bold text-foreground/80 transition-colors hover:border-primary/60 hover:text-foreground">
                {s.label}
              </button>
            ))}
          </div>
        </section>
      )}

      {/* Indicadores */}
      <section aria-label="Indicadores" className="grid grid-cols-2 gap-3 md:grid-cols-[repeat(auto-fit,minmax(190px,1fr))] md:gap-4">
        {has("atendimento") && <Kpi delay={80} href="/atendimento?aba=responder" label="A responder" value={counts?.reply ?? "—"} hint={badges.pendencias ? `${pendencias?.items.find((i) => i.key === "leads-sem-resposta")?.count ?? 0} há mais de 30 min` : "Fila em dia"} tone={counts?.reply ? "warn" : "good"} icon={<Inbox />} />}
        {has("atendimento") && <Kpi delay={120} href="/atendimento?aba=teo" label={`Com a ${assistant}`} value={counts?.ai ?? "—"} hint="Qualificando agora" tone="brand" icon={<Sparkles />} />}
        {has("relatorios") && <Kpi delay={160} href="/relatorios" label="Leads na semana" value={k?.newLeads ?? "—"} hint={k ? `${formatPercent(k.aiQualificationRate, 0)} qualificados pela ${assistant}` : undefined} tone="brand" icon={<Users />} />}
        {has("agenda") && <Kpi delay={200} href="/agenda" label="Visitas na semana" value={tasks.data ? visits.length : "—"} hint={badges.overdue ? `${badges.overdue} tarefa(s) atrasada(s)` : `${today.length} tarefa(s) hoje`} tone={badges.overdue ? "warn" : "muted"} icon={<CalendarDays />} />}
        {has("relatorios") && <Kpi delay={240} href="/relatorios" label="Vendas na semana" value={k ? formatBRL(k.wonValue, { compact: true }) : "—"} hint={k ? `${k.won} negócio(s) fechado(s)` : undefined} tone="good" icon={<Trophy />} />}
        {!has("relatorios") && has("funis") && <Kpi delay={160} href="/funis" label="Negócios em aberto" value={openDeals ?? "—"} hint="No seu funil" icon={<Target />} />}
      </section>

      {/* Mapa da plataforma */}
      <section className="space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="display text-2xl">Tudo o que o <span className="text-gradient">Ápice</span> faz</h2>
            <p className="mt-1 text-sm text-muted-foreground">Cada módulo mostra o que está acontecendo agora. Clique para entrar.</p>
          </div>
          <Link href="/getting-started?tour=1" className="flex items-center gap-2 rounded-full border bg-card px-4 py-2 text-xs font-bold transition-colors hover:border-primary/60">
            <PlayCircle className="h-4 w-4 text-primary dark:text-secondary" /> Fazer o tour guiado
          </Link>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {NAV_GROUPS.flatMap((g) => g.items.filter((i) => i.inMap && navAllowed(i, me)).map((i) => ({ i, g }))).map(({ i, g }, idx) => (
            <ModuleCard key={i.href} item={i} group={g.key === "ia" ? `${assistant} · IA` : g.label} stat={stats[i.href]} assistant={assistant} delay={idx * 35} />
          ))}
        </div>
      </section>

      {/* Painéis do dia */}
      <section className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {has("atendimento") && (
          <Card className="flex flex-col p-5">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="font-extrabold">Esperando você</h3>
              <Link href="/atendimento?aba=responder" className="text-xs font-bold text-primary hover:underline dark:text-secondary">Abrir atendimento</Link>
            </div>
            {queue.isLoading && <div className="space-y-2">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-12" />)}</div>}
            {!queue.isLoading && !waiting.length && <p className="py-6 text-center text-sm text-muted-foreground">Ninguém esperando. 🎉</p>}
            <div className="-mx-2 space-y-0.5">
              {waiting.map((c) => (
                <Link key={c.id} href={`/atendimento?conversa=${c.id}`} className="flex items-center gap-3 rounded-xl px-2 py-2 transition-colors hover:bg-muted">
                  <Avatar name={c.contact.name ?? c.contact.phone} size={36} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13.5px] font-bold">{c.contact.name ?? c.contact.phone}</span>
                    <span className="block truncate text-xs text-muted-foreground">{c.lastMessagePreview}</span>
                  </span>
                  <span className="flex shrink-0 items-center gap-1 text-[11px] font-bold text-orange-600"><Clock className="h-3 w-3" />{timeAgo(c.lastMessageAt)}</span>
                </Link>
              ))}
              {withAi.map((c) => (
                <Link key={c.id} href={`/atendimento?conversa=${c.id}`} className="flex items-center gap-3 rounded-xl px-2 py-2 transition-colors hover:bg-muted">
                  <Avatar name={c.contact.name ?? c.contact.phone} size={36} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13.5px] font-bold">{c.contact.name ?? c.contact.phone}</span>
                    <span className="block truncate text-xs text-muted-foreground">{c.lastMessagePreview}</span>
                  </span>
                  <span className="flex shrink-0 items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[10.5px] font-extrabold text-primary dark:text-secondary"><Sparkles className="h-3 w-3" />{assistant}</span>
                </Link>
              ))}
            </div>
          </Card>
        )}

        {has("funis") && (
          <Card className="flex flex-col p-5">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="font-extrabold">{pipeline?.name ?? "Funil"}</h3>
              <Link href="/funis" className="text-xs font-bold text-primary hover:underline dark:text-secondary">Ver Kanban</Link>
            </div>
            {funnel.isLoading && <div className="space-y-3">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-7" />)}</div>}
            <div className="space-y-3">
              {funnel.data?.stages.map((s) => (
                <div key={s.id}>
                  <div className="mb-1 flex items-center justify-between text-[12.5px]">
                    <span className="flex items-center gap-2 font-bold text-foreground/80"><span className="h-2 w-2 rounded-full" style={{ backgroundColor: s.color }} />{s.name}</span>
                    <span className="font-extrabold">{s.count}</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-muted">
                    <div className="h-full rounded-full bg-gradient-to-r from-primary to-secondary transition-[width] duration-700" style={{ width: `${(s.count / maxStage) * 100}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </Card>
        )}

        <Card className="flex flex-col p-5">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="font-extrabold">Hoje na agenda</h3>
            {has("agenda") && <Link href="/agenda" className="text-xs font-bold text-primary hover:underline dark:text-secondary">Abrir agenda</Link>}
          </div>
          {tasks.isLoading && <div className="space-y-2">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-12" />)}</div>}
          {!tasks.isLoading && !today.length && <p className="py-4 text-sm text-muted-foreground">Nada marcado para hoje.</p>}
          <div className="space-y-2">
            {today.slice(0, 5).map((t) => (
              <Link key={t.id} href="/agenda" className="flex items-center gap-3 rounded-xl border bg-background/50 px-3 py-2.5 transition-colors hover:border-primary/50">
                <span className="w-12 shrink-0 font-display text-lg font-semibold text-primary dark:text-secondary">{new Date(t.dueDate).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] font-bold">{t.title}</span>
                  <span className="block truncate text-[11.5px] text-muted-foreground">{TASK_TYPE_LABELS[t.type]}{t.contact?.name ? ` · ${t.contact.name}` : ""}</span>
                </span>
              </Link>
            ))}
          </div>
          {!!pendencias?.items.filter((i) => i.count).length && (
            <div className="mt-4 border-t pt-4">
              <p className="eyebrow mb-2">A {assistant} sinalizou</p>
              <div className="space-y-1.5">
                {pendencias.items.filter((i) => i.count).map((i) => (
                  <Link key={i.key} href={i.href} className="flex items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-[13px] transition-colors hover:bg-muted">
                    <span className="flex items-center gap-2"><TrendingUp className="h-3.5 w-3.5 text-orange-600" />{i.label}</span>
                    <span className="font-extrabold">{i.count}</span>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </Card>
      </section>
    </div>
  );
}
