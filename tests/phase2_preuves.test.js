// Phase 2 : reconnaissance par ensemble de preuves. Le type d'une feuille et le
// champ d'une colonne se decident sur des preuves observees et montrables, pas
// sur un seul indice.
import test from "node:test";
import assert from "node:assert/strict";
import { classerEntites, choisirEntite, evaluerColonnes, dimensionPotentielle } from "../base44/shared/core/recognition/preuves.ts";

const VENTES = ["ID Transaction", "Date", "ID Client", "Client", "Code Produit", "Description Produit", "Catégorie",
  "Quantité", "Prix Unitaire ($)", "Coût Unitaire ($)", "Montant Total ($)", "ID Employé", "Employé", "Succursale", "Mode de Paiement"];

test("Une feuille de ventes n'est plus prise pour une liste de clients parce qu'elle contient « ID Client »", () => {
  const classement = classerEntites(VENTES, "Nordik.xlsx [Ventes (1200+)]");
  assert.equal(choisirEntite(classement).entite, "Order");
  const order = classement.find((c) => c.entite === "Order");
  assert.ok(order.preuves.some((p) => p.detail.includes("colonnes correspondent")), "la couverture des colonnes est une preuve citee");
});

test("Le type est choisi sur les colonnes, meme sans nom evocateur", () => {
  assert.equal(choisirEntite(classerEntites(VENTES, "export_2026.xlsx [Feuil1]")).entite, "Order");
});

test("Deux types presque aussi plausibles : le choix est signale, pas tranche en silence", () => {
  const choix = choisirEntite([
    { entite: "A", score: 50, eligible: true, preuves: [], manquants: [] },
    { entite: "B", score: 45, eligible: true, preuves: [], manquants: [] },
  ]);
  assert.deepEqual(choix, { entite: "A", ambigue: true, rivale: "B" });
});

test("« ID Client » et « Client » : le code va a customer_id, le nom a customer_name", () => {
  const valeurs = { "ID Client": ["C-881", "C-882", "C-881"], "Client": ["Leblanc, Gabriel", "Roy, Julie", "Leblanc, Gabriel"] };
  const res = evaluerColonnes("Order",
    [{ colonne: "ID Client", champ: "customer_id", source: "reconnaissance" }, { colonne: "Client", champ: "customer_id", source: "reconnaissance" }],
    (c) => valeurs[c]);
  assert.equal(res.colonnes[0].champ, "customer_id");
  assert.equal(res.colonnes[1].champ, "customer_name");
  assert.ok(res.corrections[0].includes("customer_name"));
});

test("Une colonne perdante rejoint son propre synonyme s'il est libre (Profit Brut -> gross_profit)", () => {
  const res = evaluerColonnes("Order",
    [{ colonne: "Marge Brute %", champ: "gross_margin", source: "alias" }, { colonne: "Profit Brut ($)", champ: "gross_margin", source: "reconnaissance" }],
    () => [10, 20, 30]);
  assert.equal(res.colonnes[1].champ, "gross_profit");
});

test("Egalite parfaite : retenue par ordre du fichier, mais plafonnee a PROBABLE et signalee", () => {
  const res = evaluerColonnes("Inventory",
    [{ colonne: "Valeur Stock Coût ($)", champ: "inventory_value", source: "alias" }, { colonne: "Valeur Stock Vente ($)", champ: "inventory_value", source: "alias" }],
    () => [9450, 1440]);
  assert.equal(res.colonnes[0].champ, "inventory_value");
  assert.equal(res.colonnes[1].champ, null);
  assert.equal(res.evaluations[0].statut, "PROBABLE");
  assert.equal(res.evaluations[1].statut, "AMBIGUOUS");
  assert.ok(res.corrections.some((c) => c.includes("à confirmer")));
});

test("Un nombre contredit par ses valeurs n'est pas force : colonne ambigue, non rattachee", () => {
  const res = evaluerColonnes("Order", [{ colonne: "Qté", champ: "quantity", source: "reconnaissance" }], () => ["beaucoup", "peu", "aucun"]);
  assert.equal(res.colonnes[0].champ, null);
  assert.equal(res.evaluations[0].statut, "AMBIGUOUS");
});

test("Des valeurs hors liste ne font pas perdre une colonne d'enum (le repli est signale ailleurs)", () => {
  const res = evaluerColonnes("Order", [{ colonne: "Canal", champ: "channel", source: "alias" }], () => ["TikTok Shop"]);
  assert.equal(res.colonnes[0].champ, "channel");
});

test("Un rattachement humain n'est jamais rediscute", () => {
  const res = evaluerColonnes("Order", [{ colonne: "Qté", champ: "quantity", source: "humain" }], () => ["beaucoup", "peu", "aucun"]);
  assert.equal(res.colonnes[0].champ, "quantity");
  assert.equal(res.evaluations[0].statut, "CONFIRMED");
});

test("Dimension potentielle : texte qui se repete, pas un identifiant unique ni un nombre", () => {
  assert.ok(dimensionPotentielle(["Web", "Magasin", "Web", "Web"]));
  assert.ok(dimensionPotentielle(["AUT26", "AUT26"]));
  assert.equal(dimensionPotentielle(["A-001", "A-002", "A-003"]), null);
  assert.equal(dimensionPotentielle(["12", "15", "12"]), null);
});
