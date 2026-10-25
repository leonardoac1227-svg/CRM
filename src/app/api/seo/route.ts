import { prisma } from "@/lib/prisma";
import { route } from "@/lib/api";
import { seoDashboard } from "@/lib/services/analytics";
import { trackerSnippet } from "@/lib/tracker";

export const GET = route(async ({ req, session }) => {
  const days = Number(req.nextUrl.searchParams.get("days") || 90);
  const appUrl = process.env.APP_URL || req.nextUrl.origin;
  const [dash, recent] = await Promise.all([
    seoDashboard(session.workspace.id, days),
    prisma.trackingSession.findMany({ where: { workspaceId: session.workspace.id }, orderBy: { createdAt: "desc" }, take: 15 }),
  ]);
  return {
    ...dash,
    recentSessions: recent,
    tracker: { key: session.workspace.trackerKey, snippet: trackerSnippet(appUrl, session.workspace.trackerKey), url: `${appUrl}/api/tracker.js?k=${session.workspace.trackerKey}` },
    siteUrl: session.workspace.siteUrl,
  };
}, { module: "site-seo" });
