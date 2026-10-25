import { Prisma } from "@prisma/client";

/** Converte Decimal -> number e Date -> ISO recursivamente para respostas JSON. */
export function serialize<T>(value: T): T {
  return walk(value) as T;
}

function walk(v: unknown): unknown {
  if (v === null || v === undefined) return v;
  if (Prisma.Decimal.isDecimal(v)) return (v as Prisma.Decimal).toNumber();
  if (v instanceof Date) return v.toISOString();
  if (Array.isArray(v)) return v.map(walk);
  if (typeof v === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, val] of Object.entries(v as Record<string, unknown>)) out[k] = walk(val);
    return out;
  }
  return v;
}
