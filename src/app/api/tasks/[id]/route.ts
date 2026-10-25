import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { body, route } from "@/lib/api";
import { HttpError } from "@/lib/auth";
import { taskScope } from "@/lib/rbac";

const schema = z.object({
  title: z.string().min(2).max(160).optional(),
  type: z.enum(["VISIT", "CALL", "FOLLOW_UP", "DOCUMENTATION"]).optional(),
  dueDate: z.string().transform((v) => new Date(v)).optional(),
  isCompleted: z.boolean().optional(),
  assignedToId: z.string().nullable().optional(),
  notes: z.string().max(5000).nullable().optional(),
});

export const PATCH = route<{ id: string }>(async ({ req, params, session }) => {
  const t = await prisma.task.findFirst({ where: { ...taskScope(session), id: params.id } });
  if (!t) throw new HttpError(404, "Tarefa não encontrada");
  const d = await body(req, schema);
  return prisma.task.update({
    where: { id: t.id },
    data: { ...d, ...(d.isCompleted !== undefined ? { completedAt: d.isCompleted ? new Date() : null } : {}) },
  });
}, { module: "agenda" });

export const DELETE = route<{ id: string }>(async ({ params, session }) => {
  const t = await prisma.task.findFirst({ where: { ...taskScope(session), id: params.id } });
  if (!t) throw new HttpError(404, "Tarefa não encontrada");
  await prisma.task.delete({ where: { id: t.id } });
  return { ok: true };
}, { module: "agenda" });
