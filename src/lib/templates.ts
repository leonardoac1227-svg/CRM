// Renderização de templates do WhatsApp com variáveis mapeadas e fallback inteligente.
// Compartilhado entre cliente (preview ao vivo) e servidor (envio real).
import { firstName, formatBRL, formatPhone } from "./utils";
import { TEMPLATE_VARIABLES } from "./constants";

export type VarContactLike = {
  name?: string | null;
  phone?: string | null;
  email?: string | null;
  cpfCnpj?: string | null;
  city?: string | null;
  state?: string | null;
  neighborhood?: string | null;
  profession?: string | null;
  monthlyIncome?: number | string | null;
};

export type VarContext = Record<string, string>;

export function buildVarContext(
  contact: VarContactLike | null,
  user?: { name?: string | null } | null,
  workspace?: { name?: string | null } | null,
): VarContext {
  const c = contact ?? {};
  const income = c.monthlyIncome !== null && c.monthlyIncome !== undefined && c.monthlyIncome !== "" ? formatBRL(c.monthlyIncome) : "";
  return {
    "contact.firstName": firstName(c.name),
    "contact.name": c.name?.trim() ?? "",
    "contact.phone": formatPhone(c.phone),
    "contact.email": c.email ?? "",
    "contact.cpfCnpj": c.cpfCnpj ?? "",
    "contact.cityUf": [c.city, c.state].filter(Boolean).join("/"),
    "contact.neighborhood": c.neighborhood ?? "",
    "contact.profession": c.profession ?? "",
    "contact.monthlyIncome": income,
    "user.name": firstName(user?.name),
    "workspace.name": workspace?.name ?? "",
  };
}

export function sampleVarContext(): VarContext {
  return Object.fromEntries(TEMPLATE_VARIABLES.map((v) => [v.key, v.sample]));
}

export function templateVariableNumbers(body: string): number[] {
  const nums = new Set<number>();
  for (const m of body.matchAll(/\{\{(\d+)\}\}/g)) nums.add(Number(m[1]));
  return [...nums].sort((a, b) => a - b);
}

/** Valores para {{1}}, {{2}}… (em ordem) — usados como parâmetros na Cloud API. */
export function resolveTemplateParams(body: string, mappings: Record<string, string>, ctx: VarContext): string[] {
  return templateVariableNumbers(body).map((n) => (ctx[mappings[String(n)] ?? ""] ?? "").trim());
}

/**
 * Substitui as variáveis e, quando um valor está vazio, remove a variável junto com
 * espaços/vírgulas órfãos ("Olá {{1}}, tudo bem?" -> "Olá, tudo bem?").
 */
export function renderTemplate(body: string, mappings: Record<string, string>, ctx: VarContext): string {
  let out = body.replace(/([ \t]*)\{\{(\d+)\}\}/g, (_m, space: string, n: string) => {
    const value = (ctx[mappings[n] ?? ""] ?? "").trim();
    return value ? `${space}${value}` : "";
  });
  out = out
    .replace(/[ \t]+([,!?.;:])/g, "$1")
    .replace(/,\s*([,!?.])/g, "$1")
    .replace(/^[ \t]*[,;:]+[ \t]*/gm, "")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/(^|[.!?]\s+|\n)([a-zà-ú])/g, (_m, p: string, ch: string) => p + ch.toUpperCase());
  return out.trim();
}

export function insertVariable(body: string, mappings: Record<string, string>, key: string) {
  const existing = Object.entries(mappings).find(([, v]) => v === key);
  const n = existing ? Number(existing[0]) : Math.max(0, ...Object.keys(mappings).map(Number), ...templateVariableNumbers(body)) + 1;
  return { token: `{{${n}}}`, mappings: { ...mappings, [String(n)]: key } };
}
