// Emissão de eventos Socket.io a partir das rotas (o servidor é registrado em globalThis por server.ts).
import type { Server } from "socket.io";

function io(): Server | undefined {
  return (globalThis as unknown as { __io?: Server }).__io;
}

export type RealtimeEvent =
  | "conversation:updated"
  | "message:new"
  | "contact:updated"
  | "notification:new"
  | "campaign:progress";

export function emitWorkspace(workspaceId: string, event: RealtimeEvent, payload: Record<string, unknown>) {
  io()?.to(`ws:${workspaceId}`).emit(event, payload);
}

export function emitUser(userId: string, event: RealtimeEvent, payload: Record<string, unknown>) {
  io()?.to(`user:${userId}`).emit(event, payload);
}
