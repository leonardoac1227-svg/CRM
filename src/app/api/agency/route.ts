import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { body, route } from "@/lib/api";
import { HttpError } from "@/lib/auth";

export const GET = route(async ({ session }) => session.agency);

const schema = z.object({
  name: z.string().min(2).optional(),
  logoUrl: z.string().url().nullable().optional().or(z.literal("")),
  primaryColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  secondaryColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  assistantDefaultName: z.string().min(2).max(30).optional(),
  customDomain: z.string().nullable().optional(),
});

/** Configuração White-Label (logo, cores, nome padrão do assistente). */
export const PATCH = route(async ({ req, session }) => {
  if (!["AGENCY_ADMIN", "SUPER_ADMIN", "MANAGER"].includes(session.user.role)) throw new HttpError(403, "Sem permissão para alterar a marca");
  const data = await body(req, schema);
  return prisma.agency.update({
    where: { id: session.agency.id },
    data: { ...data, logoUrl: data.logoUrl === "" ? null : data.logoUrl, customDomain: data.customDomain || null },
  });
}, { module: "site-seo" });
