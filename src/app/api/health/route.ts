import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/** Saúde do serviço (usado pelo Render e por monitores que mantêm o servidor acordado). */
export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return NextResponse.json({ ok: true, db: "ok", time: new Date().toISOString() });
  } catch {
    return NextResponse.json({ ok: false, db: "erro" }, { status: 503 });
  }
}
