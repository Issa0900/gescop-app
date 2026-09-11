import React, { useState, useMemo } from "react";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { cn } from "@/lib/utils";

const metrics = [
  { key: "revenue", label: "Chiffre d'affaires" },
  { key: "margin", label: "Marge" },
  { key: "cash", label: "Trésorerie" },
  { key: "clients", label: "Clients" },
  { key: "costs", label: "Coûts" },
];

const periods = [
  { key: "3m", label: "3 mois", months: 3 },
  { key: "6m", label: "6 mois", months: 6 },
  { key: "12m", label: "12 mois", months: 12 },
];

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload || !payload.length) return null;
  return (
    <div className="rounded-lg border border-border bg-popover px-3 py-2 text-xs shadow-md">
      <p className="font-medium text-foreground">{label}</p>
      <p className="mt-1 text-primary">{Number(payload[0].value).toLocaleString("fr-CA")} $</p>
    </div>
  );
}

export default function PerformanceChart({ monthlyData }) {
  const [metric, setMetric] = useState("revenue");
  const [period, setPeriod] = useState("12m");

  const data = useMemo(() => {
    const series = (monthlyData || {})[metric] || [];
    const months = periods.find((p) => p.key === period)?.months || 12;
    return series.slice(-months);
  }, [monthlyData, metric, period]);

  return (
    <div className="rounded-2xl border border-border bg-card p-6">
      <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Évolution de l'entreprise</h3>
      <div className="mt-3 flex flex-wrap gap-2">
        {metrics.map((m) => (
          <button
            key={m.key}
            onClick={() => setMetric(m.key)}
            className={cn(
              "rounded-lg px-3 py-1.5 text-xs font-medium transition-colors",
              metric === m.key ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/70"
            )}
          >
            {m.label}
          </button>
        ))}
      </div>
      <div className="mt-3 flex items-center gap-3">
        {periods.map((p) => (
          <button
            key={p.key}
            onClick={() => setPeriod(p.key)}
            className={cn(
              "text-xs font-medium transition-colors",
              period === p.key ? "text-primary" : "text-muted-foreground hover:text-foreground"
            )}
          >
            {p.label}
          </button>
        ))}
      </div>
      <div className="mt-4 h-64">
        {data.length > 0 ? (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 5, right: 10, bottom: 5, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
              <XAxis dataKey="month" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" tickLine={false} axisLine={false} />
              <YAxis tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" tickLine={false} axisLine={false} width={50} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
              <Tooltip content={<CustomTooltip />} />
              <Line type="monotone" dataKey="val" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ r: 3, fill: "hsl(var(--primary))" }} activeDot={{ r: 5 }} />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-muted-foreground">Données insuffisantes</div>
        )}
      </div>
    </div>
  );
}