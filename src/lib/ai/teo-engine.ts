// =============================================================================
//  Motor de qualificação do Téo ✨
//  - Função pura (sem banco): usada no atendimento real e no simulador "Testar conversa".
//  - Modo LLM (OpenAI/Gemini com Structured Outputs) + modo determinístico (regras pt-BR).
//  - Regras de obrigatoriedade: "Se der" (segue adiante se o cliente pular/mudar de assunto)
//    vs "Obrigatória" (insiste educadamente até coletar, no máx. MAX_ATTEMPTS vezes).
// =============================================================================
import { formatBRL } from "../utils";
import {
  extractForField,
  extractOpportunistic,
  looksLikeQuestion,
  norm,
  wantsCatalog,
  wantsHuman,
  type ExtractedValue,
} from "./extract";
import { llmAvailable, llmJson, type ChatMsg } from "./llm";

export const MAX_ATTEMPTS = 3;

export type EngineQuestion = {
  id: string;
  order: number;
  questionText: string;
  requirementMode: "SE_DER" | "OBRIGATORIA";
  targetField: string | null;
};

export type EngineFaq = { id: string; questionTitle: string; answerText: string; keywords: string[]; isEnabled: boolean };

export type EngineConfig = {
  assistantName: string;
  roleTitle: string;
  tone: "INFORMAL" | "NO_MEIO" | "FORMAL";
  emojiLevel: "NENHUM" | "POUCOS" | "MUITOS";
  messageLength: "CURTAS_UMA_A_UMA" | "MEDIAS" | "LONGAS";
  focus: "VENDAS" | "LOCACAO" | "AMBOS";
  preset: string;
  regionCity?: string | null;
  initialGreeting: string;
  qualificationObjective?: string | null;
  customPromptContext?: string | null;
  handoffMessage: string;
  enableCatalogSend: boolean;
  questions: EngineQuestion[];
  faqs: EngineFaq[];
};

export type EngineCatalogItem = { code: string; title: string; price: number | null; neighborhood: string | null; bedrooms: number | null; category: string };

export type TeoState = {
  step?: "QUALIFYING" | "DONE" | "HANDOFF";
  currentQuestionId?: string | null;
  answered: Record<string, string>;
  skipped: string[];
  attempts: Record<string, number>;
  collected: Record<string, ExtractedValue>;
  lastBotAt?: string;
  finishedAt?: string;
  handoffReason?: "REQUESTED" | "COMPLETED" | "TIMEOUT";
};

export type EngineInput = {
  config: EngineConfig;
  companyName: string;
  contactName?: string | null;
  state: Partial<TeoState> | null;
  history: { from: "contact" | "assistant" | "agent"; text: string }[];
  incoming: string | null; // null = primeira abordagem (ex.: lead novo vindo de formulário)
  catalog?: EngineCatalogItem[];
  forceRules?: boolean;
};

export type EngineOutput = {
  replies: string[];
  state: TeoState;
  contactPatch: Record<string, ExtractedValue>;
  handoff: null | "REQUESTED" | "COMPLETED";
  usedFaq: string | null;
  recommended: EngineCatalogItem[];
  mode: "llm" | "rules";
};

// ---------------------------------------------------------------------------
// Estilo (tom, emojis, tamanho)
// ---------------------------------------------------------------------------

const ACKS: Record<EngineConfig["tone"], string[]> = {
  INFORMAL: ["Show!", "Massa!", "Beleza!", "Top!", "Fechou!"],
  NO_MEIO: ["Perfeito!", "Ótimo!", "Entendi!", "Certo!", "Legal!"],
  FORMAL: ["Perfeito.", "Muito obrigado.", "Compreendo.", "Certo.", "Agradeço a informação."],
};
const EMOJIS = ["😊", "🏡", "✨", "👍", "🙌"];

function emoji(cfg: EngineConfig, i: number, force = false) {
  if (cfg.emojiLevel === "NENHUM") return "";
  if (cfg.emojiLevel === "POUCOS" && !force) return "";
  return " " + EMOJIS[i % EMOJIS.length];
}

function ack(cfg: EngineConfig, i: number) {
  const list = ACKS[cfg.tone];
  return list[i % list.length] + emoji(cfg, i);
}

function stripEmojis(s: string) {
  return s.replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]️?/gu, "").replace(/\s{2,}/g, " ").trim();
}

