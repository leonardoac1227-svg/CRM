import type { ActivityType, Prisma } from "@prisma/client";
import { prisma } from "../prisma";
import { emitUser } from "../realtime";

export async function logActivity(data: {
  workspaceId: string;
  contactId: string;
  userId?: string | null;
  type: ActivityType;
  title: string;
  body?: string | null;
  meta?: Prisma.InputJsonValue;
}) {
  return prisma.activity.create({
    data: {
      workspaceId: data.workspaceId,
      contactId: data.contactId,
      userId: data.userId ?? null,
      type: data.type,
      title: data.title,
      body: data.body ?? null,
      metaJson: data.meta ?? {},
    },
  });
}

export async function notify(data: { workspaceId: string; userId: string; title: string; body?: string; link?: string }) {
  const n = await prisma.notification.create({ data });
  emitUser(data.userId, "notification:new", { id: n.id, title: n.title });
  return n;
}

export async function notifyManagers(workspaceId: string, title: string, body?: string, link?: string) {
  const managers = await prisma.user.findMany({ where: { workspaceId, role: "MANAGER", isActive: true } });
  await Promise.all(managers.map((m) => notify({ workspaceId, userId: m.id, title, body, link })));
}
