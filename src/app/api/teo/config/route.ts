import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { body, route } from "@/lib/api";
import { requireManager } from "@/lib/rbac";
import { AI_PRESET_QUESTIONS, DEFAULT_FAQS } from "@/lib/constants";
import { defaultPipelineStage } from "@/lib/services/messaging";

async function ensureConfig(workspaceId: string, assistantName: string) {
  const existing = await prisma.aiAssistantConfig.findUnique({ where: { workspaceId }, include: { questions: { orderBy: { order: "asc" } }, faqs: true } });
  if (existing) return existing;
  const def = await defaultPipelineStage(workspaceId);
  return prisma.aiAssistantConfig.create({
    data: {
      workspaceId,
      assistantName,
      targetPipelineId: def.pipelineId,
      targetStageId: def.stageId,
      questions: { create: AI_PRESET_QUESTIONS.MCMV_ECONOMICO.map((q, i) => ({ ...q, order: i + 1 })) },
      faqs: { create: DEFAULT_FAQS },
    },
    include: { questions: { orderBy: { order: "asc" } }, faqs: true },
  });
}

export const GET = route(async ({ session }) => ensureConfig(session.workspace.id, session.agency.assistantDefaultName), { module: "teo" });

const schema = z.object({
  isActive: z.boolean(),
  preset: z.enum(["MCMV_ECONOMICO", "MEDIO_PADRAO", "ALTO_PADRAO", "LOCACAO", "LANCAMENTO", "TERRENO", "VENDA_E_LOCACAO", "SERVICOS_SEO", "DO_ZERO"]),
  focus: z.enum(["VENDAS", "LOCACAO", "AMBOS"]),
  assistantName: z.string().min(2).max(30),
  roleTitle: z.string().min(2).max(60),
  tone: z.enum(["INFORMAL", "NO_MEIO", "FORMAL"]),
  emojiLevel: z.enum(["NENHUM", "POUCOS", "MUITOS"]),
  messageLength: z.enum(["CURTAS_UMA_A_UMA", "MEDIAS", "LONGAS"]),
  regionCity: z.string().nullable().optional(),
  initialGreeting: z.string().min(2).max(500),
  enableAudioTranscription: z.boolean(),
  enableImageAnalysis: z.boolean(),
  enableCatalogSend: z.boolean(),
  qualificationObjective: z.string(),
  customPromptContext: z.string().max(500).nullable().optional(),
  handoffMessage: z.string().min(2).max(500),
  inactivityTimeoutHours: z.number().int().min(1).max(168),
  targetPipelineId: z.string().nullable().optional(),
  targetStageId: z.string().nullable().optional(),
  qualifiedStageId: z.string().nullable().optional(),
  distributionMode: z.enum(["ROULETTE", "MANAGER_MANUAL", "FIXED_USER"]),
  fixedUserId: z.string().nullable().optional(),
  notifyBrokerOnWhatsApp: z.boolean(),
  questions: z
    .array(z.object({ questionText: z.string().min(3).max(300), requirementMode: z.enum(["SE_DER", "OBRIGATORIA"]), targetField: z.string().nullable() }))
    .max(10, "Máximo de 10 perguntas"),
  faqs: z.array(z.object({ questionTitle: z.string().min(2).max(120), answerText: z.string().min(2).max(1500), keywords: z.array(z.string()).default([]), isEnabled: z.boolean() })).max(30),
});

export const PUT = route(async ({ req, session }) => {
  requireManager(session);
  const d = await body(req, schema);
  const cfg = await ensureConfig(session.workspace.id, session.agency.assistantDefaultName);
  const { questions, faqs, fixedUserId, ...rest } = d;
  await prisma.$transaction([
    prisma.aiAssistantConfig.update({ where: { id: cfg.id }, data: { ...rest, fixedUserId: rest.distributionMode === "FIXED_USER" ? fixedUserId ?? null : null } }),
    prisma.aiQuestion.deleteMany({ where: { configId: cfg.id } }),
    prisma.aiQuestion.createMany({ data: questions.map((q, i) => ({ ...q, order: i + 1, configId: cfg.id })) }),
    prisma.aiFaq.deleteMany({ where: { configId: cfg.id } }),
    prisma.aiFaq.createMany({ data: faqs.map((f) => ({ ...f, configId: cfg.id })) }),
  ]);
  return prisma.aiAssistantConfig.findUnique({ where: { id: cfg.id }, include: { questions: { orderBy: { order: "asc" } }, faqs: true } });
}, { module: "teo" });
