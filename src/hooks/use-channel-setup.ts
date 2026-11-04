"use client";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/client";

export type ChannelSetup = {
  appUrl: string;
  meta: { webhookUrl: string; verifyToken: string | null; fields: string[] };
  evolution: { configured: boolean };
  publicUrlOk: boolean;
};

export function useChannelSetup() {
  return useQuery({ queryKey: ["channel-setup"], queryFn: () => api<ChannelSetup>("/api/channels/setup"), staleTime: 300_000 });
}
