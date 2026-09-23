// Croisements deterministes (phase 2 de l'audit visuel, 23 sept 2026).
// Chaque regle compare deux sources : elle doit se declencher sur une
// contradiction reelle et rester muette sur des donnees coherentes.
import test from "node:test";
import assert from "node:assert/strict";
import { detecterCroisements } from "../src/lib/core/croisements.js";
import { instantaneKpi } from "../src/lib/core/instantane.js";
import { lireInstantane, blocInstantane } from "../base44/shared/instantaneIA.ts";

const AUJ = new Date(2025, 6, 15); // 15 juillet 2025
const MOIS = ["2025-01", "2025-02", "2025-03", "2025-04", "2025-05", "2025-06"];

// Entreprise coherente : ventes > paie, campagnes modestes, tresorerie qui suit
// le resultat, paie de tout l'effectif, aucune date future.
const coherente = () => {
  const orders = [], payrolls = [], expenses = [], cashflow = [], campaigns = [], customers = [], employees = [];
  for (let e = 1; e <= 12; e++) employees.push({ employee_id: `E${e}`, status: "actif" });
  MOIS.forEach((m, i) => {
    for (let k = 0; k < 20; k++) orders.push({ order_id: `C${i}-${k}`, date: `${m}-${String(k + 1).padStart(2, "0")}`, subtotal: 1000, total_cost: 500, status: "completed", customer_id: `K${k}` });
    for (let e = 1; e <= 12; e++) payrolls.push({ employee_id: `E${e}`, period: m, total_cost: 400 });
    expenses.push({ date: `${m}-10`, amount: 2000 });
    cashflow.push({ date: `${m}-28`, net_cash_flow: 3000, closing_cash: 50000 + 3000 * i });
  });
  for (let k = 0; k < 20; k++) customers.push({ customer_id: `K${k}`, acquisition_date: "2025-01-01", status: "actif" });
  campaigns.push({ campaign_id: "G1", spend: 1000, revenue: 5000, conversions: 50, new_customers: 5 });
  return { orders, payrolls, expenses, cashflow, campaigns, customers, employees };
};
const ids = (d) => detecterCroisements(d, { aujourdhui: AUJ }).map((c) => c.id).sort();

test("Donnees coherentes : aucun croisement signale", () => {
  assert.deepEqual(ids(coherente()), []);
});

test("Revenus attribues par les campagnes superieurs au CA", () => {
  const d = coherente();
  d.campaigns = [{ campaign_id: "G1", spend: 1000, revenue: 400000 }];
  const c = detecterCroisements(d, { aujourdhui: AUJ }).find((x) => x.id === "revenus_attribues_superieurs_ca");
  assert.ok(c);
  assert.equal(c.niveau, "critique");
  assert.match(c.constat, /fois le chiffre d'affaires/);
});

test("Conversions declarees superieures aux commandes reelles", () => {
  const d = coherente();
  d.campaigns[0].conversions = 5000;
  assert.ok(ids(d).includes("conversions_superieures_commandes"));
});

test("Nouveaux clients attribues superieurs aux clients acquis", () => {
  const d = coherente();
  d.campaigns[0].new_customers = 300;
  assert.ok(ids(d).includes("nouveaux_clients_attribues"));
});

test("Masse salariale superieure au CA", () => {
  const d = coherente();
  d.payrolls = d.payrolls.map((p) => ({ ...p, total_cost: 40000 }));
  assert.ok(ids(d).includes("paie_superieure_ca"));
});

test("Paie qui ne couvre qu'une partie de l'effectif", () => {
  const d = coherente();
  for (let e = 13; e <= 60; e++) d.employees.push({ employee_id: `E${e}`, status: "actif" });
  assert.ok(ids(d).includes("paie_couverture_partielle"));
});

test("Lignes datees apres aujourd'hui", () => {
  const d = coherente();
  d.payrolls.push({ employee_id: "E1", period: "2025-12", total_cost: 400 });
  const c = detecterCroisements(d, { aujourdhui: AUJ }).find((x) => x.id === "lignes_datees_futur");
  assert.ok(c);
  assert.match(c.constat, /paie : 1 ligne/);
});

test("Tresorerie qui monte pendant que le resultat plonge", () => {
  const d = coherente();
  d.expenses = d.expenses.map((e) => ({ ...e, amount: 40000 }));
  assert.ok(ids(d).includes("tresorerie_contredit_resultat"));
});

test("Instantane pour l'IA : les KPI du moteur, leurs periodes et les constats", () => {
  const d = coherente();
  d.payrolls = d.payrolls.map((p) => ({ ...p, total_cost: 40000 }));
  const { chiffres, constats } = instantaneKpi(d, { aujourdhui: AUJ });
  const marge = chiffres.filter((c) => c.id === "net_margin_pct").map((c) => c.periode);
  assert.deepEqual(marge, ["période importée", "3 derniers mois complets", "dernier mois complet (2025-06)"]);
  assert.ok(chiffres.some((c) => c.id === "runway"));
  assert.ok(constats.some((c) => c.id === "paie_superieure_ca"));
});

test("Serveur : l'instantane recu est borne et type, puis cite tel quel dans le prompt", () => {
  const recu = lireInstantane({
    chiffres: [{ nom: "Marge nette (%)", periode: "3 derniers mois", valeur: -12.5, unite: "%", statut: "mesuré" }, { nom: "x".repeat(500), valeur: { piege: 1 } }],
    constats: [{ niveau: "inconnu", titre: "T", constat: "C\u0000", action: "A" }],
  });
  assert.equal(recu.chiffres[1].nom.length, 120);
  assert.equal(typeof recu.chiffres[1].valeur, "string");
  assert.equal(recu.constats[0].niveau, "modere");
  assert.ok(!recu.constats[0].constat.includes("\u0000"));
  const bloc = blocInstantane(recu, { totalAnalyzed: 10, negativeCount: 3, priceSensitivityRatio: 50 }, [{ description: "Baisse de prix d'un concurrent", strength: 0.8 }]);
  assert.match(bloc, /Marge nette \(%\) \(3 derniers mois\) : -12\.5 %/);
  assert.match(bloc, /SIGNAUX QUALITATIFS : 10 observations/);
  assert.match(bloc, /Baisse de prix d'un concurrent \(force 80 %\)/);
  assert.deepEqual(lireInstantane(null), { chiffres: [], constats: [] });
});

test("Paie : cout total inferieur au salaire + heures sup sur une part notable des fiches", () => {
  const d = coherente();
  d.payrolls = d.payrolls.map((p, i) => ({ ...p, regular_pay: 350, overtime: i % 2 ? 200 : 0 }));
  const c = detecterCroisements(d, { aujourdhui: AUJ }).find((x) => x.id === "paie_cout_inferieur_composantes");
  assert.ok(c);
  assert.match(c.constat, /36 fiches de paie sur 72 \(50 %\)/);
  // Fiches coherentes (cout >= verse) : rien a signaler.
  const ok = coherente();
  ok.payrolls = ok.payrolls.map((p) => ({ ...p, regular_pay: 300, overtime: 50 }));
  assert.ok(!ids(ok).includes("paie_cout_inferieur_composantes"));
});
