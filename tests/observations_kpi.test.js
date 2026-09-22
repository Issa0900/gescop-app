// Pipeline Observation (22 sept 2026) :
//  - le rapprochement colonne -> concept se fait mot a mot (les mots-cles de
//    plusieurs mots correspondent enfin, « ca » ne se trouve plus dans « cash ») ;
//  - une quantite, un prix ou une unite non monetaire n'est jamais un montant ;
//  - une Observation ne remplace jamais une mesure qu'une entite declare.
import test from "node:test";
import assert from "node:assert/strict";
import { matchConcept } from "../base44/shared/semanticMatcher.ts";
import { computeKpiBatch, computeKpi } from "../src/lib/core/kpiEngine.js";
import { getEntitySemantics } from "../src/lib/core/entityFieldMap.js";

const concept = (nom, type = "currency") => matchConcept({ columnName: nom, inferredType: type })?.concept ?? null;

test("Mots-cles de plusieurs mots et intitules composes : reconnus", () => {
  assert.equal(concept("Chiffre d'affaires"), "finance.revenue");
  assert.equal(concept("CA HT"), "finance.revenue");
  assert.equal(concept("Montant des ventes", "decimal"), "finance.revenue");
  assert.equal(concept("Coût des marchandises vendues"), "finance.cogs");
  assert.equal(concept("total_revenue", "decimal"), "finance.revenue");
  assert.equal(concept("spend", "decimal"), "marketing.spend");
});

test("Faux positifs supprimes : un mot contenu dans un autre, une quantite, un prix, des points", () => {
  assert.equal(concept("cash_in", "decimal"), "treasury.cashIn", "« ca » n'est pas dans « cash » : un encaissement, pas du chiffre d'affaires");
  assert.equal(concept("categorie", "string"), null);
  assert.equal(concept("Ventes (unités)", "integer"), null, "une quantite vendue n'est pas un chiffre d'affaires");
  assert.equal(concept("Prix_Vente_CAD", "decimal"), null, "un prix de vente n'est pas un chiffre d'affaires");
  assert.equal(concept("Solde_Points_Fidelite", "integer"), null, "un solde de points n'est pas une tresorerie");
});

function kpi(data, ids) {
  const recs = [];
  const sem = new Map();
  for (const [e, rs] of Object.entries(data)) {
    if (e === "observations") continue;
    recs.push(...rs.map((r) => ({ ...r, _entity: e })));
    getEntitySemantics(e)?.forEach((v, k) => sem.set(`${e}:${k}`, v));
  }
  recs.push(...(data.observations || []));
  return Object.fromEntries([...computeKpiBatch(ids, recs, sem)].map(([k, v]) => [k, v.value]));
}

const COMMANDES = [
  { order_id: "A-1", date: "2026-08-02", total: 4000, total_revenue: 4000 },
  { order_id: "A-2", date: "2026-08-10", total: 6000, total_revenue: 6000 },
];
const OBS_CAMPAGNE = { observation_type: "quantitative", concept: "finance.revenue", value: 1200, source_id: "campagnes.xlsx" };

test("Une observation ne remplace plus le chiffre d'affaires des commandes", () => {
  assert.equal(kpi({ Order: COMMANDES }, ["total_revenue"]).total_revenue, 10000);
  assert.equal(kpi({ Order: COMMANDES, observations: [OBS_CAMPAGNE] }, ["total_revenue"]).total_revenue, 10000,
    "avant : 1 200 $ (le revenu attribue d'une campagne remplacait 10 000 $ de commandes)");
});

test("Commandes sans montant : chiffre d'affaires non mesure, pas une somme d'observations", () => {
  const sansMontant = COMMANDES.map(({ order_id, date }) => ({ order_id, date }));
  assert.equal(kpi({ Order: sansMontant, observations: [OBS_CAMPAGNE] }, ["total_revenue"]).total_revenue, null);
});

test("Une mesure qu'aucune entite ne declare reste lisible depuis les observations", () => {
  const r = computeKpi({
    kpiId: "mesure_hors_entites",
    records: [{ observation_type: "quantitative", concept: "finance.mesure_hors_entites", value: 5 }, { observation_type: "quantitative", concept: "finance.mesure_hors_entites", value: 7 }],
    fieldSemantics: new Map(),
  });
  assert.equal(r.value, 12);
});

// ── Registre enrichi (22 sept 2026) ─────────────────────────────────────────
import { CONCEPTS } from "../base44/shared/registry/conceptRegistry.ts";
import { ENTITY_SCHEMAS } from "../base44/shared/entitySchemas.ts";

const AJOUTS = ["sales.quantity", "sales.unitPrice", "finance.unitCost", "sales.discount", "sales.tax", "finance.grossProfit",
  "inventory.closingStock", "inventory.openingStock", "inventory.value", "inventory.unitsSold", "inventory.purchases",
  "treasury.cashIn", "treasury.cashOut", "treasury.netCashFlow", "marketing.clicks", "marketing.impressions",
  "marketing.conversions", "customer.lifetimeValue", "customer.totalOrders", "hr.hourlyRate", "hr.annualSalary"];

test("Chaque concept ajoute au registre vise un vrai champ d'entite", () => {
  const champs = new Set(Object.values(ENTITY_SCHEMAS).flatMap((s) => Object.keys(s.properties)));
  for (const id of AJOUTS) {
    assert.ok(CONCEPTS[id], `${id} present`);
    assert.ok(champs.has(CONCEPTS[id].canonicalKey), `${id} -> ${CONCEPTS[id].canonicalKey} est un champ`);
  }
});

test("Les champs d'entite sont reconnus, meme ceux dont le nom n'a pas pu entrer dans le lexique", () => {
  assert.equal(concept("quantity", "integer"), "sales.quantity");
  assert.equal(concept("unit_price", "decimal"), "sales.unitPrice");
  assert.equal(concept("closing_stock", "integer"), "inventory.closingStock");
  assert.equal(concept("hourly_rate", "decimal"), "hr.hourlyRate");
});

test("Intitules reels reconnus, sans capter les colonnes voisines", () => {
  assert.equal(concept("Prix Unitaire ($)", "decimal"), "sales.unitPrice", "un prix unitaire EST un prix");
  assert.equal(concept("Taux horaire", "decimal"), "hr.hourlyRate", "un taux horaire EST un taux");
  assert.equal(concept("Remise_Ligne", "decimal"), "sales.discount");
  assert.equal(concept("Salaire_Base_Annuel_CAD", "decimal"), "hr.annualSalary");
  assert.equal(concept("Quantite_Reservee", "integer"), null, "stock reserve : pas une quantite vendue");
  assert.equal(concept("Quantite_En_Transit", "integer"), null);
  assert.equal(concept("Prix_Vente_CAD", "decimal"), null, "toujours pas du chiffre d'affaires");
});
