// Extratores determinísticos (pt-BR) usados pelo motor do Téo sem LLM e como validação do LLM.

const WORD_NUMBERS: Record<string, number> = {
  um: 1, uma: 1, dois: 2, duas: 2, tres: 3, três: 3, quatro: 4, cinco: 5, seis: 6, sete: 7, oito: 8, nove: 9, dez: 10,
  onze: 11, doze: 12, quinze: 15, vinte: 20, trinta: 30, quarenta: 40, cinquenta: 50, sessenta: 60, setenta: 70,
  oitenta: 80, noventa: 90, cem: 100, cento: 100, duzentos: 200, trezentos: 300, quatrocentos: 400, quinhentos: 500,
  seiscentos: 600, setecentos: 700, oitocentos: 800, novecentos: 900, meio: 0.5,
};

export function norm(s: string) {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
}

export function isNegative(text: string) {
  return /^(nao|n|nada|nenhum|nenhuma|nunca|zero|nem)\b/.test(norm(text)) || /\b(nao tenho|nao possuo|nada|zerad[oa])\b/.test(norm(text));
}

export function isAffirmative(text: string) {
  return /^(sim|s|tenho|ja|possuo|claro|com certeza|isso|exato|positivo|uhum|aham)\b/.test(norm(text));
}

/** "5 mil", "R$ 3.500,00", "3,5k", "uns quatro mil e quinhentos", "200 mil" -> número */
export function parseMoney(text: string): number | null {
  const t = norm(text).replace(/r\$\s*/g, "");
  // dígitos com milhar/mil/k
  const m = t.match(/(\d{1,3}(?:[.\s]\d{3})+|\d+)(?:,(\d{1,2}))?\s*(mil|k|milhao|milhoes|mi)?\b(?:\s*e\s*(\d{1,3}))?/);
  if (m) {
    let n = Number(m[1].replace(/[.\s]/g, "")) + (m[2] ? Number(`0.${m[2]}`) : 0);
    const unit = m[3];
    if (unit === "mil" || unit === "k") n *= 1000;
    if (unit === "milhao" || unit === "milhoes" || unit === "mi") n *= 1_000_000;
    if (m[4] && unit) n += Number(m[4]) * (Number(m[4]) < 10 ? 100 : 1);
    if (unit && !m[4]) {
      // "4 mil e quinhentos"
      const tail = t.slice((m.index ?? 0) + m[0].length).match(/^\s*e\s+([a-z]+)(?:\s+e\s+([a-z]+))?/);
      if (tail) for (const w of [tail[1], tail[2]]) if (w && w in WORD_NUMBERS && WORD_NUMBERS[w] < 1000) n += WORD_NUMBERS[w];
    }
    if (n > 0) return Math.round(n * 100) / 100;
  }
  // números por extenso ("quatro mil e quinhentos")
  const words = t.split(/[\s,]+/);
  let total = 0;
  let current = 0;
  let found = false;
  for (const w of words) {
    if (w in WORD_NUMBERS) {
      current += WORD_NUMBERS[w];
      found = true;
    } else if (w === "mil" && found) {
      total += (current || 1) * 1000;
      current = 0;
    } else if ((w === "milhao" || w === "milhoes") && found) {
      total += (current || 1) * 1_000_000;
      current = 0;
    }
  }
  total += current;
  if (found && total > 0) return total;
  return null;
}

export function parseEmploymentType(text: string, strict = false): "CLT" | "AUTONOMO" | "EMPRESARIO" | "APOSENTADO" | null {
  const t = norm(text);
  if (/aposentad|pensionist|inss/.test(t)) return "APOSENTADO";
  if (/empresari|sou dono|tenho (uma )?empresa|socio|empreendedor/.test(t)) return "EMPRESARIO";
  if (/autonom|por conta|informal|freela|bico|\bmei\b|uber|vendo |comerciante|liberal/.test(t)) return "AUTONOMO";
  if (/\bclt\b|registrad|concursad|servidor|funcionari[oa] public/.test(t)) return "CLT";
  if (!strict && /carteira|assinad|fichad/.test(t) && !/nao (tenho|trabalho de) carteira/.test(t)) return "CLT";
  return null;
}

export function parseYesNo(text: string): boolean | null {
  if (isNegative(text)) return false;
  if (isAffirmative(text)) return true;
  return null;
}

export function parseEmploymentYears(text: string): string | null {
  const t = norm(text);
  const years = t.match(/(\d{1,2})\s*(anos?|a)\b/);
  const yn = parseYesNo(text);
  if (years) {
    const n = Number(years[1]);
    return `${n >= 3 ? "Sim" : "Não"} (${n} ano${n === 1 ? "" : "s"})`;
  }
  if (/mais de (3|tres)/.test(t)) return "Sim (mais de 3 anos)";
  if (/menos de (3|tres)/.test(t)) return "Não (menos de 3 anos)";
  if (yn === true) return "Sim";
  if (yn === false) return "Não";
  return null;
}

