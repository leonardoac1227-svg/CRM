import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { body, route } from "@/lib/api";
import { HttpError } from "@/lib/auth";

const schema = z.object({
  title: z.string().min(2).max(160).optional(),
  code: z.string().min(1).max(30).optional(),
  category: z.string().min(2).max(40).optional(),
  price: z.number().nullable().optional(),
  neighborhood: z.string().nullable().optional(),
  city: z.string().nullable().optional(),
  bedrooms: z.number().int().nullable().optional(),
  areaM2: z.number().int().nullable().optional(),
  description: z.string().max(5000).nullable().optional(),
  images: z.array(z.string().url()).max(20).optional(),
  status: z.enum(["AVAILABLE", "RESERVED", "SOLD", "RENTED", "INACTIVE"]).optional(),
});

async function own(id: string, workspaceId: string) {
  const i = await prisma.catalogItem.findFirst({ where: { id, workspaceId } });
  if (!i) throw new HttpError(404, "Item não encontrado");
  return i;
}

export const PATCH = route<{ id: string }>(async ({ req, params, session }) => {
  await own(params.id, session.workspace.id);
  return prisma.catalogItem.update({ where: { id: params.id }, data: await body(req, schema) });
}, { module: "imoveis" });

export const DELETE = route<{ id: string }>(async ({ params, session }) => {
  await own(params.id, session.workspace.id);
  await prisma.catalogItem.delete({ where: { id: params.id } });
  return { ok: true };
}, { module: "imoveis" });
