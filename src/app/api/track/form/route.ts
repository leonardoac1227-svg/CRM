import { NextRequest } from "next/server";
import type { LeadOrigin } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { normalizePhone } from "@/lib/utils";
import { CORS, corsJson, readBody } from "@/lib/track-cors";
import { ORIGINS } from "@/lib/constants";
import { defaultPipelineStage } from "@/lib/services/messaging";
import { logActivity, notifyManagers } from "@/lib/services/activity";
import { assignContact, pickRouletteUser } from "@/lib/services/distribution";

export const dynamic = "force-dynamic";

export function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS });
}

type Body = {
  key: string; code?: string | null; name?: string | null; phone: string; email?: string | null; message?: string | null; page?: string;
  fields?: Record<string, string>; origin?: string; landingPage?: string; referrer?: string | null; keyword?: string | null;
  utmSource?: string | null; utmMedium?: string | null; utmCampaign?: string | null;
};

/** Formulário do site interceptado pelo tracker.js -> cria o lead com a origem SEO completa. */
export async function POST(req: NextRequest) {
  const b = await readBody<Body>(req);
  if (!b?.key || !b.phone) return corsJson({ ok: false }, 400);
  const ws = await prisma.workspace.findUnique({ where: { trackerKey: b.key } });
  if (!ws) return corsJson({ ok: false }, 404);
  const phone = normalizePhone(b.phone);
  if (phone.length < 10) return corsJson({ ok: false, error: "phone" }, 422);
  const ts = b.code ? await prisma.trackingSession.findFirst({ where: { workspaceId: ws.id, code: b.code } }) : null;
  const origin = (ts?.origin ?? (ORIGINS.includes(b.origin ?? "") ? b.origin : "SITE_DIRETO")) as LeadOrigin;
  const attribution = {
    origin,
    seoLandingPage: ts?.landingPage ?? b.landingPage ?? b.page ?? null,
    seoReferrer: ts?.referrer ?? b.referrer ?? null,
    seoKeyword: ts?.keyword ?? b.keyword ?? null,
    utmSource: ts?.utmSource ?? b.utmSource ?? null,
    utmMedium: ts?.utmMedium ?? b.utmMedium ?? null,
    utmCampaign: ts?.utmCampaign ?? b.utmCampaign ?? null,
    trackingCode: ts ? `#${ts.code}` : null,
  };
  const existing = await prisma.contact.findUnique({ where: { workspaceId_phone: { workspaceId: ws.id, phone } } });
  const def = await defaultPipelineStage(ws.id);
  const contact = existing
    ? await prisma.contact.update({ where: { id: existing.id }, data: { lastInteractionAt: new Date(), ...(existing.trackingCode ? {} : attribution) } })
    : await prisma.contact.create({
        data: { workspaceId: ws.id, phone, name: b.name?.slice(0, 120) ?? null, email: b.email?.slice(0, 160) ?? null, ...def, ...attribution, tags: origin === "SEO_ORGANICO" ? ["seo"] : [], lastInteractionAt: new Date() },
      });
  if (ts) await prisma.trackingSession.update({ where: { id: ts.id }, data: { contactId: contact.id, event: "form_submit" } });
  const extra = Object.entries(b.fields ?? {}).filter(([k]) => !/senha|password|token|csrf/i.test(k)).slice(0, 20).map(([k, v]) => `${k}: ${v}`).join("\n");
  await logActivity({ workspaceId: ws.id, contactId: contact.id, type: "SYSTEM", title: `Formulário enviado no site${attribution.seoLandingPage ? ` (${attribution.seoLandingPage})` : ""}`, body: [b.message, extra].filter(Boolean).join("\n\n") || null });
  if (!existing) {
    const u = await pickRouletteUser(ws.id);
    if (u) await assignContact({ workspaceId: ws.id, contactId: contact.id, userId: u.id, via: "ROULETTE", notifyWhatsApp: true, summary: `Formulário do site • ${attribution.seoLandingPage ?? ""}` });
    else await notifyManagers(ws.id, `Novo lead do site: ${b.name ?? phone}`, attribution.seoLandingPage ?? undefined);
  }
  return corsJson({ ok: true });
}
