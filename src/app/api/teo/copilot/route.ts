import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { body, route } from "@/lib/api";
import { answerQuestion, COPILOT_SHORTCUTS, runShortcut, type ShortcutKey } from "@/lib/services/copilot";
import { llmAvailable } from "@/lib/ai/llm";

export const GET = route(async ({ req, session }) => {
  const threadId = req.nextUrl.searchParams.get("thread");
  const threads = await prisma.copilotMessage.findMany({
    where: { userId: session.user.id, workspaceId: session.workspace.id, role: "user" },
    distinct: ["threadId"],
    orderBy: { createdAt: "desc" },
    take: 15,
  });
  const messages = threadId
    ? await prisma.copilotMessage.findMany({ where: { userId: session.user.id, threadId }, orderBy: { createdAt: "asc" } })
    : [];
  return { shortcuts: COPILOT_SHORTCUTS, threads: threads.map((t) => ({ id: t.threadId, title: t.content.slice(0, 60), createdAt: t.createdAt })), messages, llm: llmAvailable() };
}, { module: "teo" });

const schema = z.object({ threadId: z.string().min(4), question: z.string().max(1000).optional(), shortcut: z.string().optional() });

export const POST = route(async ({ req, session }) => {
  const d = await body(req, schema);
  const keys = COPILOT_SHORTCUTS.map((s) => s.key) as string[];
  const label = d.shortcut ? COPILOT_SHORTCUTS.find((s) => s.key === d.shortcut)?.label ?? d.shortcut : d.question ?? "";
  const history = (await prisma.copilotMessage.findMany({ where: { userId: session.user.id, threadId: d.threadId }, orderBy: { createdAt: "asc" }, take: 20 })).map((m) => ({
    role: m.role as "user" | "assistant",
    content: m.content,
  }));
  const report = d.shortcut && keys.includes(d.shortcut) ? await runShortcut(session, d.shortcut as ShortcutKey) : await answerQuestion(session, d.question ?? "", history);
  await prisma.copilotMessage.createMany({
    data: [
      { workspaceId: session.workspace.id, userId: session.user.id, threadId: d.threadId, role: "user", content: label },
      { workspaceId: session.workspace.id, userId: session.user.id, threadId: d.threadId, role: "assistant", content: JSON.stringify(report) },
    ],
  });
  return report;
}, { module: "teo" });
