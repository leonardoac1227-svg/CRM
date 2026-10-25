import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { body, route } from "@/lib/api";
import { runTeo, type EngineConfig } from "@/lib/ai/teo-engine";
import { buildSummary } from "@/lib/ai/summary";
import { contactDataFromPatch } from "@/lib/services/ai-runner";
import { llmAvailable } from "@/lib/ai/llm";
import { toNumber } from "@/lib/utils";

/**
 * "Testar conversa": roda o motor com a configuração que está na tela (ainda não salva),
 * sem gravar nada no banco. O estado volta para o cliente a cada turno.
 */
const schema = z.object({
  config: z.object({
    assistantName: z.string(),
    roleTitle: z.string(),
    tone: z.enum(["INFORMAL", "NO_MEIO", "FORMAL"]),
    emojiLevel: z.enum(["NENHUM", "POUCOS", "MUITOS"]),
    messageLength: z.enum(["CURTAS_UMA_A_UMA", "MEDIAS", "LONGAS"]),
    focus: z.enum(["VENDAS", "LOCACAO", "AMBOS"]),
    preset: z.string(),
    regionCity: z.string().nullable().optional(),
    initialGreeting: z.string(),
    qualificationObjective: z.string().nullable().optional(),
    customPromptContext: z.string().nullable().optional(),
    handoffMessage: z.string(),
    enableCatalogSend: z.boolean(),
    questions: z.array(z.object({ id: z.string(), order: z.number(), questionText: z.string(), requirementMode: z.enum(["SE_DER", "OBRIGATORIA"]), targetField: z.string().nullable() })),
    faqs: z.array(z.object({ id: z.string(), questionTitle: z.string(), answerText: z.string(), keywords: z.array(z.string()), isEnabled: z.boolean() })),
  }),
  state: z.any().nullable(),
  history: z.array(z.object({ from: z.enum(["contact", "assistant", "agent"]), text: z.string() })),
  incoming: z.string().nullable(),
  mode: z.enum(["auto", "rules"]).default("auto"),
});

export const POST = route(async ({ req, session }) => {
  const d = await body(req, schema);
  const catalog = d.config.enableCatalogSend
    ? (await prisma.catalogItem.findMany({ where: { workspaceId: session.workspace.id, status: "AVAILABLE" }, take: 40 })).map((i) => ({
        code: i.code, title: i.title, price: i.price ? toNumber(i.price) : null, neighborhood: i.neighborhood, bedrooms: i.bedrooms, category: i.category,
      }))
    : [];
  const out = await runTeo({
    config: d.config as EngineConfig,
    companyName: session.workspace.name,
    contactName: "Cliente Teste",
    state: d.state,
    history: d.history,
    incoming: d.incoming,
    catalog,
    forceRules: d.mode === "rules",
  });
  let summary: string | null = null;
  if (out.handoff) {
    const patch = contactDataFromPatch(out.contactPatch) as Record<string, unknown>;
    summary = buildSummary({ phone: "", origin: "SEO_ORGANICO", seoLandingPage: "(simulação)", ...patch } as Parameters<typeof buildSummary>[0], out.state, d.config.questions, d.config.assistantName);
  }
  return { ...out, summary, llm: llmAvailable() };
}, { module: "teo" });
