"use client";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import { api } from "@/lib/client";
import { DEFAULT_STAGES } from "@/lib/constants";
import type { Pipeline } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Checkbox, Field, Input } from "@/components/ui/input";
import { Dialog, DialogBody, DialogContent, DialogFooter } from "@/components/ui/overlay";

type S = { id?: string; name: string; color: string; isWonStage: boolean };

export function PipelineDialog({ open, onOpenChange, pipeline, onSaved }: { open: boolean; onOpenChange: (v: boolean) => void; pipeline: Pipeline | null; onSaved: (id: string) => void }) {
  const [name, setName] = useState("");
  const [stages, setStages] = useState<S[]>([]);
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    if (!open) return;
    setName(pipeline?.name ?? "");
    setStages(pipeline ? pipeline.stages.map((s) => ({ id: s.id, name: s.name, color: s.color, isWonStage: s.isWonStage })) : DEFAULT_STAGES.map((s) => ({ name: s.name, color: s.color, isWonStage: !!s.isWonStage })));
  }, [open, pipeline]);
  const move = (i: number, d: number) => {
    const n = [...stages];
    const [x] = n.splice(i, 1);
    n.splice(i + d, 0, x);
    setStages(n);
  };
  async function save() {
    setLoading(true);
    try {
      const r = pipeline
        ? await api<Pipeline>(`/api/pipelines/${pipeline.id}`, { method: "PATCH", body: { name, stages } })
        : await api<Pipeline>("/api/pipelines", { body: { name, stages } });
      toast.success("Funil salvo");
      onOpenChange(false);
      onSaved(r.id);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setLoading(false);
    }
  }
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title={pipeline ? "Editar funil" : "Novo funil"} size="md">
        <DialogBody className="space-y-4">
          <Field label="Nome do funil"><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Funil de locação" /></Field>
          <div>
            <p className="mb-2 text-xs font-medium text-slate-600">Etapas</p>
            <div className="space-y-2">
              {stages.map((s, i) => (
                <div key={i} className="flex items-center gap-2">
                  <input type="color" value={s.color} onChange={(e) => setStages(stages.map((x, k) => (k === i ? { ...x, color: e.target.value } : x)))} className="h-8 w-8 cursor-pointer rounded border p-0.5" />
                  <Input value={s.name} onChange={(e) => setStages(stages.map((x, k) => (k === i ? { ...x, name: e.target.value } : x)))} className="h-8" />
                  <label className="flex items-center gap-1 whitespace-nowrap text-[11px] text-muted-foreground" title="Etapa de ganho"><Checkbox checked={s.isWonStage} onChange={(e) => setStages(stages.map((x, k) => (k === i ? { ...x, isWonStage: e.target.checked } : x)))} /> Ganho</label>
                  <Button size="icon-sm" variant="ghost" disabled={i === 0} onClick={() => move(i, -1)}><ArrowUp /></Button>
                  <Button size="icon-sm" variant="ghost" disabled={i === stages.length - 1} onClick={() => move(i, 1)}><ArrowDown /></Button>
                  <Button size="icon-sm" variant="ghost" disabled={stages.length <= 2} onClick={() => setStages(stages.filter((_, k) => k !== i))}><Trash2 /></Button>
                </div>
              ))}
            </div>
            <Button size="sm" variant="outline" className="mt-2" onClick={() => setStages([...stages, { name: "Nova etapa", color: "#2563EB", isWonStage: false }])}><Plus /> Etapa</Button>
            {pipeline && <p className="mt-2 text-[11px] text-muted-foreground">Leads de etapas removidas vão para a primeira etapa.</p>}
          </div>
        </DialogBody>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={save} loading={loading} disabled={name.trim().length < 2 || stages.some((s) => !s.name.trim())}>Salvar funil</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
