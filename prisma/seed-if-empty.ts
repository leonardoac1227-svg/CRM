// Popula o banco com os dados de demonstração apenas na primeira inicialização.
import { execSync } from "node:child_process";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

prisma.agency
  .count()
  .then((n) => {
    if (n > 0) {
      console.log("Banco já populado, seed ignorado.");
      return;
    }
    execSync("npx tsx prisma/seed.ts", { stdio: "inherit" });
  })
  .finally(() => prisma.$disconnect());
