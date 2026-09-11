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

// Coerce a value to the schema property type (date, number, boolean)
export function coerceType(value: any, prop: any): any {
  if (value === null || value === undefined || value === "") return value;
  if (!prop || !prop.type) return value;
  switch (prop.type) {
    case "string":
      if (prop.format === "date" && typeof value === "string") {
        // Handle ISO datetime, DD/MM/YYYY, DD-MM-YYYY → YYYY-MM-DD
        let s = value.trim();
        if (s.includes("T")) s = s.slice(0, 10);
        // DD/MM/YYYY or DD-MM-YYYY
        const m = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
        if (m) return `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
        // YYYY/MM/DD or YYYY-MM-DD already
        if (/^\d{4}[\/\-]\d{1,2}[\/\-]\d{1,2}$/.test(s)) {
          const parts = s.split(/[\/\-]/);
          return `${parts[0]}-${parts[1].padStart(2, "0")}-${parts[2].padStart(2, "0")}`;
        }
        return s.slice(0, 10);
      }
      return String(value);
    case "number": {
      if (typeof value === "number") return value;
      const n = Number(String(value).replace(/[,$\s]/g, ""));
      return isNaN(n) ? value : n;
    }
    case "boolean": {
      if (typeof value === "boolean") return value;
      const s = String(value).toLowerCase().trim();
      if (["true", "oui", "1", "yes", "vrai", "y"].includes(s)) return true;
      if (["false", "non", "0", "no", "faux", "n"].includes(s)) return false;
      return value;
    }
    default:
      return value;
  }
}

// Normalize a single row for a given entity
export function normalizeRow(
  entityName: string,
  row: Record<string, any>,
  importId: string,
  properties: Record<string, any> | null,
  sourceType?: string
): Record<string, any> {
  const r = normalizeKeys(row);

  if (entityName === "Transaction") {
    const amount = Number(r.amount) || 0;
    let type = (r.type || "").toLowerCase().trim();
    if (!type) type = amount >= 0 ? "income" : "expense";
    const typeNorm = stripAccents(type);
    if (["revenu", "revenue", "credit", "entree", "income"].includes(typeNorm)) type = "income";
    if (["depense", "expense", "debit", "sortie"].includes(typeNorm)) type = "expense";
    if (["remboursement", "refund", "transfer", "transfert"].includes(typeNorm)) type = "expense";
    return {
      date: (r.date || "").slice(0, 10) || new Date().toISOString().slice(0, 10),
      description: r.description || "",
      amount: Math.abs(amount),
      type,
      category: r.category || "",
      source: sourceType || "csv",
      currency: "CAD",
      client: r.client || r.customer_id || "",
      product: r.product || r.product_id || "",
      import_id: importId,
    };
  }

  // For other entities: normalize enums, coerce types, keep only schema fields, strip empty values
  const withEnums = normalizeEnums(r, properties || {});
  const cleaned: Record<string, any> = {};
  for (const [k, v] of Object.entries(withEnums)) {
    if (BUILTIN_FIELDS.includes(k)) continue;
    if (v === null || v === undefined || v === "") continue;
    const prop = properties?.[k];
    if (prop) {
      // Field is in schema: validate enum, coerce type
      if (prop.enum) {
        const coerced = coerceEnum(v, prop.enum);
        if (!prop.enum.includes(coerced)) continue; // skip invalid enum value instead of failing
        cleaned[k] = coerceType(coerced, prop);
      } else {
        cleaned[k] = coerceType(v, prop);
      }
    } else if (!properties) {
      // No schema available: keep value as-is
      cleaned[k] = v;
    }
    // else: field not in schema, skip
  }
  if (importId) cleaned["import_id"] = importId;
  return cleaned;
}