// Contrat de calcul des KPI (.claude/skills/gescop-kpi-contract) : un test par
// anomalie de l'audit du 25 sept. 2026, sur le vrai moteur.
import test from "node:test";
import assert from "node:assert/strict";
import { computeKpiBatch } from "../src/lib/core/kpiEngine.js";
import { buildKpiDataset } from "../src/lib/core/kpiDataset.js";

const calcul = (data, ids) => {
  const { records, semantics } = buildKpiDataset(data);
  const res = computeKpiBatch(ids, records, semantics);
  return Object.fromEntries(ids.map((id) => [id, { v: res.get(id)?.value ?? null, s: res.get(id)?.status, r: res.get(id) }]));
};

// ── ANO-01 : le statut d'un KPI suit celui des KPI dont il dépend ────────────

test("ANO-01 : résultat net partiel (sans coût des ventes) → marge nette partielle aussi", () => {
  const data = {
    orders: [{ order_id: "O1", date: "2026-06-10", total_revenue: 100000, status: "completed" }],
    expenses: [{ expense_id: "E1", date: "2026-06-11", amount: 10000 }],
    payrolls: [{ payroll_id: "P1", period: "2026-06-30", total_cost: 20000 }],
  };
  const k = calcul(data, ["net_income", "net_margin_pct"]);
  assert.equal(k.net_income.s, "UNKNOWN");
  assert.equal(k.net_margin_pct.s, "UNKNOWN", "la marge nette hérite du statut partiel du résultat net");
  const seul = calcul(data, ["net_margin_pct"]);
  assert.equal(seul.net_margin_pct.s, "UNKNOWN", "même demandé seul");
});

test("ANO-01 : une formule qui rend null est NON MESURÉE, jamais partielle", () => {
  const data = { orders: [{ order_id: "O1", date: "2026-06-10", total_revenue: 1000, status: "completed" }] };
  const k = calcul(data, ["gross_margin_amount", "gross_margin_pct"]);
  assert.equal(k.gross_margin_amount.v, null);
  assert.equal(k.gross_margin_amount.s, "NOT_MEASURED");
  assert.equal(k.gross_margin_pct.s, "NOT_MEASURED");
});

test("ANO-01 : dépendance KPI non mesurée → partiel (dépenses absentes du résultat)", () => {
  const data = {
    orders: [{ order_id: "O1", date: "2026-06-10", total_revenue: 100000, cost: 40000, status: "completed" }],
    payrolls: [{ payroll_id: "P1", period: "2026-06-30", total_cost: 20000 }],
  };
  const k = calcul(data, ["total_expense", "net_income"]);
  assert.equal(k.total_expense.s, "NOT_MEASURED");
  assert.equal(k.net_income.v, 40000);
  assert.equal(k.net_income.s, "UNKNOWN");
});

test("ANO-01 : sources complètes → mesuré", () => {
  const data = {
    orders: [{ order_id: "O1", date: "2026-06-10", total_revenue: 100000, cost: 40000, status: "completed" }],
    expenses: [{ expense_id: "E1", date: "2026-06-11", amount: 10000 }],
    payrolls: [{ payroll_id: "P1", period: "2026-06-30", total_cost: 20000 }],
  };
  const k = calcul(data, ["net_income", "net_margin_pct", "gross_margin_pct"]);
  assert.equal(k.net_income.v, 30000);
  assert.equal(k.net_income.s, "MEASURED");
  assert.equal(k.net_margin_pct.s, "MEASURED");
  assert.equal(k.gross_margin_pct.s, "MEASURED");
});

// ── ANO-02 / ANO-03 : EBITDA avant amortissement, résultat net après ─────────

const pnl = () => ({
  orders: [
    { order_id: "O1", date: "2026-01-10", total_revenue: 500000, cost: 200000, status: "completed" },
    { order_id: "O2", date: "2026-12-20", total_revenue: 500000, cost: 200000, status: "completed" },
  ],
  expenses: [{ expense_id: "E1", date: "2026-06-01", amount: 150000, category: "loyer" }],
  payrolls: [{ payroll_id: "P1", period: "2026-06-30", total_cost: 250000 }],
});

