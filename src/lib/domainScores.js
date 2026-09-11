// Shared domain score computation — used by both Dashboard and KPIs page
// to ensure "vue d'ensemble" and KPIs are always synchronized.

function clamp(v) {
  return Math.max(0, Math.min(100, Math.round(v)));
}

function monthlyAgg(items, dateField, valueField, mode = "sum") {
  const map = {};
  (items || []).forEach((it) => {
    const m = (it[dateField] || "").slice(0, 7);
    if (!m) return;
    if (!map[m]) map[m] = 0;
    const v = Number(it[valueField]) || 0;
    if (mode === "sum") map[m] += v;
    else if (mode === "count") map[m] += 1;
    else if (mode === "last") map[m] = v;
  });
  return Object.entries(map)
    .sort((a, b) => (a[0] < b[0] ? -1 : 1))
    .map(([month, val]) => ({ month, val }));
}

function lastVal(arr) { return arr.length > 0 ? arr[arr.length - 1].val : 0; }
function prevVal(arr) { return arr.length > 1 ? arr[arr.length - 2].val : 0; }
function trendPct(curr, prev) { return prev > 0 ? ((curr - prev) / prev) * 100 : 0; }
function trendDir(curr, prev) { if (curr > prev) return "up"; if (curr < prev) return "down"; return "stable"; }

