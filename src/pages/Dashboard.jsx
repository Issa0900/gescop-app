import React, { useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { useCompany } from "@/hooks/useCompany";
import { Button } from "@/components/ui/button";
import EmptyState from "@/components/EmptyState";
import { useToast } from "@/components/ui/use-toast";
import { Sparkles, RefreshCw, ArrowRight, Check, Loader2, ChevronDown } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";

import DashboardHeader from "@/components/dashboard/DashboardHeader";
import HealthHero from "@/components/dashboard/HealthHero";
import InsightCard from "@/components/dashboard/InsightCard";
import KpiCard from "@/components/dashboard/KpiCard";
import DomainScoreCard from "@/components/dashboard/DomainScoreCard";
import PerformanceChart from "@/components/dashboard/PerformanceChart";
import KpiOverview from "@/components/dashboard/KpiOverview";
import OpportunityCard from "@/components/dashboard/OpportunityCard";
import RiskCard from "@/components/dashboard/RiskCard";
import ForecastCard from "@/components/dashboard/ForecastCard";
import ActionCard from "@/components/dashboard/ActionCard";
import OnboardingHero from "@/components/dashboard/OnboardingHero";
import TodayPriorities from "@/components/dashboard/TodayPriorities";
import TimeFilter from "@/components/dashboard/TimeFilter";

const analysisSteps = [
  "Vérification des données", "Calcul des tendances", "Détection des anomalies",
  "Évaluation des risques", "Génération des recommandations",
];

const dimLabels = {
  finance: "Finance", ventes: "Ventes", tresorerie: "Trésorerie", clients: "Clients",
  operations: "Opérations", marketing: "Marketing", productivite: "Productivité",
  risques: "Risques", croissance: "Croissance",
};

const formatImpact = (amount) => {
  if (!amount || amount === 0) return null;
  const v = Math.round(Math.abs(amount)).toLocaleString("fr-CA");
  return amount > 0 ? `+${v} $` : `-${v} $`;
};

const formatRelativeTime = (date) => {
  if (!date) return null;
  const diff = Date.now() - new Date(date).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "à l'instant";
  if (mins < 60) return `il y a ${mins} min`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `il y a ${hours} h`;
  return `il y a ${Math.floor(hours / 24)} j`;
};

function monthlyAgg(items, dateField, valueField, agg = "sum") {
  const byMonth = {};
  (items || []).forEach((item) => {
    const m = (item[dateField] || "").slice(0, 7);
    if (!m) return;
    const v = Number(item[valueField]) || 0;
    if (agg === "sum") byMonth[m] = (byMonth[m] || 0) + v;
    else if (agg === "count") byMonth[m] = (byMonth[m] || 0) + 1;
    else if (agg === "last") byMonth[m] = v;
  });
  return Object.entries(byMonth).sort((a, b) => (a[0] < b[0] ? -1 : 1)).map(([month, val]) => ({ month, val }));
}

export default function Dashboard() {
  const { company, isLoading: loadingCompany } = useCompany();
  const { toast } = useToast();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [analyzing, setAnalyzing] = useState(false);
  const [progress, setProgress] = useState(0);

  const { data: transactions } = useQuery({
    queryKey: ["transactions-summary"],
    queryFn: async () => { const l = await base44.entities.Transaction.list("-date", 500); return l || []; },
  });
  const { data: orders } = useQuery({
    queryKey: ["orders-summary"],
    queryFn: async () => { const l = await base44.entities.Order.list("-date", 500); return l || []; },
  });
  const { data: customers } = useQuery({
    queryKey: ["customers-summary"],
    queryFn: async () => { const l = await base44.entities.Customer.list(); return l || []; },
  });
  const { data: cashflow } = useQuery({
    queryKey: ["cashflow-summary"],
    queryFn: async () => { const l = await base44.entities.Cashflow.list("-date", 100); return l || []; },
  });
  const { data: expenseRecords } = useQuery({
    queryKey: ["expenses-summary"],
    queryFn: async () => { const l = await base44.entities.Expense.list("-date", 200); return l || []; },
  });
  const { data: anomalies } = useQuery({
    queryKey: ["anomalies"],
    queryFn: async () => { const l = await base44.entities.Anomaly.list("-created_date", 20); return l || []; },
  });
  const { data: risks } = useQuery({
    queryKey: ["risks-active"],
    queryFn: async () => { const l = await base44.entities.Risk.filter({ status: "actif" }); return l || []; },
  });
  const { data: opportunities } = useQuery({
    queryKey: ["opportunities-new"],
    queryFn: async () => { const l = await base44.entities.Opportunity.filter({ status: "nouvelle" }); return l || []; },
  });
  const { data: recommendations } = useQuery({
    queryKey: ["recommendations"],
    queryFn: async () => { const l = await base44.entities.Recommendation.list("-created_date", 10); return l || []; },
  });
  const { data: analysisRuns } = useQuery({
    queryKey: ["analysis-runs"],
    queryFn: async () => { const l = await base44.entities.AnalysisRun.list("-created_date", 5); return l || []; },
  });
  const { data: tasks } = useQuery({
    queryKey: ["tasks-dashboard"],
    queryFn: async () => { const l = await base44.entities.Task.list("-created_date", 50); return l || []; },
  });
  const [showDetails, setShowDetails] = useState(false);
  const [period, setPeriod] = useState("month");

  const periodDays = { month: 30, quarter: 90, year: 365 };
  const cutoffDate = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - periodDays[period]);
    return d.toISOString().slice(0, 10);
  }, [period]);

  const inPeriod = (dateStr) => !dateStr || dateStr >= cutoffDate;

  const handleAnalyze = async () => {
    setAnalyzing(true);
    setProgress(0);
    const interval = setInterval(() => setProgress((p) => Math.min(p + 1, analysisSteps.length - 1)), 2500);
    try {
      const res = await base44.functions.invoke("analyzeBusiness", {});
      const data = res.data || res;
      if (data.error) {
        toast({ title: data.error, variant: "destructive" });
      } else {
        toast({ title: "Analyse terminée", description: `Score de santé: ${data.health_score}/100` });
        qc.invalidateQueries();
      }
    } catch (e) {
      toast({ title: "Erreur: " + (e.response?.data?.error || e.message), variant: "destructive" });
    } finally {
      clearInterval(interval);
      setAnalyzing(false);
      setProgress(0);
    }
  };

  // === COMPUTATIONS ===
  const computed = useMemo(() => {
    // Period-filtered totals (for KPI cards)
    const fTxn = (transactions || []).filter((t) => inPeriod(t.date));
    const fOrders = (orders || []).filter((o) => inPeriod(o.date));
    const fExpenses = (expenseRecords || []).filter((e) => inPeriod(e.date));
    const fCustomers = (customers || []).filter((c) => inPeriod(c.acquisition_date));

    const fIncomes = fTxn.filter((t) => t.type === "income");
    const fTxnExpenses = fTxn.filter((t) => t.type === "expense");
    const totalIncome = fIncomes.reduce((s, t) => s + (t.amount || 0), 0);
    const totalExpensesTxn = fTxnExpenses.reduce((s, t) => s + (t.amount || 0), 0);
    const margin = totalIncome - totalExpensesTxn;
    const marginPct = totalIncome > 0 ? (margin / totalIncome) * 100 : 0;

    const orderRevenue = fOrders.reduce((s, o) => s + (Number(o.total) || 0), 0);
    const orderCount = fOrders.length;
    const aov = orderCount > 0 ? orderRevenue / orderCount : 0;
    const activeCustomers = (customers || []).filter((c) => c.status === "actif").length;
    const latestCash = (cashflow || [])[0]?.closing_cash || 0;
    const totalExpenseAmount = fExpenses.reduce((s, e) => s + (Number(e.amount) || 0), 0);

    // Full monthly data (ALL records, not period-filtered) for charts and trends
    const allIncomes = (transactions || []).filter((t) => t.type === "income");
    const allTxnExpenses = (transactions || []).filter((t) => t.type === "expense");
    const allExpenses = expenseRecords || [];

    const revenueMonthly = monthlyAgg(allIncomes, "date", "amount");
    const expenseMonthly = monthlyAgg(allTxnExpenses, "date", "amount");
    const marginMonthly = revenueMonthly.map((m) => {
      const exp = expenseMonthly.find((e) => e.month === m.month);
      const inc = m.val;
      const expVal = exp ? exp.val : 0;
      return { month: m.month, val: inc > 0 ? ((inc - expVal) / inc) * 100 : 0 };
    });
    const cashMonthly = monthlyAgg(cashflow || [], "date", "closing_cash", "last");
    const costsMonthly = monthlyAgg(allExpenses, "date", "amount");
    const clientsMonthly = monthlyAgg(customers || [], "acquisition_date", "customer_id", "count");

    const sparkCount = { month: 3, quarter: 6, year: 12 }[period];
    const spark = (arr) => arr.slice(-sparkCount).map((d) => d.val);
    const lastVal = (arr) => (arr.length > 0 ? arr[arr.length - 1].val : 0);
    const prevVal = (arr) => (arr.length > 1 ? arr[arr.length - 2].val : 0);
    const trendPct = (curr, prev) => (prev > 0 ? ((curr - prev) / prev) * 100 : 0);

    const revTrend = trendPct(lastVal(revenueMonthly), prevVal(revenueMonthly));
    const marginTrend = trendPct(lastVal(marginMonthly), prevVal(marginMonthly));
    const cashTrend = trendPct(lastVal(cashMonthly), prevVal(cashMonthly));
    const aovRevMonthly = monthlyAgg(orders || [], "date", "total");
    const aovCntMonthly = monthlyAgg(orders || [], "date", "total", "count");
    const aovMonthly = aovRevMonthly.map((m) => {
      const cnt = aovCntMonthly.find((c) => c.month === m.month);
      return { month: m.month, val: cnt && cnt.val > 0 ? m.val / cnt.val : 0 };
    });
    const aovTrend = trendPct(lastVal(aovMonthly), prevVal(aovMonthly));
    const clientTrend = trendPct(lastVal(clientsMonthly), prevVal(clientsMonthly));
    const costTrend = trendPct(lastVal(costsMonthly), prevVal(costsMonthly));

    const monthlyData = { revenue: revenueMonthly, margin: marginMonthly, cash: cashMonthly, clients: clientsMonthly, costs: costsMonthly };

    // Forecasts
    const revGrowth = revenueMonthly.length >= 2 ? (lastVal(revenueMonthly) - prevVal(revenueMonthly)) / Math.max(1, prevVal(revenueMonthly)) : 0;
    const projectedRevenue = Math.round(lastVal(revenueMonthly) * (1 + revGrowth));
    const cashGrowth = cashMonthly.length >= 2 ? (lastVal(cashMonthly) - prevVal(cashMonthly)) / Math.max(1, Math.abs(prevVal(cashMonthly))) : 0;
    const projectedCash = Math.round(latestCash * (1 + cashGrowth));

    const forecastRevData = [
      ...revenueMonthly.slice(-3).map((d) => ({ month: d.month, val: d.val, upper: d.val, lower: d.val })),
      { month: "Prév.", val: projectedRevenue, upper: Math.round(projectedRevenue * 1.1), lower: Math.round(projectedRevenue * 0.9) },
    ];
    const forecastCashData = [
      ...cashMonthly.slice(-3).map((d) => ({ month: d.month, val: d.val, upper: d.val, lower: d.val })),
      { month: "Prév.", val: projectedCash, upper: Math.round(projectedCash * 1.15), lower: Math.round(projectedCash * 0.85) },
    ];

    return {
      totalIncome, totalExpensesTxn, margin, marginPct, orderRevenue, orderCount, aov,
      activeCustomers, latestCash, totalExpenseAmount,
      monthlyData, spark, aovMonthly,
      revTrend, marginTrend, cashTrend, aovTrend, clientTrend, costTrend,
      projectedRevenue, projectedCash, forecastRevData, forecastCashData,
    };
  }, [transactions, orders, customers, cashflow, expenseRecords, period, cutoffDate]);

  // === INSIGHTS ===
  const insights = useMemo(() => {
    const recs = (recommendations || []).filter((r) => r.status === "nouvelle").slice(0, 3).map((r) => ({
      type: r.source_type === "risk" ? "risk" : r.source_type === "opportunity" ? "opportunity" : "anomaly",
      title: r.title,
      why: r.situation || r.analysis,
      impact: r.financial_impact ? `${formatImpact(r.financial_impact)} / mois` : null,
      action: r.action,
      link: "/recommandations",
    }));
    const critAnoms = (anomalies || []).filter((a) => a.severity === "critique" && (recs || []).length < 4).slice(0, 2).map((a) => ({
      type: "anomaly",
      title: a.title,
      why: a.explanation || a.description,
      impact: a.financial_impact ? `${formatImpact(a.financial_impact)} / mois` : null,
      action: null,
      link: "/anomalies",
    }));
    return [...recs, ...critAnoms].slice(0, 5);
  }, [recommendations, anomalies]);

  // === DIMENSIONS ===
  const dimTrendDeltas = useMemo(() => {
    if (!analysisRuns || analysisRuns.length < 2) return {};
    const current = analysisRuns[0].dimension_scores || {};
    const prev = analysisRuns[1].dimension_scores || {};
    const deltas = {};
    Object.keys(current).forEach((key) => {
      const currScore = current[key]?.score || 0;
      const prevScore = prev[key]?.score || 0;
      if (prevScore > 0) deltas[key] = Math.round(currScore - prevScore);
    });
    return deltas;
  }, [analysisRuns]);

  const dimensions = useMemo(() => {
    const dimScores = company?.dimension_scores || {};
    return Object.keys(dimLabels).map((key) => ({
      key, label: dimLabels[key],
      ...(dimScores[key] || { score: 0, trend: "stable", explanation: "" }),
    }));
  }, [company]);

  // === SUMMARY ===
  const summary = useMemo(() => {
    const score = company?.health_score || 0;
    const scored = dimensions.filter((d) => (d.score || 0) > 0).sort((a, b) => (a.score || 0) - (b.score || 0));
    const lowest = scored.slice(0, 2).map((d) => d.label.toLowerCase());
    if (score >= 75) return "Votre entreprise est en bonne santé. Continuez à surveiller les indicateurs clés.";
    if (score >= 50) return `Votre entreprise progresse, mais ${lowest.join(" et ")} nécessitent une attention particulière.`;
    return `Votre entreprise rencontre des difficultés. Une intervention est recommandée sur ${lowest.join(" et ")}.`;
  }, [company, dimensions]);

  // === TREND ===
  const healthTrend = useMemo(() => {
    const current = company?.health_score || 0;
    const prev = analysisRuns && analysisRuns.length > 1 ? analysisRuns[1].health_score : null;
    if (prev == null) return null;
    const delta = Math.round(current - prev);
    if (delta > 0) return { direction: "up", text: `+${delta} pts depuis le mois dernier` };
    if (delta < 0) return { direction: "down", text: `${delta} pts depuis le mois dernier` };
    return { direction: "stable", text: "Stable depuis le mois dernier" };
  }, [company, analysisRuns]);

  // === ACTIONS ===
  const actions = useMemo(() => {
    const pOrder = { urgente: 0, elevee: 1, moyenne: 2, faible: 3 };
    return (recommendations || []).filter((r) => r.status === "nouvelle").sort((a, b) => (pOrder[a.priority] || 4) - (pOrder[b.priority] || 4)).slice(0, 4).map((r) => ({
      id: r.id, title: r.title, priority: r.priority,
      impact: r.financial_impact ? `${formatImpact(r.financial_impact)} / mois` : null,
      action: r.action,
    }));
  }, [recommendations]);

  // === RENDER ===
  if (loadingCompany) {
    return <div className="flex h-96 items-center justify-center"><RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }

  if (!company) {
    return (
      <EmptyState icon={Sparkles} title="Bienvenue dans GESCOP" description="Configurez votre entreprise pour commencer à recevoir des analyses et des recommandations."
        action={<Button asChild><Link to="/onboarding">Configurer mon entreprise <ArrowRight className="ml-2 h-4 w-4" /></Link></Button>} />
    );
  }

  const hasData = (transactions?.length || 0) + (orders?.length || 0) + (cashflow?.length || 0) + (customers?.length || 0) > 0;
  const hasAnalysis = (anomalies?.length || 0) + (risks?.length || 0) + (opportunities?.length || 0) + (recommendations?.length || 0) > 0;

  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Bonjour" : hour < 18 ? "Bon après-midi" : "Bonsoir";
  const today = new Date().toLocaleDateString("fr-CA", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  const lastAnalysis = formatRelativeTime(company.last_analysis_date);

  return (
    <div className="space-y-6">
      <DashboardHeader greeting={greeting} date={today} lastAnalysis={lastAnalysis} onAnalyze={handleAnalyze} analyzing={analyzing} hasData={hasData} />

      {hasData && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Période analysée : <span className="font-medium text-foreground">{period === "month" ? "30 derniers jours" : period === "quarter" ? "90 derniers jours" : "12 derniers mois"}</span>
          </p>
          <TimeFilter period={period} onChange={setPeriod} />
        </div>
      )}

      {analyzing && (
        <div className="animate-fade-in rounded-2xl border border-border bg-card p-6">
          <div className="space-y-2.5">
            {analysisSteps.map((step, i) => (
              <div key={i} className="flex items-center gap-3 text-sm">
                {i < progress ? <Check className="h-4 w-4 text-emerald-600" />
                  : i === progress ? <Loader2 className="h-4 w-4 animate-spin text-primary" />
                  : <div className="h-4 w-4 rounded-full border-2 border-muted-foreground/20" />}
                <span className={i <= progress ? "text-foreground" : "text-muted-foreground"}>{step}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {!hasData && <OnboardingHero />}

      {hasData && !hasAnalysis && !analyzing && (
        <div className="animate-fade-in rounded-2xl border border-border bg-card p-8 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
            <Sparkles className="h-7 w-7 text-primary" />
          </div>
          <h2 className="text-xl font-bold">Lancez votre première analyse</h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
            GESCOP va examiner vos données, détecter les anomalies, évaluer les risques et produire des recommandations actionnables.
          </p>
          <Button onClick={handleAnalyze} className="mt-5"><Sparkles className="mr-2 h-4 w-4" /> Analyser maintenant</Button>
        </div>
      )}

      {hasData && hasAnalysis && (
        <div className="space-y-6">
          {/* 1. PRIORITÉS CRITIQUES DU JOUR */}
          <TodayPriorities recommendations={recommendations} anomalies={anomalies} risks={risks} tasks={tasks} />

          {/* 2. ÉTAT GLOBAL */}
          <HealthHero score={company.health_score || 0} dimensions={dimensions} summary={summary} trend={healthTrend} onDomainClick={() => navigate("/kpis")} />

          {/* 3. KPI ESSENTIELS (top 3) */}
          <div>
            <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-muted-foreground">Indicateurs clés</h2>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <KpiCard label="Trésorerie" value={`${Math.round(computed.latestCash).toLocaleString("fr-CA")} $`}
                change={`${Math.abs(computed.cashTrend).toFixed(1)}%`} changeDir={computed.cashTrend >= 0 ? "up" : "down"}
                sparkline={computed.spark(computed.monthlyData.cash)} status={computed.latestCash > 0 ? "good" : "critical"} statusLabel={computed.latestCash > 0 ? "Bon" : "Critique"} onClick={() => navigate("/tresorerie")} />
              <KpiCard label="Chiffre d'affaires" value={`${Math.round(computed.totalIncome).toLocaleString("fr-CA")} $`}
                change={`${Math.abs(computed.revTrend).toFixed(1)}%`} changeDir={computed.revTrend >= 0 ? "up" : "down"}
                sparkline={computed.spark(computed.monthlyData.revenue)} status={computed.revTrend >= 0 ? "good" : "warning"} statusLabel={computed.revTrend >= 0 ? "Bon" : "Attention"} onClick={() => navigate("/kpis")} />
              <KpiCard label="Marge brute" value={`${computed.marginPct.toFixed(1)}%`}
                change={`${Math.abs(computed.marginTrend).toFixed(1)}%`} changeDir={computed.marginTrend >= 0 ? "up" : "down"}
                sparkline={computed.spark(computed.monthlyData.margin)} status={computed.marginPct >= 30 ? "good" : "warning"} statusLabel={computed.marginPct >= 30 ? "Bon" : "Attention"} onClick={() => navigate("/kpis")} />
            </div>
          </div>

          {/* 4. SECTION DÉTAILS (repliable) */}
          <div className="rounded-2xl border border-border bg-card">
            <button
              onClick={() => setShowDetails(!showDetails)}
              className="flex w-full items-center justify-between p-4"
            >
              <span className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                Plus de détails — domaines, tendances, risques, opportunités et prévisions
              </span>
              <ChevronDown className={`h-5 w-5 text-muted-foreground transition-transform ${showDetails ? "rotate-180" : ""}`} />
            </button>

            {showDetails && (
              <div className="space-y-6 border-t border-border p-4">
                {/* KPI secondaires */}
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                  <KpiCard label="Coûts opérationnels" value={`${Math.round(computed.totalExpenseAmount).toLocaleString("fr-CA")} $`}
                    change={`${Math.abs(computed.costTrend).toFixed(1)}%`} changeDir={computed.costTrend >= 0 ? "up" : "down"}
                    sparkline={computed.spark(computed.monthlyData.costs)} status={computed.costTrend > 5 ? "warning" : "neutral"} statusLabel={computed.costTrend > 5 ? "Attention" : "Stable"} onClick={() => navigate("/tresorerie")} />
                  <KpiCard label="Clients actifs" value={computed.activeCustomers.toLocaleString("fr-CA")}
                    change={`${Math.abs(computed.clientTrend).toFixed(1)}%`} changeDir={computed.clientTrend >= 0 ? "up" : "down"}
                    sparkline={computed.spark(computed.monthlyData.clients)} status={computed.clientTrend >= 0 ? "good" : "warning"} statusLabel={computed.clientTrend >= 0 ? "Bon" : "Attention"} onClick={() => navigate("/clients")} />
                  <KpiCard label="Panier moyen" value={`${computed.aov.toFixed(2)} $`}
                    change={`${Math.abs(computed.aovTrend).toFixed(1)}%`} changeDir={computed.aovTrend >= 0 ? "up" : "down"}
                    sparkline={computed.spark(computed.aovMonthly)} status={computed.aovTrend >= 0 ? "neutral" : "warning"} statusLabel={computed.aovTrend >= 0 ? "Stable" : "Attention"} onClick={() => navigate("/clients")} />
                </div>

                {/* Insights */}
                {insights.length > 0 && (
                  <div>
                    <h3 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground">Ce qui mérite votre attention</h3>
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                      {insights.map((ins, i) => (
                        <InsightCard key={i} {...ins} onDismiss={() => qc.invalidateQueries()} />
                      ))}
                    </div>
                  </div>
                )}

                <KpiOverview monthlyData={computed.monthlyData} dimensions={dimensions} />

                {/* Domain scores */}
                <div>
                  <h3 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground">Vue d'ensemble des domaines</h3>
                  <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
                    {dimensions.filter((d) => ["finance", "ventes", "tresorerie", "clients", "operations", "marketing"].includes(d.key)).map((d) => (
                      <DomainScoreCard key={d.key} domainKey={d.key} score={d.score} trend={d.trend} trendDelta={dimTrendDeltas[d.key] || 0} problem={d.explanation} onAnalyze={() => navigate("/kpis")} />
                    ))}
                  </div>
                </div>

                <PerformanceChart monthlyData={computed.monthlyData} />

                {/* Risques */}
                {(risks || []).length > 0 && (
                  <div>
                    <div className="mb-3 flex items-center justify-between">
                      <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Risques actifs</h3>
                      <Button variant="ghost" size="sm" asChild><Link to="/risques">Voir tout <ArrowRight className="ml-1 h-3.5 w-3.5" /></Link></Button>
                    </div>
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                      {[...(risks || [])].sort((a, b) => (b.score || 0) - (a.score || 0)).slice(0, 3).map((r) => (
                        <RiskCard key={r.id} title={r.title} description={r.description}
                          impact={r.financial_impact ? formatImpact(r.financial_impact) : null}
                          category={r.category} urgency={r.urgency} score={r.score}
                          link="/risques" onCreateAction={() => navigate("/taches")} />
                      ))}
                    </div>
                  </div>
                )}

                {/* Opportunités */}
                {(opportunities || []).length > 0 && (
                  <div>
                    <div className="mb-3 flex items-center justify-between">
                      <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Opportunités détectées</h3>
                      <Button variant="ghost" size="sm" asChild><Link to="/risques">Voir tout <ArrowRight className="ml-1 h-3.5 w-3.5" /></Link></Button>
                    </div>
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                      {(opportunities || []).slice(0, 3).map((o) => (
                        <OpportunityCard key={o.id} title={o.title} description={o.description}
                          impact={o.financial_impact ? formatImpact(o.financial_impact) : null}
                          category={o.category} link="/risques" onCreateAction={() => navigate("/taches")} />
                      ))}
                    </div>
                  </div>
                )}

                {/* Prévisions */}
                <div>
                  <h3 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground">Ce qui pourrait arriver</h3>
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <ForecastCard metric="Chiffre d'affaires prévu (30j)" value={`${computed.projectedRevenue.toLocaleString("fr-CA")} $`} probability={82} chartData={computed.forecastRevData} />
                    <ForecastCard metric="Trésorerie prévue (30j)" value={`${computed.projectedCash.toLocaleString("fr-CA")} $`} risk={computed.projectedCash < 50000 ? "modéré" : "faible"} chartData={computed.forecastCashData} />
                  </div>
                </div>

                {/* Actions */}
                {actions.length > 0 && (
                  <div>
                    <div className="mb-3 flex items-center justify-between">
                      <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Actions recommandées</h3>
                      <Button variant="ghost" size="sm" asChild><Link to="/recommandations">Voir tout <ArrowRight className="ml-1 h-3.5 w-3.5" /></Link></Button>
                    </div>
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
                      {actions.map((a) => (
                        <ActionCard key={a.id} title={a.title} impact={a.impact} priority={a.priority}
                          onExamine={() => navigate("/recommandations")} onApprove={() => navigate("/recommandations")} />
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}