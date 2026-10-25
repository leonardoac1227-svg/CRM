// Segmentação de destinatários, cálculo de custo e execução de disparos de templates.
import type { Prisma } from "@prisma/client";
import { prisma } from "../prisma";
import { META_PRICING } from "../constants";
import { emitWorkspace } from "../realtime";
import { adapterFor } from "../whatsapp";
import { buildVarContext, renderTemplate, resolveTemplateParams } from "../templates";

export type CampaignFilters = {
  pipelineId?: string | null;
  stageIds?: string[];
  assignedToIds?: string[]; // "none" = sem responsável
  origins?: string[];
  tags?: string[];
  status?: string[];
  contactIds?: string[];
  excludeContactIds?: string[];
};

export function filtersToWhere(workspaceId: string, f: CampaignFilters, scope?: Prisma.ContactWhereInput): Prisma.ContactWhereInput {
  const and: Prisma.ContactWhereInput[] = [{ workspaceId }];
  if (scope) and.push(scope);
  if (f.contactIds?.length) and.push({ id: { in: f.contactIds } });
  if (f.pipelineId) and.push({ pipelineId: f.pipelineId });
  if (f.stageIds?.length) and.push({ stageId: { in: f.stageIds } });
  if (f.assignedToIds?.length) {
    const ids = f.assignedToIds.filter((i) => i !== "none");
    and.push({ OR: [...(ids.length ? [{ assignedToId: { in: ids } }] : []), ...(f.assignedToIds.includes("none") ? [{ assignedToId: null }] : [])] });
  }
  if (f.origins?.length) and.push({ origin: { in: f.origins as never[] } });
  if (f.tags?.length) and.push({ tags: { hasSome: f.tags } });
  if (f.status?.length) and.push({ status: { in: f.status as never[] } });
  if (f.excludeContactIds?.length) and.push({ id: { notIn: f.excludeContactIds } });
  return { AND: and };
}

export function costFor(category: string, count: number) {
  return Math.round((META_PRICING[category] ?? 0) * count * 10000) / 10000;
}

function localHour(tz = "America/Sao_Paulo") {
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone: tz, hour: "2-digit", minute: "2-digit", hour12: false }).formatToParts(new Date());
  const h = Number(parts.find((p) => p.type === "hour")?.value ?? 0);
  const m = Number(parts.find((p) => p.type === "minute")?.value ?? 0);
  return h + m / 60;
}

function withinAllowedWindow(until?: string | null) {
  if (!until) return true;
  const [h, m] = until.split(":").map(Number);
  const now = localHour();
  return now >= 8 && now < h + (m || 0) / 60;
}

/** Cria a lista de destinatários (A/B alternado) a partir dos filtros salvos. */
export async function materializeRecipients(campaignId: string) {
  const c = await prisma.campaign.findUniqueOrThrow({ where: { id: campaignId }, include: { template: true } });
  const where = filtersToWhere(c.workspaceId, (c.filtersJson ?? {}) as CampaignFilters);
  const contacts = await prisma.contact.findMany({ where, select: { id: true }, orderBy: { createdAt: "asc" } });
  await prisma.campaignRecipient.createMany({
    data: contacts.map((ct, i) => ({ campaignId: c.id, contactId: ct.id, variant: c.abTestEnabled && c.templateBId && i % 2 === 1 ? "B" : "A" })),
    skipDuplicates: true,
  });
  const total = await prisma.campaignRecipient.count({ where: { campaignId: c.id } });
  await prisma.campaign.update({ where: { id: c.id }, data: { totalRecipients: total, estimatedCost: costFor(c.template?.category ?? "MARKETING", total) } });
  return total;
}

