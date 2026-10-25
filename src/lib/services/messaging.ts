// Envio e recebimento de mensagens (com regra da janela de 24h da Meta) + vínculo de rastreio SEO.
import type { MediaType, Prisma, SenderType, User } from "@prisma/client";
import { prisma } from "../prisma";
import { HttpError } from "../errors";
import { emitWorkspace } from "../realtime";
import { adapterFor } from "../whatsapp";
import { buildVarContext, renderTemplate, resolveTemplateParams } from "../templates";
import { normalizePhone } from "../utils";
import { DEFAULT_STAGES } from "../constants";

const WINDOW_MS = 24 * 60 * 60 * 1000;

export function windowOpen(conv: { metaWindowExpiresAt: Date | null }) {
  return !!conv.metaWindowExpiresAt && conv.metaWindowExpiresAt.getTime() > Date.now();
}

function preview(text: string) {
  return text.replace(/\s+/g, " ").slice(0, 120);
}

async function touchConversation(conversationId: string, text: string, data: Prisma.ConversationUpdateInput = {}) {
  return prisma.conversation.update({
    where: { id: conversationId },
    data: { lastMessagePreview: preview(text), lastMessageAt: new Date(), ...data },
  });
}

export async function sendOutboundText(opts: {
  conversationId: string;
  text: string;
  senderType: Exclude<SenderType, "CONTACT">;
  senderUser?: Pick<User, "id" | "name"> | null;
  senderName?: string;
  mediaUrl?: string | null;
  mediaType?: MediaType;
  /** permite enviar fora da janela (ex.: notas internas de sistema) */
  internal?: boolean;
}) {
  const conv = await prisma.conversation.findUniqueOrThrow({ where: { id: opts.conversationId }, include: { channel: true, contact: true } });
  if (!opts.internal && conv.channel?.provider === "META_OFFICIAL" && !windowOpen(conv)) {
    throw new HttpError(409, "A janela de 24h da Meta está fechada. Envie um modelo aprovado para reabrir a conversa.");
  }
  let metaMessageId: string | null = null;
  let status: "SENT" | "FAILED" = "SENT";
  if (!opts.internal && conv.channel) {
    try {
      const adapter = adapterFor(conv.channel);
      const r = opts.mediaUrl && opts.mediaType && opts.mediaType !== "TEXT"
        ? await adapter.sendMedia(conv.channel, conv.contact.phone, { url: opts.mediaUrl, type: opts.mediaType === "AUDIO" ? "audio" : opts.mediaType === "IMAGE" ? "image" : "document", caption: opts.text })
        : await adapter.sendText(conv.channel, conv.contact.phone, opts.text);
      metaMessageId = r.id;
    } catch (e) {
      console.error("[messaging] envio falhou", (e as Error).message);
      status = "FAILED";
    }
  }
  const msg = await prisma.message.create({
    data: {
      conversationId: conv.id,
      senderType: opts.senderType,
      senderUserId: opts.senderUser?.id ?? null,
      senderName: opts.senderName ?? opts.senderUser?.name ?? null,
      content: opts.text,
      mediaUrl: opts.mediaUrl ?? null,
      mediaType: opts.mediaType ?? "TEXT",
      metaMessageId,
      status,
    },
  });
  const humanReply = opts.senderType === "USER";
  await touchConversation(conv.id, opts.text, {
    ...(humanReply ? { status: "OPEN", unreadCount: 0 } : {}),
  });
  if (conv.channel) await prisma.whatsAppChannel.update({ where: { id: conv.channel.id }, data: { lastActivityAt: new Date() } });
  await prisma.contact.update({ where: { id: conv.contactId }, data: { lastInteractionAt: new Date() } });
  emitWorkspace(conv.workspaceId, "message:new", { conversationId: conv.id, messageId: msg.id });
  if (status === "FAILED") throw new HttpError(502, "Falha ao enviar pelo provedor do WhatsApp");
  return msg;
}

