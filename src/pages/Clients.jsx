import React from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import StatCard from "@/components/StatCard";
import EmptyState from "@/components/EmptyState";
import { Users, UserMinus, Crown, DollarSign } from "lucide-react";
import {
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
} from "recharts";

const segmentColors = {
  nouveau: "#3b82f6",
  regulier: "#10b981",
  vip: "#f59e0b",
  inactif: "#ef4444",
  b2b: "#8b5cf6",
  haute_valeur: "#06b6d4",
  a_risque: "#f97316",
};

const segmentLabels = {
  nouveau: "Nouveau",
  regulier: "Régulier",
  vip: "VIP",
  inactif: "Inactif",
  b2b: "B2B",
  haute_valeur: "Haute valeur",
  a_risque: "À risque",
};

export default function Clients() {
  const { data: customers, isLoading } = useQuery({
    queryKey: ["customers"],
    queryFn: async () => {
      const list = await base44.entities.Customer.list();
      return list || [];
    },
  });

  if (isLoading) return <p className="text-sm text-muted-foreground">Chargement…</p>;
  if (!customers || customers.length === 0) {
    return (
      <EmptyState
        icon={Users}
        title="Aucun client"
        description="Importez vos données clients pour voir leur segmentation, churn et concentration."
      />
    );
  }

  const total = customers.length;
  const inactive = customers.filter((c) => c.status === "inactif" || c.status === "perdu" || c.segment === "inactif" || c.segment === "a_risque");
  const churnRate = Math.round((inactive.length / total) * 100);
  const totalRevenue = customers.reduce((s, c) => s + (c.total_revenue || 0), 0);
  const sorted = [...customers].sort((a, b) => (b.total_revenue || 0) - (a.total_revenue || 0));
  const top5Revenue = sorted.slice(0, 5).reduce((s, c) => s + (c.total_revenue || 0), 0);
  const concentration = totalRevenue > 0 ? Math.round((top5Revenue / totalRevenue) * 100) : 0;
  const avgLTV = total > 0 ? Math.round(totalRevenue / total) : 0;

  const bySegment = {};
  customers.forEach((c) => {
    const s = c.segment || "non_precise";
    bySegment[s] = (bySegment[s] || 0) + 1;
  });
  const pieData = Object.entries(bySegment).map(([seg, count]) => ({
    name: segmentLabels[seg] || seg,
    value: count,
    key: seg,
  }));

  const topBarData = sorted.slice(0, 10).map((c) => ({
    name: `${c.first_name || ""} ${c.last_name || ""}`.trim() || c.customer_id,
    revenue: Math.round(c.total_revenue || 0),
  }));

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Clients</h1>
        <p className="mt-1 text-muted-foreground">Segmentation, concentration, churn et valeur vie client.</p>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Total clients" value={total.toLocaleString()} icon={Users} />
        <StatCard label="Taux de churn" value={`${churnRate}%`} sublabel={`${inactive.length} inactifs`} icon={UserMinus} accent={churnRate > 20 ? "bg-red-50 text-red-600" : "bg-muted text-muted-foreground"} />
        <StatCard label="Concentration top 5" value={`${concentration}%`} sublabel="du CA total" icon={Crown} accent={concentration > 40 ? "bg-amber-50 text-amber-600" : "bg-muted text-muted-foreground"} />
        <StatCard label="Valeur vie moyenne" value={`${avgLTV.toLocaleString()} $`} icon={DollarSign} />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-xl border border-border bg-card p-6">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-muted-foreground">Répartition par segment</h2>
          <ResponsiveContainer width="100%" height={280}>
            <PieChart>
              <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={100} label={(e) => `${e.name}: ${e.value}`}>
                {pieData.map((entry, i) => (
                  <Cell key={i} fill={segmentColors[entry.key] || "#94a3b8"} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div className="rounded-xl border border-border bg-card p-6">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-muted-foreground">Top 10 clients (CA total)</h2>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={topBarData} layout="vertical" margin={{ left: 20, right: 20 }}>
              <CartesianGrid strokeDasharray="3 3" horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 11 }} />
              <YAxis type="category" dataKey="name" width={100} tick={{ fontSize: 10 }} />
              <Tooltip formatter={(v) => `${v.toLocaleString()} $`} />
              <Bar dataKey="revenue" fill="#3b82f6" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl border border-border">
        <table className="w-full min-w-[700px] text-sm">
          <thead className="bg-muted/50 text-left text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-4 py-3 font-medium">Client</th>
              <th className="px-4 py-3 font-medium">Segment</th>
              <th className="px-4 py-3 font-medium">Commandes</th>
              <th className="px-4 py-3 font-medium">CA total</th>
              <th className="px-4 py-3 font-medium">Panier moyen</th>
              <th className="px-4 py-3 font-medium">LTV</th>
              <th className="px-4 py-3 font-medium">Churn risk</th>
              <th className="px-4 py-3 font-medium">Statut</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {sorted.slice(0, 30).map((c) => (
              <tr key={c.id} className="hover:bg-muted/30">
                <td className="px-4 py-3 font-medium">{`${c.first_name || ""} ${c.last_name || ""}`.trim() || c.customer_id}</td>
                <td className="px-4 py-3">
                  <span className="inline-flex items-center gap-1.5 text-xs">
                    <span className="h-2 w-2 rounded-full" style={{ background: segmentColors[c.segment] || "#94a3b8" }} />
                    {segmentLabels[c.segment] || c.segment || "—"}
                  </span>
                </td>
                <td className="px-4 py-3">{c.total_orders || 0}</td>
                <td className="px-4 py-3 font-medium">{Math.round(c.total_revenue || 0).toLocaleString()} $</td>
                <td className="px-4 py-3">{Math.round(c.average_order_value || 0).toLocaleString()} $</td>
                <td className="px-4 py-3">{Math.round(c.lifetime_value || 0).toLocaleString()} $</td>
                <td className="px-4 py-3">
                  {(c.churn_risk || 0) > 60 ? (
                    <span className="text-red-600 font-medium">{Math.round(c.churn_risk)}%</span>
                  ) : (c.churn_risk || 0) > 30 ? (
                    <span className="text-amber-600">{Math.round(c.churn_risk)}%</span>
                  ) : (
                    <span className="text-muted-foreground">{Math.round(c.churn_risk || 0)}%</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  <span className={c.status === "actif" ? "text-emerald-600" : c.status === "inactif" ? "text-red-600" : "text-amber-600"}>
                    {c.status || "—"}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}