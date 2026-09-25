// Paie (lot 3 du rapport du 25 sept. 2026) : le coût d'une fiche de paie est
// dérivé de ses composantes quand le fichier ne le donne pas.
import test from "node:test";
import assert from "node:assert/strict";
import { normalizeRow } from "../base44/shared/importUtils.ts";
import { getSchema } from "../base44/shared/entitySchemas.ts";

const p = getSchema("Payroll").properties;

test("total_cost = brut + heures sup + primes + part employeur", () => {
  const r = normalizeRow("Payroll", { employee_id: "E1", period: "2026-07", regular_pay: "4000", overtime: "200", bonus: "300", employer_cost: "500" }, "i", p);
  assert.equal(r.total_cost, 5000);
});

test("un coût total fourni n'est jamais recalculé", () => {
  const r = normalizeRow("Payroll", { employee_id: "E1", period: "2026-07", regular_pay: "4000", total_cost: "4700" }, "i", p);
  assert.equal(r.total_cost, 4700);
});

test("les retenues ne s'ajoutent pas au coût ; le net et la date sont conservés", () => {
  const r = normalizeRow("Payroll", { employee_id: "E1", period: "2026-07", regular_pay: "4517.5", deductions: "1264.9", net_pay: "3252.6", payment_date: "2026-07-31" }, "i", p);
  assert.equal(r.total_cost, 4517.5);
  assert.equal(r.deductions, 1264.9);
  assert.equal(r.net_pay, 3252.6);
  assert.equal(r.payment_date, "2026-07-31");
});

test("sans aucune composante, rien n'est inventé", () => {
  const r = normalizeRow("Payroll", { employee_id: "E1", period: "2026-07", hours: "40" }, "i", p);
  assert.equal(r.total_cost, undefined);
});
