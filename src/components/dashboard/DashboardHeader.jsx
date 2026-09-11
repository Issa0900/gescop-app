import React from "react";
import { Button } from "@/components/ui/button";
import { RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";

export default function DashboardHeader({ greeting, date, lastAnalysis, onAnalyze, analyzing, hasData }) {
  return (
    <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{greeting}</h1>
        <p className="mt-0.5 text-sm capitalize text-muted-foreground">{date}</p>
      </div>
      <div className="flex items-center gap-3">
        {lastAnalysis && !analyzing && (
          <div className="hidden items-center gap-1.5 text-xs text-muted-foreground sm:flex">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
            Dernière analyse : {lastAnalysis}
          </div>
        )}
        <Button onClick={onAnalyze} disabled={analyzing || !hasData} className="shrink-0">
          <RefreshCw className={cn("mr-2 h-4 w-4", analyzing && "animate-spin")} />
          {analyzing ? "Analyse en cours…" : "Analyser maintenant"}
        </Button>
      </div>
    </div>
  );
}