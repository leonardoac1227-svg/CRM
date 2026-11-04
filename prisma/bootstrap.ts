// Inicialização de produção: na primeira vez cria a agência, a primeira empresa e a conta do administrador.
// Executado a cada start (é idempotente). Variáveis: AGENCY_NAME, ADMIN_NAME, ADMIN_EMAIL, ADMIN_PASSWORD.
import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";
import { createWorkspace } from "../src/lib/services/workspaces";
import { tempPasswordGen } from "../src/lib/passwords";

const prisma = new PrismaClient();

function slug(s: string) {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "agencia";
}

async function main() {
  if ((await prisma.agency.count()) > 0) {
    console.log("✔ Ápice já inicializado.");
    return;
  }
  const agencyName = process.env.AGENCY_NAME || "CRAP Digital";
  const email = (process.env.ADMIN_EMAIL || "").trim().toLowerCase();
  if (!email) {
    console.error("✖ Defina ADMIN_EMAIL (e de preferência ADMIN_PASSWORD) para criar a primeira conta de administrador.");
    process.exitCode = 1;
    return;
  }
  const password = process.env.ADMIN_PASSWORD || tempPasswordGen();
  await prisma.$transaction(async (tx) => {
    const agency = await tx.agency.create({ data: { name: agencyName, slug: slug(agencyName), primaryColor: "#C9A35B", secondaryColor: "#E4C88A", assistantDefaultName: "Zeni" } });
    await createWorkspace(tx, { agencyId: agency.id, name: process.env.WORKSPACE_NAME || agencyName, niche: "SERVICOS" });
    await tx.user.create({
      data: {
        agencyId: agency.id,
        name: process.env.ADMIN_NAME || "Administrador",
        email,
        passwordHash: await bcrypt.hash(password, 10),
        role: "AGENCY_ADMIN",
        mustChangePassword: !process.env.ADMIN_PASSWORD,
      },
    });
  });
  console.log("\n✔ Ápice inicializado!");
  console.log(`   Agência: ${agencyName}`);
  console.log(`   Login:   ${email}`);
  if (!process.env.ADMIN_PASSWORD) console.log(`   Senha provisória: ${password}  (troque no primeiro acesso)`);
  console.log("");
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
