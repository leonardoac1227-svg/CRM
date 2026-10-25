import { NextRequest } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { HttpError, setSessionCookie } from "@/lib/auth";
import { body, errorResponse, json } from "@/lib/api";

const schema = z.object({ email: z.string().email(), password: z.string().min(1) });

export async function POST(req: NextRequest) {
  try {
    const { email, password } = await body(req, schema);
    const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
    if (!user || !user.isActive || !(await bcrypt.compare(password, user.passwordHash))) throw new HttpError(401, "E-mail ou senha inválidos");
    await setSessionCookie(user.id);
    return json({ ok: true });
  } catch (e) {
    return errorResponse(e);
  }
}
