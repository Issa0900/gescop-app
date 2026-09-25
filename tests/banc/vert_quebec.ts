// Banc « Vert Québec » : les 18 fichiers du rapport de test du 25 sept. 2026
// (../DEMO/gescop_donnees_test, PME fictive, octobre 2025 à septembre 2026)
// passent par le VRAI importMultiData, comme a l'ecran (analyser, puis
// importer avec les plans confirmes), dans UNE base commune comme un compte
// reel, sous plusieurs comportements d'IA simules (ia_simulee.ts).
//
// Verite terrain : recalculee directement depuis les fichiers (Python, hors
// moteur) et reprise du rapport (tableau « Fiabilite des calculs »).
// Deux jeux : « origine » (les 18 fichiers tels que testes au 1er essai) et
// « corrige » (chaque fichier remplace par sa derniere version _v2/_v3).
//
// Usage : node tests/banc/lancer-demo.cjs vq [modes]

import { MODES, client, appeler, kpiPage, proche } from "./ia_simulee.ts";
import { calculerSuccursales } from "../../src/lib/succursales.js";
import { soldesTresorerie } from "../../src/lib/tresorerie.js";

declare const require: any;
declare const process: any;
const fs = require("fs");
const path = require("path");
const DOSSIER = path.resolve("..", "DEMO", "gescop_donnees_test");

