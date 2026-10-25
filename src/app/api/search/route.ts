import { prisma } from "@/lib/prisma";
import { route } from "@/lib/api";
import { canAccessModule, contactScope, conversationScope } from "@/lib/rbac";

/** Busca global (Ctrl+K): contatos, conversas, imóveis e modelos. */
export const GET = route(async ({ req, session }) => {
  const q = req.nextUrl.searchParams.get("q")?.trim() ?? "";
  if (q.length < 2) return { contacts: [], conversations: [], catalog: [], templates: [] };
  const digits = q.replace(/\D/g, "");
  const [contacts, conversations, catalog, templates] = await Promise.all([
    prisma.contact.findMany({
      where: { ...contactScope(session), OR: [{ name: { contains: q, mode: "insensitive" } }, { email: { contains: q, mode: "insensitive" } }, { trackingCode: { contains: q, mode: "insensitive" } }, ...(digits.length >= 3 ? [{ phone: { contains: digits } }] : [])] },
      select: { id: true, name: true, phone: true, stage: { select: { name: true } } },
      take: 6,
    }),
    prisma.conversation.findMany({
      where: { ...conversationScope(session), messages: { some: { content: { contains: q, mode: "insensitive" } } } },
      select: { id: true, lastMessagePreview: true, contact: { select: { name: true, phone: true } } },
      take: 5,
    }),
    canAccessModule(session.user, "imoveis")
      ? prisma.catalogItem.findMany({ where: { workspaceId: session.workspace.id, OR: [{ title: { contains: q, mode: "insensitive" } }, { code: { contains: q, mode: "insensitive" } }] }, select: { id: true, title: true, code: true }, take: 5 })
      : [],
    canAccessModule(session.user, "campanhas")
      ? prisma.messageTemplate.findMany({ where: { workspaceId: session.workspace.id, name: { contains: q, mode: "insensitive" } }, select: { id: true, name: true }, take: 4 })
      : [],
  ]);
  return { contacts, conversations, catalog, templates };
});
