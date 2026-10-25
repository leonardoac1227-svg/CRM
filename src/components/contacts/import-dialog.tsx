"use client";
import { useState } from "react";
import Papa from "papaparse";
import { toast } from "sonner";
import { FileSpreadsheet, Upload, CheckCircle2 } from "lucide-react";
import { api } from "@/lib/client";
import { ORIGIN_LABELS } from "@/lib/constants";
import { normalizePhone } from "@/lib/utils";
import { usePipelines, useTeam, useCan } from "@/hooks/use-me";
import { Button } from "@/components/ui/button";
import { Checkbox, Field, Input, Select } from "@/components/ui/input";
import { Dialog, DialogBody, DialogContent, DialogFooter } from "@/components/ui/overlay";

const FIELDS: { key: string; label: string; guess: RegExp }[] = [
  { key: "name", label: "Nome", guess: /^(nome|name|cliente|contato)/i },
  { key: "phone", label: "Telefone / WhatsApp", guess: /(tel|fone|phone|whats|celular)/i },
  { key: "email", label: "E-mail", guess: /mail/i },
  { key: "cpfCnpj", label: "CPF/CNPJ", guess: /(cpf|cnpj|documento)/i },
  { key: "birthDate", label: "Data de nascimento", guess: /(nasc|birth|aniver)/i },
  { key: "city", label: "Cidade", guess: /(cidade|city|munic)/i },
  { key: "state", label: "UF", guess: /^(uf|estado|state)$/i },
  { key: "neighborhood", label: "Bairro", guess: /bairro/i },
  { key: "address", label: "Endereço", guess: /(endere|rua|logradouro)/i },
  { key: "profession", label: "Profissão", guess: /(profiss|cargo|ocupa)/i },
  { key: "maritalStatus", label: "Estado civil", guess: /civil/i },
  { key: "monthlyIncome", label: "Renda", guess: /(renda|salario|salário)/i },
  { key: "downPaymentAvailable", label: "Valor de entrada", guess: /entrada/i },
  { key: "dealValue", label: "Valor do negócio", guess: /(valor|orçamento|orcamento)/i },
  { key: "tags", label: "Etiquetas", guess: /(tag|etiqueta)/i },
  { key: "origin", label: "Origem (código)", guess: /origem/i },
];

type Row = Record<string, string>;

async function readFile(file: File): Promise<{ headers: string[]; rows: Row[] }> {
  if (/\.(xlsx|xls)$/i.test(file.name)) {
    const XLSX = await import("xlsx");
    const wb = XLSX.read(await file.arrayBuffer(), { type: "array", cellDates: true });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json<Row>(ws, { defval: "", raw: false });
    return { headers: Object.keys(rows[0] ?? {}), rows };
  }
  return new Promise((resolve, reject) =>
    Papa.parse<Row>(file, {
      header: true,
      skipEmptyLines: true,
      complete: (r) => resolve({ headers: r.meta.fields ?? [], rows: r.data }),
      error: reject,
    }),
  );
}

