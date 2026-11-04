import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { body, route } from "@/lib/api";
import { HttpError } from "@/lib/auth";
import { isManagerLike, seesOnlyOwn } from "@/lib/rbac";
import { normalizePhone } from "@/lib/utils";
import { verifyMetaChannel } from "@/lib/whatsapp/meta";
import { evolutionServerConfigured } from "@/lib/whatsapp/evolution";
import { WhatsAppError } from "@/lib/whatsapp/types";
import { safeChannel } from "@/lib/whatsapp/safe";

export const GET = route(async ({ session }) => {
  const channels = await prisma.whatsAppChannel.findMany({
    where: { workspaceId: session.workspace.id, ...(seesOnlyOwn(session.user) ? { OR: [{ userId: session.user.id }, { accountType: "COMPANY" }] } : {}) },
    include: { user: { select: { id: true, name: true } }, _count: { select: { conversations: true } } },
    orderBy: [{ accountType: "asc" }, { name: "asc" }],
  });
  return channels.map((c) => safeChannel(c));
});

const schema = z.object({
  name: z.string().min(2, "Dê um nome para identificar o número"),
  phoneNumber: z.string().optional(),
  provider: z.enum(["META_OFFICIAL", "EVOLUTION_QR"]),
  accountType: z.enum(["COMPANY", "BROKER"]),
  userId: z.string().nullable().optional(),
  metaWabaId: z.string().trim().optional(),
  metaPhoneNumberId: z.string().trim().optional(),
  metaAccessToken: z.string().trim().optional(),
  metaAppSecret: z.string().trim().optional(),
});

export const POST = route(async ({ req, session }) => {
  const d = await body(req, schema);
  const manager = isManagerLike(session.user);
  // O corretor pode conectar o próprio WhatsApp pelo QR Code; o resto é com o gestor
  if (!manager && !(d.provider === "EVOLUTION_QR" && session.user.role === "BROKER")) throw new HttpError(403, "Apenas gestores podem adicionar números");
  const userId = manager ? d.userId || null : session.user.id;
  const accountType = manager ? d.accountType : "BROKER";

  if (d.provider === "META_OFFICIAL") {
    if (!d.metaPhoneNumberId || !d.metaAccessToken || !d.metaWabaId) throw new HttpError(400, "Preencha o Token, o ID do número e o ID da conta (WABA) — eles ficam na página da API do WhatsApp na Meta.");
    if (await prisma.whatsAppChannel.findUnique({ where: { metaPhoneNumberId: d.metaPhoneNumberId } })) throw new HttpError(409, "Este número da Meta já está conectado ao Ápice.");
    let info;
    try {
      info = await verifyMetaChannel({ name: d.name, metaAccessToken: d.metaAccessToken, metaPhoneNumberId: d.metaPhoneNumberId, metaWabaId: d.metaWabaId });
    } catch (e) {
      if (!(e instanceof WhatsAppError)) throw new HttpError(502, "Não conseguimos falar com a Meta agora (falha de conexão). Espere um minuto e tente de novo.");
      throw new HttpError(400, `A Meta não aceitou esses dados: ${e.message}. Confira se copiou o token inteiro e os IDs certos.`);
    }
    const ch = await prisma.whatsAppChannel.create({
      data: {
        workspaceId: session.workspace.id,
        name: d.name,
        phoneNumber: normalizePhone(info.phone || d.phoneNumber || ""),
        provider: "META_OFFICIAL",
        accountType,
        userId,
        status: "CONNECTED",
        metaWabaId: d.metaWabaId,
        metaPhoneNumberId: d.metaPhoneNumberId,
        metaAccessToken: d.metaAccessToken,
        metaAppSecret: d.metaAppSecret || null,
        metaVerifiedName: info.verifiedName,
        lastActivityAt: new Date(),
      },
    });
    return { ...safeChannel(ch), verified: info };
  }

  if (!evolutionServerConfigured()) throw new HttpError(400, "O servidor de WhatsApp por QR Code ainda não foi configurado. Peça ao administrador da conta para seguir o guia “Colocar no ar” (EVOLUTION_API_URL e EVOLUTION_API_KEY).");
  const phone = normalizePhone(d.phoneNumber || "");
  if (phone.length < 10) throw new HttpError(400, "Informe o número do WhatsApp com DDD.");
  const ch = await prisma.whatsAppChannel.create({
    data: {
      workspaceId: session.workspace.id,
      name: d.name,
      phoneNumber: phone,
      provider: "EVOLUTION_QR",
      accountType,
      userId,
      status: "DISCONNECTED",
      evolutionInstance: `apice-${session.workspace.id.slice(-6)}-${phone.slice(-8)}-${Date.now().toString(36).slice(-4)}`,
    },
  });
  return safeChannel(ch);
}, { module: "integracoes" });
