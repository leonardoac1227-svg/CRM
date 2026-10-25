import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { body, route } from "@/lib/api";
import { slugify } from "@/lib/utils";

export const GET = route(async ({ req, session }) => {
  const status = req.nextUrl.searchParams.get("status");
  return prisma.messageTemplate.findMany({
    where: { workspaceId: session.workspace.id, ...(status ? { metaStatus: status as never } : {}) },
    include: { channel: { select: { id: true, name: true, phoneNumber: true } }, _count: { select: { campaigns: true } } },
    orderBy: { createdAt: "desc" },
  });
}, { module: "atendimento" });

const templateSchema = z.object({
  channelId: z.string().nullable().optional(),
  name: z.string().min(1).max(512).transform(slugify),
  category: z.enum(["MARKETING", "UTILITY", "AUTHENTICATION"]),
  language: z.string().default("pt_BR"),
  headerType: z.enum(["NONE", "TEXT", "IMAGE", "VIDEO", "DOCUMENT"]).default("NONE"),
  headerContent: z.string().max(500).nullable().optional(),
  bodyText: z.string().min(1).max(1024),
  variableMappings: z.record(z.string()).default({}),
  footerText: z.string().max(60).nullable().optional(),
  buttonsJson: z.array(z.object({ type: z.enum(["QUICK_REPLY", "URL", "PHONE_NUMBER"]), text: z.string().min(1).max(25), value: z.string().optional() })).max(10).default([]),
});

export const POST = route(async ({ req, session }) => {
  const d = await body(req, templateSchema);
  return prisma.messageTemplate.create({ data: { ...d, workspaceId: session.workspace.id, metaStatus: "DRAFT" } });
}, { module: "campanhas" });
