import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { body, route } from "@/lib/api";
import { contactScope, requireManager } from "@/lib/rbac";
import { DEFAULT_STAGES } from "@/lib/constants";

export const GET = route(async ({ session }) => {
  const pipelines = await prisma.pipeline.findMany({
    where: { workspaceId: session.workspace.id },
    include: { stages: { orderBy: { order: "asc" } } },
    orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }],
  });
  const counts = await prisma.contact.groupBy({ by: ["pipelineId"], where: contactScope(session), _count: { _all: true } });
  return pipelines.map((p) => ({ ...p, contactsCount: counts.find((c) => c.pipelineId === p.id)?._count._all ?? 0 }));
});

const schema = z.object({
  name: z.string().min(2).max(60),
  stages: z.array(z.object({ name: z.string().min(1), color: z.string().optional(), isWonStage: z.boolean().optional() })).optional(),
});

export const POST = route(async ({ req, session }) => {
  requireManager(session);
  const d = await body(req, schema);
  const stages = d.stages?.length ? d.stages : DEFAULT_STAGES;
  return prisma.pipeline.create({
    data: {
      workspaceId: session.workspace.id,
      name: d.name,
      stages: { create: stages.map((s, i) => ({ name: s.name, color: s.color ?? "#2563EB", isWonStage: !!s.isWonStage, order: i })) },
    },
    include: { stages: { orderBy: { order: "asc" } } },
  });
}, { module: "funis" });
