"use client";
import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { Megaphone, Plus, Send, Sparkles, Trash2 } from "lucide-react";
import { api } from "@/lib/client";
import { formatBRL, formatDate, formatPercent, formatPhone } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge, Card, EmptyState, PageHeader, Stat } from "@/components/ui/misc";
import { SheetContent } from "@/components/ui/overlay";
import { CampaignDialog, type Filters } from "@/components/campaigns/campaign-dialog";

type Campaign = {
  id: string; name: string; status: "DRAFT" | "SCHEDULED" | "SENDING" | "COMPLETED"; totalRecipients: number; estimatedCost: number; sentCount: number; deliveredCount: number; readCount: number; repliedCount: number; failedCount: number;
  scheduledAt: string | null; createdAt: string; routeRepliesToAi: boolean; abTestEnabled: boolean; allowedSendUntilHour: string | null;
  template: { id: string; name: string; category: string } | null; channel: { id: string; name: string; phoneNumber: string } | null;
};
type Detail = Campaign & {
  recipients: { id: string; status: string; variant: string; sentAt: string | null; repliedAt: string | null; renderedBody: string | null; error: string | null; contact: { id: string; name: string | null; phone: string } }[];
  byVariant: { variant: string; status: string; _count: { _all: number } }[];
  templateB: { name: string } | null;
};

const STATUS = { DRAFT: ["Rascunho", "slate"], SCHEDULED: ["Agendada", "blue"], SENDING: ["Enviando", "amber"], COMPLETED: ["Concluída", "green"] } as const;
const R_STATUS: Record<string, string> = { PENDING: "Na fila", SENT: "Enviada", DELIVERED: "Entregue", READ: "Lida", REPLIED: "Respondeu", FAILED: "Falhou", SKIPPED: "Ignorada" };

