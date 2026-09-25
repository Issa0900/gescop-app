import React from "react";
import { AlertTriangle, CheckCircle2, ShieldCheck, ArrowUpRight, ArrowDownRight } from "lucide-react";
import { Progress } from "@/components/ui/progress";

export default function DailyReportView({ data }) {
  const { kpis, summary, attentionPoints, dailyActions, reliability, companyName, period } = data;

  return (
    <div className="space-y-6 text-foreground font-sans">
      {/* En-tête */}
      <div className="rounded-2xl border border-border/80 bg-gradient-to-r from-blue-900/10 via-card to-card p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border/60 pb-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-black tracking-widest text-primary uppercase">GESCOP</span>
              <span className="text-muted-foreground/60">•</span>
              <span className="inline-flex items-center rounded-full bg-blue-500/10 px-2.5 py-0.5 text-[11px] font-bold text-blue-600 dark:text-blue-400">
                Rapport quotidien
              </span>
            </div>
            <h1 className="mt-1 text-2xl font-extrabold tracking-tight text-foreground">{companyName}</h1>
          </div>
          <div className="text-left sm:text-right">
            <span className="text-xs font-semibold text-muted-foreground">Période du jour</span>
            <p className="text-base font-bold text-foreground">{period || new Date().toLocaleDateString("fr-CA")}</p>
          </div>
        </div>

        {/* État général */}
        <div className="mt-4 rounded-xl bg-blue-500/5 border border-blue-500/15 p-4">
          <p className="text-xs font-bold uppercase tracking-wider text-blue-700 dark:text-blue-300">État général</p>
          <p className="mt-1 text-sm font-medium leading-relaxed text-foreground">
            {summary}
          </p>
        </div>
      </div>

      {/* 4 Indicateurs clés */}
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
          <p className="mt-1 text-xs text-muted-foreground">Précédent : {kpis.ca.previous}</p>
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
          <p className="mt-1 text-xs text-muted-foreground">Précédent : {kpis.marge.previous}</p>
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
          <p className="mt-1 text-xs text-muted-foreground">Précédent : {kpis.tresorerie.previous}</p>
        </div>

        {/* Stock */}
        <div className="rounded-2xl border border-border bg-card p-5 shadow-sm transition-all hover:border-border/90">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Stock total</span>
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2 py-0.5 text-xs font-bold text-amber-600 dark:text-amber-400">
              <AlertTriangle className="h-3.5 w-3.5" />
              {kpis.stock.delta}
            </span>
          </div>
          <div className="mt-3">
            <span className="text-2xl sm:text-3xl font-extrabold tracking-tight">{kpis.stock.value}</span>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">Dormant : {kpis.stock.dormant}</p>
        </div>
      </div>

      {/* Points d'attention */}
      <div className="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-6 shadow-sm">
        <div className="flex items-center gap-2 mb-4">
          <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400" />
          <h2 className="text-sm font-bold uppercase tracking-wider text-amber-900 dark:text-amber-200">
            Points d'attention
          </h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {attentionPoints.map((pt, idx) => (
            <div key={idx} className="rounded-xl border border-amber-500/20 bg-card/80 p-4 shadow-xs">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 font-bold text-sm text-foreground">
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-amber-500/15 text-[11px] text-amber-700 dark:text-amber-300">
                    {pt.num}
                  </span>
                  <span>{pt.title}</span>
                </div>
                <span className="text-xs font-bold text-amber-700 dark:text-amber-300">{pt.deltaText}</span>
              </div>
              <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                {pt.factor}
              </p>
              {pt.toExamine && (
                <p className="mt-1.5 text-xs font-semibold text-foreground leading-relaxed">
                  {pt.toExamine}
                </p>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Actions recommandées */}
      <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
        <div className="flex items-center gap-2 mb-4">
          <CheckCircle2 className="h-5 w-5 text-primary" />
          <h2 className="text-sm font-bold uppercase tracking-wider text-foreground">
            Actions recommandées
          </h2>
        </div>
        <div className="space-y-2.5">
          {dailyActions.map((action, idx) => (
            <div
              key={idx}
              className="flex items-start gap-3 rounded-xl border border-border/60 bg-muted/20 px-4 py-3 text-sm text-foreground transition-colors hover:bg-muted/40"
            >
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
              <span className="font-medium leading-relaxed">{action}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Fiabilité des données */}
      <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
            <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Fiabilité des données</span>
          </div>
          <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">
            {reliability.score} % de certitude unifiée
          </span>
        </div>
        <Progress value={reliability.score} className="h-2.5 bg-muted" />
        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
          <span><strong>{reliability.transactions.toLocaleString()}</strong> transactions vérifiées</span>
          <span>•</span>
          <span><strong>{reliability.sources}</strong> sources connectées</span>
          <span>•</span>
          <span><strong>{reliability.anomalies}</strong> anomalies neutralisées</span>
        </div>
      </div>
    </div>
  );
}
