// Import de tous les modules de l'app (jeux générés du 25 sept. 2026) : veille,
// objectifs, interactions, produits et achats avaient des en-têtes courants
// que le lexique ne connaissait pas.
import test from "node:test";
import assert from "node:assert/strict";
import { classerEntites, choisirEntite } from "../base44/shared/core/recognition/preuves.ts";
import { champParLexique } from "../base44/shared/registry/lexiqueChamps.ts";
import { planParRegles } from "../base44/shared/importPlan.ts";
import { normalizeRow, coerceEnumDetail } from "../base44/shared/importUtils.ts";
import { getSchema } from "../base44/shared/entitySchemas.ts";

const champ = (e, h, autres = []) => champParLexique(e, h, [h, ...autres]);

test("veille : titre, famille et impact sont reconnus", () => {
  const h = ["Titre", "Famille", "Impact", "Date"];
  assert.equal(champ("ExternalSignal", "Titre", h), "title");
  assert.equal(champ("ExternalSignal", "Famille", h), "family");
  assert.equal(champ("ExternalSignal", "Category", h), "family");
  assert.equal(champ("ExternalSignal", "Impact", h), "impact");
});

test("objectifs : indicateur, cible, domaine et priorité sont reconnus", () => {
  const h = ["No", "Domaine", "Indicateur", "Cible", "Priorité"];
  assert.equal(champ("Goal", "Indicateur", h), "metric");
  assert.equal(champ("Goal", "Cible", h), "target");
  assert.equal(champ("Goal", "Domaine", h), "domain");
  assert.equal(champ("Goal", "Priorité", h), "priority");
  assert.equal(champ("Goal", "No", h), "goal_id");
  assert.equal(champ("Goal", "Goal ID", ["Metric"]), "goal_id");
});

test("interactions : ticket, date d'ouverture, canal, sentiment", () => {
  const h = ["Ticket ID", "Opened", "Customer ID", "Channel", "Sentiment", "Subject"];
  assert.equal(champ("Interaction", "Ticket ID", h), "interaction_id");
  assert.equal(champ("Interaction", "Opened", h), "date");
  assert.equal(champ("Interaction", "Channel", h), "channel");
  assert.equal(champ("Interaction", "Sentiment", h), "sentiment");
  assert.equal(choisirEntite(classerEntites(h, "Support Tickets", {})).entite, "Interaction");
});

test("canaux et familles en anglais sont traduits vers les listes de l'app", () => {
  const enumDe = (e, c) => getSchema(e).properties[c].enum;
  assert.equal(coerceEnumDetail("Phone", enumDe("Interaction", "channel")).value, "telephone");
  assert.equal(coerceEnumDetail("Negative", enumDe("Interaction", "sentiment")).value, "negatif");
  assert.equal(coerceEnumDetail("Suppliers", enumDe("ExternalSignal", "family")).value, "fournisseurs");
  assert.equal(coerceEnumDetail("Économie", enumDe("ExternalSignal", "family")).value, "economie");
});

test("produit : la famille ou le rayon est la catégorie", () => {
  assert.equal(champ("Product", "Famille", ["Code produit", "Désignation", "Prix de vente"]), "category");
  assert.equal(champ("Product", "Department", ["SKU", "Product"]), "category");
  assert.equal(champ("Product", "Sous-famille", ["Famille"]), "subcategory");
});

test("achat : coût total = quantité × coût unitaire quand il manque, jamais écrasé", () => {
  const a = normalizeRow("Purchase", { purchase_id: "PO-1", date: "2026-05-01", supplier_id: "S1", quantity: "12", unit_cost: "2.5" });
  assert.equal(a.total_cost, 30);
  const b = normalizeRow("Purchase", { purchase_id: "PO-2", date: "2026-05-01", supplier_id: "S1", quantity: "12", unit_cost: "2.5", total_cost: "31" });
  assert.equal(b.total_cost, 31);
});

test("un type nettement plus plausible mais incomplet n'est pas remplacé par une détection historique", () => {
  // Tickets sans date lisible : Interaction est incomplet ; la feuille ne doit
  // pas devenir des Clients (elle créait de faux clients).
  const matrix = [["Ticket ID", "Heure", "Customer ID", "Channel", "Sentiment", "Subject"], ["T-1", "x", "C-1", "Email", "Positive", "Bug"]];
  const plan = planParRegles(matrix, "Support Tickets");
  assert.notEqual(plan.entite, "Customer");
});

test("achat : une colonne « Fournisseur » seule est le fournisseur de l'achat", () => {
  const h = ["No achat", "Date", "Fournisseur", "Quantité", "Coût unitaire", "Coût total", "Statut"];
  assert.equal(champ("Purchase", "Fournisseur", h), "supplier_id");
  assert.equal(choisirEntite(classerEntites(h, "achats.csv", {})).entite, "Purchase");
});

test("petite feuille : un type qui accueille toutes les colonnes l'emporte sur un type qui en accueille la moitié", async () => {
  const { typeNettementMeilleur } = await import("../base44/shared/importPlan.ts");
  assert.equal(typeNettementMeilleur(4, 2, 4), true);
  assert.equal(typeNettementMeilleur(4, 3, 4), false, "écart d'une colonne : on garde le premier choix");
  assert.equal(typeNettementMeilleur(2, 1, 2), false, "feuille de 2 colonnes : trop peu de preuves");
  assert.equal(typeNettementMeilleur(9, 5, 12), true);
  assert.equal(typeNettementMeilleur(7, 5, 12), false);
});
