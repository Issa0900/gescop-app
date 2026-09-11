// Shared business context builder — used by analyzeBusiness, chatAssistant, generateReport
// Extracts the company + data and produces a compact context string for the LLM.

export async function buildBusinessContext(base44) {
  const companies = await base44.entities.Company.list();
  const company = companies && companies[0] ? companies[0] : null;

  const transactions = await base44.entities.Transaction.list("-date", 500);
  const kpis = await base44.entities.Kpi.list();
  const anomalies = await base44.entities.Anomaly.list("-created_date", 20);
  const risks = await base44.entities.Risk.filter({ status: "actif" });
  const opportunities = await base44.entities.Opportunity.filter({ status: "nouvelle" });
  const recommendations = await base44.entities.Recommendation.list("-created_date", 20);
  const tasks = await base44.entities.Task.list("-created_date", 30);

  // Financial summary computed from transactions
  const incomes = transactions.filter((t) => t.type === "income");
  const expenses = transactions.filter((t) => t.type === "expense");
  const totalIncome = incomes.reduce((s, t) => s + (t.amount || 0), 0);
  const totalExpenses = expenses.reduce((s, t) => s + (t.amount || 0), 0);
  const grossMargin = totalIncome - totalExpenses;
  const marginPct = totalIncome > 0 ? Math.round((grossMargin / totalIncome) * 100) : 0;

  // Monthly breakdown
  const byMonth = {};
  transactions.forEach((t) => {
    const m = (t.date || "").slice(0, 7);
    if (!m) return;
    if (!byMonth[m]) byMonth[m] = { income: 0, expense: 0 };
    if (t.type === "income") byMonth[m].income += t.amount || 0;
    else byMonth[m].expense += t.amount || 0;
  });
  const monthly = Object.entries(byMonth)
    .sort((a, b) => (a[0] < b[0] ? 1 : -1))
    .slice(0, 6)
    .map(([m, v]) => `${m}: revenus ${Math.round(v.income)} $, dépenses ${Math.round(v.expense)} $`)
    .join("\n");

  // Category breakdown for expenses
  const expByCat = {};
  expenses.forEach((t) => {
    const c = t.category || "Autre";
    expByCat[c] = (expByCat[c] || 0) + (t.amount || 0);
  });
  const topCategories = Object.entries(expByCat)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([c, v]) => `${c}: ${Math.round(v)} $`)
    .join("\n");

  const companyProfile = company
    ? `Entreprise: ${company.name}
Secteur: ${company.sector || "non précisé"}
Localisation: ${company.location || "non précisée"}
Employés: ${company.employee_count || "non précisé"}
Modèle d'affaires: ${company.business_model || "non précisé"}
Produits/services: ${(company.products || "")} ${(company.services || "")}
Clientèle: ${company.clientele || "non précisée"}
Objectifs: ${(company.objectives || []).join(", ") || "non précisés"}`
    : "Aucune entreprise configurée.";

  const dataSummary = `Total transactions: ${transactions.length}
Revenus totaux: ${Math.round(totalIncome)} $
Dépenses totales: ${Math.round(totalExpenses)} $
Marge brute: ${Math.round(grossMargin)} $ (${marginPct}%)

Évolution mensuelle (6 derniers mois):
${monthly || "données insuffisantes"}

Top catégories de dépenses:
${topCategories || "données insuffisantes"}`;

  const kpiSummary = kpis
    .map((k) => `${k.name} (${k.domain}): ${k.value} ${k.unit || ""} — tendance ${k.trend || "stable"}`)
    .join("\n");

  const anomalySummary = anomalies
    .map((a) => `- [${a.severity}] ${a.title}: ${a.description || ""}`)
    .join("\n");

  const riskSummary = risks
    .map((r) => `- [score ${r.score}/100] ${r.title}: ${r.description || ""}`)
    .join("\n");

  const oppSummary = opportunities
    .map((o) => `- [score ${o.score}/100] ${o.title}: ${o.description || ""}`)
    .join("\n");

  const context = `CONTEXTE DE L'ENTREPRISE
${companyProfile}

DONNÉES FINANCIÈRES
${dataSummary}

KPI ACTUELS
${kpiSummary || "aucun KPI calculé"}

ANOMALIES DÉTECTÉES
${anomalySummary || "aucune anomalie"}

RISQUES ACTIFS
${riskSummary || "aucun risque"}

OPPORTUNITÉS
${oppSummary || "aucune opportunité"}`;

  return {
    company,
    transactions,
    kpis,
    anomalies,
    risks,
    opportunities,
    recommendations,
    tasks,
    context,
    totals: { totalIncome, totalExpenses, grossMargin, marginPct, count: transactions.length },
  };
}