function CampaignDetail({ id, onClose }: { id: string | null; onClose: () => void }) {
  const qc = useQueryClient();
  const { data: c } = useQuery({ queryKey: ["campaign", id], queryFn: () => api<Detail>(`/api/campaigns/${id}`), enabled: !!id, refetchInterval: (q) => (q.state.data?.status === "SENDING" ? 3000 : false) });
  const send = useMutation({
    mutationFn: () => api(`/api/campaigns/${id}/send`, { method: "POST" }),
    onSuccess: () => { toast.success("Disparo iniciado"); qc.invalidateQueries({ queryKey: ["campaign", id] }); qc.invalidateQueries({ queryKey: ["campaigns"] }); },
    onError: (e: Error) => toast.error(e.message),
  });
  const ab = useMemo(() => {
    if (!c?.abTestEnabled) return null;
    return ["A", "B"].map((v) => {
      const rows = c.byVariant.filter((x) => x.variant === v);
      const total = rows.reduce((a, r) => a + r._count._all, 0);
      const replied = rows.find((r) => r.status === "REPLIED")?._count._all ?? 0;
      return { v, total, replied, rate: total ? (replied / total) * 100 : 0 };
    });
  }, [c]);
  return (
    <DialogPrimitive.Root open={!!id} onOpenChange={(o) => !o && onClose()}>
      <SheetContent title={c?.name ?? "Campanha"} width="max-w-2xl">
        {c && (
          <div className="flex-1 space-y-4 overflow-y-auto p-5 scrollbar-thin">
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <Badge tone={STATUS[c.status][1]}>{STATUS[c.status][0]}</Badge>
              <span>{c.template?.name}{c.abTestEnabled && c.templateB ? ` vs ${c.templateB.name}` : ""}</span>
              <span>· {c.channel?.name} {formatPhone(c.channel?.phoneNumber)}</span>
              {c.routeRepliesToAi && <Badge tone="violet"><Sparkles className="h-3 w-3" /> Respostas vão para a IA</Badge>}
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Stat label="Destinatários" value={c.totalRecipients} />
              <Stat label="Enviadas" value={c.sentCount} hint={c.failedCount ? `${c.failedCount} falhas` : undefined} />
              <Stat label="Lidas" value={c.readCount} hint={c.sentCount ? formatPercent((c.readCount / c.sentCount) * 100) : undefined} />
              <Stat label="Respostas" value={c.repliedCount} hint={c.sentCount ? formatPercent((c.repliedCount / c.sentCount) * 100) : undefined} />
            </div>
            <p className="text-xs text-muted-foreground">Custo estimado: <strong className="text-foreground">{formatBRL(c.estimatedCost)}</strong>{c.scheduledAt ? ` · agendada para ${formatDate(c.scheduledAt, true)}` : ""}{c.allowedSendUntilHour ? ` · envia até ${c.allowedSendUntilHour}` : ""}</p>
            {ab && (
              <Card className="grid grid-cols-2 divide-x">
                {ab.map((x) => (
                  <div key={x.v} className="p-4">
                    <p className="text-xs text-muted-foreground">Variante {x.v}</p>
                    <p className="text-xl font-semibold">{formatPercent(x.rate, 1)}</p>
                    <p className="text-[11px] text-muted-foreground">{x.replied} respostas de {x.total}</p>
                  </div>
                ))}
              </Card>
            )}
            {(c.status === "DRAFT" || c.status === "SCHEDULED") && <Button onClick={() => send.mutate()} loading={send.isPending}><Send /> Enviar agora</Button>}
            <Card className="overflow-hidden">
              <table className="w-full text-xs">
                <thead className="bg-slate-50 text-left text-muted-foreground"><tr><th className="px-3 py-2">Contato</th>{c.abTestEnabled && <th className="px-3 py-2">Var.</th>}<th className="px-3 py-2">Status</th><th className="px-3 py-2">Enviado</th></tr></thead>
                <tbody>
                  {c.recipients.map((r) => (
                    <tr key={r.id} className="border-t" title={r.renderedBody ?? r.error ?? ""}>
                      <td className="px-3 py-2"><p className="font-medium">{r.contact.name ?? "Sem nome"}</p><p className="text-muted-foreground">{formatPhone(r.contact.phone)}</p></td>
                      {c.abTestEnabled && <td className="px-3 py-2">{r.variant}</td>}
                      <td className="px-3 py-2"><Badge tone={r.status === "REPLIED" ? "green" : r.status === "FAILED" ? "red" : r.status === "PENDING" ? "slate" : "blue"}>{R_STATUS[r.status]}</Badge></td>
                      <td className="px-3 py-2 text-muted-foreground">{formatDate(r.sentAt, true)}</td>
                    </tr>
                  ))}
                  {!c.recipients.length && <tr><td colSpan={4} className="px-3 py-6 text-center text-muted-foreground">A lista é gerada no momento do envio.</td></tr>}
                </tbody>
              </table>
            </Card>
          </div>
        )}
      </SheetContent>
    </DialogPrimitive.Root>
  );
}

