// Verification synthetique des correctifs recents, avec des donnees fictives
// et des valeurs calculees a la main (voir chaque commentaire "Calcul manuel"
// juste avant l'assertion). Objectif : prouver que le CHIFFRE est exact et que
// la BONNE donnee a ete utilisee, pas seulement que le code ne plante pas.
//
// Six cas, chacun isole dans son propre test() :
//  1. dataQualityEngine.filterByConfidence (seuil de confiance 60/100)
//  2. observationEngine.generateObservations (garde NaN) - bundle .ts via esbuild
//  3. semanticMatcher.matchConcept (ambiguite : ecart < 0.10) - bundle .ts via esbuild
//  4. kpiEngine/kpiRegistry : marge brute ($ et %)
//  5. kpiEngine/kpiRegistry : EBITDA (marge brute - masse salariale - amortissement proratise)
//  6. kpiEngine/kpiRegistry : rotation des stocks sur stock MOYEN (pas le dernier releve)
import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { bundleSrcModule } from "./helpers/bundleSrcModule.js";
import { filterByConfidence } from "../src/lib/core/dataQualityEngine.js";
import { preparerPeriodes, kpisTotal } from "../src/lib/core/kpiPeriodes.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ─────────────────────────────────────────────────────────────────────────
// CAS 1 — Filtrage par confiance (dataQualityEngine.filterByConfidence)
// ─────────────────────────────────────────────────────────────────────────
test("Cas 1 - filterByConfidence garde exactement les observations >= seuil 60", () => {
  const observations = [
    { id: "a", confidence: 0.95, value: 1000 },
    { id: "b", confidence: 0.80, value: 2000 },
    { id: "c", confidence: 0.55, value: 3000 }, // 55 < 60 -> exclue
    { id: "d", confidence: 0.30, value: 4000 }, // 30 < 60 -> exclue
    { id: "e", confidence: 0.65, value: 5000 },
  ];

  // Calcul manuel : confidence*100 >= 60 -> a(95), b(80), e(65) passent ;
  // c(55) et d(30) sont sous le seuil.
  // Somme attendue = 1000 + 2000 + 5000 = 8000 ; count attendu = 3.
  const filtered = filterByConfidence(observations, 60);
  assert.equal(filtered.length, 3);
  assert.deepEqual(filtered.map((o) => o.id).sort(), ["a", "b", "e"]);
  const sum = filtered.reduce((s, o) => s + o.value, 0);
  assert.equal(sum, 8000);

  // Une observation SANS champ confidence du tout doit etre traitee comme
  // confiance 1 (100), donc gardee (comportement documente dans le code :
  // "matching the existing fallback in kpiEngine.js (obs.confidence ? ... : 100)").
  const sansConfidence = [{ id: "f", value: 999 }];
  const gardee = filterByConfidence(sansConfidence, 60);
  assert.equal(gardee.length, 1);
  assert.equal(gardee[0].id, "f");
});

// ─────────────────────────────────────────────────────────────────────────
// CAS 2 — Garde NaN dans generateObservations (observationEngine.ts)
// ─────────────────────────────────────────────────────────────────────────
// observationEngine.ts est un fichier .ts de base44/shared (partage avec
// Deno). Node ne resout pas nativement le TypeScript ni les imports avec
// extension .ts explicite : on le bundle avec esbuild (meme technique que
// tests/kpi_engine_lineage.test.js pour kpiEngine.js). Les imports de type
// (SemanticMatch, DatasetGrain) sont elimines par esbuild puisqu'ils ne sont
// jamais utilises comme valeurs -- aucune dependance Deno n'est donc chargee
// a l'execution.
test("Cas 2 - generateObservations ne produit jamais value: NaN sur un champ numerique invalide", async () => {
  const observationEnginePath = path.join(__dirname, "../base44/shared/observationEngine.ts");
  const { generateObservations } = await bundleSrcModule(observationEnginePath);

  // Ligne normalisee ou le champ "revenue" est le resultat d'un Number("abc"),
  // donc NaN -- cas reel d'une cellule non numerique parsee comme un nombre.
  const normalizedRow = { revenue: Number("abc"), label: "ligne test" };
  assert.ok(Number.isNaN(normalizedRow.revenue), "le jeu de test doit bien produire un NaN");

  const matchedConcepts = {
    revenue: { concept: "finance.revenue", confidence: 0.9, method: "test", requiresValidation: false },
  };
  const grain = { resolution: "monthly", type: "aggregated" };

  const observations = generateObservations(normalizedRow, matchedConcepts, "source-test", grain);

  assert.equal(observations.length, 1, "une observation est bien generee pour la colonne matchee");
  const obs = observations[0];

  // Calcul manuel : obsType = 'quantitative' (concept "finance.revenue" ne
  // commence ni par "qualitative." ni par "external."). La garde ajoutee
  // exige `typeof value === 'number' && !Number.isNaN(value)` avant d'ecrire
  // observation.value -- NaN echoue ce test, donc la branche retombe sur le
  // fallback texte (`observation.text = String(value)` => "NaN").
  // Attendu : PAS de `value` numerique (surtout pas NaN) sur l'observation ;
  // `text` vaut la chaine "NaN" (comportement du fallback, documente ici).
  assert.ok(!("value" in obs), "aucun champ value (donc pas de value: NaN) ne doit etre pose");
  assert.equal(Number.isNaN(obs.value), false, "obs.value ne doit jamais valoir NaN");
  assert.equal(obs.text, "NaN", "la garde fait tomber le NaN dans la branche texte plutot que de planter ou mentir sur un value numerique");
});

