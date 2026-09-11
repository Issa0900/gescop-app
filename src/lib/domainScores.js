// Shared domain score computation — used by both Dashboard and KPIs page
// to ensure "vue d'ensemble" and KPIs are always synchronized.
//
// Two rules apply to every domain here:
//  1. Scores read RECENT performance (3 complete months), never all-time
//     cumulative totals, which hide a recent downturn behind good history.
//  2. Trends compare COMPLETE months only. The in-progress current month has
//     partial data and would fake a collapse on every metric.

import {
  monthlyAgg,
  monthlyAggComplete,
  dropCurrentMonth,
  lastVal,
  prevVal,
  trendPct,
  trendDir,
  sumLast,
  sumPrev,
  meanOf,
  latestByKey,
} from "@/lib/periods";

function clamp(v) {
  return Math.max(0, Math.min(100, Math.round(v)));
}

/** Apply a trend bonus/penalty to a base score. */
function applyTrend(score, pct, bonus = 8, penalty = 12, threshold = 5) {
  if (pct > threshold) return score + bonus;
  if (pct < -threshold) return score - penalty;
  return score;
}

/** Per-month margin % series from revenue and expense series. */
function marginSeries(revSeries, expSeries) {
  const expMap = {};
  (expSeries || []).forEach((e) => { expMap[e.month] = e.val; });
  return (revSeries || [])
    .filter((r) => r.val > 0)
    .map((r) => ({ month: r.month, val: ((r.val - (expMap[r.month] || 0)) / r.val) * 100 }));
}

