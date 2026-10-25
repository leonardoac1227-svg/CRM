import { prisma } from "@/lib/prisma";
import { route } from "@/lib/api";
import { pickRouletteUser } from "@/lib/services/distribution";

/** Histórico dos últimos leads distribuídos + próximo da fila. */
export const GET = route(async ({ session }) => {
  const [history, next] = await Promise.all([
    prisma.activity.findMany({
      where: { workspaceId: session.workspace.id, type: "ASSIGNMENT" },
      include: { user: { select: { id: true, name: true } }, contact: { select: { id: true, name: true, phone: true, origin: true } } },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
    pickRouletteUser(session.workspace.id),
  ]);
  return { history, next: next ? { id: next.id, name: next.name } : null };
}, { module: "equipe" });
