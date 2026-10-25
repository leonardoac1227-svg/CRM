import { prisma } from "@/lib/prisma";
import { body, route } from "@/lib/api";
import { HttpError } from "@/lib/auth";
import { slugify } from "@/lib/utils";
import { z } from "zod";

const schema = z.object({
  channelId: z.string().nullable().optional(),
  name: z.string().min(1).max(512).transform(slugify).optional(),
  category: z.enum(["MARKETING", "UTILITY", "AUTHENTICATION"]).optional(),
  headerType: z.enum(["NONE", "TEXT", "IMAGE", "VIDEO", "DOCUMENT"]).optional(),
  headerContent: z.string().max(500).nullable().optional(),
  bodyText: z.string().min(1).max(1024).optional(),
  variableMappings: z.record(z.string()).optional(),
  footerText: z.string().max(60).nullable().optional(),
  buttonsJson: z.array(z.object({ type: z.enum(["QUICK_REPLY", "URL", "PHONE_NUMBER"]), text: z.string().min(1).max(25), value: z.string().optional() })).max(10).optional(),
});

async function own(id: string, workspaceId: string) {
  const t = await prisma.messageTemplate.findFirst({ where: { id, workspaceId } });
  if (!t) throw new HttpError(404, "Modelo não encontrado");
  return t;
}

export const PATCH = route<{ id: string }>(async ({ req, params, session }) => {
  const t = await own(params.id, session.workspace.id);
  const d = await body(req, schema);
  // Editar um modelo aprovado exige nova aprovação na Meta
  return prisma.messageTemplate.update({ where: { id: t.id }, data: { ...d, metaStatus: t.metaStatus === "APPROVED" && (d.bodyText || d.headerContent || d.category) ? "DRAFT" : undefined } });
}, { module: "campanhas" });

export const DELETE = route<{ id: string }>(async ({ params, session }) => {
  await own(params.id, session.workspace.id);
  await prisma.messageTemplate.delete({ where: { id: params.id } });
  return { ok: true };
}, { module: "campanhas" });