/** Envia um lote de destinatários pendentes. Retorna quantos ainda faltam. */
export async function processCampaignBatch(campaignId: string, batchSize = 50) {
  const c = await prisma.campaign.findUniqueOrThrow({ where: { id: campaignId }, include: { template: true, templateB: true, channel: true, workspace: true } });
  if (!c.template || !c.channel) throw new Error("Campanha sem modelo ou número");
  if (!withinAllowedWindow(c.allowedSendUntilHour)) return { remaining: await prisma.campaignRecipient.count({ where: { campaignId, status: "PENDING" } }), paused: true };

  if (c.status !== "SENDING") await prisma.campaign.update({ where: { id: c.id }, data: { status: "SENDING", startedAt: c.startedAt ?? new Date() } });
  const batch = await prisma.campaignRecipient.findMany({
    where: { campaignId, status: "PENDING" },
    include: { contact: { include: { assignedTo: true } } },
    take: batchSize,
  });
  let sent = 0;
  let failed = 0;
  for (const r of batch) {
    const t = r.variant === "B" && c.templateB ? c.templateB : c.template;
    const ctx = buildVarContext({ ...r.contact, monthlyIncome: r.contact.monthlyIncome?.toString() ?? null }, r.contact.assignedTo, c.workspace);
    const mappings = (t.variableMappings ?? {}) as Record<string, string>;
    const body = renderTemplate(t.bodyText, mappings, ctx);
    try {
      const res = await adapterFor(c.channel).sendTemplate(c.channel, r.contact.phone, { template: t, bodyParams: resolveTemplateParams(t.bodyText, mappings, ctx) });
      const conv = await prisma.conversation.upsert({
        where: { contactId_channelId: { contactId: r.contactId, channelId: c.channel.id } },
        create: { workspaceId: c.workspaceId, contactId: r.contactId, channelId: c.channel.id, assignedToId: r.contact.assignedToId, status: "OPEN" },
        update: {},
      });
      await prisma.message.create({
        data: {
          conversationId: conv.id,
          senderType: "SYSTEM",
          senderName: `Campanha: ${c.name}`,
          content: [t.headerType === "TEXT" ? t.headerContent : null, body, t.footerText].filter(Boolean).join("\n\n"),
          mediaType: "TEMPLATE",
          metaMessageId: res.id,
        },
      });
      await prisma.conversation.update({
        where: { id: conv.id },
        data: { lastMessageAt: new Date(), lastMessagePreview: `📣 ${body.slice(0, 100)}` },
      });
      await prisma.campaignRecipient.update({ where: { id: r.id }, data: { status: "SENT", sentAt: new Date(), renderedBody: body } });
      sent++;
    } catch (e) {
      await prisma.campaignRecipient.update({ where: { id: r.id }, data: { status: "FAILED", error: (e as Error).message.slice(0, 300) } });
      failed++;
    }
  }
  const remaining = await prisma.campaignRecipient.count({ where: { campaignId, status: "PENDING" } });
  await prisma.campaign.update({
    where: { id: c.id },
    data: {
      sentCount: { increment: sent },
      failedCount: { increment: failed },
      ...(remaining === 0 ? { status: "COMPLETED", completedAt: new Date() } : {}),
    },
  });
  emitWorkspace(c.workspaceId, "campaign:progress", { campaignId: c.id, remaining });
  return { remaining, paused: false };
}

export async function runCampaignToEnd(campaignId: string) {
  for (let i = 0; i < 200; i++) {
    const r = await processCampaignBatch(campaignId);
    if (r.paused || r.remaining === 0) return r;
  }
  return { remaining: -1, paused: false };
}

/** Chamado pelo agendador: inicia campanhas agendadas e continua as pausadas pelo limite de horário. */
export async function processScheduledCampaigns() {
  const due = await prisma.campaign.findMany({
    where: { OR: [{ status: "SCHEDULED", scheduledAt: { lte: new Date() } }, { status: "SENDING" }] },
    select: { id: true, status: true },
  });
  for (const c of due) {
    if (c.status === "SCHEDULED") await materializeRecipients(c.id);
    await runCampaignToEnd(c.id).catch((e) => console.error("[campaign]", e));
  }
  return due.length;
}
