import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ingestInbound } from "@/lib/services/messaging";
import { loadAiConfig, mediaToText, runAiTurn } from "@/lib/services/ai-runner";

export const dynamic = "force-dynamic";

type EvoPayload = {
  event?: string;
  instance?: string;
  apikey?: string;
  data?: {
    key?: { remoteJid?: string; fromMe?: boolean; id?: string };
    pushName?: string;
    messageType?: string;
    message?: {
      conversation?: string;
      extendedTextMessage?: { text?: string };
      imageMessage?: { caption?: string; url?: string };
      audioMessage?: { url?: string };
      documentMessage?: { caption?: string; fileName?: string; url?: string };
      buttonsResponseMessage?: { selectedDisplayText?: string };
      base64?: string;
    };
    state?: string;
    qrcode?: { base64?: string };
  };
};

/** Webhook da Evolution API (QR Code): mensagens, status de conexão e QR. */
export async function POST(req: NextRequest) {
  const p = (await req.json().catch(() => ({}))) as EvoPayload;
  if (!p.instance) return NextResponse.json({ ok: false }, { status: 400 });
  const channel = await prisma.whatsAppChannel.findUnique({ where: { evolutionInstance: p.instance } });
  if (!channel) return NextResponse.json({ ok: false }, { status: 404 });
  const expectedKey = channel.evolutionApiKey || process.env.EVOLUTION_API_KEY;
  const gotKey = p.apikey || req.headers.get("apikey");
  if (expectedKey && gotKey && gotKey !== expectedKey) return NextResponse.json({ ok: false }, { status: 401 });

  const event = (p.event || "").toLowerCase().replace("_", ".");
  if (event === "connection.update") {
    const state = p.data?.state;
    await prisma.whatsAppChannel.update({ where: { id: channel.id }, data: { status: state === "open" ? "CONNECTED" : state === "connecting" ? "ATTENTION" : "DISCONNECTED", qrCode: state === "open" ? null : undefined } });
    return NextResponse.json({ ok: true });
  }
  if (event === "qrcode.updated") {
    await prisma.whatsAppChannel.update({ where: { id: channel.id }, data: { qrCode: p.data?.qrcode?.base64 ?? null, status: "ATTENTION" } });
    return NextResponse.json({ ok: true });
  }
  if (event !== "messages.upsert" || !p.data?.key || p.data.key.fromMe) return NextResponse.json({ ok: true });
  const jid = p.data.key.remoteJid ?? "";
  if (jid.endsWith("@g.us")) return NextResponse.json({ ok: true }); // ignora grupos
  const msg = p.data.message ?? {};
  let mediaType: "TEXT" | "AUDIO" | "IMAGE" | "DOCUMENT" = "TEXT";
  let text = msg.conversation ?? msg.extendedTextMessage?.text ?? msg.buttonsResponseMessage?.selectedDisplayText ?? "";
  let media: string | null = null;
  if (msg.audioMessage) { mediaType = "AUDIO"; text = "🎙️ Áudio"; media = msg.base64 ? `data:audio/ogg;base64,${msg.base64}` : msg.audioMessage.url ?? null; }
  if (msg.imageMessage) { mediaType = "IMAGE"; text = msg.imageMessage.caption || "📷 Imagem"; media = msg.base64 ? `data:image/jpeg;base64,${msg.base64}` : msg.imageMessage.url ?? null; }
  if (msg.documentMessage) { mediaType = "DOCUMENT"; text = msg.documentMessage.caption || `📄 ${msg.documentMessage.fileName ?? "Documento"}`; }

  void (async () => {
    const r = await ingestInbound({ workspaceId: channel.workspaceId, channelId: channel.id, from: jid.split("@")[0], profileName: p.data?.pushName, text, mediaType, mediaUrl: media && !media.startsWith("data:") ? media : null, metaMessageId: p.data?.key?.id ?? null });
    if (r.duplicate || !r.aiActive) return;
    const cfg = await loadAiConfig(channel.workspaceId);
    let aiText = text;
    if (cfg && mediaType !== "TEXT") {
      const conv = await mediaToText(cfg, mediaType, media, mediaType === "AUDIO" ? "" : text);
      if (conv.note) await prisma.message.update({ where: { id: r.message.id }, data: { content: conv.note } });
      aiText = conv.text || "[o cliente enviou um áudio que não pôde ser transcrito]";
    }
    await runAiTurn(r.conversation.id, aiText);
  })().catch((e) => console.error("[evolution webhook]", e));
  return NextResponse.json({ ok: true });
}
