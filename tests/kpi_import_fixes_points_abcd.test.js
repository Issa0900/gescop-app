import test from "node:test";
import assert from "node:assert/strict";
import { productMarginPct } from "../src/lib/metrics.js";
import { computeDomainScores } from "../src/lib/domainScores.js";
import { computeStockAlerts, getStockAlertSettings } from "../src/lib/stockAlerts.js";
import { monthlyAggComplete, lastVal, prevVal, trendDir } from "../src/lib/periods.js";
import { moisLisible } from "../src/lib/graphiques.js";

// =========================================================================
// POINT A — Normalisation de la marge produit (ratios décimaux vs %)
// =========================================================================
test("Point A : productMarginPct normalise un ratio decimal en pourcentage et gere le calcul direct", () => {
  // 1. Ratio décimal brut issu d'Excel (ex. 0.4139 pour 41,39%)
  const prodDecimal = { id: "P1", gross_margin: 0.4139 };
  assert.equal(Math.round(productMarginPct(prodDecimal) * 10) / 10, 41.4);

  // 2. Ratio décimal 0.60
  const prodRatio60 = { id: "P2", gross_margin: 0.6 };
  assert.equal(productMarginPct(prodRatio60), 60);

  // 3. Valeur déjà en pourcentage (ex. 41.39%)
  const prodPct = { id: "P3", gross_margin: 41.39 };
  assert.equal(productMarginPct(prodPct), 41.39);

  // 4. Marge absente mais prix de vente et coût d'achat présents
  const prodCalcul = { id: "P4", selling_price: 100, purchase_cost: 60 };
  assert.equal(productMarginPct(prodCalcul), 40);

  // 5. Marge à zéro avec coût et prix différents (repli sur prix & coût)
  const prodZero = { id: "P5", gross_margin: 0, selling_price: 200, purchase_cost: 150 };
  assert.equal(productMarginPct(prodZero), 25);

  // 6. Produit null ou vide
  assert.equal(productMarginPct(null), null);
  assert.equal(productMarginPct({}), null);
});

// =========================================================================
// POINT B — Isolation du score Finance en l'absence de charges
// =========================================================================
test("Point B : Finance sans donnees de depenses n'affiche pas une marge inventee de 100%", () => {
  // Commandes sur 3 mois complets avec CA, mais AUCUNE charge (pas de dépenses, pas de paie, pas de coût de revient)
  const dataset = {
    orders: [
      { order_id: "O1", date: "2026-01-10", total_revenue: 1000, status: "completed" },
      { order_id: "O2", date: "2026-02-10", total_revenue: 1500, status: "completed" },
      { order_id: "O3", date: "2026-03-10", total_revenue: 2000, status: "completed" },
    ],
    transactions: [],
    expenses: [],
    payrolls: [],
    company: {},
  };

  const scores = computeDomainScores(dataset);

  // En l'absence de charges d'exploitation, la marge nette NE DOIT PAS être calculée à 100%
  assert.equal(scores.finance.measured, false, "Finance doit être marqué non mesuré");
  assert.equal(scores.finance.explanation, "Dépenses d'exploitation non mesurées");
  assert.notEqual(scores.finance.explanation, "Marge 100 % (3 mois)", "Ne doit jamais afficher 100% de marge inventée");
});

// =========================================================================
// POINT C — Harmonisation du libellé Opérations (seuil critique vs ruptures)
// =========================================================================
test("Point C : Le libelle d'alerte distingue reapprovisionnement critique et rupture reelle", () => {
  const products = [
    { product_id: "P1", product_name: "TV LG", inventory_level: 50, reorder_point: 10 },
    { product_id: "P2", product_name: "Casque Bose", inventory_level: 1, reorder_point: 5 }, // En alerte (1 <= 5), mais stock > 0
    { product_id: "P3", product_name: "Câble HDMI", inventory_level: 2, reorder_point: 10 }, // En alerte (2 <= 10), mais stock > 0
  ];
  const inventory = [
    { product_id: "P1", closing_stock: 50, stock_status: "optimal", date: "2026-03-01" },
    { product_id: "P2", closing_stock: 1, stock_status: "faible", date: "2026-03-01" },
    { product_id: "P3", closing_stock: 2, stock_status: "faible", date: "2026-03-01" },
  ];
  const company = { stock_alert_threshold: 2, stock_alert_use_reorder_point: true };

  const stock = computeStockAlerts(products, inventory, getStockAlertSettings(company), []);
  assert.equal(stock.alertCount, 2, "2 produits sous le seuil");
  assert.equal(stock.outOfStockCount, 0, "0 produit en rupture totale");

  const scores = computeDomainScores({ products, inventory, company });
  assert.equal(scores.operations.measured, true);
  // Doit indiquer '2 à réapprovisionner' et non '2 ruptures'
  assert.ok(scores.operations.explanation.includes("2 à réapprovisionner"), `Explanation: ${scores.operations.explanation}`);
  assert.ok(!scores.operations.explanation.includes("2 ruptures"), "Ne doit pas qualifier le réapprovisionnement de rupture");
});

test("Point C : Un stock nul est correctement identifie comme rupture", () => {
  const products = [
    { product_id: "P1", product_name: "Article 0", inventory_level: 0 },
  ];
  const inventory = [
    { product_id: "P1", closing_stock: 0, date: "2026-03-01" },
  ];
  const stock = computeStockAlerts(products, inventory, { threshold: 5 }, []);
  assert.equal(stock.outOfStockCount, 1, "Stock de 0 doit être compté en rupture");
});

// =========================================================================
// POINT D — Nouveaux clients : identification claire du mois d'acquisition
// =========================================================================
test("Point D : Attribution claire du mois pour les nouveaux clients", () => {
  const customers = [
    { customer_id: "C1", acquisition_date: "2026-01-15" },
    { customer_id: "C2", acquisition_date: "2026-01-20" },
    { customer_id: "C3", acquisition_date: "2026-02-05" },
    { customer_id: "C4", acquisition_date: "2026-02-12" },
    { customer_id: "C5", acquisition_date: "2026-02-28" },
  ];

  const custMonthly = monthlyAggComplete(customers, "acquisition_date", "customer_id", "count");
  assert.ok(custMonthly.length >= 2);
  const lastEntry = custMonthly[custMonthly.length - 1];
  const prevEntry = custMonthly[custMonthly.length - 2];

  assert.equal(lastEntry.month, "2026-02");
  assert.equal(lastEntry.val, 3, "3 clients en février 2026");
  assert.equal(prevEntry.month, "2026-01");
  assert.equal(prevEntry.val, 2, "2 clients en janvier 2026");

  const moisNom = moisLisible(lastEntry.month);
  assert.equal(moisNom, "févr. 2026");

  const kpiName = `Nouveaux clients (${moisNom})`;
  assert.equal(kpiName, "Nouveaux clients (févr. 2026)");
});
