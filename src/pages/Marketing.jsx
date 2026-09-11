import React from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import StatCard from "@/components/StatCard";
import EmptyState from "@/components/EmptyState";
import { Megaphone, TrendingUp, UserPlus, DollarSign } from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
  LineChart, Line,
} from "recharts";

export default function Marketing() {
  const { data: campaigns, isLoading: lc } = useQuery({
    queryKey: ["campaigns"],
    queryFn: async () => (await base44.entities.Campaign.list()) || [],
  });
  const { data: daily, isLoading: ld } = useQuery({
    queryKey: ["campaign-daily-summary"],
    queryFn: async () => (await base44.entities.CampaignDaily.list("-date", 500)) || [],
  });

  if (lc || ld) return <p className="text-sm text-muted-foreground">Chargement…</p>;
  if (!campaigns || campaigns.length === 0) {
    return (
      <EmptyState
        icon={Megaphone}
        title="Aucune campagne"
        description="Importez vos données marketing pour analyser le ROAS, le CAC et la performance par canal."
      />
    );
  }

  const totalSpend = campaigns.reduce((s, c) => s + (c.spend || 0), 0);
  const totalRevenue = campaigns.reduce((s, c) => s + (c.revenue || 0), 0);
  const totalNew = campaigns.reduce((s, c) => s + (c.new_customers || 0), 0);
  const overallRoas = totalSpend > 0 ? (totalRevenue / totalSpend).toFixed(2) : "—";
  const overallCac = totalNew > 0 ? Math.round(totalSpend / totalNew) : 0;

  const byChannel = {};
  campaigns.forEach((c) => {
    const ch = c.channel || "Autre";
    if (!byChannel[ch]) byChannel[ch] = { spend: 0, revenue: 0, conversions: 0, new_customers: 0, impressions: 0, clicks: 0 };
    byChannel[ch].spend += c.spend || 0;
    byChannel[ch].revenue += c.revenue || 0;
    byChannel[ch].conversions += c.conversions || 0;
    byChannel[ch].new_customers += c.new_customers || 0;
    byChannel[ch].impressions += c.impressions || 0;
    byChannel[ch].clicks += c.clicks || 0;
  });
  const channelData = Object.entries(byChannel).map(([ch, v]) => ({
    canal: ch,
    dépenses: Math.round(v.spend),
    revenus: Math.round(v.revenue),
    roas: v.spend > 0 ? Number((v.revenue / v.spend).toFixed(2)) : 0,
    cac: v.new_customers > 0 ? Math.round(v.spend / v.new_customers) : 0,
    conversions: v.conversions,
  }));

  // Monthly trend from daily
  const byMonth = {};
  daily.forEach((d) => {
    const m = (d.date || "").slice(0, 7);
    if (!m) return;
    if (!byMonth[m]) byMonth[m] = { spend: 0, revenue: 0 };
    byMonth[m].spend += d.spend || 0;
    byMonth[m].revenue += d.revenue || 0;
  });
  const trendData = Object.entries(byMonth).sort((a, b) => (a[0] < b[0] ? -1 : 1)).slice(-8).map(([m, v]) => ({
    mois: m,
    dépenses: Math.round(v.spend),
    revenus: Math.round(v.revenue),
    roas: v.spend > 0 ? Number((v.revenue / v.spend).toFixed(2)) : 0,
  }));

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Marketing</h1>
        <p className="mt-1 text-muted-foreground">Performance des campagnes, ROAS, CAC et efficacité par canal.</p>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Dépenses totales" value={`${Math.round(totalSpend).toLocaleString()} $`} icon={DollarSign} />
        <StatCard label="ROAS global" value={overallRoas} sublabel={`${Math.round(totalRevenue).toLocaleString()} $ revenus`} icon={TrendingUp} accent={totalSpend === 0 ? "bg-muted text-muted-foreground" : Number(overallRoas) >= 2 ? "bg-emerald-50 text-emerald-600" : Number(overallRoas) < 1 ? "bg-red-50 text-red-600" : "bg-amber-50 text-amber-600"} />
        <StatCard label="CAC global" value={`${overallCac} $`} icon={UserPlus} />
        <StatCard label="Nouveaux clients" value={totalNew.toLocaleString()} icon={UserPlus} />
      </div>

      <div className="rounded-xl border border-border bg-card p-6">
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-muted-foreground">Dépenses vs revenus par canal</h2>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={channelData} margin={{ left: 10, right: 10 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="canal" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} />
            <Tooltip formatter={(v) => `${v.toLocaleString()} $`} />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Bar dataKey="dépenses" fill="#f59e0b" radius={[4, 4, 0, 0]} />
            <Bar dataKey="revenus" fill="#10b981" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="rounded-xl border border-border bg-card p-6">
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-muted-foreground">Tendance ROAS (8 derniers mois)</h2>
        {trendData.length > 0 ? (
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={trendData} margin={{ left: 10, right: 10 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="mois" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Line type="monotone" dataKey="roas" stroke="#3b82f6" strokeWidth={2} dot={{ r: 4 }} name="ROAS" />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <p className="text-sm text-muted-foreground">Aucune donnée quotidienne</p>
        )}
      </div>

      <div className="overflow-x-auto rounded-xl border border-border">
        <table className="w-full min-w-[700px] text-sm">
          <thead className="bg-muted/50 text-left text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-4 py-3 font-medium">Campagne</th>
              <th className="px-4 py-3 font-medium">Canal</th>
              <th className="px-4 py-3 font-medium">Budget</th>
              <th className="px-4 py-3 font-medium">Dépenses</th>
              <th className="px-4 py-3 font-medium">Revenus</th>
              <th className="px-4 py-3 font-medium">ROAS</th>
              <th className="px-4 py-3 font-medium">CAC</th>
              <th className="px-4 py-3 font-medium">Conversions</th>
              <th className="px-4 py-3 font-medium">Statut</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {[...campaigns].sort((a, b) => (b.spend || 0) - (a.spend || 0)).map((c) => {
              const roas = c.spend > 0 ? ((c.revenue || 0) / c.spend).toFixed(1) : "—";
              const cac = c.new_customers > 0 ? Math.round(c.spend / c.new_customers) : "—";
              return (
                <tr key={c.id} className="hover:bg-muted/30">
                  <td className="max-w-[180px] truncate px-4 py-3 font-medium" title={c.campaign_name}>{c.campaign_name}</td>
                  <td className="px-4 py-3 uppercase text-muted-foreground">{c.channel}</td>
                  <td className="px-4 py-3">{Math.round(c.budget || 0).toLocaleString()} $</td>
                  <td className="px-4 py-3">{Math.round(c.spend || 0).toLocaleString()} $</td>
                  <td className="px-4 py-3">{Math.round(c.revenue || 0).toLocaleString()} $</td>
                  <td className="px-4 py-3">
                    <span className={Number(roas) >= 2 ? "text-emerald-600 font-medium" : Number(roas) < 1 ? "text-red-600 font-medium" : ""}>{roas}</span>
                  </td>
                  <td className="px-4 py-3">{cac === "—" ? "—" : `${cac} $`}</td>
                  <td className="px-4 py-3">{c.conversions || 0}</td>
                  <td className="px-4 py-3">
                    <span className={c.status === "active" ? "text-emerald-600" : c.status === "terminee" ? "text-muted-foreground" : "text-amber-600"}>
                      {c.status || "—"}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}