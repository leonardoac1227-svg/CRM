"use client";
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { DragDropContext, Draggable, Droppable, type DropResult } from "@hello-pangea/dnd";
import { toast } from "sonner";
import { Clock, MessageCircle, Sparkles } from "lucide-react";
import Link from "next/link";
import { api, qs } from "@/lib/client";
import { cn, formatBRL, formatPhone, timeAgo } from "@/lib/utils";
import type { Stage } from "@/lib/types";
import { useUi } from "@/stores/ui";
import { Avatar, Skeleton } from "@/components/ui/misc";
import { OriginBadge } from "@/components/shared/badges";
import type { FunnelFilters } from "./analytics-view";

type Card = {
  id: string; name: string | null; phone: string; origin: string; stageId: string; dealValue: number | null; stageChangedAt: string; tags: string[]; status: string;
  seoLandingPage: string | null; aiQualifiedAt: string | null; assignedTo: { id: string; name: string } | null; conversations: { id: string }[];
};
type Board = { columns: { stage: Stage; cards: Card[]; total: number }[] };

export function KanbanView({ pipelineId, filters, q }: { pipelineId: string; filters: FunnelFilters; q: string }) {
  const qc = useQueryClient();
  const openContact = useUi((s) => s.openContact);
  const key = ["board", pipelineId, filters, q];
  const { data, isLoading } = useQuery({ queryKey: key, queryFn: () => api<Board>(`/api/pipelines/${pipelineId}/board${qs({ userId: filters.userId, origin: filters.origin, status: filters.status, q })}`) });
  const [cols, setCols] = useState<Board["columns"]>([]);
  useEffect(() => { if (data) setCols(data.columns); }, [data]);

  const move = useMutation({
    mutationFn: (p: { id: string; stageId: string }) => api(`/api/contacts/${p.id}`, { method: "PATCH", body: { stageId: p.stageId } }),
    onError: (e: Error) => { toast.error(e.message); qc.invalidateQueries({ queryKey: ["board"] }); },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["analytics"] }); qc.invalidateQueries({ queryKey: ["contacts"] }); },
  });

  function onDragEnd(r: DropResult) {
    if (!r.destination) return;
    const from = r.source.droppableId;
    const to = r.destination.droppableId;
    if (from === to && r.source.index === r.destination.index) return;
    // atualização otimista
    const next = cols.map((c) => ({ ...c, cards: [...c.cards] }));
    const src = next.find((c) => c.stage.id === from)!;
    const dst = next.find((c) => c.stage.id === to)!;
    const [card] = src.cards.splice(r.source.index, 1);
    const moved = { ...card, stageId: to, stageChangedAt: from !== to ? new Date().toISOString() : card.stageChangedAt };
    dst.cards.splice(r.destination.index, 0, moved);
    src.total = src.cards.reduce((a, c) => a + (c.dealValue ?? 0), 0);
    dst.total = dst.cards.reduce((a, c) => a + (c.dealValue ?? 0), 0);
    setCols(next);
    if (from !== to) {
      move.mutate({ id: card.id, stageId: to });
      toast.success(`${card.name ?? "Lead"} → ${dst.stage.name}${dst.stage.isWonStage ? " 🎉" : ""}`);
    }
  }

  if (isLoading) return <div className="flex gap-3">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-96 w-72 shrink-0" />)}</div>;

  return (
    <DragDropContext onDragEnd={onDragEnd}>
      <div className="flex h-[calc(100vh-var(--topbar-h)-170px)] min-h-[480px] gap-3 overflow-x-auto pb-3 scrollbar-thin">
        {cols.map((col) => (
          <div key={col.stage.id} className="flex w-72 shrink-0 flex-col rounded-xl bg-slate-100/80">
            <div className="px-3 pb-2 pt-3">
              <div className="flex items-center justify-between">
                <p className="flex items-center gap-2 text-sm font-semibold"><span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: col.stage.color }} /> {col.stage.name}</p>
                <span className="rounded-full bg-white px-2 py-0.5 text-[11px] font-semibold text-slate-600">{col.cards.length}</span>
              </div>
              <p className="mt-0.5 text-xs font-medium text-slate-500">{formatBRL(col.total)}</p>
              <div className="mt-2 h-1 rounded-full" style={{ backgroundColor: col.stage.color }} />
            </div>
            <Droppable droppableId={col.stage.id}>
              {(p, snap) => (
                <div ref={p.innerRef} {...p.droppableProps} className={cn("flex-1 space-y-2 overflow-y-auto px-2 pb-2 scrollbar-thin", snap.isDraggingOver && "bg-primary/5")}>
                  {col.cards.map((c, i) => {
                    const stale = Date.now() - new Date(c.stageChangedAt).getTime() > 7 * 86400000;
                    return (
                      <Draggable key={c.id} draggableId={c.id} index={i}>
                        {(dp, ds) => (
                          <div
                            ref={dp.innerRef}
                            {...dp.draggableProps}
                            {...dp.dragHandleProps}
                            onClick={() => openContact(c.id)}
                            className={cn("cursor-pointer rounded-lg border bg-white p-3 shadow-sm transition-shadow hover:shadow-md", ds.isDragging && "rotate-1 shadow-xl ring-2 ring-primary/30")}
                          >
                            <div className="flex items-start justify-between gap-2">
                              <p className="text-sm font-semibold leading-tight">{c.name ?? "Sem nome"}</p>
                              {c.aiQualifiedAt && <Sparkles className="h-3.5 w-3.5 shrink-0 text-secondary" aria-label="Qualificado pela IA" />}
                            </div>
                            <p className="mt-0.5 text-xs text-muted-foreground">{formatPhone(c.phone)}</p>
                            <div className="mt-2"><OriginBadge origin={c.origin} page={c.seoLandingPage} /></div>
                            {c.dealValue ? <p className="mt-2 text-sm font-semibold text-slate-800">{formatBRL(c.dealValue)}</p> : null}
                            <div className="mt-2.5 flex items-center justify-between border-t pt-2">
                              <span className="flex min-w-0 items-center gap-1.5 text-[11px] text-slate-600">
                                {c.assignedTo ? <><Avatar name={c.assignedTo.name} size={18} /> <span className="truncate">{c.assignedTo.name.split(" ")[0]}</span></> : <span className="italic text-muted-foreground">Sem responsável</span>}
                              </span>
                              <span className="flex items-center gap-2">
                                <span className={cn("flex items-center gap-1 text-[11px]", stale ? "font-medium text-amber-600" : "text-muted-foreground")} title="Tempo parado na etapa"><Clock className="h-3 w-3" /> {timeAgo(c.stageChangedAt)}</span>
                                <Link
                                  href={c.conversations[0] ? `/atendimento?conversa=${c.conversations[0].id}` : `/atendimento?contato=${c.id}`}
                                  onClick={(e) => e.stopPropagation()}
                                  className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-50 text-emerald-600 hover:bg-emerald-100"
                                  title="Abrir WhatsApp"
                                >
                                  <MessageCircle className="h-3.5 w-3.5" />
                                </Link>
                              </span>
                            </div>
                          </div>
                        )}
                      </Draggable>
                    );
                  })}
                  {p.placeholder}
                </div>
              )}
            </Droppable>
          </div>
        ))}
      </div>
    </DragDropContext>
  );
}