export function computeDomainScores(data) {
  const { transactions, orders, customers, campaigns, products, inventory, cashflow, expenses } = data;
  const scores = {};

  // === FINANCE ===
  const incomes = (transactions || []).filter((t) => t.type === "income");
  const txnExpenses = (transactions || []).filter((t) => t.type === "expense");
  const totalIncome = incomes.reduce((s, t) => s + (t.amount || 0), 0);
  const totalExpenses = txnExpenses.reduce((s, t) => s + (t.amount || 0), 0);
  const marginPct = totalIncome > 0 ? ((totalIncome - totalExpenses) / totalIncome) * 100 : 0;
  const revMonthly = monthlyAgg(incomes, "date", "amount");
  const expMonthly = monthlyAgg(txnExpenses, "date", "amount");
  const currMargin = lastVal(revMonthly) > 0 ? ((lastVal(revMonthly) - lastVal(expMonthly)) / lastVal(revMonthly)) * 100 : 0;
  const prevMargin = prevVal(revMonthly) > 0 ? ((prevVal(revMonthly) - prevVal(expMonthly)) / prevVal(revMonthly)) * 100 : 0;
  const marginTrend = trendPct(currMargin, prevMargin);
  // Score based on recent margin (3-month moving average) instead of cumulative margin
  const recentMargins = [];
  for (let i = Math.max(0, revMonthly.length - 3); i < revMonthly.length; i++) {
    if (revMonthly[i].val > 0) {
      const m = ((revMonthly[i].val - (expMonthly[i]?.val || 0)) / revMonthly[i].val) * 100;
      recentMargins.push(m);
    }
  }
  const recentMargin = recentMargins.length > 0
    ? recentMargins.reduce((a, b) => a + b, 0) / recentMargins.length
    : marginPct;
  let financeScore = 50;
  if (recentMargin >= 40) financeScore = 88;
  else if (recentMargin >= 25) financeScore = 72;
  else if (recentMargin >= 10) financeScore = 52;
  else if (recentMargin >= 0) financeScore = 32;
  else financeScore = 15;
  if (marginTrend > 5) financeScore += 8;
  else if (marginTrend < -5) financeScore -= 12;
  scores.finance = {
    score: clamp(financeScore),
    trend: trendDir(currMargin, prevMargin),
    explanation: `Marge ${recentMargin.toFixed(0)}% (3 mois)`,
  };

  // === TRÉSORERIE ===
  const latestCash = (cashflow || [])[0]?.closing_cash || 0;
  const prevCash = (cashflow || [])[1]?.closing_cash || 0;
  const cashTrend = prevCash !== 0 ? ((latestCash - prevCash) / Math.abs(prevCash)) * 100 : 0;
  let tresoScore = 50;
  if (latestCash > 50000) tresoScore = 88;
  else if (latestCash > 10000) tresoScore = 72;
  else if (latestCash > 0) tresoScore = 55;
  else tresoScore = 20;
  if (cashTrend > 5) tresoScore += 8;
  else if (cashTrend < -5) tresoScore -= 12;
  scores.tresorerie = {
    score: clamp(tresoScore),
    trend: trendDir(latestCash, prevCash),
    explanation: `${Math.round(latestCash).toLocaleString("fr-CA")} $`,
  };

  // === VENTES ===
  const orderRevMonthly = monthlyAgg(orders || [], "date", "total");
  const orderCntMonthly = monthlyAgg(orders || [], "date", "total", "count");
  const revTrend = trendPct(lastVal(orderRevMonthly), prevVal(orderRevMonthly));
  let ventesScore = 50;
  if (revTrend > 15) ventesScore = 85;
  else if (revTrend > 0) ventesScore = 70;
  else if (revTrend > -15) ventesScore = 48;
  else ventesScore = 28;
  const aovCurr = lastVal(orderCntMonthly) > 0 ? lastVal(orderRevMonthly) / lastVal(orderCntMonthly) : 0;
  const aovPrev = prevVal(orderCntMonthly) > 0 ? prevVal(orderRevMonthly) / prevVal(orderCntMonthly) : 0;
  const aovTrend = trendPct(aovCurr, aovPrev);
  if (aovTrend > 5) ventesScore += 6;
  else if (aovTrend < -5) ventesScore -= 6;
  scores.ventes = {
    score: clamp(ventesScore),
    trend: trendDir(lastVal(orderRevMonthly), prevVal(orderRevMonthly)),
    explanation: orders?.length ? `${orders.length} commandes` : "",
  };

  // === MARKETING ===
  const totalSpend = (campaigns || []).reduce((s, c) => s + (Number(c.spend) || 0), 0);
  const totalCampRev = (campaigns || []).reduce((s, c) => s + (Number(c.revenue) || 0), 0);
  const roas = totalSpend > 0 ? totalCampRev / totalSpend : 0;
  let marketingScore = 50;
  if (roas >= 4) marketingScore = 88;
  else if (roas >= 2) marketingScore = 72;
  else if (roas >= 1) marketingScore = 50;
  else if (roas > 0) marketingScore = 28;
  scores.marketing = {
    score: clamp(marketingScore),
    trend: roas >= 2 ? "up" : roas > 0 && roas < 1 ? "down" : "stable",
    explanation: roas > 0 ? `ROAS ${roas.toFixed(1)}x` : "",
  };

  // === OPÉRATIONS ===
  const totalProducts = (products || []).length;
  const dormantCount = (inventory || []).filter((i) => i.stock_status === "dormant").length;
  const ruptureCount = (inventory || []).filter((i) => ["rupture", "proche_rupture"].includes(i.stock_status)).length;
  const issueRatio = totalProducts > 0 ? (dormantCount + ruptureCount) / totalProducts : 0;
  let opsScore = 50;
  if (issueRatio === 0) opsScore = 82;
  else if (issueRatio < 0.1) opsScore = 68;
  else if (issueRatio < 0.25) opsScore = 48;
  else opsScore = 28;
  scores.operations = {
    score: clamp(opsScore),
    trend: ruptureCount > 0 ? "down" : "stable",
    explanation: totalProducts > 0 ? `${ruptureCount} ruptures` : "",
  };

  // === CLIENTS ===
  const totalCustomers = (customers || []).length;
  const activeCustomers = (customers || []).filter((c) => c.status === "actif").length;
  const churnedCustomers = (customers || []).filter((c) => c.status === "inactif" || c.status === "perdu").length;
  const churnRate = totalCustomers > 0 ? (churnedCustomers / totalCustomers) * 100 : 0;
  const custMonthly = monthlyAgg(customers || [], "acquisition_date", "customer_id", "count");
  const newCustTrend = trendPct(lastVal(custMonthly), prevVal(custMonthly));
  let clientsScore = 50;
  if (churnRate < 5) clientsScore = 85;
  else if (churnRate < 10) clientsScore = 70;
  else if (churnRate < 20) clientsScore = 50;
  else clientsScore = 30;
  if (newCustTrend > 5) clientsScore += 8;
  else if (newCustTrend < -5) clientsScore -= 8;
  scores.clients = {
    score: clamp(clientsScore),
    trend: trendDir(lastVal(custMonthly), prevVal(custMonthly)),
    explanation: `${activeCustomers} actifs`,
  };

  return scores;
}