"use client";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { api } from "@/lib/client";
import { TASK_TYPE_LABELS } from "@/lib/constants";
import { useCan, useTeam } from "@/hooks/use-me";
import type { Task } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/input";
import { Dialog, DialogBody, DialogContent, DialogFooter } from "@/components/ui/overlay";
import { ContactPicker } from "./contact-picker";

function toLocalInput(d: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function TaskDialog({
  open, onOpenChange, contact, task, defaultDate, onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  contact?: { id: string; name: string | null } | null;
  task?: Task | null;
  defaultDate?: Date;
  onSaved?: () => void;
}) {
  const { data: team } = useTeam();
  const { me, isBroker } = useCan();
  const [form, setForm] = useState({ title: "", type: "VISIT", dueDate: "", assignedToId: "", notes: "" });
  const [picked, setPicked] = useState<{ id: string; name: string | null } | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    const base = defaultDate ?? new Date(Date.now() + 86400000);
    if (!defaultDate) base.setHours(10, 0, 0, 0);
    setForm({
      title: task?.title ?? "",
      type: task?.type ?? "VISIT",
      dueDate: toLocalInput(task ? new Date(task.dueDate) : base),
      assignedToId: task?.assignedToId ?? me?.user.id ?? "",
      notes: task?.notes ?? "",
    });
    setPicked(contact ?? (task?.contact ? { id: task.contact.id, name: task.contact.name } : null));
  }, [open, task, contact, defaultDate, me]);

  async function save() {
    setLoading(true);
    try {
      const payload = { ...form, dueDate: new Date(form.dueDate).toISOString(), contactId: picked?.id ?? null, assignedToId: form.assignedToId || null };
      if (task) await api(`/api/tasks/${task.id}`, { method: "PATCH", body: payload });
      else await api("/api/tasks", { body: payload });
      toast.success(task ? "Tarefa atualizada" : "Tarefa criada");
      onOpenChange(false);
      onSaved?.();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title={task ? "Editar tarefa" : "Nova tarefa"} size="md">
        <DialogBody className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Tipo">
              <Select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
                {Object.entries(TASK_TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </Select>
            </Field>
            <Field label="Data e hora"><Input type="datetime-local" value={form.dueDate} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} /></Field>
          </div>
          <Field label="Título"><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Ex.: Visita ao AP-201 no Santa Mônica" /></Field>
          {!contact && <Field label="Contato"><ContactPicker value={picked} onChange={setPicked} /></Field>}
          {!isBroker && (
            <Field label="Responsável">
              <Select value={form.assignedToId} onChange={(e) => setForm({ ...form, assignedToId: e.target.value })}>
                {(team ?? []).filter((u) => u.isActive).map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
              </Select>
            </Field>
          )}
          <Field label="Observações"><Textarea rows={3} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></Field>
          {form.type === "VISIT" && <p className="rounded-md bg-sky-50 px-3 py-2 text-xs text-sky-800">Ao agendar uma visita, o lead avança automaticamente para a etapa “Visita agendada” e recebe lembrete do Téo (se a automação estiver ligada).</p>}
        </DialogBody>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={save} loading={loading} disabled={form.title.trim().length < 2 || !form.dueDate}>Salvar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
