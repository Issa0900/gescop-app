// Single source of truth for every business definition used in the app.
//
// Before this module the same indicator was computed differently on each page:
// four churn rates (two of them counting "a_risque" clients as already lost),
// three LTVs (one dividing revenue from ALL customers by ACTIVE customers only,
// which doubles the figure when half the base has churned), and two margins
// (a mean of monthly percentages vs. an aggregated margin - 23% vs 10% on the
// same data). A dashboard that contradicts its own audit page is worse than no
// dashboard, so every definition now lives here and every page imports it.

import { montantHT, commandeHorsCA } from "./core/kpiRecords";
import { sumLast, sumPrev, meanOf, trendPct } from "@/lib/periods";
import { computeKpi, computeKpiBatch } from "@/lib/core/kpiEngine";
import { KPI_REGISTRY, getKpiDefinition, getKpisByDomain } from "@/lib/core/kpiRegistry";
import { indexClients, clientDeCommande } from "./rapprochementClients";

export {
  computeKpi,
  computeKpiBatch,
  KPI_REGISTRY,
  getKpiDefinition,
  getKpisByDomain
};

const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);

/* ------------------------------------------------------------------ */
/* Marge                                                               */
/* ------------------------------------------------------------------ */

/**
 * Aggregated margin over the last n complete months: (revenus − dépenses) ÷ revenus.
 *
 * NOT the mean of the monthly margin percentages. A month at 2 000 $ of revenue
 * must not weigh as much as a month at 100 000 $ - on a real series the two
 * methods differ by more than a factor of two.
 *
 * Returns null when there is no revenue to divide by.
 */
export function aggregateMarginPct(revSeries, expSeries, n = 3) {
  const rev = sumLast(revSeries, n);
  const exp = sumLast(expSeries, n);
  if (rev === null || exp === null || rev <= 0) return null;
  return ((rev - exp) / rev) * 100;
}

/** Same metric over the n months preceding the last n - null if not covered. */
export function previousMarginPct(revSeries, expSeries, n = 3) {
  const rev = sumPrev(revSeries, n);
  const exp = sumPrev(expSeries, n);
  if (rev === null || exp === null || rev <= 0) return null;
  return ((rev - exp) / rev) * 100;
}

/**
 * Change in margin expressed in POINTS, not in percent of a percent.
 * Going from 2% to 4% is +2 points, not "+100% growth" - the relative reading
 * used to hand out a full trend bonus for a two-point move on a thin margin.
 */
export function marginDeltaPoints(currPct, prevPct) {
  if (currPct === null || prevPct === null) return null;
  return currPct - prevPct;
}

/**
 * Taux de marge brute d'un produit en POURCENTAGE (ex: 41.4 pour 41,4 %).
 * Gère automatiquement :
 *  1. Les ratios décimaux issus d'Excel (ex: 0.4139 converti en 41.39 %).
 *  2. Les marges déjà exprimées en % (ex: 41.39 conservé tel quel).
 *  3. Le repli sur le calcul direct (prix de vente - coût d'achat) / prix si la marge est absente.
 */
export function productMarginPct(p) {
  if (!p) return null;
  const raw = p.gross_margin != null ? Number(p.gross_margin) : null;
  const cost = Number(p.purchase_cost ?? p.unit_cost) || 0;
  const price = Number(p.selling_price ?? p.unit_price) || 0;

  if (price > 0 && cost > 0) {
    const marginDollar = price - cost;
    const marginRatePct = (marginDollar / price) * 100;
    if (raw !== null && Number.isFinite(raw) && raw !== 0) {
      if (raw >= -1 && raw <= 1) {
        return raw * 100;
      }
      // Si la valeur dépasse 100 % ou correspond au profit brut en dollars (price - cost),
      // il s'agit d'un montant en $ issu de l'export qu'il faut ramener au taux de marge.
      if (raw > 100 || Math.abs(raw - marginDollar) < 1.0) {
        return marginRatePct;
      }
      return raw;
    }
    return marginRatePct;
  }

  if (raw !== null && Number.isFinite(raw) && raw !== 0) {
    if (raw >= -1 && raw <= 1) {
      return raw * 100;
    }
    return raw;
  }
  return raw !== null && Number.isFinite(raw) ? raw : null;
}


/* ------------------------------------------------------------------ */
/* Trésorerie                                                          */
/* ------------------------------------------------------------------ */

