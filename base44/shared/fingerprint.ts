/**
 * L'empreinte repose-t-elle sur un identifiant metier fourni par le fichier ?
 * Seule une telle empreinte PROUVE qu'une repetition est un doublon (meme
 * commande, meme client, meme SKU). Un identifiant technique derive du contenu
 * (« AUTO-… ») n'en est pas un : deux lignes identiques recoivent le meme, sans
 * que cela prouve quoi que ce soit.
 */
export function empreinteForte(entityName: string, row: any): boolean {
  if (!row || typeof row !== "object") return false;
  const reel = (v: any) => v !== undefined && v !== null && String(v).trim() !== "" && !/^AUTO-/.test(String(v));
  switch (entityName) {
    // Une ligne d'article SANS identifiant de ligne (facture + produit) n'est
    // pas identifiee : le meme article peut figurer deux fois sur une facture
    // (UCI Online Retail : 5 199 couples facture + produit a plusieurs lignes).
    // Seul le numero de commande d'un fichier au grain COMMANDE (pas de colonne
    // produit) prouve un doublon.
    case "Order": return reel(row.line_id) || (reel(row.order_id) && !reel(row.product_id));
    case "Customer": return reel(row.customer_id) || reel(row.email);
    case "Product": return reel(row.product_id) || reel(row.sku);
    case "Campaign": return reel(row.campaign_id);
    case "CampaignDaily": return reel(row.campaign_id) && reel(row.date);
    case "Employee": return reel(row.employee_id);
    // L'identifiant de la fiche de paie (payroll_id) prime ; a defaut,
    // employe + periode (cle composee, a confirmer par le fichier : voir
    // cleComposee et deduplication.ts).
    case "Payroll": return reel(row.payroll_id) || (reel(row.employee_id) && reel(row.period));
    case "Supplier": return reel(row.supplier_id);
    // Regle metier : une seule ligne de tresorerie par date.
    case "Cashflow": return reel(row.date);
    case "Expense": return reel(row.expense_id);
    default: return false;
  }
}

/**
 * L'empreinte forte repose-t-elle sur une cle COMPOSEE (plusieurs colonnes qui
 * ne sont pas un identifiant de ligne) ? Une telle cle n'identifie une ligne
 * que si le fichier ne la contredit pas : si la meme combinaison y porte des
 * contenus differents, ce n'est pas une cle (deduplication.ts), comme pour
 * les lignes de commande sans identifiant de ligne.
 */
export function cleComposee(entityName: string, row: any): boolean {
  if (!row || typeof row !== "object") return false;
  const reel = (v: any) => v !== undefined && v !== null && String(v).trim() !== "" && !/^AUTO-/.test(String(v));
  switch (entityName) {
    case "Payroll": return !reel(row.payroll_id) && reel(row.employee_id) && reel(row.period);
    case "CampaignDaily": return reel(row.campaign_id) && reel(row.date);
    default: return false;
  }
}

