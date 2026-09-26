// Chiffres des rapports : calcules par le moteur KPI sur la periode du rapport
// (src/lib/core/rapportChiffres.js), jamais inventes (ANO-15).
import test from "node:test";
import assert from "node:assert/strict";
import { chiffresRapport, variation } from "../src/lib/core/rapportChiffres.js";

const auj = new Date("2026-09-15T12:00:00Z");
const ind = (ch, id) => ch.indicateurs.find((i) => i.id === id);

const donnees = () => ({
  orders: [
    { order_id: "J1", date: "2026-07-10", total_revenue: 1000, cost: 600, status: "completed", customer_id: "C1" },
    { order_id: "A1", date: "2026-08-05", total_revenue: 1500, cost: 700, status: "completed", customer_id: "C1" },
    { order_id: "A2", date: "2026-08-28", total_revenue: 500, cost: 300, status: "completed", customer_id: "C2" },
    { order_id: "A3", date: "2026-08-31", total_revenue: 800, cost: 400, status: "cancelled" },
  ],
  expenses: [
    { expense_id: "E7", date: "2026-07-20", amount: 400 },
    { expense_id: "E8", date: "2026-08-20", amount: 300 },
  ],
  payrolls: [{ employee_id: "P1", period: "2026-08", total_cost: 200 }],
  cashflow: [
    { date: "2026-07-31", closing_cash: 5000 },
    { date: "2026-08-15", closing_cash: 6500 },
    { date: "2026-08-31", closing_cash: 7000 },
  ],
  inventory: [{ product_id: "P1", date: "2026-08-31", closing_stock: 10, inventory_value: 900 }],
});

test("Mensuel : dernier mois complet contre le précédent, mêmes formules que le moteur", () => {
  const ch = chiffresRapport(donnees(), "mensuel", { aujourdhui: auj });
  assert.equal(ch.periode.libelle, "août 2026");
  assert.equal(ch.precedente.libelle, "juillet 2026");
  assert.equal(ind(ch, "total_revenue").courant.valeur, 2000, "commande annulée exclue, HT");
  assert.equal(ind(ch, "total_revenue").precedent.valeur, 1000);
  assert.equal(ind(ch, "order_count").courant.valeur, 2);
  assert.equal(ind(ch, "cash_closing").courant.valeur, 7000, "solde du dernier jour du mois");
  assert.equal(ind(ch, "net_income").courant.valeur, 2000 - 1000 - 300 - 200);
  assert.equal(ch.couverture.Order, 3);
  assert.equal(ch.couverture.Payroll, 1, "la paie mensuelle entre dans le rapport mensuel");
  assert.equal(ch.serie.length, 6);
  assert.equal(ch.serie.at(-1).ca, 2000);
});

test("Hebdomadaire : 7 jours finissant à la dernière vente ; une paie mensuelle n'y est pas répartie", () => {
  const ch = chiffresRapport(donnees(), "hebdomadaire", { aujourdhui: auj });
  assert.equal(ch.periode.debut, "2026-08-25");
  assert.equal(ch.periode.fin, "2026-08-31");
  assert.equal(ind(ch, "total_revenue").courant.valeur, 500);
  assert.equal(ch.couverture.Payroll, undefined);
  assert.equal(ch.serie.length, 5);
  assert.match(ch.base, /dernier jour avec des ventes/);
});

test("Période courante vide contre période précédente mesurée : non mesuré, jamais -100 % (garantie DS11)", () => {
  const d = donnees();
  d.orders = d.orders.filter((o) => o.date < "2026-08-01");
  d.orders.push({ order_id: "S1", date: "2026-09-02", total_revenue: 10, status: "completed" });
  const ch = chiffresRapport(d, "quotidien", { aujourdhui: auj });
  assert.equal(ch.periode.debut, "2026-09-02");
  const marge = ind(ch, "gross_margin_pct");
  assert.equal(marge.courant.statut, "non mesuré");
  assert.equal(variation(marge), null);
});

test("Aucune donnée datée : pas de période, tout non mesuré", () => {
  const ch = chiffresRapport({ customers: [{ customer_id: "C1" }] }, "mensuel", { aujourdhui: auj });
  assert.equal(ch.periode, null);
  assert.ok(ch.indicateurs.every((i) => i.courant.valeur === null && i.courant.statut === "non mesuré"));
});

test("Stock : photo sans comparaison inventée ; sans comparaison demandée, aucune période précédente", () => {
  const ch = chiffresRapport(donnees(), "mensuel", { aujourdhui: auj, comparer: false });
  const stock = ind(ch, "inventory_value_total");
  assert.equal(stock.courant.valeur, 900);
  assert.equal(stock.precedent, null);
  assert.match(stock.courant.note, /Dernier relevé/);
  assert.equal(ch.precedente, null);
  assert.ok(ch.indicateurs.every((i) => i.precedent === null));
});

test("Variation : sens et caractère favorable selon l'indicateur, points pour les pourcentages", () => {
  assert.deepEqual(variation({ unite: "$", courant: { valeur: 110 }, precedent: { valeur: 100 } }), { ecart: 10, pct: 10, enPoints: false, sens: "hausse", favorable: true });
  assert.equal(variation({ unite: "$", baisseFavorable: true, courant: { valeur: 90 }, precedent: { valeur: 100 } }).favorable, true, "charges en baisse = favorable");
  const m = variation({ unite: "%", courant: { valeur: 31.8 }, precedent: { valeur: 33 } });
  assert.equal(m.enPoints, true);
  assert.equal(Math.round(m.ecart * 10) / 10, -1.2);
  assert.equal(m.favorable, false);
  assert.equal(variation({ unite: "$", courant: { valeur: 5 }, precedent: { valeur: null } }), null);
});

test("Mensuel avec moins de trois mois complets : le mois en cours est annoncé comme incomplet", () => {
  const d = { orders: [
    { order_id: "X1", date: "2026-08-10", total_revenue: 100, status: "completed" },
    { order_id: "X2", date: "2026-09-03", total_revenue: 50, status: "completed" },
  ] };
  const ch = chiffresRapport(d, "mensuel", { aujourdhui: auj });
  assert.equal(ch.periode.libelle, "septembre 2026");
  assert.match(ch.base, /encore incomplet/);
});
