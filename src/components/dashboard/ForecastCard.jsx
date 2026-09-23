import React from "react";
import { AreaChart, Area, ResponsiveContainer } from "recharts";
import { cn } from "@/lib/utils";
import { COULEURS } from "@/lib/graphiques";

/**
 * @param {Object} props
 * @param {string} props.metric
 * @param {string} props.value
 * @param {number} [props.probability]
 * @param {string} [props.risk]
 * @param {Array<Object>} [props.chartData]
 * @param {string} [props.couleur]  couleur de l'entite (COULEURS)
 */
export default function ForecastCard({ metric, value, probability, risk, chartData, couleur = COULEURS.revenus }) {
  const showProb = probability != null;
  const showRisk = risk != null;

  return (
    <div className="animate-slide-up rounded-2xl border border-border bg-card p-5 transition-shadow hover:shadow-md">
      <p className="text-xs font-medium text-muted-foreground">{metric}</p>
      <p className="mt-1 text-2xl font-bold tracking-tight">{value}</p>
      <div className="mt-2 flex items-center gap-2">
        {showProb && (
          <span className={cn(
            "rounded px-2 py-0.5 text-xs font-semibold",
            probability >= 75 ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300" : probability >= 50 ? "bg-blue-50 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300" : "bg-orange-50 text-orange-700 dark:bg-orange-500/15 dark:text-orange-300"
          )}>
            Probabilité : {probability}%
          </span>
        )}
        {showRisk && (
          <span className={cn(
            "rounded px-2 py-0.5 text-xs font-semibold",
            risk === "faible" ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300" : risk === "modéré" ? "bg-orange-50 text-orange-700 dark:bg-orange-500/15 dark:text-orange-300" : "bg-red-50 text-red-700 dark:bg-red-500/15 dark:text-red-300"
          )}>
            Risque : {risk}
          </span>
        )}
      </div>
      {chartData && chartData.length > 1 && (
        <div className="mt-3 h-16">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 2, right: 0, bottom: 0, left: 0 }}>
              <defs>
                <linearGradient id={`fc-${metric.replace(/\s/g, "")}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={couleur} stopOpacity={0.2} />
                  <stop offset="100%" stopColor={couleur} stopOpacity={0} />
                </linearGradient>
              </defs>
              <Area type="monotone" dataKey="upper" stroke="none" fill={`url(#fc-${metric.replace(/\s/g, "")})`} />
              <Area type="monotone" dataKey="val" stroke={couleur} strokeWidth={1.5} fill="none" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}