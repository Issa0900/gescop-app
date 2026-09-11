// Data audit: cross-checks between independent sources, import quality checks,
// and metric traceability (formula + source + period + intermediate values).
// Read-only — it never modifies data, it only reports what the metrics are built on.

import { monthlyAgg, monthlyAggComplete, currentMonthKey, sumLast, latestByKey, meanOf } from "@/lib/periods";

const num = (v) => Number(v) || 0;
const sum = (arr, f) => (arr || []).reduce((s, x) => s + num(f(x)), 0);
const fmt$ = (v) => `${Math.round(v).toLocaleString("fr-CA")} $`;
const pctGap = (a, b) => {
  const base = Math.max(Math.abs(a), Math.abs(b));
  return base > 0 ? (Math.abs(a - b) / base) * 100 : 0;
};

/** status: "ok" | "warn" | "error" | "skip" */
function check(label, status, detail, expected, actual) {
  return { label, status, detail, expected, actual };
}

/** Level 2 — coherence cross-checks between independent data sources. */
export function runCoherenceChecks(d) {
  const { transactions = [], orders = [], customers = [], products = [], inventory = [], cashflow = [], campaigns = [], campaignDaily = [], expenses = [], payroll = [], employees = [] } = d;
  const out = [];

  // --- Revenue: orders vs income transactions, on complete months only ---
  const ordersRev = sum(orders, (o) => o.total);
  const txnIncome = sum(transactions.filter((t) => t.type === "income"), (t) => t.amount);
  if (orders.length === 0 || transactions.length === 0) {
    out.push(check("CA des commandes vs revenus des transactions", "skip", "Une des deux sources est absente."));
  } else {
    const gap = pctGap(ordersRev, txnIncome);
    out.push(check(
      "CA des commandes vs revenus des transactions",
      gap <= 5 ? "ok" : gap <= 20 ? "warn" : "error",
      gap <= 5 ? "Les deux sources concordent." : `Écart de ${gap.toFixed(1)} % entre les deux sources : l'une des deux est incomplète ou couvre une autre période.`,
      `Commandes : ${fmt$(ordersRev)}`,
      `Transactions : ${fmt$(txnIncome)}`,
    ));
  }

  // --- Cashflow: sum of net flows vs closing - opening ---
  if (cashflow.length < 2) {
    out.push(check("Flux de trésorerie vs variation du solde", "skip", "Moins de deux relevés de trésorerie."));
  } else {
    const cfAsc = [...cashflow].sort((a, b) => (a.date < b.date ? -1 : 1));
    const netSum = sum(cfAsc, (c) => c.net_cash_flow);
    const delta = num(cfAsc[cfAsc.length - 1].closing_cash) - num(cfAsc[0].opening_cash);
    const gap = pctGap(netSum, delta);
    out.push(check(
      "Flux de trésorerie vs variation du solde",
      gap <= 2 ? "ok" : gap <= 10 ? "warn" : "error",
      gap <= 2 ? "Les flux nets expliquent bien la variation du solde." : `Écart de ${gap.toFixed(1)} % : des jours manquent dans la série ou les flux nets ne sont pas cohérents avec les soldes.`,
      `Somme des flux nets : ${fmt$(netSum)}`,
      `Variation du solde : ${fmt$(delta)}`,
    ));
  }

  // --- Cash in vs cash out consistency per row ---
  if (cashflow.length > 0) {
    const bad = cashflow.filter((c) => {
      const expectedNet = num(c.cash_in) - num(c.cash_out);
      return Math.abs(expectedNet - num(c.net_cash_flow)) > Math.max(1, Math.abs(expectedNet) * 0.02);
    });
    out.push(check(
      "Cohérence entrées − sorties = flux net",
      bad.length === 0 ? "ok" : bad.length / cashflow.length < 0.05 ? "warn" : "error",
      bad.length === 0 ? `Vérifié sur ${cashflow.length} relevés.` : `${bad.length} relevés sur ${cashflow.length} où entrées − sorties ≠ flux net.`,
    ));
  }

  // --- Margin: orders margin vs unit price - cost ---
  const withMargin = orders.filter((o) => o.gross_margin != null && o.total != null && o.cost != null);
  if (withMargin.length === 0) {
    out.push(check("Marge des commandes vs total − coût", "skip", "Champs de marge ou de coût absents des commandes."));
  } else {
    const bad = withMargin.filter((o) => {
      const expected = num(o.total) - num(o.cost);
      return Math.abs(expected - num(o.gross_margin)) > Math.max(1, Math.abs(expected) * 0.05);
    });
    out.push(check(
      "Marge des commandes vs total − coût",
      bad.length === 0 ? "ok" : bad.length / withMargin.length < 0.05 ? "warn" : "error",
      bad.length === 0 ? `Vérifié sur ${withMargin.length} commandes.` : `${bad.length} commandes sur ${withMargin.length} où la marge importée ne correspond pas à total − coût.`,
    ));
  }

  // --- Orphan references ---
  const custIds = new Set(customers.map((c) => c.customer_id));
  const orphanOrders = customers.length > 0 ? orders.filter((o) => o.customer_id && !custIds.has(o.customer_id)) : [];
  if (customers.length === 0 || orders.length === 0) {
    out.push(check("Commandes rattachées à un client existant", "skip", "Clients ou commandes absents."));
  } else {
    out.push(check(
      "Commandes rattachées à un client existant",
      orphanOrders.length === 0 ? "ok" : "warn",
      orphanOrders.length === 0 ? `${orders.length} commandes rattachées.` : `${orphanOrders.length} commandes référencent un client absent du fichier clients : elles faussent la LTV et le churn.`,
    ));
  }

  const prodIds = new Set(products.map((p) => p.product_id));
  const orphanOrderProducts = products.length > 0 ? orders.filter((o) => o.product_id && !prodIds.has(o.product_id)) : [];
  const orphanInventory = products.length > 0 ? inventory.filter((i) => i.product_id && !prodIds.has(i.product_id)) : [];
  if (products.length === 0) {
    out.push(check("Produits référencés existants", "skip", "Fichier produits absent."));
  } else {
    const bad = orphanOrderProducts.length + orphanInventory.length;
    out.push(check(
      "Produits référencés existants",
      bad === 0 ? "ok" : "warn",
      bad === 0 ? `${products.length} produits, toutes références valides.` : `${orphanOrderProducts.length} commandes et ${orphanInventory.length} lignes d'inventaire référencent un produit inconnu.`,
    ));
  }

  const empIds = new Set(employees.map((e) => e.employee_id));
  if (employees.length === 0 || payroll.length === 0) {
    out.push(check("Paie rattachée à un employé existant", "skip", "Employés ou paie absents."));
  } else {
    const orphanPay = payroll.filter((p) => p.employee_id && !empIds.has(p.employee_id));
    out.push(check(
      "Paie rattachée à un employé existant",
      orphanPay.length === 0 ? "ok" : "warn",
      orphanPay.length === 0 ? `${payroll.length} lignes de paie rattachées.` : `${orphanPay.length} lignes de paie référencent un employé inconnu.`,
    ));
  }

  // --- Campaigns: totals vs daily rows ---
  if (campaigns.length === 0 || campaignDaily.length === 0) {
    out.push(check("Totaux de campagnes vs données quotidiennes", "skip", "Campagnes ou données quotidiennes absentes."));
  } else {
    const totSpend = sum(campaigns, (c) => c.spend);
    const dailySpend = sum(campaignDaily, (c) => c.spend);
    const gap = pctGap(totSpend, dailySpend);
    out.push(check(
      "Totaux de campagnes vs données quotidiennes",
      gap <= 5 ? "ok" : gap <= 25 ? "warn" : "error",
      gap <= 5 ? "Les deux sources concordent." : `Écart de ${gap.toFixed(1)} % : le ROAS et le CAC peuvent différer selon la source utilisée.`,
      `Campagnes : ${fmt$(totSpend)}`,
      `Quotidien : ${fmt$(dailySpend)}`,
    ));
  }

  // --- Customer aggregates vs orders ---
  if (customers.length === 0 || orders.length === 0) {
    out.push(check("Revenu client cumulé vs commandes", "skip", "Clients ou commandes absents."));
  } else {
    const custRev = sum(customers, (c) => c.total_revenue);
    const gap = pctGap(custRev, ordersRev);
    out.push(check(
      "Revenu client cumulé vs commandes",
      gap <= 5 ? "ok" : gap <= 20 ? "warn" : "error",
      gap <= 5 ? "Les totaux clients correspondent aux commandes." : `Écart de ${gap.toFixed(1)} % : le champ « revenu total » des clients n'est pas à jour, les calculs utilisent donc les commandes.`,
      `Fiches clients : ${fmt$(custRev)}`,
      `Commandes : ${fmt$(ordersRev)}`,
    ));
  }

  // --- Expenses vs cash out ---
  if (expenses.length === 0 || cashflow.length === 0) {
    out.push(check("Dépenses vs sorties de trésorerie", "skip", "Dépenses ou trésorerie absentes."));
  } else {
    const expTotal = sum(expenses, (e) => e.amount) + sum(payroll, (p) => p.total_cost);
    const cashOut = sum(cashflow, (c) => c.cash_out);
    const gap = pctGap(expTotal, cashOut);
    out.push(check(
      "Dépenses vs sorties de trésorerie",
      gap <= 15 ? "ok" : gap <= 40 ? "warn" : "error",
      gap <= 15 ? "Ordres de grandeur cohérents." : `Écart de ${gap.toFixed(1)} % : les sorties de trésorerie incluent probablement des achats non listés en dépenses (ou inversement).`,
      `Dépenses + paie : ${fmt$(expTotal)}`,
      `Sorties de caisse : ${fmt$(cashOut)}`,
    ));
  }

  return out;
}

