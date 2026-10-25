import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { body, route } from "@/lib/api";

export const GET = route(async ({ session }) => {
  const [items, unread] = await Promise.all([
    prisma.notification.findMany({ where: { userId: session.user.id, workspaceId: session.workspace.id }, orderBy: { createdAt: "desc" }, take: 30 }),
    prisma.notification.count({ where: { userId: session.user.id, workspaceId: session.workspace.id, isRead: false } }),
  ]);
  return { items, unread };
});

export const POST = route(async ({ req, session }) => {
  const d = await body(req, z.object({ ids: z.array(z.string()).optional(), all: z.boolean().optional() }));
  await prisma.notification.updateMany({
    where: { userId: session.user.id, ...(d.all ? {} : { id: { in: d.ids ?? [] } }) },
    data: { isRead: true },
  });
  return { ok: true };
});
