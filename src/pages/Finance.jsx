import React, { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import StatCard from "@/components/StatCard";
import EmptyState from "@/components/EmptyState";
import { DollarSign, PieChart, TrendingUp, TrendingDown } from "lucide-react";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, Legend, ReferenceLine,
} from "recharts";
import { AXE_MOIS, AXE_MONTANT, GRILLE, INFOBULLE, INFOBULLE_LIGNE, LEGENDE, BARRE, LIGNE, COULEURS, montant, pourcent, FENETRE_MOIS } from "@/lib/graphiques";
import { fetchAll } from "@/lib/fetchAll";
import { financialMonthlySeries } from "@/lib/financialData";
import { useKpiEngine } from "@/lib/useKpiEngine";
import DataErrorState from "@/components/DataErrorState";
import { useDonneesKpi } from "@/hooks/useDonneesKpi";
import { noteBaseCA } from "@/lib/core/kpiRecords";
import PaiementsCard from "@/components/finance/PaiementsCard";

// Chaque carte est un KPI du moteur, et elles s'additionnent : CA - charges
// totales = resultat net (tests/coherence_kpi.test.js). La page affichait
// « Depenses totales » (depenses seules) a cote d'un resultat qui retranchait
// aussi le cout des ventes et la paie : 568 519 - 996 484 affichait -2 222 935.
const IDS_FINANCE = ["total_revenue", "total_charges", "cogs_total", "total_expense", "payroll_total", "net_income", "net_margin_pct"];

const fmt$ = montant;

export default function Finance() {
  const { data: donnees, isLoading, isError, refetch } = useDonneesKpi();
  const { transactions, expenses, orders, assets, executiveSummary } = donnees;
  const { data: payments } = useQuery({ queryKey: ["payments-finance"], queryFn: () => fetchAll(base44.entities.Payment, "-date") });

  const { kpis: engineKpis } = useKpiEngine(donnees, IDS_FINANCE);
  const monthly = useMemo(() => financialMonthlySeries(donnees), [donnees]);

  if (isLoading) return <p className="text-sm text-muted-foreground">Chargement...</p>;
  if (isError) return <DataErrorState onRetry={refetch} />;
  if (!transactions?.length && !expenses?.length && !orders?.length && !executiveSummary?.length && !assets?.length && !payments?.length) {
    return (
      <EmptyState
        icon={DollarSign}
        title="Aucune donnée financière"
        description="Importez vos ventes, transactions, dépenses ou immobilisations pour analyser votre santé financière."
      />
    );
  }

  const v = (id) => { const x = engineKpis.get(id)?.value; return Number.isFinite(x) ? x : null; };
  const summary = {
    revenue: v("total_revenue"),
    charges: v("total_charges"),
    netIncome: v("net_income"),
    marginPct: v("net_margin_pct"),
  };
  const detailCharges = [
    ["coût des ventes", v("cogs_total")],
    ["dépenses", v("total_expense")],
    ["masse salariale", v("payroll_total")],
  ].filter(([, x]) => x !== null).map(([nom, x]) => `${nom} ${fmt$(x)}`).join(" · ");
  const chartData = monthly.slice(-FENETRE_MOIS).map((point) => ({
    date: point.month,
    revenus: Math.round(point.income),
    charges: Math.round(point.expense),
    résultat: Math.round(point.margin),
  }));

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Finance</h1>
        <p className="mt-1 text-muted-foreground">Rentabilité sur toute la période importée : chiffre d'affaires, charges et résultat.</p>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Chiffre d'affaires" value={summary.revenue == null ? "Non mesuré" : fmt$(summary.revenue)} icon={TrendingUp} accent="bg-emerald-50 text-emerald-600" sublabel={orders?.length ? noteBaseCA(orders) : undefined} />
        <StatCard label="Charges totales" value={summary.charges == null ? "Non mesuré" : fmt$(summary.charges)} icon={TrendingDown} accent="bg-red-50 text-red-600" sublabel={detailCharges ? `dont ${detailCharges}` : undefined} />
        <StatCard label="Résultat Net" value={summary.netIncome == null ? "Non mesuré" : fmt$(summary.netIncome)} sublabel="CA − charges totales" icon={DollarSign} accent={summary.netIncome == null ? "bg-slate-100 text-slate-500" : summary.netIncome < 0 ? "bg-red-50 text-red-600" : "bg-emerald-50 text-emerald-600"} />
        <StatCard label="Marge Nette" value={summary.marginPct == null ? "Non mesuré" : pourcent(summary.marginPct, 1)} icon={PieChart} accent={summary.marginPct == null ? "bg-slate-100 text-slate-500" : summary.marginPct < 0 ? "bg-red-50 text-red-600" : "bg-blue-50 text-blue-600"} />
      </div>

      <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
        <div className="mb-4 flex items-baseline justify-between gap-2">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Chiffre d'affaires vs charges totales</h2>
          <span className="text-xs text-muted-foreground">{chartData.length} derniers mois complets</span>
        </div>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={chartData} margin={{ left: 0, right: 10 }} barGap={2}>
            <CartesianGrid {...GRILLE} />
            <XAxis dataKey="date" {...AXE_MOIS} />
            <YAxis {...AXE_MONTANT} />
            <Tooltip {...INFOBULLE} formatter={(v, nom) => [montant(v), nom]} />
            <Legend {...LEGENDE} />
            <Bar dataKey="revenus" fill={COULEURS.revenus} {...BARRE} name="Chiffre d'affaires" />
            <Bar dataKey="charges" fill={COULEURS.charges} {...BARRE} name="Charges totales" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
        <div className="mb-4 flex items-baseline justify-between gap-2">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Évolution du résultat net</h2>
          <span className="text-xs text-muted-foreground">CA − charges totales, par mois</span>
        </div>
        <ResponsiveContainer width="100%" height={260}>
          <AreaChart data={chartData} margin={{ left: 0, right: 10 }}>
            <CartesianGrid {...GRILLE} />
            <XAxis dataKey="date" {...AXE_MOIS} />
            <YAxis {...AXE_MONTANT} />
            <ReferenceLine y={0} stroke="hsl(var(--muted-foreground))" strokeOpacity={0.5} />
            <Tooltip {...INFOBULLE_LIGNE} formatter={(v) => [montant(v), "Résultat net"]} />
            <Area dataKey="résultat" stroke={COULEURS.resultat} fill={COULEURS.resultat} fillOpacity={0.12} {...LIGNE} name="Résultat net" />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      <PaiementsCard payments={payments} orders={orders} />
    </div>
  );
}
