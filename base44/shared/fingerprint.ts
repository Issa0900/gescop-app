export function generateFingerprint(entityName: string, row: any): string {
  if (!row || typeof row !== "object") return "";

  // 1. Clés d'affaires spécifiques par entité
  if (entityName === "Order" && row.order_id) {
    return `Order:${String(row.order_id).trim()}:${String(row.product_id || "").trim()}`;
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

/** Empreinte courte et stable (FNV-1a 32 bits). */
function empreinteCourte(texte: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < texte.length; i++) {
    h ^= texte.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(36);
}
