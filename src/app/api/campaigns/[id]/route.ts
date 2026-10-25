import { prisma } from "@/lib/prisma";
import { route } from "@/lib/api";
import { HttpError } from "@/lib/auth";

export const GET = route<{ id: string }>(async ({ params, session }) => {
  const c = await prisma.campaign.findFirst({
    where: { id: params.id, workspaceId: session.workspace.id },
    include: {
      template: true,
      templateB: true,
      channel: { select: { id: true, name: true, phoneNumber: true } },
      recipients: { include: { contact: { select: { id: true, name: true, phone: true } } }, orderBy: { sentAt: "desc" }, take: 300 },
    },
  });
  if (!c) throw new HttpError(404, "Campanha não encontrada");
  const byStatus = await prisma.campaignRecipient.groupBy({ by: ["status"], where: { campaignId: c.id }, _count: { _all: true } });
  const byVariant = await prisma.campaignRecipient.groupBy({ by: ["variant", "status"], where: { campaignId: c.id }, _count: { _all: true } });
  return { ...c, byStatus, byVariant };
}, { module: "campanhas" });

export const DELETE = route<{ id: string }>(async ({ params, session }) => {
  const c = await prisma.campaign.findFirst({ where: { id: params.id, workspaceId: session.workspace.id } });
  if (!c) throw new HttpError(404, "Campanha não encontrada");
  if (c.status === "SENDING") throw new HttpError(400, "Campanha em envio não pode ser excluída");
  await prisma.campaign.delete({ where: { id: c.id } });
  return { ok: true };
}, { module: "campanhas" });
