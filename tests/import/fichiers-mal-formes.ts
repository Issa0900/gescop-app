// Fichiers tels que les PME les produisent vraiment : exports Excel francais,
// titres avant les en-tetes, colonnes mal nommees, lignes vides, cellules
// manquantes. On mesure combien de lignes SURVIVENT jusqu'aux indicateurs.
import { parseDelimitedText } from "../../base44/shared/csvParse.ts";
import { detectEntityByName, detectEntityByHeaders, detectEntityByFieldOverlap } from "../../base44/shared/sheetDetect.ts";
import { normalizeRow } from "../../base44/shared/importUtils.ts";
import { getSchema } from "../../base44/shared/entitySchemas.ts";
import { missingRequired } from "../../base44/shared/bulkInsert.ts";

const schema = getSchema("Transaction")!;

function traiter(nomFichier: string, texte: string) {
  let rows: Record<string, any>[] = [];
  let erreur = "";
  try { rows = parseDelimitedText(texte); } catch (e: any) { erreur = e.message; }
  const entetes = rows.length > 0 ? Object.keys(rows[0]) : [];
  const entite = detectEntityByName(nomFichier) || detectEntityByHeaders(entetes) || detectEntityByFieldOverlap(entetes);
  let ok = 0, quarantaine = 0;
  for (const r of rows) {
    const n = normalizeRow("Transaction", r, "i", schema.properties, "csv", []);
    if (missingRequired(n, schema.required).length === 0) ok++; else quarantaine++;
  }
  return { rows: rows.length, entetes, entite, ok, quarantaine, erreur };
}

const LIGNES_UTILES = 3; // chaque fichier contient 3 transactions valides
const cas: [string, string, string][] = [
  ["A. CSV standard (virgule)", "ventes.csv",
   "Date,Montant,Type\n2026-03-01,1000,Revenu\n2026-03-02,500,Dépense\n2026-03-03,750,Revenu\n"],

  ["B. CSV point-virgule (Excel FR)", "ventes.csv",
   "Date;Montant;Type\n01/03/2026;1 000,00 $;Revenu\n02/03/2026;500,00 $;Dépense\n03/03/2026;750,00 $;Revenu\n"],

  ["C. BOM + point-virgule", "ventes.csv",
   "﻿Date;Montant;Type\n01/03/2026;1000;Revenu\n02/03/2026;500;Dépense\n03/03/2026;750;Revenu\n"],

  ["D. Titre avant les en-tetes", "ventes.csv",
   "Rapport de ventes - mars 2026\n\nDate,Montant,Type\n2026-03-01,1000,Revenu\n2026-03-02,500,Dépense\n2026-03-03,750,Revenu\n"],

  ["E. En-tetes sales (espaces, casse)", "ventes.csv",
   "  DATE opération  ,  MONTANT  , Type \n2026-03-01,1000,Revenu\n2026-03-02,500,Dépense\n2026-03-03,750,Revenu\n"],

  ["F. Lignes vides intercalees", "ventes.csv",
   "Date,Montant,Type\n2026-03-01,1000,Revenu\n\n2026-03-02,500,Dépense\n\n\n2026-03-03,750,Revenu\n\n"],

  ["G. Cellules manquantes en fin de ligne", "ventes.csv",
   "Date,Montant,Type,Catégorie\n2026-03-01,1000,Revenu,Ventes\n2026-03-02,500,Dépense\n2026-03-03,750,Revenu\n"],

  ["H. Colonne en trop sans en-tete", "ventes.csv",
   "Date,Montant,Type\n2026-03-01,1000,Revenu,note interne\n2026-03-02,500,Dépense,\n2026-03-03,750,Revenu,\n"],

  ["I. Formats de date melanges", "ventes.csv",
   "Date,Montant,Type\n2026-03-01,1000,Revenu\n02/03/2026,500,Dépense\n3 mars 2026,750,Revenu\n"],

  ["J. Montants avec espace insecable", "ventes.csv",
   "Date,Montant,Type\n2026-03-01,\"1 000,00 $\",Revenu\n2026-03-02,\"500,00 $\",Dépense\n2026-03-03,\"750,00 $\",Revenu\n"],

  ["K. En-tetes dupliques", "ventes.csv",
   "Date,Montant,Type,Montant\n2026-03-01,1000,Revenu,1000\n2026-03-02,500,Dépense,500\n2026-03-03,750,Revenu,750\n"],

  ["L. Tabulations", "ventes.tsv",
   "Date\tMontant\tType\n2026-03-01\t1000\tRevenu\n2026-03-02\t500\tDépense\n2026-03-03\t750\tRevenu\n"],
];

let echecs = 0;
for (const [libelle, nom, texte] of cas) {
  const r = traiter(nom, texte);
  const parfait = r.ok === LIGNES_UTILES && !r.erreur;
  if (!parfait) echecs++;
  console.log(`${parfait ? "ok  " : "KO  "} ${libelle.padEnd(36)} lignes lues:${String(r.rows).padStart(2)} | acceptees:${r.ok}/${LIGNES_UTILES} | quarantaine:${r.quarantaine} | type:${r.entite}${r.erreur ? " | ERREUR " + r.erreur : ""}`);
  if (!parfait) console.log(`     en-tetes lus: ${JSON.stringify(r.entetes)}`);
}
console.log("\nfichiers en echec :", echecs, "/", cas.length);
