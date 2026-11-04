import bcrypt from "bcryptjs";
import { z } from "zod";
import type { Session } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { body, route } from "@/lib/api";
import { HttpError } from "@/lib/auth";
import { normalizePhone } from "@/lib/utils";
import { tempPasswordGen } from "@/lib/passwords";
import { createWorkspace } from "@/lib/services/workspaces";

function requireAgency(s: Session) {
  if (s.user.role !== "AGENCY_ADMIN" && s.user.role !== "SUPER_ADMIN") throw new HttpError(403, "Apenas a agência gerencia clientes");
}

/** Empresas (clientes) da agência com um resumo de uso. */
export const GET = route(async ({ session }) => {
  requireAgency(session);
  const where = session.user.role === "AGENCY_ADMIN" ? { agencyId: session.agency.id } : {};
  const list = await prisma.workspace.findMany({
    where,
    include: {
      _count: { select: { users: true, contacts: true, conversations: true } },
      channels: { select: { status: true } },
      users: { where: { role: "MANAGER" }, select: { name: true, email: true }, take: 1, orderBy: { createdAt: "asc" } },
    },
    orderBy: { createdAt: "asc" },
  });
  return list.map(({ channels, users, ...w }) => ({
    ...w,
    manager: users[0] ?? null,
    channelsConnected: channels.filter((c) => c.status === "CONNECTED").length,
    channelsTotal: channels.length,
    current: w.id === session.workspace.id,
  }));
});

const schema = z.object({
  name: z.string().min(2, "Informe o nome da empresa"),
  niche: z.enum(["IMOBILIARIO", "SERVICOS", "CLINICA", "ECOMMERCE", "OUTROS"]).default("IMOBILIARIO"),
  city: z.string().optional(),
  state: z.string().max(2).optional(),
  siteUrl: z.string().optional(),
  managerName: z.string().min(2, "Informe o nome do responsável"),
  managerEmail: z.string().email("Informe um e-mail válido para o responsável"),
  managerPhone: z.string().optional(),
});

/** Cria a empresa, o funil padrão e o acesso do gestor (senha provisória mostrada uma vez). */
export const POST = route(async ({ req, session }) => {
  requireAgency(session);
  const d = await body(req, schema);
  const email = d.managerEmail.toLowerCase();
  if (await prisma.user.findUnique({ where: { email } })) throw new HttpError(409, "Já existe uma conta com o e-mail do responsável");
  const tempPassword = tempPasswordGen();
  const passwordHash = await bcrypt.hash(tempPassword, 10);
  const result = await prisma.$transaction(async (tx) => {
    const ws = await createWorkspace(tx, { agencyId: session.agency.id, name: d.name, niche: d.niche, city: d.city, state: d.state?.toUpperCase(), siteUrl: d.siteUrl });
    const manager = await tx.user.create({
      data: { workspaceId: ws.id, name: d.managerName, email, phone: d.managerPhone ? normalizePhone(d.managerPhone) : null, role: "MANAGER", passwordHash, mustChangePassword: true },
    });
    return { ws, manager };
  });
  return { workspace: result.ws, manager: { name: result.manager.name, email: result.manager.email }, tempPassword };
});
