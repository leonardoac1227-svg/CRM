import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { body, route } from "@/lib/api";
import { HttpError } from "@/lib/auth";
import { costFor, filtersToWhere, materializeRecipients, runCampaignToEnd, type CampaignFilters } from "@/lib/services/campaigns";
import { contactScope } from "@/lib/rbac";
import { campaignFiltersSchema } from "@/lib/schemas";

export const GET = route(async ({ session }) => {
  return prisma.campaign.findMany({
    where: { workspaceId: session.workspace.id },
    include: { template: { select: { id: true, name: true, category: true } }, channel: { select: { id: true, name: true, phoneNumber: true } } },
    orderBy: { createdAt: "desc" },
  });
}, { module: "campanhas" });


const schema = z.object({
  name: z.string().min(2).max(120),
  channelId: z.string(),
  templateId: z.string(),
  abTestEnabled: z.boolean().default(false),
  templateBId: z.string().nullable().optional(),
  sendScheduleType: z.enum(["NOW", "SCHEDULED"]),
  scheduledAt: z.string().nullable().optional(),
  allowedSendUntilHour: z.string().regex(/^\d{2}:\d{2}$/).nullable().optional(),
  routeRepliesToAi: z.boolean().default(true),
  filters: campaignFiltersSchema,
  draft: z.boolean().optional(),
});

export const POST = route(async ({ req, session }) => {
  const d = await body(req, schema);
  const [channel, template] = await Promise.all([
    prisma.whatsAppChannel.findFirst({ where: { id: d.channelId, workspaceId: session.workspace.id } }),
    prisma.messageTemplate.findFirst({ where: { id: d.templateId, workspaceId: session.workspace.id } }),
  ]);
  if (!channel) throw new HttpError(404, "Número remetente não encontrado");
  if (!template || template.metaStatus !== "APPROVED") throw new HttpError(400, "Selecione um modelo aprovado pela Meta");
  if (d.abTestEnabled && !d.templateBId) throw new HttpError(400, "Escolha o modelo B para o teste A/B");
  if (session.user.role === "BROKER" && channel.userId !== session.user.id && channel.accountType !== "COMPANY") throw new HttpError(403, "Use o seu número");
  if (d.sendScheduleType === "SCHEDULED" && (!d.scheduledAt || new Date(d.scheduledAt).getTime() < Date.now() - 60000)) throw new HttpError(400, "Informe uma data futura para o agendamento");

  // Corretor/assistente restrito só dispara para a própria carteira
  const filters: CampaignFilters = { ...d.filters };
  const scope = contactScope(session);
  if (scope.assignedToId) filters.assignedToIds = [String(scope.assignedToId)];
  const total = await prisma.contact.count({ where: filtersToWhere(session.workspace.id, filters) });
  if (!total && !d.draft) throw new HttpError(400, "Nenhum destinatário corresponde aos filtros");

  const campaign = await prisma.campaign.create({
    data: {
      workspaceId: session.workspace.id,
      name: d.name,
      channelId: channel.id,
      templateId: template.id,
      abTestEnabled: d.abTestEnabled,
      templateBId: d.abTestEnabled ? d.templateBId : null,
      sendScheduleType: d.sendScheduleType,
      scheduledAt: d.sendScheduleType === "SCHEDULED" && d.scheduledAt ? new Date(d.scheduledAt) : null,
      allowedSendUntilHour: d.allowedSendUntilHour ?? null,
      routeRepliesToAi: d.routeRepliesToAi,
      filtersJson: filters as object,
      totalRecipients: total,
      estimatedCost: costFor(template.category, total),
      status: d.draft ? "DRAFT" : d.sendScheduleType === "SCHEDULED" ? "SCHEDULED" : "SENDING",
    },
  });
  if (!d.draft && d.sendScheduleType === "NOW") {
    await materializeRecipients(campaign.id);
    // envio em segundo plano (o agendador também retoma se o processo reiniciar)
    void runCampaignToEnd(campaign.id).catch((e) => console.error("[campaign]", e));
  }
  return campaign;
}, { module: "campanhas" });
