import React from "react";
import { ArrowUpRight, ArrowDownRight, CalendarRange, CheckCircle2 } from "lucide-react";

export default function WeeklyReportView({ data }) {
  const {
    companyName,
    period,
    summary,
    kpis,
    fiveWeeksData,
    improvements,
    degradations,
    diagnostics,
    weeklyPriorities,
  } = data;

  const maxCa = Math.max(...fiveWeeksData.map((d) => d.ca), 300);

  return (
    <div className="space-y-6 text-foreground font-sans">
      {/* En-tête */}
      <div className="rounded-2xl border border-border/80 bg-gradient-to-r from-violet-900/10 via-card to-card p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border/60 pb-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-black tracking-widest text-primary uppercase">GESCOP</span>
              <span className="text-muted-foreground/60">•</span>
              <span className="inline-flex items-center rounded-full bg-violet-500/10 px-2.5 py-0.5 text-[11px] font-bold text-violet-600 dark:text-violet-400">
                Rapport hebdomadaire
              </span>
            </div>
            <h1 className="mt-1 text-2xl font-extrabold tracking-tight text-foreground">{companyName}</h1>
          </div>
          <div className="text-left sm:text-right">
            <span className="text-xs font-semibold text-muted-foreground">Période d'analyse</span>
            <p className="text-base font-bold text-foreground">{period || "Semaine 39 · 2026"}</p>
          </div>
        </div>

        {/* Zone 1 : Synthèse de la semaine */}
        <div className="mt-4 rounded-xl bg-violet-500/5 border border-violet-500/15 p-4">
          <p className="text-xs font-bold uppercase tracking-wider text-violet-700 dark:text-violet-300">
            Synthèse de la semaine
          </p>
          <p className="mt-1 text-sm font-medium leading-relaxed text-foreground">
            {summary}
          </p>
        </div>
      </div>

      {/* Zone 2 : Indicateurs clés */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* CA */}
        <div className="rounded-2xl border border-border bg-card p-5 shadow-sm transition-all hover:border-border/90">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Chiffre d'affaires</span>
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-xs font-bold text-emerald-600 dark:text-emerald-400">
              <ArrowUpRight className="h-3.5 w-3.5" />
              {kpis.ca.delta}
            </span>
          </div>
          <div className="mt-3">
            <span className="text-2xl sm:text-3xl font-extrabold tracking-tight">{kpis.ca.value}</span>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">vs semaine précédente</p>
        </div>

        {/* Marge */}
        <div className="rounded-2xl border border-border bg-card p-5 shadow-sm transition-all hover:border-border/90">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Marge brute</span>
            <span className="inline-flex items-center gap-1 rounded-full bg-red-500/10 px-2 py-0.5 text-xs font-bold text-red-600 dark:text-red-400">
              <ArrowDownRight className="h-3.5 w-3.5" />
              {kpis.marge.delta}
            </span>
          </div>
          <div className="mt-3">
            <span className="text-2xl sm:text-3xl font-extrabold tracking-tight">{kpis.marge.value}</span>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">vs semaine précédente</p>
        </div>

        {/* Commandes */}
        <div className="rounded-2xl border border-border bg-card p-5 shadow-sm transition-all hover:border-border/90">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Commandes</span>
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-xs font-bold text-emerald-600 dark:text-emerald-400">
              <ArrowUpRight className="h-3.5 w-3.5" />
              {kpis.commandes.delta}
            </span>
          </div>
          <div className="mt-3">
            <span className="text-2xl sm:text-3xl font-extrabold tracking-tight">{kpis.commandes.value}</span>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">Panier moyen : {kpis.panierMoyen.value}</p>
        </div>

        {/* Trésorerie */}
        <div className="rounded-2xl border border-border bg-card p-5 shadow-sm transition-all hover:border-border/90">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Trésorerie</span>
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2 py-0.5 text-xs font-bold text-amber-600 dark:text-amber-400">
              <ArrowDownRight className="h-3.5 w-3.5" />
              {kpis.tresorerie.delta}
            </span>
          </div>
          <div className="mt-3">
            <span className="text-2xl sm:text-3xl font-extrabold tracking-tight">{kpis.tresorerie.value}</span>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">vs semaine précédente</p>
        </div>
      </div>

      {/* Zone 3 : Évolution des 5 dernières semaines */}
      <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-6">
          <div>
            <h2 className="text-sm font-bold uppercase tracking-wider text-foreground">
              Évolution sur les 5 dernières semaines
            </h2>
            <p className="text-xs text-muted-foreground">Chiffre d'affaires et taux de marge brute constatés</p>
          </div>
          <div className="flex items-center gap-4 text-xs font-medium">
            <div className="flex items-center gap-1.5">
              <span className="h-3 w-3 rounded-xs bg-primary" />
              <span>Chiffre d'affaires (k$)</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="h-3 w-3 rounded-xs bg-violet-400" />
              <span>Marge brute (%)</span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-5 gap-3 pt-4 border-t border-border/50">
          {fiveWeeksData.map((w, idx) => {
            const isCurrent = idx === fiveWeeksData.length - 1;
            const heightPct = Math.round((w.ca / maxCa) * 100);
            return (
              <div key={w.week} className="flex flex-col items-center">
                <div className="flex h-28 w-full items-end justify-center rounded-lg bg-muted/30 p-1.5">
                  <div
                    style={{ height: `${heightPct}%` }}
                    className={`w-full max-w-[36px] rounded-t-md transition-all ${
                      isCurrent
                        ? "bg-gradient-to-t from-primary to-primary/80 shadow-sm ring-2 ring-primary/30"
                        : "bg-muted-foreground/30 hover:bg-muted-foreground/40"
                    }`}
                  />
                </div>
                <span className={`mt-2 text-xs font-bold ${isCurrent ? "text-primary" : "text-muted-foreground"}`}>
                  {w.week}
                </span>
                <span className="text-xs font-semibold text-foreground">{w.ca} k$</span>
                <span className="text-[11px] text-muted-foreground">{w.marge.toFixed(1).replace(".", ",")} %</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Zone 4 : Bilan 2 colonnes */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Ce qui s'améliore */}
        <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-6 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
              ▲
            </span>
            <h2 className="text-sm font-bold uppercase tracking-wider text-emerald-900 dark:text-emerald-300">
              Ce qui s'améliore
            </h2>
          </div>
          <div className="space-y-3">
            {improvements.map((item, idx) => (
              <div key={idx} className="rounded-xl border border-emerald-500/20 bg-card/80 p-3.5 shadow-2xs">
                <p className="text-sm font-bold text-foreground">{item.title}</p>
                <p className="mt-1 text-xs text-muted-foreground leading-relaxed">{item.detail}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Ce qui recule */}
        <div className="rounded-2xl border border-red-500/30 bg-red-500/5 p-6 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-red-500/15 text-red-600 dark:text-red-400">
              ▼
            </span>
            <h2 className="text-sm font-bold uppercase tracking-wider text-red-900 dark:text-red-300">
              Ce qui recule
            </h2>
          </div>
          <div className="space-y-3">
            {degradations.map((item, idx) => (
              <div key={idx} className="rounded-xl border border-red-500/20 bg-card/80 p-3.5 shadow-2xs">
                <p className="text-sm font-bold text-foreground">{item.title}</p>
                <p className="mt-1 text-xs text-muted-foreground leading-relaxed">{item.detail}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Zone 5 : Diagnostic factuel & Points à examiner */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Diagnostic */}
        <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <CalendarRange className="h-5 w-5 text-primary" />
            <h2 className="text-sm font-bold uppercase tracking-wider text-foreground">
              Diagnostic factuel
            </h2>
          </div>
          <div className="space-y-3">
            {diagnostics.map((diag, idx) => (
              <div key={idx} className="rounded-xl border border-border/80 bg-muted/20 p-4">
                <span className={`inline-flex items-center rounded-md border px-2 py-0.5 text-[10px] font-black tracking-wider ${diag.badge}`}>
                  [{diag.tag}]
                </span>
                <p className="mt-2 text-sm font-medium leading-relaxed text-foreground">
                  {diag.text}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Points à examiner la semaine prochaine */}
        <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <CheckCircle2 className="h-5 w-5 text-violet-600 dark:text-violet-400" />
            <h2 className="text-sm font-bold uppercase tracking-wider text-foreground">
              Points à examiner la semaine prochaine
            </h2>
          </div>
          <div className="space-y-3">
            {weeklyPriorities.map((prio, idx) => {
              const numSymbols = ["①", "②", "③"];
              return (
                <div
                  key={idx}
                  className="flex items-start gap-3 rounded-xl border border-border/70 bg-gradient-to-r from-violet-500/5 to-transparent p-4 transition-colors hover:bg-muted/30"
                >
                  <span className="text-lg font-bold text-violet-600 dark:text-violet-400">
                    {numSymbols[idx] || `${idx + 1}.`}
                  </span>
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-foreground leading-relaxed">
                      {prio}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
