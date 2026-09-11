import React, { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import ForecastCard from "@/components/previsions/ForecastCard";
import EmptyState from "@/components/EmptyState";
import { TrendingUp, AlertTriangle, Upload } from "lucide-react";
import { Link } from "react-router-dom";
import { ComposedChart, Line, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { cn } from "@/lib/utils";

function fit(xs, ys) {
  const n = xs.length;
  if (n < 2) return { slope: 0, intercept: ys[0] || 0, stderr: 0 };
  const mx = xs.reduce((a, b) => a + b, 0) / n;
  const my = ys.reduce((a, b) => a + b, 0) / n;
  const num = xs.reduce((s, x, i) => s + (x - mx) * (ys[i] - my), 0);
  const den = xs.reduce((s, x) => s + (x - mx) ** 2, 0);
  const slope = den === 0 ? 0 : num / den;
  const intercept = my - slope * mx;
  const residuals = xs.map((x, i) => ys[i] - (slope * x + intercept));
  const stderr = Math.sqrt(residuals.reduce((s, r) => s + r * r, 0) / Math.max(1, n - 2));
  return { slope, intercept, stderr };
}

const metrics = [
  { key: "ca", label: "Chiffre d'affaires" },
  { key: "marge", label: "Marge brute" },
  { key: "tresorerie", label: "Trésorerie" },
];

export default function Previsions() {
  const [metric, setMetric] = useState("ca");

  const { data: transactions, isLoading } = useQuery({
    queryKey: ["transactions-forecast"],
    queryFn: async () => { const l = await base44.entities.Transaction.list("-date", 500); return l || []; },
  });

  const result = useMemo(() => {
    if (!transactions || transactions.length === 0) return null;
    const byMonth = {};
    transactions.forEach((t) => {
      const m = (t.date || "").slice(0, 7);
      if (!m) return;
      if (!byMonth[m]) byMonth[m] = { income: 0, expense: 0 };
      if (t.type === "income") byMonth[m].income += t.amount || 0;
      else byMonth[m].expense += t.amount || 0;
    });
    const months = Object.keys(byMonth).sort();
    if (months.length < 3) return null;
    const monthly = months.map((m, i) => ({
      month: m, income: byMonth[m].income, expense: byMonth[m].expense,
      margin: byMonth[m].income - byMonth[m].expense, x: i,
    }));
    const xs = monthly.map((d) => d.x);
    const incomeFit = fit(xs, monthly.map((d) => d.income));
    const marginFit = fit(xs, monthly.map((d) => d.margin));
    const lastX = xs[xs.length - 1];
    const fcst = (f, x) => { const v = f.slope * x + f.intercept; return { value: v, lower: v - f.stderr, upper: v + f.stderr }; };
    const incomeF = [1, 2, 3].map((i) => fcst(incomeFit, lastX + i));
    const marginF = [1, 2, 3].map((i) => fcst(marginFit, lastX + i));
    const cumulativeNow = monthly.reduce((s, d) => s + d.margin, 0);
    const cash30 = cumulativeNow + marginF[0].value;
    const cash90 = cumulativeNow + marginF[0].value + marginF[1].value + marginF[2].value;
    const currentIncome = monthly[monthly.length - 1].income;
    const currentMargin = monthly[monthly.length - 1].margin;
    const projected90Margin = marginF.reduce((s, f) => s + f.value, 0);
    const shortfall = currentMargin * 3 - projected90Margin;
    return { monthly, incomeF, marginF, cash30, cash90, currentIncome, currentMargin, cumulativeNow, shortfall, incomeFit, marginFit };
  }, [transactions]);

  const chartData = useMemo(() => {
    if (!result) return [];
    const { monthly, incomeF, marginF, cumulativeNow, marginFit } = result;
    if (metric === "tresorerie") {
      let cum = 0;
      const hist = monthly.map((d) => { cum += d.margin; return { month: d.month.slice(5), value: Math.round(cum), forecast: null, range: null }; });
      hist[hist.length - 1].forecast = hist[hist.length - 1].value;
      hist[hist.length - 1].range = [hist[hist.length - 1].value, hist[hist.length - 1].value];
      let runCum = cum;
      const fcstMonths = ["+30j", "+60j", "+90j"];
      const fcst = marginF.map((f, i) => { runCum += f.value; const err = marginFit.stderr * (i + 1); return { month: fcstMonths[i], value: null, forecast: Math.round(runCum), range: [Math.round(runCum - err), Math.round(runCum + err)] }; });
      return [...hist, ...fcst];
    }
    const f = metric === "ca" ? incomeF : marginF;
    const key = metric === "ca" ? "income" : "margin";
    const hist = monthly.map((d) => ({ month: d.month.slice(5), value: Math.round(d[key]), forecast: null, range: null }));
    hist[hist.length - 1].forecast = hist[hist.length - 1].value;
    hist[hist.length - 1].range = [hist[hist.length - 1].value, hist[hist.length - 1].value];
    const fcstMonths = ["+30j", "+60j", "+90j"];
    const fcst = f.map((p, i) => ({ month: fcstMonths[i], value: null, forecast: Math.round(p.value), range: [Math.round(p.lower), Math.round(p.upper)] }));
    return [...hist, ...fcst];
  }, [result, metric]);

  if (isLoading) return <div className="flex h-96 items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-200 border-t-slate-800" /></div>;
  if (!transactions || transactions.length === 0) return <EmptyState icon={Upload} title="Aucune donnée à projeter" description="Importez vos transactions pour que GESCOP calcule des prévisions basées sur vos tendances." action={<Link to="/importer" className="text-primary hover:underline">Importer des données →</Link>} />;
  if (!result) return <EmptyState icon={TrendingUp} title="Données insuffisantes" description="Il faut au moins 3 mois de données pour calculer des prévisions fiables." />;

  const fmt = (v) => `${Math.round(v).toLocaleString("fr-CA")} $`;
  const selectedLabel = metrics.find((m) => m.key === metric).label;

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-2">
          <TrendingUp className="h-5 w-5 text-primary" />
          <h1 className="text-2xl font-bold tracking-tight">Prévisions</h1>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">Projections basées sur l'analyse de tendance de vos {result.monthly.length} derniers mois.</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <ForecastCard label="Chiffre d'affaires" current={fmt(result.currentIncome)} f30={fmt(result.incomeF[0].value)} f90={fmt(result.incomeF[2].value)} />
        <ForecastCard label="Marge brute" current={fmt(result.currentMargin)} f30={fmt(result.marginF[0].value)} f90={fmt(result.marginF[2].value)} />
        <ForecastCard label="Trésorerie projetée" current={fmt(result.cumulativeNow)} f30={fmt(result.cash30)} f90={fmt(result.cash90)} />
      </div>

      {result.shortfall > 0 && (
        <div className="flex items-start gap-3 rounded-xl border border-orange-200 bg-orange-50/50 p-4">
          <AlertTriangle className="h-5 w-5 shrink-0 text-orange-600" />
          <div>
            <p className="text-sm font-medium text-orange-900">Tendance à la baisse détectée</p>
            <p className="mt-0.5 text-xs text-orange-700">La tendance actuelle pourrait créer un manque à gagner de {fmt(result.shortfall)} sur les 90 prochains jours si aucune action n'est prise.</p>
          </div>
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {metrics.map((m) => (
          <button key={m.key} onClick={() => setMetric(m.key)} className={cn("rounded-full border px-3 py-1.5 text-xs font-medium transition-colors", metric === m.key ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card text-muted-foreground hover:bg-muted/50")}>{m.label}</button>
        ))}
      </div>

      <div className="rounded-2xl border border-border bg-card p-6">
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-muted-foreground">{selectedLabel}</h2>
        <ResponsiveContainer width="100%" height={300}>
          <ComposedChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis dataKey="month" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
            <YAxis tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
            <Tooltip formatter={(v) => (v != null ? `${Math.round(v).toLocaleString("fr-CA")} $` : "—")} contentStyle={{ fontSize: 12, borderRadius: 8 }} />
            <Area dataKey="range" stroke="none" fill="rgba(59, 130, 246, 0.1)" />
            <Line dataKey="value" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} connectNulls={false} />
            <Line dataKey="forecast" stroke="rgba(59, 130, 246, 0.6)" strokeWidth={2} strokeDasharray="5 5" dot={false} connectNulls />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}