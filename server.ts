// Servidor customizado: Next.js + Socket.io (tempo real) + agendador de automações.
import { createServer } from "node:http";
import { parse } from "node:url";
import next from "next";
import { Server } from "socket.io";
import { prisma } from "./src/lib/prisma";
import { SESSION_COOKIE, verifySession } from "./src/lib/session-token";
import { tick } from "./src/lib/services/automations";

const dev = process.env.NODE_ENV !== "production";
const port = Number(process.env.PORT || 3000);
const app = next({ dev });
const handle = app.getRequestHandler();

function readCookie(header: string | undefined, name: string) {
  if (!header) return null;
  for (const part of header.split(";")) {
    const [k, ...v] = part.trim().split("=");
    if (k === name) return decodeURIComponent(v.join("="));
  }
  return null;
}

app.prepare().then(() => {
  const server = createServer((req, res) => handle(req, res, parse(req.url ?? "/", true)));
  const io = new Server(server, { path: "/socket.io", cors: { origin: false } });
  (globalThis as unknown as { __io?: Server }).__io = io;

  io.use(async (socket, nextFn) => {
    const payload = await verifySession(readCookie(socket.handshake.headers.cookie, SESSION_COOKIE));
    if (!payload) return nextFn(new Error("unauthorized"));
    const user = await prisma.user.findUnique({ where: { id: payload.uid } });
    if (!user) return nextFn(new Error("unauthorized"));
    let workspaceId = user.workspaceId ?? payload.wid ?? null;
    if (!workspaceId && user.agencyId) workspaceId = (await prisma.workspace.findFirst({ where: { agencyId: user.agencyId }, orderBy: { createdAt: "asc" } }))?.id ?? null;
    socket.data = { userId: user.id, workspaceId };
    nextFn();
  });

  io.on("connection", (socket) => {
    const { userId, workspaceId } = socket.data as { userId: string; workspaceId: string | null };
    socket.join(`user:${userId}`);
    if (workspaceId) socket.join(`ws:${workspaceId}`);
  });

  // Agendador: timeouts do Téo, campanhas agendadas, lembretes, pós-visita, reengajamento, datas anuais
  if (process.env.DISABLE_SCHEDULER !== "true") {
    setInterval(() => {
      tick().catch((e) => console.error("[scheduler]", e));
    }, 60_000);
  }

  server.listen(port, () => console.log(`▲ Téo CRM pronto em http://localhost:${port} (${dev ? "dev" : "prod"})`));
});
