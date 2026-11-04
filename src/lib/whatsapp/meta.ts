// Adaptador WhatsApp Cloud API oficial (Meta Graph API)
import type { MessageTemplate, WhatsAppChannel } from "@prisma/client";
import { WhatsAppError, type SendResult, type TemplateSendParams, type WhatsAppAdapter } from "./types";

const GRAPH = () => `https://graph.facebook.com/${process.env.META_GRAPH_VERSION || "v21.0"}`;

export const graphBase = () => GRAPH();

/** O número tem as credenciais da API oficial preenchidas? */
export function isMetaConfigured(channel: Pick<WhatsAppChannel, "metaAccessToken" | "metaPhoneNumberId">) {
  return !!channel.metaAccessToken && !!channel.metaPhoneNumberId;
}

function requireMeta(channel: Pick<WhatsAppChannel, "metaAccessToken" | "metaPhoneNumberId" | "name">) {
  if (!isMetaConfigured(channel)) {
    throw new WhatsAppError(`O número "${channel.name}" ainda não tem o token e o ID da Meta. Abra Integrações › WhatsApp Oficial e conclua a configuração.`);
  }
}

export async function graph<T>(path: string, token: string, body: unknown, method = "POST"): Promise<T> {
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
    requireMeta(channel);
    const r = await graph<SendResponse>(`${channel.metaPhoneNumberId}/messages`, channel.metaAccessToken!, {
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to,
      type: "text",
      text: { preview_url: true, body: text },
    });
    return { id: r.messages?.[0]?.id ?? "" };
  },

  async sendMedia(channel, to, media): Promise<SendResult> {
    requireMeta(channel);
    const r = await graph<SendResponse>(`${channel.metaPhoneNumberId}/messages`, channel.metaAccessToken!, {
      messaging_product: "whatsapp",
      to,
      type: media.type,
      [media.type]: { link: media.url, ...(media.caption && media.type !== "audio" ? { caption: media.caption } : {}) },
    });
    return { id: r.messages?.[0]?.id ?? "" };
  },

  async sendTemplate(channel, to, { template, bodyParams }: TemplateSendParams): Promise<SendResult> {
    requireMeta(channel);
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
    return { id: r.messages?.[0]?.id ?? "" };
  },
};

/** Envia o template para aprovação na WABA (conta do WhatsApp Business na Meta). */
export async function submitTemplateToMeta(
  channel: WhatsAppChannel | null,
  t: MessageTemplate,
): Promise<{ status: "APPROVED" | "PENDING" | "REJECTED"; id: string }> {
  if (!channel) throw new WhatsAppError("Escolha um número da API oficial para este modelo.");
  if (channel.provider !== "META_OFFICIAL") throw new WhatsAppError("Modelos só existem na API oficial da Meta. Números de QR Code enviam o texto direto, sem aprovação.");
  requireMeta(channel);
  if (!channel.metaWabaId) throw new WhatsAppError(`Falta o ID da conta do WhatsApp Business (WABA ID) no número "${channel.name}".`);
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
  return { status: status === "APPROVED" ? "APPROVED" : status === "REJECTED" ? "REJECTED" : "PENDING", id: r.id };
}

/** Busca o status atual de um modelo na Meta (para atualizar "Em análise" → "Aprovado"). */
export async function fetchTemplateStatus(channel: WhatsAppChannel, metaTemplateId: string) {
  requireMeta(channel);
  const r = await graph<{ status?: string; rejected_reason?: string }>(`${metaTemplateId}?fields=status,rejected_reason`, channel.metaAccessToken!, undefined, "GET");
  const st = (r.status || "PENDING").toUpperCase();
  return { status: (st === "APPROVED" ? "APPROVED" : st === "REJECTED" ? "REJECTED" : "PENDING") as "APPROVED" | "PENDING" | "REJECTED", reason: r.rejected_reason && r.rejected_reason !== "NONE" ? r.rejected_reason : null };
}

/**
 * Testa as credenciais do número na Meta e inscreve o app na WABA (sem isso o webhook não recebe mensagens).
 * Retorna o telefone e o nome verificados.
 */
export async function verifyMetaChannel(channel: Pick<WhatsAppChannel, "metaAccessToken" | "metaPhoneNumberId" | "metaWabaId" | "name">) {
  requireMeta(channel);
  const info = await graph<{ display_phone_number?: string; verified_name?: string; quality_rating?: string }>(
    `${channel.metaPhoneNumberId}?fields=display_phone_number,verified_name,quality_rating`,
    channel.metaAccessToken!,
    undefined,
    "GET",
  );
  let subscribed = false;
  if (channel.metaWabaId) {
    await graph(`${channel.metaWabaId}/subscribed_apps`, channel.metaAccessToken!, {});
    subscribed = true;
  }
  return { phone: info.display_phone_number ?? null, verifiedName: info.verified_name ?? null, quality: info.quality_rating ?? null, subscribed };
}
