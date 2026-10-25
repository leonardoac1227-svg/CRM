// Automações do Téo executadas pelo agendador (server.ts chama /api/cron/tick a cada minuto).
import type { AutomationType } from "@prisma/client";
import { prisma } from "../prisma";
import { firstName, formatDate } from "../utils";
import { sendOutboundText, windowOpen } from "./messaging";
import { logActivity, notify } from "./activity";
import { processAiTimeouts } from "./ai-runner";
import { processScheduledCampaigns } from "./campaigns";

type RuleCfg = Record<string, unknown>;

async function enabledRules(type: AutomationType) {
  return prisma.aiAutomationRule.findMany({ where: { type, isEnabled: true } });
}

async function alreadyDone(contactId: string, key: string) {
  return !!(await prisma.activity.findFirst({ where: { contactId, type: "SYSTEM", metaJson: { path: ["automationKey"], equals: key } } }));
}

/** Envia ao contato pela conversa mais recente que permita mensagem livre. */
async function messageContact(contactId: string, text: string, label: string) {
  const conv = await prisma.conversation.findFirst({ where: { contactId }, include: { channel: true }, orderBy: { lastMessageAt: "desc" } });
  if (!conv?.channel) return false;
  if (conv.channel.provider === "META_OFFICIAL" && !windowOpen(conv)) return false;
  const cfg = await prisma.aiAssistantConfig.findUnique({ where: { workspaceId: conv.workspaceId } });
  await sendOutboundText({ conversationId: conv.id, text, senderType: "AI_AGENT", senderName: `IA: ${cfg?.assistantName ?? "Téo"} • ${label}` });
  return true;
}

async function visitReminders() {
  let n = 0;
  for (const rule of await enabledRules("VISIT_REMINDER")) {
    const hours = Number((rule.configJson as RuleCfg).hoursBefore ?? 24);
    const tasks = await prisma.task.findMany({
      where: { workspaceId: rule.workspaceId, type: "VISIT", isCompleted: false, dueDate: { gte: new Date(), lte: new Date(Date.now() + hours * 3600000) } },
      include: { contact: true, assignedTo: true },
    });
    for (const t of tasks) {
      if (!t.contact) continue;
      const key = `visit-reminder:${t.id}`;
      if (await alreadyDone(t.contact.id, key)) continue;
      const when = formatDate(t.dueDate, true);
      const sent = await messageContact(t.contact.id, `Oi${t.contact.name ? `, ${firstName(t.contact.name)}` : ""}! Passando para lembrar da sua visita (${t.title}) em ${when}. Qualquer imprevisto é só avisar por aqui. 😊`, "Lembrete de visita");
      if (t.assignedTo) await notify({ workspaceId: t.workspaceId, userId: t.assignedTo.id, title: `Lembrete: visita com ${t.contact.name ?? "cliente"}`, body: when, link: "/agenda" });
      await logActivity({ workspaceId: t.workspaceId, contactId: t.contact.id, type: "SYSTEM", title: sent ? "Lembrete de visita enviado ao cliente" : "Lembrete de visita enviado ao corretor (janela da Meta fechada)", meta: { automationKey: key } });
      n++;
    }
  }
  return n;
}

async function postVisit() {
  let n = 0;
  for (const rule of await enabledRules("POST_VISIT")) {
    const tasks = await prisma.task.findMany({
      where: { workspaceId: rule.workspaceId, type: "VISIT", isCompleted: true, completedAt: { gte: new Date(Date.now() - 48 * 3600000), lte: new Date(Date.now() - 12 * 3600000) } },
      include: { contact: true },
    });
    for (const t of tasks) {
      if (!t.contact) continue;
      const key = `post-visit:${t.id}`;
      if (await alreadyDone(t.contact.id, key)) continue;
      const sent = await messageContact(t.contact.id, `Oi${t.contact.name ? `, ${firstName(t.contact.name)}` : ""}! O que achou do imóvel que você visitou? De 0 a 10, quanto ele combina com o que você procura?`, "Pós-visita");
      await logActivity({ workspaceId: t.workspaceId, contactId: t.contact.id, type: "SYSTEM", title: sent ? "Mensagem de pós-visita enviada" : "Pós-visita pendente (janela da Meta fechada)", meta: { automationKey: key } });
      n++;
    }
  }
  return n;
}

