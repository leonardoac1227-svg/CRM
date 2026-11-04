import { prisma } from "@/lib/prisma";
import { route } from "@/lib/api";
import { HttpError } from "@/lib/auth";
import { submitTemplateToMeta } from "@/lib/whatsapp/meta";
import { WhatsAppError } from "@/lib/whatsapp/types";

/** "Enviar para aprovação": envia o modelo à Meta. A aprovação costuma levar de minutos a 24h. */
export const POST = route<{ id: string }>(async ({ params, session }) => {
  const t = await prisma.messageTemplate.findFirst({ where: { id: params.id, workspaceId: session.workspace.id }, include: { channel: true } });
  if (!t) throw new HttpError(404, "Modelo não encontrado");
  try {
    const r = await submitTemplateToMeta(t.channel, t);
    return prisma.messageTemplate.update({ where: { id: t.id }, data: { metaStatus: r.status, metaTemplateId: r.id, rejectionReason: null } });
  } catch (e) {
    if (e instanceof WhatsAppError && e.details) {
      // a Meta analisou e recusou
      await prisma.messageTemplate.update({ where: { id: t.id }, data: { metaStatus: "REJECTED", rejectionReason: e.message } });
      throw new HttpError(400, `A Meta recusou o modelo: ${e.message}`);
    }
    // erro de configuração (número sem token etc.): não marca como rejeitado
    throw new HttpError(400, (e as Error).message);
  }
}, { module: "campanhas" });
