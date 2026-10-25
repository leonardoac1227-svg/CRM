import { route } from "@/lib/api";
import { publicUser } from "@/lib/auth";
import { allowedModules, seesOnlyOwn } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";

export const GET = route(async ({ session }) => {
  const workspaces =
    session.user.role === "AGENCY_ADMIN" || session.user.role === "SUPER_ADMIN"
      ? await prisma.workspace.findMany({
          where: session.user.role === "AGENCY_ADMIN" ? { agencyId: session.user.agencyId ?? "" } : {},
          select: { id: true, name: true, niche: true },
          orderBy: { createdAt: "asc" },
        })
      : [];
  const ai = await prisma.aiAssistantConfig.findUnique({ where: { workspaceId: session.workspace.id }, select: { assistantName: true } });
  return {
    user: publicUser(session.user),
    workspace: session.workspace,
    agency: session.agency,
    modules: allowedModules(session.user),
    seesOnlyOwn: seesOnlyOwn(session.user),
    assistantName: ai?.assistantName ?? session.agency.assistantDefaultName,
    workspaces,
    demoMode: process.env.DEMO_MODE === "true",
  };
});