function Campanhas() {
  const sp = useSearchParams();
  const router = useRouter();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [detail, setDetail] = useState<string | null>(null);
  const [initial, setInitial] = useState<Partial<Filters> | undefined>();
  const { data } = useQuery({ queryKey: ["campaigns"], queryFn: () => api<Campaign[]>("/api/campaigns"), refetchInterval: (q) => (q.state.data?.some((c) => c.status === "SENDING") ? 4000 : false) });
  const del = useMutation({ mutationFn: (id: string) => api(`/api/campaigns/${id}`, { method: "DELETE" }), onSuccess: () => qc.invalidateQueries({ queryKey: ["campaigns"] }), onError: (e: Error) => toast.error(e.message) });

  useEffect(() => {
    if (sp.get("novo")) {
      setInitial({
        pipelineId: sp.get("pipeline"),
        stageIds: sp.get("stage") ? [sp.get("stage")!] : [],
        contactIds: sp.get("contatos") ? sp.get("contatos")!.split(",") : [],
      });
      setOpen(true);
      router.replace("/campanhas");
    }
  }, [sp, router]);

  const totals = (data ?? []).reduce((a, c) => ({ sent: a.sent + c.sentCount, replied: a.replied + c.repliedCount, cost: a.cost + (c.status === "COMPLETED" ? c.estimatedCost : 0) }), { sent: 0, replied: 0, cost: 0 });

  return (
    <div className="mx-auto max-w-6xl px-4 py-6">
      <PageHeader title="Campanhas" description="Disparos oficiais pelo WhatsApp, segmentados por etapa do funil." actions={<Button size="sm" onClick={() => { setInitial(undefined); setOpen(true); }}><Plus /> Nova campanha</Button>} />
      <div className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Stat label="Mensagens enviadas" value={totals.sent} />
        <Stat label="Respostas" value={totals.replied} hint={totals.sent ? `${formatPercent((totals.replied / totals.sent) * 100, 1)} de taxa de resposta` : undefined} />
        <Stat label="Investimento estimado (Meta)" value={formatBRL(totals.cost)} />
      </div>
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px] text-sm">
            <thead className="border-b bg-slate-50 text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              <tr><th className="px-4 py-3">Campanha</th><th className="px-3 py-3">Status</th><th className="px-3 py-3">Modelo</th><th className="px-3 py-3 text-right">Destinatários</th><th className="px-3 py-3 text-right">Enviadas</th><th className="px-3 py-3 text-right">Respostas</th><th className="px-3 py-3 text-right">Custo</th><th className="px-3 py-3" /></tr>
            </thead>
            <tbody>
              {data?.map((c) => (
                <tr key={c.id} onClick={() => setDetail(c.id)} className="cursor-pointer border-b last:border-0 hover:bg-slate-50">
                  <td className="px-4 py-3">
                    <p className="font-medium">{c.name}</p>
                    <p className="text-[11px] text-muted-foreground">{c.channel?.name} · {formatDate(c.createdAt)}{c.routeRepliesToAi && " · ✨ IA"}{c.abTestEnabled && " · A/B"}</p>
                  </td>
                  <td className="px-3 py-3">
                    <Badge tone={STATUS[c.status][1]}>{STATUS[c.status][0]}</Badge>
                    {c.status === "SCHEDULED" && c.scheduledAt && <p className="mt-0.5 text-[11px] text-muted-foreground">{formatDate(c.scheduledAt, true)}</p>}
                  </td>
                  <td className="px-3 py-3 font-mono text-xs">{c.template?.name}</td>
                  <td className="px-3 py-3 text-right">{c.totalRecipients}</td>
                  <td className="px-3 py-3 text-right">
                    {c.sentCount}
                    {c.status === "SENDING" && c.totalRecipients > 0 && <div className="ml-auto mt-1 h-1 w-20 overflow-hidden rounded-full bg-slate-100"><div className="h-full bg-amber-500" style={{ width: `${(c.sentCount / c.totalRecipients) * 100}%` }} /></div>}
                  </td>
                  <td className="px-3 py-3 text-right">{c.repliedCount}</td>
                  <td className="px-3 py-3 text-right">{formatBRL(c.estimatedCost)}</td>
                  <td className="px-3 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                    {c.status !== "SENDING" && <Button size="icon-sm" variant="ghost" onClick={() => confirm("Excluir campanha?") && del.mutate(c.id)}><Trash2 /></Button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {data && !data.length && <EmptyState icon={<Megaphone className="h-5 w-5" />} title="Nenhuma campanha ainda" description="Crie um disparo para uma etapa do funil." />}
      </Card>
      <CampaignDialog open={open} onOpenChange={setOpen} initialFilters={initial} onCreated={() => qc.invalidateQueries({ queryKey: ["campaigns"] })} />
      <CampaignDetail id={detail} onClose={() => setDetail(null)} />
    </div>
  );
}

export default function Page() {
  return (
    <Suspense>
      <Campanhas />
    </Suspense>
  );
}
