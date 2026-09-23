import { isIncome, isExpense, txAmount } from "@/lib/transactionClassifier";
import { preparerPeriodes, serieMensuelle, kpisTotal } from "@/lib/core/kpiPeriodes";
import { memoDonnees, complementMois } from "@/lib/core/memoDonnees";

/**
 * Recettes, charges et resultat PAR MOIS, calcules par le moteur KPI.
 *
 * Ce module avait sa propre definition des « depenses » (depenses seules, cout
 * des ventes seulement faute de depense bancaire, jamais la paie), en parallele
 * de celle du moteur (cout des ventes + depenses + paie). Neuf ecrans en
 * dependaient : la page KPI affichait une marge nette de -95 % quand Finance
 * affichait -391 % pour les memes donnees. Il n'y a plus qu'une definition :
 * income = total_revenue, expense = total_charges, margin = income - expense
 * = net_income du moteur, mois par mois.
 *
 * `data` : le meme objet que useKpiEngine (transactions, orders, expenses,
 * payrolls, executiveSummary...). Les alias `payroll` et `executiveSummaries`
 * de certains ecrans sont acceptes.
 */
function normaliser(data = {}) {
  return {
    ...data,
    payrolls: data.payrolls ?? data.payroll ?? [],
    executiveSummary: data.executiveSummary ?? data.executiveSummaries ?? [],
  };
}

export function prepareTransactions(transactions) {
  const rows = transactions || [];
  return {
    incomes: rows.filter(isIncome).map((row) => ({ ...row, _amount: txAmount(row, "income") })),
    expenses: rows.filter(isExpense).map((row) => ({ ...row, _amount: txAmount(row, "expense") })),
  };
}

const IDS = ["total_revenue", "total_charges"];

/** Totaux du moteur (toute la periode importee). */
export function financialSummary(data) {
  const res = kpisTotal(preparerPeriodes(normaliser(data)), [...IDS, "net_income", "net_margin_pct"]);
  const v = (id) => { const x = res.get(id)?.value; return Number.isFinite(x) ? x : null; };
  return { revenue: v("total_revenue"), expense: v("total_charges"), netIncome: v("net_income"), marginPct: v("net_margin_pct") };
}

/**
 * @param {Object} data - { transactions, orders, expenses, payrolls, executiveSummary, ... }
 * @returns {{month: string, income: number, expense: number, margin: number, chargesMesurees: boolean}[]}
 */
function financialMonthlySeriesBrut(data) {
  if (Array.isArray(data)) {
    throw new Error("financialMonthlySeries attend l'objet de donnees du moteur ({ transactions, orders, expenses, payrolls, ... }).");
  }
  const d = normaliser(data);
  const serie = serieMensuelle(preparerPeriodes(d), IDS);
  const points = serie
    .map((p) => {
      const income = p.total_revenue ?? 0;
      const expense = p.total_charges ?? 0;
      return { month: p.month, income, expense, margin: income - expense, chargesMesurees: p.total_charges != null };
    });
  if (points.some((p) => p.income > 0 || p.expense > 0)) return points;
  // Aucune vente ni transaction : la synthese du fichier sert d'affichage
  // (valeur de controle, jamais additionnee aux ventes).
  const parMois = new Map();
  for (const e of d.executiveSummary || []) {
    const m = String(e?.date ?? "").slice(0, 7);
    if (!/^\d{4}-\d{2}$/.test(m)) continue;
    const p = parMois.get(m) || { month: m, income: 0, expense: 0 };
    p.income += Number(e?.total_revenue) || Number(e?.total) || 0;
    p.expense += Number(e?.total_cost) || Number(e?.cost) || 0;
    parMois.set(m, p);
  }
  if (parMois.size === 0) return points;
  return [...parMois.values()].sort((a, b) => (a.month < b.month ? -1 : 1))
    .map((p) => ({ ...p, margin: p.income - p.expense, chargesMesurees: true }));
}


// Meme calcul pour tous les ecrans qui partagent les memes donnees (memoDonnees).
export const financialMonthlySeries = memoDonnees(financialMonthlySeriesBrut, complementMois);
