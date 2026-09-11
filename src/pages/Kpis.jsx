import React from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import EmptyState from "@/components/EmptyState";
import { BarChart3, TrendingUp, TrendingDown, Minus } from "lucide-react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  LineChart,
  Line,
} from "recharts";

const domainLabels = {
  finance: "Finance",
  ventes: "Ventes",
  operations: "Opérations",
  marketing: "Marketing",
};

const domainColors = {
  finance: "#2563eb",
  ventes: "#16a34a",
  operations: "#9333ea",
  marketing: "#ea580c",
};

const trendIcon = { up: TrendingUp, down: TrendingDown, stable: Minus };

export default function Kpis() {
  const { data: kpis, isLoading } = useQuery({
    queryKey: ["kpis"],
    queryFn: async () => {
      const list = await base44.entities.Kpi.list();
      return list || [];
    },
  });

  const { data: transactions } = useQuery({
    queryKey: ["transactions-chart"],
    queryFn: async () => {
      const list = await base44.entities.Transaction.list("-date", 500);
      return list || [];
    },
  });

  if (isLoading) return <p className="text-sm text-muted-foreground">Chargement…</p>;

  const byDomain = { finance: [], ventes: [], operations: [], marketing: [] };
  (kpis || []).forEach((k) => {
    if (byDomain[k.domain]) byDomain[k.domain].push(k);
  });

  // Monthly chart data
  const byMonth = {};
  (transactions || []).forEach((t) => {
    const m = (t.date || "").slice(0, 7);
    if (!m) return;
    if (!byMonth[m]) byMonth[m] = { mois: m, revenus: 0, depenses: 0 };
    if (t.type === "income") byMonth[m].revenus += t.amount || 0;
    else byMonth[m].depenses += t.amount || 0;
  });
  const chartData = Object.values(byMonth).sort((a, b) => (a.mois < b.mois ? -1 : 1)).slice(-8);

  if ((!kpis || kpis.length === 0) && chartData.length === 0) {
    return (
      <EmptyState
        icon={BarChart3}
        title="Aucun KPI calculé"
        description="Importez vos données puis lancez l'analyse IA depuis le tableau de bord pour générer vos indicateurs clés."
      />
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Indicateurs clés (KPI)</h1>
        <p className="mt-1 text-muted-foreground">Performance par domaine, sélectionnée selon votre secteur.</p>
      </div>

      {/* Revenue vs expenses chart */}
      {chartData.length > 0 && (
        <div className="rounded-2xl border border-border bg-card p-5">
          <h2 className="mb-4 font-semibold">Revenus vs Dépenses</h2>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
              <XAxis dataKey="mois" tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
              <YAxis tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
              <Tooltip
                contentStyle={{ borderRadius: 8, border: "1px solid hsl(var(--border))", fontSize: 12 }}
                formatter={(v) => `${Math.round(v).toLocaleString("fr-CA")} $`}
              />
              <Bar dataKey="revenus" fill="#16a34a" radius={[4, 4, 0, 0]} name="Revenus" />
              <Bar dataKey="depenses" fill="#ea580c" radius={[4, 4, 0, 0]} name="Dépenses" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* KPI by domain */}
      {Object.entries(byDomain).map(([domain, items]) => {
        if (items.length === 0) return null;
        return (
          <div key={domain}>
            <h2 className="mb-4 text-lg font-semibold">{domainLabels[domain]}</h2>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {items.map((k) => {
                const TIcon = trendIcon[k.trend] || Minus;
                const trendColor = k.trend === "up" ? "text-emerald-600" : k.trend === "down" ? "text-red-600" : "text-muted-foreground";
                const pct = k.target > 0 ? Math.round((k.value / k.target) * 100) : null;
                return (
                  <div key={k.id} className="rounded-xl border border-border bg-card p-4">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium text-muted-foreground">{k.name}</p>
                      <TIcon className={`h-4 w-4 ${trendColor}`} />
                    </div>
                    <p className="mt-2 text-2xl font-bold">
                      {k.value != null ? k.value.toLocaleString("fr-CA") : "—"}
                      <span className="ml-1 text-sm font-normal text-muted-foreground">{k.unit || ""}</span>
                    </p>
                    <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
                      <span>Cible: {k.target || "—"}</span>
                      {pct != null && <span>{pct}% de l'objectif</span>}
                    </div>
                    {pct != null && (
                      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
                        <div
                          className="h-full rounded-full"
                          style={{ width: `${Math.min(100, pct)}%`, backgroundColor: domainColors[domain] }}
                        />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}

      {kpis && kpis.length === 0 && (
        <EmptyState
          icon={BarChart3}
          title="KPI non encore calculés"
          description="Lancez l'analyse IA depuis le tableau de bord pour générer vos KPI."
        />
      )}
    </div>
  );
}