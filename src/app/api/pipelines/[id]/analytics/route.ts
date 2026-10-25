import { route } from "@/lib/api";
import { contactScope } from "@/lib/rbac";
import { pipelineAnalytics } from "@/lib/services/analytics";

export const GET = route<{ id: string }>(async ({ req, params, session }) => {
  const sp = req.nextUrl.searchParams;
  const period = sp.get("period");
  const days = period && period !== "all" ? Number(period) : null;
  return pipelineAnalytics(
    session.workspace.id,
    params.id,
    {
      from: days ? new Date(Date.now() - days * 86400000) : null,
      status: sp.get("status"),
      userId: sp.get("userId"),
      origin: sp.get("origin"),
    },
    contactScope(session),
  );
}, { module: "funis" });
