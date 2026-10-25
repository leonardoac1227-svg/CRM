import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { HttpError, requireSession, setSessionCookie } from "@/lib/auth";
import { body, errorResponse, json } from "@/lib/api";

/** Agência/Super admin alterna o workspace (cliente) ativo. */
export async function POST(req: NextRequest) {
  try {
    const s = await requireSession();
    if (s.user.role !== "AGENCY_ADMIN" && s.user.role !== "SUPER_ADMIN") throw new HttpError(403, "Apenas a agência pode alternar workspaces");
    const { workspaceId } = await body(req, z.object({ workspaceId: z.string() }));
    const ws = await prisma.workspace.findFirst({ where: { id: workspaceId, ...(s.user.role === "AGENCY_ADMIN" ? { agencyId: s.user.agencyId ?? "" } : {}) } });
    if (!ws) throw new HttpError(404, "Workspace não encontrado");
    await setSessionCookie(s.user.id, ws.id);
    return json({ ok: true });
  } catch (e) {
    return errorResponse(e);
  }
}
