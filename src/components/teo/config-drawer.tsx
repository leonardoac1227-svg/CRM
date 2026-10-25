"use client";
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { DragDropContext, Draggable, Droppable, type DropResult } from "@hello-pangea/dnd";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { toast } from "sonner";
import { Check, GripVertical, Image as ImageIcon, Mic, Pencil, Plus, Save, Sparkles, Trash2, Building2, Shuffle, UserCheck, UserCog, X } from "lucide-react";
import { api } from "@/lib/client";
import { cn } from "@/lib/utils";
import {
  AI_EMOJI_LABELS, AI_FOCUS_LABELS, AI_LENGTH_LABELS, AI_PRESET_LABELS, AI_PRESET_QUESTIONS, AI_TARGET_FIELDS, AI_TONE_LABELS,
} from "@/lib/constants";
import type { AiConfig, AiFaq, AiQuestion } from "@/lib/types";
import { useMe, usePipelines, useTeam } from "@/hooks/use-me";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/input";
import { Badge, Skeleton } from "@/components/ui/misc";
import { Switch, UnderlineTabs } from "@/components/ui/overlay";
import { LivePreview } from "./live-preview";

type Tab = "perfil" | "roteiro" | "respostas" | "negocios" | "atribuicao";

function Segmented<T extends string>({ value, onChange, options, size = "sm" }: { value: T; onChange: (v: T) => void; options: { value: T; label: React.ReactNode }[]; size?: "xs" | "sm" }) {
  return (
    <div className="inline-flex rounded-lg bg-muted p-0.5">
      {options.map((o) => (
        <button key={o.value} type="button" onClick={() => onChange(o.value)} className={cn("rounded-md font-medium transition-all", size === "xs" ? "px-2 py-0.5 text-[11px]" : "px-3 py-1 text-xs", value === o.value ? "bg-white text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

function ToggleRow({ icon, title, description, checked, onChange }: { icon: React.ReactNode; title: string; description: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex cursor-pointer items-center gap-3 rounded-lg border bg-white px-3 py-2.5 hover:bg-slate-50">
      <span className="flex h-8 w-8 items-center justify-center rounded-md bg-primary/10 text-primary">{icon}</span>
      <span className="flex-1">
        <span className="block text-sm font-medium">{title}</span>
        <span className="block text-xs text-muted-foreground">{description}</span>
      </span>
      <Switch checked={checked} onCheckedChange={onChange} />
    </label>
  );
}

function QuestionRow({ q, index, onChange, onRemove }: { q: AiQuestion; index: number; onChange: (q: AiQuestion) => void; onRemove: () => void }) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(q.questionText);
  useEffect(() => setText(q.questionText), [q.questionText]);
  return (
    <Draggable draggableId={`q-${index}-${q.questionText.slice(0, 12)}`} index={index}>
      {(p, snap) => (
        <div ref={p.innerRef} {...p.draggableProps} className={cn("rounded-lg border bg-white p-3", snap.isDragging && "shadow-lg ring-2 ring-primary/30")}>
          <div className="flex items-start gap-2">
            <span {...p.dragHandleProps} className="mt-0.5 cursor-grab text-slate-400 hover:text-slate-600" aria-label="Arrastar"><GripVertical className="h-4 w-4" /></span>
            <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[11px] font-semibold text-primary">{index + 1}</span>
            <div className="min-w-0 flex-1">
              {editing ? (
                <form onSubmit={(e) => { e.preventDefault(); if (text.trim().length >= 3) { onChange({ ...q, questionText: text.trim() }); setEditing(false); } }} className="flex gap-2">
                  <Input autoFocus value={text} onChange={(e) => setText(e.target.value)} className="h-8" />
                  <Button size="icon-sm" type="submit"><Check className="h-4 w-4" /></Button>
                  <Button size="icon-sm" variant="ghost" type="button" onClick={() => { setText(q.questionText); setEditing(false); }}><X className="h-4 w-4" /></Button>
                </form>
              ) : (
                <p className="text-sm font-medium leading-snug">{q.questionText}</p>
              )}
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <Segmented
                  size="xs"
                  value={q.requirementMode}
                  onChange={(v) => onChange({ ...q, requirementMode: v })}
                  options={[{ value: "SE_DER", label: "Se der" }, { value: "OBRIGATORIA", label: "Obrigatória" }]}
                />
                <select value={q.targetField ?? ""} onChange={(e) => onChange({ ...q, targetField: e.target.value || null })} className="h-6 rounded-md border bg-white px-1.5 text-[11px] text-slate-600 outline-none">
                  <option value="">Salvar como texto livre</option>
                  {AI_TARGET_FIELDS.map((f) => <option key={f.key} value={f.key}>→ {f.label}</option>)}
                </select>
              </div>
              <p className="mt-1.5 text-[11px] text-muted-foreground">
                {q.requirementMode === "OBRIGATORIA" ? "Insiste educadamente até coletar o dado (até 3 tentativas)." : "Se o cliente pular ou mudar de assunto, segue adiante sem travar a conversa."}
              </p>
            </div>
            {!editing && (
              <div className="flex shrink-0 gap-0.5">
                <button onClick={() => setEditing(true)} className="rounded p-1 text-slate-400 hover:bg-muted hover:text-slate-700" aria-label="Editar"><Pencil className="h-3.5 w-3.5" /></button>
                <button onClick={onRemove} className="rounded p-1 text-slate-400 hover:bg-red-50 hover:text-red-600" aria-label="Excluir"><Trash2 className="h-3.5 w-3.5" /></button>
              </div>
            )}
          </div>
        </div>
      )}
    </Draggable>
  );
}

function FaqRow({ f, onChange, onRemove }: { f: AiFaq; onChange: (f: AiFaq) => void; onRemove: () => void }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-lg border bg-white">
      <div className="flex items-center gap-3 px-3 py-2.5">
        <Switch checked={f.isEnabled} onCheckedChange={(v) => onChange({ ...f, isEnabled: v })} />
        <button onClick={() => setOpen((o) => !o)} className="flex-1 text-left text-sm font-medium">{f.questionTitle}</button>
        <button onClick={() => setOpen((o) => !o)} className="rounded p-1 text-slate-400 hover:bg-muted"><Pencil className="h-3.5 w-3.5" /></button>
        <button onClick={onRemove} className="rounded p-1 text-slate-400 hover:bg-red-50 hover:text-red-600"><Trash2 className="h-3.5 w-3.5" /></button>
      </div>
      {open && (
        <div className="space-y-2 border-t px-3 py-3">
          <Field label="Pergunta do cliente"><Input value={f.questionTitle} onChange={(e) => onChange({ ...f, questionTitle: e.target.value })} /></Field>
          <Field label="Resposta do assistente"><Textarea rows={3} value={f.answerText} onChange={(e) => onChange({ ...f, answerText: e.target.value })} /></Field>
          <Field label="Palavras-chave (separadas por vírgula)" hint="Usadas para reconhecer a dúvida quando não há LLM configurado.">
            <Input value={f.keywords.join(", ")} onChange={(e) => onChange({ ...f, keywords: e.target.value.split(",").map((k) => k.trim()).filter(Boolean) })} />
          </Field>
        </div>
      )}
    </div>
  );
}

export function TeoConfigDrawer({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const qc = useQueryClient();
  const { data: me } = useMe();
  const { data: team } = useTeam();
  const { data: pipelines } = usePipelines();
  const { data: remote } = useQuery({ queryKey: ["teo-config"], queryFn: () => api<AiConfig>("/api/teo/config"), enabled: open });
  const [cfg, setCfg] = useState<AiConfig | null>(null);
  const [tab, setTab] = useState<Tab>("perfil");
  const [newQ, setNewQ] = useState("");
  useEffect(() => { if (remote && open) setCfg(structuredClone(remote)); }, [remote, open]);

  const save = useMutation({
    mutationFn: (c: AiConfig) => api<AiConfig>("/api/teo/config", { method: "PUT", body: c }),
    onSuccess: (c) => {
      qc.setQueryData(["teo-config"], c);
      qc.invalidateQueries({ queryKey: ["teo-automations"] });
      qc.invalidateQueries({ queryKey: ["me"] });
      toast.success(`${c.assistantName} atualizado!`);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const dirty = useMemo(() => !!cfg && !!remote && JSON.stringify(cfg) !== JSON.stringify(remote), [cfg, remote]);
  const set = <K extends keyof AiConfig>(k: K, v: AiConfig[K]) => setCfg((c) => (c ? { ...c, [k]: v } : c));

  function applyPreset(preset: string) {
    if (!cfg) return;
    const suggestions = AI_PRESET_QUESTIONS[preset] ?? [];
    const replace = !cfg.questions.length || confirm(`Usar as perguntas sugeridas para "${AI_PRESET_LABELS[preset]}"? As perguntas atuais do roteiro serão substituídas.`);
    setCfg({
      ...cfg,
      preset,
      focus: preset === "LOCACAO" ? "LOCACAO" : preset === "VENDA_E_LOCACAO" ? "AMBOS" : cfg.focus === "LOCACAO" ? "VENDAS" : cfg.focus,
      qualificationObjective: preset === "LOCACAO" ? "LOCACAO" : "COMPRA",
      questions: replace ? suggestions.map((q) => ({ ...q })) : cfg.questions,
    });
    if (replace && suggestions.length) toast.success(`${suggestions.length} perguntas sugeridas adicionadas ao Roteiro`);
  }

  function onDragEnd(r: DropResult) {
    if (!cfg || !r.destination) return;
    const qs = [...cfg.questions];
    const [m] = qs.splice(r.source.index, 1);
    qs.splice(r.destination.index, 0, m);
    set("questions", qs);
  }

  const targetPipeline = pipelines?.find((p) => p.id === cfg?.targetPipelineId) ?? pipelines?.[0];
  const brokers = (team ?? []).filter((u) => u.role === "BROKER" && u.isActive);

  return (
    <DialogPrimitive.Root open={open} onOpenChange={(o) => { if (!o && dirty && !confirm("Descartar alterações não salvas?")) return; onOpenChange(o); }}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-slate-900/40 animate-fade-in" />
        <DialogPrimitive.Content className="fixed inset-y-0 right-0 z-50 flex w-full max-w-[1180px] flex-col bg-white shadow-2xl animate-slide-in-right focus:outline-none">
          <div className="flex items-center gap-3 border-b px-5 py-3.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-secondary text-white"><Sparkles className="h-4 w-4" /></span>
            <div className="flex-1">
              <DialogPrimitive.Title className="text-base font-semibold">Configurar Atendimento no WhatsApp</DialogPrimitive.Title>
              <DialogPrimitive.Description className="text-xs text-muted-foreground">Como o {cfg?.assistantName ?? "Téo"} atende, qualifica e distribui os novos leads.</DialogPrimitive.Description>
            </div>
            {cfg && (
              <label className="flex items-center gap-2 text-xs font-medium">
                {cfg.isActive ? "Ligado" : "Desligado"} <Switch checked={cfg.isActive} onCheckedChange={(v) => set("isActive", v)} />
              </label>
            )}
            <Button size="sm" onClick={() => cfg && save.mutate(cfg)} disabled={!dirty} loading={save.isPending}><Save /> Salvar</Button>
            <DialogPrimitive.Close className="rounded-md p-1.5 text-muted-foreground hover:bg-muted"><X className="h-4 w-4" /></DialogPrimitive.Close>
          </div>
          {!cfg ? (
            <div className="grid flex-1 grid-cols-2 gap-4 p-6"><Skeleton className="h-full" /><Skeleton className="h-full" /></div>
          ) : (
            <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[1fr_420px]">
              <div className="flex min-h-0 flex-col">
                <UnderlineTabs
                  className="px-5 pt-3"
                  value={tab}
                  onChange={setTab}
                  items={[
                    { value: "perfil", label: "Perfil" },
                    { value: "roteiro", label: <>Roteiro <Badge tone="primary" className="py-0">{cfg.questions.length}</Badge></> },
                    { value: "respostas", label: "Respostas" },
                    { value: "negocios", label: "Negócios" },
                    { value: "atribuicao", label: "Atribuição" },
                  ]}
                />
                <div className="flex-1 space-y-5 overflow-y-auto p-5 scrollbar-thin">
                  {tab === "perfil" && (
                    <>
                      <div className="grid gap-4 sm:grid-cols-2">
                        <Field label="Padrão de atendimento" hint="Escolher um padrão preenche as sugestões de perguntas do Roteiro.">
                          <Select value={cfg.preset} onChange={(e) => applyPreset(e.target.value)}>
                            {Object.entries(AI_PRESET_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                          </Select>
                        </Field>
                        <Field label="Foco">
                          <Select value={cfg.focus} onChange={(e) => set("focus", e.target.value as AiConfig["focus"])}>
                            {Object.entries(AI_FOCUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                          </Select>
                        </Field>
                        <Field label="Nome"><Input value={cfg.assistantName} maxLength={30} onChange={(e) => set("assistantName", e.target.value)} placeholder="Téo, Clara…" /></Field>
                        <Field label="Papel"><Input value={cfg.roleTitle} onChange={(e) => set("roleTitle", e.target.value)} placeholder="Assistente virtual" /></Field>
                        <Field label="Jeito de conversar">
                          <Select value={cfg.tone} onChange={(e) => set("tone", e.target.value as AiConfig["tone"])}>
                            {Object.entries(AI_TONE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                          </Select>
                        </Field>
                        <Field label="Emojis">
                          <Select value={cfg.emojiLevel} onChange={(e) => set("emojiLevel", e.target.value as AiConfig["emojiLevel"])}>
                            {Object.entries(AI_EMOJI_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                          </Select>
                        </Field>
                        <Field label="Tamanho das mensagens">
                          <Select value={cfg.messageLength} onChange={(e) => set("messageLength", e.target.value as AiConfig["messageLength"])}>
                            {Object.entries(AI_LENGTH_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                          </Select>
                        </Field>
                        <Field label="Cidade de atuação"><Input value={cfg.regionCity ?? ""} onChange={(e) => set("regionCity", e.target.value)} placeholder="Feira de Santana - BA" /></Field>
                      </div>
                      <Field label="Mensagem inicial" hint={<>Variáveis: <code>{"{{nome_assistente}}"}</code> <code>{"{{nome_empresa}}"}</code> <code>{"{{nome_cliente}}"}</code> <code>{"{{cidade}}"}</code></>}>
                        <Textarea rows={2} value={cfg.initialGreeting} onChange={(e) => set("initialGreeting", e.target.value)} />
                      </Field>
                      <div className="space-y-2">
                        <p className="text-xs font-medium text-slate-600">Multimídia</p>
                        <ToggleRow icon={<Mic className="h-4 w-4" />} title="Áudio" description="Transcreve os áudios que o cliente enviar." checked={cfg.enableAudioTranscription} onChange={(v) => set("enableAudioTranscription", v)} />
                        <ToggleRow icon={<ImageIcon className="h-4 w-4" />} title="Imagem" description="Interpreta fotos e documentos (holerite, RG, comprovantes)." checked={cfg.enableImageAnalysis} onChange={(v) => set("enableImageAnalysis", v)} />
                        <ToggleRow icon={<Building2 className="h-4 w-4" />} title="Imóveis / Catálogo" description="Recomenda itens cadastrados quando o cliente pedir opções." checked={cfg.enableCatalogSend} onChange={(v) => set("enableCatalogSend", v)} />
                      </div>
                    </>
                  )}

                  {tab === "roteiro" && (
                    <>
                      <div>
                        <p className="mb-1.5 text-xs font-medium text-slate-600">Objetivo da qualificação</p>
                        <Segmented value={cfg.qualificationObjective === "LOCACAO" ? "LOCACAO" : "COMPRA"} onChange={(v) => set("qualificationObjective", v)} options={[{ value: "COMPRA", label: "Compra" }, { value: "LOCACAO", label: "Locação" }]} />
                      </div>
                      <Field label="Instruções extras para o assistente" hint={`${(cfg.customPromptContext ?? "").length}/500 caracteres`}>
                        <Textarea rows={3} maxLength={500} value={cfg.customPromptContext ?? ""} onChange={(e) => set("customPromptContext", e.target.value)} placeholder="Ex.: Trabalhamos só com imóveis até R$ 450 mil. Nunca informe taxa de juros." />
                      </Field>
                      <div>
                        <div className="mb-2 flex items-center justify-between">
                          <p className="text-xs font-medium text-slate-600">Perguntas de qualificação <span className="text-muted-foreground">({cfg.questions.length}/10 · arraste para reordenar)</span></p>
                        </div>
                        <DragDropContext onDragEnd={onDragEnd}>
                          <Droppable droppableId="questions">
                            {(p) => (
                              <div ref={p.innerRef} {...p.droppableProps} className="space-y-2">
                                {cfg.questions.map((q, i) => (
                                  <QuestionRow
                                    key={`${i}-${q.questionText}`}
                                    q={q}
                                    index={i}
                                    onChange={(nq) => set("questions", cfg.questions.map((x, k) => (k === i ? nq : x)))}
                                    onRemove={() => set("questions", cfg.questions.filter((_, k) => k !== i))}
                                  />
                                ))}
                                {p.placeholder}
                              </div>
                            )}
                          </Droppable>
                        </DragDropContext>
                        {cfg.questions.length < 10 ? (
                          <form
                            onSubmit={(e) => {
                              e.preventDefault();
                              if (newQ.trim().length < 3) return;
                              set("questions", [...cfg.questions, { questionText: newQ.trim(), requirementMode: "SE_DER", targetField: null }]);
                              setNewQ("");
                            }}
                            className="mt-2 flex gap-2"
                          >
                            <Input value={newQ} onChange={(e) => setNewQ(e.target.value)} placeholder="+ Escrever uma pergunta" className="border-dashed" />
                            <Button type="submit" variant="outline" disabled={newQ.trim().length < 3}><Plus /> Adicionar</Button>
                          </form>
                        ) : (
                          <p className="mt-2 text-xs text-amber-700">Limite de 10 perguntas atingido.</p>
                        )}
                      </div>
                    </>
                  )}

                  {tab === "respostas" && (
                    <>
                      <div>
                        <p className="mb-2 text-xs font-medium text-slate-600">Dúvidas frequentes</p>
                        <div className="space-y-2">
                          {cfg.faqs.map((f, i) => (
                            <FaqRow key={i} f={f} onChange={(nf) => set("faqs", cfg.faqs.map((x, k) => (k === i ? nf : x)))} onRemove={() => set("faqs", cfg.faqs.filter((_, k) => k !== i))} />
                          ))}
                        </div>
                        <Button variant="outline" size="sm" className="mt-2" onClick={() => set("faqs", [...cfg.faqs, { questionTitle: "Nova pergunta", answerText: "Resposta…", keywords: [], isEnabled: true }])}><Plus /> Adicionar resposta</Button>
                      </div>
                      <div className="space-y-3 rounded-lg border bg-slate-50/60 p-4">
                        <p className="text-sm font-semibold">Transbordo para o corretor</p>
                        <ul className="space-y-1 text-xs text-muted-foreground">
                          <li>• Se o lead pedir para falar com um corretor/vendedor a qualquer momento, transfere na hora.</li>
                          <li>• Se o lead parar de responder, transfere com o que já foi coletado para o corretor assumir.</li>
                        </ul>
                        <Field label="Mensagem de transferência"><Textarea rows={2} value={cfg.handoffMessage} onChange={(e) => set("handoffMessage", e.target.value)} /></Field>
                        <Field label="Transferir após inatividade de">
                          <div className="flex items-center gap-2">
                            <Input type="number" min={1} max={168} value={cfg.inactivityTimeoutHours} onChange={(e) => set("inactivityTimeoutHours", Number(e.target.value) || 24)} className="w-24" />
                            <span className="text-sm text-muted-foreground">horas</span>
                          </div>
                        </Field>
                      </div>
                    </>
                  )}

                  {tab === "negocios" && (
                    <>
                      <div className="rounded-lg border p-4">
                        <p className="text-sm font-semibold">Onde o lead entra</p>
                        <p className="mb-3 text-xs text-muted-foreground">Novos contatos que chegarem pelo WhatsApp são criados neste funil e etapa.</p>
                        <div className="grid gap-3 sm:grid-cols-2">
                          <Field label="Funil">
                            <Select value={cfg.targetPipelineId ?? ""} onChange={(e) => { const p = pipelines?.find((x) => x.id === e.target.value); setCfg({ ...cfg, targetPipelineId: e.target.value, targetStageId: p?.stages[0]?.id ?? null, qualifiedStageId: p?.stages[1]?.id ?? null }); }}>
                              {(pipelines ?? []).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                            </Select>
                          </Field>
                          <Field label="Etapa de entrada">
                            <Select value={cfg.targetStageId ?? ""} onChange={(e) => set("targetStageId", e.target.value)}>
                              {targetPipeline?.stages.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                            </Select>
                          </Field>
                        </div>
                      </div>
                      <div className="rounded-lg border p-4">
                        <p className="text-sm font-semibold">Depois da qualificação</p>
                        <p className="mb-3 text-xs text-muted-foreground">Quando o {cfg.assistantName} terminar as perguntas, o lead avança para:</p>
                        <Field label="Etapa pós-qualificação">
                          <Select value={cfg.qualifiedStageId ?? ""} onChange={(e) => set("qualifiedStageId", e.target.value || null)}>
                            <option value="">Manter na etapa atual</option>
                            {targetPipeline?.stages.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                          </Select>
                        </Field>
                        <p className="mt-3 rounded-md bg-primary/5 px-3 py-2 text-xs text-primary">Um <strong>Relatório Estruturado de Qualificação</strong> (renda, entrada, perfil, origem SEO e temperatura) é salvo na ficha do contato.</p>
                      </div>
                    </>
                  )}

                  {tab === "atribuicao" && (
                    <>
                      <p className="text-sm text-muted-foreground">Para quem o lead vai depois que o {cfg.assistantName} qualificar:</p>
                      <div className="grid gap-3 sm:grid-cols-3">
                        {([
                          { value: "ROULETTE", icon: Shuffle, title: "Roleta de corretores", desc: "Round-robin entre os corretores de plantão, respeitando o peso de cada um." },
                          { value: "MANAGER_MANUAL", icon: UserCog, title: "Gestor distribui", desc: "O lead fica sem responsável e o gestor é notificado para distribuir." },
                          { value: "FIXED_USER", icon: UserCheck, title: "Usuário específico", desc: "Todos os leads vão para a mesma pessoa." },
                        ] as const).map((o) => (
                          <button key={o.value} onClick={() => set("distributionMode", o.value)} className={cn("rounded-lg border p-4 text-left transition-colors hover:border-primary/40", cfg.distributionMode === o.value && "border-primary bg-primary/[0.04] ring-1 ring-primary/30")}>
                            <o.icon className={cn("h-5 w-5", cfg.distributionMode === o.value ? "text-primary" : "text-muted-foreground")} />
                            <p className="mt-2 text-sm font-semibold">{o.title}</p>
                            <p className="mt-1 text-xs text-muted-foreground">{o.desc}</p>
                          </button>
                        ))}
                      </div>
                      {cfg.distributionMode === "FIXED_USER" && (
                        <Field label="Usuário">
                          <Select value={cfg.fixedUserId ?? ""} onChange={(e) => set("fixedUserId", e.target.value || null)}>
                            <option value="">Selecione…</option>
                            {(team ?? []).filter((u) => u.isActive).map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
                          </Select>
                        </Field>
                      )}
                      {cfg.distributionMode === "ROULETTE" && (
                        <div className="rounded-lg border p-4">
                          <p className="mb-2 text-sm font-semibold">Corretores no plantão</p>
                          <div className="flex flex-wrap gap-2">
                            {brokers.map((b) => <Badge key={b.id} tone={b.inRoulette ? "green" : "slate"}>{b.inRoulette ? "🟢" : "⏸️"} {b.name} {b.inRoulette && `· peso ${b.rouletteWeight}`}</Badge>)}
                          </div>
                          <p className="mt-2 text-xs text-muted-foreground">Gerencie quem está no plantão em <a href="/equipe" className="text-primary hover:underline">Equipe</a>.</p>
                        </div>
                      )}
                      <ToggleRow icon={<Sparkles className="h-4 w-4" />} title="Avisar o corretor no WhatsApp" description="Envia o relatório de qualificação para o WhatsApp pessoal do corretor sorteado." checked={cfg.notifyBrokerOnWhatsApp} onChange={(v) => set("notifyBrokerOnWhatsApp", v)} />
                    </>
                  )}
                </div>
              </div>
              <div className="hidden min-h-0 border-l lg:block">
                <LivePreview config={cfg} company={me?.workspace.name ?? "sua empresa"} />
              </div>
            </div>
          )}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
