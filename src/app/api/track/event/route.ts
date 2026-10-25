import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { CORS, corsJson, readBody } from "@/lib/track-cors";

export const dynamic = "force-dynamic";

export function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS });
}

export async function POST(req: NextRequest) {
  const b = await readBody<{ key: string; code: string; event: string }>(req);
  if (!b?.key || !b.code) return corsJson({ ok: false }, 400);
  const ws = await prisma.workspace.findUnique({ where: { trackerKey: b.key } });
  if (!ws) return corsJson({ ok: false }, 404);
  await prisma.trackingSession.updateMany({ where: { workspaceId: ws.id, code: b.code, contactId: null }, data: { event: String(b.event).slice(0, 40) } });
  return corsJson({ ok: true });
}
