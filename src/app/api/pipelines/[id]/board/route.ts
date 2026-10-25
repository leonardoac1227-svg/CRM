import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { route } from "@/lib/api";
import { HttpError } from "@/lib/auth";
import { contactScope } from "@/lib/rbac";

/** Dados do Kanban: etapas + cards (com soma do valor por coluna). */
export const GET = route<{ id: string }>(async ({ req, params, session }) => {
  const pipeline = await prisma.pipeline.findFirst({ where: { id: params.id, workspaceId: session.workspace.id }, include: { stages: { orderBy: { order: "asc" } } } });
  if (!pipeline) throw new HttpError(404, "Funil não encontrado");
  const sp = req.nextUrl.searchParams;
  const and: Prisma.ContactWhereInput[] = [contactScope(session), { pipelineId: pipeline.id }];
  if (sp.get("userId")) and.push(sp.get("userId") === "none" ? { assignedToId: null } : { assignedToId: sp.get("userId") });
  if (sp.get("origin")) and.push({ origin: sp.get("origin") as never });
  if (sp.get("status")) and.push({ status: sp.get("status") as never });
  if (sp.get("q")) and.push({ OR: [{ name: { contains: sp.get("q")!, mode: "insensitive" } }, { phone: { contains: sp.get("q")!.replace(/\D/g, "") || "__" } }] });
  const contacts = await prisma.contact.findMany({
    where: { AND: and },
    select: {
      id: true, name: true, phone: true, origin: true, stageId: true, dealValue: true, stageChangedAt: true, tags: true, status: true, seoLandingPage: true, aiQualifiedAt: true,
      assignedTo: { select: { id: true, name: true } },
      conversations: { select: { id: true }, orderBy: { lastMessageAt: "desc" }, take: 1 },
    },
    orderBy: { stageChangedAt: "desc" },
    take: 2000,
  });
  return {
    pipeline,
    columns: pipeline.stages.map((s) => {
      const cards = contacts.filter((c) => c.stageId === s.id);
      return { stage: s, cards, total: cards.reduce((a, c) => a + Number(c.dealValue ?? 0), 0) };
    }),
  };
}, { module: "funis" });
