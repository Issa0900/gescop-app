// Supprimer un import (page Importer) : il ne doit rester ni ses lignes, ni ses
// Observations (le moteur KPI s'en sert en repli), et les alertes des AUTRES
// imports doivent survivre. Agent QA du 24 sept. 2026, lot 2.
import test from "node:test";
import assert from "node:assert/strict";
import { supprimerImport } from "../src/lib/supprimerImport.js";

/** Base en mémoire au comportement de base44.entities (filtre par égalité, $in). */
function base(initial) {
  const tables = JSON.parse(JSON.stringify(initial));
  const correspond = (r, q) => Object.entries(q).every(([k, v]) =>
    v && typeof v === "object" && Array.isArray(v.$in) ? v.$in.includes(r[k]) : r[k] === v);
  const entite = (nom) => ({
    filter: async (q = {}, _tri, limite = 1e9) => (tables[nom] || []).filter((r) => correspond(r, q)).slice(0, limite),
    deleteMany: async (q = {}) => {
      const avant = (tables[nom] || []).length;
      tables[nom] = (tables[nom] || []).filter((r) => !correspond(r, q));
      return { deleted: avant - tables[nom].length };
    },
    delete: async (id) => { tables[nom] = (tables[nom] || []).filter((r) => r.id !== id); },
  });
  const entities = new Proxy({}, { get: (_t, nom) => entite(String(nom)) });
  return { entities, tables };
}

const donnees = () => ({
  Import: [{ id: "imp-1", entity_type: "Order" }, { id: "imp-2", entity_type: "Order" }],
  Order: [
    { id: "o1", import_id: "imp-1", total: 1000 }, { id: "o2", import_id: "imp-1", total: 2000 },
    { id: "o3", import_id: "imp-2", total: 500 },
  ],
  Observation: [
    { id: "ob1", import_id: "imp-1", concept: "sales.revenue", value: 1000 },
    { id: "ob2", import_id: "imp-1", concept: "sales.revenue", value: 2000 },
    { id: "ob3", import_id: "imp-2", concept: "sales.revenue", value: 500 },
  ],
  ImportIssue: [{ id: "is1", import_id: "imp-1" }, { id: "is2", import_id: "imp-2" }],
  Alert: [
    { id: "al1", category: "anomalie", title: "Chute des ventes (import 1)" },
    { id: "al2", category: "risque", title: "Rupture de stock (import 2)" },
    { id: "al3", category: "opportunite", title: "Client en croissance" },
  ],
});

test("supprimer un import efface ses Observations, pas celles des autres imports", async () => {
  const { entities, tables } = base(donnees());
  const r = await supprimerImport(entities, { id: "imp-1", entity_type: "Order" });
  assert.equal(r.statut, "supprime");
  assert.equal(r.observationsSupprimees, 2);
  assert.deepEqual(tables.Observation.filter((o) => o.import_id === "imp-1"), []);
  assert.deepEqual(tables.Observation.map((o) => o.id), ["ob3"]);
  assert.deepEqual(tables.Order.map((o) => o.id), ["o3"]);
  assert.deepEqual(tables.Import.map((i) => i.id), ["imp-2"]);
  assert.deepEqual(tables.ImportIssue.map((i) => i.id), ["is2"]);
});

test("supprimer un import ne touche à aucune alerte du compte", async () => {
  const { entities, tables } = base(donnees());
  await supprimerImport(entities, { id: "imp-1", entity_type: "Order" });
  assert.deepEqual(tables.Alert.map((a) => a.id), ["al1", "al2", "al3"]);
});

test("des Observations qui survivent à la suppression gardent l'import", async () => {
  const { entities, tables } = base(donnees());
  // Le serveur refuse d'effacer les Observations (droit, panne partielle).
  const bloque = new Proxy(entities, { get: (t, nom) => nom === "Observation"
    ? { ...t.Observation, deleteMany: async () => ({ deleted: 0 }) } : t[nom] });
  const r = await supprimerImport(bloque, { id: "imp-1", entity_type: "Order" });
  assert.equal(r.statut, "incomplet");
  assert.equal(r.observationsRestantes, 1);
  assert.ok(tables.Import.some((i) => i.id === "imp-1"), "l'import reste pour relancer la suppression");
});

test("type d'entité invalide : rien n'est supprimé", async () => {
  const { entities, tables } = base(donnees());
  const r = await supprimerImport(entities, { id: "imp-1", entity_type: "" });
  assert.equal(r.statut, "type_invalide");
  assert.equal(tables.Observation.length, 3);
  assert.equal(tables.Import.length, 2);
});
