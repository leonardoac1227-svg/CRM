import { route } from "@/lib/api";
import { metaVerifyToken, publicAppUrl } from "@/lib/public-url";
import { evolutionServerConfigured } from "@/lib/whatsapp/evolution";
import { isManagerLike } from "@/lib/rbac";

/** Dados que os assistentes de configuração mostram ao usuário (URLs e tokens para copiar). */
export const GET = route(async ({ req, session }) => {
  const appUrl = publicAppUrl(req.nextUrl.origin);
  return {
    appUrl,
    meta: {
      webhookUrl: `${appUrl}/api/webhooks/meta`,
      verifyToken: isManagerLike(session.user) ? metaVerifyToken() : null,
      fields: ["messages"],
    },
    evolution: { configured: evolutionServerConfigured() },
    publicUrlOk: !/localhost|127\.0\.0\.1/.test(appUrl),
  };
});
