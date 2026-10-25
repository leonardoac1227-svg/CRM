import { prisma } from "@/lib/prisma";
import { route } from "@/lib/api";
import { conversationScope } from "@/lib/rbac";

export const POST = route<{ id: string }>(async ({ params, session }) => {
  const conv = await prisma.conversation.findFirst({ where: { ...conversationScope(session), id: params.id } });
  if (!conv) return { ok: false };
  await prisma.conversation.update({
    where: { id: conv.id },
    data: { unreadCount: 0, ...(conv.status === "UNREAD" ? { status: "NEEDS_REPLY" } : {}) },
  });
  await prisma.message.updateMany({ where: { conversationId: conv.id, senderType: "CONTACT", status: "DELIVERED" }, data: { status: "READ" } });
  return { ok: true };
}, { module: "atendimento" });