test("ANO-02 : EBITDA = CA - coût des ventes - dépenses - paie, sans registre d'immobilisations", () => {
  const k = calcul(pnl(), ["ebitda", "net_income", "total_charges", "total_revenue"]);
  assert.equal(k.ebitda.v, 200000);
  assert.equal(k.ebitda.s, "MEASURED");
  assert.equal(k.net_income.v, 200000, "sans immobilisations, rien à amortir");
  assert.equal(k.net_income.s, "MEASURED", "l'absence de registre d'immobilisations ne rend pas le résultat partiel");
  assert.equal(k.total_revenue.v - k.total_charges.v, k.net_income.v);
});

test("ANO-02/03 : l'amortissement est retranché du résultat net, jamais de l'EBITDA", () => {
  const data = { ...pnl(), assets: [{ asset_id: "A1", net_book_value: 100000, dpa_rate: 0.3 }] };
  const k = calcul(data, ["ebitda", "dpa_annual_total", "net_income", "total_charges", "total_revenue"]);
  assert.equal(k.dpa_annual_total.v, 30000);
  assert.equal(k.ebitda.v, 200000);
  assert.equal(k.net_income.v, 170000, "12 mois de ventes : amortissement annuel entier");
  assert.equal(k.total_revenue.v - k.total_charges.v, k.net_income.v, "CA - charges = résultat");
});

test("ANO-03 : amortissement proratisé en mois de la période", () => {
  const data = {
    orders: [
      { order_id: "O1", date: "2026-01-05", total_revenue: 60000, cost: 20000, status: "completed" },
      { order_id: "O2", date: "2026-03-28", total_revenue: 60000, cost: 20000, status: "completed" },
    ],
    payrolls: [{ payroll_id: "P1", period: "2026-02-28", total_cost: 30000 }],
    expenses: [{ expense_id: "E1", date: "2026-02-01", amount: 10000 }],
    assets: [{ asset_id: "A1", net_book_value: 120000, dpa_rate: 0.2 }],
  };
  const k = calcul(data, ["ebitda", "net_income"]);
  assert.equal(k.ebitda.v, 40000);
  assert.equal(k.net_income.v, 40000 - 24000 * 3 / 12);
});

test("ANO-02 : sans aucune charge d'exploitation, EBITDA non mesuré (jamais la marge brute)", () => {
  const data = { orders: [{ order_id: "O1", date: "2026-01-10", total_revenue: 1000, cost: 400, status: "completed" }] };
  const k = calcul(data, ["ebitda", "net_income"]);
  assert.equal(k.ebitda.v, null);
  assert.equal(k.net_income.v, null);
});

test("ANO-10 : un taux d'amortissement donné en pourcentage (30) vaut 0,30", () => {
  const k = calcul({ assets: [{ asset_id: "A1", net_book_value: 100000, dpa_rate: 30 }] }, ["dpa_annual_total"]);
  assert.equal(k.dpa_annual_total.v, 30000);
});

// ── ANO-05 : la remise n'est retranchée qu'une fois, sur preuve ─────────────

import { montantHT } from "../src/lib/core/kpiRecords.js";
import { normalizeRow } from "../base44/shared/importUtils.ts";
import { getSchema } from "../base44/shared/entitySchemas.ts";