function pack(cfg: EngineConfig, parts: string[]): string[] {
  const clean = parts.map((p) => (cfg.emojiLevel === "NENHUM" ? stripEmojis(p) : p)).filter((p) => p.trim().length > 0);
  if (cfg.messageLength === "CURTAS_UMA_A_UMA") return clean;
  if (cfg.messageLength === "MEDIAS") {
    // agrupa de 2 em 2
    const out: string[] = [];
    for (let i = 0; i < clean.length; i += 2) out.push(clean.slice(i, i + 2).join(" "));
    return out;
  }
  return clean.length ? [clean.join(" ")] : [];
}

export function renderGreeting(cfg: EngineConfig, companyName: string, contactName?: string | null) {
  const first = (contactName || "").trim().split(/\s+/)[0] || "";
  return cfg.initialGreeting
    .replace(/\{\{\s*nome_assistente\s*\}\}/g, cfg.assistantName)
    .replace(/\{\{\s*nome_empresa\s*\}\}/g, companyName)
    .replace(/\{\{\s*cidade\s*\}\}/g, cfg.regionCity || "")
    .replace(/[ \t]*\{\{\s*nome_cliente\s*\}\}/g, first ? ` ${first}` : "")
    .replace(/\s+([,!?.])/g, "$1");
}

function intro(cfg: EngineConfig) {
  if (cfg.tone === "FORMAL") return "Vou fazer algumas perguntas rápidas para entender o que você procura e direcionar ao especialista ideal.";
  if (cfg.tone === "INFORMAL") return "Vou te fazer umas perguntinhas rapidinhas pra entender o que você procura e já te passar pro corretor certo!";
  return "Vou te fazer algumas perguntas rápidas pra entender o que você procura e te encaminhar para o corretor ideal.";
}

function insist(cfg: EngineConfig, q: EngineQuestion, attempt: number) {
  const lead =
    cfg.tone === "FORMAL"
      ? ["Compreendo. Para indicar as melhores opções, preciso apenas desta informação:", "Desculpe insistir, mas esta informação é importante para a análise:"]
      : cfg.tone === "INFORMAL"
        ? ["Entendi! Só preciso dessa info pra te mostrar as melhores opções:", "Foi mal insistir, mas essa é importante:"]
        : ["Entendo! Só preciso dessa informação pra te indicar as melhores opções:", "Desculpa insistir, mas essa informação é importante pra sua análise:"];
  return `${lead[attempt % lead.length]} ${q.questionText}`;
}

