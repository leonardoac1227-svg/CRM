import { cookies } from "next/headers";
import type { Agency, User, Workspace } from "@prisma/client";
import { prisma } from "./prisma";
import { SESSION_COOKIE, signSession, verifySession } from "./session-token";
import { HttpError } from "./errors";

export type Session = {
  user: User;
  workspace: Workspace;
  agency: Agency;
};

export { HttpError } from "./errors";

export async function getSession(): Promise<Session | null> {
  const token = cookies().get(SESSION_COOKIE)?.value;
  const payload = await verifySession(token);
  if (!payload) return null;
  const user = await prisma.user.findUnique({ where: { id: payload.uid } });
  if (!user || !user.isActive) return null;

  let workspace: Workspace | null = null;
  if (user.workspaceId) {
    workspace = await prisma.workspace.findUnique({ where: { id: user.workspaceId } });
  } else if (user.role === "AGENCY_ADMIN" || user.role === "SUPER_ADMIN") {
    const where = user.role === "AGENCY_ADMIN" ? { agencyId: user.agencyId ?? "__none__" } : {};
    if (payload.wid) workspace = await prisma.workspace.findFirst({ where: { ...where, id: payload.wid } });
    if (!workspace) workspace = await prisma.workspace.findFirst({ where, orderBy: { createdAt: "asc" } });
  }
  if (!workspace) return null;
  const agency = await prisma.agency.findUniqueOrThrow({ where: { id: workspace.agencyId } });
  return { user, workspace, agency };
}

export async function requireSession(): Promise<Session> {
  const s = await getSession();
  if (!s) throw new HttpError(401, "Não autenticado");
  return s;
}

export async function setSessionCookie(uid: string, wid?: string | null) {
  const token = await signSession({ uid, wid });
  cookies().set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
}

export function clearSessionCookie() {
  cookies().delete(SESSION_COOKIE);
}

export function publicUser(u: User) {
  const { passwordHash: _ph, ...rest } = u;
  return rest;
}
