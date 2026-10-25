import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { trackerScript } from "@/lib/tracker";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const key = req.nextUrl.searchParams.get("k") ?? "";
  const ws = await prisma.workspace.findUnique({ where: { trackerKey: key } });
  if (!ws) return new NextResponse("/* Téo tracker: chave inválida */", { status: 404, headers: { "Content-Type": "application/javascript; charset=utf-8" } });
  const ch = await prisma.whatsAppChannel.findFirst({ where: { workspaceId: ws.id, accountType: "COMPANY", status: "CONNECTED" } });
  const appUrl = process.env.APP_URL || req.nextUrl.origin;
  const js = trackerScript(appUrl, key, { whatsappNumber: ch?.phoneNumber, showFloatingButton: req.nextUrl.searchParams.get("button") === "1" });
  return new NextResponse(js, {
    headers: { "Content-Type": "application/javascript; charset=utf-8", "Cache-Control": "public, max-age=300", "Access-Control-Allow-Origin": "*" },
  });
}
