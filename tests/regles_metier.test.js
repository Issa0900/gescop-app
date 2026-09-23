// Deux regles metier decidees le 22 sept 2026 :
//  1. une ligne strictement identique a une autre, sans identifiant pour prouver
//     le doublon, est conservee et signalee — jamais supprimee d'office ;
//  2. la date d'import n'est jamais presentee comme la date d'un inventaire.
import test from "node:test";
import assert from "node:assert/strict";
import { deduplicateRows } from "../base44/shared/deduplication.ts";
import { empreinteForte } from "../base44/shared/fingerprint.ts";
import { normalizeRow } from "../base44/shared/importUtils.ts";
import { getSchema } from "../base44/shared/entitySchemas.ts";
import { latestByKey, dateReferenceInventaire } from "../src/lib/periods.js";

const base = (lignes = []) => {
  const table = [...lignes];
  return { table, client: { entities: new Proxy({}, { get: () => ({ list: async (_s, l, o) => table.slice(o, o + l) }) }) } };
};

test("Deux ventes identiques sans identifiant : conservees toutes les deux, la repetition est signalee", async () => {
  const pain = { date: "2026-09-20", amount: 47.5, type: "income", description: "Pain x10" };
  const { client } = base();
  const res = await deduplicateRows(client, "Transaction", [{ ...pain }, { ...pain }]);
  assert.equal(res.newCount, 2);
  assert.equal(res.duplicateCount, 0);
  assert.equal(res.potentialDuplicates.length, 1);
});

test("Un identifiant metier repete prouve le doublon : exclu", async () => {
  const { client } = base();
  const cmd = { order_id: "C-1", product_id: "P-1", date: "2026-09-20" };
  const res = await deduplicateRows(client, "Order", [{ ...cmd }, { ...cmd }]);
  assert.equal(res.newCount, 1);
  assert.equal(res.duplicateCount, 1);
  assert.equal(res.potentialDuplicates.length, 0);
});

test("Un identifiant technique AUTO- ne prouve rien : lignes identiques conservees et signalees", async () => {
  assert.equal(empreinteForte("Order", { order_id: "AUTO-X1" }), false);
  assert.equal(empreinteForte("Order", { order_id: "V-10001" }), true);
  const { client } = base();
  const vente = { order_id: "AUTO-X1", date: "2026-09-20", quantity: 1, original_data: "{}" };
  const res = await deduplicateRows(client, "Order", [{ ...vente }, { ...vente }]);
  assert.equal(res.newCount, 2);
  assert.equal(res.potentialDuplicates.length, 1);
});

test("Reimport : seules les occurrences deja en base sont exclues", async () => {
  const pain = { date: "2026-09-20", amount: 47.5, type: "income", description: "Pain x10" };
  const { client } = base([{ ...pain }]);
  const res = await deduplicateRows(client, "Transaction", [{ ...pain }, { ...pain }]);
  assert.equal(res.duplicateCount, 1, "la 1re est deja en base");
  assert.equal(res.newCount, 1, "la 2e est une vente de plus");
});

test("Inventaire sans date : date vide, date d'import gardee a part comme reference technique", () => {
  const props = getSchema("Inventory").properties;
  const trace = { replis: [], derives: [] };
  const aujourdhui = new Date().toISOString().slice(0, 10);
  const r = normalizeRow("Inventory", { SKU: "CAM-T004", "Qté en Stock": 45 }, "i", props, "xlsx", [], undefined, undefined, trace);
  assert.equal(r.date, undefined, "la date d'import n'est jamais la date d'inventaire");
  assert.equal(r.import_date, aujourdhui);
  assert.equal(r.reference_date, aujourdhui);
  assert.equal(r.reference_date_type, "IMPORT_DATE");
  assert.equal(trace.derives[0].field, "reference_date");
});

