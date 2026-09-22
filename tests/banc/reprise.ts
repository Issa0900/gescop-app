// Banc du retraitement sans reimport (Phase 3, directives §17, §18).
//
// Chaque scenario importe un classeur par le vrai point d'entree, change ce que
// le moteur sait (dictionnaire de l'entreprise, type choisi), puis appelle le
// vrai reprocessImport sur la MEME base en memoire. On mesure ce qui est
// recupere, et on verifie que le retraitement ne cree ni doublon ni ecriture
// en mode simulation.

import reprocess from "../../base44/functions/reprocessImport/entry.ts";
import resolveDuplicate from "../../base44/functions/resolveDuplicate/entry.ts";
import { importer, classeur, fauxClient } from "./outils.ts";

declare const require: any;
declare const process: any;
const fs = require("fs");
const path = require("path");

async function retraiter(base: ReturnType<typeof fauxClient>, corps: any) {
  (globalThis as any).__BASE44_STUB = base.client;
  const res = await (reprocess as any)(new Request("http://banc/reprocessImport", { method: "POST", body: JSON.stringify(corps) }));
  return res.json();
}

const compter = (base: ReturnType<typeof fauxClient>, entite: string) => (base.tables[entite] || []).length;
const enAttente = (base: ReturnType<typeof fauxClient>) => (base.tables.ImportIssue || []).filter((i: any) => i.recovery_status === "PENDING").length;

interface Scenario {
  id: string; titre: string; attendues: number;
  jouer: () => Promise<{ avant: number; apres: number; recuperees: number; doublons_crees: number; ecritures_simulation: number; detail: string }>;
}