export function ImportDialog({ open, onOpenChange, onDone }: { open: boolean; onOpenChange: (v: boolean) => void; onDone: () => void }) {
  const { data: pipelines } = usePipelines();
  const { data: team } = useTeam();
  const { isManager } = useCan();
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [fileName, setFileName] = useState("");
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<Row[]>([]);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [stageId, setStageId] = useState("");
  const [assignedToId, setAssignedToId] = useState("");
  const [tags, setTags] = useState("importado");
  const [origin, setOrigin] = useState("MANUAL");
  const [updateExisting, setUpdateExisting] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ created: number; updated: number; skipped: number; errors: { row: number; error: string }[] } | null>(null);

  function reset() {
    setStep(1); setHeaders([]); setRows([]); setMapping({}); setResult(null); setFileName("");
  }

  async function onFile(f: File) {
    try {
      const { headers, rows } = await readFile(f);
      if (!rows.length) throw new Error("Planilha vazia");
      setFileName(f.name);
      setHeaders(headers);
      setRows(rows);
      const m: Record<string, string> = {};
      for (const h of headers) {
        const field = FIELDS.find((fd) => fd.guess.test(h.trim()) && !Object.values(m).includes(fd.key));
        m[h] = field?.key ?? "";
      }
      setMapping(m);
      setStep(2);
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  async function run() {
    setLoading(true);
    try {
      const stage = pipelines?.flatMap((p) => p.stages).find((s) => s.id === stageId);
      const r = await api<NonNullable<typeof result>>("/api/contacts/import", {
        body: { rows, mapping, stageId: stage?.id, pipelineId: stage?.pipelineId, assignedToId: assignedToId || null, tags: tags.split(",").map((t) => t.trim()).filter(Boolean), origin, updateExisting },
      });
      setResult(r);
      setStep(3);
      onDone();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  const phoneCol = Object.entries(mapping).find(([, v]) => v === "phone")?.[0];
  const valid = phoneCol ? rows.filter((r) => normalizePhone(String(r[phoneCol] ?? "")).length >= 10).length : 0;

  return (
    <Dialog open={open} onOpenChange={(o) => { onOpenChange(o); if (!o) reset(); }}>
      <DialogContent size="lg" title="Importar contatos (Excel/CSV)" description={step === 1 ? "Envie uma planilha .xlsx, .xls ou .csv com uma linha por contato." : step === 2 ? `${fileName} · ${rows.length} linhas — confira o mapeamento das colunas` : "Importação concluída"}>
        <DialogBody>
          {step === 1 && (
            <label
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) onFile(f); }}
              className="flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed px-6 py-14 text-center hover:border-primary/50 hover:bg-primary/[0.02]"
            >
              <FileSpreadsheet className="h-10 w-10 text-primary" />
              <p className="mt-3 text-sm font-semibold">Arraste a planilha aqui ou clique para escolher</p>
              <p className="mt-1 text-xs text-muted-foreground">A coluna de telefone é obrigatória. Detectamos as colunas automaticamente.</p>
              <input type="file" accept=".csv,.xlsx,.xls" className="hidden" onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])} />
            </label>
          )}
          {step === 2 && (
            <div className="space-y-5">
              <div className="overflow-hidden rounded-lg border">
                <table className="w-full text-xs">
                  <thead className="bg-slate-50 text-left text-muted-foreground">
                    <tr><th className="px-3 py-2 font-medium">Coluna da planilha</th><th className="px-3 py-2 font-medium">Exemplo</th><th className="px-3 py-2 font-medium">Campo no CRM</th></tr>
                  </thead>
                  <tbody>
                    {headers.map((h) => (
                      <tr key={h} className="border-t">
                        <td className="px-3 py-2 font-medium">{h}</td>
                        <td className="max-w-[200px] truncate px-3 py-2 text-muted-foreground">{String(rows[0]?.[h] ?? "")}</td>
                        <td className="px-3 py-1.5">
                          <Select value={mapping[h] ?? ""} onChange={(e) => setMapping({ ...mapping, [h]: e.target.value })} className="h-8 text-xs">
                            <option value="">— Ignorar —</option>
                            {FIELDS.map((f) => <option key={f.key} value={f.key}>{f.label}</option>)}
                          </Select>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Etapa do funil">
                  <Select value={stageId} onChange={(e) => setStageId(e.target.value)}>
                    <option value="">Primeira etapa do funil padrão</option>
                    {pipelines?.map((p) => <optgroup key={p.id} label={p.name}>{p.stages.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</optgroup>)}
                  </Select>
                </Field>
                {isManager && (
                  <Field label="Responsável">
                    <Select value={assignedToId} onChange={(e) => setAssignedToId(e.target.value)}>
                      <option value="">Sem responsável</option>
                      {team?.filter((u) => u.isActive).map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
                    </Select>
                  </Field>
                )}
                <Field label="Origem padrão">
                  <Select value={origin} onChange={(e) => setOrigin(e.target.value)}>
                    {Object.entries(ORIGIN_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </Select>
                </Field>
                <Field label="Etiquetas (vírgula)"><Input value={tags} onChange={(e) => setTags(e.target.value)} /></Field>
              </div>
              <label className="flex items-center gap-2 text-sm"><Checkbox checked={updateExisting} onChange={(e) => setUpdateExisting(e.target.checked)} /> Atualizar contatos que já existem (mesmo telefone)</label>
              <p className={`text-xs ${phoneCol ? "text-muted-foreground" : "text-red-600"}`}>{phoneCol ? `${valid} de ${rows.length} linhas com telefone válido.` : "Mapeie a coluna de telefone para continuar."}</p>
            </div>
          )}
          {step === 3 && result && (
            <div className="py-6 text-center">
              <CheckCircle2 className="mx-auto h-12 w-12 text-success" />
              <p className="mt-3 text-lg font-semibold">{result.created} contatos importados</p>
              <p className="text-sm text-muted-foreground">{result.updated} atualizados · {result.skipped} ignorados</p>
              {!!result.errors.length && (
                <div className="mx-auto mt-4 max-h-40 max-w-md overflow-y-auto rounded-md bg-red-50 p-3 text-left text-xs text-red-700">
                  {result.errors.map((e, i) => <p key={i}>Linha {e.row}: {e.error}</p>)}
                </div>
              )}
            </div>
          )}
        </DialogBody>
        <DialogFooter>
          {step === 2 && <Button variant="ghost" onClick={reset}>Trocar arquivo</Button>}
          {step === 3 ? <Button onClick={() => { onOpenChange(false); reset(); }}>Concluir</Button> : <Button onClick={run} loading={loading} disabled={step !== 2 || !phoneCol}><Upload /> Importar {rows.length ? `${rows.length} linhas` : ""}</Button>}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
