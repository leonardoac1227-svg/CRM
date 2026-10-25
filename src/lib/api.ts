import { NextResponse, type NextRequest } from "next/server";
import { ZodError, type ZodSchema } from "zod";
import { Prisma } from "@prisma/client";
import { HttpError, requireSession, type Session } from "./auth";
import { requireModule } from "./rbac";
import type { ModuleKey } from "./constants";
import { serialize } from "./serialize";

type Ctx<P> = { req: NextRequest; params: P; session: Session };

export function json(data: unknown, init?: number | ResponseInit) {
  return NextResponse.json(serialize(data), typeof init === "number" ? { status: init } : init);
}

export function errorResponse(e: unknown) {
  if (e instanceof HttpError) return NextResponse.json({ error: e.message }, { status: e.status });
  if (e instanceof ZodError) return NextResponse.json({ error: "Dados inválidos", issues: e.issues }, { status: 422 });
  if (e instanceof Prisma.PrismaClientKnownRequestError) {
    if (e.code === "P2002") return NextResponse.json({ error: "Registro duplicado" }, { status: 409 });
    if (e.code === "P2025") return NextResponse.json({ error: "Registro não encontrado" }, { status: 404 });
  }
  console.error("[api]", e);
  return NextResponse.json({ error: "Erro interno" }, { status: 500 });
}

/** Wrapper de rota autenticada: sessão + RBAC por módulo + tratamento de erro + serialização. */
export function route<P = Record<string, string>>(
  fn: (ctx: Ctx<P>) => Promise<unknown>,
  opts: { module?: ModuleKey } = {},
) {
  return async (req: NextRequest, { params }: { params: P }) => {
    try {
      const session = await requireSession();
      if (opts.module) requireModule(session, opts.module);
      const result = await fn({ req, params, session });
      if (result instanceof Response) return result;
      return json(result ?? { ok: true });
    } catch (e) {
      return errorResponse(e);
    }
  };
}

export async function body<T>(req: NextRequest, schema: ZodSchema<T>): Promise<T> {
  let raw: unknown = {};
  try {
    raw = await req.json();
  } catch {
    raw = {};
  }
  return schema.parse(raw);
}

export function notFound(msg = "Não encontrado"): never {
  throw new HttpError(404, msg);
}
