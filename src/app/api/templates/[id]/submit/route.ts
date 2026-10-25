import { prisma } from "@/lib/prisma";
import { route } from "@/lib/api";
import { HttpError } from "@/lib/auth";
import { submitTemplateToMeta } from "@/lib/whatsapp/meta";
import { WhatsAppError } from "@/lib/whatsapp/types";

/** "Enviar para aprovação": envia à WABA (ou simula a aprovação em canais de demonstração). */
export const POST = route<{ id: string }>(async ({ params, session }) => {
  const t = await prisma.messageTemplate.findFirst({ where: { id: params.id, workspaceId: session.workspace.id }, include: { channel: true } });
  if (!t) throw new HttpError(404, "Modelo não encontrado");
  try {
    const r = await submitTemplateToMeta(t.channel, t);
    return prisma.messageTemplate.update({ where: { id: t.id }, data: { metaStatus: r.status, metaTemplateId: r.id, rejectionReason: null } });
  } catch (e) {
    if (e instanceof WhatsAppError) {
      await prisma.messageTemplate.update({ where: { id: t.id }, data: { metaStatus: "REJECTED", rejectionReason: e.message } });
      throw new HttpError(400, `Meta recusou o modelo: ${e.message}`);
    }
    throw e;
  }
}, { module: "campanhas" });