/**
 * Net monthly burn: how much cash the business actually consumes once revenue
 * is taken into account. Dividing the balance by GROSS expenses told a
 * profitable company it had "2.4 months left" and fired a critical alert.
 *
 * Returns 0 when the business is cash-generating (no burn → infinite runway).
 */
export function netBurnRate(revSeries, expSeries, n = 3) {
  const rev = sumLast(revSeries, n);
  const exp = sumLast(expSeries, n);
  if (exp === null) return null;
  const months = Math.min(n, (expSeries || []).length) || 1;
  const net = (exp - (rev === null ? 0 : rev)) / months;
  return net > 0 ? net : 0;
}

/**
 * Flux net de TRESORERIE par mois, lu dans le releve importe : net_cash_flow,
 * sinon entrees - sorties, sinon variation du solde de cloture d'un mois a
 * l'autre. Mois en cours et mois futurs exclus (non realises).
 */
export function fluxTresorerieMensuels(cashflow, aujourdhui = new Date()) {
  const courant = `${aujourdhui.getFullYear()}-${String(aujourdhui.getMonth() + 1).padStart(2, "0")}`;
  const lignes = (cashflow || []).filter((c) => /^\d{4}-\d{2}/.test(String(c?.date || ""))).slice()
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  const aUnFlux = lignes.some((c) => c.net_cash_flow != null && c.net_cash_flow !== "" || c.cash_in != null || c.cash_out != null);
  const parMois = new Map();
  for (const c of lignes) {
    const m = c.date.slice(0, 7);
    const p = parMois.get(m) || { month: m, net: 0, solde: null };
    if (aUnFlux) {
      const net = c.net_cash_flow != null && c.net_cash_flow !== "" ? num(c.net_cash_flow) : num(c.cash_in) - num(c.cash_out);
      p.net += net;
    }
    if (c.closing_cash != null && c.closing_cash !== "") p.solde = num(c.closing_cash);
    parMois.set(m, p);
  }
  let mois = [...parMois.values()].filter((p) => p.month < courant);
  if (!aUnFlux) {
    // Soldes seulement : le flux du mois est la variation du solde de cloture.
    const avecSolde = mois.filter((p) => p.solde !== null);
    mois = avecSolde.slice(1).map((p, i) => ({ month: p.month, net: p.solde - avecSolde[i].solde, solde: p.solde }));
  }
  return mois;
}

/**
 * Consommation mensuelle de tresorerie : UNE regle pour l'autonomie affichee
 * partout (KPI, audit, alertes, score du domaine). Le solde vient du releve de
 * tresorerie ; la consommation doit venir du MEME releve. La page KPI divisait
 * le solde par une perte comptable (charges - revenus) : 6 mois d'autonomie
 * annonces pour une tresorerie qui augmentait de 8 782 $ par mois. Sans releve
 * de flux, le resultat comptable sert de repli, et `base` le dit.
 * @returns {{ burn: number|null, base: "releve"|"resultat"|null }}
 */
export function consommationTresorerie({ cashflow, revSeries, expSeries }, n = 3) {
  const flux = fluxTresorerieMensuels(cashflow);
  if (flux.length > 0) {
    const recents = flux.slice(-n);
    const moyenne = recents.reduce((s, p) => s + p.net, 0) / recents.length;
    return { burn: moyenne < 0 ? -moyenne : 0, base: "releve" };
  }
  const burn = netBurnRate(revSeries, expSeries, n);
  return { burn, base: burn === null ? null : "resultat" };
}

/**
 * Months of runway. null = not computable, Infinity = profitable (no burn).
 * Callers must handle Infinity explicitly instead of printing a number.
 */
export function runwayMonths(cash, burn) {
  if (burn === null || burn === undefined) return null;
  // Une tresorerie nulle ou negative n'a aucune autonomie, meme si l'activite
  // degage du cash : annoncer "tresorerie autofinancee" a une entreprise a
  // decouvert est le pire contresens que puisse faire un outil de pilotage.
  if (num(cash) <= 0) return 0;
  if (burn <= 0) return Infinity;
  return num(cash) / burn;
}

export function fmtRunway(months) {
  if (months === null || months === undefined) return "-";
  if (months === Infinity) return "trésorerie autofinancée";
  return `${months.toFixed(1)} mois`;
}

