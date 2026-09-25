// Contrat de calcul des KPI (.claude/skills/gescop-kpi-contract) : un test par
// anomalie de l'audit du 25 sept. 2026, sur le vrai moteur.
import test from "node:test";
import assert from "node:assert/strict";
import { computeKpiBatch } from "../src/lib/core/kpiEngine.js";
import { buildKpiDataset } from "../src/lib/core/kpiDataset.js";

const calcul = (data, ids) => {
  const { records, semantics } = buildKpiDataset(data);
  const res = computeKpiBatch(ids, records, semantics);
  return Object.fromEntries(ids.map((id) => [id, { v: res.get(id)?.value ?? null, s: res.get(id)?.status, r: res.get(id) }]));
};

// ── ANO-01 : le statut d'un KPI suit celui des KPI dont il dépend ────────────

test("ANO-01 : résultat net partiel (sans coût des ventes) → marge nette partielle aussi", () => {
  const data = {
    orders: [{ order_id: "O1", date: "2026-06-10", total_revenue: 100000, status: "completed" }],
    expenses: [{ expense_id: "E1", date: "2026-06-11", amount: 10000 }],
    payrolls: [{ payroll_id: "P1", period: "2026-06-30", total_cost: 20000 }],
  };
  const k = calcul(data, ["net_income", "net_margin_pct"]);
  assert.equal(k.net_income.s, "UNKNOWN");
  assert.equal(k.net_margin_pct.s, "UNKNOWN", "la marge nette hérite du statut partiel du résultat net");
  const seul = calcul(data, ["net_margin_pct"]);
  assert.equal(seul.net_margin_pct.s, "UNKNOWN", "même demandé seul");
});

test("ANO-01 : une formule qui rend null est NON MESURÉE, jamais partielle", () => {
  const data = { orders: [{ order_id: "O1", date: "2026-06-10", total_revenue: 1000, status: "completed" }] };
  const k = calcul(data, ["gross_margin_amount", "gross_margin_pct"]);
  assert.equal(k.gross_margin_amount.v, null);
  assert.equal(k.gross_margin_amount.s, "NOT_MEASURED");
  assert.equal(k.gross_margin_pct.s, "NOT_MEASURED");
});

test("ANO-01 : dépendance KPI non mesurée → partiel (dépenses absentes du résultat)", () => {
  const data = {
    orders: [{ order_id: "O1", date: "2026-06-10", total_revenue: 100000, cost: 40000, status: "completed" }],
    payrolls: [{ payroll_id: "P1", period: "2026-06-30", total_cost: 20000 }],
  };
  const k = calcul(data, ["total_expense", "net_income"]);
  assert.equal(k.total_expense.s, "NOT_MEASURED");
  assert.equal(k.net_income.v, 40000);
  assert.equal(k.net_income.s, "UNKNOWN");
});

test("ANO-01 : sources complètes → mesuré", () => {
  const data = {
    orders: [{ order_id: "O1", date: "2026-06-10", total_revenue: 100000, cost: 40000, status: "completed" }],
    expenses: [{ expense_id: "E1", date: "2026-06-11", amount: 10000 }],
    payrolls: [{ payroll_id: "P1", period: "2026-06-30", total_cost: 20000 }],
  };
  const k = calcul(data, ["net_income", "net_margin_pct", "gross_margin_pct"]);
  assert.equal(k.net_income.v, 30000);
  assert.equal(k.net_income.s, "MEASURED");
  assert.equal(k.net_margin_pct.s, "MEASURED");
  assert.equal(k.gross_margin_pct.s, "MEASURED");
});

// ── ANO-02 / ANO-03 : EBITDA avant amortissement, résultat net après ─────────

const pnl = () => ({
  orders: [
    { order_id: "O1", date: "2026-01-10", total_revenue: 500000, cost: 200000, status: "completed" },
    { order_id: "O2", date: "2026-12-20", total_revenue: 500000, cost: 200000, status: "completed" },
  ],
  expenses: [{ expense_id: "E1", date: "2026-06-01", amount: 150000, category: "loyer" }],
  payrolls: [{ payroll_id: "P1", period: "2026-06-30", total_cost: 250000 }],
});

test("ANO-02 : EBITDA = CA - coût des ventes - dépenses - paie, sans registre d'immobilisations", () => {
  const k = calcul(pnl(), ["ebitda", "net_income", "total_charges", "total_revenue"]);
  assert.equal(k.ebitda.v, 200000);
  assert.equal(k.ebitda.s, "MEASURED");
  assert.equal(k.net_income.v, 200000, "sans immobilisations, rien à amortir");
  assert.equal(k.net_income.s, "MEASURED", "l'absence de registre d'immobilisations ne rend pas le résultat partiel");
  assert.equal(k.total_revenue.v - k.total_charges.v, k.net_income.v);
});

test("ANO-02/03 : l'amortissement est retranché du résultat net, jamais de l'EBITDA", () => {
  const data = { ...pnl(), assets: [{ asset_id: "A1", net_book_value: 100000, dpa_rate: 0.3 }] };
  const k = calcul(data, ["ebitda", "dpa_annual_total", "net_income", "total_charges", "total_revenue"]);
  assert.equal(k.dpa_annual_total.v, 30000);
  assert.equal(k.ebitda.v, 200000);
  assert.equal(k.net_income.v, 170000, "12 mois de ventes : amortissement annuel entier");
  assert.equal(k.total_revenue.v - k.total_charges.v, k.net_income.v, "CA - charges = résultat");
});

test("ANO-03 : amortissement proratisé en mois de la période", () => {
  const data = {
    orders: [
      { order_id: "O1", date: "2026-01-05", total_revenue: 60000, cost: 20000, status: "completed" },
      { order_id: "O2", date: "2026-03-28", total_revenue: 60000, cost: 20000, status: "completed" },
    ],
    payrolls: [{ payroll_id: "P1", period: "2026-02-28", total_cost: 30000 }],
    expenses: [{ expense_id: "E1", date: "2026-02-01", amount: 10000 }],
    assets: [{ asset_id: "A1", net_book_value: 120000, dpa_rate: 0.2 }],
  };
  const k = calcul(data, ["ebitda", "net_income"]);
  assert.equal(k.ebitda.v, 40000);
  assert.equal(k.net_income.v, 40000 - 24000 * 3 / 12);
});

test("ANO-02 : sans aucune charge d'exploitation, EBITDA non mesuré (jamais la marge brute)", () => {
  const data = { orders: [{ order_id: "O1", date: "2026-01-10", total_revenue: 1000, cost: 400, status: "completed" }] };
  const k = calcul(data, ["ebitda", "net_income"]);
  assert.equal(k.ebitda.v, null);
  assert.equal(k.net_income.v, null);
});

test("ANO-10 : un taux d'amortissement donné en pourcentage (30) vaut 0,30", () => {
  const k = calcul({ assets: [{ asset_id: "A1", net_book_value: 100000, dpa_rate: 30 }] }, ["dpa_annual_total"]);
  assert.equal(k.dpa_annual_total.v, 30000);
});
