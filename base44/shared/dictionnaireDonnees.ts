// Apprendre d'un dictionnaire de donnees.
//
// Un fichier « Column_Name / Description / Business_Meaning » decrit les
// colonnes d'un autre fichier. Il n'est pas importe comme des donnees
// (sheetDetect.estDictionnaireDeDonnees) : on s'en sert pour apprendre le sens
// des colonnes que GESCOP ne reconnait pas par leur seul nom. Le sens est lu
// dans la description avec le meme lexique par mots que les en-tetes ; un
// terme que GESCOP reconnait deja, ou que l'entreprise a deja defini, n'est
// jamais reecrit (une decision humaine l'emporte toujours).

import { champParLexique } from "./registry/lexiqueChamps.ts";
import { cleCanonique, normalizeKeys } from "./importUtils.ts";
import { getSchema } from "./entitySchemas.ts";

// Ordre d'essai : les entites les plus courantes d'abord.
const ENTITES = ["Order", "Customer", "Product", "Inventory", "Transaction", "Expense", "Campaign", "CampaignDaily",
  "Employee", "Payroll", "Supplier", "Purchase", "Cashflow", "Payment", "Asset"];

const mots = (h: string) => String(h ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);

function colonne(entetes: string[], cles: string[]): number {
  return entetes.findIndex((h) => mots(h).some((m) => cles.includes(m)));
}

export interface TermeAppris { terme: string; champ: string; entite: string; source: string }

/**
 * Termes du dictionnaire dont le sens se deduit de leur description.
 * `connus` : dictionnaire de l'entreprise deja indexe (cleCanonique -> champ).
 */
export function apprendreDictionnaire(matrix: any[][], ligneEntetes: number, connus: Record<string, string> = {}): TermeAppris[] {
  const entetes = (matrix[ligneEntetes] || []).map((h: any) => String(h ?? ""));
  const iNom = colonne(entetes, ["column", "colonne", "champ", "field", "variable", "attribut", "attribute"]);
  // La DEFINITION seulement : une colonne « Business_Meaning » decrit l'usage
  // (« Promotion and margin analysis ») et faisait apprendre n'importe quoi.
  let iDef = colonne(entetes, ["description", "definition", "signification", "libelle"]);
  if (iDef === iNom) iDef = -1;
  if (iDef < 0) iDef = colonne(entetes, ["meaning"]);
  if (iNom < 0 || iDef < 0) return [];
  const lignes = matrix.slice(ligneEntetes + 1)
    .map((r) => ({ terme: String((r || [])[iNom] ?? "").trim(), definition: String((r || [])[iDef] ?? "").trim() }))
    .filter((l) => l.terme);

  // Un dictionnaire decrit UN fichier : son entite est celle qui reconnait le
  // plus de ses colonnes par leur nom. On n'apprend que des champs de celle-ci.
  const champDe = (e: string, terme: string): string | null => {
    const lex = champParLexique(e, terme);
    if (lex) return lex;
    const props = getSchema(e)?.properties || {};
    const k = Object.keys(normalizeKeys({ [terme]: 1 }, props, undefined, undefined, e))[0];
    return k && props[k] ? k : null;
  };
  const reconnu = (e: string, terme: string) => champDe(e, terme) !== null;
  let entite = "", meilleur = 0;
  for (const e of ENTITES) {
    const n = lignes.filter((l) => reconnu(e, l.terme)).length;
    if (n > meilleur) { meilleur = n; entite = e; }
  }
  if (!entite || meilleur < 2) return [];

  // Un champ deja porte par une autre colonne du fichier n'est jamais appris
  // une seconde fois (« Order_Year » ne doit pas disputer la date a « Order_Date »).
  const couverts = new Set(lignes.map((l) => champDe(entite, l.terme)).filter(Boolean));
  const appris: TermeAppris[] = [];
  for (const { terme, definition } of lignes) {
    if (connus[cleCanonique(terme)] || reconnu(entite, terme)) continue;
    // Le nom du terme garde son veto : « Discount_Percentage » decrit « Discount
    // applied » mais n'est pas un montant de remise (regle `sauf` du lexique).
    const champ = champParLexique(entite, `${terme} ${definition}`);
    if (champ && !couverts.has(champ)) {
      appris.push({ terme, champ, entite, source: definition.slice(0, 120) });
      couverts.add(champ);
    }
  }
  return appris;
}
