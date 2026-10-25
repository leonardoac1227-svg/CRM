// Adaptador WhatsApp Cloud API oficial (Meta Graph API)
import type { MessageTemplate, WhatsAppChannel } from "@prisma/client";
import { simulatedId, WhatsAppError, type SendResult, type TemplateSendParams, type WhatsAppAdapter } from "./types";

const GRAPH = () => `https://graph.facebook.com/${process.env.META_GRAPH_VERSION || "v21.0"}`;

/** Canais sem token real (ou de demonstração) operam em modo simulado. */
export function isMetaLive(channel: Pick<WhatsAppChannel, "metaAccessToken" | "metaPhoneNumberId">) {
  return !!channel.metaAccessToken && !!channel.metaPhoneNumberId && !channel.metaAccessToken.startsWith("demo");
}

async function graph<T>(path: string, token: string, body: unknown, method = "POST"): Promise<T> {
  const res = await fetch(`${GRAPH()}/${path}`, {
    method,
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: method === "GET" ? undefined : JSON.stringify(body),
  });
  const data = (await res.json().catch(() => ({}))) as T & { error?: { message?: string } };
  if (!res.ok) throw new WhatsAppError(data?.error?.message || `Meta API ${res.status}`, data);
  return data;
}

type SendResponse = { messages?: { id: string }[] };

export const metaAdapter: WhatsAppAdapter = {
  async sendText(channel, to, text): Promise<SendResult> {
    if (!isMetaLive(channel)) return { id: simulatedId("wamid"), simulated: true };
    const r = await graph<SendResponse>(`${channel.metaPhoneNumberId}/messages`, channel.metaAccessToken!, {
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to,
      type: "text",
      text: { preview_url: true, body: text },
    });
    return { id: r.messages?.[0]?.id ?? simulatedId("wamid"), simulated: false };
  },

  async sendMedia(channel, to, media): Promise<SendResult> {
    if (!isMetaLive(channel)) return { id: simulatedId("wamid"), simulated: true };
    const r = await graph<SendResponse>(`${channel.metaPhoneNumberId}/messages`, channel.metaAccessToken!, {
      messaging_product: "whatsapp",
      to,
      type: media.type,
      [media.type]: { link: media.url, ...(media.caption && media.type !== "audio" ? { caption: media.caption } : {}) },
    });
    return { id: r.messages?.[0]?.id ?? simulatedId("wamid"), simulated: false };
  },

  async sendTemplate(channel, to, { template, bodyParams }: TemplateSendParams): Promise<SendResult> {
    if (!isMetaLive(channel)) return { id: simulatedId("wamid"), simulated: true };
    const components: unknown[] = [];
    if (template.headerType === "IMAGE" || template.headerType === "VIDEO" || template.headerType === "DOCUMENT") {
      const kind = template.headerType.toLowerCase();
      components.push({ type: "header", parameters: [{ type: kind, [kind]: { link: template.headerContent } }] });
    }
    if (bodyParams.length) components.push({ type: "body", parameters: bodyParams.map((text) => ({ type: "text", text: text || " " })) });
    const r = await graph<SendResponse>(`${channel.metaPhoneNumberId}/messages`, channel.metaAccessToken!, {
      messaging_product: "whatsapp",
      to,
      type: "template",
      template: { name: template.name, language: { code: template.language }, components },
    });
    return { id: r.messages?.[0]?.id ?? simulatedId("wamid"), simulated: false };
  },
};

/** Envia o template para aprovação na WABA. Em modo simulado retorna aprovado. */
export async function submitTemplateToMeta(
  channel: WhatsAppChannel | null,
  t: MessageTemplate,
): Promise<{ status: "APPROVED" | "PENDING" | "REJECTED"; id: string; simulated: boolean }> {
  if (!channel || !isMetaLive(channel) || !channel.metaWabaId) {
    return { status: "APPROVED", id: simulatedId("tpl"), simulated: true };
  }
  const components: unknown[] = [];
  if (t.headerType === "TEXT" && t.headerContent) components.push({ type: "HEADER", format: "TEXT", text: t.headerContent });
  else if (t.headerType !== "NONE" && t.headerContent)
    components.push({ type: "HEADER", format: t.headerType, example: { header_handle: [t.headerContent] } });
  const varCount = (t.bodyText.match(/\{\{\d+\}\}/g) || []).length;
  components.push({
    type: "BODY",
    text: t.bodyText,
    ...(varCount ? { example: { body_text: [Array.from({ length: varCount }, (_, i) => `exemplo${i + 1}`)] } } : {}),
  });
  if (t.footerText) components.push({ type: "FOOTER", text: t.footerText });
  const buttons = (t.buttonsJson as { type: string; text: string; value?: string }[]) || [];
  if (buttons.length)
    components.push({
      type: "BUTTONS",
      buttons: buttons.map((b) =>
        b.type === "URL" ? { type: "URL", text: b.text, url: b.value } : b.type === "PHONE_NUMBER" ? { type: "PHONE_NUMBER", text: b.text, phone_number: b.value } : { type: "QUICK_REPLY", text: b.text },
      ),
    });
  const r = await graph<{ id: string; status: string }>(`${channel.metaWabaId}/message_templates`, channel.metaAccessToken!, {
    name: t.name,
    language: t.language,
    category: t.category,
    components,
  });
  const status = (r.status || "PENDING").toUpperCase();
  return { status: status === "APPROVED" ? "APPROVED" : status === "REJECTED" ? "REJECTED" : "PENDING", id: r.id, simulated: false };
}
