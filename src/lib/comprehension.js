// Ce que GESCOP a réellement compris des données de l'entreprise, pour
// Paramètres > Compréhension (UnderstandingPanel).
//
// Le panneau affichait un texte écrit en dur (« Succursales physiques
// (Montréal, Québec, Laval, Lévis) », « confiance sémantique moyenne : 98.2 % »)
// identique pour toutes les entreprises (lot 6, 24 sept. 2026). Tout ce qui est
// rendu ici vient des imports, de la structure saisie et des ventes ; une
// valeur qui ne peut pas être mesurée vaut null, jamais un chiffre plausible.

const LIBELLES_ENTITES = {
  Order: "Ventes / commandes", Transaction: "Transactions", Customer: "Clients", Product: "Produits",
  Inventory: "Inventaire", Supplier: "Fournisseurs", Purchase: "Achats", Campaign: "Campagnes",
  CampaignDaily: "Campagnes (suivi quotidien)", Employee: "Employés", Payroll: "Paie", Expense: "Dépenses",
  Cashflow: "Trésorerie", Asset: "Immobilisations", Payment: "Encaissements", Interaction: "Interactions clients",
};

export const libelleEntite = (e) => LIBELLES_ENTITES[e] || e;

const texte = (v) => (v == null ? "" : String(v).trim());

/**
 * @param {{ imports?: any[], company?: any, orders?: any[], employees?: any[] }} donnees
 * @returns {{
 *   aDesImports: boolean,
 *   types: { entite: string, libelle: string, lignes: number, imports: number }[],
 *   succursales: string[],
 *   succursalesSource: { saisies: number, vues: number },
 *   lignesLues: number, lignesImportees: number,
 *   tauxImport: number | null,
 *   colonnesNonReconnues: string[],
 * }}
 */
export function resumerComprehension({ imports = [], company = null, orders = [], employees = [] } = {}) {
  const parEntite = new Map();
  let lignesLues = 0;
  let lignesImportees = 0;
  const inconnues = new Set();

  for (const imp of imports || []) {
    const importees = Number(imp?.rows_processed) || 0;
    if (imp?.entity_type) {
      const t = parEntite.get(imp.entity_type) || { entite: imp.entity_type, libelle: libelleEntite(imp.entity_type), lignes: 0, imports: 0 };
      t.lignes += importees;
      t.imports += 1;
      parEntite.set(imp.entity_type, t);
    }
    // Le taux ne porte que sur les imports qui disent combien de lignes ils ont lues.
    const lues = Number(imp?.total_rows) || 0;
    if (lues > 0) {
      lignesLues += lues;
      lignesImportees += Math.min(importees, lues);
    }
    for (const c of Array.isArray(imp?.unknown_fields) ? imp.unknown_fields : []) if (texte(c)) inconnues.add(texte(c));
  }

  // Succursales : celles que l'entreprise a saisies, puis celles vues dans ses données.
  const vus = new Map();
  const ajouter = (nom) => {
    const t = texte(nom);
    if (t && !vus.has(t.toLowerCase())) vus.set(t.toLowerCase(), t);
  };
  const branches = company?.organization_structure?.branches;
  for (const b of Array.isArray(branches) ? branches : []) ajouter(typeof b === "string" ? b : b?.name);
  const saisies = vus.size;
  for (const o of orders || []) ajouter(o?.store || o?.succursale);
  for (const e of employees || []) ajouter(e?.branch);

  return {
    aDesImports: (imports || []).length > 0,
    types: [...parEntite.values()].sort((a, b) => b.lignes - a.lignes),
    succursales: [...vus.values()],
    succursalesSource: { saisies, vues: vus.size - saisies },
    lignesLues,
    lignesImportees,
    tauxImport: lignesLues > 0 ? Math.round((lignesImportees / lignesLues) * 1000) / 10 : null,
    colonnesNonReconnues: [...inconnues],
  };
}
