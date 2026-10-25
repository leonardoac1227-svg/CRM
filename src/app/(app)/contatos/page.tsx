"use client";
import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ChevronLeft, ChevronRight, Download, MessageCircle, Plus, Search, Upload, Users, X } from "lucide-react";
import { api, qs } from "@/lib/client";
import { ORIGIN_LABELS } from "@/lib/constants";
import { cn, formatDate, formatPhone, timeAgo } from "@/lib/utils";
import type { Contact } from "@/lib/types";
import { useCan, usePipelines, useTeam } from "@/hooks/use-me";
import { useUi } from "@/stores/ui";
import { Button } from "@/components/ui/button";
import { Checkbox, Select } from "@/components/ui/input";
import { Avatar, Card, EmptyState, PageHeader, Skeleton } from "@/components/ui/misc";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/overlay";
import { OriginBadge, StageDot, TagChip } from "@/components/shared/badges";
import { ImportDialog } from "@/components/contacts/import-dialog";
import { CreateContactDialog } from "@/components/contacts/create-dialog";

type Resp = { items: Contact[]; total: number; page: number; pageSize: number; tags: string[] };

function Contatos() {
  const sp = useSearchParams();
  const router = useRouter();
  const qc = useQueryClient();
  const openContact = useUi((s) => s.openContact);
  const { isManager, me } = useCan();
  const { data: team } = useTeam();
  const { data: pipelines } = usePipelines();
  const [q, setQ] = useState("");
  const [deb, setDeb] = useState("");
  const [stageId, setStageId] = useState(sp.get("etapa") ?? "");
  const [assignedToId, setAssigned] = useState(sp.get("responsavel") ?? "");
  const [origin, setOrigin] = useState(sp.get("origem") ?? "");
  const [tag, setTag] = useState("");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [importOpen, setImportOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);

  useEffect(() => { const t = setTimeout(() => { setDeb(q); setPage(1); }, 250); return () => clearTimeout(t); }, [q]);
  useEffect(() => { const id = sp.get("id"); if (id) openContact(id); }, [sp, openContact]);

  const params = { q: deb, stageId, assignedToId, origin, tag, page, pageSize: 25 };
  const { data, isLoading } = useQuery({ queryKey: ["contacts", params], queryFn: () => api<Resp>(`/api/contacts${qs(params)}`) });
  const bulk = useMutation({
    mutationFn: (p: { action: string; value?: string | null }) => api<{ affected: number }>("/api/contacts/bulk", { body: { ids: [...selected], ...p } }),
    onSuccess: (r) => { toast.success(`${r.affected} contatos atualizados`); setSelected(new Set()); qc.invalidateQueries({ queryKey: ["contacts"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const stages = useMemo(() => pipelines?.flatMap((p) => p.stages.map((s) => ({ ...s, pipelineName: p.name }))) ?? [], [pipelines]);
  const items = data?.items ?? [];
  const allChecked = items.length > 0 && items.every((c) => selected.has(c.id));
  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;
  const hasFilters = stageId || assignedToId || origin || tag || deb;

  function exportCsv() {
    const head = ["Nome", "Telefone", "E-mail", "Responsável", "Etapa", "Origem", "Página SEO", "Criado em"];
    const lines = items.map((c) => [c.name ?? "", c.phone, c.email ?? "", c.assignedTo?.name ?? "", c.stage?.name ?? "", ORIGIN_LABELS[c.origin], c.seoLandingPage ?? "", formatDate(c.createdAt)].map((v) => `"${String(v).replace(/"/g, '""')}"`).join(";"));
    const blob = new Blob(["﻿" + [head.join(";"), ...lines].join("\n")], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "contatos.csv";
    a.click();
  }

  return (
    <div className="mx-auto max-w-[1400px] px-4 py-6">
      <PageHeader
        title="Contatos"
        description={`${data?.total ?? "…"} contatos${me?.seesOnlyOwn ? " na sua carteira" : ""}`}
        actions={
          <>
            <Button variant="outline" size="sm" onClick={exportCsv}><Download /> Exportar</Button>
            <Button variant="outline" size="sm" onClick={() => setImportOpen(true)}><Upload /> Importar (Excel/CSV)</Button>
            <Button size="sm" onClick={() => setCreateOpen(true)}><Plus /> Criar contato</Button>
          </>
        }
      />
      <Card className="mb-4 flex flex-wrap items-center gap-2 p-3">
        <div className="relative min-w-[220px] flex-1">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por nome, telefone, e-mail ou #código" className="h-9 w-full rounded-md border bg-white pl-8 pr-3 text-sm outline-none focus:border-primary/50" />
        </div>
        <Select value={stageId} onChange={(e) => { setStageId(e.target.value); setPage(1); }} className="w-auto min-w-[160px]">
          <option value="">Todas as etapas</option>
          {pipelines?.map((p) => <optgroup key={p.id} label={p.name}>{p.stages.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</optgroup>)}
        </Select>
        {!me?.seesOnlyOwn && (
          <Select value={assignedToId} onChange={(e) => { setAssigned(e.target.value); setPage(1); }} className="w-auto min-w-[160px]">
            <option value="">Todos os responsáveis</option>
            <option value="none">Sem responsável</option>
            {team?.filter((u) => u.isActive).map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
          </Select>
        )}
        <Select value={origin} onChange={(e) => { setOrigin(e.target.value); setPage(1); }} className="w-auto min-w-[170px]">
          <option value="">Todas as origens</option>
          <option value="SEO_ORGANICO">🌐 Google Orgânico / SEO</option>
          {Object.entries(ORIGIN_LABELS).filter(([k]) => k !== "SEO_ORGANICO").map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </Select>
        <Select value={tag} onChange={(e) => { setTag(e.target.value); setPage(1); }} className="w-auto min-w-[130px]">
          <option value="">Etiquetas</option>
          {data?.tags.map((t) => <option key={t} value={t}>#{t}</option>)}
        </Select>
        {hasFilters && <Button variant="ghost" size="sm" onClick={() => { setQ(""); setStageId(""); setAssigned(""); setOrigin(""); setTag(""); router.replace("/contatos"); }}><X /> Limpar</Button>}
      </Card>

      {selected.size > 0 && (
        <div className="mb-3 flex flex-wrap items-center gap-2 rounded-lg border border-primary/30 bg-primary/5 px-4 py-2 text-sm">
          <span className="font-medium">{selected.size} selecionado(s)</span>
          <DropdownMenu>
            <DropdownMenuTrigger asChild><Button size="xs" variant="outline">Mover etapa ▾</Button></DropdownMenuTrigger>
            <DropdownMenuContent>{stages.map((s) => <DropdownMenuItem key={s.id} onSelect={() => bulk.mutate({ action: "stage", value: s.id })}><StageDot color={s.color} /> {s.pipelineName} · {s.name}</DropdownMenuItem>)}</DropdownMenuContent>
          </DropdownMenu>
          {isManager && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild><Button size="xs" variant="outline">Atribuir ▾</Button></DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuItem onSelect={() => bulk.mutate({ action: "assign", value: null })}>Sem responsável</DropdownMenuItem>
                {team?.filter((u) => u.isActive).map((u) => <DropdownMenuItem key={u.id} onSelect={() => bulk.mutate({ action: "assign", value: u.id })}>{u.name}</DropdownMenuItem>)}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
          <Button size="xs" variant="outline" onClick={() => { const t = prompt("Etiqueta para adicionar:"); if (t) bulk.mutate({ action: "addTag", value: t.trim().toLowerCase() }); }}>+ Etiqueta</Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild><Button size="xs" variant="outline">IA ▾</Button></DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem onSelect={() => bulk.mutate({ action: "aiOn" })}>Ligar qualificação com IA</DropdownMenuItem>
              <DropdownMenuItem onSelect={() => bulk.mutate({ action: "aiOff" })}>Desligar qualificação com IA</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Button size="xs" variant="soft" asChild><Link href={`/campanhas?novo=1&contatos=${[...selected].join(",")}`}>Criar campanha</Link></Button>
          {isManager && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild><Button size="xs" variant="ghost" className="text-red-600">Excluir</Button></DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuLabel>Excluir {selected.size} contatos?</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem className="text-red-600" onSelect={() => bulk.mutate({ action: "delete" })}>Sim, excluir definitivamente</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
          <button onClick={() => setSelected(new Set())} className="ml-auto text-xs text-muted-foreground hover:text-foreground">Limpar seleção</button>
        </div>
      )}

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1100px] text-sm">
            <thead className="border-b bg-slate-50 text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="w-10 px-4 py-3"><Checkbox checked={allChecked} onChange={(e) => setSelected(e.target.checked ? new Set(items.map((c) => c.id)) : new Set())} /></th>
                <th className="px-3 py-3">Contato</th>
                <th className="px-3 py-3">WhatsApp / Telefone</th>
                <th className="px-3 py-3">Responsável</th>
                <th className="px-3 py-3">Funil e etapa</th>
                <th className="px-3 py-3">Origem</th>
                <th className="px-3 py-3">Criado em</th>
                <th className="px-3 py-3">Última interação</th>
                <th className="px-3 py-3" />
              </tr>
            </thead>
            <tbody>
              {isLoading && Array.from({ length: 8 }).map((_, i) => <tr key={i} className="border-b"><td colSpan={9} className="px-4 py-3"><Skeleton className="h-8" /></td></tr>)}
              {items.map((c) => (
                <tr key={c.id} onClick={() => openContact(c.id)} className={cn("cursor-pointer border-b transition-colors last:border-0 hover:bg-slate-50", selected.has(c.id) && "bg-primary/[0.03]")}>
                  <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                    <Checkbox checked={selected.has(c.id)} onChange={(e) => { const n = new Set(selected); if (e.target.checked) n.add(c.id); else n.delete(c.id); setSelected(n); }} />
                  </td>
                  <td className="px-3 py-3">
                    <div className="flex items-center gap-3">
                      <Avatar name={c.name ?? c.phone} size={32} />
                      <div className="min-w-0">
                        <p className="truncate font-medium">{c.name ?? "Sem nome"}</p>
                        <div className="mt-0.5 flex flex-wrap gap-1">{c.tags.slice(0, 3).map((t) => <TagChip key={t} tag={t} />)}</div>
                      </div>
                    </div>
                  </td>
                  <td className="whitespace-nowrap px-3 py-3 text-slate-600">{formatPhone(c.phone)}</td>
                  <td className="px-3 py-3">{c.assignedTo ? <span className="flex items-center gap-2"><Avatar name={c.assignedTo.name} size={22} /> <span className="text-xs">{c.assignedTo.name}</span></span> : <span className="text-xs text-muted-foreground">Sem responsável</span>}</td>
                  <td className="px-3 py-3">
                    <p className="text-[11px] text-muted-foreground">{c.pipeline?.name}</p>
                    <p className="flex items-center gap-1.5 text-xs font-medium">{c.stage && <StageDot color={c.stage.color} />} {c.stage?.name ?? "—"}</p>
                  </td>
                  <td className="max-w-[220px] px-3 py-3"><OriginBadge origin={c.origin} page={c.seoLandingPage} /></td>
                  <td className="whitespace-nowrap px-3 py-3 text-xs text-slate-600">{formatDate(c.createdAt)}</td>
                  <td className="whitespace-nowrap px-3 py-3 text-xs text-slate-600">{timeAgo(c.lastInteractionAt)}</td>
                  <td className="px-3 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                    <Button size="xs" variant="soft" asChild>
                      <Link href={c.conversations?.[0] ? `/atendimento?conversa=${c.conversations[0].id}` : `/atendimento?contato=${c.id}`}><MessageCircle /> Atender</Link>
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!isLoading && !items.length && <EmptyState icon={<Users className="h-5 w-5" />} title="Nenhum contato encontrado" description={hasFilters ? "Tente ajustar os filtros." : "Crie seu primeiro contato ou importe uma planilha."} action={<Button size="sm" onClick={() => setCreateOpen(true)}><Plus /> Criar contato</Button>} />}
        {data && data.total > data.pageSize && (
          <div className="flex items-center justify-between border-t px-4 py-2.5 text-xs text-muted-foreground">
            <span>{(page - 1) * data.pageSize + 1}–{Math.min(page * data.pageSize, data.total)} de {data.total}</span>
            <div className="flex items-center gap-1">
              <Button size="icon-sm" variant="ghost" disabled={page <= 1} onClick={() => setPage(page - 1)}><ChevronLeft /></Button>
              <span className="px-2">{page} / {totalPages}</span>
              <Button size="icon-sm" variant="ghost" disabled={page >= totalPages} onClick={() => setPage(page + 1)}><ChevronRight /></Button>
            </div>
          </div>
        )}
      </Card>
      <ImportDialog open={importOpen} onOpenChange={setImportOpen} onDone={() => qc.invalidateQueries({ queryKey: ["contacts"] })} />
      <CreateContactDialog open={createOpen} onOpenChange={setCreateOpen} onCreated={(id) => { qc.invalidateQueries({ queryKey: ["contacts"] }); openContact(id); }} />
    </div>
  );
}

export default function Page() {
  return (
    <Suspense>
      <Contatos />
    </Suspense>
  );
}
