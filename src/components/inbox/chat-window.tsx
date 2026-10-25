"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowLeft, Clock, FlaskConical, IdCard, Lock, MoreVertical, Sparkles, XCircle, RotateCcw, Bot, Loader2 } from "lucide-react";
import { api } from "@/lib/client";
import { formatPhone, timeAgo } from "@/lib/utils";
import type { ConversationDetail, TeamUser } from "@/lib/types";
import { useCan } from "@/hooks/use-me";
import { Button } from "@/components/ui/button";
import { Avatar, Badge } from "@/components/ui/misc";
import { Field, Input, Textarea } from "@/components/ui/input";
import { Dialog, DialogBody, DialogContent, DialogFooter, DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/overlay";
import { StageDot } from "@/components/shared/badges";
import { MessageBubble } from "./message-bubble";
import { Composer, type OutgoingMessage } from "./composer";
import { TemplatePicker } from "./template-picker";
import { ContactSidePanel } from "./contact-side-panel";

function dayLabel(d: Date) {
  const today = new Date();
  const y = new Date();
  y.setDate(today.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return "Hoje";
  if (d.toDateString() === y.toDateString()) return "Ontem";
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "long" });
}

export function ChatWindow({ id, team, assistantName, onBack }: { id: string; team: TeamUser[]; assistantName: string; onBack: () => void }) {
  const qc = useQueryClient();
  const { me, isManager } = useCan();
  const [panel, setPanel] = useState(false);
  const [tplOpen, setTplOpen] = useState(false);
  const [simOpen, setSimOpen] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  const { data: conv, isLoading } = useQuery({
    queryKey: ["conversation", id],
    queryFn: () => api<ConversationDetail>(`/api/conversations/${id}`),
    refetchInterval: 15_000,
  });

  useEffect(() => {
    if (conv && conv.unreadCount > 0) api(`/api/conversations/${id}/read`, { method: "POST" }).then(() => qc.invalidateQueries({ queryKey: ["conversations"] }));
  }, [conv, id, qc]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [conv?.messages.length]);

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["conversation", id] });
    qc.invalidateQueries({ queryKey: ["conversations"] });
  };

  const send = useMutation({
    mutationFn: (m: OutgoingMessage) => api(`/api/conversations/${id}/messages`, { body: m }),
    onSuccess: refresh,
    onError: (e: Error) => toast.error(e.message),
  });
  const patchConv = useMutation({
    mutationFn: (data: Record<string, unknown>) => api(`/api/conversations/${id}`, { method: "PATCH", body: data }),
    onSuccess: refresh,
    onError: (e: Error) => toast.error(e.message),
  });
  const patchContact = useMutation({
    mutationFn: (data: Record<string, unknown>) => api(`/api/contacts/${conv!.contact.id}`, { method: "PATCH", body: data }),
    onSuccess: () => {
      refresh();
      qc.invalidateQueries({ queryKey: ["contact", conv?.contact.id] });
      toast.success("Atualizado");
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const sendTemplate = useMutation({
    mutationFn: (templateId: string) => api(`/api/conversations/${id}/template`, { body: { templateId } }),
    onSuccess: () => {
      setTplOpen(false);
      refresh();
      toast.success("Modelo enviado. A janela reabre quando o cliente responder.");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const grouped = useMemo(() => {
    const out: { day: string; items: ConversationDetail["messages"] }[] = [];
    for (const m of conv?.messages ?? []) {
      const d = dayLabel(new Date(m.createdAt));
      if (out[out.length - 1]?.day !== d) out.push({ day: d, items: [] });
      out[out.length - 1].items.push(m);
    }
    return out;
  }, [conv?.messages]);

  if (isLoading || !conv) {
    return <div className="flex flex-1 items-center justify-center bg-chat"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  }

  const c = conv.contact;
  const isMeta = conv.channel?.provider === "META_OFFICIAL";
  const windowClosed = isMeta && !conv.windowOpen;
  const expiresIn = conv.metaWindowExpiresAt ? new Date(conv.metaWindowExpiresAt).getTime() - Date.now() : 0;
  const aiStep = conv.aiState?.step;
  const canAssign = isManager || me?.user.role === "ASSISTANT";

  return (
    <div className="flex min-w-0 flex-1">
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Header do chat */}
        <div className="flex flex-wrap items-center gap-2 border-b bg-white px-3 py-2.5 md:px-4">
          <button onClick={onBack} className="rounded-md p-1.5 hover:bg-muted md:hidden"><ArrowLeft className="h-4 w-4" /></button>
          <Avatar name={c.name ?? c.phone} size={38} />
          <div className="mr-auto min-w-0">
            <p className="truncate text-sm font-semibold">{c.name ?? "Sem nome"}</p>
            <p className="flex items-center gap-1.5 truncate text-xs text-muted-foreground">
              {formatPhone(c.phone)} <span className="hidden sm:inline">· via {conv.channel?.name}</span>
            </p>
          </div>
          {/* Etapa do funil */}
          <DropdownMenu>
            <DropdownMenuTrigger className="flex h-8 items-center gap-1.5 rounded-full border bg-white px-3 text-xs font-medium hover:bg-muted">
              {c.stage && <StageDot color={c.stage.color} />} {c.stage?.name ?? "Sem etapa"} ▾
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>{c.pipeline?.name ?? "Funil"}</DropdownMenuLabel>
              {c.pipeline?.stages.map((s) => (
                <DropdownMenuItem key={s.id} onSelect={() => patchContact.mutate({ stageId: s.id })}>
                  <StageDot color={s.color} /> {s.name} {s.id === c.stageId && "✓"}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          {/* Responsável */}
          <DropdownMenu>
            <DropdownMenuTrigger disabled={!canAssign} className="flex h-8 items-center gap-1.5 rounded-full border bg-white px-3 text-xs font-medium hover:bg-muted disabled:opacity-70">
              {conv.assignedTo ? <Avatar name={conv.assignedTo.name} size={18} /> : null} {conv.assignedTo?.name.split(" ")[0] ?? "Sem responsável"} {canAssign && "▾"}
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>Transferir para</DropdownMenuLabel>
              <DropdownMenuItem onSelect={() => patchConv.mutate({ assignedToId: null })}>Sem responsável</DropdownMenuItem>
              {team.filter((u) => u.isActive).map((u) => (
                <DropdownMenuItem key={u.id} onSelect={() => patchConv.mutate({ assignedToId: u.id })}>
                  <Avatar name={u.name} size={18} /> {u.name} {u.id === conv.assignedTo?.id && "✓"}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          <Button size="sm" variant={panel ? "soft" : "outline"} onClick={() => setPanel((v) => !v)}><IdCard /> <span className="hidden lg:inline">Ficha do contato</span></Button>
          <Button size="sm" variant={conv.aiActive ? "ai" : "outline"} loading={patchConv.isPending} onClick={() => patchConv.mutate({ aiActive: !conv.aiActive }, { onSuccess: () => toast.success(conv.aiActive ? `${assistantName} desligado — você assumiu a conversa` : `${assistantName} assumiu a conversa ✨`) })}>
            <Sparkles /> {conv.aiActive ? `${assistantName} ativo` : "Qualificar com IA"}
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger className="rounded-md p-1.5 hover:bg-muted"><MoreVertical className="h-4 w-4" /></DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {conv.aiActive && <DropdownMenuItem onSelect={() => patchConv.mutate({ finishAi: true })}><Bot /> Finalizar qualificação e distribuir</DropdownMenuItem>}
              {conv.status !== "CLOSED" ? (
                <DropdownMenuItem onSelect={() => patchConv.mutate({ status: "CLOSED" })}><XCircle /> Encerrar conversa</DropdownMenuItem>
              ) : (
                <DropdownMenuItem onSelect={() => patchConv.mutate({ status: "OPEN" })}><RotateCcw /> Reabrir conversa</DropdownMenuItem>
              )}
              {me?.demoMode && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onSelect={() => setSimOpen(true)}><FlaskConical /> Simular mensagem do cliente</DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {conv.aiActive && (
          <div className="flex items-center gap-2 border-b bg-gradient-to-r from-primary/[0.06] to-secondary/[0.08] px-4 py-1.5 text-xs text-secondary">
            <Sparkles className="h-3.5 w-3.5" />
            <span className="font-medium">{assistantName} está atendendo esta conversa</span>
            <span className="text-muted-foreground">· {Object.keys(conv.aiState?.answered ?? {}).length} perguntas respondidas{aiStep === "QUALIFYING" ? " · qualificando" : ""}</span>
            <span className="ml-auto text-muted-foreground">Responder manualmente desliga a IA</span>
          </div>
        )}

        {/* Mensagens */}
        <div className="flex-1 space-y-2 overflow-y-auto bg-chat px-3 py-4 scrollbar-thin md:px-8">
          {grouped.map((g) => (
            <div key={g.day} className="space-y-2">
              <div className="sticky top-0 z-10 flex justify-center py-1">
                <span className="rounded-full bg-white/90 px-3 py-0.5 text-[11px] font-medium text-slate-500 shadow-sm">{g.day}</span>
              </div>
              {g.items.map((m) => <MessageBubble key={m.id} m={m} assistantName={assistantName} />)}
            </div>
          ))}
          <div ref={endRef} />
        </div>

        {/* Rodapé: janela de 24h ou composer */}
        {conv.status === "CLOSED" ? (
          <div className="flex items-center justify-between gap-3 border-t bg-slate-50 px-4 py-3 text-sm text-muted-foreground">
            <span className="flex items-center gap-2"><Lock className="h-4 w-4" /> Conversa encerrada</span>
            <Button size="sm" variant="outline" onClick={() => patchConv.mutate({ status: "OPEN" })}>Reabrir</Button>
          </div>
        ) : windowClosed ? (
          <div className="flex flex-col items-start justify-between gap-3 border-t bg-amber-50 px-4 py-3 sm:flex-row sm:items-center">
            <div className="flex items-start gap-2 text-xs text-amber-900">
              <Clock className="mt-0.5 h-4 w-4 shrink-0" />
              <span><strong>Janela de 24h encerrada.</strong> A última mensagem do cliente foi {timeAgo(conv.metaWindowExpiresAt ? new Date(new Date(conv.metaWindowExpiresAt).getTime() - 86400000) : null)} atrás. Pela regra da Meta, só é possível reabrir com um modelo aprovado.</span>
            </div>
            <Button size="sm" onClick={() => setTplOpen(true)}>Enviar Modelo Aprovado (Meta)</Button>
          </div>
        ) : (
          <>
            {isMeta && expiresIn > 0 && expiresIn < 3 * 3600000 && (
              <p className="border-t bg-amber-50 px-4 py-1 text-[11px] text-amber-800">⏳ A janela de 24h fecha em {Math.max(1, Math.round(expiresIn / 60000))} min.</p>
            )}
            <Composer onSend={(m) => send.mutateAsync(m)} sending={send.isPending} />
          </>
        )}
      </div>

      {panel && <ContactSidePanel contactId={c.id} onClose={() => setPanel(false)} assistantName={assistantName} />}

      <TemplatePicker
        open={tplOpen}
        onOpenChange={setTplOpen}
        contact={c}
        brokerName={conv.assignedTo?.name}
        workspaceName={me?.workspace.name}
        onSend={(tid) => sendTemplate.mutate(tid)}
        sending={sendTemplate.isPending}
      />
      <SimulateDialog open={simOpen} onOpenChange={setSimOpen} channelId={conv.channel?.id ?? ""} phone={c.phone} name={c.name ?? ""} onDone={refresh} />
    </div>
  );
}

export function SimulateDialog({ open, onOpenChange, channelId, phone, name, onDone }: { open: boolean; onOpenChange: (v: boolean) => void; channelId: string; phone?: string; name?: string; onDone?: (r: { conversationId?: string }) => void }) {
  const [form, setForm] = useState({ from: phone ?? "", name: name ?? "", text: "" });
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    if (open) setForm({ from: phone ?? "", name: name ?? "", text: "" });
  }, [open, phone, name]);
  async function go() {
    setLoading(true);
    try {
      const r = await api<{ conversationId?: string }>(`/api/channels/${channelId}/simulate`, { body: form });
      onOpenChange(false);
      onDone?.(r);
      toast.success("Mensagem recebida (simulação)");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setLoading(false);
    }
  }
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title="Simular mensagem recebida" description="Passa pelo mesmo fluxo do webhook: cria o lead, aplica o rastreio SEO e aciona o Téo." size="sm">
        <DialogBody className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Field label="WhatsApp do cliente"><Input value={form.from} onChange={(e) => setForm({ ...form, from: e.target.value })} placeholder="75 99999-0000" /></Field>
            <Field label="Nome no perfil"><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
          </div>
          <Field label="Mensagem" hint={<>Dica: inclua <code>[Ref: #SEO-5017]</code> para testar o vínculo com a página do Google.</>}>
            <Textarea rows={3} value={form.text} onChange={(e) => setForm({ ...form, text: e.target.value })} placeholder="Oi, vi o anúncio do apartamento…" />
          </Field>
          <Badge tone="amber">Modo demonstração</Badge>
        </DialogBody>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={go} loading={loading} disabled={!form.text.trim() || form.from.replace(/\D/g, "").length < 10}>Receber mensagem</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
