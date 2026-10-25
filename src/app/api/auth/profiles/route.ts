import { prisma } from "@/lib/prisma";
import { route } from "@/lib/api";

/** Perfis de demonstração para o seletor do avatar (somente com DEMO_MODE=true). */
export const GET = route(async ({ session }) => {
  if (process.env.DEMO_MODE !== "true") return { profiles: [] };
  const users = await prisma.user.findMany({
    where: { OR: [{ workspaceId: session.workspace.id }, { agencyId: session.agency.id, role: "AGENCY_ADMIN" }], isActive: true },
    select: { id: true, name: true, role: true, email: true },
    orderBy: [{ role: "asc" }, { name: "asc" }],
  });
  return { profiles: users };
});
