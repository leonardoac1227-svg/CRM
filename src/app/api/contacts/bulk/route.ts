import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { body, route } from "@/lib/api";
import { HttpError } from "@/lib/auth";
import { contactScope, isManagerLike } from "@/lib/rbac";
import { assignContact } from "@/lib/services/distribution";
import { logActivity } from "@/lib/services/activity";

const schema = z.object({
  ids: z.array(z.string()).min(1).max(1000),
  action: z.enum(["assign", "stage", "addTag", "removeTag", "delete", "aiOn", "aiOff"]),
  value: z.string().nullable().optional(),
});

export const POST = route(async ({ req, session }) => {
  const d = await body(req, schema);
  const contacts = await prisma.contact.findMany({ where: { ...contactScope(session), id: { in: d.ids } } });
  if (["assign", "delete"].includes(d.action) && !isManagerLike(session.user)) throw new HttpError(403, "Apenas gestores podem fazer esta ação em massa");
  for (const c of contacts) {
    switch (d.action) {
      case "assign":
        await assignContact({ workspaceId: session.workspace.id, contactId: c.id, userId: d.value ?? null, byUserId: session.user.id, via: "MANUAL" });
        break;
      case "stage": {
        const stage = await prisma.stage.findFirst({ where: { id: d.value ?? "", pipeline: { workspaceId: session.workspace.id } } });
        if (!stage) throw new HttpError(404, "Etapa não encontrada");
        await prisma.contact.update({ where: { id: c.id }, data: { stageId: stage.id, pipelineId: stage.pipelineId, stageChangedAt: new Date(), ...(stage.isWonStage ? { status: "WON" } : {}) } });
        await logActivity({ workspaceId: session.workspace.id, contactId: c.id, userId: session.user.id, type: "STAGE_CHANGE", title: `Etapa alterada para ${stage.name} (em massa)` });
        break;
      }
      case "addTag":
        if (d.value && !c.tags.includes(d.value)) await prisma.contact.update({ where: { id: c.id }, data: { tags: [...c.tags, d.value] } });
        break;
      case "removeTag":
        await prisma.contact.update({ where: { id: c.id }, data: { tags: c.tags.filter((t) => t !== d.value) } });
        break;
      case "aiOn":
      case "aiOff":
        await prisma.contact.update({ where: { id: c.id }, data: { aiQualificationEnabled: d.action === "aiOn" } });
        break;
      case "delete":
        await prisma.contact.delete({ where: { id: c.id } });
        break;
    }
  }
  return { affected: contacts.length };
}, { module: "contatos" });
