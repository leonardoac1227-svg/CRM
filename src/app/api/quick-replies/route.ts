import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { body, route } from "@/lib/api";

export const GET = route(async ({ session }) => prisma.quickReply.findMany({ where: { workspaceId: session.workspace.id }, orderBy: { shortcut: "asc" } }));

export const POST = route(async ({ req, session }) => {
  const d = await body(req, z.object({ shortcut: z.string().min(2).max(30), content: z.string().min(1).max(2000) }));
  return prisma.quickReply.create({ data: { workspaceId: session.workspace.id, shortcut: d.shortcut.startsWith("/") ? d.shortcut : `/${d.shortcut}`, content: d.content } });
}, { module: "atendimento" });

export const DELETE = route(async ({ req, session }) => {
  const id = req.nextUrl.searchParams.get("id") ?? "";
  await prisma.quickReply.deleteMany({ where: { id, workspaceId: session.workspace.id } });
  return { ok: true };
}, { module: "atendimento" });
