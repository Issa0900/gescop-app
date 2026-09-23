// Justesse des KPI et lecture des valeurs (audit du dossier DEMO, 22 sept 2026).
// Chaque test reprend un ecart reel mesure par le banc DEMO (tests/banc/demo.ts).
import test from "node:test";
import assert from "node:assert/strict";
import { computeKpiBatch } from "../src/lib/core/kpiEngine.js";
import { buildKpiDataset } from "../src/lib/core/kpiDataset.js";
import { montantHT, commandeHorsCA, recettesDejaCommandees } from "../src/lib/core/kpiRecords.js";
import { conventionNombreProuvee, appliquerPlan } from "../base44/shared/importPlan.ts";
import { calculerFormulesManquantes } from "../base44/shared/formules.ts";

const kpi = (data, ids) => {
  const { records, semantics } = buildKpiDataset(data);
  const res = computeKpiBatch(ids, records, semantics);
  return Object.fromEntries(ids.map((id) => [id, res.get(id)?.value ?? null]));
};

test("CA hors taxes : le sous-total passe avant le total TTC", () => {
  const orders = [
    { order_id: "C1", date: "2026-01-01", subtotal: 100, tax: 14.98, total: 114.98, total_cost: 60 },
    { order_id: "C2", date: "2026-01-02", subtotal: 200, tax: 29.95, total: 229.95, total_cost: 90 },
  ];
  const k = kpi({ orders }, ["total_revenue", "gross_margin_amount", "gross_margin_pct", "aov"]);
  assert.equal(k.total_revenue, 300);
  assert.equal(k.gross_margin_amount, 150);
  assert.equal(k.gross_margin_pct, 50);
  assert.equal(k.aov, 150);
});

test("Montant HT d'une ligne : total moins taxe quand il n'y a pas de sous-total", () => {
  assert.equal(montantHT({ total: 114.98, tax: 14.98 }), 100);
  assert.equal(montantHT({ total: 80 }), 80);
});

test("Commandes annulees et retournees hors CA ; « No » de retour ne les exclut pas", () => {
  assert.equal(commandeHorsCA({ status: "Cancelled" }), true);
  assert.equal(commandeHorsCA({ status: "Returned" }), true);
  assert.equal(commandeHorsCA({ status: "Completed", return_status: "No" }), false);
  assert.equal(commandeHorsCA({ return_status: "Yes" }), true);
});

test("Panier moyen : commandes distinctes, pas lignes d'articles", () => {
  const orders = [
    { order_id: "C1", date: "2026-01-01", total: 50 },
    { order_id: "C1", date: "2026-01-01", total: 50 },
    { order_id: "C2", date: "2026-01-02", total: 100 },
  ];
  assert.equal(kpi({ orders }, ["aov"]).aov, 100);
});

test("Une vente presente en commande ET en transaction n'est comptee qu'une fois", () => {
  const orders = [{ order_id: "ORD-20260601-1", date: "2026-06-01", total: 349.99 }];
  const transactions = [
    { date: "2026-06-01", description: "Vente ORD-20260601-1", amount: 349.99, type: "income" },
    { date: "2026-06-02", description: "Vente comptoir", amount: 20, type: "income" },
  ];
  const { records } = buildKpiDataset({ orders, transactions });
  assert.equal(recettesDejaCommandees(records), 349.99);
  assert.equal(kpi({ orders, transactions }, ["total_revenue"]).total_revenue, 369.99);
});

test("Une depense saisie en depense ET en transaction n'est comptee qu'une fois", () => {
  const expenses = [{ date: "2026-06-01", amount: 2800, category: "Loyer" }];
  const transactions = [{ date: "2026-06-01", description: "Paiement Loyer", amount: 2800, type: "expense" }];
  assert.equal(kpi({ expenses, transactions }, ["total_expense"]).total_expense, 2800);
});

test("Sans charge d'exploitation : EBITDA, resultat, cout par employe, DSO, BFR et CPC non mesurables (jamais 0 ni le CA)", () => {
  const orders = [{ order_id: "C1", date: "2026-01-01", total: 100, total_cost: 40 }];
  const employees = [{ employee_id: "E1" }];
  const campaigns = [{ campaign_id: "M1", clicks: 100 }];
  const k = kpi({ orders, employees, campaigns }, ["ebitda", "net_income", "avg_employee_cost", "dso", "bfr", "bfr_days", "cpc"]);
  for (const [id, v] of Object.entries(k)) assert.equal(v, null, id);
});

