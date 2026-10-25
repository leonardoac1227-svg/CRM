import { NextRequest, NextResponse } from "next/server";
import crypto from "node:crypto";
import { prisma } from "@/lib/prisma";
import { ingestInbound } from "@/lib/services/messaging";
import { loadAiConfig, mediaToText, runAiTurn } from "@/lib/services/ai-runner";
import { emitWorkspace } from "@/lib/realtime";

export const dynamic = "force-dynamic";

/** Verificação do webhook (Meta envia hub.challenge). */
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  if (sp.get("hub.mode") === "subscribe" && sp.get("hub.verify_token") === (process.env.META_WEBHOOK_VERIFY_TOKEN || "teo-verify-token")) {
    return new NextResponse(sp.get("hub.challenge") ?? "", { status: 200 });
  }
  return new NextResponse("Forbidden", { status: 403 });
}

type MetaMessage = {
  from: string;
  id: string;
  type: string;
  text?: { body: string };
  audio?: { id: string };
  voice?: { id: string };
  image?: { id: string; caption?: string };
  document?: { id: string; caption?: string; filename?: string };
  button?: { text: string };
  interactive?: { button_reply?: { title: string }; list_reply?: { title: string } };
};
type MetaValue = {
  metadata?: { phone_number_id: string };
  contacts?: { wa_id: string; profile?: { name?: string } }[];
  messages?: MetaMessage[];
  statuses?: { id: string; status: "sent" | "delivered" | "read" | "failed" }[];
};

async function mediaUrl(mediaId: string, token: string | null) {
  if (!token || token.startsWith("demo")) return null;
  const r = await fetch(`https://graph.facebook.com/${process.env.META_GRAPH_VERSION || "v21.0"}/${mediaId}`, { headers: { Authorization: `Bearer ${token}` } });
  if (!r.ok) return null;
  return ((await r.json()) as { url?: string }).url ?? null;
}

async function processValue(value: MetaValue) {
  const pnid = value.metadata?.phone_number_id;
  if (!pnid) return;
  const channel = await prisma.whatsAppChannel.findUnique({ where: { metaPhoneNumberId: pnid } });
  if (!channel) return;

  for (const st of value.statuses ?? []) {
    const status = st.status === "read" ? "READ" : st.status === "delivered" ? "DELIVERED" : st.status === "failed" ? "FAILED" : "SENT";
    const msg = await prisma.message.findUnique({ where: { metaMessageId: st.id }, include: { conversation: true } });
    if (!msg) continue;
    await prisma.message.update({ where: { id: msg.id }, data: { status } });
    if (msg.mediaType === "TEMPLATE" && msg.senderName?.startsWith("Campanha")) {
      const rec = await prisma.campaignRecipient.findFirst({ where: { contactId: msg.conversation.contactId, status: { in: ["SENT", "DELIVERED"] } }, orderBy: { sentAt: "desc" } });
      if (rec && (status === "DELIVERED" || status === "READ")) {
        await prisma.campaignRecipient.update({ where: { id: rec.id }, data: { status } });
        await prisma.campaign.update({ where: { id: rec.campaignId }, data: status === "READ" ? { readCount: { increment: 1 } } : { deliveredCount: { increment: 1 } } });
      }
    }
    emitWorkspace(channel.workspaceId, "message:new", { conversationId: msg.conversationId });
  }

  for (const m of value.messages ?? []) {
    const profileName = value.contacts?.find((c) => c.wa_id === m.from)?.profile?.name ?? null;
    let text = m.text?.body ?? m.button?.text ?? m.interactive?.button_reply?.title ?? m.interactive?.list_reply?.title ?? "";
    let mediaType: "TEXT" | "AUDIO" | "IMAGE" | "DOCUMENT" = "TEXT";
    let media: string | null = null;
    const mid = m.audio?.id ?? m.voice?.id ?? m.image?.id ?? m.document?.id;
    if (m.audio || m.voice) { mediaType = "AUDIO"; text = text || "🎙️ Áudio"; }
    if (m.image) { mediaType = "IMAGE"; text = m.image.caption || "📷 Imagem"; }
    if (m.document) { mediaType = "DOCUMENT"; text = m.document.caption || `📄 ${m.document.filename ?? "Documento"}`; }
    if (mid) media = await mediaUrl(mid, channel.metaAccessToken);

    const r = await ingestInbound({ workspaceId: channel.workspaceId, channelId: channel.id, from: m.from, profileName, text, mediaType, mediaUrl: media, metaMessageId: m.id });
    if (r.duplicate || !r.aiActive) continue;
    const cfg = await loadAiConfig(channel.workspaceId);
    let aiText = text;
    if (cfg && mediaType !== "TEXT") {
      const conv = await mediaToText(cfg, mediaType, media, mediaType === "AUDIO" ? "" : text, channel.metaAccessToken ? { Authorization: `Bearer ${channel.metaAccessToken}` } : undefined);
      if (conv.note) await prisma.message.update({ where: { id: r.message.id }, data: { content: conv.note } });
      aiText = conv.text || (mediaType === "AUDIO" ? "[o cliente enviou um áudio que não pôde ser transcrito]" : text);
    }
    await runAiTurn(r.conversation.id, aiText);
  }
}

export async function POST(req: NextRequest) {
  const raw = await req.text();
  const secret = process.env.META_APP_SECRET;
  if (secret) {
    const sig = req.headers.get("x-hub-signature-256") ?? "";
    const expected = "sha256=" + crypto.createHmac("sha256", secret).update(raw).digest("hex");
    if (sig.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return new NextResponse("Invalid signature", { status: 401 });
  }
  let payload: { entry?: { changes?: { value: MetaValue }[] }[] } = {};
  try {
    payload = JSON.parse(raw);
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
  // responde rápido à Meta; processamento segue no servidor
  void (async () => {
    for (const e of payload.entry ?? []) for (const c of e.changes ?? []) await processValue(c.value).catch((err) => console.error("[meta webhook]", err));
  })();
  return NextResponse.json({ ok: true });
}
