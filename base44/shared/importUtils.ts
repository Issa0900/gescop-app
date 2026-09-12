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
  "first name": "first_name", "last name": "last_name",
  "courriel": "email", "ville": "city", "region": "region",
  "pays": "country", "telephone": "phone",
  "total_commandes": "total_orders", "nombre_commandes": "total_orders",
  "ca_total": "total_revenue", "chiffre_affaires": "total_revenue", "ca total": "total_revenue",
  "total_spent": "total_revenue", "total spent": "total_revenue", "montant_total": "total_revenue",
  "depense_totale": "total_revenue", "revenu_total": "total_revenue",
  "panier_moyen": "average_order_value", "valeur_panier": "average_order_value",
  "valeur_vie": "lifetime_value", "ltv": "lifetime_value", "valeur vie client": "lifetime_value",
  "risque_churn": "churn_risk", "risque de churn": "churn_risk",
  "type_client": "customer_type", "type de client": "customer_type",
  "premiere_commande": "first_purchase_date", "premiere achat": "first_purchase_date",
  "derniere_commande": "last_purchase_date", "dernier achat": "last_purchase_date",
  "date_acquisition": "acquisition_date", "date d acquisition": "acquisition_date",
  "id_client": "customer_id", "id produit": "product_id",
  "id_fournisseur": "supplier_id", "id_employe": "employee_id",
  "id_campagne": "campaign_id", "nom_campagne": "campaign_name",
  "id_concurrent": "competitor_id",
  "cout_unitaire": "unit_cost", "cout_total": "total_cost",
  "prix_unitaire": "unit_price", "quantite_vendue": "quantity",
  "marge_brute": "gross_margin", "taux_clic": "ctr",
  "taux_conversion": "conversion_rate", "cout_par_clic": "cpc",
  "nombre_impressions": "impressions", "nombre_clics": "clicks",
  "nombre_conversions": "conversions", "portee": "reach",
  "stock_ouverture": "opening_stock", "stock_cloture": "closing_stock",
  "stock_final": "closing_stock", "stock_initial": "opening_stock",
  "valeur_stock": "inventory_value", "jours_inventaire": "days_in_inventory",
  "etat_stock": "stock_status", "statut_stock": "stock_status",
  "delai_livraison": "average_delivery_days", "delai_moyen": "average_delivery_days",
  "qualite_score": "quality_score", "fiabilite_score": "reliability_score",
  "variation_prix": "price_change_last_12_months",
  "volume_achat": "purchase_volume", "volume_ventes": "monthly_sales",
  "position_prix": "price_position", "position_marche": "market_position",
  "chiffre_affaire_estime": "estimated_revenue", "nombre_employes": "employee_count",
  "note_moyenne": "average_rating",
};

export function normalizeKeys(row: Record<string, any>, properties?: Record<string, any> | null): Record<string, any> {
  const out: Record<string, any> = {};
  const schemaFields = properties ? Object.keys(properties) : [];
  for (const [k, v] of Object.entries(row || {})) {
    const lower = k.toLowerCase().trim();
    const alias = FIELD_ALIASES[lower] || FIELD_ALIASES[lower.replace(/[\s-]/g, "_")] || lower;
    // If alias is not a schema field, try fuzzy match against schema field names
    if (schemaFields.length > 0 && !schemaFields.includes(alias)) {
      const noAccents = stripAccents(lower).replace(/[\s-]/g, "_");
      const fuzzyMatch = schemaFields.find((f) => stripAccents(f.toLowerCase()) === noAccents);
      if (fuzzyMatch) {
        out[fuzzyMatch] = v;
        continue;
      }
    }
    out[alias] = v;
  }
  return out;
}

