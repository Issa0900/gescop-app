// Import (lot 5 du rapport du 25 sept. 2026) : ne pas rejeter en bloc, dire ce
// qui manque avant l'import, et une mémoire qui ne casse plus la reconnaissance.
import test from "node:test";
import assert from "node:assert/strict";
import { classerEntites, choisirEntite, typeIncomplet } from "../base44/shared/core/recognition/preuves.ts";
import { memoireDepuisPlans } from "../base44/shared/importPlan.ts";
import { recognizeAllColumns } from "../base44/shared/core/contextualRecognition.ts";
import { coerceEnumDetail, deriveFallbackIdentity } from "../base44/shared/importUtils.ts";
import { getSchema } from "../base44/shared/entitySchemas.ts";

const choisir = (h, f) => choisirEntite(classerEntites(h, f, {})).entite;

test("un identifiant que l'import sait déduire ne rend plus le type inéligible", () => {
  assert.equal(choisir(["nom_actif", "categorie", "date_acquisition", "valeur_acquisition", "duree_vie_utile_annees", "valeur_residuelle", "methode_amortissement", "succursale"], "10_immobilisations.csv"), "Asset");
  assert.equal(choisir(["nom_fournisseur", "categorie_produits", "ville", "contact", "conditions_paiement"], "08_fournisseurs.csv"), "Supplier");
  assert.equal(choisir(["id_concurrent", "nom_concurrent", "zone", "positionnement"], "15_concurrents_v2.csv"), "Competitor");
});

test("un type faible ne remplace pas un type nettement plus plausible mais incomplet", () => {
  // Aucune colonne d'indicateur : Goal reste incomplet, et ni Asset ni
  // Supplier (eligibles mais faibles) ne prennent sa place.
  const h = ["libelle", "categorie", "cible", "valeur_actuelle", "echeance"];
  assert.equal(choisir(h, "16_objectifs.csv"), null, "pas des immobilisations");
  assert.deepEqual(typeIncomplet(h, "16_objectifs.csv", {}), { entite: "Goal", manquants: ["metric"] });
  // « nom_objectif » est l'indicateur de l'objectif (lexique, 25 sept.) : la
  // feuille est alors complete et importee comme objectifs.
  assert.equal(choisir(["nom_objectif", "categorie", "cible", "valeur_actuelle", "echeance"], "16_objectifs.csv"), "Goal");
});

test("identifiant fournisseur / concurrent déduit du nom (AUTO-), jamais inventé sans nom", () => {
  const f = { supplier_name: "PleinAir Dist. Inc." };
  deriveFallbackIdentity("Supplier", f, 0);
  assert.match(f.supplier_id, /^AUTO-PleinAir/);
  const c = { name: "EcoMaison Québec" };
  deriveFallbackIdentity("Competitor", c, 0);
  assert.match(c.competitor_id, /^AUTO-EcoMaison/);
});

test("familles de signaux en anglais comprises (regulatory, economic, market, competitive)", () => {
  const en = getSchema("ExternalSignal").properties.family.enum;
  assert.equal(coerceEnumDetail("regulatory", en).value, "gouvernement");
  assert.equal(coerceEnumDetail("regulation", en).value, "gouvernement");
  assert.equal(coerceEnumDetail("economic", en).value, "economie");
  assert.equal(coerceEnumDetail("market", en).value, "marche");
  assert.equal(coerceEnumDetail("competitive", en).value, "concurrence");
});

test("mémoire : seules les corrections humaines sont apprises, un plan mal formé est ignoré", () => {
  const m = memoireDepuisPlans([
    { entite: "Order", colonnes: [{ colonne: "Réf Vente", champ: "order_id", source: "humain" }, { colonne: "Date", champ: "date", source: "schema" }] },
    null, { colonnes: "pas une liste" },
  ]);
  assert.equal(m.length, 1);
  assert.equal(m[0].columnName, "refvente");
  assert.equal(m[0].resolvedCanonicalKey, "order_id");
});

test("une mémoire mal formée ne fait plus tomber la reconnaissance sémantique", () => {
  // Ce qu'on lui passait avant : des plans bruts (pas de columnName).
  const brut = [{ entite: "Customer", colonnes: [{ colonne: "nom", champ: "name" }] }];
  const r = recognizeAllColumns({ sheetName: "commandes", headers: ["client", "montant_total"], sampleRows: [{ client: "Olivier Caron", montant_total: 12 }], mappingMemory: brut });
  assert.ok(r instanceof Map && r.size > 0);
});
