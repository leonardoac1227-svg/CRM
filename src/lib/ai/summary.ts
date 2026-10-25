// Dossiê estruturado de qualificação (gravado em Contact.aiQualificationSummary)
import { EMPLOYMENT_LABELS, ORIGIN_LABELS } from "../constants";
import { formatBRL, toNumber } from "../utils";
import type { TeoState } from "./teo-engine";
import { llmText } from "./llm";

export type SummaryContact = {
  name?: string | null;
  phone: string;
  origin: string;
  seoLandingPage?: string | null;
  seoKeyword?: string | null;
  trackingCode?: string | null;
  monthlyIncome?: unknown;
  downPaymentAvailable?: unknown;
  fgtsBalance?: unknown;
  hasProperty?: boolean | null;
  employmentType?: string | null;
  employmentYears?: string | null;
  buyingAlone?: string | null;
  interest?: string | null;
  neighborhood?: string | null;
  dealValue?: unknown;
};

/** Faixas aproximadas do Minha Casa Minha Vida (renda bruta familiar mensal). */
export function mcmvBand(income: number): string | null {
  if (!income) return null;
  if (income <= 2850) return "Faixa 1 (até R$ 2.850)";
  if (income <= 4700) return "Faixa 2 (até R$ 4.700)";
  if (income <= 8600) return "Faixa 3 (até R$ 8.600)";
  if (income <= 12000) return "Faixa 4 (até R$ 12.000)";
  return "Acima do MCMV (SBPE)";
}

/** Estimativa simples de poder de compra: parcela ≤ 30% da renda, 360 meses, ~0,8% a.m. + entrada. */
export function estimatePurchasingPower(income: number, downPayment: number, fgts: number) {
  if (!income) return null;
  const pmt = income * 0.3;
  const i = 0.008;
  const n = 360;
  const financed = (pmt * (1 - Math.pow(1 + i, -n))) / i;
  return Math.round((financed + downPayment + fgts) / 1000) * 1000;
}

export function qualificationScore(c: SummaryContact): { score: number; label: "Quente" | "Morno" | "Frio" } {
  let s = 0;
  const income = toNumber(c.monthlyIncome);
  if (income) s += 30;
  if (c.employmentType) s += 15;
  if (toNumber(c.downPaymentAvailable) > 0) s += 20;
  if (c.hasProperty === false) s += 10;
  if (c.employmentYears?.startsWith("Sim")) s += 10;
  if (c.buyingAlone) s += 5;
  if (c.interest || c.neighborhood) s += 10;
  return { score: Math.min(100, s), label: s >= 70 ? "Quente" : s >= 40 ? "Morno" : "Frio" };
}

export function buildSummary(c: SummaryContact, st: TeoState, questions: { id: string; questionText: string }[], assistantName: string): string {
  const income = toNumber(c.monthlyIncome);
  const down = toNumber(c.downPaymentAvailable);
  const fgts = toNumber(c.fgtsBalance);
  const power = estimatePurchasingPower(income, down, fgts);
  const band = mcmvBand(income);
  const { score, label } = qualificationScore(c);
  const lines: string[] = [];
  lines.push(`🤖 Relatório de qualificação — ${assistantName}`);
  lines.push(`Temperatura: ${label} (${score}/100)`);
  lines.push("");
  lines.push("PERFIL");
  if (c.employmentType) lines.push(`• Trabalho: ${EMPLOYMENT_LABELS[c.employmentType] ?? c.employmentType}`);
  if (c.employmentYears) lines.push(`• 3+ anos de carteira: ${c.employmentYears}`);
  if (income) lines.push(`• Renda familiar: ${formatBRL(income)}${band ? ` — ${band}` : ""}`);
  if (c.hasProperty !== null && c.hasProperty !== undefined) lines.push(`• Imóvel no nome: ${c.hasProperty ? "Sim" : "Não"}`);
  if (c.buyingAlone) lines.push(`• Compra: ${c.buyingAlone}`);
  lines.push("");
  lines.push("FINANCEIRO");
  lines.push(`• Entrada disponível: ${c.downPaymentAvailable !== null && c.downPaymentAvailable !== undefined ? formatBRL(down) : "não informada"}`);
  if (fgts) lines.push(`• FGTS: ${formatBRL(fgts)}`);
  if (toNumber(c.dealValue)) lines.push(`• Orçamento informado: ${formatBRL(c.dealValue)}`);
  if (power) lines.push(`• Poder de compra estimado: ~${formatBRL(power)}`);
  if (c.interest || c.neighborhood) {
    lines.push("");
    lines.push("INTERESSE");
    if (c.interest) lines.push(`• ${c.interest}`);
    if (c.neighborhood) lines.push(`• Região/bairro: ${c.neighborhood}`);
  }
  const answeredFree = questions.filter((q) => st.answered[q.id]).map((q) => `• ${q.questionText} → ${st.answered[q.id]}`);
  if (answeredFree.length) {
    lines.push("");
    lines.push("RESPOSTAS");
    lines.push(...answeredFree);
  }
  const skipped = questions.filter((q) => st.skipped.includes(q.id));
  if (skipped.length) {
    lines.push("");
    lines.push(`Não respondidas: ${skipped.map((q) => q.questionText).join(" | ")}`);
  }
  lines.push("");
  lines.push(`ORIGEM: ${ORIGIN_LABELS[c.origin] ?? c.origin}${c.seoLandingPage ? ` — página ${c.seoLandingPage}` : ""}${c.seoKeyword ? ` — palavra-chave "${c.seoKeyword}"` : ""}${c.trackingCode ? ` (${c.trackingCode})` : ""}`);
  lines.push(
    `Encerramento: ${st.handoffReason === "REQUESTED" ? "cliente pediu para falar com um corretor" : st.handoffReason === "TIMEOUT" ? "cliente parou de responder (timeout)" : "qualificação concluída"}`,
  );
  return lines.join("\n");
}

/** Versão com LLM (opcional): acrescenta uma recomendação de próxima ação ao dossiê. */
export async function enrichSummary(summary: string, transcript: string): Promise<string> {
  const tip = await llmText({
    system: "Você é um gerente comercial imobiliário. Em no máximo 2 frases, recomende a próxima ação do corretor para este lead. Seja específico e prático.",
    messages: [{ role: "user", content: `${summary}\n\nConversa:\n${transcript.slice(-3000)}` }],
    maxTokens: 160,
  });
  return tip ? `${summary}\n\n💡 Próximo passo sugerido: ${tip.trim()}` : summary;
}
