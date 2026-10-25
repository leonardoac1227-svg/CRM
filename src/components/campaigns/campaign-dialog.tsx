"use client";
import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Calendar, Clock, Send, Sparkles, Users, FlaskConical } from "lucide-react";
import { api } from "@/lib/client";
import { META_PRICING, ORIGIN_SHORT, TEMPLATE_CATEGORY_LABELS } from "@/lib/constants";
import { buildVarContext, renderTemplate } from "@/lib/templates";
import { cn, formatBRL, formatPhone } from "@/lib/utils";
import type { Channel, Template } from "@/lib/types";
import { useCan, usePipelines, useTeam } from "@/hooks/use-me";
import { Button } from "@/components/ui/button";
import { Checkbox, Field, Input, Select } from "@/components/ui/input";
import { Badge } from "@/components/ui/misc";
import { Dialog, DialogBody, DialogContent, DialogFooter, Switch } from "@/components/ui/overlay";
import { WhatsAppPreview } from "@/components/shared/whatsapp-preview";

export type Filters = { pipelineId?: string | null; stageIds: string[]; assignedToIds: string[]; origins: string[]; tags: string[]; contactIds?: string[] };
type Preview = { count: number; estimatedCost: number; category: string; sample: { id: string; name: string | null; phone: string; city: string | null; state: string | null; neighborhood: string | null; stage: { name: string } | null; assignedTo: { name: string } | null }[] };

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return <button type="button" onClick={onClick} className={cn("rounded-full border px-3 py-1 text-xs font-medium transition-colors", active ? "border-primary bg-primary text-white" : "bg-white text-slate-600 hover:border-primary/40")}>{children}</button>;
}

