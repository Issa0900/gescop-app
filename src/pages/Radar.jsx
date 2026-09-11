import React from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import EmptyState from "@/components/EmptyState";
import { Radar as RadarIcon, TrendingUp, TrendingDown, Minus } from "lucide-react";

const familyLabels = {
  gouvernement: "Gouvernement",
  economie: "Économie",
  marche: "Marché",
  concurrence: "Concurrence",
  fournisseurs: "Fournisseurs",
  consommateurs: "Consommateurs",
  actualites: "Actualités",
};

const familyColors = {
  gouvernement: "bg-blue-50 text-blue-700",
  economie: "bg-purple-50 text-purple-700",
  marche: "bg-emerald-50 text-emerald-700",
  concurrence: "bg-red-50 text-red-700",
  fournisseurs: "bg-amber-50 text-amber-700",
  consommateurs: "bg-pink-50 text-pink-700",
  actualites: "bg-slate-50 text-slate-700",
};

const impactIcon = { positif: TrendingUp, negatif: TrendingDown, neutre: Minus };
const impactColor = { positif: "text-emerald-600", negatif: "text-red-600", neutre: "text-muted-foreground" };

export default function Radar() {
  const { data: signals, isLoading } = useQuery({
    queryKey: ["signals"],
    queryFn: async () => {
      const list = await base44.entities.ExternalSignal.list("-relevance_score", 50);
      return (list || []).sort((a, b) => (b.relevance_score || 0) - (a.relevance_score || 0));
    },
  });

  if (isLoading) return <p className="text-sm text-muted-foreground">Chargement…</p>;

  const byFamily = {};
  (signals || []).forEach((s) => {
    if (!byFamily[s.family]) byFamily[s.family] = [];
    byFamily[s.family].push(s);
  });

  if (!signals || signals.length === 0) {
    return (
      <EmptyState
        icon={RadarIcon}
        title="Radar externe vide"
        description="Lancez l'analyse IA pour détecter les signaux externes pertinents pour votre entreprise."
      />
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Radar externe</h1>
        <p className="mt-1 text-muted-foreground">
          Surveillance de votre environnement à travers sept familles de sources.
        </p>
      </div>

      {Object.keys(familyLabels).map((family) => {
        const items = byFamily[family];
        if (!items || items.length === 0) return null;
        return (
          <div key={family}>
            <div className="mb-3 flex items-center gap-2">
              <span className={`rounded-full px-3 py-1 text-xs font-medium ${familyColors[family]}`}>
                {familyLabels[family]}
              </span>
              <span className="text-xs text-muted-foreground">{items.length} signal{items.length > 1 ? "s" : ""}</span>
            </div>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              {items.map((s) => {
                const IIcon = impactIcon[s.impact] || Minus;
                return (
                  <div key={s.id} className="rounded-xl border border-border bg-card p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <IIcon className={`h-4 w-4 ${impactColor[s.impact] || ""}`} />
                          <h3 className="text-sm font-semibold">{s.title}</h3>
                        </div>
                        {s.description && <p className="mt-1.5 text-sm text-muted-foreground">{s.description}</p>}
                        <div className="mt-3 flex items-center gap-3 text-xs text-muted-foreground">
                          <span>Pertinence: <strong className="text-foreground">{s.relevance_score || 0}/100</strong></span>
                          {s.source && <span>· {s.source}</span>}
                          {s.horizon && <span>· {s.horizon}</span>}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}