// Entity detection for imported sheets/files.
// Two independent strategies, because a sheet name alone misses a lot:
//   1. the sheet/file name,
//   2. the column headers (a signature of required fields).
// Also recovers the header row when a sheet starts with a title line, which
// otherwise yields __EMPTY columns and zero usable rows.

import * as XLSX from "npm:xlsx@0.18.5";
import { stripAccents } from "./importUtils.ts";

const NAME_ENTITY_MAP = [
  { pattern: /campaign.*(daily|jour)|marketing.*(daily|jour)|(daily|jour).*campaign|campagne.*(jour|quotidien)/i, entity: "CampaignDaily" },
  { pattern: /interaction|service.?client|support|ticket/i, entity: "Interaction" },
  { pattern: /transaction|ecriture|grand.?livre|releve|bancaire/i, entity: "Transaction" },
  { pattern: /inventaire|inventory|stock/i, entity: "Inventory" },
  { pattern: /order|commande|vente|sale/i, entity: "Order" },
  { pattern: /customer|client|acheteur/i, entity: "Customer" },
  { pattern: /product|produit|article|catalogue|sku/i, entity: "Product" },
  { pattern: /supplier|fournisseur|vendor/i, entity: "Supplier" },
  { pattern: /purchase|achat|approvisionnement/i, entity: "Purchase" },
  { pattern: /campaign|campagne|publicite|ads|marketing/i, entity: "Campaign" },
  { pattern: /employee|employe|personnel|effectif|staff|rh/i, entity: "Employee" },
  { pattern: /payroll|paie|paye|salaire|remuneration/i, entity: "Payroll" },
  { pattern: /expense|depense|charge|frais|cout/i, entity: "Expense" },
  { pattern: /cashflow|cash.?flow|tresorerie|caisse|liquidite|flux/i, entity: "Cashflow" },
  { pattern: /competitor|concurrent|concurrence/i, entity: "Competitor" },
  { pattern: /signal|radar|veille|actualite/i, entity: "ExternalSignal" },
  { pattern: /goal|objectif|cible|target/i, entity: "Goal" },
  { pattern: /event|evenement|journal/i, entity: "Event" },
];

export function detectEntityByName(name: string): string | null {
  const lower = stripAccents((name || "").toLowerCase());
  for (const m of NAME_ENTITY_MAP) {
    if (m.pattern.test(lower)) return m.entity;
  }
  return null;
}

// Header signatures: every "must" column has to be present. Ordered from the
// most specific signature to the least, so CampaignDaily wins over Campaign.
const HEADER_SIGNATURES: { entity: string; must: string[] }[] = [
  { entity: "CampaignDaily", must: ["campaign_id", "date"] },
  { entity: "Campaign", must: ["campaign_id"] },
  { entity: "Inventory", must: ["product_id", "closing_stock"] },
  { entity: "Inventory", must: ["product_id", "opening_stock"] },
  { entity: "Purchase", must: ["supplier_id", "product_id"] },
  { entity: "Order", must: ["order_id"] },
  { entity: "Customer", must: ["customer_id"] },
  { entity: "Product", must: ["product_id"] },
  { entity: "Supplier", must: ["supplier_id"] },
  { entity: "Payroll", must: ["employee_id", "period"] },
  { entity: "Employee", must: ["employee_id"] },
  { entity: "Cashflow", must: ["closing_cash"] },
  { entity: "Cashflow", must: ["cash_in", "cash_out"] },
  { entity: "Expense", must: ["expense_id"] },
  { entity: "Interaction", must: ["interaction_id"] },
  { entity: "Competitor", must: ["competitor_id"] },
  { entity: "Goal", must: ["goal_id"] },
  { entity: "Event", must: ["event_id"] },
  { entity: "Transaction", must: ["date", "amount", "type"] },
];

const HEADER_ALIASES: Record<string, string> = {
  "id_commande": "order_id", "commande_id": "order_id", "no_commande": "order_id",
  "id_client": "customer_id", "client_id": "customer_id",
  "id_produit": "product_id", "produit_id": "product_id",
  "id_fournisseur": "supplier_id", "fournisseur_id": "supplier_id",
  "id_employe": "employee_id", "employe_id": "employee_id",
  "id_campagne": "campaign_id", "campagne_id": "campaign_id",
  "id_depense": "expense_id", "depense_id": "expense_id",
  "montant": "amount", "date_operation": "date", "periode": "period",
  "stock_cloture": "closing_stock", "stock_final": "closing_stock",
  "stock_ouverture": "opening_stock", "stock_initial": "opening_stock",
  "solde_cloture": "closing_cash", "solde_final": "closing_cash",
  "encaissements": "cash_in", "decaissements": "cash_out",
  "entrees": "cash_in", "sorties": "cash_out",
};

function normalizeHeader(h: string): string {
  const base = stripAccents(String(h || "").toLowerCase().trim()).replace(/[\s\-.]+/g, "_");
  return HEADER_ALIASES[base] || base;
}

export function detectEntityByHeaders(headers: string[]): string | null {
  const set = new Set((headers || []).map(normalizeHeader));
  for (const sig of HEADER_SIGNATURES) {
    if (sig.must.every((m) => set.has(m))) return sig.entity;
  }
  return null;
}

/**
 * Rows of a sheet, with header-row recovery.
 * A sheet whose first line is a title produces __EMPTY_1, __EMPTY_2… headers;
 * in that case we scan the first rows for the real header line.
 */
export function sheetRows(sheet: any): { rows: Record<string, any>[]; headers: string[] } {
  const matrix = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "", blankrows: false }) as any[][];
  if (matrix.length === 0) return { rows: [], headers: [] };

  // The header row is the first row where most cells are non-empty text.
  let headerIdx = 0;
  let bestScore = -1;
  for (let i = 0; i < Math.min(matrix.length, 10); i += 1) {
    const row = matrix[i] || [];
    const filled = row.filter((c) => String(c ?? "").trim() !== "").length;
    const texty = row.filter((c) => typeof c === "string" && String(c).trim() !== "").length;
    const score = filled >= 2 ? texty + filled : -1;
    if (score > bestScore) { bestScore = score; headerIdx = i; }
  }

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