// English → French enum translations (context-aware: checked against target enum)
const ENUM_TRANSLATIONS: Record<string, string[]> = {
  "paid": ["paye"], "pending": ["en_attente", "en_cours"], "failed": ["echoue"], "refunded": ["rembourse"],
  "shipped": ["expedie"], "processing": ["en_preparation"], "completed": ["livre", "terminee"], "cancelled": ["annule"], "returned": ["retourne"],
  "none": ["aucun"], "requested": ["demande"], "approved": ["approuve"], "rejected": ["refuse"],
  "web": ["shopify"],
  "google ads": ["google_ads"], "meta ads": ["meta_ads"],
  "paused": ["pause"], "planned": ["planifiee"], "active": ["active"],
  "dormant": ["dormant"],
  // French capitalized/common variants → canonical enum values
  "alerte": ["proche_rupture", "faible"], "normal": ["optimal"],
  "bas": ["inferieur"], "moyen": ["egal"], "eleve": ["superieur"],
  "haute": ["elevee", "urgente"], "critique": ["urgente"], "basse": ["faible"],
  "en retard": ["non_atteint"], "en attente": ["en_attente", "en_cours"],
  "avis": ["avis", "question"], "reclamation": ["reclamation", "plainte"], "rh": ["administration", "service_client"],
  "recu": ["recu"], "en cours": ["en_cours"],
};

// Coerce a value to match an enum (case-insensitive, accents, spaces/hyphens, English→French)
export function coerceEnum(value: any, enumOptions: string[]): any {
  if (!value || !enumOptions) return value;
  const raw = String(value).toLowerCase().trim();
  const normalized = raw.replace(/[\s-]/g, "_");
  const rawNoAccents = stripAccents(raw);
  const normNoAccents = stripAccents(normalized);
  if (enumOptions.includes(raw)) return raw;
  if (enumOptions.includes(normalized)) return normalized;
  // Try English→French translation (also check accent-stripped keys)
  const translations = ENUM_TRANSLATIONS[raw] || ENUM_TRANSLATIONS[normalized] || ENUM_TRANSLATIONS[rawNoAccents] || ENUM_TRANSLATIONS[normNoAccents];
  if (translations) {
    const match = translations.find((t) => enumOptions.includes(t));
    if (match) return match;
  }
  const match = enumOptions.find((e) => {
    const eLow = e.toLowerCase();
    const eNoAcc = stripAccents(eLow);
    return eLow === raw || eLow === normalized || eNoAcc === rawNoAccents || eNoAcc === normNoAccents;
  });
  if (match) return match;
  // Labels carry qualifiers the enum doesn't have ("Boutique VIP", "Web Premium",
  // "Google Ads - Retargeting"). Match on the words instead of losing the field.
  const words = rawNoAccents.split(/[^a-z0-9]+/).filter(Boolean);
  for (const w of words) {
    const direct = enumOptions.find((e) => stripAccents(e.toLowerCase()) === w);
    if (direct) return direct;
    const viaTranslation = (ENUM_TRANSLATIONS[w] || []).find((t) => enumOptions.includes(t));
    if (viaTranslation) return viaTranslation;
  }
  return value;
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

const MONTHS_FR: Record<string, string> = {
  janv: "01", jan: "01", fevr: "02", fev: "02", feb: "02", mars: "03", mar: "03",
  avr: "04", apr: "04", mai: "05", may: "05", juin: "06", jun: "06",
  juil: "07", jul: "07", aout: "08", aug: "08", sept: "09", sep: "09",
  oct: "10", nov: "11", dec: "12",
};

/**
 * Parse a number written in any of the formats spreadsheets produce:
 * "1 234,56" (FR), "1,234.56" (EN), "1.234,56", "12 %", "1 500,00 $", "(500)".
 * A wrong separator guess silently divides or multiplies a metric by 1000,
 * so the decimal separator is decided by the LAST separator present.
 */
export function parseNumber(value: any): number | null {
  if (typeof value === "number") return isNaN(value) ? null : value;
  if (value === null || value === undefined) return null;
  let s = String(value).trim();
  if (s === "" || s === "-" || /^(n\/?a|nd|null)$/i.test(s)) return null;
  const negative = /^\(.*\)$/.test(s) || s.startsWith("-");
  s = s.replace(/[()\-+]/g, "");
  // Strip currency, percent signs and every kind of space (incl. non-breaking).
  s = s.replace(/[$€£%]|[a-zA-Z]|\s|\u00A0|\u202F/g, "");
  const lastComma = s.lastIndexOf(",");
  const lastDot = s.lastIndexOf(".");
  if (lastComma >= 0 && lastDot >= 0) {
    // Both present: the rightmost one is the decimal separator.
    s = lastComma > lastDot ? s.replace(/\./g, "").replace(",", ".") : s.replace(/,/g, "");
  } else if (lastComma >= 0) {
    const decimals = s.length - lastComma - 1;
    const single = s.indexOf(",") === lastComma;
    // "1,234" is a thousands group; "1,5" / "1,56" is a decimal.
    s = single && decimals === 3 ? s.replace(",", "") : s.replace(/,/g, ".");
  } else if (lastDot >= 0) {
    const decimals = s.length - lastDot - 1;
    const single = s.indexOf(".") === lastDot;
    if (!single || (decimals === 3 && s.replace(/\./g, "").length > 3 && !single)) s = s.replace(/\./g, "");
  }
  const n = Number(s);
  if (isNaN(n)) return null;
  return negative ? -n : n;
}

/**
 * Parse a date to YYYY-MM-DD from ISO, DD/MM/YYYY, DD-MM-YY, "15 janv. 2025",
 * or an Excel serial number (days since 1899-12-30) — serials arrive as plain
 * numbers and would otherwise be stored as unusable text.
 */
export function parseDate(value: any): string | null {
  if (value === null || value === undefined || value === "") return null;
  if (value instanceof Date && !isNaN(value.getTime())) return value.toISOString().slice(0, 10);
  if (typeof value === "number" || /^\d{5}(\.\d+)?$/.test(String(value).trim())) {
    const serial = Number(value);
    if (serial > 20000 && serial < 60000) {
      const ms = Math.round((serial - 25569) * 86400 * 1000);
      return new Date(ms).toISOString().slice(0, 10);
    }
  }
  let s = String(value).trim();
  if (s.includes("T")) s = s.slice(0, 10);
  // YYYY-MM-DD / YYYY/MM/DD
  let m = s.match(/^(\d{4})[\/\-.](\d{1,2})[\/\-.](\d{1,2})$/);
  if (m) return `${m[1]}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}`;
  // DD/MM/YYYY, DD-MM-YY
  m = s.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2}|\d{4})$/);
  if (m) {
    let year = m[3].length === 2 ? `20${m[3]}` : m[3];
    let day = m[1];
    let month = m[2];
    // Unambiguous US order (13/12/2025 impossible as month).
    if (Number(month) > 12 && Number(day) <= 12) [day, month] = [month, day];
    return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
  }
  // "15 janv. 2025" / "15 janvier 2025"
  m = stripAccents(s.toLowerCase()).match(/^(\d{1,2})\s+([a-z]+)\.?\s+(\d{4})$/);
  if (m) {
    const mm = MONTHS_FR[m[2].slice(0, 4)] || MONTHS_FR[m[2].slice(0, 3)];
    if (mm) return `${m[3]}-${mm}-${m[1].padStart(2, "0")}`;
  }
  // YYYY-MM (period) → first day of month
  m = s.match(/^(\d{4})[\/\-](\d{1,2})$/);
  if (m) return `${m[1]}-${m[2].padStart(2, "0")}-01`;
  return null;
}