export function computeDomainScores(data) {
  const { transactions, orders, customers, campaigns, campaignDaily, products, inventory, cashflow } = data;
  const scores = {};

  // === FINANCE — recent margin (3 complete months) ===
  const incomes = (transactions || []).filter((t) => t.type === "income");
  const txnExpenses = (transactions || []).filter((t) => t.type === "expense");
  const revMonthly = monthlyAggComplete(incomes, "date", "amount");
  const expMonthly = monthlyAggComplete(txnExpenses, "date", "amount");
  const margins = marginSeries(revMonthly, expMonthly);
  const recentMargin = meanOf(margins.slice(-3).map((m) => m.val));
  const currMargin = lastVal(margins);
  const prevMargin = prevVal(margins);

  let financeScore;
  if (recentMargin >= 40) financeScore = 88;
  else if (recentMargin >= 25) financeScore = 72;
  else if (recentMargin >= 10) financeScore = 52;
  else if (recentMargin >= 0) financeScore = 32;
  else financeScore = 15;
  financeScore = applyTrend(financeScore, trendPct(currMargin, prevMargin));
  scores.finance = {
    score: clamp(financeScore),
    trend: trendDir(currMargin, prevMargin),
    explanation: margins.length ? `Marge ${recentMargin.toFixed(0)} % (3 mois)` : "",
  };

  // === TRÉSORERIE — 7-day average vs prior 7 days (day-over-day is noise) ===
  const cfSorted = (cashflow || []).slice().sort((a, b) => (a.date < b.date ? 1 : -1));
  const cash7 = meanOf(cfSorted.slice(0, 7).map((c) => Number(c.closing_cash) || 0));
  const cashPrev7 = meanOf(cfSorted.slice(7, 14).map((c) => Number(c.closing_cash) || 0));
  const latestCash = cfSorted[0]?.closing_cash || 0;
  // Runway: how many months the current balance covers at the recent burn rate.
  const recentBurn = meanOf(expMonthly.slice(-3).map((e) => e.val));
  const runwayMonths = recentBurn > 0 ? latestCash / recentBurn : null;

  let tresoScore;
  if (runwayMonths === null) {
    tresoScore = latestCash > 0 ? 60 : 20;
  } else if (runwayMonths >= 12) tresoScore = 90;
  else if (runwayMonths >= 6) tresoScore = 75;
  else if (runwayMonths >= 3) tresoScore = 55;
  else if (runwayMonths >= 1) tresoScore = 35;
  else tresoScore = 18;
  tresoScore = applyTrend(tresoScore, trendPct(cash7, cashPrev7), 6, 10, 2);
  scores.tresorerie = {
    score: clamp(tresoScore),
    trend: trendDir(cash7, cashPrev7, 1),
    explanation:
      runwayMonths !== null
        ? `${Math.round(latestCash).toLocaleString("fr-CA")} $ · ${runwayMonths.toFixed(1)} mois`
        : `${Math.round(latestCash).toLocaleString("fr-CA")} $`,
  };

  // === VENTES — complete-month revenue and basket trend ===
  const orderRevMonthly = monthlyAggComplete(orders || [], "date", "total");
  const orderCntMonthly = monthlyAggComplete(orders || [], "date", "total", "count");
  // Compare 3-month blocks: less sensitive to a single outlier month.
  const rev3 = sumLast(orderRevMonthly, 3);
  const revPrev3 = sumPrev(orderRevMonthly, 3);
  const revTrend = trendPct(rev3, revPrev3);

  let ventesScore;
  if (revTrend > 15) ventesScore = 85;
  else if (revTrend > 0) ventesScore = 70;
  else if (revTrend > -15) ventesScore = 48;
  else ventesScore = 28;
  const aovCurr = lastVal(orderCntMonthly) > 0 ? lastVal(orderRevMonthly) / lastVal(orderCntMonthly) : 0;
  const aovPrev = prevVal(orderCntMonthly) > 0 ? prevVal(orderRevMonthly) / prevVal(orderCntMonthly) : 0;
  ventesScore = applyTrend(ventesScore, trendPct(aovCurr, aovPrev), 6, 6);
  scores.ventes = {
    score: clamp(ventesScore),
    trend: trendDir(rev3, revPrev3),
    explanation: orderRevMonthly.length ? `${revTrend >= 0 ? "+" : ""}${revTrend.toFixed(0)} % sur 3 mois` : "",
  };

  // === MARKETING — recent ROAS with a real computed trend ===
  // Prefer daily campaign data (it is dated, so it can be windowed);
  // fall back to campaign totals when daily rows are absent.
  const spendMonthly = monthlyAggComplete(campaignDaily || [], "date", "spend");
  const campRevMonthly = monthlyAggComplete(campaignDaily || [], "date", "revenue");
  const hasDaily = spendMonthly.length > 0 && sumLast(spendMonthly, 3) > 0;

  let roas = 0;
  let roasPrev = 0;
  if (hasDaily) {
    const s3 = sumLast(spendMonthly, 3);
    const r3 = sumLast(campRevMonthly, 3);
    const sp3 = sumPrev(spendMonthly, 3);
    const rp3 = sumPrev(campRevMonthly, 3);
    roas = s3 > 0 ? r3 / s3 : 0;
    roasPrev = sp3 > 0 ? rp3 / sp3 : 0;
  } else {
    const totalSpend = (campaigns || []).reduce((s, c) => s + (Number(c.spend) || 0), 0);
    const totalCampRev = (campaigns || []).reduce((s, c) => s + (Number(c.revenue) || 0), 0);
    roas = totalSpend > 0 ? totalCampRev / totalSpend : 0;
  }

  let marketingScore;
  if (roas >= 4) marketingScore = 88;
  else if (roas >= 2) marketingScore = 72;
  else if (roas >= 1) marketingScore = 50;
  else if (roas > 0) marketingScore = 28;
  else marketingScore = 50;
  if (roasPrev > 0) marketingScore = applyTrend(marketingScore, trendPct(roas, roasPrev), 6, 10);
  scores.marketing = {
    score: clamp(marketingScore),
    // Real trend when a comparison window exists — never inferred from the level.
    trend: roasPrev > 0 ? trendDir(roas, roasPrev) : "stable",
    explanation: roas > 0 ? `ROAS ${roas.toFixed(1)}x` : "",
  };

  // === OPÉRATIONS — latest stock snapshot per product, not every history row ===
  const latestInv = latestByKey(inventory || [], "product_id", "date");
  const trackedCount = latestInv.length;
  const dormantCount = latestInv.filter((i) => i.stock_status === "dormant").length;
  const ruptureCount = latestInv.filter((i) => ["rupture", "proche_rupture"].includes(i.stock_status)).length;
  const lowCount = latestInv.filter((i) => i.stock_status === "faible").length;
  // Ratio over products actually tracked, not the full catalogue.
  const issueRatio = trackedCount > 0 ? (dormantCount + ruptureCount) / trackedCount : 0;

  let opsScore;
  if (trackedCount === 0) opsScore = 50;
  else if (issueRatio === 0) opsScore = 82;
  else if (issueRatio < 0.1) opsScore = 68;
  else if (issueRatio < 0.25) opsScore = 48;
  else opsScore = 28;
  scores.operations = {
    score: clamp(opsScore),
    trend: ruptureCount > 0 ? "down" : "stable",
    explanation: trackedCount > 0 ? `${ruptureCount} ruptures · ${dormantCount} dormants` : "",
    details: { trackedCount, dormantCount, ruptureCount, lowCount },
  };

  // === CLIENTS — churn plus complete-month acquisition trend ===
  const totalCustomers = (customers || []).length;
  const activeCustomers = (customers || []).filter((c) => c.status === "actif").length;
  const churnedCustomers = (customers || []).filter((c) => c.status === "inactif" || c.status === "perdu").length;
  const churnRate = totalCustomers > 0 ? (churnedCustomers / totalCustomers) * 100 : 0;
  const custMonthly = monthlyAggComplete(customers || [], "acquisition_date", "customer_id", "count");
  const new3 = sumLast(custMonthly, 3);
  const newPrev3 = sumPrev(custMonthly, 3);

  let clientsScore;
  if (churnRate < 5) clientsScore = 85;
  else if (churnRate < 10) clientsScore = 70;
  else if (churnRate < 20) clientsScore = 50;
  else clientsScore = 30;
  clientsScore = applyTrend(clientsScore, trendPct(new3, newPrev3), 8, 8);
  scores.clients = {
    score: clamp(clientsScore),
    trend: trendDir(new3, newPrev3),
    explanation: totalCustomers > 0 ? `${activeCustomers} actifs · ${churnRate.toFixed(0)} % churn` : "",
  };

  return scores;
}