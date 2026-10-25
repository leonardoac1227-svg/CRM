import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { body, route } from "@/lib/api";
import { HttpError } from "@/lib/auth";
import { conversationScope } from "@/lib/rbac";
import { sendOutboundText } from "@/lib/services/messaging";

const schema = z.object({
  text: z.string().min(1).max(4096),
  mediaUrl: z.string().url().optional(),
  mediaType: z.enum(["TEXT", "AUDIO", "IMAGE", "DOCUMENT"]).optional(),
  takeOver: z.boolean().optional(),
});

export const POST = route<{ id: string }>(async ({ req, params, session }) => {
  const conv = await prisma.conversation.findFirst({ where: { ...conversationScope(session), id: params.id } });
  if (!conv) throw new HttpError(404, "Conversa não encontrada");
  const d = await body(req, schema);
  // Quando um humano responde, o Téo sai da conversa (evita respostas duplicadas)
  if (conv.aiActive && d.takeOver !== false) await prisma.conversation.update({ where: { id: conv.id }, data: { aiActive: false } });
  if (!conv.assignedToId && session.user.role === "BROKER") {
    await prisma.conversation.update({ where: { id: conv.id }, data: { assignedToId: session.user.id } });
    await prisma.contact.update({ where: { id: conv.contactId }, data: { assignedToId: session.user.id } });
  }
  return sendOutboundText({ conversationId: conv.id, text: d.text, senderType: "USER", senderUser: session.user, mediaUrl: d.mediaUrl, mediaType: d.mediaType });
}, { module: "atendimento" });
