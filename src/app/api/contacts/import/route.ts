import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { body, route } from "@/lib/api";
import { seesOnlyOwn } from "@/lib/rbac";
import { normalizePhone } from "@/lib/utils";
import { defaultPipelineStage } from "@/lib/services/messaging";
import { contactFields } from "@/lib/schemas";

const IMPORTABLE = ["name", "phone", "email", "cpfCnpj", "birthDate", "city", "state", "neighborhood", "address", "profession", "maritalStatus", "monthlyIncome", "downPaymentAvailable", "dealValue", "tags", "origin"] as const;

const schema = z.object({
  rows: z.array(z.record(z.union([z.string(), z.number(), z.null()]))).max(10000),
  mapping: z.record(z.string()), // coluna da planilha -> campo
  pipelineId: z.string().optional(),
  stageId: z.string().optional(),
  assignedToId: z.string().nullable().optional(),
  tags: z.array(z.string()).optional(),
  origin: z.string().optional(),
  updateExisting: z.boolean().optional(),
});

/** Importação de Excel/CSV (a planilha é lida no navegador e enviada como linhas + mapeamento). */
export const POST = route(async ({ req, session }) => {
  const d = await body(req, schema);
  const def = d.stageId ? { pipelineId: d.pipelineId!, stageId: d.stageId } : await defaultPipelineStage(session.workspace.id);
  let created = 0, updated = 0, skipped = 0;
  const errors: { row: number; error: string }[] = [];
  for (const [i, row] of d.rows.entries()) {
    const raw: Record<string, unknown> = {};
    for (const [col, field] of Object.entries(d.mapping)) {
      if (!field || !(IMPORTABLE as readonly string[]).includes(field)) continue;
      const v = row[col];
      if (v === null || v === undefined || v === "") continue;
      raw[field] = field === "tags" ? String(v).split(/[;,]/).map((t) => t.trim()).filter(Boolean) : String(v).trim();
    }
    const phone = raw.phone ? normalizePhone(String(raw.phone)) : "";
    if (phone.length < 10) {
      skipped++;
      errors.push({ row: i + 2, error: "Telefone ausente ou inválido" });
      continue;
    }
    if (raw.birthDate && /^\d{2}\/\d{2}\/\d{4}$/.test(String(raw.birthDate))) {
      const [dd, mm, yy] = String(raw.birthDate).split("/");
      raw.birthDate = `${yy}-${mm}-${dd}`;
    }
    const parsed = contactFields.safeParse({ ...raw, phone, origin: (raw.origin as string) || d.origin || "MANUAL" });
    if (!parsed.success) {
      skipped++;
      errors.push({ row: i + 2, error: parsed.error.issues[0]?.message ?? "inválido" });
      continue;
    }
    const data = parsed.data;
    const tags = [...new Set([...(data.tags ?? []), ...(d.tags ?? [])])];
    const existing = await prisma.contact.findUnique({ where: { workspaceId_phone: { workspaceId: session.workspace.id, phone } } });
    if (existing) {
      if (d.updateExisting) {
        await prisma.contact.update({ where: { id: existing.id }, data: { ...data, tags: [...new Set([...existing.tags, ...tags])] } as Prisma.ContactUpdateInput });
        updated++;
      } else skipped++;
      continue;
    }
    await prisma.contact.create({
      data: {
        ...(data as Prisma.ContactUncheckedCreateInput),
        phone,
        tags,
        workspaceId: session.workspace.id,
        pipelineId: def.pipelineId,
        stageId: def.stageId,
        assignedToId: seesOnlyOwn(session.user) ? session.user.id : d.assignedToId ?? null,
      },
    });
    created++;
  }
  if (created) await prisma.workspace.update({ where: { id: session.workspace.id }, data: { onboardingProgress: { ...((session.workspace.onboardingProgress ?? {}) as object), contact: true } } });
  return { created, updated, skipped, errors: errors.slice(0, 50) };
}, { module: "contatos" });
