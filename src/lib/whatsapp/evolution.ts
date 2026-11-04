// Adaptador Evolution API (WhatsApp via QR Code)
import crypto from "node:crypto";
import type { WhatsAppChannel } from "@prisma/client";
import { WhatsAppError, type SendResult, type WhatsAppAdapter } from "./types";

function cfg(channel: Pick<WhatsAppChannel, "evolutionApiUrl" | "evolutionApiKey" | "evolutionInstance">) {
  const url = (channel.evolutionApiUrl || process.env.EVOLUTION_API_URL || "").replace(/\/$/, "");
  const key = channel.evolutionApiKey || process.env.EVOLUTION_API_KEY || "";
  return { url, key, instance: channel.evolutionInstance || "" };
}

/** Token secreto da instância (enviado pela Evolution nos webhooks). */
export function evolutionInstanceToken(instance: string) {
  return crypto.createHmac("sha256", process.env.JWT_SECRET || "apice-dev").update(`evo:${instance}`).digest("hex").slice(0, 32);
}

/** O servidor da Evolution API (WhatsApp por QR Code) está configurado? */
export function evolutionServerConfigured(channel?: Pick<WhatsAppChannel, "evolutionApiUrl" | "evolutionApiKey"> | null) {
  const url = channel?.evolutionApiUrl || process.env.EVOLUTION_API_URL;
  const key = channel?.evolutionApiKey || process.env.EVOLUTION_API_KEY;
  return !!url && !!key;
}

function requireEvolution(channel: Pick<WhatsAppChannel, "evolutionApiUrl" | "evolutionApiKey" | "evolutionInstance">) {
  const c = cfg(channel);
  if (!c.url || !c.key) throw new WhatsAppError("O servidor de WhatsApp por QR Code (Evolution API) não está configurado. Peça ao administrador para preencher EVOLUTION_API_URL e EVOLUTION_API_KEY.");
  if (!c.instance) throw new WhatsAppError("Este número ainda não foi conectado pelo QR Code.");
}

async function call<T>(channel: WhatsAppChannel, path: string, body?: unknown, method = "POST"): Promise<T> {
  requireEvolution(channel);
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
    const r = await call<EvoSend>(channel, `/message/sendText/${channel.evolutionInstance}`, { number: to, text });
    return { id: r.key?.id ?? "" };
  },
  async sendMedia(channel, to, media): Promise<SendResult> {
    if (media.type === "audio") {
      const r = await call<EvoSend>(channel, `/message/sendWhatsAppAudio/${channel.evolutionInstance}`, { number: to, audio: media.url });
      return { id: r.key?.id ?? "" };
    }
    const r = await call<EvoSend>(channel, `/message/sendMedia/${channel.evolutionInstance}`, {
      number: to,
      mediatype: media.type,
      media: media.url,
      caption: media.caption,
    });
    return { id: r.key?.id ?? "" };
  },
  async sendTemplate(channel, to, { bodyParams, template }) {
    // Números QR não têm templates oficiais: envia o corpo já renderizado como texto
    void template;
    return this.sendText(channel, to, bodyParams.join("\n"));
  },
};

/** Cria (se necessário) a instância e retorna o QR Code em base64. */
export async function evolutionConnect(channel: WhatsAppChannel, webhookUrl: string): Promise<{ qrCode: string | null; state?: string }> {
  requireEvolution(channel);
  try {
    await call(channel, `/instance/create`, {
      instanceName: channel.evolutionInstance,
      token: evolutionInstanceToken(channel.evolutionInstance!),
      integration: "WHATSAPP-BAILEYS",
      qrcode: true,
      webhook: { url: `${webhookUrl}?t=${evolutionInstanceToken(channel.evolutionInstance!)}`, byEvents: false, base64: true, events: ["MESSAGES_UPSERT", "CONNECTION_UPDATE", "QRCODE_UPDATED"] },
    });
  } catch {
    // instância já existe
  }
  const r = await call<{ base64?: string; code?: string; instance?: { state?: string } }>(channel, `/instance/connect/${channel.evolutionInstance}`, undefined, "GET");
  return { qrCode: r.base64 ?? null, state: r.instance?.state };
}

/** Estado atual da conexão da instância ("open" = conectado). */
export async function evolutionState(channel: WhatsAppChannel): Promise<string | null> {
  const r = await call<{ instance?: { state?: string } }>(channel, `/instance/connectionState/${channel.evolutionInstance}`, undefined, "GET");
  return r.instance?.state ?? null;
}

/** Desconecta o celular e remove a instância no servidor. */
export async function evolutionLogout(channel: WhatsAppChannel) {
  await call(channel, `/instance/logout/${channel.evolutionInstance}`, undefined, "DELETE").catch(() => undefined);
  await call(channel, `/instance/delete/${channel.evolutionInstance}`, undefined, "DELETE").catch(() => undefined);
}
