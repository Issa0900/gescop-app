// Phase 1 : chaque ligne ecartee est tracee avec un motif precis et reste
// retrouvable (registre ImportIssue). Le banc tests/banc/ verifie le parcours
// complet ; ces tests verrouillent les briques.
import test from "node:test";
import assert from "node:assert/strict";
import { motifChampManquant, recoveryInitial, REASON, RECOVERY } from "../base44/shared/importStatus.ts";
import { deduplicateRows, LIGNE_SOURCE } from "../base44/shared/deduplication.ts";
import { insertRows } from "../base44/shared/bulkInsert.ts";

test("Motif precis : absent, date illisible, nombre illisible, valeur hors liste", () => {
  assert.equal(motifChampManquant("date", "", { type: "string", format: "date" }).reason, REASON.MISSING_REQUIRED_FIELD);
  assert.deepEqual(motifChampManquant("date", "le mois dernier", { type: "string", format: "date" }),
    { reason: REASON.INVALID_DATE, raw_value: "le mois dernier" });
  assert.deepEqual(motifChampManquant("amount", "N/A", { type: "number" }),
    { reason: REASON.INVALID_NUMERIC_VALUE, raw_value: "N/A" });
  assert.deepEqual(motifChampManquant("status", "Zombie", { type: "string" }, { value: "Zombie" }),
    { reason: REASON.INVALID_ENUM_VALUE, raw_value: "Zombie" });
});

test("Seules les lignes corrigeables sont a retraiter ; doublons et totaux ne le sont pas", () => {
  assert.equal(recoveryInitial(REASON.INVALID_DATE), RECOVERY.PENDING);
  assert.equal(recoveryInitial(REASON.UNKNOWN_CONCEPT), RECOVERY.PENDING);
  assert.equal(recoveryInitial(REASON.DUPLICATE_RECORD), RECOVERY.NOT_APPLICABLE);
  assert.equal(recoveryInitial(REASON.SUMMARY_ROW), RECOVERY.NOT_APPLICABLE);
});

test("La deduplication rend les lignes ecartees elles-memes, et relie chaque ligne gardee a sa source", async () => {
  const table = [];
  const base44 = { entities: { Transaction: { list: async (_s, l, o) => table.slice(o, o + l) } } };
  const a = { date: "2026-03-01", amount: 500, type: "income", description: "Vente" };
  const b = { ...a };
  const c = { date: "2026-03-02", amount: 80, type: "expense", description: "Pub" };
  const res = await deduplicateRows(base44, "Transaction", [a, b, c]);
  assert.equal(res.duplicateCount, 1);
  assert.equal(res.duplicates[0], b, "le doublon rendu est la ligne d'origine, retrouvable par l'appelant");
  assert.equal(res.newRows[0][LIGNE_SOURCE], a);
  assert.equal(JSON.stringify(res.newRows[0]).includes("LIGNE_SOURCE"), false, "la reference ne part jamais en base");
});

test("L'insertion rend chaque ligne refusee avec son motif, pas seulement un compteur", async () => {
  const ecrites = [];
  const base44 = { entities: { Order: {
    bulkCreate: async (rs) => { if (rs.some((r) => r.bad)) throw new Error("validation"); ecrites.push(...rs); },
    create: async (r) => { if (r.bad) throw new Error("champ invalide"); ecrites.push(r); },
  } } };
  const rows = [{ order_id: "1" }, { order_id: "2", bad: true }, { order_id: "3" }];
  const res = await insertRows(base44, "Order", rows);
  assert.equal(res.created, 2);
  assert.equal(res.failed.length, 1);
  assert.equal(res.failed[0].row.order_id, "2");
  assert.equal(res.failed[0].reason, "STORAGE_REJECTED");
});
