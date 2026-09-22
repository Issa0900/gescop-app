// Banc de reconnaissance et de recuperation (directives §20, §24, §25).
//
// Chaque cas du corpus traverse le VRAI point d'entree de production
// (base44/functions/importMultiData/entry.ts) contre un faux client Base44 en
// memoire. Le banc ne verifie pas une fonction isolee : il mesure ce qui finit
// reellement en base, et le compare a la verite terrain du cas.
//
// Mesures par cas :
//   importees        lignes ecrites dans l'entite cible
//   quarantaine      lignes que le rapport d'import declare ecartees (doublons compris)
//   perdues          lignes de donnees ni importees ni declarees : disparues sans trace
//   inventees        valeurs fabriquees (date du jour, identifiant ORD-...) dans les lignes ecrites
//   brut_manquant    lignes ecrites dont original_data a perdu une colonne brute attendue
//   non_signale      fragments attendus absents du rapport (valeur repliee, colonne ignoree)
//   sans_trace       lignes de donnees non importees ET absentes du registre ImportIssue :
//                    impossibles a retrouver ou a retraiter sans reimporter (Phase 1)
//   incoherent       imports dont les compteurs ne s'additionnent pas (total != somme des statuts)
//
// Usage : voir tests/banc/README.md

import { importer, classeur } from "./outils.ts";
import { computeKpiBatch } from "../../src/lib/core/kpiEngine.js";
import { getEntitySemantics } from "../../src/lib/core/entityFieldMap.js";
import { KPI_REGISTRY } from "../../src/lib/core/kpiRegistry.js";

/**
 * Tous les KPI du registre, calcules par le vrai moteur (comme useKpiEngine)
 * sur les donnees importees. Sert a verifier la directive §25.4 : les
 * Observations, derivees des memes lignes, ne doivent pas changer un KPI.
 */
function calculerKpi(tables: Record<string, any[]>, avecObservations: boolean): Record<string, any> {
  const recs: any[] = [];
  const sem = new Map();
  for (const e of ["Transaction", "Cashflow", "Order", "Expense", "Employee", "Payroll", "Customer", "Product", "CampaignDaily"]) {
    const rs = tables[e];
    if (!rs) continue;
    recs.push(...rs.map((r: any) => ({ ...r, _entity: e })));
    const s = getEntitySemantics(e);
    if (s) s.forEach((v: any, k: string) => sem.set(`${e}:${k}`, v));
  }
  if (avecObservations) recs.push(...(tables.Observation || []));
  const res = computeKpiBatch(Object.keys(KPI_REGISTRY), recs, sem);
  return Object.fromEntries([...res].map(([k, v]: any) => [k, v.value == null ? null : Math.round(v.value * 100) / 100]));
}
import { CORPUS, CLASSEURS_REELS, type Cas } from "./cas.ts";

declare const require: any;
declare const process: any;
const fs = require("fs");
const path = require("path");

const AUJOURDHUI = new Date().toISOString().slice(0, 10);

const ENTITES_TECHNIQUES = new Set(["Import", "ImportIssue", "Observation", "Company"]);
const lignesMetier = (tables: Record<string, any[]>) =>
  Object.entries(tables).filter(([n]) => !ENTITES_TECHNIQUES.has(n)).flatMap(([n, rs]) => rs.map((r) => ({ entite: n, r })));

function inventions(rows: { entite: string; r: any }[]): string[] {
  const out: string[] = [];
  for (const { entite, r } of rows) {
    const brut = String(r.original_data || "");
    // Toute date du jour absente du fichier est inventee, inventaire compris
    // (regle du 22 sept 2026). La date d'import d'un inventaire non date vit
    // dans reference_date, typee IMPORT_DATE : comptee a part, pas inventee.
    if (r.date === AUJOURDHUI && !brut.includes(AUJOURDHUI)) out.push(`${entite}: date du jour inventee`);
    if (r.reference_date_type === "IMPORT_DATE") out.push("SUPPOSEE date de reference = date d'import");
    for (const [k, v] of Object.entries(r)) {
      if (/_id$/.test(k) && typeof v === "string" && /^ORD-/.test(v) && !brut.includes(v)) out.push(`${entite}.${k} = ${v}`);
    }
  }
  return out;
}

