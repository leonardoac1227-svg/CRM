import { prisma } from "@/lib/prisma";
import { route } from "@/lib/api";
import { HttpError } from "@/lib/auth";
import { evolutionConnect } from "@/lib/whatsapp/evolution";

/** Gera o QR Code (Evolution API). Em modo simulado, conecta direto para fins de demonstração. */
export const POST = route<{ id: string }>(async ({ params, session }) => {
  const ch = await prisma.whatsAppChannel.findFirst({ where: { id: params.id, workspaceId: session.workspace.id } });
  if (!ch) throw new HttpError(404, "Número não encontrado");
  if (session.user.role === "BROKER" && ch.userId !== session.user.id) throw new HttpError(403, "Você só pode conectar o seu número");
  if (ch.provider !== "EVOLUTION_QR") {
    const ok = !!ch.metaAccessToken && !!ch.metaPhoneNumberId;
    const updated = await prisma.whatsAppChannel.update({ where: { id: ch.id }, data: { status: ok ? "CONNECTED" : "ATTENTION" } });
    return { status: updated.status, qrCode: null, simulated: ch.metaAccessToken?.startsWith("demo") ?? true };
  }
  const appUrl = process.env.APP_URL || "http://localhost:3000";
  const r = await evolutionConnect(ch, `${appUrl}/api/webhooks/evolution`);
  if (r.simulated) {
    const updated = await prisma.whatsAppChannel.update({ where: { id: ch.id }, data: { status: "CONNECTED", lastActivityAt: new Date(), qrCode: null } });
    return { status: updated.status, qrCode: null, simulated: true };
  }
  await prisma.whatsAppChannel.update({ where: { id: ch.id }, data: { qrCode: r.qrCode, status: r.state === "open" ? "CONNECTED" : "ATTENTION" } });
  return { status: r.state === "open" ? "CONNECTED" : "ATTENTION", qrCode: r.qrCode, simulated: false };
});