test("Resultat net : CA - cout des ventes - depenses - paie", () => {
  const orders = [{ order_id: "C1", date: "2026-01-01", subtotal: 1000, total_cost: 400 }];
  const expenses = [{ date: "2026-01-02", amount: 100 }];
  const payrolls = [{ employee_id: "E1", period: "2026-01", total_cost: 300 }];
  assert.equal(kpi({ orders, expenses, payrolls }, ["net_income"]).net_income, 200);
});

test("CPC et CPM sur la depense reelle, le budget seulement en repli", () => {
  const campaigns = [{ campaign_id: "M1", budget: 1000, spend: 800, clicks: 400, impressions: 100000 }];
  const k = kpi({ campaigns }, ["cpc", "cpm"]);
  assert.equal(k.cpc, 2);
  assert.equal(k.cpm, 8);
  assert.equal(kpi({ campaigns: [{ campaign_id: "M1", budget: 1000, clicks: 400 }] }, ["cpc"]).cpc, 2.5);
});

test("Cout moyen par employe depuis les fiches quand aucune paie n'est importee", () => {
  const employees = [{ employee_id: "E1", total_employer_cost: 90000, annual_salary: 80000 }, { employee_id: "E2", total_employer_cost: 110000 }];
  assert.equal(kpi({ employees }, ["avg_employee_cost"]).avg_employee_cost, 100000);
});

test("Valeur du stock : somme du dernier releve de chaque produit", () => {
  const inventory = [
    { product_id: "P1", date: "2026-01-01", inventory_value: 100 },
    { product_id: "P1", date: "2026-02-01", inventory_value: 150 },
    { product_id: "P2", date: "2026-01-15", inventory_value: 50 },
  ];
  const cashflow = [{ date: "2026-02-01", accounts_receivable: 10, accounts_payable: 20 }];
  assert.equal(kpi({ inventory, cashflow }, ["bfr"]).bfr, 190);
});

test("Separateur decimal decide par la colonne : 22.368 est decimal quand la colonne contient 261.96", () => {
  assert.equal(conventionNombreProuvee(["261.96", "22.368", "957.5775"]), "point");
  assert.equal(conventionNombreProuvee(["12,5", "1.234"]), "virgule");
  assert.equal(conventionNombreProuvee(["1.234", "5.678"]), null);
  const plan = { entite: "Order", ligne_entetes: 0, lignes_ignorees: [], colonnes: [{ colonne: "Sales", champ: "total" }], confiance: "haute", explication: "", origine: "humain", corrections: [] };
  const rows = appliquerPlan(plan, [["Sales"], ["261.96"], ["22.368"]]);
  assert.equal(rows[1].total, 22.368);
});

test("Dates americaines : une date impossible en JJ/MM impose MM/JJ a toute la colonne", () => {
  const plan = { entite: "Order", ligne_entetes: 0, lignes_ignorees: [], colonnes: [{ colonne: "Order Date", champ: "date" }], confiance: "haute", explication: "", origine: "humain", corrections: [] };
  const rows = appliquerPlan(plan, [["Order Date"], ["11/22/2016"], ["11/8/2016"]]);
  assert.equal(rows[1].date, "2016-11-08");
});

test("Formules sans resultat enregistre : calculees, jamais laissees a 0", () => {
  const wb = {
    SheetNames: ["V", "S"],
    Sheets: {
      V: { A1: { t: "n", v: 4 }, B1: { t: "n", v: 45 }, C1: { t: "n", v: 0.1 }, D1: { t: "z", f: "A1*B1*(1-C1)", v: 0 }, E1: { t: "s", v: "QC" },
        F1: { t: "z", f: 'IF(E1="QC", D1*0.09975, 0)', v: 0 }, G1: { t: "z", f: "YEAR(TODAY())", v: 0 } },
      S: { A1: { t: "z", f: "SUM(V!D1:D1)", v: 0 } },
    },
  };
  const r = calculerFormulesManquantes(wb);
  assert.equal(r.calculees, 3);
  assert.equal(r.laissees, 1);
  assert.equal(wb.Sheets.V.D1.v, 162);
  assert.ok(Math.abs(wb.Sheets.V.F1.v - 16.1595) < 1e-9);
  assert.equal(wb.Sheets.S.A1.v, 162);
  assert.equal(wb.Sheets.V.G1.v, undefined);
});
