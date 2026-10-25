"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, Send, Trash2, Variable } from "lucide-react";
import { api } from "@/lib/client";
import { META_PRICING, TEMPLATE_CATEGORY_LABELS, TEMPLATE_VARIABLES } from "@/lib/constants";
import { buildVarContext, insertVariable, renderTemplate, sampleVarContext } from "@/lib/templates";
import { cn, formatBRL, formatPhone, slugify } from "@/lib/utils";
import type { Channel, Template } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/input";
import { Badge } from "@/components/ui/misc";
import { Dialog, DialogBody, DialogContent, DialogFooter, DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/overlay";
import { WhatsAppPreview } from "@/components/shared/whatsapp-preview";

type Draft = Omit<Template, "id" | "metaStatus" | "rejectionReason" | "createdAt" | "channel" | "_count">;

const EMPTY: Draft = { name: "", category: "MARKETING", language: "pt_BR", headerType: "NONE", headerContent: "", bodyText: "", variableMappings: {}, footerText: "", buttonsJson: [], channelId: null };

export function TemplateEditor({ open, onOpenChange, template, onSaved, workspaceName }: { open: boolean; onOpenChange: (v: boolean) => void; template: Template | null; onSaved: () => void; workspaceName: string }) {
  const { data: channels } = useQuery({ queryKey: ["channels"], queryFn: () => api<Channel[]>("/api/channels"), enabled: open });
  const [d, setD] = useState<Draft>(EMPTY);
  const [previewName, setPreviewName] = useState<"sample" | "empty">("sample");
  const [loading, setLoading] = useState<"save" | "submit" | null>(null);
  const bodyRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!open) return;
    setD(template ? { ...template, headerContent: template.headerContent ?? "", footerText: template.footerText ?? "" } : { ...EMPTY, channelId: null });
  }, [open, template]);
  useEffect(() => {
    if (open && !d.channelId && channels?.length) setD((x) => ({ ...x, channelId: channels.find((c) => c.provider === "META_OFFICIAL")?.id ?? channels[0].id }));
  }, [open, channels, d.channelId]);

  const ctx = useMemo(() => (previewName === "sample" ? sampleVarContext() : { ...sampleVarContext(), ...buildVarContext({ name: null }, { name: "Márcio" }, { name: workspaceName }), "contact.firstName": "" }), [previewName, workspaceName]);
  const rendered = renderTemplate(d.bodyText, d.variableMappings, ctx);

  function addVar(key: string) {
    const { token, mappings } = insertVariable(d.bodyText, d.variableMappings, key);
    const ta = bodyRef.current;
    const pos = ta?.selectionStart ?? d.bodyText.length;
    const body = d.bodyText.slice(0, pos) + token + d.bodyText.slice(ta?.selectionEnd ?? pos);
    setD({ ...d, bodyText: body.slice(0, 1024), variableMappings: mappings });
    setTimeout(() => { ta?.focus(); ta?.setSelectionRange(pos + token.length, pos + token.length); }, 0);
  }

  async function persist(submit: boolean) {
    setLoading(submit ? "submit" : "save");
    try {
      // remove mapeamentos de variáveis que não estão mais no texto
      const used = new Set([...d.bodyText.matchAll(/\{\{(\d+)\}\}/g)].map((m) => m[1]));
      const payload = { ...d, variableMappings: Object.fromEntries(Object.entries(d.variableMappings).filter(([k]) => used.has(k))), headerContent: d.headerContent || null, footerText: d.footerText || null };
      const saved = template ? await api<Template>(`/api/templates/${template.id}`, { method: "PATCH", body: payload }) : await api<Template>("/api/templates", { body: payload });
      if (submit) {
        const r = await api<Template>(`/api/templates/${saved.id}/submit`, { method: "POST" });
        toast.success(r.metaStatus === "APPROVED" ? "Modelo aprovado pela Meta ✅" : "Modelo enviado para análise da Meta");
      } else toast.success("Rascunho salvo");
      onSaved();
      onOpenChange(false);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setLoading(null);
    }
  }

  const unmapped = [...d.bodyText.matchAll(/\{\{(\d+)\}\}/g)].map((m) => m[1]).filter((n) => !d.variableMappings[n]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="xl" title={template ? `Editar modelo · ${template.name}` : "Novo modelo de mensagem"} description="Modelos precisam ser aprovados pela Meta antes do envio pela API Oficial.">
        <DialogBody className="grid gap-6 lg:grid-cols-[1fr_360px]">
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Número de WhatsApp">
                <Select value={d.channelId ?? ""} onChange={(e) => setD({ ...d, channelId: e.target.value })}>
                  {channels?.map((c) => <option key={c.id} value={c.id}>{c.name} · {formatPhone(c.phoneNumber)}{c.provider !== "META_OFFICIAL" ? " (QR)" : ""}</option>)}
                </Select>
              </Field>
              <Field label="Nome do modelo" hint="Apenas letras minúsculas, números e _">
                <Input value={d.name} onChange={(e) => setD({ ...d, name: slugify(e.target.value) })} placeholder="promocao_feirao_novembro" className="font-mono" />
              </Field>
              <Field label="Idioma">
                <Select value={d.language} onChange={(e) => setD({ ...d, language: e.target.value })}>
                  <option value="pt_BR">Português (Brasil)</option>
                  <option value="en_US">Inglês (EUA)</option>
                  <option value="es">Espanhol</option>
                </Select>
              </Field>
            </div>
            <div>
              <p className="mb-1.5 text-xs font-medium text-slate-600">Categoria da Meta</p>
              <div className="grid gap-2 sm:grid-cols-3">
                {(["MARKETING", "UTILITY", "AUTHENTICATION"] as const).map((c) => (
                  <button key={c} onClick={() => setD({ ...d, category: c })} className={cn("rounded-lg border p-3 text-left transition-colors hover:border-primary/40", d.category === c && "border-primary bg-primary/[0.04] ring-1 ring-primary/30")}>
                    <p className="text-sm font-semibold">{TEMPLATE_CATEGORY_LABELS[c]}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {c === "MARKETING" ? <><strong className="text-foreground">R$ 0,3217</strong> por mensagem</> : c === "UTILITY" ? <><strong className="text-foreground">R$ 0,035</strong> por mensagem</> : "Códigos de verificação"}
                    </p>
                  </button>
                ))}
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-[180px_1fr]">
              <Field label="Cabeçalho (opcional)">
                <Select value={d.headerType} onChange={(e) => setD({ ...d, headerType: e.target.value as Draft["headerType"] })}>
                  <option value="NONE">Nenhum</option>
                  <option value="TEXT">Texto</option>
                  <option value="IMAGE">Imagem</option>
                  <option value="VIDEO">Vídeo</option>
                  <option value="DOCUMENT">Documento</option>
                </Select>
              </Field>
              {d.headerType !== "NONE" && (
                <Field label={d.headerType === "TEXT" ? "Texto do cabeçalho" : "URL da mídia"}>
                  <Input value={d.headerContent ?? ""} maxLength={d.headerType === "TEXT" ? 60 : 500} onChange={(e) => setD({ ...d, headerContent: e.target.value })} placeholder={d.headerType === "TEXT" ? "Feirão de novembro 🏡" : "https://…"} />
                </Field>
              )}
            </div>
            <div>
              <div className="mb-1.5 flex items-center justify-between">
                <p className="text-xs font-medium text-slate-600">Corpo do texto</p>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild><Button size="xs" variant="soft"><Variable /> Nova variável</Button></DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    {TEMPLATE_VARIABLES.map((v) => <DropdownMenuItem key={v.key} onSelect={() => addVar(v.key)}>{v.label} <span className="ml-auto text-[10px] text-muted-foreground">{v.sample}</span></DropdownMenuItem>)}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
              <Textarea ref={bodyRef} rows={6} maxLength={1024} value={d.bodyText} onChange={(e) => setD({ ...d, bodyText: e.target.value })} placeholder="Olá {{1}}! Temos novidades para você…" />
              <div className="mt-1 flex flex-wrap items-center justify-between gap-2 text-[11px] text-muted-foreground">
                <div className="flex flex-wrap gap-1">
                  {Object.entries(d.variableMappings).filter(([n]) => d.bodyText.includes(`{{${n}}}`)).map(([n, k]) => (
                    <Badge key={n} tone="primary">{`{{${n}}}`} = {TEMPLATE_VARIABLES.find((v) => v.key === k)?.label ?? k}</Badge>
                  ))}
                  {unmapped.map((n) => <Badge key={n} tone="red">{`{{${n}}}`} sem mapeamento</Badge>)}
                </div>
                <span>{d.bodyText.length}/1024</span>
              </div>
            </div>
            <Field label="Rodapé (opcional)"><Input value={d.footerText ?? ""} maxLength={60} onChange={(e) => setD({ ...d, footerText: e.target.value })} placeholder="Responda SAIR para não receber mais" /></Field>
            <div>
              <p className="mb-1.5 text-xs font-medium text-slate-600">Botões (opcional)</p>
              <div className="space-y-2">
                {d.buttonsJson.map((b, i) => (
                  <div key={i} className="flex gap-2">
                    <Select value={b.type} onChange={(e) => setD({ ...d, buttonsJson: d.buttonsJson.map((x, k) => (k === i ? { ...x, type: e.target.value as typeof b.type } : x)) })} className="w-40">
                      <option value="QUICK_REPLY">Resposta rápida</option>
                      <option value="URL">Link</option>
                      <option value="PHONE_NUMBER">Ligar</option>
                    </Select>
                    <Input value={b.text} maxLength={25} placeholder="Texto do botão" onChange={(e) => setD({ ...d, buttonsJson: d.buttonsJson.map((x, k) => (k === i ? { ...x, text: e.target.value } : x)) })} />
                    {b.type !== "QUICK_REPLY" && <Input value={b.value ?? ""} placeholder={b.type === "URL" ? "https://…" : "+5575…"} onChange={(e) => setD({ ...d, buttonsJson: d.buttonsJson.map((x, k) => (k === i ? { ...x, value: e.target.value } : x)) })} />}
                    <Button size="icon" variant="ghost" onClick={() => setD({ ...d, buttonsJson: d.buttonsJson.filter((_, k) => k !== i) })}><Trash2 /></Button>
                  </div>
                ))}
              </div>
              {d.buttonsJson.length < 3 && <Button size="xs" variant="outline" className="mt-2" onClick={() => setD({ ...d, buttonsJson: [...d.buttonsJson, { type: "QUICK_REPLY", text: "" }] })}><Plus /> Botão</Button>}
            </div>
          </div>
          <div className="space-y-3 lg:sticky lg:top-0">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold text-slate-600">Preview ao vivo</p>
              <div className="inline-flex rounded-md bg-muted p-0.5 text-[11px]">
                <button onClick={() => setPreviewName("sample")} className={cn("rounded px-2 py-0.5", previewName === "sample" && "bg-white shadow-sm")}>Com nome</button>
                <button onClick={() => setPreviewName("empty")} className={cn("rounded px-2 py-0.5", previewName === "empty" && "bg-white shadow-sm")}>Sem nome</button>
              </div>
            </div>
            <WhatsAppPreview headerType={d.headerType} headerContent={d.headerContent} body={rendered} footer={d.footerText} buttons={d.buttonsJson} businessName={workspaceName} />
            <p className="text-[11px] text-muted-foreground">No envio, cada variável é trocada pelos dados do destinatário. Se o contato não tiver nome, a variável e a vírgula/espaço sobrando são removidas automaticamente.</p>
            <div className="rounded-lg bg-slate-50 p-3 text-xs">
              <p className="text-muted-foreground">Custo por mensagem entregue</p>
              <p className="text-lg font-semibold">{formatBRL(META_PRICING[d.category], { decimals: 4 })}</p>
            </div>
          </div>
        </DialogBody>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button variant="outline" onClick={() => persist(false)} loading={loading === "save"} disabled={!d.name || !d.bodyText.trim()}>Salvar rascunho</Button>
          <Button onClick={() => persist(true)} loading={loading === "submit"} disabled={!d.name || !d.bodyText.trim() || unmapped.length > 0}><Send /> Enviar para aprovação</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
