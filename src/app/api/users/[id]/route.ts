import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { body, route } from "@/lib/api";
import { HttpError, publicUser } from "@/lib/auth";
import { requireManager } from "@/lib/rbac";
import { normalizePhone } from "@/lib/utils";

const schema = z.object({
  name: z.string().min(2).optional(),
  phone: z.string().nullable().optional(),
  role: z.enum(["MANAGER", "ASSISTANT", "BROKER"]).optional(),
  inRoulette: z.boolean().optional(),
  rouletteWeight: z.number().int().min(1).max(10).optional(),
  isActive: z.boolean().optional(),
  permissions: z.record(z.boolean()).optional(),
});

export const PATCH = route<{ id: string }>(async ({ req, params, session }) => {
  requireManager(session);
  const data = await body(req, schema);
  const target = await prisma.user.findFirst({ where: { id: params.id, workspaceId: session.workspace.id } });
  if (!target) throw new HttpError(404, "Usuário não encontrado");
  if (target.id === session.user.id && (data.role || data.isActive === false)) throw new HttpError(400, "Você não pode alterar o próprio perfil de acesso");
  const user = await prisma.user.update({
    where: { id: target.id },
    data: { ...data, phone: data.phone === undefined ? undefined : data.phone ? normalizePhone(data.phone) : null },
  });
  return publicUser(user);
}, { module: "equipe" });

export const DELETE = route<{ id: string }>(async ({ params, session }) => {
  requireManager(session);
  if (params.id === session.user.id) throw new HttpError(400, "Você não pode remover a si mesmo");
  const target = await prisma.user.findFirst({ where: { id: params.id, workspaceId: session.workspace.id } });
  if (!target) throw new HttpError(404, "Usuário não encontrado");
  // desativa (mantém histórico) e libera os leads
  await prisma.contact.updateMany({ where: { assignedToId: target.id }, data: { assignedToId: null } });
  await prisma.user.update({ where: { id: target.id }, data: { isActive: false, inRoulette: false } });
  return { ok: true };
}, { module: "equipe" });
