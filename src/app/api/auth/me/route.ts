import bcrypt from "bcryptjs";
import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { body, route } from "@/lib/api";
import { HttpError, publicUser } from "@/lib/auth";
import { normalizePhone } from "@/lib/utils";
import { allowedModules, seesOnlyOwn } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";

export const GET = route(async ({ session }) => {
  const workspaces =
    session.user.role === "AGENCY_ADMIN" || session.user.role === "SUPER_ADMIN"
      ? await prisma.workspace.findMany({
          where: session.user.role === "AGENCY_ADMIN" ? { agencyId: session.user.agencyId ?? "" } : {},
          select: { id: true, name: true, niche: true },
          orderBy: { createdAt: "asc" },
        })
      : [];
  const ai = await prisma.aiAssistantConfig.findUnique({ where: { workspaceId: session.workspace.id }, select: { assistantName: true } });
  return {
    user: publicUser(session.user),
    workspace: session.workspace,
    agency: session.agency,
    modules: allowedModules(session.user),
    seesOnlyOwn: seesOnlyOwn(session.user),
    assistantName: ai?.assistantName ?? session.agency.assistantDefaultName,
    workspaces,
    mustChangePassword: session.user.mustChangePassword,
  };
});

const patchSchema = z.object({
  name: z.string().min(2).optional(),
  phone: z.string().nullable().optional(),
  currentPassword: z.string().optional(),
  newPassword: z.string().min(8, "A nova senha precisa ter pelo menos 8 caracteres").optional(),
});

/** Minha conta: nome, telefone e troca de senha (obrigatória no primeiro acesso com senha provisória). */
export const PATCH = route(async ({ req, session }) => {
  const d = await body(req, patchSchema);
  const data: Prisma.UserUpdateInput = {};
  if (d.name) data.name = d.name;
  if (d.phone !== undefined) data.phone = d.phone ? normalizePhone(d.phone) : null;
  if (d.newPassword) {
    // no primeiro acesso a senha provisória já foi digitada no login
    if (!session.user.mustChangePassword) {
      if (!d.currentPassword || !(await bcrypt.compare(d.currentPassword, session.user.passwordHash))) throw new HttpError(400, "A senha atual está incorreta");
    }
    data.passwordHash = await bcrypt.hash(d.newPassword, 10);
    data.mustChangePassword = false;
  }
  const user = await prisma.user.update({ where: { id: session.user.id }, data });
  return { user: publicUser(user) };
});