interface Mesure {
  id: string; titre: string; donnees: number; importees: number; quarantaine: number;
  perdues: number; inventees: number; brut_manquant: number; non_signale: string[];
  sans_trace: number; incoherent: number; mal_interpretees: number;
  details: string[];
}

async function mesurerCas(cas: Cas): Promise<Mesure> {
  const { tables, results, erreur } = await importer(cas.fichier, classeur(cas.feuilles), cas.type_manuel, cas.reponse_ia);
  const rows = lignesMetier(tables);
  const quarantaine = results.reduce((s, r) => s + (Number(r.quarantined) || 0), 0);
  const inv = inventions(rows);
  // Une colonne brute n'est attendue que dans les lignes des feuilles qui la contiennent.
  const feuilleDe = (r: any) => {
    const imp = (tables.Import || []).find((i: any) => i.id === r.import_id);
    const m = /\[([^\]]+)\]$/.exec(imp?.file_name || "");
    return m ? m[1] : "";
  };
  const brutManquant = rows.filter(({ r }) => {
    let brut: any = {};
    try { brut = JSON.parse(r.original_data || "{}"); } catch { /* illisible = manquant */ }
    const entetes = (cas.feuilles[feuilleDe(r)] || [])[0] || [];
    return (cas.colonnes_brutes || []).some((c) => entetes.includes(c) && !(c in brut));
  }).length;
  const rapport = results.map((r) => `${r.message || ""} ${r.error || ""}`).join(" ");
  // Interpretation : bon type de feuille, et la valeur de chaque colonne cle
  // dans le bon champ (comparee a la valeur brute du fichier).
  const erreursSemantiques: string[] = [];
  for (const [feuille, attendue] of Object.entries(cas.attendu?.entites || {})) {
    const r = results.find((x) => String(x.file_name).endsWith(`[${feuille}]`));
    if (r?.entity !== attendue) erreursSemantiques.push(`feuille ${feuille} lue comme ${r?.entity ?? "rien"} (attendu ${attendue})`);
  }
  for (const [colonne, champ] of Object.entries(cas.attendu?.champs || {})) {
    const concernees = rows.filter(({ r }) => { try { return colonne in JSON.parse(r.original_data || "{}"); } catch { return false; } });
    const fausses = concernees.filter(({ r }) => {
      const brut = JSON.parse(r.original_data)[colonne];
      const v = r[champ];
      if (v === undefined || v === null) return true;
      return typeof v === "number" ? Number(brut) !== v : String(v).trim() !== String(brut).trim();
    });
    if (concernees.length === 0 || fausses.length > 0) {
      const ex = fausses[0]?.r;
      erreursSemantiques.push(`« ${colonne} » -> ${champ} : ${concernees.length === 0 ? "aucune ligne" : `${fausses.length} ligne(s) fausse(s), ex. ${champ} = ${JSON.stringify(ex?.[champ])}`}`);
    }
  }
  // Registre : une ligne de donnees non importee doit y figurer avec son contenu brut.
  const registre = (tables.ImportIssue || []).filter((i: any) => ["QUARANTINED", "DUPLICATE", "UNKNOWN"].includes(i.row_status) && i.raw_row);
  const incoherent = results.filter((r) => {
    const m = r.metrics;
    if (!m) return false;
    return m.total_rows !== m.valid_rows + m.quarantined_rows + m.duplicate_rows + m.summary_rows + m.ignored_rows + m.unknown_rows;
  }).length;
  const nonSignale = (cas.signaler || []).filter((f) => !rapport.includes(f));
  return {
    id: cas.id, titre: cas.titre, donnees: cas.donnees,
    importees: rows.length, quarantaine,
    perdues: Math.max(0, cas.donnees - rows.length - quarantaine),
    sans_trace: Math.max(0, cas.donnees - rows.length - registre.length),
    incoherent,
    mal_interpretees: erreursSemantiques.length,
    inventees: inv.filter((x) => !x.startsWith("SUPPOSEE")).length, brut_manquant: brutManquant, non_signale: nonSignale,
    details: [...erreursSemantiques.map((e) => `SEMANTIQUE ${e}`), ...inv, ...results.map((r) => `[${r.file_name}] ${r.entity ?? "?"} ${r.status}: ${r.rows}/${r.rows_read} ${r.message || r.error || ""}`), ...(erreur ? [erreur] : [])],
  };
}

