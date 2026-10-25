import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { body, route } from "@/lib/api";
import { HttpError, type Session } from "@/lib/auth";
import { conversationScope, isManagerLike } from "@/lib/rbac";
import { windowOpen } from "@/lib/services/messaging";
import { runAiTurn, completeQualification } from "@/lib/services/ai-runner";
import { assignContact } from "@/lib/services/distribution";
import { logActivity } from "@/lib/services/activity";
import { emitWorkspace } from "@/lib/realtime";

async function own(session: Session, id: string) {
  const c = await prisma.conversation.findFirst({ where: { ...conversationScope(session), id } });
  if (!c) throw new HttpError(404, "Conversa não encontrada");
  return c;
}

export const GET = route<{ id: string }>(async ({ params, session }) => {
  await own(session, params.id);
  const conv = await prisma.conversation.findUniqueOrThrow({
    where: { id: params.id },
    include: {
      contact: { include: { stage: true, pipeline: { include: { stages: { orderBy: { order: "asc" } } } }, assignedTo: { select: { id: true, name: true } } } },
      channel: { select: { id: true, name: true, phoneNumber: true, provider: true, accountType: true, status: true } },
      assignedTo: { select: { id: true, name: true } },
      messages: { orderBy: { createdAt: "asc" }, take: 500 },
    },
  });
  return { ...conv, windowOpen: windowOpen(conv) };
}, { module: "atendimento" });

const schema = z.object({
  status: z.enum(["UNREAD", "NEEDS_REPLY", "WITH_AI", "OPEN", "CLOSED"]).optional(),
  aiActive: z.boolean().optional(),
  assignedToId: z.string().nullable().optional(),
  finishAi: z.boolean().optional(),
});

export const PATCH = route<{ id: string }>(async ({ req, params, session }) => {
  const conv = await own(session, params.id);
  const d = await body(req, schema);
  if (d.assignedToId !== undefined && d.assignedToId !== conv.assignedToId) {
    if (!isManagerLike(session.user) && session.user.role !== "ASSISTANT") throw new HttpError(403, "Somente gestores podem transferir conversas");
    await assignContact({ workspaceId: session.workspace.id, contactId: conv.contactId, userId: d.assignedToId, byUserId: session.user.id, via: "MANUAL" });
  }
  if (d.finishAi) {
    await completeQualification(conv.id, "REQUESTED");
    return { ok: true };
  }
  if (d.aiActive !== undefined && d.aiActive !== conv.aiActive) {
    // "✨ Qualificar com IA": liga/desliga o Téo nesta conversa em tempo real
    const state = (conv.aiState ?? {}) as { step?: string | null };
    const restart = d.aiActive && (state.step === "DONE" || state.step === "HANDOFF");
    await prisma.conversation.update({
      where: { id: conv.id },
      data: {
        aiActive: d.aiActive,
        status: d.aiActive ? "WITH_AI" : "OPEN",
        ...(restart ? { aiState: { ...(conv.aiState as object), step: null, currentQuestionId: null } } : {}),
      },
    });
    await prisma.contact.update({ where: { id: conv.contactId }, data: { aiQualificationEnabled: d.aiActive } });
    await logActivity({ workspaceId: session.workspace.id, contactId: conv.contactId, userId: session.user.id, type: "SYSTEM", title: d.aiActive ? `${session.user.name} ativou a qualificação com IA` : `${session.user.name} assumiu a conversa (IA desligada)` });
    if (d.aiActive) {
      const fresh = await prisma.conversation.findUniqueOrThrow({ where: { id: conv.id }, include: { channel: true, messages: { orderBy: { createdAt: "desc" }, take: 1 } } });
      const st = (fresh.aiState ?? {}) as { step?: string | null };
      // Inicia a abordagem se a janela permitir (ou número QR)
      if (!st.step && (fresh.channel?.provider !== "META_OFFICIAL" || windowOpen(fresh))) {
        const last = fresh.messages[0];
        await runAiTurn(conv.id, last?.senderType === "CONTACT" ? last.content : null).catch((e) => console.error("[ai]", e));
      }
    }
  }
  if (d.status) await prisma.conversation.update({ where: { id: conv.id }, data: { status: d.status, ...(d.status === "CLOSED" ? { aiActive: false, unreadCount: 0 } : {}) } });
  emitWorkspace(session.workspace.id, "conversation:updated", { conversationId: conv.id });
  return { ok: true };
}, { module: "atendimento" });