export async function sendTemplateMessage(opts: { conversationId: string; templateId: string; user?: Pick<User, "id" | "name"> | null; senderName?: string }) {
  const conv = await prisma.conversation.findUniqueOrThrow({ where: { id: opts.conversationId }, include: { channel: true, contact: { include: { assignedTo: true } }, workspace: true } });
  const t = await prisma.messageTemplate.findFirstOrThrow({ where: { id: opts.templateId, workspaceId: conv.workspaceId } });
  if (t.metaStatus !== "APPROVED") throw new HttpError(400, "O modelo ainda não foi aprovado pela Meta");
  if (!conv.channel) throw new HttpError(400, "Conversa sem número de WhatsApp");
  const ctx = buildVarContext({ ...conv.contact, monthlyIncome: conv.contact.monthlyIncome?.toString() ?? null }, conv.contact.assignedTo ?? opts.user, conv.workspace);
  const mappings = (t.variableMappings ?? {}) as Record<string, string>;
  const text = renderTemplate(t.bodyText, mappings, ctx);
  const r = await adapterFor(conv.channel).sendTemplate(conv.channel, conv.contact.phone, { template: t, bodyParams: resolveTemplateParams(t.bodyText, mappings, ctx) });
  const msg = await prisma.message.create({
    data: {
      conversationId: conv.id,
      senderType: opts.user ? "USER" : "SYSTEM",
      senderUserId: opts.user?.id ?? null,
      senderName: opts.senderName ?? opts.user?.name ?? "Campanha",
      content: [t.headerType === "TEXT" ? t.headerContent : null, text, t.footerText].filter(Boolean).join("\n\n"),
      mediaType: "TEMPLATE",
      mediaUrl: t.headerType !== "NONE" && t.headerType !== "TEXT" ? t.headerContent : null,
      metaMessageId: r.id,
    },
  });
  await touchConversation(conv.id, `📋 ${t.name}`, opts.user ? { status: "OPEN" } : {});
  emitWorkspace(conv.workspaceId, "message:new", { conversationId: conv.id, messageId: msg.id });
  return { message: msg, renderedBody: text };
}

export async function defaultPipelineStage(workspaceId: string) {
  const cfg = await prisma.aiAssistantConfig.findUnique({ where: { workspaceId } });
  if (cfg?.targetPipelineId && cfg.targetStageId) return { pipelineId: cfg.targetPipelineId, stageId: cfg.targetStageId };
  let pipeline = await prisma.pipeline.findFirst({ where: { workspaceId, isDefault: true }, include: { stages: { orderBy: { order: "asc" } } } });
  if (!pipeline) pipeline = await prisma.pipeline.findFirst({ where: { workspaceId }, include: { stages: { orderBy: { order: "asc" } } } });
  if (!pipeline) {
    pipeline = await prisma.pipeline.create({
      data: { workspaceId, name: "Funil de vendas", isDefault: true, stages: { create: DEFAULT_STAGES.map((s, i) => ({ ...s, order: i })) } },
      include: { stages: { orderBy: { order: "asc" } } },
    });
  }
  return { pipelineId: pipeline.id, stageId: pipeline.stages[0]?.id ?? null };
}

