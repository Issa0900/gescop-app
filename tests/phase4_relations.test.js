// Phase 4 : preuves venues des valeurs — relations mathematiques du metier,
// relations entre tables, et valeurs inhabituelles signalees sans etre
// supprimees ni corrigees.
import test from "node:test";
import assert from "node:assert/strict";
import { verifierRelations, recouvrement, ajouterClesConnues, valeursInhabituelles } from "../base44/shared/core/recognition/relations.ts";

test("Quantite x prix = total : relation verifiee ligne par ligne", () => {
  const lignes = [
    { quantity: 2, unit_price: 45, total: 90 },
    { quantity: 1, unit_price: 450, total: 450 },
    { quantity: 3, unit_price: 12.5, total: 37.5 },
  ];
  const [r] = verifierRelations(new Set(["quantity", "unit_price", "total"]), lignes);
  assert.equal(r.id, "qte_prix_total");
  assert.equal(r.coherentes, 3);
  assert.equal(r.taux, 1);
});

test("Une colonne « total » qui ne vaut jamais qte x prix est detectee (TTC, autre concept ?)", () => {
  const lignes = [{ quantity: 2, unit_price: 45, total: 103.5 }, { quantity: 1, unit_price: 450, total: 517.5 }, { quantity: 3, unit_price: 10, total: 34.5 }];
  const [r] = verifierRelations(new Set(["quantity", "unit_price", "total"]), lignes);
  assert.equal(r.coherentes, 0);
});

test("La remise est prise en compte quand elle est rattachee", () => {
  const [r] = verifierRelations(new Set(["quantity", "unit_price", "discount", "total_revenue"]), [{ quantity: 2, unit_price: 50, discount: 10, total_revenue: 90 }]);
  assert.equal(r.taux, 1);
});

test("Equation de stock : initial + achats - ventes = final", () => {
  const [r] = verifierRelations(new Set(["opening_stock", "purchases", "units_sold", "closing_stock"]), [
    { opening_stock: 40, purchases: 20, units_sold: 15, closing_stock: 45 },
    { opening_stock: 100, purchases: 0, units_sold: 20, closing_stock: 80 },
  ]);
  assert.equal(r.id, "equation_stock");
  assert.equal(r.taux, 1);
});

test("Marge en % ou en ratio : les deux ecritures sont reconnues", () => {
  const champs = new Set(["gross_profit", "total_revenue", "gross_margin"]);
  assert.equal(verifierRelations(champs, [{ gross_profit: 54, total_revenue: 90, gross_margin: 60 }])[0].taux, 1);
  assert.equal(verifierRelations(champs, [{ gross_profit: 54, total_revenue: 90, gross_margin: 0.6 }])[0].taux, 1);
});

test("Relation entre tables : part des codes d'une colonne qui existent ailleurs", () => {
  const cles = new Map();
  ajouterClesConnues(cles, "Customer", "customer_id", ["C-881", "C-882", "C-883"]);
  const r = recouvrement(["c-881", "C-883", "C-881", ""], cles.get("Customer.customer_id"));
  assert.deepEqual(r, { distinctes: 2, trouvees: 2, taux: 1 });
});

test("Valeurs inhabituelles : negatif et valeur extreme signales, rien n'est modifie", () => {
  const lignes = Array.from({ length: 10 }, (_, i) => ({ amount: String(100 + i) }));
  lignes.push({ amount: "-500" }, { amount: "48000" });
  const copie = JSON.stringify(lignes);
  const a = valeursInhabituelles(lignes);
  assert.equal(a.length, 2);
  assert.ok(a[0].motif.includes("négative"));
  assert.ok(a[1].motif.includes("médiane"));
  assert.equal(JSON.stringify(lignes), copie);
});

test("Pas de fausse alerte sur une colonne courte ou reguliere", () => {
  assert.equal(valeursInhabituelles([{ amount: 10 }, { amount: 5000 }]).length, 0, "moins de 10 valeurs : pas de mediane fiable");
  assert.equal(valeursInhabituelles(Array.from({ length: 12 }, (_, i) => ({ quantity: i + 1 }))).length, 0);
});