// Coerce a value to the schema property type (date, number, boolean)
export function coerceType(value: any, prop: any): any {
  if (value === null || value === undefined || value === "") return value;
  if (!prop || !prop.type) return value;
  switch (prop.type) {
    case "string":
      if (prop.format === "date" || prop.format === "date-time") {
        return parseDate(value) || String(value).slice(0, 10);
      }
      return String(value);
    case "number": {
      const n = parseNumber(value);
      return n === null ? value : n;
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
  const r = normalizeKeys(row, properties);

  // A single "name"/"nom" column on an entity that stores first + last name would
  // otherwise be dropped entirely, leaving nameless records.
  if (properties?.first_name && r.name && !r.first_name) {
    const parts = String(r.name).trim().split(/\s+/);
    r.first_name = parts[0];
    if (parts.length > 1) r.last_name = parts.slice(1).join(" ");
    delete r.name;
  }

  if (entityName === "Transaction") {
    const amount = parseNumber(r.amount) || 0;
    let type = (r.type || "").toLowerCase().trim();
    if (!type) type = amount >= 0 ? "income" : "expense";
    const typeNorm = stripAccents(type);
    if (["revenu", "revenue", "credit", "entree", "income"].includes(typeNorm)) type = "income";
    if (["depense", "expense", "debit", "sortie"].includes(typeNorm)) type = "expense";
    if (["remboursement", "refund", "transfer", "transfert"].includes(typeNorm)) type = "expense";
    return {
      date: parseDate(r.date) || new Date().toISOString().slice(0, 10),
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