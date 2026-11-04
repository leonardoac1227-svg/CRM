import crypto from "node:crypto";

/** URL pública da aplicação (APP_URL, a URL do Render ou a origem da requisição). */
export function publicAppUrl(fallbackOrigin?: string) {
  return (process.env.APP_URL || process.env.RENDER_EXTERNAL_URL || fallbackOrigin || "http://localhost:3000").replace(/\/$/, "");
}

/**
 * Token de verificação do webhook da Meta. Usa META_WEBHOOK_VERIFY_TOKEN; sem ele, deriva um
 * valor fixo e secreto do JWT_SECRET (o mesmo em todos os reinícios).
 */
export function metaVerifyToken() {
  if (process.env.META_WEBHOOK_VERIFY_TOKEN) return process.env.META_WEBHOOK_VERIFY_TOKEN;
  const seed = process.env.JWT_SECRET || "apice-dev";
  return "apice-" + crypto.createHash("sha256").update(`meta-verify:${seed}`).digest("hex").slice(0, 20);
}
