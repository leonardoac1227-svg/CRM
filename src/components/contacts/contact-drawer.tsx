"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { CalendarPlus, CheckCircle2, Circle, FileText, Globe, Home, MessageCircle, MessageSquare, NotebookPen, Plus, Save, Sparkles, Trash2, TrendingUp, UserRound } from "lucide-react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { api } from "@/lib/client";
import { cn, formatBRL, formatDate, formatPhone, timeAgo } from "@/lib/utils";
import { EMPLOYMENT_LABELS, ORIGIN_LABELS, TASK_TYPE_LABELS } from "@/lib/constants";
import type { CatalogItem, Contact, Pipeline, Task } from "@/lib/types";
import { useCan, useMe, usePipelines, useTeam } from "@/hooks/use-me";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/input";
import { Avatar, Badge, EmptyState, Skeleton } from "@/components/ui/misc";
import { Dialog, DialogBody, DialogContent, DialogFooter, SheetContent, Switch, UnderlineTabs } from "@/components/ui/overlay";
import { AiBadge, OriginBadge, StageDot, TagChip } from "@/components/shared/badges";
import { TaskDialog } from "@/components/shared/task-dialog";

type Activity = { id: string; type: string; title: string; body: string | null; createdAt: string; user: { id: string; name: string } | null };
type FullContact = Omit<Contact, "conversations" | "pipeline"> & {
  pipeline: Pipeline | null;
  conversations: { id: string; status: string; lastMessageAt: string | null; lastMessagePreview: string | null; channel: { id: string; name: string; phoneNumber: string } | null; messages: { id: string; content: string; senderType: string; createdAt: string }[] }[];
  tasks: Task[];
  activities: Activity[];
  interestedItems: CatalogItem[];
  campaignRecipients: { id: string; status: string; sentAt: string | null; campaign: { id: string; name: string } }[];
};

type Tab = "tudo" | "conversas" | "anotacoes" | "tarefas" | "negocios" | "imoveis";

const ACTIVITY_ICON: Record<string, React.ReactNode> = {
  NOTE: <NotebookPen className="h-3.5 w-3.5" />,
  STAGE_CHANGE: <TrendingUp className="h-3.5 w-3.5" />,
  ASSIGNMENT: <UserRound className="h-3.5 w-3.5" />,
  AI_QUALIFICATION: <Sparkles className="h-3.5 w-3.5" />,
  INTERACTION: <MessageCircle className="h-3.5 w-3.5" />,
  CAMPAIGN: <MessageSquare className="h-3.5 w-3.5" />,
  SYSTEM: <Circle className="h-3.5 w-3.5" />,
};

