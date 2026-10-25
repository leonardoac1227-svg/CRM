// Compila o servidor customizado (server.ts + src/lib) para dist/server.js.
// Necessário porque o require-hook do Next não é compatível com loaders como o tsx.
import { build } from "esbuild";

await build({
  entryPoints: ["server.ts"],
  outfile: "dist/server.js",
  bundle: true,
  platform: "node",
  target: "node20",
  format: "cjs",
  packages: "external",
  sourcemap: true,
  logLevel: "warning",
});
console.log("✓ dist/server.js");
