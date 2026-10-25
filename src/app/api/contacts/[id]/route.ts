import { prisma } from "@/lib/prisma";
import { body, route } from "@/lib/api";
import { HttpError } from "@/lib/auth";
import { isManagerLike, seesOnlyOwn } from "@/lib/rbac";
import { findContact } from "@/lib/services/contacts";
import { normalizePhone } from "@/lib/utils";
import { logActivity } from "@/lib/services/activity";
import { assignContact } from "@/lib/services/distribution";
import { emitWorkspace } from "@/lib/realtime";
import { contactFields } from "@/lib/schemas";

export const GET = route<{ id: string }>(async ({ params, session }) => {
  await findContact(session, params.id);
  return prisma.contact.findUnique({
    where: { id: params.id },
    include: {
      assignedTo: { select: { id: true, name: true } },
      stage: true,
      pipeline: { include: { stages: { orderBy: { order: "asc" } } } },
      conversations: { include: { channel: { select: { id: true, name: true, phoneNumber: true } }, messages: { orderBy: { createdAt: "desc" }, take: 3 } }, orderBy: { lastMessageAt: "desc" } },
      tasks: { include: { assignedTo: { select: { id: true, name: true } } }, orderBy: { dueDate: "asc" } },
      activities: { include: { user: { select: { id: true, name: true } } }, orderBy: { createdAt: "desc" }, take: 100 },
      interestedItems: true,
      campaignRecipients: { include: { campaign: { select: { id: true, name: true } } }, orderBy: { sentAt: "desc" }, take: 10 },
    },
  });
}, { module: "contatos" });

export const PATCH = route<{ id: string }>(async ({ req, params, session }) => {
  const current = await findContact(session, params.id);
  const d = await body(req, contactFields);
  const { assignedToId, stageId, ...rest } = d;
  if (rest.phone) rest.phone = normalizePhone(rest.phone);

  const data: Record<string, unknown> = { ...rest };
  if (stageId !== undefined && stageId !== current.stageId) {
    const stage = stageId ? await prisma.stage.findFirst({ where: { id: stageId, pipeline: { workspaceId: session.workspace.id } } }) : null;
    if (stageId && !stage) throw new HttpError(404, "Etapa não encontrada");
    data.stageId = stage?.id ?? null;
    data.pipelineId = stage?.pipelineId ?? current.pipelineId;
    data.stageChangedAt = new Date();
    if (stage?.isWonStage) data.status = "WON";
    else if (current.status === "WON") data.status = "OPEN";
    const prev = current.stageId ? await prisma.stage.findUnique({ where: { id: current.stageId } }) : null;
    await logActivity({ workspaceId: session.workspace.id, contactId: current.id, userId: session.user.id, type: "STAGE_CHANGE", title: `Etapa alterada${prev ? ` de ${prev.name}` : ""} para ${stage?.name ?? "—"}` });
  }
  const updated = await prisma.contact.update({ where: { id: current.id }, data });

  if (assignedToId !== undefined && assignedToId !== current.assignedToId) {
    if (seesOnlyOwn(session.user) && !isManagerLike(session.user) && assignedToId !== session.user.id) throw new HttpError(403, "Somente gestores podem transferir leads");
    if (assignedToId) {
      const u = await prisma.user.findFirst({ where: { id: assignedToId, workspaceId: session.workspace.id } });
      if (!u) throw new HttpError(404, "Responsável não encontrado");
    }
    await assignContact({ workspaceId: session.workspace.id, contactId: current.id, userId: assignedToId, byUserId: session.user.id, via: "MANUAL" });
  }
  emitWorkspace(session.workspace.id, "contact:updated", { contactId: current.id });
  return updated;
}, { module: "contatos" });

export const DELETE = route<{ id: string }>(async ({ params, session }) => {
  if (!isManagerLike(session.user)) throw new HttpError(403, "Apenas gestores podem excluir contatos");
  await findContact(session, params.id);
  await prisma.contact.delete({ where: { id: params.id } });
  return { ok: true };
}, { module: "contatos" });