const SCENARIOS: Scenario[] = [
  {
    id: "R1-dictionnaire",
    titre: "Colonne montant inconnue, puis apprise par le dictionnaire",
    attendues: 3,
    jouer: async () => {
      const base = fauxClient();
      await importer("releve.xlsx", classeur({ Releve: [
        ["Date", "Mnt réglé", "Type", "Description"],
        ["2026-03-01", "1200", "Revenu", "Vente A"],
        ["2026-03-02", "300", "Dépense", "Papeterie"],
        ["2026-03-03", "850", "Revenu", "Vente B"],
      ] }), "Transaction", undefined, base);
      const avant = compter(base, "Transaction");
      // L'entreprise apprend le terme (Parametres > Dictionnaire, ou correction a l'import).
      base.tables.Company = [{ id: "co-1", company_dictionary: { "Mnt réglé": "amount" } }];
      const imp = base.tables.Import[0];
      const r = await retraiter(base, { import_id: imp.id });
      const apres = compter(base, "Transaction");
      const second = await retraiter(base, { import_id: imp.id });
      return {
        avant, apres, recuperees: r.recovered,
        doublons_crees: compter(base, "Transaction") - apres + (second.recovered || 0),
        ecritures_simulation: 0,
        detail: `${r.results?.[0]?.message || ""} | import : ${JSON.stringify({ traitees: imp.rows_processed, recuperees: imp.recovered_rows, statut: imp.status })}`,
      };
    },
  },
  {
    id: "R2-type-choisi",
    titre: "Feuille au type non reconnu, integree une fois le type choisi",
    attendues: 2,
    jouer: async () => {
      const base = fauxClient();
      await importer("export.xlsx", classeur({ Feuil1: [
        ["Réf", "Jour", "Somme", "Nature"],
        ["X-1", "2026-04-01", "450", "Revenu"],
        ["X-2", "2026-04-02", "90", "Dépense"],
      ] }), undefined, undefined, base);
      const avant = compter(base, "Transaction");
      base.tables.Company = [{ id: "co-1", company_dictionary: { "Jour": "date", "Somme": "amount", "Nature": "type" } }];
      const imp = base.tables.Import[0];
      const r = await retraiter(base, { import_id: imp.id, entity_type: "Transaction" });
      return {
        avant, apres: compter(base, "Transaction"), recuperees: r.recovered, doublons_crees: 0, ecritures_simulation: 0,
        detail: `import avant : type ${imp.entity_type ?? "?"} | ${JSON.stringify(r.results?.[0] || {}).slice(0, 200)}`,
      };
    },
  },
  {
    id: "R3-simulation",
    titre: "Mode simuler : annonce la recuperation sans rien ecrire",
    attendues: 3,
    jouer: async () => {
      const base = fauxClient();
      await importer("releve.xlsx", classeur({ Releve: [
        ["Date", "Mnt réglé", "Type"], ["2026-03-01", "1200", "Revenu"], ["2026-03-02", "300", "Dépense"], ["2026-03-03", "80", "Dépense"],
      ] }), "Transaction", undefined, base);
      base.tables.Company = [{ id: "co-1", company_dictionary: { "Mnt réglé": "amount" } }];
      const imp = base.tables.Import[0];
      // Une table vide creee par une simple lecture du faux client n'est pas une ecriture.
      const etat = () => JSON.stringify(Object.entries(base.tables).filter(([, v]) => v.length > 0));
      const avantEcritures = etat();
      const r = await retraiter(base, { import_id: imp.id, mode: "simuler" });
      const change = etat() !== avantEcritures ? 1 : 0;
      return {
        avant: 0, apres: compter(base, "Transaction"), recuperees: r.recovered, doublons_crees: 0, ecritures_simulation: change,
        detail: `annonce ${r.recovered} ligne(s) récupérable(s), base ${change ? "MODIFIEE" : "inchangée"}, en attente : ${enAttente(base)}`,
      };
    },
  },
  {
    id: "R4-donnee-invalide",
    titre: "Une date reellement illisible reste en quarantaine, avec son motif",
    attendues: 1,
    jouer: async () => {
      const base = fauxClient();
      await importer("releve.xlsx", classeur({ Releve: [
        ["Date", "Mnt réglé", "Type"], ["2026-03-01", "1200", "Revenu"], ["le mois dernier", "300", "Dépense"],
      ] }), "Transaction", undefined, base);
      base.tables.Company = [{ id: "co-1", company_dictionary: { "Mnt réglé": "amount" } }];
      const imp = base.tables.Import[0];
      const r = await retraiter(base, { import_id: imp.id });
      const reste = (base.tables.ImportIssue || []).find((i: any) => i.recovery_status === "PENDING");
      return {
        avant: 0, apres: compter(base, "Transaction"), recuperees: r.recovered, doublons_crees: 0, ecritures_simulation: 0,
        detail: `reste en attente : ${reste ? `${reste.reason_code} (${reste.raw_value})` : "aucune"}`,
      };
    },
  },
];

async function decider(base: ReturnType<typeof fauxClient>, issue_id: string, decision: string) {
  (globalThis as any).__BASE44_STUB = base.client;
  const res = await (resolveDuplicate as any)(new Request("http://banc/resolveDuplicate", { method: "POST", body: JSON.stringify({ issue_id, decision }) }));
  return { status: res.status, corps: await res.json() };
}

