// Rapports : aucun chiffre invente (ANO-15). Les vues, le diaporama et le
// PowerPoint affichaient un dossier de demonstration (« 1 184 000 $ »,
// « Nordik Plein Air », score de fiabilite de 91 %...) comme les resultats du
// client. Ils ne mettent plus en forme que report.chiffres et le texte de l'IA.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { extractReportData, fmtValeur, diapositives } from "../src/components/reports/reportDataExtractor.js";

const FICHIERS = [
  "src/components/reports/reportDataExtractor.js",
  "src/components/reports/RapportBlocs.jsx",
  "src/components/reports/DailyReportView.jsx",
  "src/components/reports/WeeklyReportView.jsx",
  "src/components/reports/MonthlyReportView.jsx",
  "src/components/reports/PresentationModal.jsx",
  "src/components/reports/ReportTypeCard.jsx",
  "src/lib/exportPptx.js",
];

test("Aucun montant, pourcentage ou nom d'entreprise écrit en dur dans le code des rapports", () => {
  for (const f of FICHIERS) {
    const code = fs.readFileSync(f, "utf8").split("\n").filter((l) => !/^\s*(\/\/|\/?\*)/.test(l)).join("\n");
    assert.doesNotMatch(code, /\d{1,3}(?:[   ]\d{3})+\s*\$/, `${f} : montant en dur`);
    assert.doesNotMatch(code, /["'`][^"'`]*\d+,\d\s*(?:%|pt)/, `${f} : pourcentage en dur`);
    assert.doesNotMatch(code, /Nordik|Plein Air/, `${f} : nom d'entreprise en dur`);
  }
});

const rapport = () => ({
  type: "mensuel", period: "août 2026", summary: "Le CA progresse.",
  chiffres: {
    version: 1, type: "mensuel",
    periode: { debut: "2026-08-01", fin: "2026-08-31", libelle: "août 2026" },
    precedente: { debut: "2026-07-01", fin: "2026-07-31", libelle: "juillet 2026" },
    base: "Dernier mois complet.",
    indicateurs: [
      { id: "total_revenue", nom: "Chiffre d'affaires total", unite: "$", baisseFavorable: false, courant: { valeur: 2000, statut: "mesuré" }, precedent: { valeur: 1000, statut: "mesuré" } },
      { id: "total_charges", nom: "Charges totales", unite: "$", baisseFavorable: true, courant: { valeur: 1500, statut: "partiel" }, precedent: { valeur: 1000, statut: "mesuré" } },
      { id: "gross_margin_pct", nom: "Marge brute (%)", unite: "%", courant: { valeur: 50, statut: "mesuré" }, precedent: { valeur: 40, statut: "mesuré" } },
      { id: "ebitda", nom: "EBITDA", unite: "$", courant: { valeur: null, statut: "non mesuré" }, precedent: { valeur: null, statut: "non mesuré" } },
    ],
    serie: [{ libelle: "juillet 2026", ca: 1000, margePct: 40 }, { libelle: "août 2026", ca: 2000, margePct: 50 }],
    couverture: { Order: 3, Payroll: 1 },
    constats: [],
  },
  comparison: { variationAnalysis: [{ label: "CA", classification: "FACT", text: "Le CA double.", confidence: 0.9, sources: ["total_revenue"], status: "OK" }], keyInsights: ["CA en hausse"] },
});

test("Rapport récent : seulement les chiffres stockés, variations au bon sens", () => {
  const d = extractReportData(rapport(), { name: "Boulangerie Test" });
  assert.equal(d.companyName, "Boulangerie Test");
  assert.equal(d.ancien, false);
  const ca = d.indicateurs.find((i) => i.id === "total_revenue");
  assert.equal(ca.variationTexte, "+100 %");
  assert.equal(ca.variation.favorable, true);
  const charges = d.indicateurs.find((i) => i.id === "total_charges");
  assert.equal(charges.variation.favorable, false, "des charges en hausse reculent");
  assert.equal(d.indicateurs.find((i) => i.id === "gross_margin_pct").variationTexte, "+10 pt");
  const ebitda = d.indicateurs.find((i) => i.id === "ebitda");
  assert.equal(ebitda.valeurTexte, "Non mesuré");
  assert.equal(ebitda.variationTexte, null);
  assert.deepEqual(d.progres.map((p) => p.titre), ["Chiffre d'affaires total", "Marge brute (%)"]);
  assert.deepEqual(d.reculs.map((p) => p.titre), ["Charges totales"]);
  assert.deepEqual(d.mesures, { total: 4, mesures: 2, partiels: 1, nonMesures: ["EBITDA"] });
  assert.equal(d.ia.variationAnalysis[0].classificationTexte, "FAIT");
  assert.deepEqual(diapositives(d).map((s) => s.id), ["cover", "resume", "indicateurs", "evolution", "progres", "analyse", "donnees"]);
});

test("Rapport vide ou sans entreprise : rien n'est complété par défaut", () => {
  const d = extractReportData({ type: "quotidien", period: "2026-09-25" });
  assert.equal(d.companyName, "");
  assert.equal(d.indicateurs.length, 0);
  assert.equal(d.ia.summary, "");
  assert.equal(d.serie.length, 0);
  assert.deepEqual(diapositives(d).map((s) => s.id), ["cover", "donnees"]);
});

test("Ancien rapport : chiffres stockés montrés avec avertissement, non mesurable jamais lu comme 0", () => {
  const d = extractReportData({
    type: "mensuel", period: "août 2026",
    comparison: { currentLabel: "août 2026", previousLabel: "juillet 2026", metrics: [
      { key: "revenus", label: "Revenus", current: 0, previous: 12000, unit: "$", trend: "non-mesurable", delta: null, deltaPct: null },
      { key: "commandes", label: "Commandes", current: 12, previous: 10, unit: "", trend: "up", delta: 2, deltaPct: 20 },
    ] },
  });
  assert.equal(d.ancien, true);
  assert.equal(d.indicateurs[0].valeurTexte, "Non mesuré");
  assert.equal(d.indicateurs[0].variationTexte, null);
  assert.equal(d.indicateurs[1].variationTexte, "+20 %");
});

test("Format fr-CA", () => {
  assert.equal(fmtValeur(1234567.4, "$").replace(/ | /g, " "), "1 234 567 $");
  assert.equal(fmtValeur(31.84, "%"), "31,8 %");
  assert.equal(fmtValeur(null, "$"), "Non mesuré");
});
