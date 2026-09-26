import React, { useState } from "react";
import { ChevronLeft, ChevronRight, Calendar, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

/**
 * Sélecteur de période universel GESCOP à 3 niveaux :
 * 1. Presets rapides (Mois clos, MTD, QTD, YTD, Personnalisé)
 * 2. Navigation pas-à-pas (Chevrons [ ◄ ] [ ► ])
 * 3. Commutateur de comparaison (MoM vs YoY)
 */
export function PeriodSelector({ periodFilter, className }) {
  if (!periodFilter || !periodFilter.filter) return null;

  const { filter, setPreset, setCompareType, step, setCustomRange } = periodFilter;
  const [showCustomModal, setShowCustomModal] = useState(false);
  const [customStart, setCustomStart] = useState(filter.startDate);
  const [customEnd, setCustomEnd] = useState(filter.endDate);

  const presets = [
    { id: "CLOSED_MONTH", label: "Mois clos" },
    { id: "MTD", label: "En cours" },
    { id: "QTD", label: "Trimestre" },
    { id: "YTD", label: "Année" },
  ];

  const handleApplyCustom = (e) => {
    e.preventDefault();
    if (customStart && customEnd && customStart <= customEnd) {
      setCustomRange(customStart, customEnd);
      setShowCustomModal(false);
    }
  };

  return (
    <div className={cn("flex flex-col gap-2.5 rounded-lg border bg-card p-3 shadow-sm", className)}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        {/* Niveau 1 : Presets rapides */}
        <div className="flex flex-wrap items-center gap-1.5">
          <Calendar className="mr-1 h-4 w-4 text-muted-foreground" />
          {presets.map((p) => {
            const isActive = filter.preset === p.id;
            return (
              <Button
                key={p.id}
                variant={isActive ? "default" : "outline"}
                size="sm"
                className={cn("h-7 px-2.5 text-xs font-medium", isActive && "shadow-xs")}
                onClick={() => setPreset(p.id)}
              >
                {p.label}
              </Button>
            );
          })}
          <Button
            variant={filter.preset === "CUSTOM" ? "default" : "outline"}
            size="sm"
            className="h-7 px-2.5 text-xs font-medium"
            onClick={() => setShowCustomModal(!showCustomModal)}
          >
            Perso
          </Button>
        </div>

        {/* Niveau 3 : Commutateur MoM vs YoY */}
        <div className="flex items-center gap-1 rounded-md border bg-muted/40 p-0.5 text-xs">
          <span className="px-1.5 text-[11px] text-muted-foreground">vs :</span>
          <button
            type="button"
            className={cn(
              "rounded px-2 py-0.5 text-xs font-medium transition-colors",
              filter.compareType === "MoM"
                ? "bg-background text-foreground shadow-xs font-semibold"
                : "text-muted-foreground hover:text-foreground"
            )}
            onClick={() => setCompareType("MoM")}
          >
            M-1 (MoM)
          </button>
          <button
            type="button"
            className={cn(
              "rounded px-2 py-0.5 text-xs font-medium transition-colors",
              filter.compareType === "YoY"
                ? "bg-background text-foreground shadow-xs font-semibold"
                : "text-muted-foreground hover:text-foreground"
            )}
            onClick={() => setCompareType("YoY")}
          >
            N-1 (YoY)
          </button>
        </div>
      </div>

      {/* Niveau 2 : Navigation pas-à-pas & Libellés */}
      <div className="flex flex-wrap items-center justify-between border-t pt-2 text-xs">
        <div className="flex items-center gap-1.5">
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0 hover:bg-muted"
            onClick={() => step(-1)}
            title="Période précédente"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>

          <span className="font-semibold text-foreground text-sm tracking-tight px-1">
            {filter.label}
          </span>

          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0 hover:bg-muted"
            onClick={() => step(1)}
            title="Période suivante"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>

          {filter.isOngoing && (
            <Badge variant="outline" className="ml-1 border-amber-500/40 bg-amber-500/10 text-amber-600 dark:text-amber-400 gap-1 text-[11px] px-1.5 py-0">
              <Clock className="h-3 w-3" />
              En cours
            </Badge>
          )}
        </div>

        <div className="text-[11px] text-muted-foreground">
          Comparé à : <span className="font-medium text-foreground">{filter.compareLabel}</span>
        </div>
      </div>

      {/* Panneau de plage personnalisée (si actif ou déplié) */}
      {showCustomModal && (
        <form onSubmit={handleApplyCustom} className="flex flex-wrap items-center gap-2 border-t pt-2 text-xs">
          <span className="text-muted-foreground font-medium">Du</span>
          <input
            type="date"
            value={customStart || ""}
            onChange={(e) => setCustomStart(e.target.value)}
            className="h-7 rounded border bg-background px-2 text-xs"
            required
          />
          <span className="text-muted-foreground font-medium">au</span>
          <input
            type="date"
            value={customEnd || ""}
            onChange={(e) => setCustomEnd(e.target.value)}
            className="h-7 rounded border bg-background px-2 text-xs"
            required
          />
          <Button type="submit" size="sm" className="h-7 px-3 text-xs">
            Appliquer
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-xs text-muted-foreground"
            onClick={() => setShowCustomModal(false)}
          >
            Annuler
          </Button>
        </form>
      )}
    </div>
  );
}

export default PeriodSelector;
