// Adaptador Evolution API (WhatsApp via QR Code)
import type { WhatsAppChannel } from "@prisma/client";
import { simulatedId, WhatsAppError, type SendResult, type WhatsAppAdapter } from "./types";

function cfg(channel: Pick<WhatsAppChannel, "evolutionApiUrl" | "evolutionApiKey" | "evolutionInstance">) {
  const url = (channel.evolutionApiUrl || process.env.EVOLUTION_API_URL || "").replace(/\/$/, "");
  const key = channel.evolutionApiKey || process.env.EVOLUTION_API_KEY || "";
  return { url, key, instance: channel.evolutionInstance || "" };
}

export function isEvolutionLive(channel: Pick<WhatsAppChannel, "evolutionApiUrl" | "evolutionApiKey" | "evolutionInstance">) {
  const c = cfg(channel);
  return !!c.url && !!c.key && !!c.instance;
}

async function call<T>(channel: WhatsAppChannel, path: string, body?: unknown, method = "POST"): Promise<T> {
  const c = cfg(channel);
  const res = await fetch(`${c.url}${path}`, {
    method,
    headers: { apikey: c.key, "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = (await res.json().catch(() => ({}))) as T & { message?: string };
  if (!res.ok) throw new WhatsAppError((data as { message?: string })?.message || `Evolution API ${res.status}`, data);
  return data;
}

type EvoSend = { key?: { id?: string } };

export const evolutionAdapter: WhatsAppAdapter = {
  async sendText(channel, to, text): Promise<SendResult> {
    if (!isEvolutionLive(channel)) return { id: simulatedId("evo"), simulated: true };
    const r = await call<EvoSend>(channel, `/message/sendText/${channel.evolutionInstance}`, { number: to, text });
    return { id: r.key?.id ?? simulatedId("evo"), simulated: false };
  },
  async sendMedia(channel, to, media): Promise<SendResult> {
    if (!isEvolutionLive(channel)) return { id: simulatedId("evo"), simulated: true };
    if (media.type === "audio") {
      const r = await call<EvoSend>(channel, `/message/sendWhatsAppAudio/${channel.evolutionInstance}`, { number: to, audio: media.url });
      return { id: r.key?.id ?? simulatedId("evo"), simulated: false };
    }
    const r = await call<EvoSend>(channel, `/message/sendMedia/${channel.evolutionInstance}`, {
      number: to,
      mediatype: media.type,
      media: media.url,
      caption: media.caption,
    });
    return { id: r.key?.id ?? simulatedId("evo"), simulated: false };
  },
  async sendTemplate(channel, to, { bodyParams, template }) {
    // Números QR não têm templates oficiais: envia o corpo já renderizado como texto
    void template;
    return this.sendText(channel, to, bodyParams.join("\n"));
  },
};

/** Cria (se necessário) a instância e retorna o QR Code em base64. */
export async function evolutionConnect(channel: WhatsAppChannel, webhookUrl: string): Promise<{ qrCode: string | null; simulated: boolean; state?: string }> {
  if (!isEvolutionLive(channel)) return { qrCode: null, simulated: true };
  try {
    await call(channel, `/instance/create`, {
      instanceName: channel.evolutionInstance,
      integration: "WHATSAPP-BAILEYS",
      qrcode: true,
      webhook: { url: webhookUrl, byEvents: false, base64: true, events: ["MESSAGES_UPSERT", "CONNECTION_UPDATE", "QRCODE_UPDATED"] },
    });
  } catch {
    // instância já existe
  }
  const r = await call<{ base64?: string; code?: string; instance?: { state?: string } }>(channel, `/instance/connect/${channel.evolutionInstance}`, undefined, "GET");
  return { qrCode: r.base64 ?? null, simulated: false, state: r.instance?.state };
}