/** Latest closing balance from a cashflow series, defensively typed. */
export function latestCashBalance(cashflow) {
  const sorted = (cashflow || []).slice().sort((a, b) => ((a.date || "") < (b.date || "") ? 1 : -1));
  if (sorted.length === 0) return null;
  return num(sorted[0].closing_cash);
}

/* ------------------------------------------------------------------ */
/* Clients                                                             */
/* ------------------------------------------------------------------ */

/**
 * One churn definition for the whole app: a client is churned when its STATUS
 * says so. "a_risque" is a client still buying - counting it as lost inflated
 * the rate on the Clients page and in every AI report while the KPI page showed
 * a lower one from the same rows.
 */
export const DEFAULT_INACTIVE_MONTHS = 6;

/** "2026-09" moved back n months. */
function shiftMonthKey(key, n) {
  const [y, m] = key.split("-").map(Number);
  const total = y * 12 + (m - 1) + n;
  return `${Math.floor(total / 12)}-${String((total % 12) + 1).padStart(2, "0")}`;
}

/**
 * @deprecated GESCOP Phase 3 SSOT : Ce calcul comportemental décentralisé doit être abandonné.
 * Veuillez consommer `churn_rate` via `useKpiEngine()`.
 */
export function churnStats(customers, orders, inactiveMonths = DEFAULT_INACTIVE_MONTHS) {
  const rows = customers || [];
  const total = rows.length;
  const churned = rows.filter((c) => ["inactif", "inactive", "perdu", "lost"].includes(String(c.status || "").toLowerCase())).length;
  const active = rows.filter((c) => ["actif", "active"].includes(String(c.status || "").toLowerCase())).length;
  // Tracked separately: at-risk clients are a leading indicator, not churn.
  const atRisk = rows.filter((c) => {
    if (c.status !== "actif") return false;
    const r = Number(c.churn_risk);
    return Number.isFinite(r) && (r > 1 ? r / 100 : r) >= 0.7;
  }).length;
  // --- Attrition mesurée sur le COMPORTEMENT d'achat ---
  //
  // The status-based rate above is a CUMULATIVE share: every customer ever lost,
  // over the whole base. It only grows as the base ages, it cannot be compared
  // month to month, and it says nothing about what is happening now. Calling it
  // a "taux de churn" oversold it - a rate is measured over a period.
  //
  // This one is: among customers who have ever ordered, how many have stopped
  // buying over the chosen window. Computable whenever order history exists,
  // and it moves when the window moves.
  const months = Math.max(1, Number(inactiveMonths) || DEFAULT_INACTIVE_MONTHS);
  const ord = orders || [];
  // Avec un fichier clients, « clients ayant commande » ne compte que des
  // clients de ce fichier, retrouves par identifiant, courriel ou nom
  // (rapprochementClients.js). Sans cela, les commandes de clients absents
  // (autres imports, restes d'une purge) donnaient « 1 336 sur 1 491 clients »
  // pour 30 clients reels (rapport du 25 sept., lot 4.2).
  const indexCli = rows.length > 0 ? indexClients(rows) : null;
  const clientDe = (o) => (indexCli ? clientDeCommande(o, indexCli) : o.customer_id || null);
  const hasOrders = ord.some((o) => o.date && clientDe(o));
  let buyers = null;
  let lapsed = null;
  let behaviourRate = null;
  if (hasOrders) {
    const now = new Date().toISOString().slice(0, 7);
    const cutoff = shiftMonthKey(now, -months);
    const everBought = new Set();
    const boughtRecently = new Set();
    ord.forEach((o) => {
      const m = (o.date || "").slice(0, 7);
      const cid = clientDe(o);
      if (!cid || !m) return;
      everBought.add(cid);
      // The month in progress counts as recent activity, unlike trend windows:
      // a purchase yesterday obviously means the customer has not lapsed.
      if (m >= cutoff) boughtRecently.add(cid);
    });
    buyers = everBought.size;
    lapsed = [...everBought].filter((id) => !boughtRecently.has(id)).length;
    behaviourRate = buyers > 0 ? (lapsed / buyers) * 100 : null;
  }

  // A base where NO customer carries "actif", "inactif" or "perdu" is not a
  // base with 0 % churn - it is a status column that was never filled in.
  // Without this guard, an unpopulated status field reads as a perfect churn
  // score everywhere `rate` is consumed (domain score, KPI page, audit).
  const statusMeasured = active > 0 || churned > 0;

  return {
    total,
    active,
    churned,
    atRisk,
    // Cumulative share of the base marked lost - NOT a period rate.
    // null when there is no base, OR when the status field carries no signal.
    rate: total > 0 && statusMeasured ? (churned / total) * 100 : null,
    statusMeasured,
    // Period attrition from real purchase behaviour. null = not computable.
    inactiveMonths: months,
    buyers,
    lapsed,
    behaviourRate,
    measurable: hasOrders,
  };
}