export function parseBuyingAlone(text: string): string | null {
  const t = norm(text);
  if (/sozinh|so eu|apenas eu|somente eu/.test(t)) return "Sozinho(a)";
  if (/espos|marido|conjuge|namorad|noiv|companheir|parceir|mulher/.test(t)) return "Com cônjuge/parceiro(a)";
  if (/\bpai\b|\bmae\b|irma|famil|filh|sogr/.test(t)) return "Com familiar";
  if (/amig|socio|outra pessoa|alguem/.test(t)) return "Com outra pessoa";
  return null;
}

export function parseMaritalStatus(text: string): string | null {
  const t = norm(text);
  if (/uniao estavel|amasiad|junt/.test(t)) return "União estável";
  if (/casad/.test(t)) return "Casado(a)";
  if (/solteir/.test(t)) return "Solteiro(a)";
  if (/divorciad|separad/.test(t)) return "Divorciado(a)";
  if (/viuv/.test(t)) return "Viúvo(a)";
  return null;
}

function freeText(text: string): string | null {
  const v = text.trim().replace(/\s+/g, " ");
  if (v.length < 2 || v.endsWith("?")) return null;
  return v.slice(0, 160);
}

export type ExtractedValue = string | number | boolean;

/** Valor em reais respondido a uma pergunta financeira ("uns 20" = R$ 20 mil; "6 anos" não é dinheiro). */
function moneyAnswer(text: string): number | null {
  const t = norm(text);
  if (/\b(anos?|mes|meses|dias?|quartos?)\b/.test(t) && !/(r\$|mil|reais|\bk\b)/.test(t)) return null;
  const v = parseMoney(text);
  if (v === null) return null;
  if (v < 100 && !/(r\$|reais|real|mil|\bk\b)/.test(t)) return v * 1000;
  return v;
}

/** Extrai a resposta de uma pergunta para o campo-alvo. */
export function extractForField(field: string | null, text: string): ExtractedValue | null {
  switch (field) {
    case "employmentType":
      return parseEmploymentType(text);
    case "monthlyIncome":
    case "fgtsBalance":
    case "dealValue":
    case "downPaymentAvailable": {
      if (isNegative(text) && (field === "fgtsBalance" || field === "downPaymentAvailable")) return 0;
      return moneyAnswer(text);
    }
    case "hasProperty":
      return parseYesNo(text);
    case "employmentYears":
      return parseEmploymentYears(text);
    case "buyingAlone":
      return parseBuyingAlone(text) ?? freeText(text);
    case "maritalStatus":
      return parseMaritalStatus(text) ?? freeText(text);
    default:
      return freeText(text);
  }
}

/** Extração oportunista: o cliente adiantou informações de outras perguntas na mesma mensagem. */
export function extractOpportunistic(text: string): Record<string, ExtractedValue> {
  const t = norm(text);
  const out: Record<string, ExtractedValue> = {};
  const emp = parseEmploymentType(text, true);
  if (emp) out.employmentType = emp;
  const income = t.match(/(renda|ganho|ganhamos|salario|recebo|recebemos)[^.!?\n]{0,40}/);
  if (income) {
    const v = parseMoney(income[0]);
    if (v) out.monthlyIncome = v;
  }
  const entrada = t.match(/(entrada|tenho guardad|economi)[^.!?\n]{0,40}/);
  if (entrada) {
    const v = parseMoney(entrada[0]);
    if (v) out.downPaymentAvailable = v;
  }
  const fgts = t.match(/fgts[^.!?\n]{0,40}/);
  if (fgts) {
    const v = parseMoney(fgts[0]);
    if (v) out.fgtsBalance = v;
  }
  const alone = parseBuyingAlone(text);
  if (alone && /compr|junto|com (minha|meu)/.test(t)) out.buyingAlone = alone;
  return out;
}

export function wantsHuman(text: string): boolean {
  const t = norm(text);
  return /(falar|conversar|atendimento|passa|chama|quero)\s.{0,25}(corretor|corretora|atendente|humano|pessoa|vendedor|alguem|gerente|consultor)/.test(t) ||
    /^(corretor|atendente|humano)\b/.test(t) ||
    /\b(voce e (um )?robo|e um robo|nao quero falar com robo)\b/.test(t);
}

export function wantsCatalog(text: string): boolean {
  const t = norm(text);
  return /(opcoes|opcao|imoveis|imovel|fotos|tem algum|tem alguma|disponivel|disponiveis|catalogo|me manda|mostra)/.test(t);
}

export function looksLikeQuestion(text: string) {
  return text.trim().endsWith("?") || /^(como|qual|quais|quando|onde|quanto|posso|pode|tem|aceita|da pra|e se)\b/.test(norm(text));
}
