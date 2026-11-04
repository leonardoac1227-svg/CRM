import { prisma } from "@/lib/prisma";
import { route } from "@/lib/api";
import { HttpError } from "@/lib/auth";
import { evolutionState } from "@/lib/whatsapp/evolution";

/** Usado pela tela do QR Code enquanto o usuário escaneia: devolve o status e o QR mais recente. */
export const GET = route<{ id: string }>(async ({ params, session }) => {
  let ch = await prisma.whatsAppChannel.findFirst({ where: { id: params.id, workspaceId: session.workspace.id } });
  if (!ch) throw new HttpError(404, "Número não encontrado");
  if (ch.provider === "EVOLUTION_QR" && ch.status !== "CONNECTED") {
    const state = await evolutionState(ch).catch(() => null);
    if (state === "open") ch = await prisma.whatsAppChannel.update({ where: { id: ch.id }, data: { status: "CONNECTED", qrCode: null, lastActivityAt: new Date() } });
  }
  return { status: ch.status, qrCode: ch.qrCode };
});
