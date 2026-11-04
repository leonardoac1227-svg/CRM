import crypto from "node:crypto";

/** Senha provisória legível (sem caracteres ambíguos), ex.: "k7pm-3xqa-h2wd". */
export function tempPasswordGen() {
  const alphabet = "abcdefghjkmnpqrstuvwxyz23456789";
  const bytes = crypto.randomBytes(12);
  const chars = Array.from(bytes, (b) => alphabet[b % alphabet.length]);
  return `${chars.slice(0, 4).join("")}-${chars.slice(4, 8).join("")}-${chars.slice(8, 12).join("")}`;
}
