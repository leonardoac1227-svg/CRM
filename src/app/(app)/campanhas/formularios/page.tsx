"use client";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ClipboardList, Copy, Plus, Trash2 } from "lucide-react";
import { api } from "@/lib/client";
import { formatDate } from "@/lib/utils";
import { useMe, usePipelines } from "@/hooks/use-me";
import { Button } from "@/components/ui/button";
import { Checkbox, Field, Input, Select } from "@/components/ui/input";
import { Card, EmptyState, PageHeader } from "@/components/ui/misc";
import { Dialog, DialogBody, DialogContent, DialogFooter } from "@/components/ui/overlay";

type FormField = { key: string; label: string; type: string; required: boolean };
type LeadForm = { id: string; name: string; fieldsJson: FormField[]; submissions: number; createdAt: string; stageId: string | null };

function embedCode(appUrl: string, key: string, f: LeadForm) {
  const inputs = f.fieldsJson.map((x) => `  <label>${x.label}<input name="${x.key}" type="${x.type}"${x.required ? " required" : ""}></label>`).join("\n");
  return `<!-- Formulário "${f.name}" — capturado pelo tracker do Téo CRM -->
<form class="teo-form" action="#" onsubmit="event.preventDefault(); this.innerHTML='<p>Recebemos seus dados! Em instantes falamos com você no WhatsApp.</p>'">
${inputs}
  <button type="submit">Quero ser atendido</button>
</form>
<script async src="${appUrl}/api/tracker.js?k=${key}"></script>`;
}

export default function Formularios() {
  const qc = useQueryClient();
  const { data: me } = useMe();
  const { data: pipelines } = usePipelines();
  const { data } = useQuery({ queryKey: ["forms"], queryFn: () => api<LeadForm[]>("/api/forms") });
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [stageId, setStageId] = useState("");
  const [fields, setFields] = useState<FormField[]>([{ key: "name", label: "Nome", type: "text", required: true }, { key: "phone", label: "WhatsApp", type: "tel", required: true }, { key: "email", label: "E-mail", type: "email", required: false }]);
  const create = useMutation({
    mutationFn: () => {
      const st = pipelines?.flatMap((p) => p.stages).find((s) => s.id === stageId);
      return api("/api/forms", { body: { name, fields, stageId: st?.id ?? null, pipelineId: st?.pipelineId ?? null } });
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["forms"] }); setOpen(false); setName(""); toast.success("Formulário criado"); },
    onError: (e: Error) => toast.error(e.message),
  });
  const appUrl = typeof window !== "undefined" ? window.location.origin : "";
  return (
    <div className="mx-auto max-w-5xl px-4 py-6">
      <PageHeader title="Formulários" description="Formulários para o site que viram leads com a origem SEO completa." actions={<Button size="sm" onClick={() => setOpen(true)}><Plus /> Novo formulário</Button>} />
      <div className="space-y-3">
        {data?.map((f) => (
          <Card key={f.id} className="p-4">
            <div className="flex flex-wrap items-center gap-3">
              <ClipboardList className="h-5 w-5 text-primary" />
              <div className="flex-1">
                <p className="font-semibold">{f.name}</p>
                <p className="text-xs text-muted-foreground">{f.fieldsJson.map((x) => x.label).join(" · ")} · {f.submissions} envios · criado {formatDate(f.createdAt)}</p>
              </div>
              <Button size="sm" variant="outline" onClick={() => { navigator.clipboard.writeText(embedCode(appUrl, me?.workspace.trackerKey ?? "", f)); toast.success("Código copiado"); }}><Copy /> Copiar código</Button>
            </div>
            <pre className="mt-3 max-h-40 overflow-auto rounded-md bg-slate-900 p-3 text-[11px] text-slate-100 scrollbar-thin">{embedCode(appUrl, me?.workspace.trackerKey ?? "", f)}</pre>
          </Card>
        ))}
        {data && !data.length && <EmptyState icon={<ClipboardList className="h-5 w-5" />} title="Nenhum formulário" />}
      </div>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent title="Novo formulário" size="md">
          <DialogBody className="space-y-3">
            <Field label="Nome"><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Simulação de financiamento" /></Field>
            <Field label="Etapa de entrada">
              <Select value={stageId} onChange={(e) => setStageId(e.target.value)}>
                <option value="">Entrada do funil padrão</option>
                {pipelines?.map((p) => <optgroup key={p.id} label={p.name}>{p.stages.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</optgroup>)}
              </Select>
            </Field>
            <div className="space-y-2">
              <p className="text-xs font-medium text-slate-600">Campos</p>
              {fields.map((f, i) => (
                <div key={i} className="flex items-center gap-2">
                  <Input value={f.label} onChange={(e) => setFields(fields.map((x, k) => (k === i ? { ...x, label: e.target.value } : x)))} className="h-8" />
                  <Select value={f.key} onChange={(e) => setFields(fields.map((x, k) => (k === i ? { ...x, key: e.target.value } : x)))} className="h-8 w-40 text-xs">
                    {["name", "phone", "email", "monthlyIncome", "neighborhood", "message"].map((k) => <option key={k} value={k}>{k}</option>)}
                  </Select>
                  <label className="flex items-center gap-1 text-[11px]"><Checkbox checked={f.required} onChange={(e) => setFields(fields.map((x, k) => (k === i ? { ...x, required: e.target.checked } : x)))} /> Obrig.</label>
                  <Button size="icon-sm" variant="ghost" disabled={f.key === "phone"} onClick={() => setFields(fields.filter((_, k) => k !== i))}><Trash2 /></Button>
                </div>
              ))}
              <Button size="xs" variant="outline" onClick={() => setFields([...fields, { key: "message", label: "Mensagem", type: "text", required: false }])}><Plus /> Campo</Button>
            </div>
          </DialogBody>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={() => create.mutate()} loading={create.isPending} disabled={name.length < 2}>Criar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
