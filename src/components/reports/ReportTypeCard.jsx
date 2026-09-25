import React from "react";
import { Button } from "@/components/ui/button";
import { Loader2, Calendar, Sun, CalendarDays, CalendarRange, Check, Sparkles } from "lucide-react";

const config = {
  quotidien: {
    icon: Sun,
    tag: "SURVEILLER",
    tagColor: "bg-blue-500/10 text-blue-600 border-blue-200 dark:border-blue-800",
    label: "Rapport Quotidien",
    subtitle: "Scan en < 2 min pour le dirigeant",
    bullets: [
      "État général & situation immédiate",
      "4 KPI essentiels (CA, Marge, Trésorerie, Stock)",
      "Points d'attention & alertes sans détour",
      "Jauge de fiabilité des données unifiée",
    ],
    gradient: "from-blue-500/10 via-blue-500/5 to-card",
    accent: "text-blue-600",
    borderHover: "hover:border-blue-400/60",
  },
  hebdomadaire: {
    icon: CalendarRange,
    tag: "COMPRENDRE",
    tagColor: "bg-violet-500/10 text-violet-600 border-violet-200 dark:border-violet-800",
    label: "Rapport Hebdomadaire",
    subtitle: "Passer de la surveillance à la compréhension",
    bullets: [
      "Comparaisons Semaine / Semaine (S/S)",
      "Courbes d'évolution des 5 dernières semaines",
      "Bilan croisé : Ce qui s'améliore vs dégrade",
      "Diagnostic [FAIT] / [CALCUL] / [FACTEUR]",
    ],
    gradient: "from-violet-500/10 via-violet-500/5 to-card",
    accent: "text-violet-600",
    borderHover: "hover:border-violet-400/60",
  },
  mensuel: {
    icon: CalendarDays,
    tag: "PILOTER",
    badgeExtra: "Rapport Vitrine",
    tagColor: "bg-emerald-500/10 text-emerald-600 border-emerald-200 dark:border-emerald-800",
    label: "Rapport Mensuel",
    subtitle: "Dossier exécutif complet (Banque, CA, Associés)",
    bullets: [
      "Couverture prestige & Executive Brief 4 piliers",
      "Vue 4 quadrants & analyse transversale causale",
      "Intelligence GESCOP & simulateur 'Et si...'",
      "Plan d'action tabulaire & audit de fiabilité",
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
            <span className="inline-flex items-center gap-1 rounded-full bg-gradient-to-r from-amber-500/15 to-emerald-500/15 border border-amber-300/40 px-2.5 py-0.5 text-[10px] font-semibold text-amber-700 dark:text-amber-300">
              <Sparkles className="h-3 w-3 text-amber-500" />
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
            <p className="text-xs text-muted-foreground">{cfg.subtitle}</p>
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

      {/* Button */}
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
            Générer ce rapport
          </>
        )}
      </Button>
    </div>
  );
}