export function generateFingerprint(entityName: string, row: any): string {
  if (!row || typeof row !== "object") return "";

  // 1. Clés d'affaires spécifiques par entité
  // Identifiant de LIGNE fourni par le fichier (Transaction_ID, ID_Ligne,
  // Row ID) : c'est lui qui distingue deux articles d'une meme commande. Sans
  // lui, deux lignes d'une commande pour le meme produit (quantites ou dates
  // differentes) partageaient l'empreinte commande + produit, et la seconde
  // disparaissait comme « doublon » (Sales_transactions : 163 lignes).
  if (entityName === "Order" && row.line_id !== undefined && row.line_id !== null && String(row.line_id).trim() !== "") {
    return `Order:ligne:${String(row.line_id).trim()}`;
  }
  // Ligne d'article sans identifiant de ligne : commande + produit + contenu
  // (ligne brute si disponible). Deux lignes differentes d'une meme facture ne
  // se confondent plus ; la meme ligne reimportee retrouve la meme empreinte.
  if (entityName === "Order" && row.order_id && row.product_id) {
    return `Order:${String(row.order_id).trim()}:${String(row.product_id).trim()}~${empreinteCourte(contenuLigne(row))}`;
  }
  if (entityName === "Order" && row.order_id) {
    return `Order:${String(row.order_id).trim()}:`;
  }
  if (entityName === "Customer" && (row.customer_id || row.email)) {
    return `Customer:${String(row.customer_id || row.email).trim().toLowerCase()}`;
  }
  if (entityName === "Product" && (row.product_id || row.sku)) {
    return `Product:${String(row.product_id || row.sku).trim()}`;
  }
  if (entityName === "Campaign" && row.campaign_id) {
    return `Campaign:${String(row.campaign_id).trim()}`;
  }
  if (entityName === "CampaignDaily" && row.campaign_id && row.date) {
    return `CampaignDaily:${String(row.campaign_id).trim()}:${String(row.date).slice(0, 10)}`;
  }
  if (entityName === "Employee" && row.employee_id) {
    return `Employee:${String(row.employee_id).trim()}`;
  }
  // Identifiant de LIGNE fourni par le fichier : il prime sur la cle composee.
  // Deux fiches du meme employe le meme mois (paie + prime, deux versements)
  // ont deux payroll_id : les confondre en « conflit » ecartait 16 fiches sur
  // 500 dans Xplorer_500.
  if (entityName === "Payroll" && row.payroll_id !== undefined && row.payroll_id !== null && String(row.payroll_id).trim() !== "" && !/^AUTO-/.test(String(row.payroll_id))) {
    return `Payroll:id:${String(row.payroll_id).trim()}`;
  }
  if (entityName === "Payroll" && row.employee_id && row.period) {
    return `Payroll:${String(row.employee_id).trim()}:${String(row.period).trim()}`;
  }
  if (entityName === "Supplier" && row.supplier_id) {
    return `Supplier:${String(row.supplier_id).trim()}`;
  }
  if (entityName === "Cashflow" && row.date) {
    return `Cashflow:${String(row.date).slice(0, 10)}`;
  }
  if (entityName === "Expense" && row.expense_id) {
    return `Expense:${String(row.expense_id).trim()}`;
  }
  if (entityName === "Transaction") {
    const d = String(row.date || "").slice(0, 10);
    const a = Number(row.amount) || 0;
    const t = String(row.type || "");
    const desc = String(row.description || "").trim().toLowerCase();
    if (d && a) return `Txn:${d}:${a}:${t}:${desc}`;
  }

  // 2. Empreinte canonique (exclut import_id, fingerprint, original_data).
  //    Sans cle metier, deux lignes ne sont un doublon que si elles sont
  //    identiques DANS LE FICHIER, colonnes non rattachees comprises : le meme
  //    SKU dans cinq entrepots donnait cinq lignes normalisees identiques (la
  //    colonne entrepot n'etant rattachee a rien), et quatre etaient jetees
  //    comme doublons. La ligne brute (original_data) entre donc dans
  //    l'empreinte, sous forme courte.
  const cleaned: Record<string, any> = {};
  for (const k of Object.keys(row).sort()) {
    if (["import_id", "fingerprint", "original_data", "id", "created_date", "updated_date"].includes(k)) continue;
    if (row[k] !== undefined && row[k] !== null && row[k] !== "") {
      cleaned[k] = row[k];
    }
  }
  const brut = typeof row.original_data === "string" && row.original_data ? `#${empreinteCourte(row.original_data)}` : "";
  return `${entityName}:${JSON.stringify(cleaned)}${brut}`;
}

const TECHNIQUES_LIGNE = new Set(["import_id", "fingerprint", "original_data", "id", "created_date", "updated_date", "created_by_id", "created_by", "import_date", "reference_date", "reference_date_type"]);
/** Contenu d'une ligne : sa ligne brute, sinon ses champs metier. */
function contenuLigne(row: any): string {
  if (typeof row.original_data === "string" && row.original_data) return row.original_data;
  const out: Record<string, any> = {};
  for (const k of Object.keys(row).sort()) {
    if (TECHNIQUES_LIGNE.has(k) || k.startsWith("_")) continue;
    const v = row[k];
    if (v === undefined || v === null || v === "") continue;
    out[k] = typeof v === "number" ? Math.round(v * 100) / 100 : String(v).trim();
  }
  return JSON.stringify(out);
}

/** Empreinte courte et stable (FNV-1a 32 bits). */
export function empreinteCourte(texte: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < texte.length; i++) {
    h ^= texte.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(36);
}
