"use client";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { api } from "@/lib/client";
import { formatPhone } from "@/lib/utils";
import type { Channel, Template } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/input";
import { Dialog, DialogBody, DialogContent, DialogFooter } from "@/components/ui/overlay";
import { ContactPicker } from "@/components/shared/contact-picker";

export function NewConversationDialog({ open, onOpenChange, channels, onCreated }: { open: boolean; onOpenChange: (v: boolean) => void; channels: Channel[]; onCreated: (id: string) => void }) {
  const [mode, setMode] = useState<"existing" | "new">("existing");
  const [contact, setContact] = useState<{ id: string; name: string | null } | null>(null);
  const [phone, setPhone] = useState("");
  const [name, setName] = useState("");
  const [channelId, setChannelId] = useState("");
  const [templateId, setTemplateId] = useState("");
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const channel = channels.find((c) => c.id === channelId);
  const needsTemplate = channel?.provider === "META_OFFICIAL";
  const { data: templates } = useQuery({ queryKey: ["templates", "APPROVED"], queryFn: () => api<Template[]>("/api/templates?status=APPROVED"), enabled: open });

  useEffect(() => {
    if (open) {
      setChannelId(channels.find((c) => c.status === "CONNECTED")?.id ?? channels[0]?.id ?? "");
      setContact(null); setPhone(""); setName(""); setText(""); setTemplateId("");
    }
  }, [open, channels]);

  async function create() {
    setLoading(true);
    try {
      const conv = await api<{ id: string }>("/api/conversations", {
        body: {
          channelId,
          contactId: mode === "existing" ? contact?.id : undefined,
          phone: mode === "new" ? phone : undefined,
          name: mode === "new" ? name : undefined,
          templateId: needsTemplate ? templateId || undefined : undefined,
          text: !needsTemplate ? text || undefined : undefined,
        },
      });
      onOpenChange(false);
      onCreated(conv.id);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title="Nova conversa" size="md">
        <DialogBody className="space-y-3">
          <Field label="Enviar pelo número">
            <Select value={channelId} onChange={(e) => setChannelId(e.target.value)}>
              {channels.map((c) => <option key={c.id} value={c.id}>{c.name} · {formatPhone(c.phoneNumber)} ({c.provider === "META_OFFICIAL" ? "API Oficial" : "QR Code"})</option>)}
            </Select>
          </Field>
          <div className="flex gap-1 rounded-lg bg-muted p-1 text-xs">
            <button onClick={() => setMode("existing")} className={`flex-1 rounded-md py-1.5 font-medium ${mode === "existing" ? "bg-white shadow-sm" : "text-muted-foreground"}`}>Contato existente</button>
            <button onClick={() => setMode("new")} className={`flex-1 rounded-md py-1.5 font-medium ${mode === "new" ? "bg-white shadow-sm" : "text-muted-foreground"}`}>Novo número</button>
          </div>
          {mode === "existing" ? (
            <Field label="Contato"><ContactPicker value={contact} onChange={setContact} /></Field>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              <Field label="WhatsApp"><Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="(75) 99999-0000" /></Field>
              <Field label="Nome (opcional)"><Input value={name} onChange={(e) => setName(e.target.value)} /></Field>
            </div>
          )}
          {needsTemplate ? (
            <Field label="Modelo aprovado (obrigatório na API Oficial)" hint="A Meta exige um modelo aprovado para iniciar conversas.">
              <Select value={templateId} onChange={(e) => setTemplateId(e.target.value)}>
                <option value="">Selecione…</option>
                {(templates ?? []).map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
              </Select>
            </Field>
          ) : (
            <Field label="Mensagem"><Textarea rows={3} value={text} onChange={(e) => setText(e.target.value)} placeholder="Olá! Tudo bem?" /></Field>
          )}
        </DialogBody>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={create} loading={loading} disabled={!channelId || (mode === "existing" ? !contact : phone.replace(/\D/g, "").length < 10) || (needsTemplate && !templateId)}>Iniciar conversa</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
