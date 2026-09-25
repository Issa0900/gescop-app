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
