import { NextResponse } from "next/server";

export const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "POST, OPTIONS", "Access-Control-Allow-Headers": "Content-Type" };

export function corsJson(data: unknown, status = 200) {
  return NextResponse.json(data, { status, headers: CORS });
}

export async function readBody<T>(req: Request): Promise<T | null> {
  try {
    return JSON.parse(await req.text()) as T;
  } catch {
    return null;
  }
}
