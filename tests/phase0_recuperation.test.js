// Phase 0 du moteur de reconnaissance : ne plus perdre ni inventer de donnees.
// Le banc tests/banc/ mesure l'effet sur un corpus complet ; ces tests
// verrouillent chaque comportement unitairement.
import test from "node:test";
import assert from "node:assert/strict";
import {
  normalizeRow, isSummaryOrTotalRow, coerceEnumDetail, LIGNE_BRUTE,
} from "../base44/shared/importUtils.ts";
import { getSchema } from "../base44/shared/entitySchemas.ts";

const nouvelleTrace = () => ({ replis: [], derives: [] });

test("Une valeur « Moyenne » hors premiere colonne n'est pas une ligne de total", () => {
  const vente = { order_id: "T-2", date: "2026-07-01", product_name: "Chandail", taille: "Moyenne", quantity: 1 };
  assert.equal(isSummaryOrTotalRow(vente), false);
  const sansClientNiDate = { product_name: "Chandail", taille: "Moyenne", quantity: 1 };
  assert.equal(isSummaryOrTotalRow(sansClientNiDate), false);
});

test("Un libelle de total en premiere valeur, avec des cellules vides, reste une ligne de total", () => {
  assert.equal(isSummaryOrTotalRow({ date: "Sous-total", amount: "1500", type: "", category: "", description: "" }), true);
  assert.equal(isSummaryOrTotalRow({ date: "TOTAL", amount: "1700", type: "", category: "", description: "" }), true);
});

test("Ligne TOTAL entierement remplie d'un tableau de synthese : reconnue (libelle sans autre sens)", () => {
  assert.equal(isSummaryOrTotalRow({ Succursale: "TOTAL", "Total Ventes": "814000", "Coût Total ($)": "488400" }), true);
  assert.equal(isSummaryOrTotalRow({ Taille: "Moyenne", Ventes: "40", Stock: "12" }), false, "« Moyenne » seule, ligne pleine : une vraie valeur");
});

test("Commande sans numero : identifiant technique distinct par ligne, stable au reimport, trace", () => {
  const props = getSchema("Order").properties;
  const trace = nouvelleTrace();
  const a = normalizeRow("Order", { Date: "2026-06-01", Succursale: "Laval", Produit: "Tente" }, "i", props, "xlsx", [], undefined, undefined, trace);
  const b = normalizeRow("Order", { Date: "2026-06-01", Succursale: "Laval", Produit: "Sac" }, "i", props, "xlsx", [], undefined, undefined, trace);
  const a2 = normalizeRow("Order", { Date: "2026-06-01", Succursale: "Laval", Produit: "Tente" }, "autre-import", props);
  assert.match(a.order_id, /^AUTO-/);
  assert.notEqual(a.order_id, b.order_id, "deux ventes differentes de la meme succursale ne partagent plus un numero");
  assert.equal(a.order_id, a2.order_id, "la meme ligne reimportee garde le meme identifiant (deduplication)");
  assert.equal(trace.derives.length, 2);
});

test("Commande sans date : aucune date du jour inventee", () => {
  const props = getSchema("Order").properties;
  const o = normalizeRow("Order", { "No commande": "S-1", Produit: "Tente", "Prix unitaire": 450 }, "i", props);
  assert.equal(o.date, undefined, "la ligne doit partir en quarantaine pour date manquante");
});

test("Commande sans quantite : aucun chiffre d'affaires deduit d'une quantite supposee", () => {
  const props = getSchema("Order").properties;
  const o = normalizeRow("Order", { "No commande": "S-1", Date: "2026-06-01", "Prix unitaire": 450 }, "i", props);
  assert.equal(o.total_revenue, undefined);
  const avecQte = normalizeRow("Order", { "No commande": "S-2", Date: "2026-06-01", Quantité: 2, "Prix unitaire": 450 }, "i", props);
  assert.equal(avecQte.total_revenue, 900);
});

test("Enum : un repli sur « autre » est distingue d'une vraie reconnaissance", () => {
  const canaux = getSchema("Order").properties.channel.enum;
  assert.deepEqual(coerceEnumDetail("TikTok Shop", canaux), { value: "autre", repli: true });
  assert.deepEqual(coerceEnumDetail("Autre", canaux), { value: "autre", repli: false });
  assert.deepEqual(coerceEnumDetail("Shopify", canaux), { value: "shopify", repli: false });
});

test("Employe : departement traduit sur sa valeur, jamais devine du role ni deplace en lieu", () => {
  const props = getSchema("Employee").properties;
  const trace = nouvelleTrace();
  const e1 = normalizeRow("Employee", { employee_id: "E1", department: "Comptabilité", role: "Directrice financière" }, "i", props, "xlsx", [], undefined, undefined, trace);
  assert.equal(e1.department, "administration");
  assert.equal(e1.location, undefined);
  const e2 = normalizeRow("Employee", { employee_id: "E2", department: "Recherche", role: "Chercheur" }, "i", props, "xlsx", [], undefined, undefined, trace);
  assert.equal(e2.department, "autre");
  assert.deepEqual(trace.replis, [{ field: "department", value: "Recherche" }]);
});

test("Nom complet d'un client : conserve et reparti, y compris au format « Nom, Prénom »", () => {
  const props = getSchema("Customer").properties;
  const a = normalizeRow("Customer", { "ID Client": "C-1", "Nom Complet": "Leblanc, Julie" }, "i", props);
  assert.deepEqual([a.first_name, a.last_name], ["Julie", "Leblanc"]);
  const b = normalizeRow("Customer", { "ID Client": "C-2", "Nom": "Marc Roy" }, "i", props);
  assert.deepEqual([b.first_name, b.last_name], ["Marc", "Roy"]);
});

test("original_data garde les colonnes que le plan a retirees de la ligne", () => {
  const props = getSchema("Order").properties;
  const ligne = { order_id: "I-1", date: "2026-08-01" };
  Object.defineProperty(ligne, LIGNE_BRUTE, { value: { "No commande": "I-1", Date: "2026-08-01", "Code interne": "Z-77" }, enumerable: false });
  const o = normalizeRow("Order", ligne, "i", props);
  assert.equal(JSON.parse(o.original_data)["Code interne"], "Z-77");
});
