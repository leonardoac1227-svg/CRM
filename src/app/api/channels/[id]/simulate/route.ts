import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { body, route } from "@/lib/api";
import { HttpError } from "@/lib/auth";
import { ingestInbound } from "@/lib/services/messaging";
import { runAiTurn } from "@/lib/services/ai-runner";

/**
 * Simula uma mensagem recebida neste número (mesmo pipeline do webhook real).
 * Útil para demonstrar o Téo e o rastreio "[Ref: #SEO-XXXX]" sem um celular.
 */
export const POST = route<{ id: string }>(async ({ req, params, session }) => {
  if (process.env.DEMO_MODE !== "true") throw new HttpError(403, "Simulação desabilitada");
  const ch = await prisma.whatsAppChannel.findFirst({ where: { id: params.id, workspaceId: session.workspace.id } });
  if (!ch) throw new HttpError(404, "Número não encontrado");
  const d = await body(req, z.object({ from: z.string().min(8), name: z.string().optional(), text: z.string().min(1) }));
  const r = await ingestInbound({ workspaceId: session.workspace.id, channelId: ch.id, from: d.from, profileName: d.name, text: d.text });
  if (r.duplicate) return { ok: true };
  if (r.aiActive) await runAiTurn(r.conversation.id, d.text);
  return { ok: true, conversationId: r.conversation.id, contactId: r.contact.id };
});
