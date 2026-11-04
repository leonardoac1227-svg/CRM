// Regras de pontuação do lead (puras: usadas no servidor, no dossiê, e na interface)
import { toNumber } from "./utils";

export type ScoreContact = {
  monthlyIncome?: unknown;
  downPaymentAvailable?: unknown;
  hasProperty?: boolean | null;
  employmentType?: string | null;
  employmentYears?: string | null;
  buyingAlone?: string | null;
  interest?: string | null;
  neighborhood?: string | null;
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

export function qualificationScore(c: ScoreContact): { score: number; label: "Quente" | "Morno" | "Frio" } {
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

