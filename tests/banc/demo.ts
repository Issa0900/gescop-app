// Banc DEMO : les fichiers du dossier ../DEMO passent par le vrai point
// d'entree d'import (importMultiData), puis les KPI sont calcules comme la page
// Indicateurs (buildKpiDataset + computeKpiBatch). Chaque chiffre est compare a
// la verite terrain recalculee depuis les fichiers (verite_demo.ts).
//
// Usage : node tests/banc/lancer-demo.cjs [etiquette] [filtre-fichier]
//   etiquette "demo-avant" enregistre la reference ; les autres s'y comparent.

import { importer } from "./outils.ts";
import { computeKpiBatch } from "../../src/lib/core/kpiEngine.js";
import { buildKpiDataset, ENTITES_KPI } from "../../src/lib/core/kpiDataset.js";
import { KPI_REGISTRY } from "../../src/lib/core/kpiRegistry.js";
import { VERITE_DEMO } from "./verite_demo.ts";
import { VERITE_UCI } from "./verite_uci.ts";
import { runCoherenceChecks } from "../../src/lib/dataAudit.js";
import { calculerControle, libelleControle } from "./controles.ts";

declare const require: any;
declare const process: any;
const fs = require("fs");
const path = require("path");

const DEMO = path.resolve("..", "DEMO");
const TECH = new Set(["Import", "ImportIssue", "Observation", "Company"]);
// Verite « tous modules » (verite_demo_modules.py, hors moteur) : paie,
// depenses, achats, stocks, immobilisations, marketing, tresorerie, CRM...
const MODULES: { fichier: string; controles: any[] }[] = (() => {
  const p = path.join("tests", "banc", "verite_demo_modules.json");
  return fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, "utf8")) : [];
})();

/** KPI tels que la page Indicateurs les calcule (memes entites, memes observations). */
function kpiPage(tables: Record<string, any[]>, extra: string[] = []) {
  const data: Record<string, any[]> = {};
  for (const [cle, entite] of ENTITES_KPI) if (tables[entite]) data[cle] = tables[entite];
  const { records, semantics } = buildKpiDataset(data);
  for (const o of tables.Observation || []) records.push(o);
  const res = computeKpiBatch([...new Set([...Object.keys(KPI_REGISTRY), ...extra])], records, semantics);
  const out: Record<string, { v: number | null; s: string }> = {};
  for (const [k, l] of res as any) out[k] = { v: l.value == null ? null : Math.round(l.value * 100) / 100, s: l.status };
  return out;
}

function proche(app: number | null, attendu: number | null) {
  if (attendu === null) return app === null;
  if (app === null || !Number.isFinite(app)) return false;
  return Math.abs(app - attendu) <= Math.max(0.011, Math.abs(attendu) * 0.002);
}