async function brokerFollowup() {
  let n = 0;
  for (const rule of await enabledRules("BROKER_FOLLOWUP")) {
    const minutes = Number((rule.configJson as RuleCfg).minutesWithoutReply ?? 30);
    const convs = await prisma.conversation.findMany({
      where: { workspaceId: rule.workspaceId, status: { in: ["UNREAD", "NEEDS_REPLY"] }, assignedToId: { not: null }, lastContactMessageAt: { lt: new Date(Date.now() - minutes * 60000), gt: new Date(Date.now() - 24 * 3600000) } },
      include: { contact: true },
    });
    for (const c of convs) {
      const key = `followup:${c.id}:${c.lastContactMessageAt?.toISOString()}`;
      if (await alreadyDone(c.contactId, key)) continue;
      await notify({ workspaceId: c.workspaceId, userId: c.assignedToId!, title: `⏰ ${c.contact.name ?? "Lead"} está esperando resposta há mais de ${minutes} min`, link: `/atendimento?conversa=${c.id}` });
      await logActivity({ workspaceId: c.workspaceId, contactId: c.contactId, type: "SYSTEM", title: "Corretor cobrado por demora na resposta", meta: { automationKey: key } });
      n++;
    }
  }
  return n;
}

async function reengagement() {
  let n = 0;
  for (const rule of await enabledRules("LEAD_REENGAGEMENT")) {
    const days = Number((rule.configJson as RuleCfg).inactiveDays ?? 15);
    const contacts = await prisma.contact.findMany({
      where: { workspaceId: rule.workspaceId, status: "OPEN", lastInteractionAt: { lt: new Date(Date.now() - days * 86400000), gt: new Date(Date.now() - (days + 1) * 86400000) } },
      take: 50,
    });
    for (const c of contacts) {
      const key = `reengage:${c.id}:${days}`;
      if (await alreadyDone(c.id, key)) continue;
      const sent = await messageContact(c.id, `Oi${c.name ? `, ${firstName(c.name)}` : ""}! Tudo bem? Ainda está procurando imóvel? Chegaram opções novas que podem te interessar.`, "Reengajamento");
      await logActivity({ workspaceId: c.workspaceId, contactId: c.id, type: "SYSTEM", title: sent ? "Mensagem de reengajamento enviada" : "Lead elegível para reengajamento (use uma campanha com modelo aprovado)", meta: { automationKey: key } });
      n++;
    }
  }
  return n;
}

async function annualDates() {
  let n = 0;
  const today = new Date();
  for (const rule of await enabledRules("ANNUAL_DATES")) {
    const contacts = await prisma.$queryRaw<{ id: string; name: string | null }[]>`
      SELECT id, name FROM "Contact" WHERE "workspaceId" = ${rule.workspaceId} AND "birthDate" IS NOT NULL
      AND EXTRACT(MONTH FROM "birthDate") = ${today.getMonth() + 1} AND EXTRACT(DAY FROM "birthDate") = ${today.getDate()}`;
    for (const c of contacts) {
      const key = `birthday:${c.id}:${today.getFullYear()}`;
      if (await alreadyDone(c.id, key)) continue;
      const sent = await messageContact(c.id, `Feliz aniversário${c.name ? `, ${firstName(c.name)}` : ""}! 🎉 Toda a equipe deseja um ano incrível pra você!`, "Datas anuais");
      await logActivity({ workspaceId: rule.workspaceId, contactId: c.id, type: "SYSTEM", title: sent ? "Mensagem de aniversário enviada" : "Aniversário do cliente hoje", meta: { automationKey: key } });
      n++;
    }
  }
  return n;
}

let running = false;
export async function tick() {
  if (running) return { skipped: true };
  running = true;
  try {
    const [timeouts, campaigns, reminders, post, follow, reeng, annual] = [
      await processAiTimeouts(),
      await processScheduledCampaigns(),
      await visitReminders(),
      await postVisit(),
      await brokerFollowup(),
      await reengagement(),
      await annualDates(),
    ];
    return { timeouts, campaigns, reminders, post, follow, reeng, annual };
  } finally {
    running = false;
  }
}
