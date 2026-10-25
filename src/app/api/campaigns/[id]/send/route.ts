import { prisma } from "@/lib/prisma";
import { route } from "@/lib/api";
import { HttpError } from "@/lib/auth";
import { materializeRecipients, runCampaignToEnd } from "@/lib/services/campaigns";

/** Envia agora um rascunho/agendada. */
export const POST = route<{ id: string }>(async ({ params, session }) => {
  const c = await prisma.campaign.findFirst({ where: { id: params.id, workspaceId: session.workspace.id }, include: { template: true } });
  if (!c) throw new HttpError(404, "Campanha não encontrada");
  if (c.status === "COMPLETED") throw new HttpError(400, "Campanha já enviada");
  if (!c.template || c.template.metaStatus !== "APPROVED") throw new HttpError(400, "O modelo precisa estar aprovado");
  await prisma.campaign.update({ where: { id: c.id }, data: { status: "SENDING", sendScheduleType: "NOW" } });
  const total = await materializeRecipients(c.id);
  if (!total) throw new HttpError(400, "Nenhum destinatário corresponde aos filtros");
  void runCampaignToEnd(c.id).catch((e) => console.error("[campaign]", e));
  return { ok: true, total };
}, { module: "campanhas" });
