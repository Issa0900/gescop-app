// Coherence des KPI entre les ecrans (phase 1 de l'audit visuel, 23 sept 2026).
//
// Constat en production : pour les memes donnees, la marge nette valait -95 %
// sur la page KPI, -391 % sur Finance ; le CA valait 320 636 $, 568 519 $ ou
// 506 474 $ selon la page ; Finance affichait 568 519 - 996 484 = -2 222 935.
// Cause : chaque ecran recomposait ses chiffres (series maison sans paie,
// entites lues au cas par cas, `|| 0`). Ces tests verrouillent la regle :
// UN moteur, des fenetres de temps, des cartes qui s'additionnent.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { preparerPeriodes, kpisParFenetre, kpisTotal, serieMensuelle, moisComplets } from "../src/lib/core/kpiPeriodes.js";
import { financialMonthlySeries } from "../src/lib/financialData.js";
import { aggregateMarginPct, consommationTresorerie, fluxTresorerieMensuels } from "../src/lib/metrics.js";
import { KPI_REGISTRY } from "../src/lib/core/kpiRegistry.js";

// Six mois passes : commandes (avec cout), transactions de recette et de
// depense, depenses, paie. Tout est date dans le passe pour que chaque ligne
// tombe dans un mois complet.
const MOIS = ["2025-01", "2025-02", "2025-03", "2025-04", "2025-05", "2025-06"];
const donnees = () => {
  const orders = [], transactions = [], expenses = [], payrolls = [];
  MOIS.forEach((m, i) => {
    orders.push({ order_id: `C${i}a`, date: `${m}-05`, subtotal: 1000 + 100 * i, total_cost: 400 + 10 * i, status: "completed" });
    orders.push({ order_id: `C${i}b`, date: `${m}-18`, subtotal: 500, total_cost: 200, status: "completed" });
    transactions.push({ date: `${m}-10`, amount: 300 + i, type: "income", description: `Subvention ${m}` });
    transactions.push({ date: `${m}-12`, amount: 150, type: "expense", description: `Frais bancaires ${m}` });
    expenses.push({ date: `${m}-20`, amount: 250 + 5 * i, category: "loyer" });
    payrolls.push({ employee_id: "E1", period: m, total_cost: 900 });
    payrolls.push({ employee_id: "E2", period: m, total_cost: 700 + 20 * i });
  });
  return { orders, transactions, expenses, payrolls };
};

const val = (map, id) => { const v = map?.get(id)?.value; return Number.isFinite(v) ? v : null; };
const proche = (a, b, msg) => assert.ok(Math.abs(a - b) < 1e-6, `${msg} : ${a} != ${b}`);

test("CA - charges totales = resultat net, sur le total et sur chaque fenetre", () => {
  const prep = preparerPeriodes(donnees());
  const ids = ["total_revenue", "total_charges", "net_income"];
  const f = kpisParFenetre(prep, ids);
  for (const [nom, fen] of Object.entries({ total: f.total, mois: f.mois, moisPrec: f.moisPrec, trim: f.trim, trimPrec: f.trimPrec })) {
    assert.ok(fen, `fenetre ${nom} calculee`);
    proche(val(fen, "total_revenue") - val(fen, "total_charges"), val(fen, "net_income"), `identite (${nom})`);
  }
});

test("Charges totales = cout des ventes + depenses + masse salariale (la paie est comptee)", () => {
  const k = kpisTotal(preparerPeriodes(donnees()), ["total_charges", "cogs_total", "total_expense", "payroll_total"]);
  assert.ok(val(k, "payroll_total") > 0);
  proche(val(k, "total_charges"), val(k, "cogs_total") + val(k, "total_expense") + val(k, "payroll_total"), "decomposition");
});

test("La somme des mois de la serie financiere = le total du moteur", () => {
  const d = donnees();
  const serie = financialMonthlySeries(d);
  assert.equal(serie.length, MOIS.length);
  const tot = kpisTotal(preparerPeriodes(d), ["total_revenue", "total_charges", "net_income"]);
  proche(serie.reduce((s, p) => s + p.income, 0), val(tot, "total_revenue"), "CA");
  proche(serie.reduce((s, p) => s + p.expense, 0), val(tot, "total_charges"), "charges");
  proche(serie.reduce((s, p) => s + p.margin, 0), val(tot, "net_income"), "resultat");
});

test("Marge nette (3 mois) : la formule des ecrans = le moteur sur 3 mois", () => {
  const d = donnees();
  const serie = financialMonthlySeries(d);
  const rev = serie.map((p) => ({ month: p.month, val: p.income }));
  const exp = serie.map((p) => ({ month: p.month, val: p.expense }));
  const f = kpisParFenetre(preparerPeriodes(d), ["net_margin_pct"]);
  proche(aggregateMarginPct(rev, exp, 3), val(f.trim, "net_margin_pct"), "marge 3 mois");
});

