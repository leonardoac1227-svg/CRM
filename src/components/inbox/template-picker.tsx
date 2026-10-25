"use client";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { FileCheck2 } from "lucide-react";
import { api } from "@/lib/client";
import { META_PRICING, TEMPLATE_CATEGORY_LABELS } from "@/lib/constants";
import { buildVarContext, renderTemplate } from "@/lib/templates";
import { cn, formatBRL } from "@/lib/utils";
import type { Contact, Template } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Badge, EmptyState } from "@/components/ui/misc";
import { Dialog, DialogBody, DialogContent, DialogFooter } from "@/components/ui/overlay";
import { WhatsAppPreview } from "@/components/shared/whatsapp-preview";

export function TemplatePicker({
  open, onOpenChange, contact, brokerName, workspaceName, onSend, sending,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  contact: Partial<Contact> | null;
  brokerName?: string | null;
  workspaceName?: string;
  onSend: (templateId: string) => void;
  sending?: boolean;
}) {
  const { data } = useQuery({ queryKey: ["templates", "APPROVED"], queryFn: () => api<Template[]>("/api/templates?status=APPROVED"), enabled: open });
  const [selected, setSelected] = useState<string | null>(null);
  const t = data?.find((x) => x.id === selected) ?? data?.[0] ?? null;
  const ctx = useMemo(() => buildVarContext(contact ? { ...contact } : null, { name: brokerName }, { name: workspaceName }), [contact, brokerName, workspaceName]);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="lg" title="Enviar modelo aprovado (Meta)" description="Fora da janela de 24h a Meta só permite iniciar conversa com um modelo aprovado.">
        <DialogBody className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            {!data?.length && <EmptyState icon={<FileCheck2 className="h-5 w-5" />} title="Nenhum modelo aprovado" description="Crie e envie um modelo para aprovação em Campanhas → Modelos." />}
            {data?.map((tpl) => (
              <button key={tpl.id} onClick={() => setSelected(tpl.id)} className={cn("w-full rounded-lg border p-3 text-left transition-colors hover:border-primary/50", t?.id === tpl.id && "border-primary bg-primary/[0.03] ring-1 ring-primary/30")}>
                <div className="flex items-center justify-between">
                  <p className="font-mono text-xs font-semibold">{tpl.name}</p>
                  <Badge tone={tpl.category === "MARKETING" ? "violet" : "blue"}>{TEMPLATE_CATEGORY_LABELS[tpl.category]} · {formatBRL(META_PRICING[tpl.category], { decimals: tpl.category === "MARKETING" ? 4 : 3 })}</Badge>
                </div>
                <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{tpl.bodyText}</p>
              </button>
            ))}
          </div>
          {t && (
            <WhatsAppPreview
              headerType={t.headerType}
              headerContent={t.headerContent}
              body={renderTemplate(t.bodyText, t.variableMappings, ctx)}
              footer={t.footerText}
              buttons={t.buttonsJson}
            />
          )}
        </DialogBody>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button disabled={!t} loading={sending} onClick={() => t && onSend(t.id)}>Enviar modelo</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
