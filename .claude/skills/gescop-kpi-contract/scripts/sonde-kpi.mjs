// Sonde KPI : exécute le vrai moteur sur un cas JSON et affiche valeur, statut
// et période commune de chaque KPI demandé.
// node --import ./tests/register-npm.mjs .claude/skills/gescop-kpi-contract/scripts/sonde-kpi.mjs cas.json id1,id2 [--fenetre total|trim|mois] [--aujourdhui AAAA-MM-JJ]
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const racine = pathToFileURL(path.resolve("src/lib/core") + "/").href;
const { buildKpiDataset } = await import(racine + "kpiDataset.js");
const { computeKpiBatch } = await import(racine + "kpiEngine.js");
const { preparerPeriodes, kpisParFenetre } = await import(racine + "kpiPeriodes.js");

const [fichier, liste, ...opts] = process.argv.slice(2);
if (!fichier || !liste) {
  console.error("usage : sonde-kpi.mjs cas.json id1,id2 [--fenetre total|trim|mois] [--aujourdhui AAAA-MM-JJ]");
  process.exit(2);
}
const opt = (nom) => { const i = opts.indexOf(nom); return i >= 0 ? opts[i + 1] : undefined; };
const data = JSON.parse(fs.readFileSync(fichier, "utf8"));
const ids = liste.split(",").map((s) => s.trim()).filter(Boolean);
const fenetre = opt("--fenetre");

let resultats;
if (fenetre) {
  const prep = preparerPeriodes(data, { aujourdhui: new Date(opt("--aujourdhui") || Date.now()) });
  resultats = kpisParFenetre(prep, ids)[fenetre] || new Map();
} else {
  const { records, semantics } = buildKpiDataset(data);
  resultats = computeKpiBatch(ids, records, semantics);
}
for (const id of ids) {
  const r = resultats.get(id);
  const pc = r?.periodeCommune ? `  période commune ${r.periodeCommune.debut} → ${r.periodeCommune.fin} (${r.periodeCommune.mois} mois)` : "";
  console.log(`${id.padEnd(24)} ${String(r?.value ?? null).padEnd(22)} ${r?.status ?? "-"}${pc}`);
}
