import type { Prisma, Role, User } from "@prisma/client";
import { BROKER_MODULES, DEFAULT_ASSISTANT_PERMISSIONS, type ModuleKey } from "./constants";
import { HttpError } from "./errors";
import type { Session } from "./auth";

const FULL_ACCESS: Role[] = ["SUPER_ADMIN", "AGENCY_ADMIN", "MANAGER"];

export function isManagerLike(user: Pick<User, "role">) {
  return FULL_ACCESS.includes(user.role);
}

function assistantPerms(user: Pick<User, "permissions">): Record<string, boolean> {
  const p = (user.permissions ?? {}) as Record<string, boolean>;
  return { ...DEFAULT_ASSISTANT_PERMISSIONS, ...p };
}

export function canAccessModule(user: Pick<User, "role" | "permissions">, module: ModuleKey): boolean {
  if (FULL_ACCESS.includes(user.role)) return true;
  if (user.role === "ASSISTANT") return !!assistantPerms(user)[module];
  if (user.role === "BROKER") return BROKER_MODULES.includes(module);
  return false;
}

export function allowedModules(user: Pick<User, "role" | "permissions">): ModuleKey[] {
  const all: ModuleKey[] = ["atendimento", "contatos", "funis", "imoveis", "agenda", "teo", "relatorios", "campanhas", "site-seo", "integracoes", "equipe"];
  return all.filter((m) => canAccessModule(user, m));
}

/** O usuário enxerga apenas os próprios leads? (Corretor sempre; Assistente se não tiver "verTodosLeads") */
export function seesOnlyOwn(user: Pick<User, "role" | "permissions">): boolean {
  if (user.role === "BROKER") return true;
  if (user.role === "ASSISTANT") return !assistantPerms(user).verTodosLeads;
  return false;
}

export function contactScope(s: Session): Prisma.ContactWhereInput {
  const where: Prisma.ContactWhereInput = { workspaceId: s.workspace.id };
  if (seesOnlyOwn(s.user)) where.assignedToId = s.user.id;
  return where;
}

export function conversationScope(s: Session): Prisma.ConversationWhereInput {
  const where: Prisma.ConversationWhereInput = { workspaceId: s.workspace.id };
  if (seesOnlyOwn(s.user)) {
    // Corretor vê as conversas atribuídas a ele e as dos números de WhatsApp dele
    where.OR = [{ assignedToId: s.user.id }, { channel: { userId: s.user.id } }];
  }
  return where;
}

export function taskScope(s: Session): Prisma.TaskWhereInput {
  const where: Prisma.TaskWhereInput = { workspaceId: s.workspace.id };
  if (seesOnlyOwn(s.user)) where.assignedToId = s.user.id;
  return where;
}

export function requireModule(s: Session, module: ModuleKey) {
  if (!canAccessModule(s.user, module)) throw new HttpError(403, "Seu perfil não tem acesso a este módulo");
}

export function requireManager(s: Session) {
  if (!isManagerLike(s.user)) throw new HttpError(403, "Apenas gestores podem realizar esta ação");
}
