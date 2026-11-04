// Criação de empresas (workspaces) com a estrutura mínima para começar a usar.
import type { Niche, Prisma } from "@prisma/client";
import { prisma } from "../prisma";
import { DEFAULT_STAGES } from "../constants";

type Db = Prisma.TransactionClient | typeof prisma;

export async function createWorkspace(
  db: Db,
  data: { agencyId: string; name: string; niche?: Niche; city?: string | null; state?: string | null; siteUrl?: string | null },
) {
  const ws = await db.workspace.create({
    data: { agencyId: data.agencyId, name: data.name, niche: data.niche ?? "IMOBILIARIO", city: data.city || null, state: data.state || null, siteUrl: data.siteUrl || null },
  });
  await db.pipeline.create({
    data: {
      workspaceId: ws.id,
      name: "Funil de vendas",
      isDefault: true,
      stages: { create: DEFAULT_STAGES.map((s, i) => ({ name: s.name, color: s.color, order: i, isWonStage: !!s.isWonStage })) },
    },
  });
  return ws;
}
