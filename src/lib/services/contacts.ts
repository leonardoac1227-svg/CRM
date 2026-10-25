import { prisma } from "../prisma";
import { HttpError } from "../errors";
import type { Session } from "../auth";
import { contactScope } from "../rbac";

export async function findContact(session: Session, id: string) {
  const c = await prisma.contact.findFirst({ where: { ...contactScope(session), id } });
  if (!c) throw new HttpError(404, "Contato não encontrado");
  return c;
}
