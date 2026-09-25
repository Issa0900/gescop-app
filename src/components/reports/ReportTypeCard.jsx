import React from "react";
import { Button } from "@/components/ui/button";
import { Loader2, Calendar, Sun, CalendarDays, CalendarRange, Check, FileText } from "lucide-react";

const config = {
  quotidien: {
    icon: Sun,
    tag: "SURVEILLER",
    tagColor: "bg-blue-500/10 text-blue-600 border-blue-200 dark:border-blue-800",
    label: "Rapport quotidien",
    subtitle: "Les éléments qui méritent votre attention aujourd'hui.",
    bullets: [
      "État général et indicateurs clés",
      "Points d'attention et écarts notables",
      "Actions prioritaires à examiner",
      "Indicateur de fiabilité des données",
    ],
    gradient: "from-blue-500/10 via-blue-500/5 to-card",
    accent: "text-blue-600",
    borderHover: "hover:border-blue-400/60",
  },
  hebdomadaire: {
    icon: CalendarRange,
    tag: "COMPRENDRE",
    tagColor: "bg-violet-500/10 text-violet-600 border-violet-200 dark:border-violet-800",
    label: "Rapport hebdomadaire",
    subtitle: "Les principales évolutions de la semaine et leurs facteurs associés.",
    bullets: [
      "Comparaison semaine contre semaine",
      "Évolution observée sur 5 semaines",
      "Ce qui s'améliore et ce qui recule",
      "Diagnostic factuel : faits, calculs, facteurs",
    ],
    gradient: "from-violet-500/10 via-violet-500/5 to-card",
    accent: "text-violet-600",
    borderHover: "hover:border-violet-400/60",
  },
  mensuel: {
    icon: CalendarDays,
    tag: "PILOTER",
    badgeExtra: "Dossier de référence",
    tagColor: "bg-emerald-500/10 text-emerald-600 border-emerald-200 dark:border-emerald-800",
    label: "Rapport mensuel",
    subtitle: "Une vue complète de la rentabilité, des tendances et des points à examiner.",
    bullets: [
      "Synthèse exécutive et 4 piliers de gestion",
      "Décomposition financière et flux transversaux",
      "Facteurs observés et simulation de scénarios",
      "Plan d'action structuré et audit des sources",
    ],
    gradient: "from-emerald-500/10 via-emerald-500/5 to-card",
    accent: "text-emerald-600",
    borderHover: "hover:border-emerald-400/60",
  },
};

export default function ReportTypeCard({ typeKey, onGenerate, isGenerating }) {
  const cfg = config[typeKey];
  if (!cfg) return null;
  const Icon = cfg.icon;

  return (
    <div
      className={`group relative flex flex-col justify-between overflow-hidden rounded-2xl border border-border bg-gradient-to-b ${cfg.gradient} p-5 transition-all duration-200 hover:shadow-lg ${cfg.borderHover}`}
    >
      <div>
        {/* Top Header Tags */}
        <div className="flex items-center justify-between gap-2">
          <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-bold tracking-wider ${cfg.tagColor}`}>
            {cfg.tag}
          </span>
          {cfg.badgeExtra && (
            <span className="inline-flex items-center gap-1 rounded-full border border-emerald-300/40 bg-emerald-500/10 px-2.5 py-0.5 text-[10px] font-semibold text-emerald-700 dark:text-emerald-300">
              <FileText className="h-3 w-3 text-emerald-600" />
              {cfg.badgeExtra}
            </span>
          )}
        </div>

        {/* Icon & Title */}
        <div className="mt-4 flex items-center gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-card shadow-sm border border-border/50">
            <Icon className={`h-5 w-5 ${cfg.accent}`} />
          </div>
          <div>
            <h3 className="text-base font-bold tracking-tight text-foreground">{cfg.label}</h3>
            <p className="mt-0.5 text-xs text-muted-foreground">{cfg.subtitle}</p>
          </div>
        </div>

        {/* Bullet features */}
        <div className="mt-4 space-y-2 border-t border-border/60 pt-3.5">
          {cfg.bullets.map((bullet, idx) => (
            <div key={idx} className="flex items-start gap-2 text-xs text-muted-foreground">
              <div className="mt-0.5 flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full bg-primary/10">
                <Check className="h-2.5 w-2.5 text-primary" />
              </div>
              <span className="leading-snug">{bullet}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Button with clear verb */}
      <Button
        size="sm"
        className="mt-5 w-full shadow-sm"
        onClick={() => onGenerate(typeKey)}
        disabled={isGenerating}
      >
        {isGenerating ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Génération en cours…
          </>
        ) : (
          <>
            <Calendar className="mr-2 h-4 w-4" />
            Générer le rapport
          </>
        )}
      </Button>
    </div>
  );
}