/**
 * A refunded order's money went back to the customer - it must not count as
 * revenue. Matches the same three columns already used to compute the
 * "Taux de retour" KPI, so revenue and return rate agree on what happened
 * instead of one excluding refunds and the other silently including them.
 */
export function isRefundedOrder(o) {
  return Boolean(
    (o.return_status && o.return_status !== "aucun") ||
    o.payment_status === "rembourse" ||
    o.fulfillment_status === "retourne"
  );
}

/** Orders that represent real, kept revenue - refunds excluded. */
export function validSalesOrders(orders) {
  // Meme regle que le moteur KPI (kpiRecords.commandeHorsCA) : annulees et
  // retournees exclues aussi, pas seulement les remboursees.
  return (orders || []).filter((o) => !isRefundedOrder(o) && !commandeHorsCA(o));
}

/**
 * Average revenue per customer, and a margin-adjusted LTV when the margin is known.
 *
 * The numerator covers every customer that ordered, so the denominator must too.
 * Dividing all-customer revenue by ACTIVE customers only was inflating the
 * figure by 1/(share of active) - a 2x overstatement at 50% churn.
 */
/**
 * @deprecated GESCOP Phase 3 SSOT : Utilisez `ltv` via `useKpiEngine()`.
 * Le calcul historique sur l'ensemble de la base faussait l'analyse périodique.
 */
export function customerValue(orders, customers, marginPct = null) {
  const ord = validSalesOrders(orders);
  const totalRevenue = ord.reduce((s, o) => s + (Number.isFinite(montantHT(o)) ? montantHT(o) : Number(o.revenue_amount) || 0), 0);
  const buyers = new Set(ord.map((o) => o.customer_id).filter(Boolean)).size;
  const totalCustomers = (customers || []).length;
  // Prefer customers who actually ordered; fall back to the whole base.
  const denominator = buyers > 0 ? buyers : totalCustomers;
  const avgRevenue = denominator > 0 ? totalRevenue / denominator : null;
  return {
    totalRevenue,
    buyers,
    avgRevenue,
    // A real LTV is value, not turnover: apply the margin when we have one.
    ltv: avgRevenue !== null && marginPct !== null ? avgRevenue * (marginPct / 100) : null,
  };
}

/* ------------------------------------------------------------------ */
/* Marketing                                                           */
/* ------------------------------------------------------------------ */

/** ROAS over the last n complete months from dated daily rows. */
export function roasWindow(spendSeries, revSeries, n = 3) {
  const spend = sumLast(spendSeries, n);
  const rev = sumLast(revSeries, n);
  if (spend === null || rev === null || spend <= 0) return null;
  return rev / spend;
}

export function previousRoasWindow(spendSeries, revSeries, n = 3) {
  const spend = sumPrev(spendSeries, n);
  const rev = sumPrev(revSeries, n);
  if (spend === null || rev === null || spend <= 0) return null;
  return rev / spend;
}

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

/**
 * True when at least one row actually carries a value for this column.
 *
 * Imports routinely omit columns: `new_customers`, `churn_risk`, `cost`,
 * `inventory_value` were all empty in a real file. Every metric built on such a
 * column collapsed to 0 and was displayed as a fact - "CAC 0 $" next to 623 667 $
 * of spend, "0 % de risque" on every client. Zero and unknown are different
 * answers, and only one of them is honest here.
 */
export function columnPresent(rows, field) {
  return (rows || []).some((r) => {
    const v = r?.[field];
    return v !== null && v !== undefined && v !== "";
  });
}

/** True when at least one of several columns carries a value. */
export function anyColumnPresent(rows, fields) {
  return (fields || []).some((f) => columnPresent(rows, f));
}

export { trendPct, meanOf };
