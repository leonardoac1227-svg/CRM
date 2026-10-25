import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { body, route } from "@/lib/api";
import { requireManager } from "@/lib/rbac";
import { AUTOMATION_DEFS } from "@/lib/constants";

export const GET = route(async ({ session }) => {
  const wid = session.workspace.id;
  const [rules, channels, aiConvs, cfg, visits, followups] = await Promise.all([
    prisma.aiAutomationRule.findMany({ where: { workspaceId: wid } }),
    prisma.whatsAppChannel.findMany({ where: { workspaceId: wid }, select: { id: true, name: true, phoneNumber: true, status: true } }),
    prisma.conversation.count({ where: { workspaceId: wid, aiActive: true } }),
    prisma.aiAssistantConfig.findUnique({ where: { workspaceId: wid }, select: { assistantName: true, isActive: true } }),
    prisma.task.count({ where: { workspaceId: wid, type: "VISIT", isCompleted: false, dueDate: { gte: new Date() } } }),
    prisma.conversation.count({ where: { workspaceId: wid, status: { in: ["UNREAD", "NEEDS_REPLY"] }, assignedToId: { not: null } } }),
  ]);
  const usage: Record<string, string> = {
    WHATSAPP_QUALIFICATION: `${aiConvs} conversa${aiConvs === 1 ? "" : "s"}`,
    VISIT_REMINDER: `${visits} visita${visits === 1 ? "" : "s"}`,
    BROKER_FOLLOWUP: `${followups} pendente${followups === 1 ? "" : "s"}`,
  };
  return {
    assistantName: cfg?.assistantName ?? "Téo",
    assistantActive: cfg?.isActive ?? false,
    items: AUTOMATION_DEFS.map((def) => {
      const rule = rules.find((r) => r.type === def.type);
      const cfgJson = (rule?.configJson ?? {}) as { channelIds?: string[]; channelId?: string };
      const ids = cfgJson.channelIds ?? (cfgJson.channelId ? [cfgJson.channelId] : []);
      return {
        ...def,
        id: rule?.id ?? null,
        isEnabled: rule?.isEnabled ?? false,
        configured: !!rule && (rule.isEnabled || Object.keys(cfgJson).length > 0),
        config: cfgJson,
        channels: channels.filter((c) => ids.includes(c.id)),
        usage: usage[def.type] ?? "—",
      };
    }),
    channels,
  };
}, { module: "teo" });

const schema = z.object({ type: z.enum(["WHATSAPP_QUALIFICATION", "VISIT_REMINDER", "BROKER_FOLLOWUP", "POST_VISIT", "LEAD_REENGAGEMENT", "ANNUAL_DATES"]), isEnabled: z.boolean().optional(), config: z.record(z.unknown()).optional() });

export const PATCH = route(async ({ req, session }) => {
  requireManager(session);
  const d = await body(req, schema);
  const rule = await prisma.aiAutomationRule.upsert({
    where: { workspaceId_type: { workspaceId: session.workspace.id, type: d.type } },
    create: { workspaceId: session.workspace.id, type: d.type, isEnabled: d.isEnabled ?? false, configJson: (d.config ?? {}) as object },
    update: { ...(d.isEnabled !== undefined ? { isEnabled: d.isEnabled } : {}), ...(d.config ? { configJson: d.config as object } : {}) },
  });
  if (d.type === "WHATSAPP_QUALIFICATION" && d.isEnabled !== undefined) {
    await prisma.aiAssistantConfig.updateMany({ where: { workspaceId: session.workspace.id }, data: { isActive: d.isEnabled } });
  }
  return rule;
}, { module: "teo" });
