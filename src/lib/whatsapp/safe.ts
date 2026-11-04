import type { WhatsAppChannel } from "@prisma/client";

/** Remove credenciais antes de devolver ao navegador. */
export function safeChannel({ metaAccessToken, evolutionApiKey, metaAppSecret, ...c }: WhatsAppChannel & Record<string, unknown>) {
  return { ...c, hasToken: !!metaAccessToken, hasEvolutionKey: !!evolutionApiKey, hasAppSecret: !!metaAppSecret };
}

