// « Tout supprimer » (lot purge, 25 sept. 2026) : après une purge, la base en
// ligne gardait 1 608 ventes et 6 100 observations orphelines.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { ENTITES_PURGEES, ENTITES_CONSERVEES, purgerTout, viderTable } from "../src/lib/purge.js";

/** Base en mémoire dont deleteMany est plafonné, comme un serveur qui supprime par lots. */
function base(tables, { plafond = Infinity, panne = null } = {}) {
  const t = JSON.parse(JSON.stringify(tables));
  const maj = [];
  const entite = (nom) => ({
    filter: async (_q, _s, limite = 1e9) => (t[nom] || []).slice(0, limite),
    list: async (_s, limite = 1e9) => (t[nom] || []).slice(0, limite),
    deleteMany: async () => {
      if (panne === nom) throw new Error(`panne ${nom}`);
      const n = Math.min(plafond, (t[nom] || []).length);
      t[nom] = (t[nom] || []).slice(n);
      return { deleted: n, success: true };
    },
    update: async (id, p) => { maj.push({ nom, id, p }); return p; },
  });
  return { entities: new Proxy({}, { get: (_x, nom) => entite(String(nom)) }), t, maj };
}
const lignes = (n) => Array.from({ length: n }, (_, i) => ({ id: `x${i}` }));

test("chaque entité de l'app est soit purgée, soit explicitement conservée", () => {
  const toutes = fs.readdirSync(new URL("../base44/entities/", import.meta.url)).map((f) => f.replace(/\.jsonc$/, ""));
  const classees = new Set([...ENTITES_PURGEES, ...ENTITES_CONSERVEES]);
  assert.deepEqual(toutes.filter((e) => !classees.has(e)), [], "entité ni purgée ni conservée");
  assert.deepEqual(ENTITES_PURGEES.filter((e) => !toutes.includes(e)), [], "entité purgée qui n'existe pas");
  assert.ok(ENTITES_PURGEES.includes("Payment"), "Payment (encaissements importés) est purgé");
  assert.equal(ENTITES_PURGEES[0], "Import", "Import en premier : un import en cours s'arrête");
});

test("une suppression plafonnée par le serveur est répétée jusqu'à vider la table", async () => {
  const { entities, t } = base({ Order: lignes(1608), Observation: lignes(6100) }, { plafond: 500 });
  const r = await purgerTout(entities);
  assert.equal(r.complet, true);
  assert.equal((t.Order || []).length, 0);
  assert.equal((t.Observation || []).length, 0);
  assert.equal(r.supprimees, 1608 + 6100);
});

test("une table en erreur n'arrête pas les suivantes, et le bilan le dit", async () => {
  const { entities, t } = base({ Order: lignes(3), Customer: lignes(2), Observation: lignes(4) }, { panne: "Customer" });
  const r = await purgerTout(entities);
  assert.equal(r.complet, false);
  assert.deepEqual(r.restantes, ["Customer"]);
  assert.match(r.erreurs.Customer, /panne/);
  assert.equal((t.Observation || []).length, 0, "les tables après Customer sont vidées");
});

test("une table qui ne diminue plus est signalée, pas annoncée vide", async () => {
  const { entities } = base({ Order: lignes(5) }, { plafond: 0 });
  const r = await viderTable(entities.Order);
  assert.equal(r.reste, true);
});

test("le score de santé est remis à « non mesuré » (null), jamais à 0", async () => {
  const { entities, maj } = base({});
  await purgerTout(entities, { company: { id: "co1" } });
  assert.deepEqual(maj[0], { nom: "Company", id: "co1", p: { health_score: null, dimension_scores: {}, last_analysis_date: null } });
});
