// Instantane des chiffres que l'utilisateur voit, pour l'analyse IA.
//
// L'IA recevait un contexte construit cote serveur avec ses propres totaux
// (businessContext.ts) et renvoyait des KPI qu'elle avait elle-meme calcules,
// affiches ensuite comme des indicateurs. Desormais l'ecran lui transmet les
// KPI du moteur et les croisements deterministes : elle commente ces chiffres,
// elle ne les recalcule pas.

import { preparerPeriodes, kpisParFenetre } from "./kpiPeriodes";
import { detecterCroisements } from "./croisements";
import { latestCashBalance, consommationTresorerie, runwayMonths } from "../metrics";
import { financialMonthlySeries } from "../financialData";
import { getKpiDefinition } from "./kpiRegistry";

const IDS = [
  "total_revenue", "order_revenue", "total_charges", "cogs_total", "total_expense", "payroll_total",
  "net_income", "net_margin_pct", "gross_margin_pct", "order_count", "aov", "return_rate",
  "active_customers", "churn_rate", "roas", "cac", "employee_count", "rh_expense_ratio",
  "revenue_per_employee", "inventory_value_total",
];

const unite = (def) => (def?.dataType === "currency" ? "$" : def?.dataType === "percentage" ? "%" : "");

export function instantaneKpi(data, { aujourdhui = new Date() } = {}) {
  const prep = preparerPeriodes(data, { aujourdhui });
  const fen = kpisParFenetre(prep, IDS);
  const periodes = [["total", "période importée", fen.total], ["trim", "3 derniers mois complets", fen.trim], ["mois", `dernier mois complet (${fen.dernierMois || "-"})`, fen.mois]];
  const chiffres = [];
  for (const id of IDS) {
    const def = getKpiDefinition(id);
    for (const [cle, libelle, m] of periodes) {
      const r = m?.get(id);
      if (!r) continue;
      if (cle !== "total" && !def?.isAdditive && !["net_margin_pct", "aov", "roas"].includes(id)) continue;
      const v = Number.isFinite(r.value) ? Math.round(r.value * 100) / 100 : null;
      chiffres.push({ id, nom: def?.name?.fr || id, periode: libelle, valeur: v, unite: unite(def), statut: v === null ? "non mesuré" : r.status === "UNKNOWN" ? "partiel" : "mesuré" });
    }
  }
  const solde = latestCashBalance(data.cashflow);
  if (solde !== null) {
    const serie = financialMonthlySeries(data);
    const { burn, base } = consommationTresorerie({
      cashflow: data.cashflow,
      revSeries: serie.map((p) => ({ month: p.month, val: p.income })),
      expSeries: serie.map((p) => ({ month: p.month, val: p.decaissements })),
    }, 3);
    const autonomie = runwayMonths(solde, burn);
    chiffres.push({ id: "cash_balance", nom: "Trésorerie (dernier solde du relevé)", periode: "actuel", valeur: Math.round(solde), unite: "$", statut: "mesuré" });
    chiffres.push({ id: "runway", nom: "Autonomie de trésorerie", periode: "3 derniers mois", valeur: autonomie === Infinity ? "autofinancée" : Number.isFinite(autonomie) ? Math.round(autonomie * 10) / 10 : null, unite: "mois", statut: base === "releve" ? "mesuré (relevé)" : "estimé (résultat)" });
  }
  return { chiffres, constats: detecterCroisements(data, { aujourdhui }), dernierMois: fen.dernierMois };
}
