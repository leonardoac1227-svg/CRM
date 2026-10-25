import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { body, route } from "@/lib/api";
import { HttpError } from "@/lib/auth";
import { requireManager } from "@/lib/rbac";

export const PATCH = route<{ id: string }>(async ({ req, params, session }) => {
  requireManager(session);
  const i = await prisma.integration.findFirst({ where: { id: params.id, workspaceId: session.workspace.id } });
  if (!i) throw new HttpError(404, "Integração não encontrada");
  const d = await body(req, z.object({ isEnabled: z.boolean().optional(), name: z.string().optional(), config: z.record(z.unknown()).optional() }));
  return prisma.integration.update({ where: { id: i.id }, data: { isEnabled: d.isEnabled, name: d.name, ...(d.config ? { configJson: { ...(i.configJson as object), ...d.config } as object } : {}) } });
}, { module: "integracoes" });

export const DELETE = route<{ id: string }>(async ({ params, session }) => {
  requireManager(session);
  await prisma.integration.deleteMany({ where: { id: params.id, workspaceId: session.workspace.id } });
  return { ok: true };
}, { module: "integracoes" });