export const REF_REGEX = /\[?\s*Ref:?\s*#?([A-Z]{2,4}-[A-Z0-9]{4,8})\s*\]?/i;

/** Aplica dados de uma sessão do tracker (página de entrada do Google etc.) a um contato. */
export async function attributeTracking(workspaceId: string, code: string) {
  const ts = await prisma.trackingSession.findFirst({ where: { workspaceId, code: code.toUpperCase() } });
  if (!ts) return null;
  return {
    session: ts,
    data: {
      origin: ts.origin,
      seoLandingPage: ts.landingPage,
      seoReferrer: ts.referrer,
      seoKeyword: ts.keyword,
      utmSource: ts.utmSource,
      utmMedium: ts.utmMedium,
      utmCampaign: ts.utmCampaign,
      trackingCode: `#${ts.code}`,
    } satisfies Prisma.ContactUpdateInput,
  };
}

export type InboundInput = {
  workspaceId: string;
  channelId: string;
  from: string;
  profileName?: string | null;
  text: string;
  mediaType?: MediaType;
  mediaUrl?: string | null;
  metaMessageId?: string | null;
};

/** Processa uma mensagem recebida (webhook Meta/Evolution ou simulador). */
export async function ingestInbound(input: InboundInput) {
  const phone = normalizePhone(input.from);
  if (input.metaMessageId) {
    const dup = await prisma.message.findUnique({ where: { metaMessageId: input.metaMessageId } });
    if (dup) return { duplicate: true as const };
  }
  const ref = input.text.match(REF_REGEX)?.[1] ?? null;
  let contact = await prisma.contact.findUnique({ where: { workspaceId_phone: { workspaceId: input.workspaceId, phone } } });
  let isNewContact = false;
  if (!contact) {
    const { pipelineId, stageId } = await defaultPipelineStage(input.workspaceId);
    const attribution = ref ? await attributeTracking(input.workspaceId, ref) : null;
    contact = await prisma.contact.create({
      data: {
        workspaceId: input.workspaceId,
        phone,
        name: input.profileName || null,
        pipelineId,
        stageId,
        origin: "SITE_DIRETO",
        tags: attribution?.session.origin === "SEO_ORGANICO" ? ["seo"] : [],
        ...(attribution?.data ?? {}),
        lastInteractionAt: new Date(),
      },
    });
    if (attribution) await prisma.trackingSession.update({ where: { id: attribution.session.id }, data: { contactId: contact.id, event: "whatsapp_message" } });
    isNewContact = true;
  } else {
    const patch: Prisma.ContactUpdateInput = { lastInteractionAt: new Date() };
    if (!contact.name && input.profileName) patch.name = input.profileName;
    if (ref && !contact.trackingCode) {
      const attribution = await attributeTracking(input.workspaceId, ref);
      if (attribution) Object.assign(patch, attribution.data);
    }
    contact = await prisma.contact.update({ where: { id: contact.id }, data: patch });
  }

  let conv = await prisma.conversation.findUnique({ where: { contactId_channelId: { contactId: contact.id, channelId: input.channelId } } });
  const isNewConversation = !conv;
  if (!conv) {
    conv = await prisma.conversation.create({
      data: { workspaceId: input.workspaceId, contactId: contact.id, channelId: input.channelId, assignedToId: contact.assignedToId },
    });
  }

  const msg = await prisma.message.create({
    data: {
      conversationId: conv.id,
      senderType: "CONTACT",
      senderName: contact.name ?? null,
      content: input.text,
      mediaType: input.mediaType ?? "TEXT",
      mediaUrl: input.mediaUrl ?? null,
      metaMessageId: input.metaMessageId ?? null,
      status: "DELIVERED",
    },
  });

  // Resposta a campanha? "Entregar ao Téo quem responder"
  const recipient = await prisma.campaignRecipient.findFirst({
    where: { contactId: contact.id, status: { in: ["SENT", "DELIVERED", "READ"] }, sentAt: { gte: new Date(Date.now() - 7 * 86400000) } },
    include: { campaign: true },
    orderBy: { sentAt: "desc" },
  });
  if (recipient) {
    await prisma.campaignRecipient.update({ where: { id: recipient.id }, data: { status: "REPLIED", repliedAt: new Date() } });
    await prisma.campaign.update({ where: { id: recipient.campaignId }, data: { repliedCount: { increment: 1 } } });
  }

  const [aiConfig, rule] = await Promise.all([
    prisma.aiAssistantConfig.findUnique({ where: { workspaceId: input.workspaceId } }),
    prisma.aiAutomationRule.findUnique({ where: { workspaceId_type: { workspaceId: input.workspaceId, type: "WHATSAPP_QUALIFICATION" } } }),
  ]);
  const aiEnabled = !!aiConfig?.isActive && !!rule?.isEnabled && contact.aiQualificationEnabled;
  const state = (conv.aiState ?? {}) as { step?: string };
  let aiActive = conv.aiActive;
  let aiState: Prisma.InputJsonValue | undefined;
  if (aiEnabled && !state.step && (isNewConversation || isNewContact)) aiActive = true;
  if (aiEnabled && recipient?.campaign.routeRepliesToAi && !conv.aiActive) {
    // Respondeu a um disparo: o Téo reassume, mantendo o que já foi coletado
    aiActive = true;
    aiState = { ...(conv.aiState as Record<string, unknown>), step: null, currentQuestionId: null } as Prisma.InputJsonValue;
  }

  const now = new Date();
  conv = await prisma.conversation.update({
    where: { id: conv.id },
    data: {
      aiActive,
      ...(aiState ? { aiState } : {}),
      status: aiActive ? "WITH_AI" : "UNREAD",
      unreadCount: { increment: 1 },
      metaWindowExpiresAt: new Date(now.getTime() + WINDOW_MS),
      lastContactMessageAt: now,
      lastMessagePreview: preview(input.text),
      lastMessageAt: now,
    },
  });
  await prisma.whatsAppChannel.update({ where: { id: input.channelId }, data: { lastActivityAt: now } });
  emitWorkspace(input.workspaceId, "message:new", { conversationId: conv.id, messageId: msg.id });

  return { duplicate: false as const, contact, conversation: conv, message: msg, isNewContact, aiActive };
}
