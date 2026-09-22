// Banc du retraitement sans reimport (Phase 3, directives §17, §18).
//
// Chaque scenario importe un classeur par le vrai point d'entree, change ce que
// le moteur sait (dictionnaire de l'entreprise, type choisi), puis appelle le
// vrai reprocessImport sur la MEME base en memoire. On mesure ce qui est
// recupere, et on verifie que le retraitement ne cree ni doublon ni ecriture
// en mode simulation.

import reprocess from "../../base44/functions/reprocessImport/entry.ts";
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
  const dossier = path.join("tests", "banc", "resultats");
  fs.mkdirSync(dossier, { recursive: true });
  fs.writeFileSync(path.join(dossier, `${etiquette}-reprise.json`), JSON.stringify(mesures, null, 2));
})();
