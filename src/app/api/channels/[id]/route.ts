import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { body, route } from "@/lib/api";
import { HttpError } from "@/lib/auth";
import { isManagerLike, requireManager } from "@/lib/rbac";
import { evolutionLogout } from "@/lib/whatsapp/evolution";
import { safeChannel } from "@/lib/whatsapp/safe";

const schema = z.object({
  name: z.string().min(2).optional(),
  userId: z.string().nullable().optional(),
  metaWabaId: z.string().trim().optional(),
  metaPhoneNumberId: z.string().trim().optional(),
  metaAccessToken: z.string().trim().optional(),
  metaAppSecret: z.string().trim().optional(),
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
  // campos de credencial em branco não apagam o valor salvo
  const data = Object.fromEntries(Object.entries(d).filter(([, v]) => v !== "" && v !== undefined));
  const ch = await prisma.whatsAppChannel.update({ where: { id: params.id }, data });
  return safeChannel(ch);
}, { module: "integracoes" });

export const DELETE = route<{ id: string }>(async ({ params, session }) => {
  const ch = await own(params.id, session.workspace.id);
  if (!isManagerLike(session.user) && ch.userId !== session.user.id) throw new HttpError(403, "Você só pode remover o seu número");
  if (ch.provider === "EVOLUTION_QR" && ch.evolutionInstance) await evolutionLogout(ch).catch(() => undefined);
  await prisma.whatsAppChannel.delete({ where: { id: params.id } });
  return { ok: true };
}, { module: "integracoes" });
