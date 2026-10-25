import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { HttpError, requireSession, setSessionCookie } from "@/lib/auth";
import { body, errorResponse, json } from "@/lib/api";

/** Troca de perfil sem senha — apenas em modo demonstração e dentro da mesma agência. */
export async function POST(req: NextRequest) {
  try {
    if (process.env.DEMO_MODE !== "true") throw new HttpError(403, "Troca de perfil desabilitada");
    const s = await requireSession();
    const { userId } = await body(req, z.object({ userId: z.string() }));
    const target = await prisma.user.findUnique({ where: { id: userId }, include: { workspace: true } });
    const sameAgency = target && (target.agencyId === s.agency.id || target.workspace?.agencyId === s.agency.id);
    if (!target || !sameAgency) throw new HttpError(404, "Perfil não encontrado");
    await setSessionCookie(target.id, target.workspaceId ? null : s.workspace.id);
    return json({ ok: true });
  } catch (e) {
    return errorResponse(e);
  }
}
