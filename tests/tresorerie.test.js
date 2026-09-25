// Page Trésorerie (lot 2 du rapport du 25 sept. 2026) : plus de 0 $ quand le
// solde de clôture manque.
import test from "node:test";
import assert from "node:assert/strict";
import { soldesTresorerie } from "../src/lib/tresorerie.js";

const flux = [
  { date: "2026-01-01", opening_cash: 1000, cash_in: 500, cash_out: 200, closing_cash: 1300 },
  { date: "2026-02-01", opening_cash: 1300, cash_in: 400, cash_out: 100, closing_cash: 1600 },
];

test("le solde de clôture fourni fait foi", () => {
  const r = soldesTresorerie(flux);
  assert.equal(r.soldeActuel, 1600);
  assert.equal(r.derive, false);
});

test("sans solde de clôture : ouverture + entrées − sorties", () => {
  const r = soldesTresorerie(flux.map(({ closing_cash, ...x }) => x));
  assert.equal(r.soldeActuel, 1600);
  assert.equal(r.derive, true);
});

test("sans ouverture non plus : on repart de la clôture du mois précédent", () => {
  const r = soldesTresorerie([flux[0], { date: "2026-02-01", cash_in: 400, cash_out: 100 }]);
  assert.equal(r.soldeActuel, 1600);
});

test("aucune base de solde : non mesuré (null), jamais 0", () => {
  const r = soldesTresorerie([{ date: "2026-02-01", cash_in: 400, cash_out: 100 }]);
  assert.equal(r.soldeActuel, null);
  assert.equal(r.parMois["2026-02"].net, 300);
});

test("repli sur les transactions : un montant positif sans sens n'est pas une entrée", () => {
  const r = soldesTresorerie([], [
    { date: "2026-03-02", type: "income", amount: 500 },
    { date: "2026-03-05", type: "expense", amount: 200 },
    { date: "2026-03-07", amount: 999, category: "Divers" },
  ]);
  assert.equal(r.soldeActuel, 300);
});
