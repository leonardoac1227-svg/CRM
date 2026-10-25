import type { WhatsAppChannel } from "@prisma/client";
import { evolutionAdapter } from "./evolution";
import { metaAdapter } from "./meta";
import type { WhatsAppAdapter } from "./types";

export function adapterFor(channel: Pick<WhatsAppChannel, "provider">): WhatsAppAdapter {
  return channel.provider === "META_OFFICIAL" ? metaAdapter : evolutionAdapter;
}

export { metaAdapter, evolutionAdapter };
export * from "./types";