test("Serie mensuelle du moteur : un mois sans ligne n'invente pas de zero", () => {
  const d = donnees();
  d.orders = d.orders.filter((o) => !o.date.startsWith("2025-03"));
  d.transactions = d.transactions.filter((t) => !t.date.startsWith("2025-03"));
  d.expenses = d.expenses.filter((e) => !e.date.startsWith("2025-03"));
  d.payrolls = d.payrolls.filter((p) => p.period !== "2025-03");
  const serie = serieMensuelle(preparerPeriodes(d), ["total_revenue"]);
  assert.equal(serie.find((p) => p.month === "2025-03").total_revenue, null);
});

test("Mois en cours et mois futurs ne sont jamais le « dernier mois »", () => {
  const d = donnees();
  d.payrolls.push({ employee_id: "E1", period: "2099-12", total_cost: 1e6 });
  const prep = preparerPeriodes(d, { aujourdhui: new Date(2025, 6, 15) });
  assert.equal(moisComplets(prep).at(-1), "2025-06");
});

test("Autonomie : la consommation vient du releve de tresorerie, pas d'une perte comptable", () => {
  // Perte comptable chaque mois, mais tresorerie qui augmente : pas de burn.
  const cashflow = MOIS.map((m, i) => ({ date: `${m}-28`, net_cash_flow: 8000, closing_cash: 100000 + 8000 * i }));
  const rev = MOIS.map((m) => ({ month: m, val: 1000 }));
  const exp = MOIS.map((m) => ({ month: m, val: 5000 }));
  const { burn, base } = consommationTresorerie({ cashflow, revSeries: rev, expSeries: exp }, 3);
  assert.equal(base, "releve");
  assert.equal(burn, 0);
  // Sans releve de flux : repli sur le resultat, signale comme tel.
  const repli = consommationTresorerie({ cashflow: [], revSeries: rev, expSeries: exp }, 3);
  assert.equal(repli.base, "resultat");
  assert.equal(repli.burn, 4000);
});

test("Releve de soldes seulement : le flux est la variation du solde", () => {
  const cashflow = [
    { date: "2025-01-31", closing_cash: 1000 },
    { date: "2025-02-28", closing_cash: 700 },
    { date: "2025-03-31", closing_cash: 400 },
  ];
  assert.deepEqual(fluxTresorerieMensuels(cashflow).map((p) => p.net), [-300, -300]);
});

test("Un libelle = un indicateur : pas deux KPI du registre sous le meme nom", () => {
  const vus = new Map();
  for (const [id, def] of Object.entries(KPI_REGISTRY)) {
    const nom = def?.name?.fr?.toLowerCase();
    if (!nom) continue;
    assert.ok(!vus.has(nom), `« ${def.name.fr} » designe ${vus.get(nom)} et ${id}`);
    vus.set(nom, id);
  }
});

// Garde statique : la regle doit tenir dans le code des ecrans, pas seulement
// dans le moteur.
const SRC = path.resolve("src");
const fichiers = (dir) => fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
  const p = path.join(dir, e.name);
  return e.isDirectory() ? fichiers(p) : /\.(jsx?|tsx?)$/.test(e.name) ? [p] : [];
});
const ecrans = fichiers(SRC).filter((f) => !f.includes(`${path.sep}tests${path.sep}`));

test("Aucun ecran ne transforme un KPI non mesure en zero (`?.value || 0`)", () => {
  const fautifs = ecrans.filter((f) => /\.get\([^)]*\)\?\.value\s*\|\|\s*0/.test(fs.readFileSync(f, "utf8")));
  assert.deepEqual(fautifs.map((f) => path.relative(SRC, f)), []);
});

test("financialMonthlySeries recoit l'objet de donnees du moteur, jamais des tableaux", () => {
  const fautifs = ecrans.filter((f) => /financialMonthlySeries\(\s*(transactions|\[|expenses|orders)/.test(fs.readFileSync(f, "utf8")));
  assert.deepEqual(fautifs.map((f) => path.relative(SRC, f)), []);
});

test("Un ecran qui calcule un KPI lit ses donnees par useDonneesKpi", () => {
  const calcule = /(useKpiEngine|financialMonthlySeries|computeLiveAlerts|computeDomainScores)\(/;
  const litSeul = /fetchAll\(base44\.entities\.(Transaction|Expense|Payroll|Cashflow|Order)\b|fetchOrders\(/;
  const fautifs = ecrans
    .filter((f) => /[\\/](pages|components)[\\/]/.test(f))
    .filter((f) => { const t = fs.readFileSync(f, "utf8"); return calcule.test(t) && litSeul.test(t); });
  assert.deepEqual(fautifs.map((f) => path.relative(SRC, f)), []);
});

test("Panier moyen : CA des commandes / commandes, jamais les encaissements hors commandes", () => {
  const k = kpisTotal(preparerPeriodes(donnees()), ["aov", "order_revenue", "order_count", "total_revenue"]);
  assert.equal(val(k, "total_revenue"), val(k, "order_revenue"), "les commandes priment sur les transactions pour le CA");
  proche(val(k, "aov"), val(k, "order_revenue") / val(k, "order_count"), "panier moyen");
});