const cas05 = [
  ["total après remise (convention), sans sous-total", { total: 1092.5, tax: 142.5, discount: 50 }, 950],
  ["sous-total net + livraison + taxe = total", { subtotal: 950, discount: 50, tax: 142.5, shipping: 15, total: 1107.5 }, 950],
  ["sous-total brut prouvé par la taxe et le total", { subtotal: 1000, discount: 50, tax: 142.26, total: 1092.26 }, 950],
  ["sous-total net prouvé par quantité × prix", { quantity: 2, unit_price: 500, subtotal: 950, discount: 50 }, 950],
  ["sous-total brut prouvé par quantité × prix", { quantity: 2, unit_price: 500, subtotal: 1000, discount: 50 }, 950],
  ["total avant remise prouvé par quantité × prix", { quantity: 2, unit_price: 500, total: 1150, tax: 150, discount: 50 }, 950],
  ["remise en taux sur quantité × prix", { quantity: 2, unit_price: 500, subtotal: 1000, discount: 0.05 }, 950],
];

for (const [nom, ligne, attendu] of cas05) {
  test(`ANO-05 moteur : ${nom}`, () => {
    assert.equal(Math.round(montantHT(ligne) * 100) / 100, attendu);
  });
  test(`ANO-05 import : ${nom}`, () => {
    const props = getSchema("Order").properties;
    const o = normalizeRow("Order", { order_id: "S-1", date: "2026-06-01", ...ligne }, "i", props);
    assert.equal(o.total_revenue, attendu);
  });
}

// ── ANO-06 : effectif = employés qui n'ont pas quitté l'entreprise ──────────

test("ANO-06 : « inactif » et « Inactive » ne comptent pas comme actifs", () => {
  const employees = [
    { employee_id: "E1", status: "actif" }, { employee_id: "E2", status: "actif" },
    { employee_id: "E3", status: "inactif" }, { employee_id: "E4", status: "Inactive" }, { employee_id: "E5", status: "terminé" },
  ];
  assert.equal(calcul({ employees }, ["employee_count"]).employee_count.v, 2);
});

test("ANO-06 : un employé en congé ou en essai fait partie de l'effectif", () => {
  const employees = [
    { employee_id: "E1", status: "actif" }, { employee_id: "E2", status: "conge" },
    { employee_id: "E3", status: "essai" }, { employee_id: "E4", status: "depart" },
  ];
  assert.equal(calcul({ employees }, ["employee_count"]).employee_count.v, 3);
});

test("ANO-06 : fiches sans statut comptées ; la paie ne gonfle pas l'effectif des fiches", () => {
  const employees = [{ employee_id: "E1" }, { employee_id: "E2" }];
  const payrolls = [{ employee_id: "E1", period: "2026-01", total_cost: 1 }, { employee_id: "E9", period: "2025-01", total_cost: 1, status: "paye" }];
  assert.equal(calcul({ employees, payrolls }, ["employee_count"]).employee_count.v, 2);
  assert.equal(calcul({ payrolls }, ["employee_count"]).employee_count.v, 2, "sans fiche employé, la paie sert de repli");
  assert.equal(calcul({ orders: [{ order_id: "O1", date: "2026-01-01", total_revenue: 1, employee_id: "V1" }] }, ["employee_count"]).employee_count.v, null);
});

test("ANO-06 import : un statut de départ est conservé (depart), jamais effacé", () => {
  const props = getSchema("Employee").properties;
  for (const s of ["inactif", "Inactive", "Terminé", "Left", "Démissionnaire", "Retraité"]) {
    assert.equal(normalizeRow("Employee", { employee_id: "E1", status: s }, "i", props).status, "depart", s);
  }
  assert.equal(normalizeRow("Employee", { employee_id: "E1", status: "Actif" }, "i", props).status, "actif");
  const client = getSchema("Customer").properties;
  assert.equal(normalizeRow("Customer", { customer_id: "C1", status: "inactif" }, "i", client).status, "inactif", "un client inactif reste inactif");
});

// ── ANO-04 : ce qui combine plusieurs sources se calcule sur leur période commune ──

const ventesEtPaie = () => {
  const orders = [], payrolls = [];
  for (let m = 1; m <= 6; m++) orders.push({ order_id: `O${m}`, date: `2026-0${m}-15`, total_revenue: 60000, cost: 30000, status: "completed" });
  for (let i = 0; i < 12; i++) {
    const mois = new Date(Date.UTC(2025, 6 + i, 28)).toISOString().slice(0, 10);
    payrolls.push({ payroll_id: `P${i}`, period: mois, total_cost: 10000 });
  }
  return { orders, payrolls };
};

