import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { body, route } from "@/lib/api";
import { HttpError } from "@/lib/auth";
import { contactScope, seesOnlyOwn } from "@/lib/rbac";
import { normalizePhone } from "@/lib/utils";
import { defaultPipelineStage } from "@/lib/services/messaging";
import { logActivity } from "@/lib/services/activity";
import { contactFields } from "@/lib/schemas";

export const GET = route(async ({ req, session }) => {
  const sp = req.nextUrl.searchParams;
  const and: Prisma.ContactWhereInput[] = [contactScope(session)];
  const q = sp.get("q")?.trim();
  if (q) {
    const digits = q.replace(/\D/g, "");
    and.push({
      OR: [
        { name: { contains: q, mode: "insensitive" } },
        { email: { contains: q, mode: "insensitive" } },
        { trackingCode: { contains: q, mode: "insensitive" } },
        ...(digits.length >= 3 ? [{ phone: { contains: digits } }] : []),
      ],
    });
  }
  if (sp.get("pipelineId")) and.push({ pipelineId: sp.get("pipelineId") });
  if (sp.get("stageId")) and.push({ stageId: sp.get("stageId") });
  const resp = sp.get("assignedToId");
  if (resp) and.push(resp === "none" ? { assignedToId: null } : { assignedToId: resp });
  if (sp.get("origin")) and.push({ origin: sp.get("origin") as never });
  if (sp.get("tag")) and.push({ tags: { has: sp.get("tag")! } });
  if (sp.get("status")) and.push({ status: sp.get("status") as never });
  const where: Prisma.ContactWhereInput = { AND: and };
  const page = Math.max(1, Number(sp.get("page") || 1));
  const pageSize = Math.min(200, Math.max(10, Number(sp.get("pageSize") || 25)));
  const sort = sp.get("sort") === "lastInteraction" ? { lastInteractionAt: "desc" as const } : { createdAt: "desc" as const };
  const [items, total, tagRows] = await Promise.all([
    prisma.contact.findMany({
      where,
      include: {
        assignedTo: { select: { id: true, name: true } },
        stage: { select: { id: true, name: true, color: true } },
        pipeline: { select: { id: true, name: true } },
        conversations: { select: { id: true }, orderBy: { lastMessageAt: "desc" }, take: 1 },
      },
      orderBy: sort,
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.contact.count({ where }),
    prisma.$queryRaw<{ tag: string }[]>`SELECT DISTINCT unnest(tags) AS tag FROM "Contact" WHERE "workspaceId" = ${session.workspace.id} ORDER BY 1`,
  ]);
  return { items, total, page, pageSize, tags: tagRows.map((t) => t.tag) };
}, { module: "contatos" });

export const POST = route(async ({ req, session }) => {
  const d = await body(req, contactFields);
  if (!d.phone) throw new HttpError(422, "Telefone é obrigatório");
  const phone = normalizePhone(d.phone);
  const exists = await prisma.contact.findUnique({ where: { workspaceId_phone: { workspaceId: session.workspace.id, phone } } });
  if (exists) throw new HttpError(409, "Já existe um contato com este telefone");
  const def = d.stageId ? null : await defaultPipelineStage(session.workspace.id);
  const contact = await prisma.contact.create({
    data: {
      ...d,
      phone,
      workspaceId: session.workspace.id,
      origin: d.origin ?? "MANUAL",
      pipelineId: d.pipelineId ?? def?.pipelineId ?? null,
      stageId: d.stageId ?? def?.stageId ?? null,
      // corretor que cria um contato fica como responsável
      assignedToId: seesOnlyOwn(session.user) ? session.user.id : d.assignedToId ?? null,
      lastInteractionAt: new Date(),
    },
  });
  await logActivity({ workspaceId: session.workspace.id, contactId: contact.id, userId: session.user.id, type: "SYSTEM", title: `Contato criado por ${session.user.name}` });
  await prisma.workspace.update({ where: { id: session.workspace.id }, data: { onboardingProgress: { ...((session.workspace.onboardingProgress ?? {}) as object), contact: true } } });
  return contact;
}, { module: "contatos" });