/** Level 2b — import quality: missing, aberrant or duplicated data. */
export function runQualityChecks(d) {
  const sets = [
    { name: "Transactions", rows: d.transactions, date: "date", amount: "amount", key: null },
    { name: "Commandes", rows: d.orders, date: "date", amount: "total", key: "order_id" },
    { name: "Clients", rows: d.customers, date: "acquisition_date", amount: null, key: "customer_id" },
    { name: "Trésorerie", rows: d.cashflow, date: "date", amount: "closing_cash", key: "date" },
    { name: "Dépenses", rows: d.expenses, date: "date", amount: "amount", key: "expense_id" },
    { name: "Inventaire", rows: d.inventory, date: "date", amount: null, key: null },
    { name: "Campagnes (quotidien)", rows: d.campaignDaily, date: "date", amount: "spend", key: null },
    { name: "Paie", rows: d.payroll, date: "period", amount: "total_cost", key: "payroll_id" },
  ];
  const today = new Date().toISOString().slice(0, 10);
  const cm = currentMonthKey();

  return sets.map((s) => {
    const rows = s.rows || [];
    if (rows.length === 0) return { name: s.name, rows: 0, status: "skip", issues: ["Aucune donnée importée."] };

    const issues = [];
    const missingDate = rows.filter((r) => !r[s.date]).length;
    if (missingDate > 0) issues.push(`${missingDate} lignes sans date`);

    const future = rows.filter((r) => r[s.date] && String(r[s.date]).slice(0, 10) > today).length;
    if (future > 0) issues.push(`${future} lignes datées dans le futur`);

    if (s.amount) {
      const zero = rows.filter((r) => !r[s.amount]).length;
      if (zero > 0) issues.push(`${zero} lignes avec ${s.amount} nul ou absent`);
      const values = rows.map((r) => Math.abs(num(r[s.amount]))).filter((v) => v > 0);
      const mean = meanOf(values);
      const outliers = values.filter((v) => mean > 0 && v > mean * 20).length;
      if (outliers > 0) issues.push(`${outliers} valeurs aberrantes (> 20× la moyenne)`);
    }

    if (s.key) {
      const seen = new Set();
      let dup = 0;
      rows.forEach((r) => {
        const k = r[s.key];
        if (!k) return;
        if (seen.has(k)) dup += 1;
        else seen.add(k);
      });
      if (dup > 0) issues.push(`${dup} doublons sur ${s.key} (possible double import)`);
    }

    // Coverage: months present, and whether the in-progress month is included.
    const months = monthlyAgg(rows, s.date, s.amount || s.date, "count");
    const hasPartial = months.some((m) => m.month === cm);
    const coverage = months.length > 0 ? `${months[0].month} → ${months[months.length - 1].month} (${months.length} mois)` : "période indéterminée";

    // Gaps in the monthly series — a missing month silently distorts every trend.
    let gaps = 0;
    const complete = months.filter((m) => m.month !== cm);
    for (let i = 1; i < complete.length; i += 1) {
      const [y1, m1] = complete[i - 1].month.split("-").map(Number);
      const [y2, m2] = complete[i].month.split("-").map(Number);
      gaps += (y2 - y1) * 12 + (m2 - m1) - 1;
    }
    if (gaps > 0) issues.push(`${gaps} mois manquants dans la série`);

    const status = issues.some((i) => i.includes("doublons") || i.includes("sans date")) ? "error" : issues.length > 0 ? "warn" : "ok";
    return {
      name: s.name,
      rows: rows.length,
      status,
      coverage,
      partialMonth: hasPartial ? cm : null,
      issues: issues.length > 0 ? issues : ["Aucune anomalie détectée."],
    };
  });
}