test("ANO-04 : 6 mois de ventes, 12 mois de paie → résultat et ratio RH sur les 6 mois communs", () => {
  const k = calcul(ventesEtPaie(), ["total_revenue", "payroll_total", "net_income", "rh_expense_ratio", "total_charges", "net_margin_pct"]);
  assert.equal(k.total_revenue.v, 360000, "le CA seul garde sa période");
  assert.equal(k.payroll_total.v, 120000, "la paie seule garde sa période");
  assert.equal(k.net_income.v, 360000 - 180000 - 60000);
  assert.deepEqual(k.net_income.r.periodeCommune, { debut: "2026-01", fin: "2026-06", mois: 6 });
  assert.equal(Math.round(k.rh_expense_ratio.v * 100) / 100, 16.67);
  assert.equal(k.total_charges.v, 180000 + 60000, "charges sur la même période que le résultat");
  assert.equal(k.net_margin_pct.v, (120000 / 360000) * 100);
});

test("ANO-04 : sources sur la même période → aucun réalignement", () => {
  const d = ventesEtPaie();
  d.payrolls = d.payrolls.filter((p) => p.period >= "2026-01");
  const k = calcul(d, ["net_income"]);
  assert.equal(k.net_income.v, 120000);
  assert.equal(k.net_income.r.periodeCommune, undefined);
});

test("ANO-04 : aucun mois commun → non mesuré, jamais ventes d'une année moins paie d'une autre", () => {
  const data = {
    orders: [{ order_id: "O1", date: "2025-03-15", total_revenue: 1000, cost: 100, status: "completed" }],
    payrolls: [{ payroll_id: "P1", period: "2026-03-31", total_cost: 500 }],
  };
  const k = calcul(data, ["net_income", "rh_expense_ratio"]);
  assert.equal(k.net_income.v, null);
  assert.equal(k.net_income.s, "NOT_MEASURED");
  assert.equal(k.rh_expense_ratio.v, null);
});

// ── ANO-07 : ARPC = CA des ventes rattachées à un client / acheteurs distincts ──

test("ANO-07 : fichier clients seul (aucune vente) → ARPC et LTV non mesurés, jamais 0 $", () => {
  const customers = [{ customer_id: "C1", status: "actif" }, { customer_id: "C2", status: "actif" }, { customer_id: "C3", status: "inactif" }];
  const k = calcul({ customers }, ["arpu", "ltv"]);
  assert.equal(k.arpu.v, null);
  assert.equal(k.arpu.s, "NOT_MEASURED");
  assert.equal(k.ltv.v, null);
});

test("ANO-07 : ARPC sur les acheteurs de la période, quel que soit leur statut CRM", () => {
  const orders = [
    { order_id: "O1", date: "2026-06-01", total_revenue: 100, customer_id: "C1", status: "completed" },
    { order_id: "O2", date: "2026-06-02", total_revenue: 200, customer_id: "C1", status: "completed" },
    { order_id: "O3", date: "2026-06-03", total_revenue: 300, customer_id: "C2", status: "completed" },
    { order_id: "O4", date: "2026-06-04", total_revenue: 500, status: "completed" },
    { order_id: "O5", date: "2026-06-05", total_revenue: 900, customer_id: "C3", status: "cancelled" },
    { order_id: "O6", date: "2026-06-06", total_revenue: -50, quantity: -1, customer_id: "C1", status: "" },
  ];
  const customers = [{ customer_id: "C1", status: "actif" }, { customer_id: "C2", status: "inactif" }, { customer_id: "C9", status: "actif" }];
  const k = calcul({ orders, customers }, ["arpu"]);
  assert.equal(k.arpu.v, (100 + 200 + 300 - 50) / 2, "vente sans client, commande annulée et clients sans achat exclus ; avoir déduit");
  assert.equal(k.arpu.s, "MEASURED");
});

