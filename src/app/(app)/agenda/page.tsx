"use client";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { api, qs } from "@/lib/client";
import { TASK_TYPE_COLORS, TASK_TYPE_LABELS } from "@/lib/constants";
import { cn, formatDate } from "@/lib/utils";
import type { Task } from "@/lib/types";
import { useCan, useTeam } from "@/hooks/use-me";
import { useUi } from "@/stores/ui";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/input";
import { Badge, Card, PageHeader } from "@/components/ui/misc";
import { TaskDialog } from "@/components/shared/task-dialog";

function startOfWeek(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  x.setDate(x.getDate() - ((x.getDay() + 6) % 7));
  return x;
}

export default function Agenda() {
  const qc = useQueryClient();
  const { me } = useCan();
  const { data: team } = useTeam();
  const openContact = useUi((s) => s.openContact);
  const [view, setView] = useState<"semana" | "lista">("semana");
  const [anchor, setAnchor] = useState(() => startOfWeek(new Date()));
  const [userId, setUserId] = useState("");
  const [type, setType] = useState("");
  const [dialog, setDialog] = useState<{ task?: Task | null; date?: Date } | null>(null);
  const end = new Date(anchor.getTime() + 7 * 86400000);
  const { data: tasks } = useQuery({
    queryKey: ["tasks", view, anchor.toISOString(), userId, type],
    queryFn: () => api<Task[]>(`/api/tasks${qs(view === "semana" ? { from: anchor.toISOString(), to: end.toISOString(), assignedToId: userId, type } : { from: new Date(Date.now() - 30 * 86400000).toISOString(), assignedToId: userId, type })}`),
  });
  const { data: overdue } = useQuery({ queryKey: ["tasks", "overdue", userId], queryFn: () => api<Task[]>(`/api/tasks${qs({ overdue: 1, assignedToId: userId })}`) });
  const toggle = useMutation({
    mutationFn: (t: Task) => api(`/api/tasks/${t.id}`, { method: "PATCH", body: { isCompleted: !t.isCompleted } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tasks"] }),
  });
  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => new Date(anchor.getTime() + i * 86400000)), [anchor]);
  const today = new Date().toDateString();

  const TaskChip = ({ t }: { t: Task }) => (
    <div onClick={() => setDialog({ task: t })} className={cn("group cursor-pointer rounded-md border px-2 py-1.5 text-xs transition-shadow hover:shadow", TASK_TYPE_COLORS[t.type], t.isCompleted && "opacity-50")}>
      <div className="flex items-start gap-1.5">
        <button onClick={(e) => { e.stopPropagation(); toggle.mutate(t); }} className={cn("mt-px shrink-0", t.isCompleted ? "text-success" : "text-current opacity-40 hover:opacity-100")}><CheckCircle2 className="h-3.5 w-3.5" /></button>
        <div className="min-w-0">
          <p className="font-semibold">{new Date(t.dueDate).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })} · {TASK_TYPE_LABELS[t.type]}</p>
          <p className={cn("truncate", t.isCompleted && "line-through")}>{t.title}</p>
          {t.contact && <button onClick={(e) => { e.stopPropagation(); openContact(t.contact!.id); }} className="truncate underline-offset-2 hover:underline">{t.contact.name}</button>}
          {!me?.seesOnlyOwn && t.assignedTo && <p className="truncate opacity-70">{t.assignedTo.name}</p>}
        </div>
      </div>
    </div>
  );

  return (
    <div className="mx-auto max-w-[1400px] px-4 py-6">
      <PageHeader title="Agenda" description="Visitas, ligações, follow-ups e documentação." actions={<Button size="sm" onClick={() => setDialog({})}><Plus /> Nova tarefa</Button>} />
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="inline-flex rounded-lg bg-muted p-1 text-xs">
          <button onClick={() => setView("semana")} className={cn("rounded-md px-3 py-1.5 font-medium", view === "semana" ? "bg-white shadow-sm" : "text-muted-foreground")}>Semana</button>
          <button onClick={() => setView("lista")} className={cn("rounded-md px-3 py-1.5 font-medium", view === "lista" ? "bg-white shadow-sm" : "text-muted-foreground")}>Lista</button>
        </div>
        {view === "semana" && (
          <div className="flex items-center gap-1">
            <Button size="icon-sm" variant="outline" onClick={() => setAnchor(new Date(anchor.getTime() - 7 * 86400000))}><ChevronLeft /></Button>
            <Button size="sm" variant="outline" onClick={() => setAnchor(startOfWeek(new Date()))}>Hoje</Button>
            <Button size="icon-sm" variant="outline" onClick={() => setAnchor(new Date(anchor.getTime() + 7 * 86400000))}><ChevronRight /></Button>
            <span className="ml-2 text-sm font-medium">{anchor.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })} – {new Date(end.getTime() - 1).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" })}</span>
          </div>
        )}
        <div className="ml-auto flex gap-2">
          {!me?.seesOnlyOwn && <Select value={userId} onChange={(e) => setUserId(e.target.value)} className="w-auto"><option value="">Toda a equipe</option>{team?.filter((u) => u.isActive).map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}</Select>}
          <Select value={type} onChange={(e) => setType(e.target.value)} className="w-auto"><option value="">Todos os tipos</option>{Object.entries(TASK_TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</Select>
        </div>
      </div>
      {!!overdue?.length && (
        <Card className="mb-4 border-red-200 bg-red-50/50 p-3">
          <p className="mb-2 text-xs font-semibold text-red-700">⚠️ {overdue.length} tarefa(s) atrasada(s)</p>
          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-thin">{overdue.map((t) => <div key={t.id} className="w-56 shrink-0"><TaskChip t={t} /></div>)}</div>
        </Card>
      )}
      {view === "semana" ? (
        <div className="grid grid-cols-1 gap-2 md:grid-cols-7">
          {days.map((d) => {
            const list = (tasks ?? []).filter((t) => new Date(t.dueDate).toDateString() === d.toDateString());
            return (
              <div key={d.toISOString()} className={cn("min-h-[220px] rounded-lg border bg-white p-2", d.toDateString() === today && "border-primary ring-1 ring-primary/20")}>
                <div className="mb-2 flex items-center justify-between">
                  <p className="text-xs font-semibold capitalize">{d.toLocaleDateString("pt-BR", { weekday: "short" })} <span className={cn("ml-1 inline-flex h-6 w-6 items-center justify-center rounded-full", d.toDateString() === today && "bg-primary text-white")}>{d.getDate()}</span></p>
                  <button onClick={() => { const x = new Date(d); x.setHours(10, 0, 0, 0); setDialog({ date: x }); }} className="rounded p-0.5 text-muted-foreground hover:bg-muted"><Plus className="h-3.5 w-3.5" /></button>
                </div>
                <div className="space-y-1.5">{list.map((t) => <TaskChip key={t.id} t={t} />)}</div>
              </div>
            );
          })}
        </div>
      ) : (
        <Card className="divide-y">
          {(tasks ?? []).map((t) => (
            <div key={t.id} className="flex items-center gap-3 px-4 py-3">
              <button onClick={() => toggle.mutate(t)} className={t.isCompleted ? "text-success" : "text-slate-300 hover:text-slate-500"}><CheckCircle2 className="h-5 w-5" /></button>
              <div className="min-w-0 flex-1 cursor-pointer" onClick={() => setDialog({ task: t })}>
                <p className={cn("text-sm font-medium", t.isCompleted && "line-through text-muted-foreground")}>{t.title}</p>
                <p className="text-xs text-muted-foreground">{formatDate(t.dueDate, true)} · {t.contact?.name ?? "Sem contato"} · {t.assignedTo?.name}</p>
              </div>
              <Badge className={TASK_TYPE_COLORS[t.type]}>{TASK_TYPE_LABELS[t.type]}</Badge>
              {!t.isCompleted && new Date(t.dueDate) < new Date() && <Badge tone="red">Atrasada</Badge>}
            </div>
          ))}
          {!tasks?.length && <p className="px-4 py-8 text-center text-xs text-muted-foreground">Nenhuma tarefa.</p>}
        </Card>
      )}
      <TaskDialog open={!!dialog} onOpenChange={(o) => !o && setDialog(null)} task={dialog?.task} defaultDate={dialog?.date} onSaved={() => qc.invalidateQueries({ queryKey: ["tasks"] })} />
    </div>
  );
}
