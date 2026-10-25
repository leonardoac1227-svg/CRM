import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { body, route } from "@/lib/api";
import { HttpError } from "@/lib/auth";
import { requireManager } from "@/lib/rbac";

const schema = z.object({
  name: z.string().min(2).max(60).optional(),
  isDefault: z.boolean().optional(),
  stages: z
    .array(z.object({ id: z.string().optional(), name: z.string().min(1), color: z.string().default("#2563EB"), isWonStage: z.boolean().default(false) }))
    .min(2)
    .max(15)
    .optional(),
});

async function own(id: string, workspaceId: string) {
  const p = await prisma.pipeline.findFirst({ where: { id, workspaceId }, include: { stages: true } });
  if (!p) throw new HttpError(404, "Funil não encontrado");
  return p;
}

export const PATCH = route<{ id: string }>(async ({ req, params, session }) => {
  requireManager(session);
  const p = await own(params.id, session.workspace.id);
  const d = await body(req, schema);
  await prisma.$transaction(async (tx) => {
    if (d.isDefault) await tx.pipeline.updateMany({ where: { workspaceId: session.workspace.id }, data: { isDefault: false } });
    await tx.pipeline.update({ where: { id: p.id }, data: { name: d.name, isDefault: d.isDefault } });
    if (d.stages) {
      const keep = new Set(d.stages.map((s) => s.id).filter(Boolean) as string[]);
      const ids: string[] = [];
      for (const [i, s] of d.stages.entries()) {
        if (s.id && p.stages.some((x) => x.id === s.id)) {
          await tx.stage.update({ where: { id: s.id }, data: { name: s.name, color: s.color, isWonStage: s.isWonStage, order: i } });
          ids.push(s.id);
        } else {
          ids.push((await tx.stage.create({ data: { pipelineId: p.id, name: s.name, color: s.color, isWonStage: s.isWonStage, order: i } })).id);
        }
      }
      const removed = p.stages.filter((s) => !keep.has(s.id));
      if (removed.length) {
        // leads das etapas removidas vão para a primeira etapa
        await tx.contact.updateMany({ where: { stageId: { in: removed.map((r) => r.id) } }, data: { stageId: ids[0] } });
        await tx.stage.deleteMany({ where: { id: { in: removed.map((r) => r.id) } } });
      }
    }
  });
  return prisma.pipeline.findUnique({ where: { id: p.id }, include: { stages: { orderBy: { order: "asc" } } } });
}, { module: "funis" });

export const DELETE = route<{ id: string }>(async ({ params, session }) => {
  requireManager(session);
  const p = await own(params.id, session.workspace.id);
  if (p.isDefault) throw new HttpError(400, "Não é possível excluir o funil padrão");
  await prisma.contact.updateMany({ where: { pipelineId: p.id }, data: { pipelineId: null, stageId: null } });
  await prisma.pipeline.delete({ where: { id: p.id } });
  return { ok: true };
}, { module: "funis" });
