// Orquestra o Téo numa conversa real: carrega config, roda o motor, envia respostas,
// grava dados no contato e faz o transbordo (roleta / gestor / usuário fixo).
import type { AiAssistantConfig, AiFaq, AiQuestion, Prisma } from "@prisma/client";
import { prisma } from "../prisma";
import { emitWorkspace } from "../realtime";
import { runTeo, type EngineConfig, type EngineOutput, type TeoState } from "../ai/teo-engine";
import { buildSummary, enrichSummary } from "../ai/summary";
import { describeImage, llmAvailable, transcribeAudio } from "../ai/llm";
import type { ExtractedValue } from "../ai/extract";
import { sendOutboundText } from "./messaging";
import { assignContact, pickRouletteUser } from "./distribution";
import { logActivity, notifyManagers } from "./activity";
import { toNumber } from "../utils";

export type FullAiConfig = AiAssistantConfig & { questions: AiQuestion[]; faqs: AiFaq[] };

export function toEngineConfig(c: FullAiConfig): EngineConfig {
  return {
    assistantName: c.assistantName,
    roleTitle: c.roleTitle,
    tone: c.tone,
    emojiLevel: c.emojiLevel,
    messageLength: c.messageLength,
    focus: c.focus,
    preset: c.preset,
    regionCity: c.regionCity,
    initialGreeting: c.initialGreeting,
    qualificationObjective: c.qualificationObjective,
    customPromptContext: c.customPromptContext,
    handoffMessage: c.handoffMessage,
    enableCatalogSend: c.enableCatalogSend,
    questions: c.questions.map((q) => ({ id: q.id, order: q.order, questionText: q.questionText, requirementMode: q.requirementMode, targetField: q.targetField })),
    faqs: c.faqs.map((f) => ({ id: f.id, questionTitle: f.questionTitle, answerText: f.answerText, keywords: f.keywords, isEnabled: f.isEnabled })),
  };
}

export async function loadAiConfig(workspaceId: string): Promise<FullAiConfig | null> {
  return prisma.aiAssistantConfig.findUnique({
    where: { workspaceId },
    include: { questions: { orderBy: { order: "asc" } }, faqs: true },
  });
}

/** Converte o patch do motor para campos tipados do Prisma. */
export function contactDataFromPatch(patch: Record<string, ExtractedValue>): Prisma.ContactUpdateInput {
  const d: Prisma.ContactUpdateInput = {};
  for (const [k, v] of Object.entries(patch)) {
    switch (k) {
      case "monthlyIncome":
      case "downPaymentAvailable":
      case "fgtsBalance":
      case "dealValue":
        if (typeof v === "number" || (typeof v === "string" && v.trim() !== "" && !Number.isNaN(Number(v)))) d[k] = Number(v);
        break;
      case "hasProperty":
        if (typeof v === "boolean") d.hasProperty = v;
        break;
      case "employmentType":
        if (["CLT", "AUTONOMO", "EMPRESARIO", "APOSENTADO"].includes(String(v))) d.employmentType = v as "CLT";
        break;
      case "employmentYears":
      case "buyingAlone":
      case "neighborhood":
      case "interest":
      case "profession":
      case "maritalStatus":
        d[k] = String(v).slice(0, 160);
        break;
    }
  }
  return d;
}

/** Pré-processa mídia (transcrição de áudio / análise de imagem) conforme a configuração. */
export async function mediaToText(cfg: FullAiConfig, mediaType: string, mediaUrl: string | null, fallbackText: string, headers?: Record<string, string>) {
  if (mediaType === "AUDIO" && mediaUrl && cfg.enableAudioTranscription) {
    const t = await transcribeAudio(mediaUrl, headers);
    if (t) return { text: t, note: `🎙️ Transcrição: ${t}` };
  }
  if ((mediaType === "IMAGE" || mediaType === "DOCUMENT") && mediaUrl && cfg.enableImageAnalysis) {
    const t = await describeImage(mediaUrl);
    if (t) return { text: `[O cliente enviou uma imagem: ${t}] ${fallbackText}`.trim(), note: `🖼️ Análise da imagem: ${t}` };
  }
  return { text: fallbackText, note: null };
}

export async function runAiTurn(conversationId: string, incoming: string | null): Promise<EngineOutput | null> {
  const conv = await prisma.conversation.findUnique({
    where: { id: conversationId },
    include: { contact: true, workspace: true, messages: { orderBy: { createdAt: "desc" }, take: 30 } },
  });
  if (!conv || !conv.aiActive) return null;
  const cfg = await loadAiConfig(conv.workspaceId);
  if (!cfg || !cfg.isActive) return null;

  const catalog = cfg.enableCatalogSend
    ? (await prisma.catalogItem.findMany({ where: { workspaceId: conv.workspaceId, status: "AVAILABLE" }, take: 40 })).map((i) => ({
        code: i.code, title: i.title, price: i.price ? toNumber(i.price) : null, neighborhood: i.neighborhood, bedrooms: i.bedrooms, category: i.category,
      }))
    : [];
  const history = [...conv.messages].reverse().slice(0, -1).map((m) => ({
    from: m.senderType === "CONTACT" ? ("contact" as const) : m.senderType === "AI_AGENT" ? ("assistant" as const) : ("agent" as const),
    text: m.content,
  }));

  const out = await runTeo({
    config: toEngineConfig(cfg),
    companyName: conv.workspace.name,
    contactName: conv.contact.name,
    state: conv.aiState as Partial<TeoState>,
    history,
    incoming,
    catalog,
  });

  for (const reply of out.replies) {
    await sendOutboundText({ conversationId: conv.id, text: reply, senderType: "AI_AGENT", senderName: `IA: ${cfg.assistantName}` });
  }
  const contactData = contactDataFromPatch(out.contactPatch);
  if (out.recommended.length) {
    const items = await prisma.catalogItem.findMany({ where: { workspaceId: conv.workspaceId, code: { in: out.recommended.map((r) => r.code) } } });
    contactData.interestedItems = { connect: items.map((i) => ({ id: i.id })) };
  }
  if (Object.keys(contactData).length) await prisma.contact.update({ where: { id: conv.contactId }, data: contactData });
  await prisma.conversation.update({
    where: { id: conv.id },
    data: { aiState: out.state as unknown as Prisma.InputJsonValue, status: "WITH_AI", unreadCount: 0 },
  });
  if (out.handoff) await completeQualification(conv.id, out.handoff);
  emitWorkspace(conv.workspaceId, "conversation:updated", { conversationId: conv.id });
  return out;
}