async function mesurerReel(chemin: string) {
  const abs = path.resolve(chemin);
  if (!fs.existsSync(abs)) return null;
  const buf = fs.readFileSync(abs);
  const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
  const { tables, results } = await importer(path.basename(abs), ab);
  const rows = lignesMetier(tables);
  const sommes: Record<string, number> = {};
  for (const { entite, r } of rows) {
    // Tous les champs numeriques ecrits : un changement de rattachement ou de
    // calcul derive (total, marge, taux) se voit ici avant d'atteindre un KPI.
    for (const [champ, v] of Object.entries(r)) {
      if (typeof v === "number") sommes[`${entite}.${champ}`] = Math.round(((sommes[`${entite}.${champ}`] || 0) + v) * 100) / 100;
    }
  }
  const kpiSans = calculerKpi(tables, false);
  const kpiAvec = calculerKpi(tables, true);
  const kpiDivergents = Object.keys(kpiSans).filter((k) => kpiSans[k] !== kpiAvec[k]).map((k) => `${k}: ${kpiSans[k]} -> ${kpiAvec[k]}`);
  return {
    fichier: path.basename(abs),
    observations: (tables.Observation || []).length,
    kpi: kpiSans,
    kpi_divergents: kpiDivergents,
    feuilles: results.map((r) => ({ feuille: r.file_name, entite: r.entity, statut: r.status, lues: r.rows_read, importees: r.rows, quarantaine: r.quarantined || 0 })),
    inventees: inventions(rows).filter((x) => !x.startsWith("SUPPOSEE")).length,
    supposees: inventions(rows).filter((x) => x.startsWith("SUPPOSEE")).length,
    sommes,
    // Registre de l'import : lignes ecartees par motif (Phase 1).
    registre: (tables.ImportIssue || []).reduce((acc: Record<string, number>, i: any) => {
      acc[i.reason_code] = (acc[i.reason_code] || 0) + 1; return acc;
    }, {}),
    // Une ligne ecrite par entite : sert a verifier a l'oeil le rattachement.
    echantillons: Object.fromEntries(Object.entries(tables).filter(([n]) => !ENTITES_TECHNIQUES.has(n))
      .map(([n, rs]) => [n, Object.fromEntries(Object.entries(rs[0] || {}).filter(([k]) => !["original_data", "id", "created_date", "import_id", "fingerprint"].includes(k)))])),
  };
}

