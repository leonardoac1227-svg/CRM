import { NextRequest } from "next/server";
import type { LeadOrigin } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { codePrefix } from "@/lib/tracker";
import { CORS, corsJson, readBody } from "@/lib/track-cors";
import { ORIGINS } from "@/lib/constants";

export const dynamic = "force-dynamic";

export function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS });
}

type Body = { key: string; origin: string; landingPage: string; referrer?: string | null; keyword?: string | null; utmSource?: string | null; utmMedium?: string | null; utmCampaign?: string | null };

/** Registra a visita (first-touch) e devolve o protocolo curto [Ref: #SEO-XXXX]. */
export async function POST(req: NextRequest) {
  const b = await readBody<Body>(req);
  if (!b?.key || !b.landingPage) return corsJson({ error: "invalid" }, 400);
  const ws = await prisma.workspace.findUnique({ where: { trackerKey: b.key } });
  if (!ws) return corsJson({ error: "invalid key" }, 404);
  const origin = (ORIGINS.includes(b.origin) ? b.origin : "SITE_DIRETO") as LeadOrigin;
  const prefix = codePrefix(origin);
  for (let attempt = 0; attempt < 8; attempt++) {
    const digits = attempt < 4 ? 4 : attempt < 6 ? 5 : 6;
    const code = `${prefix}-${String(Math.floor(Math.random() * 10 ** digits)).padStart(digits, "0")}`;
    try {
      await prisma.trackingSession.create({
        data: {
          workspaceId: ws.id, code, origin, landingPage: b.landingPage.slice(0, 500), referrer: b.referrer?.slice(0, 500) ?? null, keyword: b.keyword?.slice(0, 200) ?? null,
          utmSource: b.utmSource ?? null, utmMedium: b.utmMedium ?? null, utmCampaign: b.utmCampaign ?? null,
        },
      });
      const progress = (ws.onboardingProgress ?? {}) as Record<string, boolean>;
      if (!progress.seoScript) await prisma.workspace.update({ where: { id: ws.id }, data: { onboardingProgress: { ...progress, seoScript: true } } });
      return corsJson({ code });
    } catch {
      // colisão de código: tenta de novo com mais dígitos
    }
  }
  return corsJson({ error: "could not allocate code" }, 500);
}