const norm = (s: any) => String(s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
const somme = (rs: any[], f: (r: any) => number) => Math.round(rs.reduce((s, r) => s + (f(r) || 0), 0) * 100) / 100;

/** KPI calcules sur un sous-ensemble d'entites (le fichier seul, comme dans la verite). */
const kpiDe = (tables: Record<string, any[]>, entites: string[]) =>
  kpiPage(Object.fromEntries(entites.map((e) => [e, tables[e] || []])));

interface Controle { id: string; attendu: any; calcul: (t: Record<string, any[]>) => any; lot: string; }

export const CONTROLES: Controle[] = [
  // Lot 1 : chiffre d'affaires, charges, resultat (01_transactions.csv)
  { lot: "1.1", id: "CA 12 mois (transactions)", attendu: 3177262.18, calcul: (t) => kpiDe(t, ["Transaction"]).total_revenue },
  { lot: "1.1", id: "Charges 12 mois (transactions)", attendu: 2233167.18, calcul: (t) => kpiDe(t, ["Transaction"]).total_expense },
  { lot: "1.1", id: "Résultat net (transactions)", attendu: 944095, calcul: (t) => kpiDe(t, ["Transaction"]).net_income },
  { lot: "1.1", id: "Marge nette % (transactions)", attendu: 29.71, calcul: (t) => kpiDe(t, ["Transaction"]).net_margin_pct },
  {
    lot: "1.3", id: "CA par succursale (transactions)",
    attendu: { "quebec (siege)": 1735444.98, levis: 866591.47, "trois-rivieres": 575225.73 },
    calcul: (t) => {
      const par: Record<string, number> = {};
      for (const r of t.Transaction || []) if (r.type === "income" && r.branch) par[norm(r.branch)] = Math.round(((par[norm(r.branch)] || 0) + Number(r.amount)) * 100) / 100;
      return Object.keys(par).length ? par : null;
    },
  },
  // Page Succursales (lots 1.3 et 4.3) : transactions + commandes non annulees,
  // un groupe par succursale reelle, « Toutes succursales » a part.
  {
    lot: "1.3/4.3", id: "Page Succursales : CA par succursale",
    attendu: { "quebec (siege)": 1736534.87, levis: 867366.08, "trois-rivieres": 576080.28, "en ligne": 5626.51 },
    calcul: (t) => {
      const r = calculerSuccursales({ orders: t.Order, transactions: t.Transaction, employees: t.Employee, assets: t.Asset });
      return Object.fromEntries(r.locations.filter((l) => l.revenue > 0).map((l) => [norm(l.name), Math.round(l.revenue * 100) / 100]));
    },
  },
  {
    lot: "4.3", id: "Page Succursales : groupes affichés", attendu: 5,
    calcul: (t) => calculerSuccursales({ orders: t.Order, transactions: t.Transaction, employees: t.Employee, assets: t.Asset }).locations.length,
  },
  // Lot 2 : tresorerie (02_flux_tresorerie.csv) — solde de cloture du dernier mois
  {
    lot: "2", id: "Solde de trésorerie fin sept. 2026", attendu: 989095,
    calcul: (t) => {
      const c = [...(t.Cashflow || [])].sort((a, b) => String(a.date).localeCompare(String(b.date)));
      const d = c.at(-1);
      return d?.closing_cash == null ? null : Number(d.closing_cash);
    },
  },
  { lot: "2", id: "Page Trésorerie : trésorerie actuelle", attendu: 989095, calcul: (t) => soldesTresorerie(t.Cashflow, t.Transaction).soldeActuel },
  {
    lot: "2", id: "Page Trésorerie : solde sans colonne de clôture", attendu: 989095,
    calcul: (t) => soldesTresorerie((t.Cashflow || []).map(({ closing_cash, ...c }: any) => c), t.Transaction).soldeActuel,
  },
  // Lot 3 : paie (07_paie.csv, 3 mois)
  { lot: "3", id: "Masse salariale 3 mois (paie)", attendu: 310593.27, calcul: (t) => kpiDe(t, ["Payroll"]).payroll_total },
  // Lot 4 : clients et commandes (03_clients.csv + 11_commandes.csv)
  {
    lot: "4.1", id: "Commandes rattachées à un client connu", attendu: 66,
    calcul: (t) => {
      const ids = new Set((t.Customer || []).map((c) => c.customer_id));
      return (t.Order || []).filter((o) => o.customer_id && ids.has(o.customer_id)).length;
    },
  },
  {
    lot: "4.1", id: "Clients distincts ayant commandé", attendu: 23,
    calcul: (t) => {
      const ids = new Set((t.Customer || []).map((c) => c.customer_id));
      return new Set((t.Order || []).filter((o) => ids.has(o.customer_id)).map((o) => o.customer_id)).size;
    },
  },
  // Lignes attendues par entite (verite : nombre de lignes des fichiers)
  ...Object.entries({
    Transaction: 268, Cashflow: 12, Customer: 30, Product: 24, Inventory: 72, Employee: 25, Payroll: 75,
    Asset: 10, Order: 66, Interaction: 25,
  }).map(([e, n]) => ({ lot: "import", id: `lignes ${e}`, attendu: n, calcul: (t: any) => (t[e] || []).length })),
];

/** Lignes attendues seulement avec les fichiers corriges (_v2/_v3), rejetes a l'origine (Lot 5). */
export const CONTROLES_CORRIGES: Controle[] = Object.entries({
  Supplier: 8, Campaign: 6, CampaignDaily: 152, Competitor: 5, Goal: 6, Event: 7, ExternalSignal: 6,
}).map(([e, n]) => ({ lot: "5", id: `lignes ${e} (fichier corrigé)`, attendu: n, calcul: (t: any) => (t[e] || []).length }));

function jeu(corrige: boolean): string[] {
  const tous = fs.readdirSync(DOSSIER).filter((f: string) => f.endsWith(".csv")).sort();
  const parNumero: Record<string, string[]> = {};
  for (const f of tous) (parNumero[f.slice(0, 2)] ||= []).push(f);
  return Object.values(parNumero).map((fs2) => (corrige ? fs2[fs2.length - 1] : fs2.find((f) => !/_v\d/.test(f)) || fs2[0]));
}

function egal(app: any, att: any): boolean {
  if (att && typeof att === "object") {
    if (!app || typeof app !== "object") return false;
    return Object.entries(att).every(([k, v]) => proche(app[k] ?? null, v as number)) && Object.keys(app).length === Object.keys(att).length;
  }
  if (typeof att === "number") return typeof app === "number" ? proche(app, att) : false;
  return app === att;
}

(async () => {
  const modes = (process.argv[3] || "sans-ia,ia-fidele").split(",");
  const log = console.log;
  const bruit = [console.warn, console.error, console.log];
  const taire = () => { console.warn = () => {}; console.error = () => {}; console.log = () => {}; };
  const parler = () => { [console.warn, console.error, console.log] = bruit; };
  const resultats: any[] = [];

  for (const version of ["origine", "corrige"]) {
    const fichiers = jeu(version === "corrige");
    for (const mode of modes) {
      const comportement = MODES[mode];
      if (comportement === undefined) continue;
      // Plans des regles par feuille (une IA « fidele » les rend a l'identique).
      const plansRegles: Record<string, any> = {};
      const env = client(comportement
        ? (prompt: string) => {
          const etiq = Object.keys(plansRegles).sort((a, b) => b.length - a.length).find((e) => prompt.includes(e));
          if (!etiq) throw new Error("feuille introuvable dans le prompt");
          return comportement(plansRegles[etiq], etiq);
        }
        : null);
      const feuilles: any[] = [];
      taire();
      for (const nom of fichiers) {
        const buf = fs.readFileSync(path.join(DOSSIER, nom));
        const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
        const ref = await appeler(client(null).client, ab, nom, { mode: "analyser" });
        for (const r of ref.results || []) if (r.plan) plansRegles[r.file_name] = r.plan;
        const analyse = await appeler(env.client, ab, nom, { mode: "analyser" });
        const plans: Record<string, any> = {};
        for (const r of analyse.results || []) if (r.plan?.entite) plans[r.file_name] = r.plan;
        const importe = await appeler(env.client, ab, nom, { plans });
        for (const r of importe.results || []) feuilles.push({ fichier: nom, type: r.entity, ecrites: r.rows ?? 0, lues: r.rows_read ?? 0, message: r.message || r.error || "" });
      }
      parler();
      const controles = [...CONTROLES, ...(version === "corrige" ? CONTROLES_CORRIGES : [])].map((c) => {
        let app: any;
        try { app = c.calcul(env.tables); } catch (e: any) { app = `erreur : ${e?.message || e}`; }
        return { lot: c.lot, id: c.id, attendu: c.attendu, app, ok: egal(app, c.attendu) };
      });
      resultats.push({ version, mode, feuilles, controles });
    }
  }

  log("\n=== Banc Vert Québec (rapport du 25 sept. 2026) ===");
  let ok = 0, total = 0;
  for (const r of resultats) {
    const n = r.controles.filter((c: any) => c.ok).length;
    ok += n; total += r.controles.length;
    log(`\n[${r.version} · ${r.mode}] ${n}/${r.controles.length} contrôles justes`);
    for (const c of r.controles) {
      if (c.ok && !process.env.TOUT) continue;
      log(`   ${c.ok ? "✓" : "✗"} [lot ${c.lot}] ${c.id.padEnd(42)} app ${JSON.stringify(c.app)}   attendu ${JSON.stringify(c.attendu)}`);
    }
    if (process.env.FEUILLES) for (const f of r.feuilles) log(`      ${f.fichier.padEnd(34)} ${String(f.type).padEnd(15)} ${f.ecrites}/${f.lues}`);
  }
  log(`\nTOTAL : ${ok}/${total} contrôles justes`);
  const dossier = path.join("tests", "banc", "resultats");
  fs.mkdirSync(dossier, { recursive: true });
  fs.writeFileSync(path.join(dossier, "vert-quebec.json"), JSON.stringify({ ok, total, resultats }, null, 1));
  if (process.env.EXIGER && ok < total) process.exit(1);
})();
