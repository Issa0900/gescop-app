// Regles communes des graphiques (phase 3 de l'audit visuel, 23 sept 2026).
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { moisLisible, moisAxe, montant, montantCourt, pourcent, libelleCode, plierAutres } from "../src/lib/graphiques.js";

// Intl fr-CA separe les milliers par une espace insecable : on compare sans.
const brut = (s) => s.replace(/[  ]/g, " ");

test("Mois lisibles en francais, avec l'annee", () => {
  assert.equal(moisLisible("2025-10"), "oct. 2025");
  assert.equal(moisAxe("2026-02-15"), "févr. 26");
  assert.equal(moisAxe("+30j"), "+30j");
});

test("Montants : complets dans les infobulles, courts sur les axes", () => {
  assert.equal(brut(montant(150000)), "150 000 $");
  assert.equal(montant(null), "—");
  assert.equal(brut(montantCourt(850)), "850 $");
  assert.equal(brut(montantCourt(1234)), "1,2 k$");
  assert.equal(brut(montantCourt(150000)), "150 k$");
  assert.equal(brut(montantCourt(1_200_000)), "1,2 M$");
  assert.equal(brut(montantCourt(-45000)), "-45 k$");
  assert.equal(brut(pourcent(12.345)), "12,3 %");
});

test("Codes techniques rendus lisibles", () => {
  assert.equal(libelleCode("google_ads"), "Google Ads");
  assert.equal(libelleCode("meta-ads"), "Meta Ads");
  assert.equal(libelleCode("tiktok"), "TikTok");
  assert.equal(libelleCode("haute_valeur"), "Haute Valeur");
  assert.equal(libelleCode("Siège social"), "Siège social");
});

test("Au-dela de N categories, les plus petites sont regroupees en « Autres »", () => {
  const lignes = [5, 9, 1, 7, 3].map((v, i) => ({ name: `c${i}`, value: v }));
  const r = plierAutres(lignes, "value", 3);
  assert.deepEqual(r.map((l) => l.name), ["c1", "c3", "Autres"]);
  assert.equal(r[2].value, 9);
});

test("Tout graphique passe par lib/graphiques, sans couleur ecrite en dur", () => {
  const SRC = path.resolve("src");
  const fichiers = (dir) => fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    return e.isDirectory() ? fichiers(p) : /\.jsx?$/.test(e.name) ? [p] : [];
  });
  const graphiques = fichiers(SRC)
    .filter((f) => !f.endsWith(path.join("ui", "chart.jsx")))
    .filter((f) => /from ["']recharts["']/.test(fs.readFileSync(f, "utf8")));
  assert.ok(graphiques.length >= 10);
  const fautifs = graphiques.filter((f) => {
    const t = fs.readFileSync(f, "utf8");
    return !t.includes("@/lib/graphiques") || /["']#[0-9a-fA-F]{3,6}["']/.test(t);
  });
  assert.deepEqual(fautifs.map((f) => path.relative(SRC, f)), []);
});
