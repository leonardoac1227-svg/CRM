import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { body, route } from "@/lib/api";
import { publicUser } from "@/lib/auth";
import { requireManager } from "@/lib/rbac";
import { normalizePhone } from "@/lib/utils";

export const GET = route(async ({ session }) => {
  const users = await prisma.user.findMany({
    where: { workspaceId: session.workspace.id },
    include: { _count: { select: { assignedContacts: true } }, channels: { select: { id: true, phoneNumber: true, status: true } } },
    orderBy: [{ role: "asc" }, { name: "asc" }],
  });
  return users.map((u) => ({ ...publicUser(u), leadsCount: u._count.assignedContacts, channels: u.channels }));
});

const schema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  phone: z.string().optional().nullable(),
  role: z.enum(["MANAGER", "ASSISTANT", "BROKER"]),
  password: z.string().min(6).optional(),
  inRoulette: z.boolean().optional(),
  permissions: z.record(z.boolean()).optional(),
});

/** Convida um membro (senha provisória retornada uma única vez). */
export const POST = route(async ({ req, session }) => {
  requireManager(session);
  const data = await body(req, schema);
  const tempPassword = data.password ?? Math.random().toString(36).slice(2, 10);
  const user = await prisma.user.create({
    data: {
      workspaceId: session.workspace.id,
      name: data.name,
      email: data.email.toLowerCase(),
      phone: data.phone ? normalizePhone(data.phone) : null,
      role: data.role,
      passwordHash: await bcrypt.hash(tempPassword, 10),
      inRoulette: data.role === "BROKER" ? data.inRoulette ?? true : false,
      permissions: data.permissions ?? {},
    },
  });
  await prisma.workspace.update({ where: { id: session.workspace.id }, data: { onboardingProgress: { ...((session.workspace.onboardingProgress ?? {}) as object), team: true } } });
  return { user: publicUser(user), tempPassword };
}, { module: "equipe" });
