import test from "node:test";
import assert from "node:assert/strict";
import { montantHT } from "../src/lib/core/kpiRecords.js";
import { computeKpiBatch } from "../src/lib/core/kpiEngine.js";
import { buildKpiDataset } from "../src/lib/core/kpiDataset.js";
import { productMarginPct } from "../src/lib/metrics.js";
import { aggregateLatestInventory } from "../src/lib/stockAlerts.js";
import { calculerSuccursales } from "../src/lib/succursales.js";

const kpi = (data, ids) => {
  const { records, semantics } = buildKpiDataset(data);
  const res = computeKpiBatch(ids, records, semantics);
  return Object.fromEntries(ids.map((id) => [id, res.get(id)?.value ?? null]));
};

// =========================================================================
// CAUSE 1 — Chiffre d'affaires après remises (HT net)
// =========================================================================
test("Cause 1 : montantHT prend le revenu net total_revenue avant le sous-total brut", () => {
  // 1. Commande avec total_revenue net (Sous-total 1000 - Remise 50 = 950)
  const cmdComplete = {
    subtotal: 1000,
    discount: 50,
    total_revenue: 950,
    tax: 142.26,
    total: 1092.26,
  };
  assert.equal(montantHT(cmdComplete), 950, "Doit retenir 950 $ (Revenu total net HT) et non 1000 $");

  // 2. Commande sans total_revenue mais avec subtotal et discount
  const cmdSansTR = {
    subtotal: 1000,
    discount: 50,
    tax: 142.26,
    total: 1092.26,
  };
  assert.equal(montantHT(cmdSansTR), 950, "Doit déduire la remise de 50 $ du sous-total brut de 1000 $");

  // 3. Commande où subtotal est déjà net (subtotal + tax === total)
  const cmdDejaNet = {
    subtotal: 950,
    discount: 50,
    tax: 142.26,
    total: 1092.26,
  };
  assert.equal(montantHT(cmdDejaNet), 950, "Ne doit pas déduire la remise une 2e fois si subtotal est déjà net");
});

// =========================================================================
// CAUSE 2 — Les dépenses bancaires ne sont JAMAIS ajoutées au chiffre d'affaires
// =========================================================================
test("Cause 2 : total_revenue n'ajoute pas les transactions de dépenses en l'absence de recettes", () => {
  // Mois de juillet : 10 000 $ de commandes et 20 644,74 $ de dépenses bancaires (loyer, pub, électricité)
  const dataset = {
    orders: [
      { order_id: "O-JUL-1", date: "2026-07-15", total_revenue: 10000, status: "completed" },
    ],
    transactions: [
      { id: "T1", date: "2026-07-01", description: "Loyer commercial", amount: 10000, type: "expense" },
      { id: "T2", date: "2026-07-05", description: "Publicité Meta", amount: 5000, type: "expense" },
      { id: "T3", date: "2026-07-10", description: "Électricité Hydro-Québec", amount: 5644.74, type: "expense" },
    ],
  };

  const res = kpi(dataset, ["total_revenue", "total_expense"]);
  // Le chiffre d'affaires doit être de 10 000 $ et NON 30 644,74 $
  assert.equal(res.total_revenue, 10000, "Le CA total ne doit jamais additionner les dépenses bancaires");
  assert.equal(Math.round(res.total_expense * 100) / 100, 20644.74, "Les dépenses doivent être de 20 644,74 $");
});

// =========================================================================
// CAUSE 3 — Dédoublonnage paie : la paie n'est pas comptée deux fois
// =========================================================================
test("Cause 3 : La transaction de virement de salaires n'est pas comptée en double avec l'onglet Paie", () => {
  const dataset = {
    orders: [
      { order_id: "O1", date: "2026-06-15", total_revenue: 100000, cost: 20000, status: "completed" },
    ],
    payrolls: [
      { payroll_id: "PAY-1", period: "2026-06-30", total_cost: 30000 },
      { payroll_id: "PAY-2", period: "2026-06-30", total_cost: 28159.66 },
    ], // Somme paie = 58 159,66 $
    transactions: [
      { id: "T-PAIE", date: "2026-06-30", description: "Virement Paie & Salaires juin 2026", amount: 58159.66, type: "expense" },
      { id: "T-DIV", date: "2026-06-15", description: "Frais bancaires", amount: 150, type: "expense" },
    ],
  };

  const res = kpi(dataset, ["payroll_total", "total_expense", "total_charges"]);
  assert.equal(res.payroll_total, 58159.66, "Masse salariale mesurée");
  // total_expense ne doit compter que les frais bancaires (150 $) et PAS le virement de paie déjà couvert par Payroll
  assert.equal(res.total_expense, 150, "Le virement de salaires est dédoublonné des dépenses");
  // Total charges = cogs (20 000) + depenses (150) + paie (58 159.66) = 78 309.66 $
  assert.equal(Math.round(res.total_charges * 100) / 100, 78309.66, "Charges totales sans double comptage");
});

