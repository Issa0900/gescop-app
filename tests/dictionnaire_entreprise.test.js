// Dictionnaire de l'entreprise (lot 6, 24 sept. 2026) :
//  - aucun terme d'exemple n'est enregistré ni imposé à l'import ;
//  - un terme ajouté dans Paramètres est réellement appliqué par l'import ;
//  - l'apprentissage à l'import n'efface pas un dictionnaire existant.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {
  lireDictionnaire, versEnregistrement, ajouterTermes, contientExemplesAvant, retirerExemplesAvant, EXEMPLES_ENREGISTRES_AVANT,
} from "../src/lib/dictionnaire.js";
import { buildCompanyDictionaryIndex, cleCanonique } from "../base44/shared/importUtils.ts";

test("Paramètres n'enregistre plus de dictionnaire d'exemple d'office", () => {
  const src = fs.readFileSync(new URL("../src/pages/Parametres.jsx", import.meta.url), "utf8");
  assert.ok(!/company_dictionary:\s*company\.company_dictionary\s*\|\|\s*\[/.test(src), "valeur par défaut remplie");
  assert.ok(!src.includes("Profit Brut ($)"), "exemple encore présent dans Paramètres");
  const panneau = fs.readFileSync(new URL("../src/components/settings/DictionaryPanel.jsx", import.meta.url), "utf8");
  assert.ok(!panneau.includes("DEFAULT_TERMS"), "termes par défaut encore affichés comme données");
});

test("un terme ajouté dans Paramètres (forme liste) est appliqué par l'import", () => {
  const enregistre = versEnregistrement([...lireDictionnaire(null), { term: "Mtt encaissé", maps_to: "amount" }]);
  assert.deepEqual(enregistre, [{ term: "Mtt encaissé", maps_to: "amount", description: "" }]);
  const index = buildCompanyDictionaryIndex(enregistre);
  assert.equal(index[cleCanonique("Mtt encaissé")], "amount");
});

test("les termes déjà enregistrés avec `concept` (avant le lot 6) sont enfin appliqués", () => {
  const index = buildCompanyDictionaryIndex([{ term: "Réf Client", concept: "customer_id" }]);
  assert.equal(index[cleCanonique("Réf Client")], "customer_id");
});

test("apprentissage à l'import : une forme liste est complétée, pas remplacée", () => {
  const avant = [{ term: "Mtt encaissé", maps_to: "amount", description: "saisi à la main" }];
  const apres = ajouterTermes(avant, { "No Client": "customer_id" });
  assert.deepEqual(apres.map((x) => [x.term, x.maps_to]), [["Mtt encaissé", "amount"], ["No Client", "customer_id"]]);
  assert.equal(apres[0].description, "saisi à la main");
  assert.equal(ajouterTermes(apres, { "no client": "customer_id" }), null, "rien de nouveau : pas d'écriture");
});

test("apprentissage à l'import : la forme objet reste un objet", () => {
  assert.deepEqual(ajouterTermes({ A: "amount" }, { B: "date" }), { A: "amount", B: "date" });
  assert.deepEqual(ajouterTermes(null, { B: "date" }), { B: "date" });
  assert.equal(ajouterTermes({ A: "amount" }, { A: "amount" }), null);
});

test("les 5 exemples enregistrés d'office sont détectés et retirables sans toucher au reste", () => {
  const dico = [...EXEMPLES_ENREGISTRES_AVANT, { term: "Mtt encaissé", maps_to: "amount" }];
  assert.equal(contientExemplesAvant(dico), true);
  assert.deepEqual(retirerExemplesAvant(dico).map((x) => x.term), ["Mtt encaissé"]);
  // Un seul exemple choisi par l'entreprise n'est pas signalé.
  assert.equal(contientExemplesAvant([{ term: "Succursale", maps_to: "location_id" }]), false);
  // Même terme, autre champ : ce n'est plus l'exemple, il reste.
  assert.equal(contientExemplesAvant([...EXEMPLES_ENREGISTRES_AVANT.slice(1), { term: "Succursale", maps_to: "store" }]), false);
});
