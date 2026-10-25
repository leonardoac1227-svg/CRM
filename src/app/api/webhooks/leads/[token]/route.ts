import { NextRequest, NextResponse } from "next/server";
import type { LeadOrigin } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { normalizePhone } from "@/lib/utils";
import { defaultPipelineStage } from "@/lib/services/messaging";
import { logActivity, notifyManagers } from "@/lib/services/activity";
import { assignContact, pickRouletteUser } from "@/lib/services/distribution";

export const dynamic = "force-dynamic";

const ORIGIN_BY_TYPE: Record<string, LeadOrigin> = {
  FACEBOOK_LEAD_ADS: "FACEBOOK_ADS",
  GOOGLE_ADS: "GOOGLE_ADS",
  PORTAL_OLX: "OLX",
  PORTAL_CHAVES_NA_MAO: "PORTAIS",
  PORTAL_IMOVELWEB: "PORTAIS",
  CUSTOM_WEBHOOK: "SITE_DIRETO",
};

/** Normaliza payloads de Facebook Lead Ads (field_data), Google Ads (user_column_data), portais e JSON genérico. */
function flatten(body: Record<string, unknown>): Record<string, string> {
  const out: Record<string, string> = {};
  const fd = body.field_data as { name: string; values: string[] }[] | undefined;
  if (Array.isArray(fd)) for (const f of fd) out[f.name] = f.values?.[0] ?? "";
  const ucd = body.user_column_data as { column_id: string; string_value: string }[] | undefined;
  if (Array.isArray(ucd)) for (const c of ucd) out[c.column_id.toLowerCase()] = c.string_value;
  for (const [k, v] of Object.entries(body)) if (typeof v === "string" || typeof v === "number") out[k] = String(v);
  const lead = body.lead as Record<string, unknown> | undefined;
  if (lead && typeof lead === "object") for (const [k, v] of Object.entries(lead)) if (typeof v === "string" || typeof v === "number") out[k] = String(v);
  return out;
}

function first(o: Record<string, string>, keys: string[]) {
  for (const k of keys) if (o[k]) return o[k];
  return null;
}

export async function POST(req: NextRequest, { params }: { params: { token: string } }) {
  const integ = await prisma.integration.findUnique({ where: { webhookToken: params.token }, include: { workspace: true } });
  if (!integ || !integ.isEnabled) return NextResponse.json({ error: "Integração inválida ou desativada" }, { status: 404 });
  const raw = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const data = flatten(raw);
  const cfg = (integ.configJson ?? {}) as { fieldMap?: Record<string, string>; pipelineId?: string; stageId?: string; autoAssign?: boolean; tags?: string[] };
  const mapped: Record<string, string> = {};
  for (const [src, dst] of Object.entries(cfg.fieldMap ?? {})) if (data[src]) mapped[dst] = data[src];
  const phone = normalizePhone(mapped.phone ?? first(data, ["phone", "phone_number", "telefone", "celular", "whatsapp", "ddd_phone", "phone_number_full"]) ?? "");
  if (phone.length < 10) return NextResponse.json({ error: "Telefone ausente" }, { status: 422 });
  const name = mapped.name ?? first(data, ["full_name", "name", "nome", "first_name"]);
  const email = mapped.email ?? first(data, ["email", "e-mail"]);
  const message = first(data, ["message", "mensagem", "comments"]);
  const listing = first(data, ["listing_id", "clientListingId", "imovel", "codigo", "ad_id"]);
  const income = mapped.monthlyIncome ? Number(mapped.monthlyIncome.replace(/\D/g, "")) || null : null;

  const def = cfg.stageId && cfg.pipelineId ? { pipelineId: cfg.pipelineId, stageId: cfg.stageId } : await defaultPipelineStage(integ.workspaceId);
  const existing = await prisma.contact.findUnique({ where: { workspaceId_phone: { workspaceId: integ.workspaceId, phone } } });
  const contact = existing
    ? await prisma.contact.update({ where: { id: existing.id }, data: { lastInteractionAt: new Date(), name: existing.name ?? name } })
    : await prisma.contact.create({
        data: {
          workspaceId: integ.workspaceId, phone, name, email, origin: ORIGIN_BY_TYPE[integ.type] ?? "SITE_DIRETO", ...def,
          monthlyIncome: income, tags: cfg.tags ?? [], utmSource: integ.type === "FACEBOOK_LEAD_ADS" ? "facebook" : integ.type === "GOOGLE_ADS" ? "google" : null,
          utmCampaign: first(data, ["campaign_name", "campaign_id", "form_name"]), lastInteractionAt: new Date(),
        },
      });
  await logActivity({ workspaceId: integ.workspaceId, contactId: contact.id, type: "SYSTEM", title: `Lead recebido via ${integ.name}`, body: [message, listing ? `Anúncio/imóvel: ${listing}` : null].filter(Boolean).join("\n") || null, meta: { integrationId: integ.id } });
  await prisma.integration.update({ where: { id: integ.id }, data: { leadsReceived: { increment: 1 }, lastEventAt: new Date() } });
  if (!existing && cfg.autoAssign !== false) {
    const u = await pickRouletteUser(integ.workspaceId);
    if (u) await assignContact({ workspaceId: integ.workspaceId, contactId: contact.id, userId: u.id, via: "ROULETTE", notifyWhatsApp: true, summary: `Origem: ${integ.name}${message ? `\nMensagem: ${message}` : ""}` });
    else await notifyManagers(integ.workspaceId, `Novo lead de ${integ.name}: ${name ?? phone}`, message ?? undefined, `/contatos?id=${contact.id}`);
  }
  return NextResponse.json({ ok: true, contactId: contact.id });
}
