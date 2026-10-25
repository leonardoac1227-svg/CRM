import { NextRequest, NextResponse } from "next/server";
import { tick } from "@/lib/services/automations";

export const dynamic = "force-dynamic";

/** Agendador para ambientes serverless (ex.: Vercel Cron). O server.ts já chama tick() a cada minuto. */
export async function POST(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  return NextResponse.json(await tick());
}
export const GET = POST;
