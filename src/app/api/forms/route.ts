import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { body, route } from "@/lib/api";

export const GET = route(async ({ session }) => prisma.leadForm.findMany({ where: { workspaceId: session.workspace.id }, orderBy: { createdAt: "desc" } }), { module: "campanhas" });

export const POST = route(async ({ req, session }) => {
  const d = await body(req, z.object({
    name: z.string().min(2),
    pipelineId: z.string().nullable().optional(),
    stageId: z.string().nullable().optional(),
    fields: z.array(z.object({ key: z.string(), label: z.string(), type: z.string(), required: z.boolean() })).min(1),
  }));
  return prisma.leadForm.create({ data: { workspaceId: session.workspace.id, name: d.name, pipelineId: d.pipelineId, stageId: d.stageId, fieldsJson: d.fields } });
}, { module: "campanhas" });