async function scenarioDoublons(): Promise<[boolean, string][]> {
  const base = fauxClient();
  await importer("caisse.xlsx", classeur({ Caisse: [
    ["Date", "Montant", "Type", "Description"],
    ["2026-09-20", "47.50", "Revenu", "Pain x10"],
    ["2026-09-20", "47.50", "Revenu", "Pain x10"],
    ["2026-09-20", "47.50", "Revenu", "Pain x10"],
    ["2026-09-20", "12.00", "Revenu", "Café x4"],
  ] }), "Transaction", undefined, base);
  const imp = base.tables.Import[0];
  const aVerifier = () => (base.tables.ImportIssue || []).filter((i: any) => i.row_status === "DUPLICATE_EXACT" && i.review_status === "A_VERIFIER");
  const v: [boolean, string][] = [];
  v.push([compter(base, "Transaction") === 4 && aVerifier().length === 2, `import : 4 ventes gardées, ${aVerifier().length} doublon(s) potentiel(s) à vérifier (attendu 4 / 2)`]);
  v.push([imp.potential_duplicates === 2, `Import.potential_duplicates = ${imp.potential_duplicates} (attendu 2)`]);

  const [premier, second] = aVerifier();
  const ex = await decider(base, premier.id, "exclure");
  const pains = base.tables.Transaction.filter((t: any) => t.description === "Pain x10").length;
  v.push([ex.status === 200 && pains === 2, `exclure : ${pains} vente(s) « Pain x10 » restantes (attendu 2)`]);
  v.push([premier.review_status === "EXCLU" && premier.row_status === "DUPLICATE" && Boolean(premier.raw_row), `registre : ligne brute conservée, décision tracée (${premier.review_status})`]);
  v.push([imp.rows_processed === 3 && imp.duplicate_rows === 1 && imp.potential_duplicates === 1, `Import : ${imp.rows_processed} valides, ${imp.duplicate_rows} doublon, ${imp.potential_duplicates} à vérifier (attendu 3 / 1 / 1)`]);

  const co = await decider(base, second.id, "conserver");
  v.push([co.status === 200 && compter(base, "Transaction") === 3 && imp.potential_duplicates === 0, `conserver : aucune ligne retirée, plus rien à vérifier (${compter(base, "Transaction")} ventes, ${imp.potential_duplicates} à vérifier)`]);

  const encore = await decider(base, premier.id, "exclure");
  v.push([encore.status === 409 && compter(base, "Transaction") === 3, `re-exclure une décision déjà prise : refusé (${encore.status}), rien n'est retiré`]);

  // Les observations (moteur KPI) de la copie exclue sortent avec elle. Un
  // fichier de campagnes en produit (concept finance.revenue sur « revenue »).
  const camp = fauxClient();
  await importer("campagnes.xlsx", classeur({ Campagnes: [
    ["Canal", "Date", "Dépenses", "Revenue"],
    ["Meta Ads", "2026-09-01", 300, 1200],
    ["Meta Ads", "2026-09-01", 300, 1200],
  ] }), "Campaign", undefined, camp);
  const obs = () => (camp.tables.Observation || []).length;
  const avantObs = obs();
  const signal = (camp.tables.ImportIssue || []).find((i: any) => i.row_status === "DUPLICATE_EXACT");
  const r = signal ? await decider(camp, signal.id, "exclure") : { status: 0, corps: {} };
  v.push([avantObs > 0 && r.status === 200 && obs() === avantObs / 2 && compter(camp, "Campaign") === 1,
    `observations KPI : ${avantObs} → ${obs()} après exclusion (celles de la copie retirées), ${compter(camp, "Campaign")} campagne restante`]);
  return v;
}

(async () => {
  const etiquette = process.argv[2] || "courant";
  const log = console.log;
  console.warn = () => {}; console.error = () => {};
  log(`\n=== Retraitement sans réimport — ${etiquette} ===\n`);
  log("scenario".padEnd(22), "attendu", "récup.", "avant→après", "doublons", "simu-écrit");
  const mesures: any[] = [];
  for (const s of SCENARIOS) {
    const m = await s.jouer();
    mesures.push({ id: s.id, titre: s.titre, attendues: s.attendues, ...m });
    log(s.id.padEnd(22), String(s.attendues).padStart(7), String(m.recuperees).padStart(6), `${m.avant}→${m.apres}`.padStart(11),
      String(m.doublons_crees).padStart(8), String(m.ecritures_simulation).padStart(10));
    if (process.env.BANC_DETAILS) log("   ", m.detail);
  }
  // Doublons potentiels : decision humaine apres verification (resolveDuplicate).
  log(`
=== Doublons potentiels : exclure / conserver après vérification ===
`);
  const verifs = await scenarioDoublons();
  for (const [ok, libelle] of verifs) log(`${ok ? "ok  " : "KO  "} ${libelle}`);
  mesures.push({ id: "D1-doublons-a-verifier", verifications: verifs.map(([ok, libelle]) => ({ ok, libelle })) });

  const dossier = path.join("tests", "banc", "resultats");
  fs.mkdirSync(dossier, { recursive: true });
  fs.writeFileSync(path.join(dossier, `${etiquette}-reprise.json`), JSON.stringify(mesures, null, 2));
})();
