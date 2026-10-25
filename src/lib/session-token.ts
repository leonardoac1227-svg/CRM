// Edge-safe (usado pelo middleware e pelo servidor Socket.io)
import { SignJWT, jwtVerify } from "jose";

export const SESSION_COOKIE = "teo_session";

export type SessionPayload = { uid: string; wid?: string | null };

function secret() {
  const s = process.env.JWT_SECRET;
  if (!s || s.length < 16) {
    if (process.env.NODE_ENV === "production") throw new Error("JWT_SECRET ausente ou curto demais");
    return new TextEncoder().encode("dev-insecure-secret-change-me-0123456789");
  }
  return new TextEncoder().encode(s);
}

export async function signSession(payload: SessionPayload): Promise<string> {
  return new SignJWT(payload as Record<string, unknown>)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("30d")
    .sign(secret());
}

export async function verifySession(token?: string | null): Promise<SessionPayload | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret());
    if (typeof payload.uid !== "string") return null;
    return { uid: payload.uid, wid: (payload.wid as string | undefined) ?? null };
  } catch {
    return null;
  }
}
