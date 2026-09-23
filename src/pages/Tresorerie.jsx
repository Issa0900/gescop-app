import React, { useMemo } from "react";
import StatCard from "@/components/StatCard";
import EmptyState from "@/components/EmptyState";
import { Wallet, TrendingDown, TrendingUp, RefreshCw } from "lucide-react";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, Legend,
} from "recharts";
import { useKpiEngine } from "@/lib/useKpiEngine";
import { useDonneesKpi } from "@/hooks/useDonneesKpi";
import { preparerPeriodes, serieMensuelle } from "@/lib/core/kpiPeriodes";
import { AXE_MOIS, AXE_MONTANT, GRILLE, INFOBULLE, INFOBULLE_LIGNE, LEGENDE, BARRE, LIGNE, COULEURS, montant, FENETRE_MOIS } from "@/lib/graphiques";
import { fluxTresorerieMensuels } from "@/lib/metrics";

const IDS_TRESORERIE = ["cash_closing"];

export default function Tresorerie() {
  // Memes donnees que tous les ecrans (useDonneesKpi).
  const { data: donnees, isLoading } = useDonneesKpi();
  const { cashflow, expenses, payrolls: payroll, transactions } = donnees;

  // GESCOP Phase 4 SSOT
  const { kpis: engineKpis } = useKpiEngine(donnees, IDS_TRESORERIE);
  // Paie par mois : serie du moteur (masse salariale), mois futurs exclus -
  // une paie datee de decembre n'est pas encore sortie de la tresorerie.
  const seriePaie = useMemo(() => serieMensuelle(preparerPeriodes(donnees), ["payroll_total"]).filter((p) => p.payroll_total != null), [donnees]);

  if (isLoading) return <p className="text-sm text-muted-foreground">Chargement...</p>;
  if (!cashflow?.length && !expenses?.length && !payroll?.length && !transactions?.length) {
    return (
      <EmptyState
        icon={Wallet}
        title="Aucune donnée de trésorerie"
        description="Importez vos données de flux de trésorerie, transactions, dépenses ou paie pour suivre votre position et vos tendances."
      />
    );
  }

  const expenseRows = expenses || [];

  // Sorted explicitly rather than trusting the order the API happened to return.
  // Cashflow is imported one row per day. Showing the last 12 rows meant showing
  // 12 days labelled as an evolution, so flows are aggregated by month:
  // in/out are summed, the balance is the month's closing value.
  const sorted = [...(cashflow || [])].sort((a, b) => ((a.date || "") < (b.date || "") ? -1 : 1));
  const latestRow = sorted[sorted.length - 1];

  const byMonthCash = {};
  sorted.forEach((c) => {
    const m = (c.date || "").slice(0, 7);
    if (!byMonthCash[m]) {
      byMonthCash[m] = { in: 0, out: 0, solde: 0, net: 0 };
    }
    const flow = Number(c.net_cash_flow) || ((Number(c.cash_in) || 0) - (Number(c.cash_out) || 0));
    byMonthCash[m].in += Number(c.cash_in) || 0;
    byMonthCash[m].out += Number(c.cash_out) || 0;
    byMonthCash[m].net += flow;
    byMonthCash[m].solde = Number(c.closing_cash) || 0;
  });

  if ((!cashflow || cashflow.length === 0) && transactions && transactions.length > 0) {
    const sortedTx = [...transactions].sort((a, b) => ((a.date || "") < (b.date || "") ? -1 : 1));
    let runningBalance = 0;
    sortedTx.forEach((t) => {
      const m = (t.date || "").slice(0, 7);
      if (!byMonthCash[m]) {
        byMonthCash[m] = { in: 0, out: 0, solde: 0, net: 0 };
      }
      const amt = Number(t.amount) || 0;
      const type = (t.type || "").toLowerCase();
      const isInc = ["income", "entree", "credit", "revenu"].includes(type) || amt > 0;
      const isExp = ["expense", "sortie", "debit", "depense"].includes(type) || amt < 0;
      const posAmt = Math.abs(amt);
      if (isInc && !isExp) {
        byMonthCash[m].in += posAmt;
        byMonthCash[m].net += posAmt;
        runningBalance += posAmt;
      } else {
        byMonthCash[m].out += posAmt;
        byMonthCash[m].net -= posAmt;
        runningBalance -= posAmt;
      }
      byMonthCash[m].solde = runningBalance;
    });
  }

  const monthsCash = Object.keys(byMonthCash).sort();
  // Consommation officielle SSOT avec fallback sur le solde calculé
  const currentCash = engineKpis.get("cash_closing")?.value || (monthsCash.length > 0 ? byMonthCash[monthsCash[monthsCash.length - 1]]?.solde : 0);
  // A raw sum over the whole imported history (positive = cash grew) presented
  // as a MONTHLY figure overstated it by the number of months covered, and a
  // stale assumption about the engine's sign convention flipped it negative on
  // top - a company whose cash grew steadily read as "burning $158k/month".
  // Flux net moyen sur les MOIS COMPLETS du releve (meme regle que l'autonomie
  // de la page KPI) : le mois en cours, partiel, faisait baisser la moyenne.
  const fluxComplets = fluxTresorerieMensuels(cashflow);
  const moisFlux = fluxComplets.length > 0 ? fluxComplets.length : monthsCash.length;
  const avgNet = fluxComplets.length > 0
    ? fluxComplets.reduce((t, p) => t + p.net, 0) / fluxComplets.length
    : monthsCash.length > 0 ? monthsCash.reduce((t, m) => t + byMonthCash[m].net, 0) / monthsCash.length : 0;
  const chartData = monthsCash.slice(-FENETRE_MOIS).map((m) => ({
    mois: m,
    entrées: Math.round(byMonthCash[m].in),
    sorties: Math.round(byMonthCash[m].out),
    flux_net: Math.round(byMonthCash[m].net),
    solde: Math.round(byMonthCash[m].solde),
  }));

  // Payroll and recurring expenses span many months in the import: a raw sum
  // presented as a monthly figure inflates it by the number of months covered.
  const avgMonthlyPayroll = seriePaie.length > 0 ? seriePaie.reduce((t, p) => t + p.payroll_total, 0) / seriePaie.length : 0;
  const payrollChart = seriePaie.slice(-FENETRE_MOIS).map((p) => ({ mois: p.month, paie: Math.round(p.payroll_total) }));

  const recurring = expenseRows.filter((e) => e.recurring);
  const recurringByCat = {};
  recurring.forEach((e) => {
    const c = e.category || e.description || "Autre";
    recurringByCat[c] = (recurringByCat[c] || 0) + (Number(e.amount) || 0);
  });
  const recurringMonths = new Set(recurring.map((e) => (e.date || "").slice(0, 7)).filter(Boolean));
  const recDiv = Math.max(1, recurringMonths.size);
  const recurringTotal = Object.values(recurringByCat).reduce((s, v) => s + v, 0) / recDiv;
  const recurringChart = Object.entries(recurringByCat).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([c, v]) => ({
    catégorie: c,
    montant: Math.round(v / recDiv),
  }));

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Trésorerie</h1>
        <p className="mt-1 text-muted-foreground">Position de trésorerie, flux net, coûts salariaux et abonnements récurrents.</p>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Trésorerie actuelle" value={montant(currentCash)} sublabel={`au ${latestRow?.date || "-"}`} icon={Wallet} accent={currentCash < 0 ? "bg-red-50 text-red-600" : "bg-emerald-50 text-emerald-600"} />
        <StatCard label="Flux net moyen / mois" value={montant(avgNet)} sublabel={`moyenne sur ${moisFlux} mois complets`} icon={avgNet >= 0 ? TrendingUp : TrendingDown} accent={avgNet < 0 ? "bg-red-50 text-red-600" : "bg-emerald-50 text-emerald-600"} />
        <StatCard label="Coût paie / mois" value={montant(avgMonthlyPayroll)} sublabel={`moyenne sur ${seriePaie.length} mois`} icon={RefreshCw} />
        <StatCard label="Abonnements/mois" value={montant(recurringTotal)} sublabel={`moyenne sur ${recDiv} mois`} icon={RefreshCw} accent={recurringTotal > 0 && currentCash > 0 && recurringTotal > currentCash * 0.15 ? "bg-red-50 text-red-600" : recurringTotal > 0 ? "bg-amber-50 text-amber-600" : "bg-muted text-muted-foreground"} />
      </div>

      <div className="rounded-xl border border-border bg-card p-6">
        <h2 className="mb-1 text-sm font-semibold uppercase tracking-wider text-muted-foreground">Évolution de la trésorerie</h2>
        <p className="mb-4 text-xs text-muted-foreground">Solde de fin de mois · {chartData.length} derniers mois</p>
        <ResponsiveContainer width="100%" height={300}>
          <AreaChart data={chartData} margin={{ left: 0, right: 10 }}>
            <CartesianGrid {...GRILLE} />
            <XAxis dataKey="mois" {...AXE_MOIS} />
            <YAxis {...AXE_MONTANT} />
            <Tooltip {...INFOBULLE_LIGNE} formatter={(v) => [montant(v), "Solde"]} />
            <Area dataKey="solde" stroke={COULEURS.tresorerie} fill={COULEURS.tresorerie} fillOpacity={0.12} {...LIGNE} name="Solde" />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-xl border border-border bg-card p-6">
          <h2 className="mb-1 text-sm font-semibold uppercase tracking-wider text-muted-foreground">Entrées vs sorties</h2>
          <p className="mb-4 text-xs text-muted-foreground">Par mois · {chartData.length} derniers mois</p>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={chartData} margin={{ left: 0, right: 10 }} barGap={2}>
              <CartesianGrid {...GRILLE} />
              <XAxis dataKey="mois" {...AXE_MOIS} />
              <YAxis {...AXE_MONTANT} />
              <Tooltip {...INFOBULLE} formatter={(v, nom) => [montant(v), nom]} />
              <Legend {...LEGENDE} />
              <Bar dataKey="entrées" name="Entrées" fill={COULEURS.revenus} {...BARRE} />
              <Bar dataKey="sorties" name="Sorties" fill={COULEURS.charges} {...BARRE} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="rounded-xl border border-border bg-card p-6">
          <h2 className="mb-1 text-sm font-semibold uppercase tracking-wider text-muted-foreground">Coût salarial mensuel</h2>
          <p className="mb-4 text-xs text-muted-foreground">Masse salariale par mois · mois futurs exclus</p>
          {payrollChart.length > 0 ? (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={payrollChart} margin={{ left: 0, right: 10 }}>
                <CartesianGrid {...GRILLE} />
                <XAxis dataKey="mois" {...AXE_MOIS} />
                <YAxis {...AXE_MONTANT} />
                <Tooltip {...INFOBULLE} formatter={(v) => [montant(v), "Masse salariale"]} />
                <Bar dataKey="paie" name="Masse salariale" fill={COULEURS.paie} {...BARRE} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-sm text-muted-foreground">Aucune donnée de paie</p>
          )}
        </div>
      </div>

      {recurringChart.length > 0 && (
        <div className="rounded-xl border border-border bg-card p-6">
          <h2 className="mb-1 text-sm font-semibold uppercase tracking-wider text-muted-foreground">Abonnements récurrents</h2>
          <p className="mb-4 text-xs text-muted-foreground">Coût mensuel moyen par catégorie, calculé sur {recDiv} mois de dépenses récurrentes importées</p>
          <div className="space-y-2">
            {recurringChart.map((r) => (
              <div key={r.catégorie} className="flex items-center justify-between rounded-lg bg-muted/30 px-4 py-2.5">
                <span className="text-sm font-medium">{r.catégorie}</span>
                <span className="text-sm font-semibold">{montant(r.montant)}/mois</span>
              </div>
            ))}
            <div className="flex items-center justify-between border-t border-border pt-3">
              <span className="text-sm font-semibold">Total mensuel</span>
              <span className="text-base font-bold">{montant(recurringTotal)}/mois</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}