import { prisma } from "@/lib/prisma";
import { route } from "@/lib/api";
import { contactScope, conversationScope } from "@/lib/rbac";
import { toNumber } from "@/lib/utils";

/** Relatórios gerais: KPIs, leads por dia/origem, performance da IA e campanhas. */
export const GET = route(async ({ req, session }) => {
  const days = Number(req.nextUrl.searchParams.get("days") || 30);
  const since = new Date(Date.now() - days * 86400000);
  const scope = contactScope(session);
  const wid = session.workspace.id;
  const [newLeads, won, lost, byOrigin, contacts, aiQualified, aiConvs, msgByType, campaigns, firstResponse] = await Promise.all([
    prisma.contact.count({ where: { ...scope, createdAt: { gte: since } } }),
    prisma.contact.aggregate({ where: { ...scope, status: "WON", updatedAt: { gte: since } }, _count: { _all: true }, _sum: { dealValue: true } }),
    prisma.contact.count({ where: { ...scope, status: "LOST", updatedAt: { gte: since } } }),
    prisma.contact.groupBy({ by: ["origin"], where: { ...scope, createdAt: { gte: since } }, _count: { _all: true } }),
    prisma.contact.findMany({ where: { ...scope, createdAt: { gte: since } }, select: { createdAt: true, origin: true } }),
    prisma.contact.count({ where: { ...scope, aiQualifiedAt: { gte: since } } }),
    prisma.conversation.count({ where: { ...conversationScope(session), createdAt: { gte: since } } }),
    prisma.message.groupBy({ by: ["senderType"], where: { conversation: { workspaceId: wid }, createdAt: { gte: since } }, _count: { _all: true } }),
    prisma.campaign.findMany({ where: { workspaceId: wid, createdAt: { gte: since } }, select: { id: true, name: true, status: true, totalRecipients: true, sentCount: true, repliedCount: true, estimatedCost: true } }),
    prisma.$queryRaw<{ avg_minutes: number | null }[]>`
      SELECT AVG(EXTRACT(EPOCH FROM (r."createdAt" - c."createdAt")) / 60)::float AS avg_minutes
      FROM "Message" c
      JOIN LATERAL (
        SELECT m."createdAt" FROM "Message" m
        WHERE m."conversationId" = c."conversationId" AND m."senderType" IN ('USER','AI_AGENT') AND m."createdAt" > c."createdAt"
        ORDER BY m."createdAt" ASC LIMIT 1
      ) r ON true
      JOIN "Conversation" cv ON cv.id = c."conversationId"
      WHERE c."senderType" = 'CONTACT' AND cv."workspaceId" = ${wid} AND c."createdAt" >= ${since}`,
  ]);
  const daily = Array.from({ length: days }, (_, i) => {
    const d = new Date(since.getTime() + (i + 1) * 86400000);
    const key = d.toISOString().slice(0, 10);
    return { day: key, leads: contacts.filter((c) => c.createdAt.toISOString().slice(0, 10) === key).length, seo: contacts.filter((c) => c.origin === "SEO_ORGANICO" && c.createdAt.toISOString().slice(0, 10) === key).length };
  });
  return {
    days,
    kpis: {
      newLeads,
      won: won._count._all,
      wonValue: toNumber(won._sum.dealValue),
      lost,
      conversations: aiConvs,
      aiQualified,
      aiQualificationRate: newLeads ? (aiQualified / newLeads) * 100 : 0,
      avgFirstResponseMinutes: firstResponse[0]?.avg_minutes ?? null,
    },
    byOrigin: byOrigin.map((o) => ({ origin: o.origin, leads: o._count._all })).sort((a, b) => b.leads - a.leads),
    daily,
    messages: msgByType.map((m) => ({ senderType: m.senderType, count: m._count._all })),
    campaigns,
  };
}, { module: "relatorios" });
