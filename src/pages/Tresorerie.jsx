import React from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import StatCard from "@/components/StatCard";
import EmptyState from "@/components/EmptyState";
import { Wallet, TrendingDown, TrendingUp, RefreshCw } from "lucide-react";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, Legend,
} from "recharts";

export default function Tresorerie() {
  const { data: cashflow, isLoading: lcf } = useQuery({
    queryKey: ["cashflow-summary"],
    queryFn: async () => (await base44.entities.Cashflow.list("-date", 100)) || [],
  });
  const { data: expenses, isLoading: lex } = useQuery({
    queryKey: ["expenses-summary"],
    queryFn: async () => (await base44.entities.Expense.list("-date", 200)) || [],
  });
  const { data: payroll, isLoading: lp } = useQuery({
    queryKey: ["payroll-summary"],
    queryFn: async () => (await base44.entities.Payroll.list("-period", 100)) || [],
  });

  if (lcf || lex || lp) return <p className="text-sm text-muted-foreground">Chargement…</p>;
  if (!cashflow || cashflow.length === 0) {
    return (
      <EmptyState
        icon={Wallet}
        title="Aucune donnée de trésorerie"
        description="Importez vos données de flux de trésorerie pour suivre votre position et vos tendances."
      />
    );
  }

  const currentCash = cashflow[0]?.closing_cash || 0;
  const sorted = [...cashflow].sort((a, b) => (a.date < b.date ? -1 : 1));
  const chartData = sorted.slice(-12).map((c) => ({
    date: c.date,
    entrées: Math.round(c.cash_in || 0),
    sorties: Math.round(c.cash_out || 0),
    flux_net: Math.round(c.net_cash_flow || 0),
    solde: Math.round(c.closing_cash || 0),
  }));

  const last3 = sorted.slice(-3);
  const avgNet = last3.length > 0 ? Math.round(last3.reduce((s, c) => s + (c.net_cash_flow || 0), 0) / last3.length) : 0;

  const totalPayroll = payroll.reduce((s, p) => s + (p.total_cost || 0), 0);
  const payrollByPeriod = {};
  payroll.forEach((p) => {
    const per = p.period || (p.payroll_id || "").slice(0, 7);
    payrollByPeriod[per] = (payrollByPeriod[per] || 0) + (p.total_cost || 0);
  });
  const payrollChart = Object.entries(payrollByPeriod).sort((a, b) => (a[0] < b[0] ? -1 : 1)).slice(-8).map(([m, v]) => ({
    mois: m,
    paie: Math.round(v),
  }));

  const recurring = expenses.filter((e) => e.recurring);
  const recurringByCat = {};
  recurring.forEach((e) => {
    const c = e.category || e.description || "Autre";
    recurringByCat[c] = (recurringByCat[c] || 0) + (e.amount || 0);
  });
  const recurringTotal = Object.values(recurringByCat).reduce((s, v) => s + v, 0);
  const recurringChart = Object.entries(recurringByCat).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([c, v]) => ({
    catégorie: c,
    montant: Math.round(v),
  }));

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Trésorerie</h1>
        <p className="mt-1 text-muted-foreground">Position de trésorerie, flux net, coûts salariaux et abonnements récurrents.</p>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Trésorerie actuelle" value={`${Math.round(currentCash).toLocaleString()} $`} icon={Wallet} accent={currentCash < 0 ? "bg-red-50 text-red-600" : "bg-emerald-50 text-emerald-600"} />
        <StatCard label="Flux net moyen (3 mois)" value={`${avgNet.toLocaleString()} $`} icon={avgNet >= 0 ? TrendingUp : TrendingDown} accent={avgNet < 0 ? "bg-red-50 text-red-600" : "bg-emerald-50 text-emerald-600"} />
        <StatCard label="Coût paie total" value={`${Math.round(totalPayroll).toLocaleString()} $`} icon={RefreshCw} />
        <StatCard label="Abonnements/mois" value={`${Math.round(recurringTotal).toLocaleString()} $`} icon={RefreshCw} accent="bg-amber-50 text-amber-600" />
      </div>

      <div className="rounded-xl border border-border bg-card p-6">
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-muted-foreground">Évolution de la trésorerie</h2>
        <ResponsiveContainer width="100%" height={300}>
          <AreaChart data={chartData} margin={{ left: 10, right: 10 }}>
            <defs>
              <linearGradient id="cashGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="date" tick={{ fontSize: 10 }} />
            <YAxis tick={{ fontSize: 11 }} />
            <Tooltip formatter={(v) => `${v.toLocaleString()} $`} />
            <Area type="monotone" dataKey="solde" stroke="#3b82f6" strokeWidth={2} fill="url(#cashGrad)" name="Solde" />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-xl border border-border bg-card p-6">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-muted-foreground">Entrées vs sorties</h2>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={chartData.slice(-8)} margin={{ left: 10, right: 10 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="date" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip formatter={(v) => `${v.toLocaleString()} $`} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="entrées" fill="#10b981" radius={[4, 4, 0, 0]} />
              <Bar dataKey="sorties" fill="#ef4444" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="rounded-xl border border-border bg-card p-6">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-muted-foreground">Coût salarial mensuel</h2>
          {payrollChart.length > 0 ? (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={payrollChart} margin={{ left: 10, right: 10 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="mois" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v) => `${v.toLocaleString()} $`} />
                <Bar dataKey="paie" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-sm text-muted-foreground">Aucune donnée de paie</p>
          )}
        </div>
      </div>

      {recurringChart.length > 0 && (
        <div className="rounded-xl border border-border bg-card p-6">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-muted-foreground">Abonnements récurrents</h2>
          <div className="space-y-2">
            {recurringChart.map((r) => (
              <div key={r.catégorie} className="flex items-center justify-between rounded-lg bg-muted/30 px-4 py-2.5">
                <span className="text-sm font-medium">{r.catégorie}</span>
                <span className="text-sm font-semibold">{r.montant.toLocaleString()} $/mois</span>
              </div>
            ))}
            <div className="flex items-center justify-between border-t border-border pt-3">
              <span className="text-sm font-semibold">Total mensuel</span>
              <span className="text-base font-bold">{Math.round(recurringTotal).toLocaleString()} $/mois</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}