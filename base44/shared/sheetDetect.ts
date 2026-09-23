// Entity detection for imported sheets/files.
// Two independent strategies, because a sheet name alone misses a lot:
//   1. the sheet/file name,
//   2. the column headers (a signature of required fields).
// Also recovers the header row when a sheet starts with a title line, which
// otherwise yields __EMPTY columns and zero usable rows.

import * as XLSX from "npm:xlsx@0.18.5";
import { stripAccents } from "./importUtils.ts";

// Detection par le nom deplacee vers importUtils.ts (22 sept 2026), comme la
// detection par en-tetes : le classement des entites par preuves
// (core/recognition/preuves.ts) en a besoin et doit rester testable sans xlsx.
export { detectEntityByName, NAME_ENTITY_MAP } from "./importUtils.ts";

// Header signatures: every "must" column has to be present. Ordered from the
// most specific signature to the least, so CampaignDaily wins over Campaign.
// Detection par en-tetes deplacee vers importUtils.ts (18 sept 2026) : ces
// fonctions sont pures (aucune dependance a XLSX), contrairement au reste de
// ce fichier — les y laisser empechait de les tester sous le test runner Node
// du repo (npm:xlsx@0.18.5 n'est resolvable que sous Deno), exactement le
// probleme deja rencontre avec deriveFallbackIdentity. Re-exportees ici pour
// ne rien casser chez les appelants existants.
export {
  detectEntityByFieldOverlap,
  entiteCompatible,
  detectEntityByHeaders,
} from "./importUtils.ts";

/**
 * Une cellule ressemble-t-elle a un libelle de colonne ?
 *
 * Un libelle est du texte qui ne se lit ni comme un nombre ("1 000,00 $",
 * "(500)", "12 %") ni comme une date ("2026-03-01", "01/03/2026"). Le test
 * reste volontairement grossier et local : il ne sert qu'a reperer la ligne
 * d'en-tetes, pas a valider une valeur — c'est le role de importUtils, qui
 * importe deja ce module et ne peut donc pas etre importe en retour.
 */
const RESSEMBLE_A_UN_NOMBRE = /^[(+-]?[\d\s.,'\u2019\u00a0]+[\s%$\u20ac\u00a3\u00a5)]*$/;
const RESSEMBLE_A_UNE_DATE = /^\d{1,4}[\/\-.]\d{1,2}([\/\-.]\d{1,4})?([T\s].*)?$/;

function estLibelle(cellule: any): boolean {
  if (typeof cellule !== "string") return false;
  const t = cellule.trim();
  if (t === "") return false;
  if (RESSEMBLE_A_UN_NOMBRE.test(t)) return false;
  if (RESSEMBLE_A_UNE_DATE.test(t)) return false;
  return true;
}

/**
 * Index de la ligne qui porte les intitules de colonnes.
 *
 * C'est celle qui contient le plus de LIBELLES — du texte qui n'est ni un
 * nombre ni une date. Compter simplement les cellules de type chaine ne suffit
 * pas : un fichier texte est lu sans conversion (voir csvParse.ts, raw: true),
 * donc toutes les cellules sont des chaines et une ligne de donnees ayant une
 * colonne de plus que l'en-tete l'emportait.
 *
 * Exporte parce que le plan de lecture de secours (importPlan.ts) en a besoin
 * quand l'analyse par IA n'est pas disponible.
 */
export function trouverLigneEntetes(matrix: any[][]): number {
  let headerIdx = 0;
  let bestScore = -1;
  for (let i = 0; i < Math.min(matrix.length, 10); i += 1) {
    const row = matrix[i] || [];
    const filled = row.filter((c) => String(c ?? "").trim() !== "").length;
    const libelles = row.filter((c) => estLibelle(c)).length;
    // Les libelles pesent double : c'est le signe distinctif d'un en-tete,
    // le remplissage ne departage que des lignes egales par ailleurs.
    const score = filled >= 2 ? libelles * 2 + filled : -1;
    // `>` strict : a egalite, la ligne la plus haute gagne, donc l'en-tete
    // plutot que la premiere ligne de donnees qui lui ressemblerait.
    if (score > bestScore) { bestScore = score; headerIdx = i; }
  }
  return headerIdx;
}

/**
 * Rows of a sheet, with header-row recovery.
 * A sheet whose first line is a title produces __EMPTY_1, __EMPTY_2… headers;
 * in that case we scan the first rows for the real header line.
 */
export function sheetRows(sheet: any): { rows: Record<string, any>[]; headers: string[] } {
  const matrix = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "", blankrows: false }) as any[][];
  if (matrix.length === 0) return { rows: [], headers: [] };

  const headerIdx = trouverLigneEntetes(matrix);

  const headers = (matrix[headerIdx] || []).map((h, i) => (String(h ?? "").trim() || `col_${i + 1}`));
  const rows: Record<string, any>[] = [];
  for (let i = headerIdx + 1; i < matrix.length; i += 1) {
    const raw = matrix[i] || [];
    if (raw.every((c) => String(c ?? "").trim() === "")) continue;
    const obj: Record<string, any> = {};
    headers.forEach((h, idx) => { obj[h] = raw[idx] ?? ""; });
    rows.push(obj);
  }
  return { rows, headers };
}

/**
 * Feuille qui DECRIT des colonnes au lieu de contenir des donnees : un
 * dictionnaire de donnees (« Column_Name / Description / Data_Type »).
 * L'importer comme des ventes produisait 36 commandes en quarantaine pour
 * « date manquante » : un faux probleme, et une vraie information perdue.
 */
export function estDictionnaireDeDonnees(entetes: string[]): boolean {
  const mots = entetes.map((h) => String(h ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase()
    .replace(/([a-z])([A-Z])/g, "$1 $2").split(/[^a-z0-9]+/).filter(Boolean));
  const nomDeColonne = mots.some((m) => m.some((x) => ["column", "colonne", "champ", "field", "variable", "attribut", "attribute"].includes(x))
    && (m.length === 1 || m.some((x) => ["name", "nom", "names"].includes(x))));
  const definition = mots.some((m) => m.some((x) => ["description", "definition", "meaning", "signification", "libelle"].includes(x)));
  const typeOuExemple = mots.some((m) => m.some((x) => ["type", "example", "exemple", "format", "meaning", "unit", "unite"].includes(x)));
  return nomDeColonne && definition && typeOuExemple;
}