test("Inventaire date : la date du fichier est la reference", () => {
  const props = getSchema("Inventory").properties;
  const r = normalizeRow("Inventory", { SKU: "CAM-T004", Date: "2026-08-31", "Qté en Stock": 45 }, "i", props);
  assert.equal(r.date, "2026-08-31");
  assert.equal(r.reference_date, "2026-08-31");
  assert.equal(r.reference_date_type, "INVENTORY_DATE");
});

test("Affichage : un inventaire recent non date l'emporte sur un vieil inventaire date, via sa date de reference", () => {
  const vieux = { product_id: "P", date: "2026-01-31", closing_stock: 10 };
  const recent = { product_id: "P", reference_date: "2026-09-22", reference_date_type: "IMPORT_DATE", closing_stock: 4 };
  assert.equal(latestByKey([vieux, recent], "product_id", dateReferenceInventaire)[0].closing_stock, 4);
  assert.equal(latestByKey([vieux, recent], "product_id", "date")[0].closing_stock, 10, "l'appel historique par nom de champ reste inchange");
});

// Paie : l'identifiant de ligne prime ; une cle composee (employe + periode)
// contredite par le fichier n'exclut rien (audit du 23 sept 2026 : 16 fiches
// sur 500 ecartees a tort comme conflits dans Xplorer_500).
test("Paie : deux fiches du meme employe le meme mois, payroll_id distincts -> les deux gardees", async () => {
  const { deduplicateRows } = await import("../base44/shared/deduplication.ts");
  const base = { entities: { Payroll: { list: async () => [] } } };
  const rows = [
    { payroll_id: "PAY-1", employee_id: "E1", period: "2026-01", total_cost: 3000 },
    { payroll_id: "PAY-2", employee_id: "E1", period: "2026-01", total_cost: 500 },
  ];
  const r = await deduplicateRows(base, "Payroll", rows);
  assert.equal(r.newRows.length, 2);
  assert.equal(r.conflicts, 0);
});

test("Paie sans identifiant : employe + periode contredit par le fichier -> gardees, repetition identique signalee", async () => {
  const { deduplicateRows } = await import("../base44/shared/deduplication.ts");
  const base = { entities: { Payroll: { list: async () => [] } } };
  const rows = [
    { employee_id: "E1", period: "2026-01", total_cost: 3000 },
    { employee_id: "E1", period: "2026-01", total_cost: 500 },
    { employee_id: "E1", period: "2026-01", total_cost: 500 },
  ];
  const r = await deduplicateRows(base, "Payroll", rows);
  assert.equal(r.newRows.length, 3);
  assert.equal(r.conflicts, 0);
  assert.equal(r.potentialDuplicates.length, 1);
  // Reimport du meme fichier : rien n'est double.
  const enBase = r.newRows.map((x) => ({ ...x }));
  const base2 = { entities: { Payroll: { list: async (_t, _n, debut) => (debut === 0 ? enBase : []) } } };
  const r2 = await deduplicateRows(base2, "Payroll", rows);
  assert.equal(r2.newRows.length, 0);
  assert.equal(r2.duplicateCount, 3);
});

test("Paie sans identifiant, cle non contredite : meme employe + periode + autres valeurs -> conflit", async () => {
  const { deduplicateRows } = await import("../base44/shared/deduplication.ts");
  const enBase = [{ employee_id: "E1", period: "2026-01", total_cost: 3000 }];
  const base = { entities: { Payroll: { list: async (_t, _n, debut) => (debut === 0 ? enBase : []) } } };
  const r = await deduplicateRows(base, "Payroll", [{ employee_id: "E1", period: "2026-01", total_cost: 3100 }]);
  assert.equal(r.conflicts, 1);
});

test("Un conflit reste recuperable : « Retraiter » le relit avec la regle d'identification actuelle", async () => {
  const { recoveryInitial, REASON, RECOVERY } = await import("../base44/shared/importStatus.ts");
  assert.equal(recoveryInitial(REASON.CONFLICTING_RECORD), RECOVERY.PENDING);
});
