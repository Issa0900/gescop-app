// Compile et lance le banc DEMO (tests/banc/demo.ts). Usage :
//   node tests/banc/lancer-demo.cjs [etiquette] [filtre-fichier]
//   etiquette "demo-avant" enregistre la reference ; toute autre la compare a celle-ci.
const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");
const esbuild = require("esbuild");

const build = path.join("tests", "banc", ".build");
fs.mkdirSync(build, { recursive: true });
fs.writeFileSync(path.join(build, "sdk-stub.cjs"), "module.exports = { createClient: () => ({}) };");

// « robustesse » comme etiquette lance le banc de robustesse (tests/banc/robustesse.ts).
// « diagnostic » lance le diagnostic de l'import sous plusieurs comportements d'IA (tests/banc/diagnostic.ts).
// « vq » lance le banc du rapport Vert Québec (tests/banc/vert_quebec.ts).
const cible = process.argv[2] === "vq" ? "vert_quebec" : ["robustesse", "diagnostic"].includes(process.argv[2]) ? process.argv[2] : "demo";
esbuild.buildSync({
  entryPoints: [`tests/banc/${cible}.ts`],
  bundle: true,
  outfile: path.join(build, `${cible}.cjs`),
  platform: "node",
  format: "cjs",
  logLevel: "error",
  alias: {
    "npm:xlsx@0.18.5": "./node_modules/xlsx",
    "npm:@base44/sdk@0.8.48": "./" + path.join(build, "sdk-stub.cjs").replace(/\\/g, "/"),
    "@": "./src",
  },
});

execFileSync(process.execPath, ["--max-old-space-size=6000", path.join(build, `${cible}.cjs`), process.argv[2] || "demo-courant", process.argv[3] || "", process.argv[4] || ""], { stdio: "inherit" });

