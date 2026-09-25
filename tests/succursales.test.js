// Page Succursales (lots 1.3 et 4.3 du rapport du 25 sept. 2026).
import test from "node:test";
import assert from "node:assert/strict";
import { calculerSuccursales, cleSuccursale, COMMUN } from "../src/lib/succursales.js";

test("« Québec (siège) », « Siège social » et « siège » forment un seul groupe", () => {
  assert.equal(cleSuccursale("Québec (siège)"), cleSuccursale("Siège social"));
  assert.equal(cleSuccursale("siège"), cleSuccursale("Siège social"));
  assert.notEqual(cleSuccursale("Lévis"), cleSuccursale("Québec (siège)"));
});

test("« Ville (Nom) » rejoint « Nom » s'il existe seul ailleurs, sinon garde son nom complet", () => {
  assert.equal(cleSuccursale("Québec (Sainte-Foy)", new Set(["sainte foy"])), "sainte foy");
  assert.equal(cleSuccursale("Québec (Sainte-Foy)", new Set()), "quebec sainte foy");
});

test("les transactions comptent, sans doublon avec la commande qu'elles encaissent", () => {
  const r = calculerSuccursales({
    orders: [{ order_id: "CMD001", total: 100, succursale: "Lévis" }],
    transactions: [
      { id: "t1", type: "income", amount: 1000, branch: "Lévis" },
      { id: "t2", type: "income", amount: 100, branch: "Lévis", description: "Encaissement CMD001" },
      { id: "t3", type: "expense", amount: 500, branch: "Lévis" },
    ],
  });
  const levis = r.locations.find((l) => l.name === "Lévis");
  assert.equal(levis.revenue, 1100, "commande 100 + vente 1000 ; l'encaissement de CMD001 n'est pas recompté ; la dépense n'est pas du CA");
});

test("« Toutes succursales » est un groupe commun, pas une succursale", () => {
  const r = calculerSuccursales({ assets: [{ succursale: "Toutes succursales", net_book_value: 1000, dpa_rate: 0.2 }], employees: [{ branch: "Lévis", total_employer_cost: 10 }] });
  assert.ok(r.locations.some((l) => l.name === COMMUN));
  assert.equal(r.nbSuccursales, 1);
});
