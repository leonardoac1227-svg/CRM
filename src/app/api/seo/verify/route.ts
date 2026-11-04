import dns from "node:dns/promises";
import net from "node:net";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { body, route } from "@/lib/api";
import { HttpError } from "@/lib/auth";
import { isManagerLike } from "@/lib/rbac";

function privateIp(ip: string) {
  if (net.isIPv6(ip)) return ip === "::1" || ip.startsWith("fc") || ip.startsWith("fd") || ip.startsWith("fe80");
  const [a, b] = ip.split(".").map(Number);
  return a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127);
}

/** Confere se o script de rastreio está no site do cliente (no HTML e/ou por visitas recebidas). */
export const POST = route(async ({ req, session }) => {
  const d = await body(req, z.object({ siteUrl: z.string().min(4, "Informe o endereço do site") }));
  let url: URL;
  try {
    url = new URL(/^https?:\/\//i.test(d.siteUrl) ? d.siteUrl : `https://${d.siteUrl}`);
  } catch {
    throw new HttpError(400, "Endereço inválido. Exemplo: https://www.suaempresa.com.br");
  }
  if (!/^https?:$/.test(url.protocol)) throw new HttpError(400, "Use um endereço que comece com http:// ou https://");
  const ws = session.workspace;
  if (isManagerLike(session.user) && ws.siteUrl !== url.origin) await prisma.workspace.update({ where: { id: ws.id }, data: { siteUrl: url.origin } });

  const since = new Date(Date.now() - 7 * 86400000);
  const recentSessions = await prisma.trackingSession.count({ where: { workspaceId: ws.id, createdAt: { gte: since } } });
  const lastSession = await prisma.trackingSession.findFirst({ where: { workspaceId: ws.id }, orderBy: { createdAt: "desc" }, select: { createdAt: true, landingPage: true } });

  let reachable = false;
  let inHtml = false;
  let viaGtm = false;
  let error: string | null = null;
  try {
    const { address } = await dns.lookup(url.hostname);
    if (privateIp(address)) throw new Error("endereço interno não permitido");
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 10_000);
    const res = await fetch(url.toString(), { signal: ctrl.signal, redirect: "follow", headers: { "User-Agent": "Mozilla/5.0 (compatible; ApiceVerificador/1.0)" } });
    clearTimeout(t);
    reachable = res.ok;
    const html = (await res.text()).slice(0, 2_000_000);
    inHtml = html.includes(`tracker.js?k=${ws.trackerKey}`);
    viaGtm = /googletagmanager\.com\/gtm\.js|GTM-[A-Z0-9]+/.test(html);
    if (!res.ok) error = `o site respondeu com erro ${res.status}`;
  } catch (e) {
    error = (e as Error).name === "AbortError" ? "o site demorou demais para responder" : `não conseguimos abrir o site (${(e as Error).message})`;
  }
  return { siteUrl: url.origin, reachable, inHtml, viaGtm, recentSessions, lastSession, installed: inHtml || recentSessions > 0, error };
}, { module: "site-seo" });