function numOrNull(v: string) {
  if (v.trim() === "") return null;
  const n = Number(v.replace(/\./g, "").replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

function QualificationCard({ c, assistant }: { c: FullContact; assistant: string }) {
  if (!c.aiQualificationSummary) {
    const hasData = c.monthlyIncome || c.downPaymentAvailable || c.employmentType;
    if (!hasData) return null;
  }
  const temp = c.aiQualificationSummary?.match(/Temperatura: (\w+) \((\d+)\/100\)/);
  return (
    <div className="rounded-lg border border-secondary/20 bg-gradient-to-br from-primary/[0.04] to-secondary/[0.06] p-4">
      <div className="mb-3 flex items-center justify-between">
        <p className="flex items-center gap-1.5 text-sm font-semibold"><Sparkles className="h-4 w-4 text-secondary" /> Resumo da qualificação da IA</p>
        <div className="flex items-center gap-2">
          {temp && <Badge tone={temp[1] === "Quente" ? "red" : temp[1] === "Morno" ? "amber" : "blue"}>{temp[1]} · {temp[2]}</Badge>}
          <AiBadge name={assistant} />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {[
          ["Renda", c.monthlyIncome !== null ? formatBRL(c.monthlyIncome) : "—"],
          ["Entrada", c.downPaymentAvailable !== null ? formatBRL(c.downPaymentAvailable) : "—"],
          ["Perfil", c.employmentType ? EMPLOYMENT_LABELS[c.employmentType]?.split(" (")[0] : "—"],
          ["Interesse", c.interest ?? (c.dealValue ? `até ${formatBRL(c.dealValue, { compact: true })}` : "—")],
        ].map(([k, v]) => (
          <div key={k} className="rounded-md bg-white/80 px-3 py-2 ring-1 ring-slate-200/70">
            <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">{k}</p>
            <p className="truncate text-sm font-semibold">{v}</p>
          </div>
        ))}
      </div>
      {c.aiQualificationSummary && (
        <details className="mt-3">
          <summary className="cursor-pointer text-xs font-medium text-primary">Ver relatório completo</summary>
          <pre className="mt-2 whitespace-pre-wrap rounded-md bg-white p-3 font-sans text-xs leading-relaxed ring-1 ring-slate-200">{c.aiQualificationSummary}</pre>
        </details>
      )}
    </div>
  );
}

export function ContactDrawer({ contactId, onClose }: { contactId: string | null; onClose: () => void }) {
  const qc = useQueryClient();
  const { data: me } = useMe();
  const { isManager } = useCan();
  const { data: team } = useTeam();
  const { data: pipelines } = usePipelines();
  const [tab, setTab] = useState<Tab>("tudo");
  const [form, setForm] = useState<Record<string, string>>({});
  const [tagInput, setTagInput] = useState("");
  const [note, setNote] = useState("");
  const [interactionOpen, setInteractionOpen] = useState(false);
  const [taskOpen, setTaskOpen] = useState(false);

  const { data: c, isLoading } = useQuery({
    queryKey: ["contact", contactId],
    queryFn: () => api<FullContact>(`/api/contacts/${contactId}`),
    enabled: !!contactId,
  });

  useEffect(() => {
    if (!c) return;
    setForm({
      name: c.name ?? "", phone: c.phone, email: c.email ?? "", personType: c.personType, cpfCnpj: c.cpfCnpj ?? "",
      birthDate: c.birthDate ? c.birthDate.slice(0, 10) : "", address: c.address ?? "", city: c.city ?? "", state: c.state ?? "",
      neighborhood: c.neighborhood ?? "", profession: c.profession ?? "", maritalStatus: c.maritalStatus ?? "",
      monthlyIncome: c.monthlyIncome?.toString() ?? "", downPaymentAvailable: c.downPaymentAvailable?.toString() ?? "", fgtsBalance: c.fgtsBalance?.toString() ?? "",
      employmentType: c.employmentType ?? "", dealValue: c.dealValue?.toString() ?? "", origin: c.origin,
      seoLandingPage: c.seoLandingPage ?? "", seoKeyword: c.seoKeyword ?? "", utmCampaign: c.utmCampaign ?? "", trackingCode: c.trackingCode ?? "",
    });
  }, [c]);

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["contact", contactId] });
    qc.invalidateQueries({ queryKey: ["contacts"] });
    qc.invalidateQueries({ queryKey: ["board"] });
    qc.invalidateQueries({ queryKey: ["conversations"] });
  };

  const patch = useMutation({
    mutationFn: (data: Record<string, unknown>) => api(`/api/contacts/${contactId}`, { method: "PATCH", body: data }),
    onSuccess: () => invalidate(),
    onError: (e: Error) => toast.error(e.message),
  });

  const addActivity = useMutation({
    mutationFn: (data: { type: "NOTE" | "INTERACTION"; body: string; channel?: string }) => api(`/api/contacts/${contactId}/activities`, { body: data }),
    onSuccess: () => {
      setNote("");
      invalidate();
      toast.success("Registrado na timeline");
    },
  });

  const toggleTask = useMutation({
    mutationFn: (t: Task) => api(`/api/tasks/${t.id}`, { method: "PATCH", body: { isCompleted: !t.isCompleted } }),
    onSuccess: invalidate,
  });

  function save() {
    patch.mutate(
      {
        ...form,
        personType: form.personType || undefined,
        employmentType: form.employmentType || null,
        monthlyIncome: numOrNull(form.monthlyIncome ?? ""),
        downPaymentAvailable: numOrNull(form.downPaymentAvailable ?? ""),
        fgtsBalance: numOrNull(form.fgtsBalance ?? ""),
        dealValue: numOrNull(form.dealValue ?? ""),
        birthDate: form.birthDate || null,
      },
      { onSuccess: () => toast.success("Contato salvo") },
    );
  }

  const pipeline = useMemo(() => pipelines?.find((p) => p.id === c?.pipelineId) ?? c?.pipeline ?? null, [pipelines, c]);
  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const assistant = me?.assistantName ?? "Téo";
  const notes = c?.activities.filter((a) => a.type === "NOTE" || a.type === "INTERACTION") ?? [];

  return (
    <DialogPrimitive.Root open={!!contactId} onOpenChange={(o) => !o && onClose()}>
      <SheetContent width="max-w-[1100px]" title={undefined}>
        {isLoading || !c ? (
          <div className="space-y-3 p-6">
            <Skeleton className="h-8 w-64" />
            <Skeleton className="h-40 w-full" />
            <Skeleton className="h-64 w-full" />
          </div>
        ) : (
          <div className="flex h-full flex-col">
            {/* Cabeçalho */}
            <div className="flex flex-wrap items-center gap-3 border-b px-5 py-4 pr-14">
              <Avatar name={c.name} size={44} />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="truncate text-lg font-semibold">{c.name ?? "Sem nome"}</h2>
                  <Badge tone={c.status === "WON" ? "green" : c.status === "LOST" ? "red" : "slate"}>{c.status === "WON" ? "Ganho" : c.status === "LOST" ? "Perdido" : "Em aberto"}</Badge>
                  {c.trackingCode && <Badge tone="green"><Globe className="h-3 w-3" /> {c.trackingCode}</Badge>}
                </div>
                <p className="text-xs text-muted-foreground">{formatPhone(c.phone)} · criado {formatDate(c.createdAt)} · última interação {timeAgo(c.lastInteractionAt)}</p>
              </div>
              <div className="flex items-center gap-2">
                {c.conversations[0] && (
                  <Button asChild size="sm" variant="outline" onClick={onClose}>
                    <Link href={`/atendimento?conversa=${c.conversations[0].id}`}><MessageCircle /> Atender</Link>
                  </Button>
                )}
                <Button size="sm" variant="outline" onClick={() => setTaskOpen(true)}><CalendarPlus /> Tarefa</Button>
              </div>
            </div>

            <div className="grid min-h-0 flex-1 grid-cols-1 overflow-y-auto md:grid-cols-[380px_1fr] md:overflow-hidden">
              {/* Coluna esquerda: dados cadastrais */}
              <div className="space-y-4 border-r bg-slate-50/50 p-5 md:overflow-y-auto scrollbar-thin">
                <div>
                  <p className="mb-1.5 text-xs font-medium text-slate-600">Etiquetas</p>
                  <div className="flex flex-wrap items-center gap-1.5">
                    {c.tags.map((t) => <TagChip key={t} tag={t} onRemove={() => patch.mutate({ tags: c.tags.filter((x) => x !== t) })} />)}
                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        const t = tagInput.trim().toLowerCase().replace(/^#/, "");
                        if (t && !c.tags.includes(t)) patch.mutate({ tags: [...c.tags, t] });
                        setTagInput("");
                      }}
                    >
                      <input value={tagInput} onChange={(e) => setTagInput(e.target.value)} placeholder="+ etiqueta" className="w-24 rounded-md border border-dashed bg-transparent px-1.5 py-0.5 text-[11px] outline-none focus:border-primary" />
                    </form>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Funil / Etapa" className="col-span-2">
                    <Select value={c.stageId ?? ""} onChange={(e) => patch.mutate({ stageId: e.target.value })}>
                      {(pipelines ?? []).map((p) => (
                        <optgroup key={p.id} label={p.name}>
                          {p.stages.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                        </optgroup>
                      ))}
                    </Select>
                  </Field>
                  <Field label="Responsável" className="col-span-2">
                    <Select value={c.assignedToId ?? ""} disabled={!isManager && me?.user.role !== "ASSISTANT"} onChange={(e) => patch.mutate({ assignedToId: e.target.value || null })}>
                      <option value="">Sem responsável</option>
                      {(team ?? []).filter((u) => u.isActive).map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
                    </Select>
                  </Field>
                </div>
                <label className="flex items-center justify-between rounded-lg border bg-white px-3 py-2.5">
                  <span className="flex items-center gap-2 text-sm font-medium"><Sparkles className="h-4 w-4 text-secondary" /> Qualificar com IA ({assistant})</span>
                  <Switch checked={c.aiQualificationEnabled} onCheckedChange={(v) => patch.mutate({ aiQualificationEnabled: v })} />
                </label>

                <div className="space-y-3 rounded-lg border bg-white p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Dados cadastrais</p>
                  <Field label="Nome"><Input value={form.name ?? ""} onChange={set("name")} /></Field>
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Telefone"><Input value={form.phone ?? ""} onChange={set("phone")} /></Field>
                    <Field label="E-mail"><Input value={form.email ?? ""} onChange={set("email")} /></Field>
                    <Field label="Tipo">
                      <Select value={form.personType ?? "PF"} onChange={set("personType")}><option value="PF">Pessoa Física</option><option value="PJ">Pessoa Jurídica</option></Select>
                    </Field>
                    <Field label={form.personType === "PJ" ? "CNPJ" : "CPF"}><Input value={form.cpfCnpj ?? ""} onChange={set("cpfCnpj")} /></Field>
                    <Field label="Nascimento"><Input type="date" value={form.birthDate ?? ""} onChange={set("birthDate")} /></Field>
                    <Field label="Estado civil"><Input value={form.maritalStatus ?? ""} onChange={set("maritalStatus")} /></Field>
                  </div>
                  <Field label="Endereço"><Input value={form.address ?? ""} onChange={set("address")} /></Field>
                  <div className="grid grid-cols-3 gap-3">
                    <Field label="Cidade" className="col-span-1"><Input value={form.city ?? ""} onChange={set("city")} /></Field>
                    <Field label="UF"><Input value={form.state ?? ""} maxLength={2} onChange={set("state")} /></Field>
                    <Field label="Bairro"><Input value={form.neighborhood ?? ""} onChange={set("neighborhood")} /></Field>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Profissão"><Input value={form.profession ?? ""} onChange={set("profession")} /></Field>
                    <Field label="Trabalho">
                      <Select value={form.employmentType ?? ""} onChange={set("employmentType")}>
                        <option value="">—</option>
                        {Object.entries(EMPLOYMENT_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                      </Select>
                    </Field>
                    <Field label="Renda familiar (R$)"><Input inputMode="decimal" value={form.monthlyIncome ?? ""} onChange={set("monthlyIncome")} /></Field>
                    <Field label="Valor de entrada (R$)"><Input inputMode="decimal" value={form.downPaymentAvailable ?? ""} onChange={set("downPaymentAvailable")} /></Field>
                    <Field label="FGTS (R$)"><Input inputMode="decimal" value={form.fgtsBalance ?? ""} onChange={set("fgtsBalance")} /></Field>
                    <Field label="Valor do negócio (R$)"><Input inputMode="decimal" value={form.dealValue ?? ""} onChange={set("dealValue")} /></Field>
                  </div>
                </div>

                <div className="space-y-3 rounded-lg border bg-white p-4">
                  <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground"><Globe className="h-3.5 w-3.5" /> Origem & SEO</p>
                  <Field label="Origem">
                    <Select value={form.origin ?? "MANUAL"} onChange={set("origin")}>
                      {Object.entries(ORIGIN_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                    </Select>
                  </Field>
                  <Field label="Página de conversão"><Input value={form.seoLandingPage ?? ""} onChange={set("seoLandingPage")} placeholder="https://site.com.br/blog/..." /></Field>
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Palavra-chave / UTM"><Input value={form.seoKeyword ?? ""} onChange={set("seoKeyword")} /></Field>
                    <Field label="Código de rastreio"><Input value={form.trackingCode ?? ""} onChange={set("trackingCode")} placeholder="#SEO-0000" /></Field>
                  </div>
                  {c.seoReferrer && <p className="text-[11px] text-muted-foreground">Referência: {c.seoReferrer}</p>}
                </div>
                <div className="sticky bottom-0 -mx-5 -mb-5 flex justify-between gap-2 border-t bg-white/95 px-5 py-3 backdrop-blur">
                  {isManager && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-red-600"
                      onClick={async () => {
                        if (!confirm("Excluir este contato e todo o histórico?")) return;
                        await api(`/api/contacts/${c.id}`, { method: "DELETE" });
                        invalidate();
                        onClose();
                        toast.success("Contato excluído");
                      }}
                    >
                      <Trash2 /> Excluir
                    </Button>
                  )}
                  <Button size="sm" onClick={save} loading={patch.isPending} className="ml-auto"><Save /> Salvar alterações</Button>
                </div>
              </div>

              {/* Coluna direita: histórico */}
              <div className="flex min-h-0 flex-col md:overflow-hidden">
                <div className="flex items-center justify-between gap-3 px-5 pt-4">
                  <UnderlineTabs
                    value={tab}
                    onChange={setTab}
                    items={[
                      { value: "tudo", label: "Tudo" },
                      { value: "conversas", label: `Conversas (${c.conversations.length})` },
                      { value: "anotacoes", label: `Anotações (${notes.length})` },
                      { value: "tarefas", label: `Tarefas (${c.tasks.length})` },
                      { value: "negocios", label: "Negócios" },
                      { value: "imoveis", label: `Imóveis (${c.interestedItems.length})` },
                    ]}
                  />
                  <Button size="xs" variant="soft" onClick={() => setInteractionOpen(true)}><Plus /> Registrar interação</Button>
                </div>
                <div className="flex-1 space-y-4 overflow-y-auto p-5 scrollbar-thin">
                  {(tab === "tudo" || tab === "negocios") && <QualificationCard c={c} assistant={assistant} />}

                  {tab === "tudo" && (
                    <>
                      <form
                        onSubmit={(e) => {
                          e.preventDefault();
                          if (note.trim()) addActivity.mutate({ type: "NOTE", body: note.trim() });
                        }}
                        className="flex gap-2"
                      >
                        <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Escreva uma anotação rápida…" />
                        <Button type="submit" size="sm" variant="outline" loading={addActivity.isPending}>Anotar</Button>
                      </form>
                      <ol className="relative space-y-4 border-l pl-5">
                        {c.activities.map((a) => (
                          <li key={a.id} className="relative">
                            <span className={cn("absolute -left-[29px] flex h-6 w-6 items-center justify-center rounded-full border bg-white text-slate-500", a.type === "AI_QUALIFICATION" && "border-secondary/30 text-secondary", a.type === "STAGE_CHANGE" && "text-primary")}>
                              {ACTIVITY_ICON[a.type]}
                            </span>
                            <p className="text-sm font-medium">{a.title}</p>
                            <p className="text-[11px] text-muted-foreground">{formatDate(a.createdAt, true)}{a.user ? ` · ${a.user.name}` : ""}</p>
                            {a.body && <p className="mt-1 whitespace-pre-wrap rounded-md bg-slate-50 p-2 text-xs text-slate-700 ring-1 ring-slate-200/60">{a.body.length > 600 ? a.body.slice(0, 600) + "…" : a.body}</p>}
                          </li>
                        ))}
                        {!c.activities.length && <p className="text-xs text-muted-foreground">Sem histórico ainda.</p>}
                      </ol>
                    </>
                  )}

                  {tab === "conversas" && (
                    <div className="space-y-2">
                      {!c.conversations.length && <EmptyState icon={<MessageCircle className="h-5 w-5" />} title="Nenhuma conversa" description="Inicie uma conversa pelo Atendimento." />}
                      {c.conversations.map((cv) => (
                        <Link key={cv.id} href={`/atendimento?conversa=${cv.id}`} onClick={onClose} className="block rounded-lg border p-3 hover:border-primary/40 hover:bg-primary/[0.02]">
                          <div className="flex items-center justify-between">
                            <p className="text-sm font-medium">{cv.channel?.name ?? "WhatsApp"} <span className="text-xs text-muted-foreground">{formatPhone(cv.channel?.phoneNumber)}</span></p>
                            <span className="text-xs text-muted-foreground">{timeAgo(cv.lastMessageAt)}</span>
                          </div>
                          {cv.messages.slice().reverse().map((m) => (
                            <p key={m.id} className={cn("mt-1 truncate text-xs", m.senderType === "CONTACT" ? "text-slate-700" : "text-primary")}>{m.senderType === "CONTACT" ? "Cliente: " : m.senderType === "AI_AGENT" ? `${assistant}: ` : "Equipe: "}{m.content}</p>
                          ))}
                        </Link>
                      ))}
                    </div>
                  )}

                  {tab === "anotacoes" && (
                    <div className="space-y-3">
                      <form onSubmit={(e) => { e.preventDefault(); if (note.trim()) addActivity.mutate({ type: "NOTE", body: note.trim() }); }} className="space-y-2">
                        <Textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="Nova anotação…" rows={3} />
                        <div className="flex justify-end"><Button size="sm" type="submit" loading={addActivity.isPending}>Salvar anotação</Button></div>
                      </form>
                      {notes.map((a) => (
                        <div key={a.id} className="rounded-lg border bg-amber-50/40 p-3">
                          <p className="text-[11px] text-muted-foreground">{a.title} · {formatDate(a.createdAt, true)} · {a.user?.name}</p>
                          <p className="mt-1 whitespace-pre-wrap text-sm">{a.body}</p>
                        </div>
                      ))}
                    </div>
                  )}

                  {tab === "tarefas" && (
                    <div className="space-y-2">
                      <Button size="sm" variant="outline" onClick={() => setTaskOpen(true)}><Plus /> Nova tarefa</Button>
                      {c.tasks.map((t) => (
                        <div key={t.id} className="flex items-center gap-3 rounded-lg border p-3">
                          <button onClick={() => toggleTask.mutate(t)} className={t.isCompleted ? "text-success" : "text-slate-300 hover:text-slate-500"}>
                            <CheckCircle2 className="h-5 w-5" />
                          </button>
                          <div className="min-w-0 flex-1">
                            <p className={cn("text-sm font-medium", t.isCompleted && "line-through text-muted-foreground")}>{t.title}</p>
                            <p className="text-xs text-muted-foreground">{TASK_TYPE_LABELS[t.type]} · {formatDate(t.dueDate, true)} · {t.assignedTo?.name}</p>
                          </div>
                          {!t.isCompleted && new Date(t.dueDate) < new Date() && <Badge tone="red">Atrasada</Badge>}
                        </div>
                      ))}
                      {!c.tasks.length && <p className="text-xs text-muted-foreground">Nenhuma tarefa.</p>}
                    </div>
                  )}

                  {tab === "negocios" && (
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="rounded-lg border p-4">
                        <p className="text-xs text-muted-foreground">Funil atual</p>
                        <p className="mt-1 flex items-center gap-2 text-sm font-semibold">{c.stage && <StageDot color={c.stage.color} />} {pipeline?.name} → {c.stage?.name}</p>
                        <p className="mt-1 text-xs text-muted-foreground">Na etapa há {timeAgo(c.stageChangedAt)}</p>
                        {pipeline && (
                          <div className="mt-3 flex gap-1">
                            {pipeline.stages.map((s) => (
                              <button key={s.id} title={s.name} onClick={() => patch.mutate({ stageId: s.id })} className="h-2 flex-1 rounded-full" style={{ backgroundColor: s.order <= (pipeline.stages.find((x) => x.id === c.stageId)?.order ?? -1) ? s.color : "#e2e8f0" }} />
                            ))}
                          </div>
                        )}
                      </div>
                      <div className="rounded-lg border p-4">
                        <p className="text-xs text-muted-foreground">Valor do negócio</p>
                        <p className="mt-1 text-2xl font-semibold">{c.dealValue ? formatBRL(c.dealValue) : "—"}</p>
                        <div className="mt-3 flex gap-2">
                          <Button size="xs" variant="success" onClick={() => patch.mutate({ status: "WON" })}>Marcar ganho</Button>
                          <Button size="xs" variant="outline" onClick={() => patch.mutate({ status: "LOST" })}>Marcar perdido</Button>
                          {c.status !== "OPEN" && <Button size="xs" variant="ghost" onClick={() => patch.mutate({ status: "OPEN" })}>Reabrir</Button>}
                        </div>
                      </div>
                      <div className="rounded-lg border p-4 sm:col-span-2">
                        <p className="mb-2 text-xs font-semibold text-muted-foreground">Campanhas recebidas</p>
                        {c.campaignRecipients.length ? c.campaignRecipients.map((r) => (
                          <p key={r.id} className="flex justify-between text-sm"><span>{r.campaign.name}</span><span className="text-xs text-muted-foreground">{r.status} · {formatDate(r.sentAt)}</span></p>
                        )) : <p className="text-xs text-muted-foreground">Nenhuma.</p>}
                      </div>
                    </div>
                  )}

                  {tab === "imoveis" && (
                    <div className="grid gap-3 sm:grid-cols-2">
                      {!c.interestedItems.length && <EmptyState className="sm:col-span-2" icon={<Home className="h-5 w-5" />} title="Nenhum imóvel vinculado" description={`Quando o ${assistant} recomendar imóveis do catálogo, eles aparecem aqui.`} />}
                      {c.interestedItems.map((i) => (
                        <div key={i.id} className="overflow-hidden rounded-lg border">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          {i.images[0] && <img src={i.images[0]} alt={i.title} className="h-28 w-full object-cover" />}
                          <div className="p-3">
                            <p className="text-sm font-medium">{i.title}</p>
                            <p className="text-xs text-muted-foreground">{i.code} · {i.neighborhood} · {i.price ? formatBRL(i.price) : "—"}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>

            <InteractionDialog open={interactionOpen} onOpenChange={setInteractionOpen} onSave={(d) => addActivity.mutate({ type: "INTERACTION", ...d }, { onSuccess: () => setInteractionOpen(false) })} loading={addActivity.isPending} />
            <TaskDialog open={taskOpen} onOpenChange={setTaskOpen} contact={{ id: c.id, name: c.name }} onSaved={invalidate} />
          </div>
        )}
      </SheetContent>
    </DialogPrimitive.Root>
  );
}

function InteractionDialog({ open, onOpenChange, onSave, loading }: { open: boolean; onOpenChange: (v: boolean) => void; onSave: (d: { body: string; channel: string }) => void; loading: boolean }) {
  const [channel, setChannel] = useState("Ligação");
  const [text, setText] = useState("");
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title="Registrar interação" description="Ligações, visitas presenciais, e-mails… tudo fica na timeline do contato." size="sm">
        <DialogBody className="space-y-3">
          <Field label="Canal">
            <Select value={channel} onChange={(e) => setChannel(e.target.value)}>
              {["Ligação", "Visita presencial", "E-mail", "WhatsApp pessoal", "Reunião", "Outro"].map((c) => <option key={c}>{c}</option>)}
            </Select>
          </Field>
          <Field label="O que aconteceu?"><Textarea value={text} onChange={(e) => setText(e.target.value)} rows={4} /></Field>
        </DialogBody>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button disabled={!text.trim()} loading={loading} onClick={() => { onSave({ body: text, channel }); setText(""); }}><FileText /> Registrar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
