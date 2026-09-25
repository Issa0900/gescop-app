// Sens d'une transaction (revenu ou dépense), une seule règle pour l'import
// (importUtils.ts, normalizeRow) et pour les pages (src/lib/transactionClassifier.js).
//
// Rapport du 25 sept. 2026 : quand le type était perdu, les deux côtés
// présumaient « montant positif = revenu », et toutes les dépenses d'un fichier
// saisi en montants positifs devenaient du chiffre d'affaires (+70 %), sans
// aucun signal. Désormais : type explicite, sinon signe négatif, sinon un indice
// dans la catégorie ou la description ; sinon aucun sens n'est présumé — la
// transaction n'entre ni dans le CA ni dans les charges, et c'est signalé.

export type Sens = "income" | "expense";

/** Mots qui désignent un revenu (sans accents, minuscules). */
export const MOTS_REVENU = [
  "income", "revenue", "revenues", "revenu", "revenus", "entree", "entrees", "credit", "encaissement", "encaissements",
  "vente", "ventes", "recette", "recettes", "sales",
];

/** Mots qui désignent une dépense (sans accents, minuscules). */
export const MOTS_DEPENSE = [
  "expense", "expenses", "depense", "depenses", "sortie", "sorties", "debit", "decaissement", "decaissements",
  "charge", "charges", "frais", "achat", "achats", "remboursement", "refund", "transfer", "transfert",
  "salaire", "salaires", "paie", "payroll", "cout", "couts", "cost", "costs", "loyer", "loyers", "rent",
  "assurance", "assurances", "insurance", "entretien", "maintenance", "reparation", "reparations",
  "marketing", "publicite", "publicitaire", "publicitaires", "advertising", "electricite", "chauffage", "utilities",
  "taxe", "taxes", "impot", "impots", "tax", "interet", "interets", "interest", "fournisseur", "fournisseurs", "supplier",
];

/** Expressions de plusieurs mots qui désignent une dépense. */
const EXPRESSIONS_DEPENSE = ["services publics", "frais bancaires", "cout des marchandises"];

const normaliser = (s: unknown) =>
  String(s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

/**
 * Sens désigné par un texte (type, catégorie ou description), ou null s'il ne
 * dit rien ou dit les deux (« remboursement de vente »).
 */
export function sensDe(texte: unknown): Sens | null {
  const t = normaliser(texte);
  if (!t) return null;
  const mots = t.split(/[^a-z0-9]+/).filter(Boolean);
  const revenu = mots.some((m) => MOTS_REVENU.includes(m));
  const depense = mots.some((m) => MOTS_DEPENSE.includes(m)) || EXPRESSIONS_DEPENSE.some((e) => t.includes(e));
  if (revenu === depense) return null;
  return revenu ? "income" : "expense";
}

/**
 * Sens d'une transaction dont le type est absent ou illisible : le signe
 * négatif, puis la catégorie, puis la description. null si rien ne permet de
 * trancher (jamais « revenu » par défaut).
 */
export function sensParIndices(montant: number | null | undefined, ...textes: unknown[]): Sens | null {
  if (typeof montant === "number" && Number.isFinite(montant) && montant < 0) return "expense";
  for (const t of textes) {
    const s = sensDe(t);
    if (s) return s;
  }
  return null;
}
