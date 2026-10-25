import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { body, route } from "@/lib/api";
import { HttpError } from "@/lib/auth";
import { requireManager } from "@/lib/rbac";

const schema = z.object({
  name: z.string().min(2).optional(),
  userId: z.string().nullable().optional(),
  status: z.enum(["CONNECTED", "ATTENTION", "DISCONNECTED"]).optional(),
  metaWabaId: z.string().optional(),
  metaPhoneNumberId: z.string().optional(),
  metaAccessToken: z.string().optional(),
});

async function own(id: string, workspaceId: string) {
  const ch = await prisma.whatsAppChannel.findFirst({ where: { id, workspaceId } });
  if (!ch) throw new HttpError(404, "Número não encontrado");
  return ch;
}

export const PATCH = route<{ id: string }>(async ({ req, params, session }) => {
  requireManager(session);
  await own(params.id, session.workspace.id);
  const d = await body(req, schema);
  const ch = await prisma.whatsAppChannel.update({ where: { id: params.id }, data: d });
  return { ...ch, metaAccessToken: undefined, evolutionApiKey: undefined };
}, { module: "integracoes" });

export const DELETE = route<{ id: string }>(async ({ params, session }) => {
  requireManager(session);
  await own(params.id, session.workspace.id);
  await prisma.whatsAppChannel.delete({ where: { id: params.id } });
  return { ok: true };
}, { module: "integracoes" });