// ─────────────────────────────────────────────────────────────────────────
// CAS 3 — Ambiguite dans matchConcept (semanticMatcher.ts)
// ─────────────────────────────────────────────────────────────────────────
// Fonction testee : matchConcept() dans base44/shared/semanticMatcher.ts,
// avec un VRAI cas construit depuis le registre reel (conceptRegistry.ts),
// pas des scores mockes : le mot-cle "tps" apparait, seul et a l'identique,
// dans le lexique de deux concepts distincts :
//   - "finance.tps"   (canonicalKey "tax_federal", lexicon [...,"tps",...])
//   - "tax.federal"   (canonicalKey "tax_federal", lexicon [...,"tps",...])
// Une colonne nommee "TPS" matche donc les DEUX a l'identique (score exact
// 1.0 chacun), un cas d'ambiguite reel et non fabrique.
test("Cas 3 - matchConcept marque requiresValidation quand deux concepts sont a egalite (ecart < 0.10), meme au-dessus du seuil absolu", async () => {
  const semanticMatcherPath = path.join(__dirname, "../base44/shared/semanticMatcher.ts");
  const { matchConcept } = await bundleSrcModule(semanticMatcherPath);

  const profile = {
    columnName: "TPS",
    inferredType: "currency",
    nullCount: 0,
    totalCount: 5,
    uniqueValues: 5,
    sampleValues: [100, 200, 150, 120, 130],
  };

  const match = matchConcept(profile);
  assert.ok(match, "un match doit etre trouve");

  // Calcul manuel : "TPS" -> mots ["tps"]. Dans CONCEPT_MAPPINGS (derive du
  // registre), "finance.tps" et "tax.federal" ont chacun "tps" comme mot-cle
  // EXACT -> score = 1.0 pour les deux (match exact, ligne
  // `if (motsCle.join(" ") === motsColonne.join(" ")) score = 1.0`).
  // bestScore = 1.0, secondScore = 1.0 -> ecart = 1.0 - 1.0 = 0 < 0.10.
  // Avant le correctif, seul le seuil absolu comptait (`requiresValidation:
  // score < 0.8`) : 1.0 >= 0.8 aurait ete marque "certain" a tort, alors que
  // DEUX concepts concurrents se disputent la colonne. Apres le correctif,
  // l'ecart insuffisant doit forcer requiresValidation = true.
  assert.equal(match.confidence, 1.0, "les deux concepts candidats matchent a l'identique (score exact 1.0)");
  assert.equal(
    match.requiresValidation,
    true,
    "ecart insuffisant (0 < 0.10) entre finance.tps et tax.federal sur le mot-cle \"tps\" : doit exiger une validation malgre un score au-dessus du seuil absolu de 0.8"
  );
});

// ─────────────────────────────────────────────────────────────────────────
// CAS 4 — Marge brute (kpiEngine.js + kpiRegistry.js), moteur reel
// ─────────────────────────────────────────────────────────────────────────
test("Cas 4 - marge brute ($ et %) exacte via le moteur KPI reel", () => {
  const data = {
    orders: [
      { order_id: "O1", date: "2026-01-01", subtotal: 30000, total_cost: 20000, status: "completed" },
      { order_id: "O2", date: "2026-01-30", subtotal: 20000, total_cost: 12000, status: "completed" },
    ],
  };
  const prep = preparerPeriodes(data);
  const k = kpisTotal(prep, ["total_revenue", "cogs_total", "gross_margin_amount", "gross_margin_pct"]);

  // Calcul manuel :
  // Revenu total = 30000 + 20000 = 50000
  // COGS total   = 20000 + 12000 = 32000
  // Marge brute $ = 50000 - 32000 = 18000
  // Marge brute % = 18000 / 50000 * 100 = 36
  assert.equal(k.get("total_revenue").value, 50000);
  assert.equal(k.get("cogs_total").value, 32000);
  assert.equal(k.get("gross_margin_amount").value, 18000);
  assert.equal(k.get("gross_margin_pct").value, 36);
});

