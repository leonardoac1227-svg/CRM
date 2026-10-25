"use client";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { api } from "@/lib/client";
import { ORIGIN_LABELS } from "@/lib/constants";
import { useCan, usePipelines, useTeam } from "@/hooks/use-me";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/input";
import { Dialog, DialogBody, DialogContent, DialogFooter } from "@/components/ui/overlay";

export function CreateContactDialog({ open, onOpenChange, onCreated }: { open: boolean; onOpenChange: (v: boolean) => void; onCreated: (id: string) => void }) {
  const { data: pipelines } = usePipelines();
  const { data: team } = useTeam();
  const { isManager } = useCan();
  const [f, setF] = useState({ name: "", phone: "", email: "", origin: "MANUAL", stageId: "", assignedToId: "", seoLandingPage: "", tags: "" });
  const [loading, setLoading] = useState(false);
  useEffect(() => { if (open) setF({ name: "", phone: "", email: "", origin: "MANUAL", stageId: "", assignedToId: "", seoLandingPage: "", tags: "" }); }, [open]);
  async function save() {
    setLoading(true);
    try {
      const stage = pipelines?.flatMap((p) => p.stages).find((s) => s.id === f.stageId);
      const c = await api<{ id: string }>("/api/contacts", {
        body: { ...f, tags: f.tags.split(",").map((t) => t.trim()).filter(Boolean), stageId: stage?.id, pipelineId: stage?.pipelineId, assignedToId: f.assignedToId || null, seoLandingPage: f.seoLandingPage || null },
      });
      toast.success("Contato criado");
      onOpenChange(false);
      onCreated(c.id);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setLoading(false);
    }
  }
  const s = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setF({ ...f, [k]: e.target.value });
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title="Criar contato" size="md">
        <DialogBody className="grid gap-3 sm:grid-cols-2">
          <Field label="Nome" className="sm:col-span-2"><Input value={f.name} onChange={s("name")} autoFocus /></Field>
          <Field label="WhatsApp *"><Input value={f.phone} onChange={s("phone")} placeholder="(75) 99999-0000" /></Field>
          <Field label="E-mail"><Input value={f.email} onChange={s("email")} /></Field>
          <Field label="Origem">
            <Select value={f.origin} onChange={s("origin")}>{Object.entries(ORIGIN_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</Select>
          </Field>
          <Field label="Etapa">
            <Select value={f.stageId} onChange={s("stageId")}>
              <option value="">Entrada do funil padrão</option>
              {pipelines?.map((p) => <optgroup key={p.id} label={p.name}>{p.stages.map((st) => <option key={st.id} value={st.id}>{st.name}</option>)}</optgroup>)}
            </Select>
          </Field>
          {isManager && (
            <Field label="Responsável">
              <Select value={f.assignedToId} onChange={s("assignedToId")}>
                <option value="">Sem responsável</option>
                {team?.filter((u) => u.isActive).map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
              </Select>
            </Field>
          )}
          <Field label="Etiquetas (vírgula)"><Input value={f.tags} onChange={s("tags")} /></Field>
          {f.origin === "SEO_ORGANICO" && <Field label="Página de conversão" className="sm:col-span-2"><Input value={f.seoLandingPage} onChange={s("seoLandingPage")} placeholder="https://…" /></Field>}
        </DialogBody>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={save} loading={loading} disabled={f.phone.replace(/\D/g, "").length < 10}>Criar contato</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
