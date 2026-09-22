// Compile le banc avec esbuild (les modules partages sont ecrits pour Deno)
// puis l'execute. Usage : node tests/banc/lancer.cjs [etiquette]
//   etiquette "avant" enregistre la reference ; toute autre la compare a celle-ci.
const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");
const esbuild = require("esbuild");

const build = path.join("tests", "banc", ".build");
fs.mkdirSync(build, { recursive: true });
fs.writeFileSync(path.join(build, "sdk-stub.cjs"), "module.exports = { createClient: () => ({}) };");

esbuild.buildSync({
  entryPoints: ["tests/banc/banc.ts"],
  bundle: true,
  outfile: path.join(build, "banc.cjs"),
  platform: "node",
  format: "cjs",
  logLevel: "error",
  alias: {
    "npm:xlsx@0.18.5": "./node_modules/xlsx",
    "npm:@base44/sdk@0.8.48": "./" + path.join(build, "sdk-stub.cjs").replace(/\\/g, "/"),
    "@": "./src",
  },
});

execFileSync(process.execPath, [path.join(build, "banc.cjs"), process.argv[2] || "courant"], { stdio: "inherit" });

// Retraitement (Phase 3). Absent du code d'origine : la reference "avant" n'a
// rien a retraiter, faute de registre — on le dit au lieu d'echouer.
try {
  esbuild.buildSync({
    entryPoints: ["tests/banc/reprise.ts"], bundle: true, outfile: path.join(build, "reprise.cjs"),
    platform: "node", format: "cjs", logLevel: "silent",
    alias: {
      "npm:xlsx@0.18.5": "./node_modules/xlsx",
      "npm:@base44/sdk@0.8.48": "./" + path.join(build, "sdk-stub.cjs").replace(/\\/g, "/"),
    },
  });
} catch {
  console.log("\n=== Retraitement sans réimport : indisponible dans ce code (aucun registre des lignes écartées) ===");
  process.exit(0);
}
execFileSync(process.execPath, [path.join(build, "reprise.cjs"), process.argv[2] || "courant"], { stdio: "inherit" });
