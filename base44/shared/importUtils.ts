// Shared import normalization utilities — used by importData and importMultiData

// Strip accents/diacritics for comparison (é→e, à→a, etc.)
export function stripAccents(str: string): string {
  return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

// Map common French column names to schema field names
export const FIELD_ALIASES: Record<string, string> = {
  "categorie": "category", "catégorie": "category",
  "nom": "name", "nom du produit": "product_name", "nom_produit": "product_name",
  "prix": "price", "prix_vente": "selling_price", "prix de vente": "selling_price",
  "cout": "cost", "cout_achat": "purchase_cost", "coût": "cost", "coût_achat": "purchase_cost",
  "marge": "gross_margin",
  "quantite": "quantity", "quantité": "quantity",
  "date_achat": "date", "date_vente": "date", "date_commande": "date",
  "client_id": "customer_id", "produit_id": "product_id",
  "fournisseur_id": "supplier_id", "fournisseur_nom": "supplier_name",
  "employe_id": "employee_id", "employé_id": "employee_id",
  "montant": "amount", "sous_total": "subtotal",
  "statut": "status", "canal": "channel", "segment": "segment",
  "ventes_mensuelles": "monthly_sales", "ventes mensuelles": "monthly_sales",
  "niveau_stock": "inventory_level", "seuil_reappro": "reorder_point",
  "date_lancement": "launch_date", "date_embauche": "hire_date",
  "type_emploi": "employment_type", "taux_horaire": "hourly_rate",
  "heures_semaine": "weekly_hours", "departement": "department",
  "nom_famille": "last_name", "prenom": "first_name",
  "courriel": "email", "ville": "city", "region": "region",
  "pays": "country", "telephone": "phone",
};

export function normalizeKeys(row: Record<string, any>): Record<string, any> {
  const out: Record<string, any> = {};
  for (const [k, v] of Object.entries(row || {})) {
    const lower = k.toLowerCase().trim();
    const alias = FIELD_ALIASES[lower] || FIELD_ALIASES[lower.replace(/[\s-]/g, "_")] || lower;
    out[alias] = v;
  }
  return out;
}

// Coerce a value to match an enum (case-insensitive, accents, spaces/hyphens)
export function coerceEnum(value: any, enumOptions: string[]): any {
  if (!value || !enumOptions) return value;
  const raw = String(value).toLowerCase().trim();
  const normalized = raw.replace(/[\s-]/g, "_");
  const rawNoAccents = stripAccents(raw);
  const normNoAccents = stripAccents(normalized);
  if (enumOptions.includes(raw)) return raw;
  if (enumOptions.includes(normalized)) return normalized;
  const match = enumOptions.find((e) => {
    const eLow = e.toLowerCase();
    const eNoAcc = stripAccents(eLow);
    return eLow === raw || eLow === normalized || eNoAcc === rawNoAccents || eNoAcc === normNoAccents;
  });
  return match || value;
}

// Normalize enum fields based on the entity schema properties
export function normalizeEnums(row: Record<string, any>, properties: Record<string, any>): Record<string, any> {
  if (!properties) return row;
  const out = { ...row };
  for (const [field, prop] of Object.entries(properties)) {
    if (prop && prop.enum && out[field] != null) {
      out[field] = coerceEnum(out[field], prop.enum);
    }
  }
  return out;
}

const BUILTIN_FIELDS = ["id", "created_date", "updated_date", "created_by_id"];

// Normalize a single row for a given entity
export function normalizeRow(
  entityName: string,
  row: Record<string, any>,
  importId: string,
  properties: Record<string, any> | null
): Record<string, any> {
  const r = normalizeKeys(row);

  if (entityName === "Transaction") {
    const amount = Number(r.amount) || 0;
    let type = (r.type || "").toLowerCase().trim();
    if (!type) type = amount >= 0 ? "income" : "expense";
    const typeNorm = stripAccents(type);
    if (["revenu", "revenue", "credit", "entree", "income"].includes(typeNorm)) type = "income";
    if (["depense", "expense", "debit", "sortie"].includes(typeNorm)) type = "expense";
    if (["remboursement", "refund", "transfer", "transfert"].includes(typeNorm)) type = "refund";
    return {
      date: (r.date || "").slice(0, 10) || new Date().toISOString().slice(0, 10),
      description: r.description || "",
      amount: Math.abs(amount),
      type,
      category: r.category || "",
      source: "csv",
      currency: "CAD",
      client: r.client || r.customer_id || "",
      product: r.product || r.product_id || "",
      import_id: importId,
    };
  }

  // For other entities: normalize enums, keep only schema fields, strip empty values
  const withEnums = normalizeEnums(r, properties || {});
  const cleaned: Record<string, any> = {};
  for (const [k, v] of Object.entries(withEnums)) {
    if (!properties || !properties[k]) continue;
    if (BUILTIN_FIELDS.includes(k)) continue;
    if (v === null || v === undefined || v === "") continue;
    cleaned[k] = v;
  }
  return cleaned;
}