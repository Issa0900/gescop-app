// Donnees partagees, troncature visible, calculs memorises (phase 4 de
// l'audit visuel, 23 sept 2026).
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { fetchAllAvecEtat } from "../src/lib/fetchAll.js";
import { memoDonnees } from "../src/lib/core/memoDonnees.js";

const entite = (n) => ({
  list: async (_tri, taille, debut) => Array.from({ length: Math.max(0, Math.min(taille, n - debut)) }, (_, i) => ({ id: debut + i })),
});

test("La lecture dit quand elle atteint le plafond (au lieu de tronquer en silence)", async () => {
  const complet = await fetchAllAvecEtat(entite(1200), "-date", 20);
  assert.equal(complet.rows.length, 1200);
  assert.equal(complet.tronque, false);
  const tronque = await fetchAllAvecEtat(entite(12000), "-date", 20);
  assert.equal(tronque.rows.length, 10000);
  assert.equal(tronque.tronque, true);
  assert.equal(tronque.plafond, 10000);
});

test("Memes tableaux dans un autre objet : le calcul n'est pas refait", () => {
  let appels = 0;
  const f = memoDonnees((d) => { appels += 1; return { n: d.orders.length }; });
  const orders = [{ id: 1 }], payrolls = [];
  const a = f({ orders, payrolls, company: { id: 1 } });
  const b = f({ orders, payrolls, company: { id: 2 } });
  assert.equal(appels, 1);
  assert.equal(a, b);
  f({ orders: [...orders, { id: 2 }], payrolls });
  assert.equal(appels, 2);
});

test("Un reglage different (complement) refait le calcul", () => {
  let appels = 0;
  const f = memoDonnees(() => { appels += 1; return appels; }, (d) => String(d.company?.seuil));
  const orders = [];
  f({ orders, company: { seuil: 10 } });
  f({ orders, company: { seuil: 10 } });
  f({ orders, company: { seuil: 20 } });
  assert.equal(appels, 2);
});

const lire = (p) => fs.readFileSync(p, "utf8");

test("Les donnees du moteur restent en cache entre les ecrans", () => {
  const hook = lire("src/hooks/useDonneesKpi.js");
  assert.ok(!/staleTime:\s*0\b/.test(hook), "useDonneesKpi ne doit pas relire les 14 sources a chaque ecran");
  assert.match(hook, /staleTime: FRAICHEUR_DONNEES_MS/);
  // L'import vide tout le cache : un chiffre ne survit pas a un changement de donnees.
  assert.match(lire("src/pages/Import.jsx"), /qc\.invalidateQueries\(\)/);
});

test("La vue d'ensemble montre les indicateurs sans attendre le diagnostic IA", () => {
  const d = lire("src/pages/Dashboard.jsx");
  assert.ok(!d.includes("{hasData && hasAnalysis && ("), "le contenu ne doit pas dependre de l'analyse IA");
  assert.ok(d.includes("{hasData && ("));
});

test("Le bandeau de donnees partielles est present sur tous les ecrans", () => {
  assert.match(lire("src/components/Layout.jsx"), /<BandeauTroncature \/>/);
});
