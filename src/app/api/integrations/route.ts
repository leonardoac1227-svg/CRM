import { publicAppUrl } from "@/lib/public-url";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { body, route } from "@/lib/api";
import { requireManager } from "@/lib/rbac";

export const GET = route(async ({ req, session }) => {
  // corretores só conectam o próprio WhatsApp; integrações de anúncios são do gestor
  if (session.user.role === "BROKER") return [];
  const items = await prisma.integration.findMany({ where: { workspaceId: session.workspace.id }, orderBy: { createdAt: "asc" } });
  const appUrl = publicAppUrl(req.nextUrl.origin);
  return items.map((i) => ({ ...i, webhookUrl: `${appUrl}/api/webhooks/leads/${i.webhookToken}` }));
}, { module: "integracoes" });

export const POST = route(async ({ req, session }) => {
  requireManager(session);
  const d = await body(req, z.object({
    type: z.enum(["FACEBOOK_LEAD_ADS", "GOOGLE_ADS", "PORTAL_OLX", "PORTAL_CHAVES_NA_MAO", "PORTAL_IMOVELWEB", "CUSTOM_WEBHOOK"]),
    name: z.string().min(2),
    config: z.record(z.unknown()).default({}),
  }));
  return prisma.integration.create({ data: { workspaceId: session.workspace.id, type: d.type, name: d.name, isEnabled: true, configJson: d.config as object } });
}, { module: "integracoes" });
