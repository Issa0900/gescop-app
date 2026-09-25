// Sens d'une transaction (lot 1 du rapport du 25 sept. 2026) : plus de
// « montant positif = revenu » quand le type est perdu, et « revenu » /
// « dépense » compris quelle que soit la langue de la liste autorisée.
import test from "node:test";
import fs from "node:fs";
import assert from "node:assert/strict";
import { sensDe, sensParIndices } from "../base44/shared/sensTransaction.ts";
import { coerceEnumDetail, normalizeRow } from "../base44/shared/importUtils.ts";
import { getSchema } from "../base44/shared/entitySchemas.ts";
import { compatibiliteValeurs } from "../base44/shared/core/recognition/preuves.ts";
import { classifyTransaction, isIncome, isExpense } from "../src/lib/transactionClassifier.js";

test("« revenu » et « dépense » sont reconnus par une liste autorisée en anglais", () => {
  const liste = getSchema("Transaction").properties.type.enum;
  assert.equal(coerceEnumDetail("revenu", liste).value, "income");
  assert.equal(coerceEnumDetail("dépense", liste).value, "expense");
  assert.equal(coerceEnumDetail("Dépense", liste).value, "expense");
  // C'est ce contrôle qui retirait la colonne type d'une réponse de l'IA.
  const c = compatibiliteValeurs("type", getSchema("Transaction").properties.type, ["revenu", "dépense", "revenu"]);
  assert.equal(c.taux, 1, c.detail);
});

test("la traduction dans l'autre sens (anglais -> liste française) marche toujours", () => {
  assert.equal(coerceEnumDetail("income", ["revenu", "depense"]).value, "revenu");
});

test("sans type : signe négatif, puis catégorie, puis description", () => {
  assert.equal(sensParIndices(-50, "Ventes"), "expense");
  assert.equal(sensParIndices(120, "Ventes au détail"), "income");
  assert.equal(sensParIndices(900, "Loyer"), "expense");
  assert.equal(sensParIndices(900, "Coût des marchandises vendues"), "expense");
  assert.equal(sensParIndices(900, "", "Paie du personnel (net)"), "expense");
  assert.equal(sensParIndices(900, "Services publics"), "expense");
});

test("sans aucun indice, aucun sens n'est présumé (jamais « revenu » par défaut)", () => {
  assert.equal(sensParIndices(900, "Divers", "Écriture 123"), null);
  assert.equal(sensDe("remboursement de vente"), null, "indices contradictoires : pas de sens");
  const t = { amount: 900, category: "Divers", description: "Écriture 123" };
  assert.equal(classifyTransaction(t), null);
  assert.equal(isIncome(t), false);
  assert.equal(isExpense(t), false);
});

test("import : le type explicite français est gardé, la succursale est enregistrée", () => {
  const p = getSchema("Transaction").properties;
  const dep = normalizeRow("Transaction", { date: "2026-01-05", amount: "1500", type: "dépense", category: "Loyer", succursale: "Lévis" }, "i", p);
  assert.equal(dep.type, "expense");
  assert.equal(dep.branch, "Lévis");
  const sansIndice = normalizeRow("Transaction", { date: "2026-01-05", amount: "1500", category: "Divers" }, "i", p);
  assert.equal(sansIndice.type, undefined, "pas de revenu présumé");
});

test("fichier du rapport SANS colonne type : les catégories suffisent, totaux exacts", (t) => {
  const f = new URL("../../DEMO/gescop_donnees_test/01_transactions.csv", import.meta.url);
  let texte;
  try { texte = fs.readFileSync(f, "utf8"); } catch { t.skip("corpus ../DEMO/gescop_donnees_test absent"); return; }
  const [entete, ...lignes] = texte.trim().split(/\r?\n/);
  const cols = entete.split(",");
  const p = getSchema("Transaction").properties;
  let revenu = 0, depense = 0, sansSens = 0;
  for (const l of lignes) {
    const v = l.split(",");
    const brut = Object.fromEntries(cols.map((c, i) => [c, v[i]]).filter(([c]) => c !== "type"));
    const r = normalizeRow("Transaction", { date: brut.date, amount: brut.montant, category: brut["catégorie"], description: brut.description }, "i", p);
    if (isIncome(r)) revenu += r.amount; else if (isExpense(r)) depense += r.amount; else sansSens++;
  }
  assert.equal(sansSens, 0);
  assert.equal(Math.round(revenu * 100) / 100, 3177262.18);
  assert.equal(Math.round(depense * 100) / 100, 2233167.18);
});
