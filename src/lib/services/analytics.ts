// Métricas de funil, matriz usuário x etapa, ranking de corretores e ROI de SEO.
import type { Prisma } from "@prisma/client";
import { prisma } from "../prisma";
import { toNumber } from "../utils";

export type AnalyticsFilters = {
  from?: Date | null;
  to?: Date | null;
  status?: string | null;
  userId?: string | null;
  origin?: string | null;
};

export function analyticsWhere(workspaceId: string, pipelineId: string, f: AnalyticsFilters, scope?: Prisma.ContactWhereInput): Prisma.ContactWhereInput {
  const and: Prisma.ContactWhereInput[] = [{ workspaceId, pipelineId }];
  if (scope) and.push(scope);
  if (f.from || f.to) and.push({ createdAt: { ...(f.from ? { gte: f.from } : {}), ...(f.to ? { lte: f.to } : {}) } });
  if (f.status) and.push({ status: f.status as never });
  if (f.userId) and.push(f.userId === "none" ? { assignedToId: null } : { assignedToId: f.userId });
  if (f.origin) and.push({ origin: f.origin as never });
  return { AND: and };
}

export async function pipelineAnalytics(workspaceId: string, pipelineId: string, f: AnalyticsFilters, scope?: Prisma.ContactWhereInput) {
  const pipeline = await prisma.pipeline.findFirstOrThrow({ where: { id: pipelineId, workspaceId }, include: { stages: { orderBy: { order: "asc" } } } });
  const where = analyticsWhere(workspaceId, pipelineId, f, scope);
  const [byStage, byUserStage, users, activities] = await Promise.all([
    prisma.contact.groupBy({ by: ["stageId"], where, _count: { _all: true }, _sum: { dealValue: true } }),
    prisma.contact.groupBy({ by: ["assignedToId", "stageId"], where, _count: { _all: true } }),
    prisma.user.findMany({ where: { workspaceId, role: { in: ["BROKER", "MANAGER", "ASSISTANT"] }, isActive: true }, orderBy: { name: "asc" } }),
    prisma.contact.findMany({ where, select: { assignedToId: true, stageId: true, status: true, dealValue: true } }),
  ]);
  const total = byStage.reduce((a, s) => a + s._count._all, 0);
  const stages = pipeline.stages.map((s) => {
    const row = byStage.find((b) => b.stageId === s.id);
    const count = row?._count._all ?? 0;
    return { id: s.id, name: s.name, color: s.color, order: s.order, isWonStage: s.isWonStage, count, value: toNumber(row?._sum.dealValue), percent: total ? (count / total) * 100 : 0 };
  });

  const userRows = [...users.map((u) => ({ id: u.id as string | null, name: u.name })), { id: null, name: "Sem responsável" }];
  const matrix = userRows
    .map((u) => {
      const cells = pipeline.stages.map((s) => byUserStage.find((b) => b.assignedToId === u.id && b.stageId === s.id)?._count._all ?? 0);
      return { userId: u.id, name: u.name, cells, total: cells.reduce((a, b) => a + b, 0) };
    })
    .filter((r) => r.total > 0 || r.userId !== null);
  const totalsRow = { userId: "total", name: "Total", cells: pipeline.stages.map((s) => stages.find((x) => x.id === s.id)?.count ?? 0), total };
  const maxCell = Math.max(1, ...matrix.flatMap((r) => r.cells));

  // Ranking: etapas a partir de "Visita"/"Proposta" contam como conquistas acumuladas
  const orderOf = new Map(pipeline.stages.map((s) => [s.id, s.order]));
  const visitOrder = pipeline.stages.find((s) => /visita/i.test(s.name))?.order ?? 2;
  const proposalOrder = pipeline.stages.find((s) => /proposta/i.test(s.name))?.order ?? 3;
  const wonIds = new Set(pipeline.stages.filter((s) => s.isWonStage).map((s) => s.id));
  const ranking = users
    .map((u) => {
      const mine = activities.filter((a) => a.assignedToId === u.id);
      const ord = (a: (typeof mine)[number]) => (a.stageId ? orderOf.get(a.stageId) ?? 0 : 0);
      const won = mine.filter((a) => a.status === "WON" || (a.stageId && wonIds.has(a.stageId)));
      return {
        userId: u.id,
        name: u.name,
        received: mine.length,
        visits: mine.filter((a) => ord(a) >= visitOrder).length,
        proposals: mine.filter((a) => ord(a) >= proposalOrder).length,
        won: won.length,
        value: won.reduce((acc, a) => acc + toNumber(a.dealValue), 0),
        conversion: mine.length ? (won.length / mine.length) * 100 : 0,
      };
    })
    .filter((r) => r.received > 0)
    .sort((a, b) => b.won - a.won || b.value - a.value || b.conversion - a.conversion)
    .map((r, i) => ({ ...r, position: i + 1 }));

  return { pipeline: { id: pipeline.id, name: pipeline.name }, total, stages, matrix: [...matrix, totalsRow], maxCell, ranking };
}

