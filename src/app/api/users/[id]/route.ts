import bcrypt from "bcryptjs";
import { z } from "zod";
import { tempPasswordGen } from "@/lib/passwords";
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
  /** gera uma nova senha provisória (mostrada uma única vez) */
  resetPassword: z.boolean().optional(),
});

export const PATCH = route<{ id: string }>(async ({ req, params, session }) => {
  requireManager(session);
  const data = await body(req, schema);
  const target = await prisma.user.findFirst({ where: { id: params.id, workspaceId: session.workspace.id } });
  if (!target) throw new HttpError(404, "Usuário não encontrado");
  if (target.id === session.user.id && (data.role || data.isActive === false)) throw new HttpError(400, "Você não pode alterar o próprio perfil de acesso");
  const { resetPassword, ...rest } = data;
  const tempPassword = resetPassword ? tempPasswordGen() : null;
  const user = await prisma.user.update({
    where: { id: target.id },
    data: {
      ...rest,
      phone: rest.phone === undefined ? undefined : rest.phone ? normalizePhone(rest.phone) : null,
      ...(tempPassword ? { passwordHash: await bcrypt.hash(tempPassword, 10), mustChangePassword: true } : {}),
    },
  });
  return { ...publicUser(user), tempPassword };
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
