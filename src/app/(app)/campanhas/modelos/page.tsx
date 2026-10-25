"use client";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { FileText, Plus, Trash2 } from "lucide-react";
import { api } from "@/lib/client";
import { META_PRICING, TEMPLATE_CATEGORY_LABELS, TEMPLATE_STATUS_LABELS } from "@/lib/constants";
import { formatBRL, formatDate } from "@/lib/utils";
import type { Template } from "@/lib/types";
import { useMe } from "@/hooks/use-me";
import { Button } from "@/components/ui/button";
import { Badge, Card, EmptyState, PageHeader } from "@/components/ui/misc";
import { TemplateEditor } from "@/components/campaigns/template-editor";

const STATUS_TONE = { DRAFT: "slate", PENDING: "amber", APPROVED: "green", REJECTED: "red" } as const;

export default function Modelos() {
  const qc = useQueryClient();
  const { data: me } = useMe();
  const [editing, setEditing] = useState<Template | null>(null);
  const [open, setOpen] = useState(false);
  const { data } = useQuery({ queryKey: ["templates"], queryFn: () => api<Template[]>("/api/templates") });
  const del = useMutation({
    mutationFn: (id: string) => api(`/api/templates/${id}`, { method: "DELETE" }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["templates"] }); toast.success("Modelo excluído"); },
  });
  const submit = useMutation({
    mutationFn: (id: string) => api<Template>(`/api/templates/${id}/submit`, { method: "POST" }),
    onSuccess: (t) => { qc.invalidateQueries({ queryKey: ["templates"] }); toast.success(`Status: ${TEMPLATE_STATUS_LABELS[t.metaStatus]}`); },
    onError: (e: Error) => toast.error(e.message),
  });
  return (
    <div className="mx-auto max-w-6xl px-4 py-6">
      <PageHeader title="Modelos de mensagem" description="Modelos aprovados pela Meta para iniciar conversas e fazer disparos." actions={<Button size="sm" onClick={() => { setEditing(null); setOpen(true); }}><Plus /> Novo modelo</Button>} />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {data?.map((t) => (
          <Card key={t.id} className="flex flex-col p-4">
            <div className="flex items-start justify-between gap-2">
              <p className="break-all font-mono text-sm font-semibold">{t.name}</p>
              <Badge tone={STATUS_TONE[t.metaStatus]}>{TEMPLATE_STATUS_LABELS[t.metaStatus]}</Badge>
            </div>
            <div className="mt-1 flex flex-wrap gap-1.5 text-[11px] text-muted-foreground">
              <Badge tone={t.category === "MARKETING" ? "violet" : "blue"}>{TEMPLATE_CATEGORY_LABELS[t.category]} · {formatBRL(META_PRICING[t.category], { decimals: 4 })}</Badge>
              <span>{t.channel?.name}</span>
            </div>
            <p className="mt-3 line-clamp-4 flex-1 whitespace-pre-wrap rounded-md bg-slate-50 p-2.5 text-xs text-slate-700">{t.bodyText}</p>
            {t.rejectionReason && <p className="mt-2 text-xs text-red-600">Motivo: {t.rejectionReason}</p>}
            <div className="mt-3 flex items-center gap-2">
              <span className="mr-auto text-[11px] text-muted-foreground">{formatDate(t.createdAt)} · {t._count?.campaigns ?? 0} campanhas</span>
              {(t.metaStatus === "DRAFT" || t.metaStatus === "REJECTED") && <Button size="xs" variant="soft" loading={submit.isPending && submit.variables === t.id} onClick={() => submit.mutate(t.id)}>Enviar para aprovação</Button>}
              <Button size="xs" variant="outline" onClick={() => { setEditing(t); setOpen(true); }}>Editar</Button>
              <Button size="icon-sm" variant="ghost" onClick={() => confirm(`Excluir o modelo ${t.name}?`) && del.mutate(t.id)}><Trash2 /></Button>
            </div>
          </Card>
        ))}
      </div>
      {data && !data.length && <EmptyState icon={<FileText className="h-5 w-5" />} title="Nenhum modelo ainda" description="Crie seu primeiro modelo e envie para aprovação da Meta." action={<Button size="sm" onClick={() => setOpen(true)}><Plus /> Novo modelo</Button>} />}
      <TemplateEditor open={open} onOpenChange={setOpen} template={editing} onSaved={() => qc.invalidateQueries({ queryKey: ["templates"] })} workspaceName={me?.workspace.name ?? "Sua empresa"} />
    </div>
  );
}
