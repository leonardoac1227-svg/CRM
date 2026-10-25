import type { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { body, route } from "@/lib/api";
import { HttpError } from "@/lib/auth";
import { conversationScope, seesOnlyOwn } from "@/lib/rbac";
import { normalizePhone } from "@/lib/utils";
import { defaultPipelineStage, sendOutboundText, sendTemplateMessage, windowOpen } from "@/lib/services/messaging";

export const GET = route(async ({ req, session }) => {
  const sp = req.nextUrl.searchParams;
  const and: Prisma.ConversationWhereInput[] = [conversationScope(session)];
  const tab = sp.get("tab");
  if (tab === "unread") and.push({ unreadCount: { gt: 0 } });
  if (tab === "reply") and.push({ status: { in: ["UNREAD", "NEEDS_REPLY"] }, aiActive: false });
  if (tab === "ai") and.push({ aiActive: true });
  if (sp.get("channelId")) and.push({ channelId: sp.get("channelId")! });
  if (sp.get("assignedToId")) and.push({ assignedToId: sp.get("assignedToId") === "none" ? null : sp.get("assignedToId") });
  if (sp.get("contactId")) and.push({ contactId: sp.get("contactId")! });
  if (sp.get("closed") !== "1" && tab !== "all-closed") and.push({ status: { not: "CLOSED" } });
  const q = sp.get("q")?.trim();
  if (q) {
    const digits = q.replace(/\D/g, "");
    and.push({
      OR: [
        { contact: { name: { contains: q, mode: "insensitive" } } },
        ...(digits.length >= 3 ? [{ contact: { phone: { contains: digits } } }] : []),
        { messages: { some: { content: { contains: q, mode: "insensitive" } } } },
      ],
    });
  }
  const base = conversationScope(session);
  const [items, counts] = await Promise.all([
    prisma.conversation.findMany({
      where: { AND: and },
      include: {
        contact: { select: { id: true, name: true, phone: true, origin: true, tags: true, stageId: true } },
        channel: { select: { id: true, name: true, phoneNumber: true, provider: true, accountType: true } },
        assignedTo: { select: { id: true, name: true } },
      },
      orderBy: { lastMessageAt: "desc" },
      take: 100,
    }),
    Promise.all([
      prisma.conversation.count({ where: { AND: [base, { status: { not: "CLOSED" } }] } }),
      prisma.conversation.count({ where: { AND: [base, { unreadCount: { gt: 0 } }] } }),
      prisma.conversation.count({ where: { AND: [base, { status: { in: ["UNREAD", "NEEDS_REPLY"] }, aiActive: false }] } }),
      prisma.conversation.count({ where: { AND: [base, { aiActive: true }] } }),
    ]),
  ]);
  return {
    items: items.map((c) => ({ ...c, windowOpen: windowOpen(c) })),
    counts: { all: counts[0], unread: counts[1], reply: counts[2], ai: counts[3] },
  };
}, { module: "atendimento" });

const schema = z.object({
  contactId: z.string().optional(),
  phone: z.string().optional(),
  name: z.string().optional(),
  channelId: z.string(),
  text: z.string().optional(),
  templateId: z.string().optional(),
  startAi: z.boolean().optional(),
});

/** Nova conversa: com contato existente ou novo número; envia texto livre (QR / janela aberta) ou modelo aprovado. */
export const POST = route(async ({ req, session }) => {
  const d = await body(req, schema);
  const channel = await prisma.whatsAppChannel.findFirst({ where: { id: d.channelId, workspaceId: session.workspace.id } });
  if (!channel) throw new HttpError(404, "Número não encontrado");
  if (seesOnlyOwn(session.user) && channel.accountType === "BROKER" && channel.userId !== session.user.id) throw new HttpError(403, "Use o seu número ou o da empresa");
  let contact = d.contactId ? await prisma.contact.findFirst({ where: { id: d.contactId, workspaceId: session.workspace.id } }) : null;
  if (!contact && d.phone) {
    const phone = normalizePhone(d.phone);
    contact = await prisma.contact.findUnique({ where: { workspaceId_phone: { workspaceId: session.workspace.id, phone } } });
    if (!contact) {
      const def = await defaultPipelineStage(session.workspace.id);
      contact = await prisma.contact.create({
        data: { workspaceId: session.workspace.id, phone, name: d.name || null, origin: "MANUAL", ...def, assignedToId: seesOnlyOwn(session.user) ? session.user.id : null },
      });
    }
  }
  if (!contact) throw new HttpError(422, "Informe um contato ou telefone");
  const conv = await prisma.conversation.upsert({
    where: { contactId_channelId: { contactId: contact.id, channelId: channel.id } },
    create: { workspaceId: session.workspace.id, contactId: contact.id, channelId: channel.id, assignedToId: contact.assignedToId ?? (seesOnlyOwn(session.user) ? session.user.id : null), status: "OPEN" },
    update: {},
  });
  if (d.templateId) await sendTemplateMessage({ conversationId: conv.id, templateId: d.templateId, user: session.user });
  else if (d.text) await sendOutboundText({ conversationId: conv.id, text: d.text, senderType: "USER", senderUser: session.user });
  return conv;
}, { module: "atendimento" });
