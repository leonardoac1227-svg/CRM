import { prisma } from "@/lib/prisma";
import { route } from "@/lib/api";
import { HttpError } from "@/lib/auth";
import { publicAppUrl } from "@/lib/public-url";
import { evolutionConnect } from "@/lib/whatsapp/evolution";
import { verifyMetaChannel } from "@/lib/whatsapp/meta";
import { WhatsAppError } from "@/lib/whatsapp/types";

/**
 * API oficial: testa o token na Meta e reinscreve o app na WABA.
 * QR Code: cria a instância na Evolution API e devolve o QR Code para escanear.
 */
export const POST = route<{ id: string }>(async ({ req, params, session }) => {
  const ch = await prisma.whatsAppChannel.findFirst({ where: { id: params.id, workspaceId: session.workspace.id } });
  if (!ch) throw new HttpError(404, "Número não encontrado");
  if (session.user.role === "BROKER" && ch.userId !== session.user.id) throw new HttpError(403, "Você só pode conectar o seu número");
  try {
    if (ch.provider === "META_OFFICIAL") {
      const info = await verifyMetaChannel(ch);
      await prisma.whatsAppChannel.update({ where: { id: ch.id }, data: { status: "CONNECTED", metaVerifiedName: info.verifiedName ?? ch.metaVerifiedName, lastActivityAt: new Date() } });
      return { status: "CONNECTED", qrCode: null, info };
    }
    const r = await evolutionConnect(ch, `${publicAppUrl(req.nextUrl.origin)}/api/webhooks/evolution`);
    const connected = r.state === "open";
    await prisma.whatsAppChannel.update({ where: { id: ch.id }, data: { qrCode: connected ? null : r.qrCode, status: connected ? "CONNECTED" : "ATTENTION" } });
    return { status: connected ? "CONNECTED" : "ATTENTION", qrCode: r.qrCode, info: null };
  } catch (e) {
    await prisma.whatsAppChannel.update({ where: { id: ch.id }, data: { status: "ATTENTION" } });
    if (!(e instanceof WhatsAppError)) throw new HttpError(502, "Não conseguimos falar com o servidor do WhatsApp agora (falha de conexão). Tente de novo em instantes.");
    throw new HttpError(400, e.message);
  }
});
