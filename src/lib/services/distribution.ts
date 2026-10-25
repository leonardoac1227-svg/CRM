// Roleta de corretores (round-robin ponderado) e atribuição de leads.
import type { User } from "@prisma/client";
import { prisma } from "../prisma";
import { emitWorkspace } from "../realtime";
import { adapterFor } from "../whatsapp";
import { firstName, formatPhone } from "../utils";
import { logActivity, notify } from "./activity";

/**
 * Escolhe o próximo corretor do plantão: menor (leads recebidos nos últimos 7 dias / peso),
 * desempate por quem recebeu há mais tempo.
 */
export async function pickRouletteUser(workspaceId: string): Promise<User | null> {
  const brokers = await prisma.user.findMany({ where: { workspaceId, inRoulette: true, isActive: true } });
  if (!brokers.length) return null;
  const since = new Date(Date.now() - 7 * 86400000);
  const counts = await prisma.activity.groupBy({
    by: ["userId"],
    where: { workspaceId, type: "ASSIGNMENT", createdAt: { gte: since }, metaJson: { path: ["via"], equals: "ROULETTE" } },
    _count: { _all: true },
  });
  const countOf = (id: string) => counts.find((c) => c.userId === id)?._count._all ?? 0;
  return [...brokers].sort((a, b) => {
    const ra = countOf(a.id) / Math.max(1, a.rouletteWeight);
    const rb = countOf(b.id) / Math.max(1, b.rouletteWeight);
    if (ra !== rb) return ra - rb;
    return (a.lastAssignedAt?.getTime() ?? 0) - (b.lastAssignedAt?.getTime() ?? 0);
  })[0];
}

export async function assignContact(opts: {
  workspaceId: string;
  contactId: string;
  userId: string | null;
  byUserId?: string | null;
  via: "ROULETTE" | "MANUAL" | "FIXED_USER" | "AI";
  summary?: string | null;
  notifyWhatsApp?: boolean;
}) {
  const contact = await prisma.contact.update({
    where: { id: opts.contactId },
    data: { assignedToId: opts.userId },
    include: { assignedTo: true },
  });
  await prisma.conversation.updateMany({ where: { contactId: contact.id }, data: { assignedToId: opts.userId } });
  if (!opts.userId) {
    await logActivity({ workspaceId: opts.workspaceId, contactId: contact.id, userId: opts.byUserId, type: "ASSIGNMENT", title: "Lead ficou sem responsável", meta: { via: opts.via } });
    emitWorkspace(opts.workspaceId, "contact:updated", { contactId: contact.id });
    return contact;
  }
  const user = await prisma.user.update({ where: { id: opts.userId }, data: { lastAssignedAt: new Date() } });
  await logActivity({
    workspaceId: opts.workspaceId,
    contactId: contact.id,
    userId: user.id,
    type: "ASSIGNMENT",
    title: `Lead atribuído a ${user.name}${opts.via === "ROULETTE" ? " (roleta)" : ""}`,
    meta: { via: opts.via, by: opts.byUserId ?? null },
  });
  await notify({
    workspaceId: opts.workspaceId,
    userId: user.id,
    title: `Novo lead: ${contact.name || formatPhone(contact.phone)}`,
    body: opts.summary ? opts.summary.split("\n").slice(0, 4).join(" · ") : "Um lead foi atribuído a você.",
    link: `/atendimento?contato=${contact.id}`,
  });
  if (opts.notifyWhatsApp && user.phone) {
    // Avisa o corretor sorteado no WhatsApp pessoal, pelo número da empresa
    const channel = await prisma.whatsAppChannel.findFirst({ where: { workspaceId: opts.workspaceId, accountType: "COMPANY", status: "CONNECTED" } });
    if (channel) {
      const text = `🔔 Olá, ${firstName(user.name)}! Você recebeu um novo lead: *${contact.name || "Sem nome"}* (${formatPhone(contact.phone)}).\n\n${opts.summary ?? ""}\n\nAbra o CRM para continuar o atendimento.`;
      try {
        await adapterFor(channel).sendText(channel, user.phone, text.slice(0, 4000));
      } catch (e) {
        console.error("[distribution] falha ao avisar corretor", (e as Error).message);
      }
    }
  }
  emitWorkspace(opts.workspaceId, "contact:updated", { contactId: contact.id });
  return contact;
}