function formatValue(field: string | null, v: ExtractedValue): string {
  if (typeof v === "boolean") return v ? "Sim" : "Não";
  if (typeof v === "number" && field && ["monthlyIncome", "downPaymentAvailable", "fgtsBalance", "dealValue"].includes(field)) return formatBRL(v);
  if (field === "employmentType") return ({ CLT: "CLT", AUTONOMO: "Autônomo", EMPRESARIO: "Empresário", APOSENTADO: "Aposentado" } as Record<string, string>)[String(v)] ?? String(v);
  return String(v);
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function freshState(s: Partial<TeoState> | null): TeoState {
  return {
    step: s?.step,
    currentQuestionId: s?.currentQuestionId ?? null,
    answered: { ...(s?.answered ?? {}) },
    skipped: [...(s?.skipped ?? [])],
    attempts: { ...(s?.attempts ?? {}) },
    collected: { ...(s?.collected ?? {}) },
    lastBotAt: s?.lastBotAt,
    finishedAt: s?.finishedAt,
    handoffReason: s?.handoffReason,
  };
}

function sortedQuestions(cfg: EngineConfig) {
  return [...cfg.questions].sort((a, b) => a.order - b.order).slice(0, 10);
}

function nextQuestion(cfg: EngineConfig, st: TeoState): EngineQuestion | null {
  return (
    sortedQuestions(cfg).find(
      (q) => !(q.id in st.answered) && !st.skipped.includes(q.id) && !(q.targetField && q.targetField in st.collected),
    ) ?? null
  );
}

export function matchFaq(cfg: EngineConfig, text: string): EngineFaq | null {
  const t = norm(text);
  for (const f of cfg.faqs) {
    if (!f.isEnabled) continue;
    const kws = f.keywords.length ? f.keywords : norm(f.questionTitle).split(/\s+/).filter((w) => w.length > 4);
    if (kws.some((k) => t.includes(norm(k)))) return f;
  }
  return null;
}

function recommend(catalog: EngineCatalogItem[] | undefined, st: TeoState): EngineCatalogItem[] {
  if (!catalog?.length) return [];
  const budget = Number(st.collected.dealValue || 0) || (Number(st.collected.monthlyIncome || 0) ? Number(st.collected.monthlyIncome) * 30 * 0.3 + Number(st.collected.downPaymentAvailable || 0) : 0);
  const hood = st.collected.neighborhood ? norm(String(st.collected.neighborhood)) : null;
  return [...catalog]
    .map((c) => {
      let score = 0;
      if (budget && c.price) score += c.price <= budget * 1.1 ? 2 : -2;
      if (hood && c.neighborhood && norm(c.neighborhood).includes(hood)) score += 3;
      return { c, score };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
    .map((x) => x.c);
}

function catalogText(cfg: EngineConfig, items: EngineCatalogItem[]) {
  if (!items.length) return null;
  const lines = items.map((i) => `• ${i.title} (${i.code})${i.neighborhood ? ` – ${i.neighborhood}` : ""}${i.price ? ` – ${formatBRL(i.price)}` : ""}${i.bedrooms ? ` – ${i.bedrooms} quartos` : ""}`);
  return `${cfg.tone === "FORMAL" ? "Separei algumas opções que podem lhe interessar:" : "Separei algumas opções que podem te interessar:"}\n${lines.join("\n")}`;
}

function finishParts(cfg: EngineConfig, st: TeoState, i: number) {
  const parts: string[] = [];
  parts.push(cfg.tone === "FORMAL" ? "Muito obrigado pelas informações!" : `${ack(cfg, i)} Obrigado pelas informações${emoji(cfg, i + 1, true)}`);
  parts.push(cfg.handoffMessage);
  st.step = "DONE";
  st.handoffReason = "COMPLETED";
  st.finishedAt = new Date().toISOString();
  st.currentQuestionId = null;
  return parts;
}

// ---------------------------------------------------------------------------
// Motor determinístico
// ---------------------------------------------------------------------------

function runRules(input: EngineInput): EngineOutput {
  const cfg = input.config;
  const st = freshState(input.state);
  const parts: string[] = [];
  const contactPatch: Record<string, ExtractedValue> = {};
  let usedFaq: string | null = null;
  let recommended: EngineCatalogItem[] = [];
  const turn = Object.keys(st.answered).length + st.skipped.length;

  if (st.step === "DONE" || st.step === "HANDOFF") {
    return { replies: [], state: st, contactPatch, handoff: null, usedFaq, recommended, mode: "rules" };
  }

  // 1ª mensagem: saudação + introdução + 1ª pergunta
  if (!st.step) {
    st.step = "QUALIFYING";
    parts.push(renderGreeting(cfg, input.companyName, input.contactName) + emoji(cfg, 0, true));
    if (input.incoming) {
      if (wantsHuman(input.incoming)) {
        parts.push(cfg.handoffMessage);
        st.step = "HANDOFF";
        st.handoffReason = "REQUESTED";
        return { replies: pack(cfg, parts), state: st, contactPatch, handoff: "REQUESTED", usedFaq, recommended, mode: "rules" };
      }
      const faq = matchFaq(cfg, input.incoming);
      if (faq) {
        parts.push(faq.answerText);
        usedFaq = faq.questionTitle;
      }
      Object.assign(st.collected, extractOpportunistic(input.incoming));
    }
    const q = nextQuestion(cfg, st);
    if (q) {
      parts.push(intro(cfg));
      parts.push(q.questionText);
      st.currentQuestionId = q.id;
    } else {
      parts.push(...finishParts(cfg, st, turn));
      Object.assign(contactPatch, st.collected);
      return { replies: pack(cfg, parts), state: st, contactPatch, handoff: "COMPLETED", usedFaq, recommended, mode: "rules" };
    }
    Object.assign(contactPatch, st.collected);
    st.lastBotAt = new Date().toISOString();
    return { replies: pack(cfg, parts), state: st, contactPatch, handoff: null, usedFaq, recommended, mode: "rules" };
  }

  const text = (input.incoming ?? "").trim();

  // Transbordo imediato a pedido do cliente
  if (text && wantsHuman(text)) {
    st.step = "HANDOFF";
    st.handoffReason = "REQUESTED";
    st.finishedAt = new Date().toISOString();
    parts.push(cfg.tone === "FORMAL" ? "Claro, sem problemas." : "Claro! Sem problemas.");
    parts.push(cfg.handoffMessage);
    return { replies: pack(cfg, parts), state: st, contactPatch: st.collected, handoff: "REQUESTED", usedFaq, recommended, mode: "rules" };
  }

  const current = sortedQuestions(cfg).find((q) => q.id === st.currentQuestionId) ?? null;
  const faq = text ? matchFaq(cfg, text) : null;
  const opportunistic = text ? extractOpportunistic(text) : {};

  // Resposta à pergunta atual
  let answeredCurrent = false;
  if (current && text) {
    const isQ = looksLikeQuestion(text) || !!faq;
    const value = isQ && !current.targetField ? null : extractForField(current.targetField, text);
    if (value !== null && value !== undefined && !(isQ && typeof value === "string")) {
      st.answered[current.id] = formatValue(current.targetField, value);
      if (current.targetField) st.collected[current.targetField] = value;
      answeredCurrent = true;
    }
  }
  for (const [k, v] of Object.entries(opportunistic)) if (!(k in st.collected)) st.collected[k] = v;

  if (faq) {
    parts.push(faq.answerText);
    usedFaq = faq.questionTitle;
  }

  if (cfg.enableCatalogSend && text && wantsCatalog(text) && input.catalog?.length) {
    recommended = recommend(input.catalog, st);
    const t = catalogText(cfg, recommended);
    if (t) parts.push(t);
  }

  if (current && !answeredCurrent) {
    const attempts = (st.attempts[current.id] ?? 0) + 1;
    st.attempts[current.id] = attempts;
    if (current.requirementMode === "OBRIGATORIA" && attempts < MAX_ATTEMPTS) {
      // Obrigatória: insiste educadamente (após responder a dúvida, se houver)
      parts.push(faq ? `E voltando: ${current.questionText}` : insist(cfg, current, attempts - 1));
      Object.assign(contactPatch, st.collected);
      st.lastBotAt = new Date().toISOString();
      return { replies: pack(cfg, parts), state: st, contactPatch, handoff: null, usedFaq, recommended, mode: "rules" };
    }
    // "Se der" (ou obrigatória esgotada): não trava a conversa, segue adiante
    st.skipped.push(current.id);
    if (!faq && current.requirementMode === "SE_DER" && !looksLikeQuestion(text)) {
      // o cliente respondeu algo que não conseguimos estruturar: guarda como texto livre
      st.answered[current.id] = text.slice(0, 160);
      st.skipped = st.skipped.filter((id) => id !== current.id);
    }
  }

  const next = nextQuestion(cfg, st);
  if (next) {
    if (!faq) parts.unshift(ack(cfg, turn));
    parts.push(next.questionText);
    st.currentQuestionId = next.id;
  } else {
    parts.push(...finishParts(cfg, st, turn));
  }

  Object.assign(contactPatch, st.collected);
  st.lastBotAt = new Date().toISOString();
  return {
    replies: pack(cfg, parts),
    state: st,
    contactPatch,
    handoff: st.step === "DONE" ? "COMPLETED" : null,
    usedFaq,
    recommended,
    mode: "rules",
  };
}

// ---------------------------------------------------------------------------
// Motor LLM (Structured Outputs)
// ---------------------------------------------------------------------------

const LLM_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["replies", "extracted", "answeredQuestionIds", "skippedQuestionIds", "currentQuestionId", "wantsHuman", "faqUsed"],
  properties: {
    replies: { type: "array", items: { type: "string" }, description: "Mensagens a enviar ao cliente, na ordem" },
    extracted: {
      type: "object",
      additionalProperties: false,
      required: ["employmentType", "monthlyIncome", "hasProperty", "employmentYears", "downPaymentAvailable", "buyingAlone", "fgtsBalance", "neighborhood", "interest", "profession", "maritalStatus", "dealValue"],
      properties: {
        employmentType: { type: ["string", "null"], enum: ["CLT", "AUTONOMO", "EMPRESARIO", "APOSENTADO", null] },
        monthlyIncome: { type: ["number", "null"] },
        hasProperty: { type: ["boolean", "null"] },
        employmentYears: { type: ["string", "null"] },
        downPaymentAvailable: { type: ["number", "null"] },
        buyingAlone: { type: ["string", "null"] },
        fgtsBalance: { type: ["number", "null"] },
        neighborhood: { type: ["string", "null"] },
        interest: { type: ["string", "null"] },
        profession: { type: ["string", "null"] },
        maritalStatus: { type: ["string", "null"] },
        dealValue: { type: ["number", "null"] },
      },
    },
    answeredQuestionIds: { type: "array", items: { type: "string" } },
    skippedQuestionIds: { type: "array", items: { type: "string" } },
    currentQuestionId: { type: ["string", "null"] },
    wantsHuman: { type: "boolean" },
    faqUsed: { type: ["string", "null"] },
  },
} as const;

type LlmOut = {
  replies: string[];
  extracted: Record<string, ExtractedValue | null>;
  answeredQuestionIds: string[];
  skippedQuestionIds: string[];
  currentQuestionId: string | null;
  wantsHuman: boolean;
  faqUsed: string | null;
};

export function buildSystemPrompt(input: EngineInput, st: TeoState) {
  const c = input.config;
  const tone = { INFORMAL: "informal, leve e próximo", NO_MEIO: "cordial e natural, nem formal nem informal demais", FORMAL: "formal e respeitoso (use 'o senhor/a senhora' quando apropriado)" }[c.tone];
  const emojis = { NENHUM: "Não use emojis.", POUCOS: "Use no máximo 1 emoji a cada 3 mensagens.", MUITOS: "Use emojis com frequência, de forma natural." }[c.emojiLevel];
  const len = { CURTAS_UMA_A_UMA: "Mensagens curtas, como no WhatsApp, quebradas em várias (1 ideia por mensagem, máx. 3).", MEDIAS: "Mensagens médias (1 a 2 por resposta).", LONGAS: "Uma única mensagem mais completa por resposta." }[c.messageLength];
  const qs = sortedQuestions(c)
    .map((q) => {
      const status = q.id in st.answered ? `RESPONDIDA: ${st.answered[q.id]}` : st.skipped.includes(q.id) ? "PULADA" : "PENDENTE";
      return `- id=${q.id} | ${q.requirementMode === "OBRIGATORIA" ? "OBRIGATÓRIA (insista educadamente até obter, máx. 3 tentativas)" : "SE DER (se o cliente pular ou mudar de assunto, siga adiante sem travar)"} | campo=${q.targetField ?? "texto livre"} | "${q.questionText}" | ${status} | tentativas=${st.attempts[q.id] ?? 0}`;
    })
    .join("\n");
  const faqs = c.faqs.filter((f) => f.isEnabled).map((f) => `- "${f.questionTitle}": ${f.answerText}`).join("\n");
  const catalog = (input.catalog ?? []).slice(0, 15).map((i) => `- ${i.code}: ${i.title}, ${i.neighborhood ?? ""}, ${i.price ? formatBRL(i.price) : "consulte"}, ${i.bedrooms ?? "?"} quartos`).join("\n");
  return `Você é ${c.assistantName}, ${c.roleTitle} da empresa "${input.companyName}"${c.regionCity ? `, que atua em ${c.regionCity}` : ""}. Você atende leads no WhatsApp.
Foco: ${c.focus}. Padrão de atendimento: ${c.preset}. Objetivo da qualificação: ${c.qualificationObjective ?? "COMPRA"}.
Jeito de conversar: ${tone}. ${emojis} ${len}
Faça UMA pergunta de qualificação por vez, na ordem, reconhecendo a resposta anterior brevemente. Nunca invente preços, imóveis ou condições. Não prometa aprovação de crédito.
Se o cliente pedir para falar com corretor/humano, marque wantsHuman=true e responda com: "${c.handoffMessage}".
Quando todas as perguntas estiverem respondidas ou puladas, agradeça e envie: "${c.handoffMessage}" (currentQuestionId = null).
${c.customPromptContext ? `Instruções extras da empresa: ${c.customPromptContext}\n` : ""}
PERGUNTAS DE QUALIFICAÇÃO:
${qs || "(nenhuma)"}

DÚVIDAS FREQUENTES (use estas respostas quando o cliente perguntar):
${faqs || "(nenhuma)"}
${c.enableCatalogSend && catalog ? `\nCATÁLOGO (pode recomendar até 3 quando o cliente pedir opções):\n${catalog}` : ""}

Em "extracted" preencha apenas dados que o cliente informou explicitamente (valores em reais como número); o resto null.`;
}

async function runLlm(input: EngineInput): Promise<EngineOutput | null> {
  const st = freshState(input.state);
  if (st.step === "DONE" || st.step === "HANDOFF") return null;
  const firstTurn = !st.step;
  const messages: ChatMsg[] = input.history.slice(-20).map((h) => ({ role: h.from === "contact" ? "user" : "assistant", content: h.text }));
  if (firstTurn) {
    messages.push({
      role: "user",
      content: input.incoming
        ? `[Primeira mensagem do cliente — comece com a saudação: "${renderGreeting(input.config, input.companyName, input.contactName)}"] ${input.incoming}`
        : `[Lead novo sem mensagem. Inicie a conversa com a saudação: "${renderGreeting(input.config, input.companyName, input.contactName)}" e a primeira pergunta]`,
    });
  } else if (input.incoming) {
    messages.push({ role: "user", content: input.incoming });
  }
  const out = await llmJson<LlmOut>({ system: buildSystemPrompt(input, st), messages, schemaName: "teo_turn", schema: LLM_SCHEMA as unknown as Record<string, unknown> });
  if (!out || !Array.isArray(out.replies) || !out.replies.length) return null;

  st.step = "QUALIFYING";
  const qById = new Map(input.config.questions.map((q) => [q.id, q]));
  const contactPatch: Record<string, ExtractedValue> = {};
  for (const [k, v] of Object.entries(out.extracted ?? {})) if (v !== null && v !== undefined && v !== "") st.collected[k] = v;
  for (const id of out.answeredQuestionIds ?? []) {
    const q = qById.get(id);
    if (!q) continue;
    st.answered[id] = q.targetField && q.targetField in st.collected ? formatValue(q.targetField, st.collected[q.targetField]) : (input.incoming ?? "").slice(0, 160);
  }
  for (const id of out.skippedQuestionIds ?? []) {
    const q = qById.get(id);
    // Garantia de regra: perguntas obrigatórias só são puladas após MAX_ATTEMPTS
    if (q && !(id in st.answered) && !st.skipped.includes(id) && (q.requirementMode === "SE_DER" || (st.attempts[id] ?? 0) + 1 >= MAX_ATTEMPTS)) st.skipped.push(id);
  }
  if (st.currentQuestionId && !(st.currentQuestionId in st.answered) && !st.skipped.includes(st.currentQuestionId))
    st.attempts[st.currentQuestionId] = (st.attempts[st.currentQuestionId] ?? 0) + 1;
  st.currentQuestionId = out.currentQuestionId && qById.has(out.currentQuestionId) ? out.currentQuestionId : nextQuestion(input.config, st)?.id ?? null;
  Object.assign(contactPatch, st.collected);

  let handoff: EngineOutput["handoff"] = null;
  if (out.wantsHuman || (input.incoming && wantsHuman(input.incoming))) {
    st.step = "HANDOFF";
    st.handoffReason = "REQUESTED";
    st.finishedAt = new Date().toISOString();
    handoff = "REQUESTED";
  } else if (!nextQuestion(input.config, st)) {
    st.step = "DONE";
    st.handoffReason = "COMPLETED";
    st.finishedAt = new Date().toISOString();
    st.currentQuestionId = null;
    handoff = "COMPLETED";
    const joined = out.replies.join(" ");
    if (!joined.includes(input.config.handoffMessage.slice(0, 20))) out.replies.push(input.config.handoffMessage);
  }
  st.lastBotAt = new Date().toISOString();
  const recommended = input.config.enableCatalogSend && input.incoming && wantsCatalog(input.incoming) ? recommend(input.catalog, st) : [];
  return { replies: out.replies.slice(0, 4), state: st, contactPatch, handoff, usedFaq: out.faqUsed, recommended, mode: "llm" };
}

// ---------------------------------------------------------------------------

export async function runTeo(input: EngineInput): Promise<EngineOutput> {
  if (!input.forceRules && llmAvailable()) {
    const r = await runLlm(input);
    if (r) return r;
  }
  return runRules(input);
}

export function emptyState(): TeoState {
  return freshState(null);
}