/** Finaliza a qualificação: dossiê na ficha, mudança de etapa e distribuição. */
export async function completeQualification(conversationId: string, reason: "COMPLETED" | "REQUESTED" | "TIMEOUT") {
  const conv = await prisma.conversation.findUniqueOrThrow({ where: { id: conversationId }, include: { contact: true, messages: { orderBy: { createdAt: "asc" }, take: 80 } } });
  const cfg = await loadAiConfig(conv.workspaceId);
  if (!cfg) return;
  const state = { answered: {}, skipped: [], attempts: {}, collected: {}, ...(conv.aiState as Partial<TeoState>) } as TeoState;
  state.step = reason === "COMPLETED" ? "DONE" : "HANDOFF";
  state.handoffReason = reason;
  state.finishedAt = state.finishedAt ?? new Date().toISOString();

  let summary = buildSummary(conv.contact, state, cfg.questions, cfg.assistantName);
  if (llmAvailable()) {
    const transcript = conv.messages.map((m) => `${m.senderType === "CONTACT" ? "Cliente" : "Téo"}: ${m.content}`).join("\n");
    summary = await enrichSummary(summary, transcript);
  }

  const stageData: Prisma.ContactUpdateInput = {};
  if (cfg.qualifiedStageId && conv.contact.stageId !== cfg.qualifiedStageId) {
    const stage = await prisma.stage.findUnique({ where: { id: cfg.qualifiedStageId } });
    if (stage) {
      stageData.stage = { connect: { id: stage.id } };
      stageData.pipeline = { connect: { id: stage.pipelineId } };
      stageData.stageChangedAt = new Date();
      await logActivity({ workspaceId: conv.workspaceId, contactId: conv.contactId, type: "STAGE_CHANGE", title: `Etapa alterada para ${stage.name} pelo ${cfg.assistantName}` });
    }
  }
  await prisma.contact.update({ where: { id: conv.contactId }, data: { aiQualificationSummary: summary, aiQualifiedAt: new Date(), ...stageData } });
  await prisma.conversation.update({
    where: { id: conv.id },
    data: { aiActive: false, status: "NEEDS_REPLY", aiState: state as unknown as Prisma.InputJsonValue },
  });
  await logActivity({
    workspaceId: conv.workspaceId,
    contactId: conv.contactId,
    type: "AI_QUALIFICATION",
    title: reason === "REQUESTED" ? `${cfg.assistantName} transferiu o lead a pedido do cliente` : reason === "TIMEOUT" ? `${cfg.assistantName} transferiu o lead por inatividade (${cfg.inactivityTimeoutHours}h)` : `${cfg.assistantName} concluiu a qualificação`,
    body: summary,
  });

  if (!conv.contact.assignedToId) {
    let userId: string | null = null;
    if (cfg.distributionMode === "ROULETTE") userId = (await pickRouletteUser(conv.workspaceId))?.id ?? null;
    else if (cfg.distributionMode === "FIXED_USER") userId = cfg.fixedUserId;
    if (userId) {
      await assignContact({
        workspaceId: conv.workspaceId,
        contactId: conv.contactId,
        userId,
        via: cfg.distributionMode === "ROULETTE" ? "ROULETTE" : "FIXED_USER",
        summary,
        notifyWhatsApp: cfg.notifyBrokerOnWhatsApp,
      });
    } else {
      await notifyManagers(conv.workspaceId, `Lead qualificado aguardando distribuição: ${conv.contact.name ?? conv.contact.phone}`, summary.split("\n").slice(0, 3).join(" · "), `/atendimento?contato=${conv.contactId}`);
    }
  } else {
    await assignContact({ workspaceId: conv.workspaceId, contactId: conv.contactId, userId: conv.contact.assignedToId, via: "AI", summary, notifyWhatsApp: cfg.notifyBrokerOnWhatsApp });
  }
  emitWorkspace(conv.workspaceId, "conversation:updated", { conversationId: conv.id });
}

/** Transfere leads que pararam de responder além do timeout configurado. */
export async function processAiTimeouts() {
  const configs = await prisma.aiAssistantConfig.findMany({ where: { isActive: true } });
  let count = 0;
  for (const cfg of configs) {
    const limit = new Date(Date.now() - cfg.inactivityTimeoutHours * 3600000);
    const convs = await prisma.conversation.findMany({
      where: { workspaceId: cfg.workspaceId, aiActive: true, lastContactMessageAt: { lt: limit } },
      select: { id: true, aiState: true },
    });
    for (const c of convs) {
      const st = c.aiState as { step?: string };
      if (st.step === "QUALIFYING") {
        await completeQualification(c.id, "TIMEOUT");
        count++;
      }
    }
  }
  return count;
}
