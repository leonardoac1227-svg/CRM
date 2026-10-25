import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { body, route } from "@/lib/api";

export const GET = route(async ({ req, session }) => {
  const sp = req.nextUrl.searchParams;
  const where: Prisma.CatalogItemWhereInput = { workspaceId: session.workspace.id };
  const q = sp.get("q");
  if (q) where.OR = [{ title: { contains: q, mode: "insensitive" } }, { code: { contains: q, mode: "insensitive" } }, { neighborhood: { contains: q, mode: "insensitive" } }];
  if (sp.get("category")) where.category = sp.get("category")!;
  if (sp.get("status")) where.status = sp.get("status") as never;
  return prisma.catalogItem.findMany({ where, include: { _count: { select: { interestedContacts: true } } }, orderBy: { createdAt: "desc" } });
}, { module: "imoveis" });

const catalogSchema = z.object({
  title: z.string().min(2).max(160),
  code: z.string().min(1).max(30),
  category: z.string().min(2).max(40),
  price: z.number().nullable().optional(),
  neighborhood: z.string().nullable().optional(),
  city: z.string().nullable().optional(),
  bedrooms: z.number().int().nullable().optional(),
  areaM2: z.number().int().nullable().optional(),
  description: z.string().max(5000).nullable().optional(),
  images: z.array(z.string().url()).max(20).default([]),
  status: z.enum(["AVAILABLE", "RESERVED", "SOLD", "RENTED", "INACTIVE"]).default("AVAILABLE"),
});

export const POST = route(async ({ req, session }) => {
  const d = await body(req, catalogSchema);
  const item = await prisma.catalogItem.create({ data: { ...d, workspaceId: session.workspace.id } });
  await prisma.workspace.update({ where: { id: session.workspace.id }, data: { onboardingProgress: { ...((session.workspace.onboardingProgress ?? {}) as object), catalog: true } } });
  return item;
}, { module: "imoveis" });