// =========================================================================
// CAUSE 4 — Marge produit en $ normalisée en taux de marge (%)
// =========================================================================
test("Cause 4 : productMarginPct convertit un profit brut en dollars en pourcentage de marge", () => {
  // Portable Pro Titan : prix 2299.99 $, coût 1450.00 $, gross_margin saisie à 849.99 $
  const titan = {
    product_name: "Portable Pro Titan",
    selling_price: 2299.99,
    purchase_cost: 1450.00,
    gross_margin: 849.99,
  };
  const marginPct = productMarginPct(titan);
  // (849.99 / 2299.99) * 100 = 36.956 % ≈ 37.0 %
  assert.equal(Math.round(marginPct * 10) / 10, 37.0, "La marge doit être de 37.0 % et non 850 %");
});

// =========================================================================
// CAUSE 5 — Stock multi-entrepôts : somme de l'inventaire par produit
// =========================================================================
test("Cause 5 : aggregateLatestInventory cumule les stocks de tous les entrepôts par SKU", () => {
  const inventory = [
    { product_id: "USB-C", warehouse_id: "QC", closing_stock: 36, inventory_value: 216, date: "2026-08-31" },
    { product_id: "USB-C", warehouse_id: "MTL", closing_stock: 40, inventory_value: 240, date: "2026-08-31" },
    { product_id: "USB-C", warehouse_id: "LAV", closing_stock: 23, inventory_value: 138, date: "2026-08-31" },
  ];

  const aggregated = aggregateLatestInventory(inventory);
  assert.equal(aggregated.length, 1, "Un seul SKU consolidé");
  assert.equal(aggregated[0].closing_stock, 99, "Le stock consolidé de USB-C doit être 36 + 40 + 23 = 99 unités");
  assert.equal(aggregated[0].inventory_value, 594, "La valeur consolidée doit être 216 + 240 + 138 = 594 $");
});

// =========================================================================
// CAUSE 6 — Retards fournisseurs reconnus via delay_days
// =========================================================================
test("Cause 6 : Commande d'achat avec delay_days > 0 est identifiée en retard", () => {
  const isLate = (p) => p.status === "retard" || Number(p.delay_days) > 0 || Number(p.jours_retard) > 0;

  const purchases = [
    { purchase_id: "PO-1", status: "recu", delay_days: 3 },
    { purchase_id: "PO-2", status: "en_cours", delay_days: 0 },
    { purchase_id: "PO-3", status: "retard", delay_days: 0 },
    { purchase_id: "PO-4", status: "recu", jours_retard: 2 },
  ];

  const lateCount = purchases.filter(isLate).length;
  assert.equal(lateCount, 3, "3 commandes doivent être comptées en retard");
});

// =========================================================================
// CAUSE 7 — Réconciliation des succursales et proratisation temporelle
// =========================================================================
test("Cause 7 : Réconciliation SUCC-01 / Montréal et proratisation des charges annuelles sur 6 mois", () => {
  // Commandes sur 6 mois (mars à août 2026) avec location_id "SUCC-01"
  const orders = [
    { order_id: "O1", date: "2026-03-10", total_revenue: 20000, cost: 10000, location_id: "SUCC-01" },
    { order_id: "O2", date: "2026-04-10", total_revenue: 20000, cost: 10000, location_id: "SUCC-01" },
    { order_id: "O3", date: "2026-05-10", total_revenue: 20000, cost: 10000, location_id: "SUCC-01" },
    { order_id: "O4", date: "2026-06-10", total_revenue: 20000, cost: 10000, location_id: "SUCC-01" },
    { order_id: "O5", date: "2026-07-10", total_revenue: 20000, cost: 10000, location_id: "SUCC-01" },
    { order_id: "O6", date: "2026-08-10", total_revenue: 20000, cost: 10000, location_id: "SUCC-01" },
  ];

  // Employé avec branch "Montréal - Centre-Ville", salaire annuel 120 000 $
  const employees = [
    { employee_id: "E1", branch: "Montréal - Centre-Ville", total_employer_cost: 120000 },
  ];

  const res = calculerSuccursales({ orders, employees });
  assert.equal(res.nbSuccursales, 1, "Doit regrouper sous une seule succursale Montréal");
  const mtl = res.locations[0];
  assert.equal(mtl.revenue, 120000, "CA sur 6 mois = 120 000 $");
  assert.equal(mtl.cogs, 60000, "Coût des ventes sur 6 mois = 60 000 $");
  // Salaire annuel de 120 000 $ proratisé sur 6 mois = 60 000 $
  assert.equal(mtl.employerCost, 60000, "Le coût employeur annuel de 120 000 $ doit être proratisé à 60 000 $ sur 6 mois");
  // EBITDA = 120 000 - 60 000 (cogs) - 60 000 (salaire proratisé) = 0
  assert.equal(mtl.ebitda, 0, "EBITDA équilibré");
});
