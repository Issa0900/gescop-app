import React from "react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
} from "recharts";

export default function KpiTrendChart({ data }) {
  if (!data || data.length === 0) return null;

  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <h2 className="mb-1 font-semibold">Tendance des indicateurs clés</h2>
      <p className="mb-4 text-sm text-muted-foreground">Revenus, panier moyen et marge brute sur les derniers mois</p>
      <ResponsiveContainer width="100%" height={280}>
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
          <XAxis dataKey="month" tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
          <YAxis tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
          <Tooltip
            contentStyle={{ borderRadius: 8, border: "1px solid hsl(var(--border))", fontSize: 12 }}
            formatter={(v, name) => {
              if (name === "Marge (%)") return `${Math.round(v)}%`;
              return `${Math.round(v).toLocaleString("fr-CA")} $`;
            }}
          />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Line type="monotone" dataKey="revenue" stroke="#2563eb" strokeWidth={2.5} dot={{ r: 3 }} name="Revenus" />
          <Line type="monotone" dataKey="aov" stroke="#16a34a" strokeWidth={2.5} dot={{ r: 3 }} name="Panier moyen" />
          <Line type="monotone" dataKey="margin" stroke="#9333ea" strokeWidth={2.5} dot={{ r: 3 }} name="Marge (%)" />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}