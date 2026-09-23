import React from "react";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";

const trendIcon = { up: TrendingUp, down: TrendingDown, stable: Minus };

export default function KpiCard({ kpi, domainColor }) {
  const TIcon = trendIcon[kpi.trend] || Minus;
  // La couleur dit si l'evolution est BONNE, pas si le chiffre monte : des
  // charges en baisse sont une bonne nouvelle (elles s'affichaient en rouge).
  const bonne = (hausse) => (kpi.lowerIsBetter ? !hausse : hausse);
  const ton = (hausse) => (bonne(hausse) ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400");
  const trendColor = kpi.trend === "up" ? ton(true) : kpi.trend === "down" ? ton(false) : "text-muted-foreground";
  const numeric = typeof kpi.value === "number" && Number.isFinite(kpi.value);
  const pct = kpi.target > 0 && numeric ? Math.round((kpi.value / kpi.target) * 100) : null;
  // An indicator that is ITSELF a percentage (margin, churn, conversion) moves
  // in POINTS. Showing "+100%" for a margin going from 2% to 4% overstated a
  // two-point move as a doubling.
  const isPctUnit = (kpi.unit || "").trim() === "%";
  const prevDelta = numeric && kpi.previous != null && kpi.previous !== 0 && !isPctUnit
    ? ((kpi.value - kpi.previous) / Math.abs(kpi.previous)) * 100
    : null;
  const pointDelta = numeric && kpi.previous != null && isPctUnit
    ? kpi.value - kpi.previous
    : null;

  return (
    <div className="animate-slide-up rounded-xl border border-border bg-card p-4 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md hover:shadow-primary/5">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-muted-foreground">{kpi.name}</p>
        <div className="flex items-center gap-1.5">
          {kpi.statut === "partiel" && (
            <span className="rounded-full border border-amber-500/40 bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-medium text-amber-700 dark:text-amber-300" title="Calculé avec une partie seulement des sources nécessaires">Partiel</span>
          )}
          <TIcon className={`h-4 w-4 ${trendColor}`} aria-label={kpi.trend === "up" ? "en hausse" : kpi.trend === "down" ? "en baisse" : "stable"} />
        </div>
      </div>
      <p className="mt-2 text-2xl font-bold tracking-tight">
        {kpi.value != null ? (numeric ? kpi.value.toLocaleString("fr-CA") : String(kpi.value)) : "-"}
        <span className="ml-1 text-sm font-normal text-muted-foreground">{kpi.unit || ""}</span>
      </p>
      {/* Base et limites du chiffre (hors taxes, partiel...) : un chiffre juste
          mais mal compris reste une mauvaise decision. */}
      {kpi.note && <p className="mt-1 text-xs text-muted-foreground">{kpi.note}</p>}
      <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
        {pointDelta != null ? (
          <span className={ton(pointDelta >= 0)}>
            {pointDelta >= 0 ? "+" : ""}{(Math.round(pointDelta * 10) / 10).toLocaleString("fr-CA")} pt vs période précédente
          </span>
        ) : prevDelta != null ? (
          <span className={ton(prevDelta >= 0)}>
            {prevDelta >= 0 ? "+" : ""}{Math.round(prevDelta).toLocaleString("fr-CA")} % vs période précédente
          </span>
        ) : kpi.target > 0 ? (
          <span>Cible: {kpi.target.toLocaleString("fr-CA")} {kpi.unit || ""}</span>
        ) : (
          <span>&nbsp;</span>
        )}
        {pct != null && <span>{pct} % de l'objectif</span>}
      </div>
      {pct != null && (
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{ width: `${Math.min(100, pct)}%`, backgroundColor: domainColor || "#2563eb" }}
          />
        </div>
      )}
    </div>
  );
}