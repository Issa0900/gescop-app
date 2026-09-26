import test from "node:test";
import assert from "node:assert/strict";
import {
  decalerAn,
  calculerBornesComparatives,
  lignesPourFiltre,
  construireFiltrePeriode,
  deplacerFiltre,
  kpisPourFiltre,
  preparerPeriodes,
} from "../src/lib/core/kpiPeriodes.js";
import { computeStockAlerts } from "../src/lib/stockAlerts.js";

test("Universal Period Engine - decalerAn et gestion bissextile", () => {
  assert.equal(decalerAn("2026-08", -1), "2025-08");
  assert.equal(decalerAn("2024-02-29", -1), "2023-02-28", "29 fév 2024 -> 28 fév 2023");
  assert.equal(decalerAn("2024-02-29", 4), "2028-02-29", "29 fév 2024 -> 29 fév 2028 (bissextile)");
  assert.equal(decalerAn("2026-05-15", -2), "2024-05-15");
});

test("Universal Period Engine - bornes comparatives MoM et YoY", () => {
  // Mois complet MoM
  const momMonth = calculerBornesComparatives("2026-08-01", "2026-08-31", "MoM");
  assert.equal(momMonth.compareStartDate, "2026-07-01");
  assert.equal(momMonth.compareEndDate, "2026-07-31");

  // Mois complet YoY
  const yoyMonth = calculerBornesComparatives("2026-08-01", "2026-08-31", "YoY");
  assert.equal(yoyMonth.compareStartDate, "2025-08-01");
  assert.equal(yoyMonth.compareEndDate, "2025-08-31");

  // Trimestre complet MoM (T3 = 07-01 au 09-30) -> comparative = T2 (04-01 au 06-30)
  const momQuarter = calculerBornesComparatives("2026-07-01", "2026-09-30", "MoM");
  assert.equal(momQuarter.compareStartDate, "2026-04-01");
  assert.equal(momQuarter.compareEndDate, "2026-06-30");

  // Plage libre de 10 jours
  const momCustom = calculerBornesComparatives("2026-08-11", "2026-08-20", "MoM");
  assert.equal(momCustom.compareEndDate, "2026-08-10");
  assert.equal(momCustom.compareStartDate, "2026-08-01");
});

test("Universal Period Engine - règle stricte Flux [T_début, T_fin] vs Snapshot <= T_fin", () => {
  const donnees = {
    transactions: [
      { id: "T1", date: "2026-07-15", type: "revenu", amount: 1000 },
      { id: "T2", date: "2026-08-10", type: "revenu", amount: 2500 },
      { id: "T3", date: "2026-08-25", type: "depense", amount: 800 },
      { id: "T4", date: "2026-09-02", type: "revenu", amount: 3000 },
    ],
    cashflow: [
      { id: "C1", date: "2026-07-31", closing_cash: 50000 },
      { id: "C2", date: "2026-08-31", closing_cash: 51700 },
      { id: "C3", date: "2026-09-15", closing_cash: 60000 },
    ],
    orders: [
      { id: "O1", date: "2026-08-05", total: 1200 },
    ],
    customers: [
      { id: "CU1", customer_id: "CU1", customer_name: "Client Alpha" },
    ],
  };

  const prep = preparerPeriodes(donnees);

  // Filtrer sur Août 2026 : 2026-08-01 au 2026-08-31
  const lignesAout = lignesPourFiltre(prep, "2026-08-01", "2026-08-31");

  // Flux : Seuls T2, T3 et O1 doivent être inclus (T1 est en juillet, T4 en septembre)
  const fluxIds = lignesAout.filter((r) => r.type || r._entity === "Order").map((r) => r.id);
  assert.ok(fluxIds.includes("T2"), "T2 du 10 août inclus");
  assert.ok(fluxIds.includes("T3"), "T3 du 25 août inclus");
  assert.ok(fluxIds.includes("O1"), "O1 du 05 août inclus");
  assert.ok(!fluxIds.includes("T1"), "T1 de juillet exclu du flux d'août");
  assert.ok(!fluxIds.includes("T4"), "T4 de septembre exclu du flux d'août");

  // Snapshots : C1 (juillet) et C2 (août) inclus car <= 2026-08-31. C3 (septembre) exclu.
  const cfIds = lignesAout.filter((r) => r._entity === "Cashflow").map((r) => r.id);
  assert.ok(cfIds.includes("C1"), "Solde juillet conservé pour antécédence");
  assert.ok(cfIds.includes("C2"), "Solde août inclus");
  assert.ok(!cfIds.includes("C3"), "Solde septembre exclu");

  // Le solde le plus récent est bien C2 (51 700 $)
  const dernierCash = lignesAout.filter((r) => r._entity === "Cashflow").slice(-1)[0];
  assert.equal(dernierCash.closing_cash, 51700, "Le solde au 31 août est de 51 700 $");
});