// ─────────────────────────────────────────────────────────────────────────
// CAS 5 — EBITDA (nouveau calcul), moteur reel
// ─────────────────────────────────────────────────────────────────────────
test("Cas 5 - EBITDA exact (marge brute - masse salariale - amortissement proratise), different de l'ancien bug (= net_income)", () => {
  const data = {
    // Memes commandes que le cas 4 : marge brute = 18000 $. Les deux dates
    // (2026-01-01 et 2026-01-30) donnent une periode de 30 jours au moteur
    // (determineTemporalContext : ceil(29 jours d'ecart) + 1 = 30) -- c'est
    // CETTE valeur, pas un mois calendaire fixe, que kpiRegistry utilise pour
    // proratiser l'amortissement (`dpa_annual_total * (periodDays / 365)`,
    // jamais `/30`).
    orders: [
      { order_id: "O1", date: "2026-01-01", subtotal: 30000, total_cost: 20000, status: "completed" },
      { order_id: "O2", date: "2026-01-30", subtotal: 20000, total_cost: 12000, status: "completed" },
    ],
    payrolls: [{ employee_id: "E1", period: "2026-01", total_cost: 8000 }],
    // net_book_value * dpa_rate = 36000 * 0.10 = 3600 $ d'amortissement ANNUEL estime.
    assets: [{ asset_id: "A1", net_book_value: 36000, dpa_rate: 0.10 }],
  };
  const prep = preparerPeriodes(data);
  const k = kpisTotal(prep, ["gross_margin_amount", "payroll_total", "dpa_annual_total", "ebitda", "net_income"]);

  assert.equal(k.get("gross_margin_amount").value, 18000);
  assert.equal(k.get("payroll_total").value, 8000);
  assert.equal(k.get("dpa_annual_total").value, 3600);

  // period_days reel utilise par le moteur : determineTemporalContext (kpiEngine.js)
  // calcule ceil(|2026-01-30 - 2026-01-01|) + 1 = ceil(29) + 1 = 30 jours.
  const periodDays = 30;

  // Calcul manuel EXACT, avec la meme expression et le meme ordre
  // d'operations que kpiRegistry.js (`gross_margin_amount - payroll_total -
  // dpa_annual_total * (periodDays / 365)`), pour une egalite bit a bit :
  // amortissement de la periode = 3600 * (30 / 365) = 295.8904109589041...
  // EBITDA attendu = 18000 - 8000 - 295.8904109589041... = 9704.109589041096...
  const amortissementPeriode = 3600 * (periodDays / 365);
  const ebitdaAttendu = 18000 - 8000 - amortissementPeriode;
  // Non-approximatif : egalite stricte, pas de tolerance, puisque le calcul
  // manuel ci-dessus reproduit exactement la meme expression et le meme
  // ordre d'operations que kpiRegistry.js (ebitdaAttendu ~= 9704.109589041096,
  // valeur en virgule flottante non arrondie).
  assert.equal(k.get("ebitda").value, ebitdaAttendu);

  // Preuve que le bug n'est plus la : AVANT le correctif, ebitda = net_income
  // tel quel (aucun amortissement reintegre). Ici net_income = 50000 - 32000
  // - 0 (pas de total_expense) - 8000 = 10000. Le nouvel EBITDA (~9704.11)
  // DOIT differer de ce chiffre.
  assert.equal(k.get("net_income").value, 10000);
  assert.notEqual(k.get("ebitda").value, k.get("net_income").value);
});

// ─────────────────────────────────────────────────────────────────────────
// CAS 6 — Rotation de stock (nouveau calcul sur stock MOYEN), moteur reel
// ─────────────────────────────────────────────────────────────────────────
test("Cas 6 - rotation des stocks utilise le stock MOYEN (3.0), pas le dernier releve seul (4.0)", () => {
  const data = {
    orders: [{ order_id: "O3", date: "2026-02-01", subtotal: 40000, total_cost: 24000, status: "completed" }],
    inventory: [
      // Meme produit (P1), deux releves a des dates differentes dans la periode.
      { inventory_id: "I1", product_id: "P1", date: "2026-02-01", inventory_value: 10000 }, // premier releve
      { inventory_id: "I2", product_id: "P1", date: "2026-02-28", inventory_value: 6000 },  // dernier releve (stock baisse)
    ],
  };
  const prep = preparerPeriodes(data);
  const k = kpisTotal(prep, ["cogs_total", "inventory_value_total", "inventory_value_average", "stock_turnover_rate"]);

  // Calcul manuel :
  // COGS periode = 24000
  // inventory_value_total (dernier releve par produit, ANCIEN comportement
  // "instantane") = 6000 (le releve du 2026-02-28, le plus recent)
  assert.equal(k.get("cogs_total").value, 24000);
  assert.equal(k.get("inventory_value_total").value, 6000);

  // inventory_value_average (moyenne premier+dernier releve par produit,
  // NOUVEAU comportement) = (10000 + 6000) / 2 = 8000
  assert.equal(k.get("inventory_value_average").value, 8000);

  // Ancienne formule (buguee) : COGS / dernier releve = 24000 / 6000 = 4.0
  const ancienneFormule = k.get("cogs_total").value / k.get("inventory_value_total").value;
  assert.equal(ancienneFormule, 4.0);

  // Nouvelle formule (celle du registre reel) : COGS / stock MOYEN
  // = 24000 / 8000 = 3.0
  assert.equal(k.get("stock_turnover_rate").value, 3.0);
  assert.notEqual(k.get("stock_turnover_rate").value, ancienneFormule);
});
