// Banc « jeux générés » : 10 PME fictives de secteurs et formats variés
// (tests/banc/jeux_generes, script generate_all.py), sur la méthode du rapport
// Vert Québec. Chaque jeu passe par le VRAI importMultiData dans une base
// commune, comme à l'écran (analyser puis importer avec les plans confirmés),
// sous plusieurs comportements d'IA simulés ; chaque valeur de verite.json
// (calculée par le générateur, hors moteur) est contrôlée.
//
// Usage : node tests/banc/lancer-demo.cjs jeux [filtre] [modes]

import { MODES, client, appeler, kpiPage, proche } from "./ia_simulee.ts";
import { soldesTresorerie } from "../../src/lib/tresorerie.js";
import { indexClients, clientDeCommande } from "../../src/lib/rapprochementClients.js";

declare const require: any;
declare const process: any;
const fs = require("fs");
const path = require("path");
const RACINE = path.resolve("tests", "banc", "jeux_generes");

const kpiDe = (t: Record<string, any[]>, entites: string[]) => kpiPage(Object.fromEntries(entites.map((e) => [e, t[e] || []])));

function calculer(c: any, t: Record<string, any[]>): any {
  switch (c.type) {
    case "kpi": return kpiPage(Object.fromEntries(c.entites.map((e: string) => [e, t[e] || []])), [c.id])[c.id] ?? null;
    case "lignes": return (t[c.entite] || []).length;
    case "somme": return Math.round((t[c.entite] || []).reduce((s: number, r: any) => s + (Number(r[c.champ]) || 0), 0) * 100) / 100;
    case "distincts": return new Set((t[c.entite] || []).map((r: any) => r[c.champ]).filter((v: any) => v != null && v !== "")).size;
    case "solde": return soldesTresorerie(t.Cashflow || [], t.Transaction || []).soldeActuel;
    case "clients_rattaches": { const ix = indexClients(t.Customer || []); return (t.Order || []).filter((o) => clientDeCommande(o, ix)).length; }
    default: return `type inconnu ${c.type}`;
  }
}
const juste = (app: any, att: any) => (typeof att === "number" ? typeof app === "number" && proche(app, att) : app === att);

(async () => {
  const filtre = process.argv[3] || "";
  const modes = (process.argv[4] || "sans-ia,ia-fidele").split(",");
  const log = console.log;
  const bruit = [console.warn, console.error, console.log];
  const taire = () => { console.warn = () => {}; console.error = () => {}; console.log = () => {}; };
  const parler = () => { [console.warn, console.error, console.log] = bruit; };
  const jeux = fs.readdirSync(RACINE).filter((d: string) => fs.statSync(path.join(RACINE, d)).isDirectory() && (!filtre || filtre.split(",").some((f: string) => d.includes(f)))).sort();
  const resultats: any[] = [];
  for (const jeu of jeux) {
    const dossier = path.join(RACINE, jeu);
    const verite = JSON.parse(fs.readFileSync(path.join(dossier, "verite.json"), "utf8"));
    const fichiers = fs.readdirSync(dossier).filter((f: string) => /\.(csv|xlsx|xls|tsv)$/i.test(f)).sort();
    for (const mode of modes) {
      const comportement = MODES[mode];
      if (comportement === undefined) continue;
      const plansRegles: Record<string, any> = {};
      const env = client(comportement ? (prompt: string) => {
        const e = Object.keys(plansRegles).sort((a, b) => b.length - a.length).find((k) => prompt.includes(k));
        if (!e) throw new Error("feuille introuvable dans le prompt");
        return comportement(plansRegles[e], (/\[([^\]]+)\]$/.exec(e) || [])[1] || e);
      } : null);
      const feuilles: any[] = [];
      taire();
      try {
        for (const nom of fichiers) {
          const buf = fs.readFileSync(path.join(dossier, nom));
          const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
          const ref = await appeler(client(null).client, ab, nom, { mode: "analyser" });
          for (const r of ref.results || []) if (r.plan) plansRegles[r.file_name] = r.plan;
          const analyse = await appeler(env.client, ab, nom, { mode: "analyser" });
          const plans: Record<string, any> = {};
          for (const r of analyse.results || []) if (r.plan?.entite) plans[r.file_name] = r.plan;
          const importe = await appeler(env.client, ab, nom, { plans });
          for (const r of importe.results || []) feuilles.push({ feuille: r.file_name, type: r.entity, ecrites: r.rows ?? 0, lues: r.rows_read ?? 0, message: String(r.message || r.error || "").slice(0, 300) });
        }
      } catch (e: any) { feuilles.push({ feuille: "ERREUR", message: String(e?.message || e) }); }
      parler();
      const controles = verite.controles.map((c: any) => {
        let app: any; try { app = calculer(c, env.tables); } catch (e: any) { app = `erreur : ${e?.message || e}`; }
        const id = c.type === "kpi" ? `kpi ${c.id} (${c.entites.join("+")})` : c.type === "lignes" ? `lignes ${c.entite}` : `${c.type} ${c.entite || ""}.${c.champ || ""}`;
        return { id, attendu: c.attendu, app, ok: juste(app, c.attendu) };
      });
      if (process.env.DUMP) log(JSON.stringify(plansRegles));
      if (process.env.DUMP) for (const [e, rows] of Object.entries(env.tables as Record<string, any[]>)) log(`   [${mode}] ${e} (${rows.length}) ${JSON.stringify(rows[0])}`);
      resultats.push({ jeu, mode, feuilles, controles });
    }
  }
  log("\n=== Banc des jeux générés ===");
  let ok = 0, total = 0;
  for (const r of resultats) {
    const n = r.controles.filter((c: any) => c.ok).length; ok += n; total += r.controles.length;
    log(`\n${n === r.controles.length ? "OK " : "KO "} [${r.mode}] ${r.jeu} ${n}/${r.controles.length}`);
    for (const c of r.controles) if (!c.ok || process.env.TOUT) log(`   ${c.ok ? "✓" : "✗"} ${c.id.padEnd(44)} app ${JSON.stringify(c.app)}   attendu ${JSON.stringify(c.attendu)}`);
    if (process.env.FEUILLES || r.controles.some((c: any) => !c.ok)) for (const f of r.feuilles) log(`      · ${String(f.feuille).padEnd(48)} ${String(f.type).padEnd(16)} ${f.ecrites}/${f.lues}  ${process.env.FEUILLES ? f.message : ""}`);
  }
  log(`\nTOTAL : ${ok}/${total} contrôles justes`);
  const sortie = path.join("tests", "banc", "resultats");
  fs.mkdirSync(sortie, { recursive: true });
  fs.writeFileSync(path.join(sortie, "jeux.json"), JSON.stringify({ ok, total, resultats }, null, 1));
})();