function RecipientsDialog({ open, onOpenChange, filters, onChange, templateId }: { open: boolean; onOpenChange: (v: boolean) => void; filters: Filters; onChange: (f: Filters) => void; templateId: string }) {
  const { data: pipelines } = usePipelines();
  const { data: team } = useTeam();
  const { me } = useCan();
  const [f, setF] = useState<Filters>(filters);
  useEffect(() => { if (open) setF(filters); }, [open, filters]);
  const pipeline = pipelines?.find((p) => p.id === f.pipelineId) ?? pipelines?.find((p) => p.isDefault);
  const { data: tagsResp } = useQuery({ queryKey: ["contacts", "tags"], queryFn: () => api<{ tags: string[] }>("/api/contacts?pageSize=10"), enabled: open });
  const { data: prev, isFetching } = useQuery({
    queryKey: ["campaign-preview", f, templateId],
    queryFn: () => api<Preview>("/api/campaigns/preview", { body: { filters: { ...f, pipelineId: f.stageIds.length ? pipeline?.id : f.pipelineId }, templateId: templateId || null } }),
    enabled: open,
  });
  const toggle = (k: "stageIds" | "assignedToIds" | "origins" | "tags", v: string) => setF({ ...f, [k]: f[k].includes(v) ? f[k].filter((x) => x !== v) : [...f[k], v] });
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="xl" title="Selecionar destinatários">
        <div className="flex flex-wrap items-center gap-4 border-b bg-gradient-to-r from-primary/[0.05] to-secondary/[0.06] px-5 py-3">
          <div className="flex items-center gap-2"><Users className="h-5 w-5 text-primary" /><span className="text-2xl font-semibold">{prev?.count ?? "…"}</span><span className="text-sm text-muted-foreground">contatos selecionados</span></div>
          <div className="ml-auto text-right">
            <p className="text-[11px] text-muted-foreground">Custo estimado ({TEMPLATE_CATEGORY_LABELS[prev?.category ?? "MARKETING"]} · {formatBRL(META_PRICING[prev?.category ?? "MARKETING"], { decimals: 4 })}/msg)</p>
            <p className="text-xl font-semibold text-primary">{formatBRL(prev?.estimatedCost ?? 0)}</p>
          </div>
        </div>
        <DialogBody className="grid gap-6 lg:grid-cols-[1fr_320px]">
          <div className="space-y-5">
            {f.contactIds?.length ? (
              <div className="rounded-lg bg-primary/5 p-3 text-sm">
                {f.contactIds.length} contatos escolhidos manualmente na lista de Contatos.
                <button onClick={() => setF({ ...f, contactIds: [] })} className="ml-2 text-xs text-primary hover:underline">Usar filtros</button>
              </div>
            ) : null}
            <div>
              <div className="mb-2 flex items-center justify-between">
                <p className="text-xs font-semibold text-slate-600">Funil e etapa</p>
                <Select value={pipeline?.id ?? ""} onChange={(e) => setF({ ...f, pipelineId: e.target.value, stageIds: [] })} className="h-8 w-auto text-xs">
                  {pipelines?.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </Select>
              </div>
              <div className="flex flex-wrap gap-2">
                {pipeline?.stages.map((s) => <Chip key={s.id} active={f.stageIds.includes(s.id)} onClick={() => toggle("stageIds", s.id)}>{s.name}</Chip>)}
              </div>
              <p className="mt-1.5 text-[11px] text-muted-foreground">Ex.: “Visita agendada” para quem faltou, “Fechado” para pedir indicações, “Proposta” para destravar negociações.</p>
            </div>
            {!me?.seesOnlyOwn && (
              <div>
                <p className="mb-2 text-xs font-semibold text-slate-600">Corretor responsável</p>
                <div className="flex flex-wrap gap-2">
                  {team?.filter((u) => u.isActive && u.role !== "ASSISTANT").map((u) => <Chip key={u.id} active={f.assignedToIds.includes(u.id)} onClick={() => toggle("assignedToIds", u.id)}>{u.name}</Chip>)}
                  <Chip active={f.assignedToIds.includes("none")} onClick={() => toggle("assignedToIds", "none")}>Sem responsável</Chip>
                </div>
              </div>
            )}
            <div>
              <p className="mb-2 text-xs font-semibold text-slate-600">Origem</p>
              <div className="flex flex-wrap gap-2">
                {Object.entries(ORIGIN_SHORT).map(([k, v]) => <Chip key={k} active={f.origins.includes(k)} onClick={() => toggle("origins", k)}>{v}</Chip>)}
              </div>
            </div>
            {!!tagsResp?.tags.length && (
              <div>
                <p className="mb-2 text-xs font-semibold text-slate-600">Etiquetas</p>
                <div className="flex flex-wrap gap-2">{tagsResp.tags.map((t) => <Chip key={t} active={f.tags.includes(t)} onClick={() => toggle("tags", t)}>#{t}</Chip>)}</div>
              </div>
            )}
          </div>
          <div className="rounded-lg border">
            <p className="border-b px-3 py-2 text-xs font-semibold text-slate-600">Prévia dos destinatários {isFetching && "…"}</p>
            <div className="max-h-[50vh] divide-y overflow-y-auto scrollbar-thin">
              {prev?.sample.map((c) => (
                <div key={c.id} className="px-3 py-2">
                  <p className="text-sm font-medium">{c.name ?? <span className="italic text-muted-foreground">Sem nome</span>}</p>
                  <p className="text-[11px] text-muted-foreground">{formatPhone(c.phone)} · {c.stage?.name} · {c.assignedTo?.name ?? "—"}</p>
                </div>
              ))}
              {prev && prev.count > prev.sample.length && <p className="px-3 py-2 text-center text-[11px] text-muted-foreground">+ {prev.count - prev.sample.length} contatos</p>}
              {prev && !prev.count && <p className="px-3 py-8 text-center text-xs text-muted-foreground">Nenhum contato com esses filtros.</p>}
            </div>
          </div>
        </DialogBody>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setF({ stageIds: [], assignedToIds: [], origins: [], tags: [], pipelineId: f.pipelineId })}>Limpar filtros</Button>
          <Button onClick={() => { onChange({ ...f, pipelineId: pipeline?.id ?? null }); onOpenChange(false); }}>Usar {prev?.count ?? 0} destinatários</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function CampaignDialog({ open, onOpenChange, initialFilters, onCreated }: { open: boolean; onOpenChange: (v: boolean) => void; initialFilters?: Partial<Filters>; onCreated: () => void }) {
  const { me } = useCan();
  const { data: channels } = useQuery({ queryKey: ["channels"], queryFn: () => api<Channel[]>("/api/channels"), enabled: open });
  const { data: templates } = useQuery({ queryKey: ["templates", "APPROVED"], queryFn: () => api<Template[]>("/api/templates?status=APPROVED"), enabled: open });
  const [name, setName] = useState("");
  const [channelId, setChannelId] = useState("");
  const [templateId, setTemplateId] = useState("");
  const [ab, setAb] = useState(false);
  const [templateBId, setTemplateBId] = useState("");
  const [schedule, setSchedule] = useState<"NOW" | "SCHEDULED">("NOW");
  const [scheduledAt, setScheduledAt] = useState("");
  const [limitHour, setLimitHour] = useState(true);
  const [until, setUntil] = useState("18:00");
  const [routeAi, setRouteAi] = useState(true);
  const [filters, setFilters] = useState<Filters>({ stageIds: [], assignedToIds: [], origins: [], tags: [] });
  const [recOpen, setRecOpen] = useState(false);
  const [loading, setLoading] = useState<"draft" | "send" | null>(null);

  useEffect(() => {
    if (!open) return;
    setName(""); setTemplateId(""); setAb(false); setTemplateBId(""); setSchedule("NOW"); setScheduledAt(""); setRouteAi(true);
    setFilters({ stageIds: [], assignedToIds: [], origins: [], tags: [], ...initialFilters });
  }, [open, initialFilters]);
  useEffect(() => { if (open && channels?.length && !channelId) setChannelId(channels.find((c) => c.accountType === "COMPANY")?.id ?? channels[0].id); }, [open, channels, channelId]);

  const { data: prev } = useQuery({
    queryKey: ["campaign-preview", filters, templateId],
    queryFn: () => api<Preview>("/api/campaigns/preview", { body: { filters, templateId: templateId || null } }),
    enabled: open,
  });
  const tpl = templates?.find((t) => t.id === templateId) ?? null;
  const sampleContact = prev?.sample[0];
  const ctx = useMemo(() => buildVarContext(sampleContact ?? { name: "Mariana" }, { name: sampleContact?.assignedTo?.name ?? me?.user.name }, { name: me?.workspace.name }), [sampleContact, me]);
  const filterSummary = [
    filters.contactIds?.length ? `${filters.contactIds.length} contatos escolhidos` : null,
    filters.stageIds.length ? `${filters.stageIds.length} etapa(s)` : null,
    filters.assignedToIds.length ? `${filters.assignedToIds.length} corretor(es)` : null,
    filters.origins.length ? filters.origins.map((o) => ORIGIN_SHORT[o]).join(", ") : null,
    filters.tags.length ? filters.tags.map((t) => `#${t}`).join(" ") : null,
  ].filter(Boolean).join(" · ") || "Toda a base";

  async function create(draft: boolean) {
    setLoading(draft ? "draft" : "send");
    try {
      await api("/api/campaigns", {
        body: {
          name, channelId, templateId, abTestEnabled: ab, templateBId: ab ? templateBId : null,
          sendScheduleType: schedule, scheduledAt: schedule === "SCHEDULED" && scheduledAt ? new Date(scheduledAt).toISOString() : null,
          allowedSendUntilHour: limitHour ? until : null, routeRepliesToAi: routeAi, filters, draft,
        },
      });
      toast.success(draft ? "Rascunho salvo" : schedule === "NOW" ? "Disparo iniciado 🚀" : "Campanha agendada");
      onOpenChange(false);
      onCreated();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setLoading(null);
    }
  }

  const channel = channels?.find((c) => c.id === channelId);
  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent size="xl" title="Nova campanha" description="Disparo de modelo aprovado pela Meta para uma seleção de contatos.">
          <DialogBody className="grid gap-6 lg:grid-cols-[1fr_340px]">
            <div className="space-y-4">
              <Field label="Nome da campanha"><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Feirão MCMV — leads com visita agendada" /></Field>
              <Field label="Número remetente" hint="Dispare pelo número geral da empresa ou pelo número individual do corretor conectado.">
                <Select value={channelId} onChange={(e) => setChannelId(e.target.value)}>
                  {channels?.map((c) => <option key={c.id} value={c.id}>{c.accountType === "COMPANY" ? "🏢" : "📱"} {c.name} · {formatPhone(c.phoneNumber)} {c.status !== "CONNECTED" ? "(desconectado)" : ""}</option>)}
                </Select>
              </Field>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label={ab ? "Modelo A" : "Modelo aprovado"}>
                  <Select value={templateId} onChange={(e) => setTemplateId(e.target.value)}>
                    <option value="">Selecione…</option>
                    {templates?.map((t) => <option key={t.id} value={t.id}>{t.name} ({TEMPLATE_CATEGORY_LABELS[t.category]})</option>)}
                  </Select>
                </Field>
                {ab && (
                  <Field label="Modelo B">
                    <Select value={templateBId} onChange={(e) => setTemplateBId(e.target.value)}>
                      <option value="">Selecione…</option>
                      {templates?.filter((t) => t.id !== templateId).map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                    </Select>
                  </Field>
                )}
              </div>
              <label className="flex items-center justify-between rounded-lg border px-3 py-2.5">
                <span className="flex items-center gap-2 text-sm"><FlaskConical className="h-4 w-4 text-primary" /> Teste A/B <span className="text-xs text-muted-foreground">(metade recebe o modelo B)</span></span>
                <Switch checked={ab} onCheckedChange={setAb} />
              </label>
              <div className="rounded-lg border p-3">
                <p className="mb-2 text-xs font-semibold text-slate-600">Agendamento</p>
                <div className="flex flex-wrap gap-2">
                  <Chip active={schedule === "NOW"} onClick={() => setSchedule("NOW")}><Send className="mr-1 inline h-3 w-3" /> Enviar agora</Chip>
                  <Chip active={schedule === "SCHEDULED"} onClick={() => setSchedule("SCHEDULED")}><Calendar className="mr-1 inline h-3 w-3" /> Agendar data/hora</Chip>
                </div>
                {schedule === "SCHEDULED" && <Input type="datetime-local" className="mt-2 w-auto" value={scheduledAt} onChange={(e) => setScheduledAt(e.target.value)} />}
                <label className="mt-3 flex items-center gap-2 text-sm">
                  <Checkbox checked={limitHour} onChange={(e) => setLimitHour(e.target.checked)} />
                  <Clock className="h-4 w-4 text-muted-foreground" /> Enviar até as
                  <Input type="time" value={until} onChange={(e) => setUntil(e.target.value)} className="h-8 w-28" disabled={!limitHour} />
                  <span className="text-xs text-muted-foreground">(o restante continua no dia seguinte)</span>
                </label>
              </div>
              <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-secondary/30 bg-gradient-to-r from-primary/[0.03] to-secondary/[0.06] px-3 py-3">
                <Checkbox checked={routeAi} onChange={(e) => setRouteAi(e.target.checked)} className="mt-0.5" />
                <span>
                  <span className="flex items-center gap-1.5 text-sm font-medium"><Sparkles className="h-4 w-4 text-secondary" /> Entregar ao {me?.assistantName ?? "Téo"} quem responder</span>
                  <span className="block text-xs text-muted-foreground">Quando o cliente responder (ex.: “Eu quero!”), a IA assume a conversa e continua a qualificação.</span>
                </span>
              </label>
              <div className="flex items-center justify-between rounded-lg border p-3">
                <div>
                  <p className="text-xs font-semibold text-slate-600">Destinatários</p>
                  <p className="text-sm">{filterSummary}</p>
                </div>
                <Button size="sm" variant="outline" onClick={() => setRecOpen(true)}><Users /> Selecionar destinatários</Button>
              </div>
            </div>
            <div className="space-y-3">
              <div className="rounded-lg bg-slate-900 p-4 text-white">
                <p className="text-xs text-white/60">Destinatários</p>
                <p className="text-3xl font-semibold">{prev?.count ?? "…"}</p>
                <p className="mt-3 text-xs text-white/60">Custo estimado</p>
                <p className="text-2xl font-semibold">{formatBRL(prev?.estimatedCost ?? 0)}</p>
                <p className="mt-1 text-[11px] text-white/50">{prev?.count ?? 0} × {formatBRL(META_PRICING[prev?.category ?? "MARKETING"], { decimals: 4 })} ({TEMPLATE_CATEGORY_LABELS[prev?.category ?? "MARKETING"]})</p>
                {channel?.provider === "EVOLUTION_QR" && <Badge tone="amber" className="mt-2">Número QR: sem custo Meta, mas com risco de bloqueio em massa</Badge>}
              </div>
              {tpl ? (
                <WhatsAppPreview headerType={tpl.headerType} headerContent={tpl.headerContent} body={renderTemplate(tpl.bodyText, tpl.variableMappings, ctx)} footer={tpl.footerText} buttons={tpl.buttonsJson} businessName={me?.workspace.name} />
              ) : (
                <div className="flex h-48 items-center justify-center rounded-xl border border-dashed text-xs text-muted-foreground">Escolha um modelo para ver a prévia</div>
              )}
              {sampleContact && tpl && <p className="text-[11px] text-muted-foreground">Prévia com os dados de <strong>{sampleContact.name ?? "um contato sem nome"}</strong>.</p>}
            </div>
          </DialogBody>
          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button variant="outline" onClick={() => create(true)} loading={loading === "draft"} disabled={!name || !templateId}>Salvar rascunho</Button>
            <Button onClick={() => create(false)} loading={loading === "send"} disabled={!name || !templateId || !prev?.count || (ab && !templateBId) || (schedule === "SCHEDULED" && !scheduledAt)}>
              {schedule === "NOW" ? <><Send /> Disparar para {prev?.count ?? 0}</> : <><Calendar /> Agendar</>}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <RecipientsDialog open={recOpen} onOpenChange={setRecOpen} filters={filters} onChange={setFilters} templateId={templateId} />
    </>
  );
}
