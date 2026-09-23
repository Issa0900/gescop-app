import React, { useState, useMemo } from "react";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { cn } from "@/lib/utils";

import { AXE_MOIS, AXE, GRILLE, INFOBULLE_LIGNE, LIGNE, COULEURS, montant, montantCourt, pourcent, nombre } from "@/lib/graphiques";

/** @type {Array<{key: string, label: string, format: 'currency'|'percent'|'count', couleur: string}>} */
const metrics = [
  { key: "revenue", label: "Chiffre d'affaires", format: "currency", couleur: COULEURS.revenus },
  { key: "margin", label: "Marge nette (%)", format: "percent", couleur: COULEURS.resultat },
  { key: "cash", label: "Trésorerie", format: "currency", couleur: COULEURS.tresorerie },
  { key: "clients", label: "Nouveaux clients", format: "count", couleur: COULEURS.volume },
  { key: "costs", label: "Coûts opérationnels", format: "currency", couleur: COULEURS.charges },
];

const periods = [
  { key: "3m", label: "3 mois", months: 3 },
  { key: "6m", label: "6 mois", months: 6 },
  { key: "12m", label: "12 mois", months: 12 },
];

const formatValue = (v, format) => (format === "percent" ? pourcent(v, 0) : format === "count" ? nombre(v) : montant(v));
const formatAxe = (format) => (format === "percent" ? (v) => `${v} %` : format === "count" ? nombre : montantCourt);

export default function PerformanceChart({ monthlyData }) {
  const [metric, setMetric] = useState("revenue");
  const [period, setPeriod] = useState("12m");

  const data = useMemo(() => {
    const series = (monthlyData || {})[metric] || [];
    const months = periods.find((p) => p.key === period)?.months || 12;
    return series.slice(-months);
  }, [monthlyData, metric, period]);

  const activeMetric = metrics.find((m) => m.key === metric) || metrics[0];
  const fmt = activeMetric.format;
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
              <CartesianGrid {...GRILLE} />
              <XAxis dataKey="month" {...AXE_MOIS} />
              <YAxis {...AXE} width={64} tickFormatter={formatAxe(fmt)} />
              <Tooltip {...INFOBULLE_LIGNE} formatter={(v) => [formatValue(v, fmt), activeMetric.label]} />
              <Line dataKey="val" name={activeMetric.label} stroke={activeMetric.couleur} {...LIGNE} dot={{ r: 3, fill: activeMetric.couleur }} />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-muted-foreground">Données insuffisantes</div>
        )}
      </div>
    </div>
  );
}