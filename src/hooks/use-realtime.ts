"use client";
import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { io, type Socket } from "socket.io-client";
import { toast } from "sonner";

let socket: Socket | null = null;

/** Conecta ao Socket.io e invalida as queries afetadas por cada evento. */
export function useRealtime(enabled: boolean) {
  const qc = useQueryClient();
  useEffect(() => {
    if (!enabled) return;
    socket ??= io({ path: "/socket.io", withCredentials: true, reconnectionDelay: 2000, transports: ["websocket", "polling"] });
    const onMessage = (p: { conversationId?: string }) => {
      qc.invalidateQueries({ queryKey: ["conversations"] });
      if (p.conversationId) qc.invalidateQueries({ queryKey: ["conversation", p.conversationId] });
    };
    const onContact = (p: { contactId?: string }) => {
      qc.invalidateQueries({ queryKey: ["contacts"] });
      qc.invalidateQueries({ queryKey: ["board"] });
      if (p.contactId) qc.invalidateQueries({ queryKey: ["contact", p.contactId] });
    };
    const onNotification = (p: { title?: string }) => {
      qc.invalidateQueries({ queryKey: ["notifications"] });
      if (p.title) toast(p.title);
    };
    const onCampaign = () => qc.invalidateQueries({ queryKey: ["campaigns"] });
    socket.on("message:new", onMessage);
    socket.on("conversation:updated", onMessage);
    socket.on("contact:updated", onContact);
    socket.on("notification:new", onNotification);
    socket.on("campaign:progress", onCampaign);
    return () => {
      socket?.off("message:new", onMessage);
      socket?.off("conversation:updated", onMessage);
      socket?.off("contact:updated", onContact);
      socket?.off("notification:new", onNotification);
      socket?.off("campaign:progress", onCampaign);
    };
  }, [enabled, qc]);
}

export function isRealtimeConnected() {
  return !!socket?.connected;
}