export async function seoDashboard(workspaceId: string, days = 90) {
  const since = new Date(Date.now() - days * 86400000);
  const [seoLeads, allLeads, sessions, qualified, wonSeo, byPage, byKeyword, byOrigin] = await Promise.all([
    prisma.contact.count({ where: { workspaceId, origin: "SEO_ORGANICO", createdAt: { gte: since } } }),
    prisma.contact.count({ where: { workspaceId, createdAt: { gte: since } } }),
    prisma.trackingSession.count({ where: { workspaceId, createdAt: { gte: since } } }),
    prisma.contact.count({ where: { workspaceId, origin: "SEO_ORGANICO", aiQualifiedAt: { not: null }, createdAt: { gte: since } } }),
    prisma.contact.aggregate({ where: { workspaceId, origin: "SEO_ORGANICO", status: "WON" }, _sum: { dealValue: true }, _count: { _all: true } }),
    prisma.contact.groupBy({ by: ["seoLandingPage"], where: { workspaceId, origin: "SEO_ORGANICO", seoLandingPage: { not: null }, createdAt: { gte: since } }, _count: { _all: true }, orderBy: { _count: { seoLandingPage: "desc" } }, take: 10 }),
    prisma.contact.groupBy({ by: ["seoKeyword"], where: { workspaceId, seoKeyword: { not: null }, createdAt: { gte: since } }, _count: { _all: true }, orderBy: { _count: { seoKeyword: "desc" } }, take: 8 }),
    prisma.contact.groupBy({ by: ["origin"], where: { workspaceId, createdAt: { gte: since } }, _count: { _all: true } }),
  ]);
  const pageConversations = await Promise.all(
    byPage.map(async (p) => {
      const [conversations, won] = await Promise.all([
        prisma.conversation.count({ where: { workspaceId, contact: { seoLandingPage: p.seoLandingPage } } }),
        prisma.contact.aggregate({ where: { workspaceId, seoLandingPage: p.seoLandingPage, status: "WON" }, _sum: { dealValue: true } }),
      ]);
      return { page: p.seoLandingPage!, leads: p._count._all, conversations, wonValue: toNumber(won._sum.dealValue) };
    }),
  );
  // série semanal de leads SEO
  const seoContacts = await prisma.contact.findMany({ where: { workspaceId, origin: "SEO_ORGANICO", createdAt: { gte: since } }, select: { createdAt: true } });
  const weeks = Math.ceil(days / 7);
  const series = Array.from({ length: weeks }, (_, i) => {
    const start = new Date(since.getTime() + i * 7 * 86400000);
    const end = new Date(start.getTime() + 7 * 86400000);
    return { week: start.toISOString().slice(0, 10), leads: seoContacts.filter((c) => c.createdAt >= start && c.createdAt < end).length };
  });
  return {
    seoLeads,
    allLeads,
    seoShare: allLeads ? (seoLeads / allLeads) * 100 : 0,
    trackedSessions: sessions,
    aiQualificationRate: seoLeads ? (qualified / seoLeads) * 100 : 0,
    wonValue: toNumber(wonSeo._sum.dealValue),
    wonCount: wonSeo._count._all,
    topPages: pageConversations,
    topKeywords: byKeyword.map((k) => ({ keyword: k.seoKeyword!, leads: k._count._all })),
    byOrigin: byOrigin.map((o) => ({ origin: o.origin, leads: o._count._all })).sort((a, b) => b.leads - a.leads),
    series,
  };
}