/** Level 1 — traceability: formula, source, period and intermediate values per metric. */
export function buildMetricTraces(d) {
  const { transactions = [], orders = [], customers = [], products = [], inventory = [], cashflow = [], campaignDaily = [], campaigns = [] } = d;
  const traces = [];

  const incomes = transactions.filter((t) => t.type === "income");
  const txnExp = transactions.filter((t) => t.type === "expense");
  const revM = monthlyAggComplete(incomes, "date", "amount");
  const expM = monthlyAggComplete(txnExp, "date", "amount");
  const rev3 = sumLast(revM, 3);
  const exp3 = sumLast(expM, 3);

  traces.push({
    domain: "Finance",
    metric: "Marge brute (3 mois)",
    formula: "(revenus − dépenses) ÷ revenus, sur les 3 derniers mois complets",
    source: `Transactions — ${incomes.length} revenus, ${txnExp.length} dépenses`,
    period: revM.length ? revM.slice(-3).map((m) => m.month).join(", ") : "—",
    steps: [
      ["Revenus 3 mois", fmt$(rev3)],
      ["Dépenses 3 mois", fmt$(exp3)],
      ["Marge", rev3 > 0 ? `${(((rev3 - exp3) / rev3) * 100).toFixed(1)} %` : "—"],
    ],
    note: "Le mois en cours est exclu : partiel, il ferait chuter artificiellement la marge.",
  });

  const cfSorted = [...cashflow].sort((a, b) => (a.date < b.date ? 1 : -1));
  const latestCash = num(cfSorted[0]?.closing_cash);
  const burn = meanOf(expM.slice(-3).map((e) => e.val));
  traces.push({
    domain: "Trésorerie",
    metric: "Autonomie (runway)",
    formula: "solde de clôture le plus récent ÷ dépenses mensuelles moyennes (3 mois)",
    source: `Trésorerie — ${cashflow.length} relevés quotidiens`,
    period: cfSorted[0]?.date ? `solde au ${cfSorted[0].date}` : "—",
    steps: [
      ["Solde actuel", fmt$(latestCash)],
      ["Dépenses moy./mois", fmt$(burn)],
      ["Autonomie", burn > 0 ? `${(latestCash / burn).toFixed(1)} mois` : "—"],
    ],
    note: "Le solde vient du fichier trésorerie importé, jamais du cumul des marges.",
  });

  const oRevM = monthlyAggComplete(orders, "date", "total");
  const oCntM = monthlyAggComplete(orders, "date", "total", "count");
  const orev3 = sumLast(oRevM, 3);
  const orevPrev3 = oRevM.slice(Math.max(0, oRevM.length - 6), Math.max(0, oRevM.length - 3)).reduce((s, x) => s + x.val, 0);
  traces.push({
    domain: "Ventes",
    metric: "Évolution du CA (3 mois)",
    formula: "(CA des 3 derniers mois − CA des 3 mois précédents) ÷ CA des 3 mois précédents",
    source: `Commandes — ${orders.length} lignes`,
    period: oRevM.length ? `${oRevM.slice(-6)[0]?.month || "—"} → ${oRevM[oRevM.length - 1].month}` : "—",
    steps: [
      ["CA 3 derniers mois", fmt$(orev3)],
      ["CA 3 mois précédents", fmt$(orevPrev3)],
      ["Variation", orevPrev3 > 0 ? `${(((orev3 - orevPrev3) / orevPrev3) * 100).toFixed(1)} %` : "—"],
    ],
  });

  const lastCnt = oCntM.length ? oCntM[oCntM.length - 1] : null;
  const lastRev = oRevM.length ? oRevM[oRevM.length - 1] : null;
  traces.push({
    domain: "Ventes",
    metric: "Panier moyen",
    formula: "CA du dernier mois complet ÷ nombre de commandes du même mois",
    source: `Commandes — ${orders.length} lignes`,
    period: lastCnt?.month || "—",
    steps: [
      ["CA du mois", lastRev ? fmt$(lastRev.val) : "—"],
      ["Commandes", lastCnt ? String(lastCnt.val) : "—"],
      ["Panier moyen", lastCnt?.val ? fmt$(lastRev.val / lastCnt.val) : "—"],
    ],
  });

  const spendM = monthlyAggComplete(campaignDaily, "date", "spend");
  const crevM = monthlyAggComplete(campaignDaily, "date", "revenue");
  const s3 = sumLast(spendM, 3);
  const r3 = sumLast(crevM, 3);
  traces.push({
    domain: "Marketing",
    metric: "ROAS (3 mois)",
    formula: "revenus publicitaires ÷ dépenses publicitaires, sur les 3 derniers mois complets",
    source: s3 > 0 ? `Campagnes quotidiennes — ${campaignDaily.length} lignes` : `Totaux de campagnes — ${campaigns.length} campagnes`,
    period: spendM.length ? spendM.slice(-3).map((m) => m.month).join(", ") : "—",
    steps: [
      ["Dépenses", fmt$(s3 > 0 ? s3 : sum(campaigns, (c) => c.spend))],
      ["Revenus", fmt$(s3 > 0 ? r3 : sum(campaigns, (c) => c.revenue))],
      ["ROAS", s3 > 0 ? `${(r3 / s3).toFixed(2)}x` : sum(campaigns, (c) => c.spend) > 0 ? `${(sum(campaigns, (c) => c.revenue) / sum(campaigns, (c) => c.spend)).toFixed(2)}x` : "—"],
    ],
    note: "Les données quotidiennes sont utilisées en priorité car elles seules sont datables.",
  });

  const latestInv = latestByKey(inventory, "product_id", "date");
  const dormant = latestInv.filter((i) => i.stock_status === "dormant").length;
  const rupture = latestInv.filter((i) => ["rupture", "proche_rupture"].includes(i.stock_status)).length;
  traces.push({
    domain: "Opérations",
    metric: "Santé du stock",
    formula: "(produits dormants + en rupture) ÷ produits suivis, sur le dernier instantané de chaque produit",
    source: `Inventaire — ${inventory.length} lignes, ${latestInv.length} produits suivis`,
    period: latestInv.length ? "dernier relevé par produit" : "—",
    steps: [
      ["Produits suivis", String(latestInv.length)],
      ["Ruptures", String(rupture)],
      ["Dormants", String(dormant)],
      ["Ratio problème", latestInv.length ? `${(((dormant + rupture) / latestInv.length) * 100).toFixed(1)} %` : "—"],
    ],
    note: "Un seul instantané par produit : compter tout l'historique multiplierait le même problème.",
  });

  const churned = customers.filter((c) => c.status === "inactif" || c.status === "perdu").length;
  const active = customers.filter((c) => c.status === "actif").length;
  traces.push({
    domain: "Clients",
    metric: "Taux de churn",
    formula: "(clients inactifs + perdus) ÷ total des clients",
    source: `Clients — ${customers.length} fiches`,
    period: "état actuel des fiches",
    steps: [
      ["Total clients", String(customers.length)],
      ["Actifs", String(active)],
      ["Inactifs / perdus", String(churned)],
      ["Churn", customers.length ? `${((churned / customers.length) * 100).toFixed(1)} %` : "—"],
    ],
  });

  const ordersRev = sum(orders, (o) => o.total);
  traces.push({
    domain: "Clients",
    metric: "Valeur vie client (LTV)",
    formula: "CA total des commandes ÷ nombre de clients actifs",
    source: `Commandes (${orders.length}) et clients (${customers.length})`,
    period: "historique complet",
    steps: [
      ["CA total", fmt$(ordersRev)],
      ["Clients actifs", String(active)],
      ["LTV", active > 0 ? fmt$(ordersRev / active) : "—"],
    ],
  });

  traces.push({
    domain: "Opérations",
    metric: "Produits à réapprovisionner",
    formula: "stock du dernier relevé ≤ seuil de réapprovisionnement du produit",
    source: `Produits (${products.length}) et inventaire (${inventory.length})`,
    period: "dernier relevé par produit",
    steps: [
      ["Produits avec seuil défini", String(products.filter((p) => p.reorder_point).length)],
      ["Sous le seuil", String(products.filter((p) => {
        if (!p.reorder_point) return false;
        const snap = latestInv.find((i) => i.product_id === p.product_id);
        const stock = snap && snap.closing_stock != null ? num(snap.closing_stock) : num(p.inventory_level);
        return stock <= p.reorder_point;
      }).length)],
    ],
  });

  return traces;
}