import { z } from "zod";
import { body, route } from "@/lib/api";
import { logActivity } from "@/lib/services/activity";
import { prisma } from "@/lib/prisma";
import { findContact } from "@/lib/services/contacts";

const schema = z.object({
  type: z.enum(["NOTE", "INTERACTION"]),
  title: z.string().min(1).max(120).optional(),
  body: z.string().min(1).max(5000),
  channel: z.string().optional(),
});

export const POST = route<{ id: string }>(async ({ req, params, session }) => {
  const c = await findContact(session, params.id);
  const d = await body(req, schema);
  const a = await logActivity({
    workspaceId: session.workspace.id,
    contactId: c.id,
    userId: session.user.id,
    type: d.type,
    title: d.title ?? (d.type === "NOTE" ? "Anotação" : `Interação registrada${d.channel ? ` (${d.channel})` : ""}`),
    body: d.body,
  });
  if (d.type === "INTERACTION") await prisma.contact.update({ where: { id: c.id }, data: { lastInteractionAt: new Date() } });
  return a;
}, { module: "contatos" });
