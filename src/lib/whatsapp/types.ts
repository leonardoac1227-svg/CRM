import type { MessageTemplate, WhatsAppChannel } from "@prisma/client";

export type SendResult = { id: string; simulated: boolean };

export type TemplateSendParams = {
  template: Pick<MessageTemplate, "name" | "language" | "headerType" | "headerContent">;
  /** Valores já resolvidos para {{1}}, {{2}}… do corpo, em ordem */
  bodyParams: string[];
};

export interface WhatsAppAdapter {
  sendText(channel: WhatsAppChannel, to: string, text: string): Promise<SendResult>;
  sendMedia(channel: WhatsAppChannel, to: string, media: { url: string; type: "image" | "audio" | "document"; caption?: string }): Promise<SendResult>;
  sendTemplate(channel: WhatsAppChannel, to: string, params: TemplateSendParams): Promise<SendResult>;
}

export class WhatsAppError extends Error {
  constructor(message: string, public details?: unknown) {
    super(message);
  }
}

export function simulatedId(prefix: string) {
  return `${prefix}.sim.${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}
