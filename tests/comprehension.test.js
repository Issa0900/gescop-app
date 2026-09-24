// Paramètres > Compréhension : ce qui est affiché vient des données de
// l'entreprise, jamais d'un texte écrit d'avance (lot 6, 24 sept. 2026).
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { resumerComprehension } from "../src/lib/comprehension.js";

test("sans aucun import : rien d'interprété, taux non mesuré", () => {
  const r = resumerComprehension({ imports: [], company: { organization_structure: { branches: [] } } });
  assert.equal(r.aDesImports, false);
  assert.deepEqual(r.types, []);
  assert.deepEqual(r.succursales, []);
  assert.equal(r.tauxImport, null);
});

test("types, lignes et taux calculés sur les imports réels", () => {
  const r = resumerComprehension({
    imports: [
      { entity_type: "Order", rows_processed: 90, total_rows: 100, unknown_fields: ["Remarque"] },
      { entity_type: "Order", rows_processed: 10, total_rows: 10 },
      { entity_type: "Employee", rows_processed: 5 },
      { entity_type: null, status: "quarantaine", rows_processed: 0, total_rows: 20, unknown_fields: ["Col A", "Remarque"] },
    ],
  });
  assert.deepEqual(r.types.map((t) => [t.entite, t.lignes, t.imports]), [["Order", 100, 2], ["Employee", 5, 1]]);
  // 100 importées sur 130 lignes lues (l'import Employee ne dit pas combien il en a lu).
  assert.equal(r.lignesLues, 130);
  assert.equal(r.lignesImportees, 100);
  assert.equal(r.tauxImport, 76.9);
  assert.deepEqual(r.colonnesNonReconnues, ["Remarque", "Col A"]);
});

test("succursales : saisies puis vues dans les données, sans doublon ni invention", () => {
  const r = resumerComprehension({
    imports: [{ entity_type: "Order", rows_processed: 2, total_rows: 2 }],
    company: { organization_structure: { branches: [{ name: "Magasin Centre" }, "Entrepôt Nord"] } },
    orders: [{ store: "magasin centre" }, { succursale: "Boutique Est" }, { store: "" }],
    employees: [{ branch: "Entrepôt Nord" }, { branch: "Bureau Ouest" }],
  });
  assert.deepEqual(r.succursales, ["Magasin Centre", "Entrepôt Nord", "Boutique Est", "Bureau Ouest"]);
  assert.deepEqual(r.succursalesSource, { saisies: 2, vues: 2 });
});

test("le panneau n'affiche plus de compréhension écrite en dur", () => {
  const src = fs.readFileSync(new URL("../src/components/settings/UnderstandingPanel.jsx", import.meta.url), "utf8");
  for (const invente of ["Laval", "Lévis", "98.2", "98,2"]) assert.ok(!src.includes(invente), `« ${invente} » encore présent`);
  assert.ok(src.includes("resumerComprehension"), "le panneau utilise le résumé calculé");
});
