import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { body, route } from "@/lib/api";
import { requireManager, seesOnlyOwn } from "@/lib/rbac";
import { normalizePhone } from "@/lib/utils";

export const GET = route(async ({ session }) => {
  const channels = await prisma.whatsAppChannel.findMany({
    where: { workspaceId: session.workspace.id, ...(seesOnlyOwn(session.user) ? { OR: [{ userId: session.user.id }, { accountType: "COMPANY" }] } : {}) },
    include: { user: { select: { id: true, name: true } }, _count: { select: { conversations: true } } },
    orderBy: [{ accountType: "asc" }, { name: "asc" }],
  });
  return channels.map(({ metaAccessToken, evolutionApiKey, ...c }) => ({ ...c, hasToken: !!metaAccessToken, hasEvolutionKey: !!evolutionApiKey }));
});

const schema = z.object({
  name: z.string().min(2),
  phoneNumber: z.string().min(8),
  provider: z.enum(["META_OFFICIAL", "EVOLUTION_QR"]),
  accountType: z.enum(["COMPANY", "BROKER"]),
  userId: z.string().nullable().optional(),
  metaWabaId: z.string().optional(),
  metaPhoneNumberId: z.string().optional(),
  metaAccessToken: z.string().optional(),
  evolutionInstance: z.string().optional(),
  evolutionApiUrl: z.string().optional(),
  evolutionApiKey: z.string().optional(),
});

export const POST = route(async ({ req, session }) => {
  requireManager(session);
  const d = await body(req, schema);
  const ch = await prisma.whatsAppChannel.create({
    data: {
      workspaceId: session.workspace.id,
      name: d.name,
      phoneNumber: normalizePhone(d.phoneNumber),
      provider: d.provider,
      accountType: d.accountType,
      userId: d.userId || null,
      status: d.provider === "META_OFFICIAL" && d.metaAccessToken && d.metaPhoneNumberId ? "CONNECTED" : "DISCONNECTED",
      metaWabaId: d.metaWabaId || null,
      metaPhoneNumberId: d.metaPhoneNumberId || null,
      metaAccessToken: d.metaAccessToken || null,
      evolutionInstance: d.provider === "EVOLUTION_QR" ? d.evolutionInstance || `${session.workspace.id.slice(-6)}-${normalizePhone(d.phoneNumber).slice(-6)}` : null,
      evolutionApiUrl: d.evolutionApiUrl || null,
      evolutionApiKey: d.evolutionApiKey || null,
    },
  });
  return { ...ch, metaAccessToken: undefined, evolutionApiKey: undefined };
}, { module: "integracoes" });
