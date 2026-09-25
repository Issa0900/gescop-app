import React from "react";
import { TrendingUp, TrendingDown, ArrowRight } from "lucide-react";

export default function KpiCard({ kpi, domainColor }) {
  const isUp = kpi.trend === "up";
  const isDown = kpi.trend === "down";

  // La couleur dit si l'évolution est favorable pour la gestion :
  // des charges en baisse sont une bonne nouvelle (lowerIsBetter).
  const bonne = (hausse) => (kpi.lowerIsBetter ? !hausse : hausse);
  const trendStyle = isUp
    ? bonne(true)
      ? "text-emerald-700 bg-emerald-500/10 dark:text-emerald-400"
      : "text-red-700 bg-red-500/10 dark:text-red-400"
    : isDown
    ? bonne(false)
      ? "text-emerald-700 bg-emerald-500/10 dark:text-emerald-400"
      : "text-red-700 bg-red-500/10 dark:text-red-400"
    : "text-muted-foreground bg-muted/60";

  const TrendIcon = isUp ? TrendingUp : isDown ? TrendingDown : ArrowRight;

  const numeric = typeof kpi.value === "number" && Number.isFinite(kpi.value);
  const hasValue = kpi.value !== null && kpi.value !== undefined && kpi.value !== "-";
  const pct = kpi.target > 0 && numeric ? Math.round((kpi.value / kpi.target) * 100) : null;
  const isPctUnit = (kpi.unit || "").trim() === "%";

  const prevDelta = numeric && kpi.previous != null && kpi.previous !== 0 && !isPctUnit
    ? ((kpi.value - kpi.previous) / Math.abs(kpi.previous)) * 100
    : null;
  const pointDelta = numeric && kpi.previous != null && isPctUnit
    ? kpi.value - kpi.previous
    : null;

  return (
    <div className="group relative flex flex-col justify-between overflow-hidden rounded-2xl border border-border bg-card p-5 shadow-xs transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md hover:border-primary/30">
      <div>
        {/* En-tête : Nom de l'indicateur + Badges */}
        <div className="flex items-start justify-between gap-2">
          <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground leading-snug">
            {kpi.name}
          </p>
          <div className="flex items-center gap-1.5 shrink-0">
            {kpi.statut === "partiel" && (
              <span
                className="rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[10px] font-bold text-amber-700 dark:text-amber-300"
                title="Calculé avec une partie des sources disponibles"
              >
                Partiel
              </span>
            )}
            {kpi.previous != null && (
              <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold ${trendStyle}`}>
                <TrendIcon className="h-3 w-3" />
                {pointDelta != null
                  ? `${pointDelta >= 0 ? "+" : ""}${(Math.round(pointDelta * 10) / 10).toLocaleString("fr-CA")} pt`
                  : prevDelta != null
                  ? `${prevDelta >= 0 ? "+" : ""}${Math.round(prevDelta).toLocaleString("fr-CA")} %`
                  : "Stable"}
              </span>
            )}
          </div>
        </div>

        {/* Valeur principale */}
        <div className="mt-3 flex items-baseline gap-1.5">
          {hasValue ? (
            <>
              <span className="text-2xl sm:text-3xl font-black tracking-tight text-foreground">
                {numeric ? kpi.value.toLocaleString("fr-CA") : String(kpi.value)}
              </span>
              {kpi.unit && (
                <span className="text-sm font-bold text-muted-foreground">
                  {kpi.unit}
                </span>
              )}
            </>
          ) : (
            <span className="text-sm font-semibold text-muted-foreground/80 py-1">
              Non mesuré
            </span>
          )}
        </div>

        {/* Note contextuelle */}
        {kpi.note && (
          <p className="mt-1.5 text-xs text-muted-foreground leading-relaxed">
            {kpi.note}
          </p>
        )}
      </div>

      {/* Pied de carte : Cible ou référence */}
      <div className="mt-4 pt-3 border-t border-border/50 text-xs text-muted-foreground">
        {kpi.target > 0 ? (
          <div>
            <div className="flex items-center justify-between text-xs">
              <span>Cible : {kpi.target.toLocaleString("fr-CA")} {kpi.unit || ""}</span>
              {pct != null && <span className="font-semibold text-foreground">{pct} %</span>}
            </div>
            {pct != null && (
              <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{ width: `${Math.min(100, pct)}%`, backgroundColor: domainColor || "#10b981" }}
                />
              </div>
            )}
          </div>
        ) : kpi.previous != null ? (
          <span className="text-muted-foreground">
            Période précédente : {kpi.previous.toLocaleString("fr-CA")} {kpi.unit || ""}
          </span>
        ) : (
          <span className="text-muted-foreground/70">
            {hasValue ? "Période courante" : "En attente de données"}
          </span>
        )}
      </div>
    </div>
  );
}