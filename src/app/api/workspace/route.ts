import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { body, route } from "@/lib/api";
import { requireManager } from "@/lib/rbac";

export const GET = route(async ({ session }) => {
  const ws = session.workspace;
  const [channels, catalog, team, contacts, sessions] = await Promise.all([
    prisma.whatsAppChannel.findMany({ where: { workspaceId: ws.id, status: "CONNECTED" }, select: { phoneNumber: true, name: true }, take: 1 }),
    prisma.catalogItem.count({ where: { workspaceId: ws.id } }),
    prisma.user.count({ where: { workspaceId: ws.id } }),
    prisma.contact.count({ where: { workspaceId: ws.id } }),
    prisma.trackingSession.count({ where: { workspaceId: ws.id } }),
  ]);
  const saved = (ws.onboardingProgress ?? {}) as Record<string, boolean>;
  // Passos são marcados automaticamente quando detectados, ou manualmente pelo botão "Feito"
  const progress = {
    whatsapp: saved.whatsapp || channels.length > 0,
    catalog: saved.catalog || catalog > 0,
    team: saved.team || team > 1,
    contact: saved.contact || contacts > 0,
    seoScript: saved.seoScript || sessions > 0,
  };
  return { workspace: ws, progress, connectedPhone: channels[0]?.phoneNumber ?? null };
});

const patchSchema = z.object({
  name: z.string().min(2).optional(),
  city: z.string().nullable().optional(),
  state: z.string().nullable().optional(),
  siteUrl: z.string().nullable().optional(),
  niche: z.enum(["IMOBILIARIO", "SERVICOS", "CLINICA", "ECOMMERCE", "OUTROS"]).optional(),
  onboarding: z.record(z.boolean()).optional(),
});

export const PATCH = route(async ({ req, session }) => {
  const data = await body(req, patchSchema);
  if (data.name || data.niche || data.siteUrl !== undefined) requireManager(session);
  const { onboarding, ...rest } = data;
  return prisma.workspace.update({
    where: { id: session.workspace.id },
    data: { ...rest, ...(onboarding ? { onboardingProgress: { ...((session.workspace.onboardingProgress ?? {}) as object), ...onboarding } } : {}) },
  });
});
