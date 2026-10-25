import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { body, route } from "@/lib/api";
import { seesOnlyOwn, taskScope } from "@/lib/rbac";
import { logActivity } from "@/lib/services/activity";
import { TASK_TYPE_LABELS } from "@/lib/constants";
import { formatDate } from "@/lib/utils";

export const GET = route(async ({ req, session }) => {
  const sp = req.nextUrl.searchParams;
  const and: Prisma.TaskWhereInput[] = [taskScope(session)];
  if (sp.get("from")) and.push({ dueDate: { gte: new Date(sp.get("from")!) } });
  if (sp.get("to")) and.push({ dueDate: { lte: new Date(sp.get("to")!) } });
  if (sp.get("contactId")) and.push({ contactId: sp.get("contactId") });
  if (sp.get("assignedToId")) and.push({ assignedToId: sp.get("assignedToId") });
  if (sp.get("type")) and.push({ type: sp.get("type") as never });
  if (sp.get("overdue") === "1") and.push({ isCompleted: false, dueDate: { lt: new Date() } });
  return prisma.task.findMany({
    where: { AND: and },
    include: { contact: { select: { id: true, name: true, phone: true } }, assignedTo: { select: { id: true, name: true } } },
    orderBy: { dueDate: "asc" },
    take: 1000,
  });
}, { module: "agenda" });

const schema = z.object({
  title: z.string().min(2).max(160),
  type: z.enum(["VISIT", "CALL", "FOLLOW_UP", "DOCUMENTATION"]),
  dueDate: z.string().transform((v) => new Date(v)),
  contactId: z.string().nullable().optional(),
  assignedToId: z.string().nullable().optional(),
  notes: z.string().max(5000).nullable().optional(),
});

export const POST = route(async ({ req, session }) => {
  const d = await body(req, schema);
  const task = await prisma.task.create({
    data: { ...d, workspaceId: session.workspace.id, assignedToId: seesOnlyOwn(session.user) ? session.user.id : d.assignedToId ?? session.user.id },
  });
  if (task.contactId) {
    await logActivity({ workspaceId: session.workspace.id, contactId: task.contactId, userId: session.user.id, type: "SYSTEM", title: `${TASK_TYPE_LABELS[task.type]} agendada: ${task.title} (${formatDate(task.dueDate, true)})` });
    // Agendar visita move o lead para "Visita agendada" se ele estiver antes dessa etapa
    if (task.type === "VISIT") {
      const c = await prisma.contact.findUnique({ where: { id: task.contactId }, include: { stage: true } });
      if (c?.pipelineId && c.stage) {
        const visit = await prisma.stage.findFirst({ where: { pipelineId: c.pipelineId, name: { contains: "Visita", mode: "insensitive" } } });
        if (visit && visit.order > c.stage.order) {
          await prisma.contact.update({ where: { id: c.id }, data: { stageId: visit.id, stageChangedAt: new Date() } });
          await logActivity({ workspaceId: session.workspace.id, contactId: c.id, userId: session.user.id, type: "STAGE_CHANGE", title: `Etapa alterada de ${c.stage.name} para ${visit.name}` });
        }
      }
    }
  }
  return task;
}, { module: "agenda" });