test("Universal Period Engine - navigation pas à pas deplacerFiltre", () => {
  const filtreInit = construireFiltrePeriode({
    preset: "CLOSED_MONTH",
    compareType: "MoM",
    moisCible: "2026-08",
  });
  assert.equal(filtreInit.startDate, "2026-08-01");
  assert.equal(filtreInit.endDate, "2026-08-31");

  // Reculer d'un mois [ ◄ ]
  const filtrePrec = deplacerFiltre(filtreInit, -1);
  assert.equal(filtrePrec.startDate, "2026-07-01");
  assert.equal(filtrePrec.endDate, "2026-07-31");
  assert.equal(filtrePrec.compareStartDate, "2026-06-01");

  // Avancer de deux mois [ ► ]
  const filtreSuiv = deplacerFiltre(deplacerFiltre(filtrePrec, 1), 1);
  assert.equal(filtreSuiv.startDate, "2026-09-01");
  assert.equal(filtreSuiv.endDate, "2026-09-30");
});

test("Universal Period Engine - calcul des deltas et pourcentages kpisPourFiltre", () => {
  const donnees = {
    transactions: [
      { id: "T1", date: "2026-07-15", type: "revenu", amount: 10000 },
      { id: "T2", date: "2026-08-15", type: "revenu", amount: 15000 },
    ],
  };
  const prep = preparerPeriodes(donnees);
  const filter = construireFiltrePeriode({
    prep,
    preset: "CLOSED_MONTH",
    compareType: "MoM",
    moisCible: "2026-08",
  });

  const res = kpisPourFiltre(prep, ["total_revenue"], filter);
  assert.equal(res.current.get("total_revenue")?.value, 15000);
  assert.equal(res.previous.get("total_revenue")?.value, 10000);

  const varRev = res.variations.get("total_revenue");
  assert.equal(varRev.delta, 5000);
  assert.equal(varRev.pct, 50, "+50% d'augmentation");
});

test("Universal Period Engine - Stock dormant avec date de référence historique", () => {
  const products = [
    { product_id: "P1", product_name: "Produit Actif", inventory_level: 50 },
    { product_id: "P2", product_name: "Produit Dormant", inventory_level: 20 },
  ];
  const inventory = [
    { product_id: "P1", closing_stock: 50, date: "2026-03-31" },
    { product_id: "P2", closing_stock: 20, date: "2026-03-31" },
  ];
  // Ventes ayant eu lieu en février et mars 2026 (jeu de données s'arrêtant au 31 mars 2026)
  const orders = [
    { product_id: "P1", date: "2026-03-10", quantity: 5, total_revenue: 100 },
  ];
  const settings = { dormantMonths: 3, threshold: 5 };

  // 1. Sans date de référence (wall-clock = automne 2026) : P1 apparaîtrait dormant car vente > 6 mois avant wall clock
  // 2. Avec date de référence au 31 mars 2026 : P1 est actif (vendu en mars), P2 est dormant !
  const stockWithRef = computeStockAlerts(products, inventory, settings, orders, "2026-03-31");
  assert.equal(stockWithRef.dormantCount, 1, "Seul P2 doit être dormant quand la date de référence est le 31 mars 2026");
  const p1Row = stockWithRef.rows.find((r) => r.product.product_id === "P1");
  const p2Row = stockWithRef.rows.find((r) => r.product.product_id === "P2");
  assert.equal(p1Row.dormant, false, "P1 a été vendu le 10 mars 2026 -> non dormant");
  assert.equal(p2Row.dormant, true, "P2 n'a pas été vendu -> dormant");
});
