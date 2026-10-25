import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { body, route } from "@/lib/api";
import { contactScope } from "@/lib/rbac";
import { costFor, filtersToWhere, type CampaignFilters } from "@/lib/services/campaigns";
import { campaignFiltersSchema as filtersSchema } from "@/lib/schemas";

/** Contador de destinatários + custo estimado (Quantidade × tarifa da categoria). */
export const POST = route(async ({ req, session }) => {
  const d = await body(req, z.object({ filters: filtersSchema, templateId: z.string().nullable().optional(), category: z.string().optional() }));
  const filters: CampaignFilters = { ...d.filters };
  const scope = contactScope(session);
  if (scope.assignedToId) filters.assignedToIds = [String(scope.assignedToId)];
  const where = filtersToWhere(session.workspace.id, filters);
  const [count, sample, template] = await Promise.all([
    prisma.contact.count({ where }),
    prisma.contact.findMany({
      where,
      select: { id: true, name: true, phone: true, city: true, state: true, neighborhood: true, profession: true, email: true, monthlyIncome: true, cpfCnpj: true, stage: { select: { name: true } }, assignedTo: { select: { name: true } } },
      take: 50,
      orderBy: { name: "asc" },
    }),
    d.templateId ? prisma.messageTemplate.findFirst({ where: { id: d.templateId, workspaceId: session.workspace.id } }) : null,
  ]);
  const category = template?.category ?? d.category ?? "MARKETING";
  return { count, estimatedCost: costFor(category, count), category, sample };
}, { module: "campanhas" });