(async () => {
  const etiquette = process.argv[2] || "courant";
  const log = console.log;
  const bruit = console.warn;
  console.warn = () => {}; console.error = () => {};
  const mesures: Mesure[] = [];
  for (const cas of CORPUS) mesures.push(await mesurerCas(cas));
  const reels: any[] = [];
  for (const c of CLASSEURS_REELS) { const m = await mesurerReel(c); if (m) reels.push(m); }
  console.warn = bruit;

  log(`\n=== Banc de reconnaissance — ${etiquette} (${AUJOURDHUI}) ===\n`);
  log("cas".padEnd(30), "donn.", "impo.", "quar.", "PERDU", "INVENT", "BRUT-", "S/TRACE", "MAL-LU", "NON-SIGNALE");
  for (const m of mesures) {
    log(m.id.padEnd(30), String(m.donnees).padStart(5), String(m.importees).padStart(5), String(m.quarantaine).padStart(5),
      String(m.perdues).padStart(5), String(m.inventees).padStart(6), String(m.brut_manquant).padStart(5), String(m.sans_trace).padStart(7),
      String(m.mal_interpretees).padStart(6), m.non_signale.join(", ") + (m.incoherent ? `  !! ${m.incoherent} import(s) aux compteurs incoherents` : ""));
  }
  const tot = (k: keyof Mesure) => mesures.reduce((s, m) => s + (m[k] as number), 0);
  const totaux = {
    donnees: tot("donnees"), importees: tot("importees"), quarantaine: tot("quarantaine"),
    perdues: tot("perdues"), inventees: tot("inventees"), brut_manquant: tot("brut_manquant"),
    non_signale: mesures.reduce((s, m) => s + m.non_signale.length, 0),
    sans_trace: tot("sans_trace"), incoherent: tot("incoherent"), mal_interpretees: tot("mal_interpretees"),
  };
  log("TOTAL".padEnd(30), String(totaux.donnees).padStart(5), String(totaux.importees).padStart(5), String(totaux.quarantaine).padStart(5),
    String(totaux.perdues).padStart(5), String(totaux.inventees).padStart(6), String(totaux.brut_manquant).padStart(5),
    String(totaux.sans_trace).padStart(7), String(totaux.mal_interpretees).padStart(6), String(totaux.non_signale));

  for (const r of reels) {
    log(`\n--- ${r.fichier} (inventions : ${r.inventees}, hypotheses : ${r.supposees ?? "?"})`);
    log(`  observations : ${r.observations} ; KPI changés par les observations : ${r.kpi_divergents.length}${r.kpi_divergents.length ? " — " + r.kpi_divergents.slice(0, 4).join(" ; ") : ""}`);
    for (const f of r.feuilles) log(`  ${String(f.feuille).padEnd(62)} ${String(f.entite).padEnd(16)} ${f.importees}/${f.lues}  quar. ${f.quarantaine}`);
    log("  sommes :", JSON.stringify(r.sommes));
    if (r.registre && Object.keys(r.registre).length) log("  registre :", JSON.stringify(r.registre));
  }

  if (process.env.BANC_DETAILS) {
    for (const m of mesures) { log(`\n# ${m.id} — ${m.titre}`); m.details.forEach((d) => log("  ", d)); }
  }

  const dossier = path.join("tests", "banc", "resultats");
  fs.mkdirSync(dossier, { recursive: true });
  fs.writeFileSync(path.join(dossier, `${etiquette}.json`), JSON.stringify({ date: AUJOURDHUI, totaux, mesures, reels }, null, 2));

  const reference = path.join(dossier, process.env.BANC_REFERENCE || "avant.json");
  if (etiquette !== "avant" && fs.existsSync(reference)) {
    const avant = JSON.parse(fs.readFileSync(reference, "utf8"));
    log("\n=== Comparaison avec « avant » ===");
    for (const k of Object.keys(totaux) as (keyof typeof totaux)[]) {
      if (avant.totaux[k] === undefined) { log(`  ${k.padEnd(14)}     — -> ${String(totaux[k]).padStart(5)}  (nouvelle mesure)`); continue; }
      const d = totaux[k] - avant.totaux[k];
      log(`  ${k.padEnd(14)} ${String(avant.totaux[k]).padStart(5)} -> ${String(totaux[k]).padStart(5)}  ${d === 0 ? "" : d > 0 ? "+" + d : d}`);
    }
    for (const r of reels) {
      const a = avant.reels.find((x: any) => x.fichier === r.fichier);
      if (!a) continue;
      for (const f of r.feuilles) {
        const fa = a.feuilles.find((x: any) => x.feuille === f.feuille) || {};
        if (fa.importees !== f.importees || fa.quarantaine !== f.quarantaine || fa.entite !== f.entite) {
          log(`  ${f.feuille}: ${fa.entite}/${fa.importees}/q${fa.quarantaine} -> ${f.entite}/${f.importees}/q${f.quarantaine}`);
        }
      }
      for (const k of new Set([...Object.keys(a.sommes), ...Object.keys(r.sommes)])) {
        if (a.sommes[k] !== r.sommes[k]) log(`  somme ${k}: ${a.sommes[k]} -> ${r.sommes[k]}`);
      }
    }
  }
})();
