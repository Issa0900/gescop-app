import React, { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import SliderControl from "@/components/simulateur/SliderControl";
import EmptyState from "@/components/EmptyState";
import { Calculator, Upload, TrendingUp, TrendingDown } from "lucide-react";
import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";
import { currentMonthKey } from "@/lib/periods";

export default function Simulateur() {
  const [priceChange, setPriceChange] = useState(0);
  const [volumeChange, setVolumeChange] = useState(0);
  const [expenseChange, setExpenseChange] = useState(0);

  const { data: transactions, isLoading } = useQuery({
    queryKey: ["transactions-sim"],
    queryFn: async () => { const l = await base44.entities.Transaction.list("-date", 500); return l || []; },
  });

  const current = useMemo(() => {
    if (!transactions || transactions.length === 0) return null;
    const byMonth = {};
    transactions.forEach((t) => {
      const m = (t.date || "").slice(0, 7);
      if (!m) return;
      if (!byMonth[m]) byMonth[m] = { income: 0, expense: 0, count: 0 };
      if (t.type === "income") { byMonth[m].income += t.amount || 0; byMonth[m].count += 1; }
      else byMonth[m].expense += t.amount || 0;
    });
    // Baseline = last COMPLETE month. The running month holds only a few days,
    // which would understate the starting point of every simulation.
    const cm = currentMonthKey();
    const months = Object.keys(byMonth).filter((m) => m !== cm).sort();
    if (months.length === 0) return null;
    const baseMonth = months[months.length - 1];
    const last = byMonth[baseMonth];
    const income = last.income, expense = last.expense, margin = income - expense;
    const volume = last.count || 1, avgPrice = income / volume;
    return { income, expense, margin, volume, avgPrice, baseMonth };
  }, [transactions]);

  const sim = useMemo(() => {
    if (!current) return null;
    const newPrice = current.avgPrice * (1 + priceChange / 100);
    const newVolume = current.volume * (1 + volumeChange / 100);
    const newIncome = newPrice * newVolume;
    const newExpense = current.expense * (1 + expenseChange / 100);
    const newMargin = newIncome - newExpense;
    const profitChange = newMargin - current.margin;
    const newMarginPct = newIncome > 0 ? (newMargin / newIncome) * 100 : 0;
    const currentMarginPct = current.income > 0 ? (current.margin / current.income) * 100 : 0;
    return { newPrice, newVolume, newIncome, newExpense, newMargin, profitChange, newMarginPct, currentMarginPct };
  }, [current, priceChange, volumeChange, expenseChange]);

  if (isLoading) return <div className="flex h-96 items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-200 border-t-slate-800" /></div>;
  if (!transactions || transactions.length === 0) return <EmptyState icon={Upload} title="Aucune donnée à simuler" description="Importez vos transactions pour tester l'impact de vos décisions sur vos résultats." action={<Link to="/importer" className="text-primary hover:underline">Importer des données →</Link>} />;
  if (!current || !sim) return null;

  const fmt = (v) => `${Math.round(v).toLocaleString("fr-CA")} $`;
  const fmtPct = (v) => `${v.toFixed(1)}%`;
  const rows = [
    { label: "Prix moyen", actual: fmt(current.avgPrice), sim: fmt(sim.newPrice) },
    { label: "Volume (nb de transactions de vente)", actual: Math.round(current.volume).toLocaleString("fr-CA"), sim: Math.round(sim.newVolume).toLocaleString("fr-CA") },
    { label: "Chiffre d'affaires", actual: fmt(current.income), sim: fmt(sim.newIncome) },
    { label: "Dépenses", actual: fmt(current.expense), sim: fmt(sim.newExpense) },
    { label: "Marge brute", actual: fmt(current.margin), sim: fmt(sim.newMargin) },
    { label: "Taux de marge", actual: fmtPct(sim.currentMarginPct), sim: fmtPct(sim.newMarginPct) },
  ];
  const positive = sim.profitChange >= 0;

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-2">
          <Calculator className="h-5 w-5 text-primary" />
          <h1 className="text-2xl font-bold tracking-tight">Simulateur « Et si ? »</h1>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          Testez l'impact de vos décisions avant de les prendre. Base de calcul : {current.baseMonth} (dernier mois complet).
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 rounded-2xl border border-border bg-card p-6 md:grid-cols-3">
        <SliderControl label="Variation du prix" value={priceChange} onChange={setPriceChange} />
        <SliderControl label="Variation du volume" value={volumeChange} onChange={setVolumeChange} />
        <SliderControl label="Variation des dépenses" value={expenseChange} onChange={setExpenseChange} />
      </div>

      <div className="overflow-hidden rounded-2xl border border-border bg-card">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border bg-muted/30">
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Indicateur</th>
              <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground">Actuel</th>
              <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground">Simulation</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i} className={cn("border-b border-border last:border-0", i === rows.length - 1 && "bg-muted/20")}>
                <td className="px-4 py-3 text-sm font-medium">{r.label}</td>
                <td className="px-4 py-3 text-right text-sm">{r.actual}</td>
                <td className="px-4 py-3 text-right text-sm font-semibold">{r.sim}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className={cn("flex items-center gap-3 rounded-2xl border p-6", positive ? "border-emerald-200 bg-emerald-50/50" : "border-red-200 bg-red-50/50")}>
        {positive ? <TrendingUp className="h-6 w-6 text-emerald-600" /> : <TrendingDown className="h-6 w-6 text-red-600" />}
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Résultat de la simulation</p>
          <p className={cn("text-2xl font-bold", positive ? "text-emerald-700" : "text-red-700")}>
            {positive ? "+" : ""}{fmt(sim.profitChange)} / mois
          </p>
        </div>
      </div>
    </div>
  );
}