test("ANO-07 : ventes sans aucun client identifié → ARPC non mesuré", () => {
  const orders = [{ order_id: "O1", date: "2026-06-01", total_revenue: 100, status: "completed" }];
  assert.equal(calcul({ orders }, ["arpu"]).arpu.v, null);
});

// ── ANO-16 : la période d'une paie est lue, pas recopiée comme du texte ─────

import { preparerPeriodes, kpisParFenetre } from "../src/lib/core/kpiPeriodes.js";

test("ANO-16 import : Payroll.period ramené à AAAA-MM (ou date ISO)", () => {
  const props = getSchema("Payroll").properties;
  const lu = (period) => normalizeRow("Payroll", { employee_id: "E1", period, total_cost: 1 }, "i", props).period;
  assert.equal(lu("Janvier 2026"), "2026-01");
  assert.equal(lu("janv. 2026"), "2026-01");
  assert.equal(lu("July 2026"), "2026-07");
  assert.equal(lu("01/2026"), "2026-01");
  assert.equal(lu("2026/3"), "2026-03");
  assert.equal(lu("2026-01"), "2026-01");
  assert.equal(lu("31/01/2026"), "2026-01-31");
  assert.equal(lu("Période 3"), "Période 3", "illisible : gardé tel quel, jamais inventé");
});

test("ANO-16 : une paie datée par la date de paiement entre dans les fenêtres mensuelles", () => {
  const payrolls = [
    { employee_id: "E1", period: "Période 7", payment_date: "2026-07-31", total_cost: 1000 },
    { employee_id: "E1", period: "2026-08", total_cost: 1000 },
  ];
  const f = kpisParFenetre(preparerPeriodes({ payrolls }, { aujourdhui: new Date("2026-09-15") }), ["payroll_total"]);
  assert.equal(f.mois.get("payroll_total").value, 1000, "août");
  assert.equal(f.moisPrec.get("payroll_total").value, 1000, "juillet, lu sur la date de paiement");
});

test("ANO-16 : une paie importée avant la normalisation garde la même empreinte (pas de doublon au réimport)", async () => {
  const { generateFingerprint } = await import("../base44/shared/fingerprint.ts");
  assert.equal(
    generateFingerprint("Payroll", { employee_id: "E1", period: "Janvier 2026" }),
    generateFingerprint("Payroll", { employee_id: "E1", period: "2026-01" }),
  );
});

// ── Ingestion CA : Commandes priment sur Transactions, jamais de cumul ─────────

test("Ingestion CA : Commandes priment sur Transactions, jamais de cumul", () => {
  // 1. Transactions seules
  const onlyTx = {
    transactions: [
      { date: "2026-06-01", amount: 500, type: "income" },
      { date: "2026-06-02", amount: 300, type: "income" },
    ],
  };
  assert.equal(calcul(onlyTx, ["total_revenue"]).total_revenue.v, 800, "CA = transactions quand pas de commandes");

  // 2. Commandes seules
  const onlyOrders = {
    orders: [
      { order_id: "O1", date: "2026-06-01", total_revenue: 1200, status: "completed" },
    ],
  };
  assert.equal(calcul(onlyOrders, ["total_revenue"]).total_revenue.v, 1200, "CA = commandes");

  // 3. Commandes ET Transactions présentes : PAS de cumul, Commandes priment
  const both = {
    orders: [
      { order_id: "O1", date: "2026-06-01", total_revenue: 1200, status: "completed" },
    ],
    transactions: [
      { date: "2026-06-01", amount: 1200, type: "income" },
      { date: "2026-06-02", amount: 500, type: "income" },
    ],
  };
  assert.equal(calcul(both, ["total_revenue"]).total_revenue.v, 1200, "CA = commandes seules, jamais la somme avec transactions");
});

