import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { body, route } from "@/lib/api";
import { HttpError } from "@/lib/auth";
import { conversationScope } from "@/lib/rbac";
import { sendTemplateMessage } from "@/lib/services/messaging";

/** "Enviar Modelo Aprovado (Meta)" — reabre a janela de 24h. */
export const POST = route<{ id: string }>(async ({ req, params, session }) => {
  const conv = await prisma.conversation.findFirst({ where: { ...conversationScope(session), id: params.id } });
  if (!conv) throw new HttpError(404, "Conversa não encontrada");
  const { templateId } = await body(req, z.object({ templateId: z.string() }));
  return sendTemplateMessage({ conversationId: conv.id, templateId, user: session.user });
}, { module: "atendimento" });