(async () => {
  const etiquette = process.argv[2] || "demo-courant";
  const filtre = process.argv[3] || "";
  const log = console.log;
  const bruit = [console.warn, console.error];
  console.warn = () => {}; console.error = () => {};
  const resultats: any[] = [];
  let ok = 0, total = 0;
  // « uci » : jeux publics UCI Online Retail (../DEMO/UCI) ; UCI_COMPLET=1 ajoute
  // les deux fichiers complets (540 000 et 1 million de lignes).
  const corpus = etiquette.startsWith("uci")
    ? VERITE_UCI.filter((v) => !v.lent || process.env.UCI_COMPLET)
    : VERITE_DEMO;
  for (const v of corpus) {
    if (filtre && !filtre.split(",").some((f: string) => v.fichier.includes(f))) continue;
    const chemin = path.join(DEMO, v.fichier);
    if (!fs.existsSync(chemin)) { log(`(absent) ${v.fichier}`); continue; }
    const buf = fs.readFileSync(chemin);
    const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
    const t0 = Date.now();
    const { tables, results, erreur } = await importer(v.fichier, ab);
    const modules = MODULES.find((m) => m.fichier === v.fichier)?.controles || [];
    const kpi = kpiPage(tables, [...Object.keys(v.kpi || {}), ...modules.filter((c) => c.type === "kpi").map((c) => c.id)]);
    const controles: any[] = [];
    for (const [id, attendu] of Object.entries(v.kpi || {})) {
      const app = kpi[id]?.v ?? null;
      controles.push({ type: "kpi", id, attendu, app, statut: kpi[id]?.s, ok: proche(app, attendu) });
    }
    for (const [ent, n] of Object.entries(v.lignes || {})) {
      const app = (tables[ent] || []).length;
      controles.push({ type: "lignes", id: ent, attendu: n, app, ok: app === n });
    }
    for (const c of modules) {
      if (c.type === "lignes" && v.lignes && c.entite in v.lignes) continue;
      let app: any;
      try { app = calculerControle(c, tables, (k: any) => kpi[k.id]?.v ?? null); } catch (e: any) { app = `erreur : ${e?.message || e}`; }
      const ok = typeof c.attendu === "number" && c.type !== "lignes" && c.type !== "compte" && c.type !== "distincts" ? proche(app, c.attendu) : app === c.attendu;
      controles.push({ type: "module", id: libelleControle(c), attendu: c.attendu, app, ok });
    }
    const motifs: Record<string, number> = {};
    for (const i of tables.ImportIssue || []) motifs[i.reason_code] = (motifs[i.reason_code] || 0) + 1;
    for (const [m, n] of Object.entries(v.motifs || {})) controles.push({ type: "motif", id: m, attendu: `>= ${n}`, app: motifs[m] || 0, ok: (motifs[m] || 0) >= n });
    for (const m of v.sans || []) controles.push({ type: "sans", id: m, attendu: 0, app: motifs[m] || 0, ok: !motifs[m] });
    // Controles de coherence de la page Audit, sur les memes donnees.
    const coherence = runCoherenceChecks({
      transactions: tables.Transaction, orders: tables.Order, customers: tables.Customer, products: tables.Product,
      inventory: tables.Inventory, cashflow: tables.Cashflow, campaigns: tables.Campaign, campaignDaily: tables.CampaignDaily,
      expenses: tables.Expense, payroll: tables.Payroll, employees: tables.Employee, executiveSummaries: tables.ExecutiveSummary,
    }).filter((c: any) => c.status !== "skip").map((c: any) => ({ label: c.label, status: c.status, detail: c.detail }));
    ok += controles.filter((c) => c.ok).length; total += controles.length;
    resultats.push({
      fichier: v.fichier, ms: Date.now() - t0, memoire_mo: Math.round(process.memoryUsage().rss / 1e6), erreur, controles, motifs, coherence,
      feuilles: results.map((r: any) => ({ feuille: r.file_name, entite: r.entity, lues: r.rows_read, importees: r.rows, quar: r.quarantined || 0 })),
      lignes: Object.fromEntries(Object.entries(tables).filter(([n]) => !TECH.has(n)).map(([n, rs]) => [n, rs.length])),
      kpi: Object.fromEntries(Object.entries(kpi).filter(([, x]) => x.v !== null).map(([k, x]) => [k, x.v])),
    });
  }
  [console.warn, console.error] = bruit;

  log(`\n=== Banc DEMO — ${etiquette} ===`);
  for (const r of resultats) {
    const n = r.controles.filter((c: any) => c.ok).length;
    log(`\n${n === r.controles.length ? "OK " : "KO "} ${r.fichier}  (${n}/${r.controles.length}, ${Math.round(r.ms / 100) / 10} s, ${r.memoire_mo} Mo)`);
    if (process.env.COHERENCE) for (const c of r.coherence) log(`   [audit ${c.status}] ${c.label} — ${c.detail}`);
    for (const c of r.controles) {
      log(`   ${c.ok ? "✓" : "✗"} ${(c.type + " " + c.id).padEnd(34)} app ${String(c.app).padStart(14)}   attendu ${String(c.attendu).padStart(14)}${c.statut ? "  [" + c.statut + "]" : ""}`);
    }
  }
  log(`\nTOTAL : ${ok}/${total} contrôles justes`);

  const dossier = path.join("tests", "banc", "resultats");
  fs.mkdirSync(dossier, { recursive: true });
  fs.writeFileSync(path.join(dossier, `${etiquette}.json`), JSON.stringify({ ok, total, resultats }, null, 1));
  const ref = path.join(dossier, etiquette.startsWith("uci") ? "uci-avant.json" : "demo-avant.json");
  if (etiquette !== "demo-avant" && etiquette !== "uci-avant" && fs.existsSync(ref)) {
    const avant = JSON.parse(fs.readFileSync(ref, "utf8"));
    log(`\n=== Comparaison avec demo-avant : ${avant.ok}/${avant.total} -> ${ok}/${total} ===`);
    for (const r of resultats) {
      const a = avant.resultats.find((x: any) => x.fichier === r.fichier);
      if (!a) continue;
      for (const c of r.controles) {
        const ca = a.controles.find((x: any) => x.type === c.type && x.id === c.id);
        if (ca && ca.ok !== c.ok) log(`  ${c.ok ? "GAGNÉ " : "PERDU "} ${r.fichier} · ${c.type} ${c.id} : ${ca.app} -> ${c.app} (attendu ${c.attendu})`);
      }
    }
  }
})();
