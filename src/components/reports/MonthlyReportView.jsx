import React, { useState } from "react";
import {
  TrendingUp,
  ArrowUpRight,
  ArrowDownRight,
  ShieldCheck,
  CheckCircle2,
  Layers,
  ArrowRight,
  Calculator,
  Sliders,
  Building2,
  Calendar,
  Wallet,
  Package,
  Users,
  Compass,
  FileText
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";

const SECTIONS = [
  { id: "cover", label: "01. Couverture", icon: Building2 },
  { id: "brief", label: "02. Synthèse exécutive", icon: FileText },
  { id: "quadrants", label: "03. 4 Quadrants", icon: Compass },
  { id: "finance", label: "04. Votre rentabilité", icon: TrendingUp },
  { id: "treasury", label: "05. Votre trésorerie", icon: Wallet },
  { id: "sales", label: "06. Vos clients", icon: Users },
  { id: "stock", label: "07. Vos stocks", icon: Package },
  { id: "transversal", label: "08. Analyse des flux", icon: Layers },
  { id: "intelligence", label: "09. Facteurs observés", icon: Calculator },
  { id: "scenarios", label: "10. Simulation", icon: Sliders },
  { id: "actions", label: "11. Plan d'action", icon: CheckCircle2 },
  { id: "reliability", label: "12. Fiabilité des données", icon: ShieldCheck },
];

export default function MonthlyReportView({ data }) {
  const [activeTab, setActiveTab] = useState("brief");
  const [displayMode, setDisplayMode] = useState("tabs"); // 'tabs' | 'continuous'
  const [customPriceIncrease, setCustomPriceIncrease] = useState(3);

  const {
    companyName,
    period,
    kpis,
    reliability,
    intelligenceInsights,
    scenarios,
    actionPlan,
    transversalFlow,
  } = data;

  const simMargeGain = Math.round(customPriceIncrease * 11840);
  const simCashGain = Math.round(simMargeGain * 0.95);

  return (
    <div className="space-y-6 text-foreground font-sans">
      {/* Barre de contrôle supérieure */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-2xl border border-border bg-card p-4 shadow-sm">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600">
            <FileText className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Rapport mensuel</span>
              <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold text-emerald-600">
                12 sections
              </span>
            </div>
            <p className="text-sm font-bold text-foreground">Une vue complète de la rentabilité, des tendances et des points à examiner.</p>
          </div>
        </div>

        {/* Sélecteur de mode de consultation */}
        <div className="flex items-center gap-1.5 rounded-xl border border-border bg-muted/30 p-1">
          <Button
            size="sm"
            variant={displayMode === "tabs" ? "default" : "ghost"}
            className="h-8 text-xs font-semibold"
            onClick={() => setDisplayMode("tabs")}
          >
            Navigation par section
          </Button>
          <Button
            size="sm"
            variant={displayMode === "continuous" ? "default" : "ghost"}
            className="h-8 text-xs font-semibold"
            onClick={() => setDisplayMode("continuous")}
          >
            Dossier complet (12 pages)
          </Button>
        </div>
      </div>

      {/* Navigation par onglets */}
      {displayMode === "tabs" && (
        <div className="overflow-x-auto pb-1 scrollbar-thin">
          <div className="flex items-center gap-1.5 min-w-max border-b border-border pb-2">
            {SECTIONS.map((sec) => {
              const Icon = sec.icon;
              const isActive = activeTab === sec.id;
              return (
                <button
                  key={sec.id}
                  onClick={() => setActiveTab(sec.id)}
                  className={`flex items-center gap-2 rounded-xl px-3.5 py-2 text-xs font-semibold transition-all ${
                    isActive
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "bg-card text-muted-foreground hover:bg-muted hover:text-foreground border border-border"
                  }`}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {sec.label}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* CONTENU DES SECTIONS */}
      <div className="space-y-8">
        {/* PAGE 1 : COUVERTURE */}
        {(displayMode === "continuous" || activeTab === "cover") && (
          <section className="relative overflow-hidden rounded-3xl border border-border/80 bg-gradient-to-br from-card via-card to-emerald-950/20 p-8 sm:p-14 shadow-lg">
            <div className="flex items-center justify-between border-b border-border/50 pb-6">
              <span className="text-xl font-black tracking-widest text-primary uppercase">GESCOP</span>
              <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-bold text-emerald-600">
                Fiabilité analytique : 92 %
              </span>
            </div>

            <div className="my-12 sm:my-16 max-w-2xl">
              <span className="text-xs font-extrabold uppercase tracking-widest text-emerald-600">
                Direction générale et associés
              </span>
              <h1 className="mt-3 text-3xl sm:text-5xl font-black tracking-tight text-foreground leading-tight">
                Rapport mensuel de gestion
              </h1>
              <p className="mt-4 text-xl sm:text-2xl font-bold text-muted-foreground">
                {companyName}
              </p>
              <div className="mt-6 inline-flex items-center gap-2 rounded-xl bg-muted/40 px-4 py-2 text-sm font-semibold text-foreground">
                <Calendar className="h-4 w-4 text-primary" />
                <span>Période : {period || "Septembre 2026"}</span>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-t border-border/50 pt-6 text-xs text-muted-foreground">
              <div>
                <p>Édité le {new Date().toLocaleDateString("fr-CA")} par GESCOP</p>
                <p className="mt-0.5">Référence : GSC-{new Date().getFullYear()}-{new Date().getMonth() + 1}-NDK</p>
              </div>
              <div className="flex items-center gap-2 text-emerald-600 font-bold">
                <ShieldCheck className="h-4 w-4" />
                <span>Document réservé aux décideurs</span>
              </div>
            </div>
          </section>
        )}

        {/* PAGE 2 : SYNTHÈSE EXÉCUTIVE */}
        {(displayMode === "continuous" || activeTab === "brief") && (
          <section className="rounded-2xl border border-border bg-card p-6 sm:p-8 shadow-sm space-y-6">
            <div className="flex items-center justify-between border-b border-border/60 pb-4">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-primary">Page 02</span>
                <h2 className="text-xl font-bold text-foreground">Synthèse exécutive</h2>
              </div>
              <Badge variant="outline" className="text-xs">Vue d'ensemble</Badge>
            </div>

            <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4 sm:p-5">
              <h3 className="text-xs font-bold uppercase tracking-wider text-emerald-800 dark:text-emerald-300">
                Situation générale de l'entreprise
              </h3>
              <p className="mt-1.5 text-sm sm:text-base leading-relaxed font-medium text-foreground">
                Le chiffre d'affaires progresse de 6,4 % par rapport à la même période de l'exercice précédent. La marge brute recule de 1,8 point, principalement sous l'effet du coût des approvisionnements d'hiver. La trésorerie nette s'établit à 182 400 $, assurant une réserve de 42 jours d'exploitation.
              </p>
            </div>

            {/* 4 Piliers */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="rounded-xl border border-border/70 bg-muted/20 p-4">
                <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Chiffre d'affaires</span>
                <p className="mt-2 text-2xl font-black text-foreground">{kpis.ca.value}</p>
                <div className="mt-1 flex items-center gap-1 text-xs font-bold text-emerald-600">
                  <ArrowUpRight className="h-3.5 w-3.5" />
                  <span>+6,4 % vs N-1</span>
                </div>
              </div>
              <div className="rounded-xl border border-border/70 bg-muted/20 p-4">
                <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Marge brute</span>
                <p className="mt-2 text-2xl font-black text-foreground">{kpis.marge.value}</p>
                <div className="mt-1 flex items-center gap-1 text-xs font-bold text-red-600">
                  <ArrowDownRight className="h-3.5 w-3.5" />
                  <span>-1,8 pt</span>
                </div>
              </div>
              <div className="rounded-xl border border-border/70 bg-muted/20 p-4">
                <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Résultat estimé</span>
                <p className="mt-2 text-2xl font-black text-foreground">{kpis.resultat.value}</p>
                <div className="mt-1 flex items-center gap-1 text-xs font-bold text-emerald-600">
                  <ArrowUpRight className="h-3.5 w-3.5" />
                  <span>7,3 % du CA</span>
                </div>
              </div>
              <div className="rounded-xl border border-border/70 bg-muted/20 p-4">
                <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Trésorerie nette</span>
                <p className="mt-2 text-2xl font-black text-foreground">{kpis.tresorerie.value}</p>
                <div className="mt-1 flex items-center gap-1 text-xs font-bold text-muted-foreground">
                  <span>42 jours de réserve</span>
                </div>
              </div>
            </div>

            {/* Les 3 faits majeurs du mois */}
            <div className="border-t border-border/60 pt-5">
              <h3 className="text-xs font-bold uppercase tracking-wider text-foreground mb-3">
                Les 3 faits majeurs du mois
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="rounded-xl border border-border/60 bg-card p-4">
                  <span className="text-xs font-extrabold text-primary">01. EXPANSION COMMERCIALE</span>
                  <p className="mt-1.5 text-xs text-muted-foreground leading-relaxed">
                    Volume soutenu de commandes en ligne et bonne progression des succursales Lévis et Québec (+11 % combiné).
                  </p>
                </div>
                <div className="rounded-xl border border-border/60 bg-card p-4">
                  <span className="text-xs font-extrabold text-amber-600">02. COMPRESSION DE MARGE</span>
                  <p className="mt-1.5 text-xs text-muted-foreground leading-relaxed">
                    Hausse constatée des coûts d'achat sur la famille textile d'hiver, expliquant un écart de 33 000 $ de marge brute.
                  </p>
                </div>
                <div className="rounded-xl border border-border/60 bg-card p-4">
                  <span className="text-xs font-extrabold text-violet-600">03. STOCK SANS ROTATION</span>
                  <p className="mt-1.5 text-xs text-muted-foreground leading-relaxed">
                    Stock dormant évalué à 64 000 $ sur les articles estivaux, nécessitant une action de déstockage ciblée.
                  </p>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between rounded-xl bg-muted/30 px-4 py-3 text-xs text-muted-foreground">
              <span>Fiabilité analytique : <strong>92 %</strong></span>
              <span>1 248 transactions réconciliées</span>
            </div>
          </section>
        )}

        {/* PAGE 3 : VUE D'ENSEMBLE EN 4 QUADRANTS */}
        {(displayMode === "continuous" || activeTab === "quadrants") && (
          <section className="rounded-2xl border border-border bg-card p-6 sm:p-8 shadow-sm space-y-6">
            <div className="flex items-center justify-between border-b border-border/60 pb-4">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-primary">Page 03</span>
                <h2 className="text-xl font-bold text-foreground">Vue d'ensemble en 4 quadrants</h2>
              </div>
              <Badge variant="outline" className="text-xs">Synthèse 360°</Badge>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {/* Quadrant 1 : Performance financière */}
              <div className="rounded-2xl border border-blue-500/20 bg-blue-500/5 p-5">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold uppercase tracking-wider text-blue-900 dark:text-blue-300">
                    1. Votre rentabilité
                  </h3>
                  <TrendingUp className="h-4 w-4 text-blue-600" />
                </div>
                <div className="mt-4 space-y-2 text-xs">
                  <div className="flex justify-between py-1 border-b border-blue-500/10">
                    <span className="text-muted-foreground">Chiffre d'affaires net</span>
                    <strong className="text-foreground">1 184 000 $ (+6,4 %)</strong>
                  </div>
                  <div className="flex justify-between py-1 border-b border-blue-500/10">
                    <span className="text-muted-foreground">Coûts directs d'achat</span>
                    <strong className="text-foreground">804 000 $ (+9,1 %)</strong>
                  </div>
                  <div className="flex justify-between py-1 border-b border-blue-500/10">
                    <span className="text-muted-foreground">Marge brute</span>
                    <strong className="text-foreground">380 000 $ (32,1 %)</strong>
                  </div>
                  <div className="flex justify-between py-1">
                    <span className="text-muted-foreground">Résultat d'exploitation (EBITDA)</span>
                    <strong className="text-foreground">112 000 $ (9,5 %)</strong>
                  </div>
                </div>
              </div>

              {/* Quadrant 2 : Performance commerciale */}
              <div className="rounded-2xl border border-violet-500/20 bg-violet-500/5 p-5">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold uppercase tracking-wider text-violet-900 dark:text-violet-300">
                    2. Vos clients
                  </h3>
                  <Users className="h-4 w-4 text-violet-600" />
                </div>
                <div className="mt-4 space-y-2 text-xs">
                  <div className="flex justify-between py-1 border-b border-violet-500/10">
                    <span className="text-muted-foreground">Commandes enregistrées</span>
                    <strong className="text-foreground">5 890 commandes (+11,3 %)</strong>
                  </div>
                  <div className="flex justify-between py-1 border-b border-violet-500/10">
                    <span className="text-muted-foreground">Panier moyen</span>
                    <strong className="text-foreground">201 $ (+0,8 %)</strong>
                  </div>
                  <div className="flex justify-between py-1 border-b border-violet-500/10">
                    <span className="text-muted-foreground">Taux de retour</span>
                    <strong className="text-foreground">3,2 %</strong>
                  </div>
                  <div className="flex justify-between py-1">
                    <span className="text-muted-foreground">Nouveaux clients</span>
                    <strong className="text-foreground">412 clients (+8,7 %)</strong>
                  </div>
                </div>
              </div>

              {/* Quadrant 3 : Opérations & stocks */}
              <div className="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-5">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold uppercase tracking-wider text-amber-900 dark:text-amber-300">
                    3. Vos stocks
                  </h3>
                  <Package className="h-4 w-4 text-amber-600" />
                </div>
                <div className="mt-4 space-y-2 text-xs">
                  <div className="flex justify-between py-1 border-b border-amber-500/10">
                    <span className="text-muted-foreground">Valeur globale du stock</span>
                    <strong className="text-foreground">420 000 $ (+5,8 %)</strong>
                  </div>
                  <div className="flex justify-between py-1 border-b border-amber-500/10">
                    <span className="text-muted-foreground">Stock dormant &gt; 60 jours</span>
                    <strong className="text-foreground">64 000 $ (15,2 % du stock)</strong>
                  </div>
                  <div className="flex justify-between py-1 border-b border-amber-500/10">
                    <span className="text-muted-foreground">Délai moyen de rotation</span>
                    <strong className="text-foreground">41 jours (cible : 35 jours)</strong>
                  </div>
                  <div className="flex justify-between py-1">
                    <span className="text-muted-foreground">Ruptures constatées</span>
                    <strong className="text-amber-600 font-bold">7 références clés</strong>
                  </div>
                </div>
              </div>

              {/* Quadrant 4 : Trésorerie & liquidités */}
              <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-5">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold uppercase tracking-wider text-emerald-900 dark:text-emerald-300">
                    4. Votre trésorerie
                  </h3>
                  <Wallet className="h-4 w-4 text-emerald-600" />
                </div>
                <div className="mt-4 space-y-2 text-xs">
                  <div className="flex justify-between py-1 border-b border-emerald-500/10">
                    <span className="text-muted-foreground">Solde de clôture</span>
                    <strong className="text-foreground">182 400 $ (-3,2 %)</strong>
                  </div>
                  <div className="flex justify-between py-1 border-b border-emerald-500/10">
                    <span className="text-muted-foreground">Flux net d'exploitation</span>
                    <strong className="text-foreground">+38 200 $</strong>
                  </div>
                  <div className="flex justify-between py-1 border-b border-emerald-500/10">
                    <span className="text-muted-foreground">Projection à 30 jours</span>
                    <strong className="text-foreground">168 000 $</strong>
                  </div>
                  <div className="flex justify-between py-1">
                    <span className="text-muted-foreground">Réserve disponible</span>
                    <strong className="text-emerald-600 font-bold">42 jours d'exploitation</strong>
                  </div>
                </div>
              </div>
            </div>
          </section>
        )}

        {/* PAGE 4 : VOTRE RENTABILITÉ */}
        {(displayMode === "continuous" || activeTab === "finance") && (
          <section className="rounded-2xl border border-border bg-card p-6 sm:p-8 shadow-sm space-y-6">
            <div className="flex items-center justify-between border-b border-border/60 pb-4">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-primary">Page 04</span>
                <h2 className="text-xl font-bold text-foreground">Votre rentabilité</h2>
              </div>
              <Badge variant="outline" className="text-xs">Décomposition</Badge>
            </div>

            {/* Waterfall */}
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3">
                Décomposition du chiffre d'affaires au résultat
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-5 gap-2 text-center">
                <div className="rounded-xl border border-border bg-muted/20 p-3">
                  <span className="text-[11px] text-muted-foreground">CA net</span>
                  <p className="text-base font-extrabold text-foreground mt-1">1 184 k$</p>
                  <span className="text-[10px] text-emerald-600 font-bold">Base 100 %</span>
                </div>
                <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-3">
                  <span className="text-[11px] text-muted-foreground">Coûts directs</span>
                  <p className="text-base font-extrabold text-red-600 mt-1">-804 k$</p>
                  <span className="text-[10px] text-red-600 font-bold">-67,9 %</span>
                </div>
                <div className="rounded-xl border border-primary/30 bg-primary/10 p-3">
                  <span className="text-[11px] text-primary font-bold">Marge brute</span>
                  <p className="text-base font-extrabold text-primary mt-1">380 k$</p>
                  <span className="text-[10px] text-primary font-bold">32,1 %</span>
                </div>
                <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-3">
                  <span className="text-[11px] text-muted-foreground">Charges opérationnelles</span>
                  <p className="text-base font-extrabold text-amber-600 mt-1">-294 k$</p>
                  <span className="text-[10px] text-amber-600 font-bold">-24,8 %</span>
                </div>
                <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3">
                  <span className="text-[11px] text-emerald-700 dark:text-emerald-300 font-bold">Résultat estimé</span>
                  <p className="text-base font-extrabold text-emerald-600 mt-1">86 k$</p>
                  <span className="text-[10px] text-emerald-600 font-bold">7,3 %</span>
                </div>
              </div>
            </div>

            {/* Facteurs observés */}
            <div className="border-t border-border/60 pt-5">
              <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3">
                Facteurs observés : pourquoi la marge a varié ?
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-3.5">
                  <span className="text-xs font-bold text-emerald-700 dark:text-emerald-400">Effet volume</span>
                  <p className="text-lg font-black text-foreground mt-1">+14 200 $</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">+11,3 % de commandes supplémentaires.</p>
                </div>
                <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-3.5">
                  <span className="text-xs font-bold text-emerald-700 dark:text-emerald-400">Effet prix</span>
                  <p className="text-lg font-black text-foreground mt-1">+6 100 $</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">Ajustements ciblés sur les accessoires.</p>
                </div>
                <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-3.5">
                  <span className="text-xs font-bold text-red-700 dark:text-red-400">Effet mix produit</span>
                  <p className="text-lg font-black text-foreground mt-1">-8 400 $</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">Part accrue d'articles d'entrée de gamme.</p>
                </div>
                <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-3.5">
                  <span className="text-xs font-bold text-red-700 dark:text-red-400">Effet coût d'achat</span>
                  <p className="text-lg font-black text-foreground mt-1">-33 200 $</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">Renchérissement direct des approvisionnements.</p>
                </div>
              </div>
            </div>
          </section>
        )}

        {/* PAGE 5 : VOTRE TRÉSORERIE */}
        {(displayMode === "continuous" || activeTab === "treasury") && (
          <section className="rounded-2xl border border-border bg-card p-6 sm:p-8 shadow-sm space-y-6">
            <div className="flex items-center justify-between border-b border-border/60 pb-4">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-primary">Page 05</span>
                <h2 className="text-xl font-bold text-foreground">Votre trésorerie</h2>
              </div>
              <Badge variant="outline" className="text-xs">Flux et tendances</Badge>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="rounded-2xl border border-border bg-muted/20 p-5 flex flex-col justify-between">
                <div>
                  <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Solde disponible</span>
                  <p className="text-3xl font-black text-foreground mt-2">182 400 $</p>
                  <p className="text-xs text-muted-foreground mt-1">vs 188 400 $ à l'ouverture (-3,2 %)</p>
                </div>
                <div className="mt-6 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4">
                  <span className="text-xs font-bold text-emerald-700 dark:text-emerald-300">Indicateur de réserve</span>
                  <p className="text-xl font-extrabold text-foreground mt-1">42 jours d'exploitation</p>
                  <p className="text-[11px] text-muted-foreground mt-1">Niveau supérieur au seuil prudentiel de 30 jours.</p>
                </div>
              </div>

              <div className="rounded-2xl border border-border bg-card p-5 space-y-4">
                <div>
                  <span className="text-xs font-bold uppercase tracking-wider text-emerald-600">Entrées du mois (+1 192 k$)</span>
                  <div className="mt-2 space-y-1.5 text-xs">
                    <div className="flex justify-between"><span className="text-muted-foreground">Encaissements des ventes</span><span>1 142 000 $</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">Règlements professionnels</span><span>46 000 $</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">Autres encaissements</span><span>4 000 $</span></div>
                  </div>
                </div>
                <div className="border-t border-border/50 pt-3">
                  <span className="text-xs font-bold uppercase tracking-wider text-red-600">Sorties du mois (-1 198 k$)</span>
                  <div className="mt-2 space-y-1.5 text-xs">
                    <div className="flex justify-between"><span className="text-muted-foreground">Fournisseurs et approvisionnements</span><span>814 000 $</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">Masse salariale</span><span>228 000 $</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">Loyers et charges fixes</span><span>118 000 $</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">Marketing et communication</span><span>38 000 $</span></div>
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-border bg-card p-5 space-y-4">
                <span className="text-xs font-bold uppercase tracking-wider text-primary">Projections de trésorerie</span>
                <div className="space-y-3">
                  <div className="rounded-xl border border-border/70 bg-muted/20 p-3">
                    <div className="flex justify-between text-xs">
                      <span className="font-bold text-foreground">Projection à 30 jours</span>
                      <strong className="text-foreground">168 000 $</strong>
                    </div>
                    <p className="text-[11px] text-muted-foreground mt-1">Prise en compte des charges récurrentes connues.</p>
                  </div>
                  <div className="rounded-xl border border-border/70 bg-muted/20 p-3">
                    <div className="flex justify-between text-xs">
                      <span className="font-bold text-foreground">Projection à 60 jours</span>
                      <strong className="text-foreground">154 000 $</strong>
                    </div>
                    <p className="text-[11px] text-muted-foreground mt-1">Hypothèse : réassorts saisonniers complémentaires.</p>
                  </div>
                </div>
              </div>
            </div>
          </section>
        )}

        {/* PAGE 6 : VOS CLIENTS */}
        {(displayMode === "continuous" || activeTab === "sales") && (
          <section className="rounded-2xl border border-border bg-card p-6 sm:p-8 shadow-sm space-y-6">
            <div className="flex items-center justify-between border-b border-border/60 pb-4">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-primary">Page 06</span>
                <h2 className="text-xl font-bold text-foreground">Vos clients et canaux de vente</h2>
              </div>
              <Badge variant="outline" className="text-xs">Répartition</Badge>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="rounded-xl border border-border bg-card p-5 space-y-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Répartition du chiffre d'affaires par canal
                </h3>
                <div className="space-y-2 text-xs">
                  <div>
                    <div className="flex justify-between font-semibold"><span>Boutique Québec</span><span>510 k$ (43 %)</span></div>
                    <Progress value={43} className="h-2 mt-1" />
                  </div>
                  <div>
                    <div className="flex justify-between font-semibold"><span>En ligne (E-commerce)</span><span>384 k$ (32 %)</span></div>
                    <Progress value={32} className="h-2 mt-1" />
                  </div>
                  <div>
                    <div className="flex justify-between font-semibold"><span>Succursale Lévis</span><span>290 k$ (25 %)</span></div>
                    <Progress value={25} className="h-2 mt-1" />
                  </div>
                </div>
              </div>

              <div className="rounded-xl border border-border bg-card p-5 space-y-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Concentration de la clientèle
                </h3>
                <div className="rounded-xl border border-violet-500/20 bg-violet-500/5 p-4">
                  <p className="text-xs font-bold text-violet-700 dark:text-violet-300">Concentration constatée</p>
                  <p className="text-sm font-semibold text-foreground mt-1">
                    Les 10 % des clients génèrent 58 % du chiffre d'affaires.
                  </p>
                </div>
                <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4 text-xs">
                  <span className="font-bold text-emerald-700 dark:text-emerald-300">Risque de dépendance client : faible</span>
                  <p className="mt-1 text-muted-foreground">Le premier client représente moins de 3,8 % des ventes totales.</p>
                </div>
              </div>
            </div>
          </section>
        )}

        {/* PAGE 7 : OÙ VOTRE STOCK EST-IL IMMOBILISÉ ? */}
        {(displayMode === "continuous" || activeTab === "stock") && (
          <section className="rounded-2xl border border-border bg-card p-6 sm:p-8 shadow-sm space-y-6">
            <div className="flex items-center justify-between border-b border-border/60 pb-4">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-primary">Page 07</span>
                <h2 className="text-xl font-bold text-foreground">Où votre stock est-il immobilisé ?</h2>
              </div>
              <Badge variant="outline" className="text-xs">Rotation et alertes</Badge>
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="rounded-xl border border-border bg-muted/20 p-4">
                <span className="text-xs text-muted-foreground font-semibold">Stock total</span>
                <p className="text-2xl font-black text-foreground mt-1">420 000 $</p>
                <span className="text-[11px] text-amber-600 font-bold">+5,8 % sur 30 jours</span>
              </div>
              <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4">
                <span className="text-xs text-amber-700 dark:text-amber-400 font-semibold">Stock dormant &gt; 60 jours</span>
                <p className="text-2xl font-black text-amber-600 mt-1">64 000 $</p>
                <span className="text-[11px] text-muted-foreground">12 références immobiles</span>
              </div>
              <div className="rounded-xl border border-red-500/30 bg-red-500/5 p-4">
                <span className="text-xs text-red-700 dark:text-red-400 font-semibold">Ruptures constatées</span>
                <p className="text-2xl font-black text-red-600 mt-1">7 références</p>
                <span className="text-[11px] text-red-600 font-bold">Parkas d'hiver</span>
              </div>
              <div className="rounded-xl border border-border bg-muted/20 p-4">
                <span className="text-xs text-muted-foreground font-semibold">Délai de rotation</span>
                <p className="text-2xl font-black text-foreground mt-1">41 jours</p>
                <span className="text-[11px] text-muted-foreground">Cible de gestion : 35 jours</span>
              </div>
            </div>

            <div className="border-t border-border/60 pt-5 space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-foreground">
                Points d'attention opérationnels
              </h3>
              <div className="space-y-2.5">
                <div className="flex items-start gap-3 rounded-xl border border-red-500/20 bg-red-500/5 p-3.5">
                  <span className="text-base">🔴</span>
                  <div>
                    <strong className="text-sm text-foreground">Rupture sur référence clé : Parka Hiver Expédition</strong>
                    <p className="text-xs text-muted-foreground mt-0.5">Manque à gagner estimé à 8 500 $ en raison d'un retard de 12 jours de livraison.</p>
                  </div>
                </div>
                <div className="flex items-start gap-3 rounded-xl border border-amber-500/20 bg-amber-500/5 p-3.5">
                  <span className="text-base">🟠</span>
                  <div>
                    <strong className="text-sm text-foreground">Stock immobilisé sur la famille Matériel de camping</strong>
                    <p className="text-xs text-muted-foreground mt-0.5">64 000 $ d'actifs sans rotation depuis la fin août ; opération de déstockage requise.</p>
                  </div>
                </div>
                <div className="flex items-start gap-3 rounded-xl border border-yellow-500/20 bg-yellow-500/5 p-3.5">
                  <span className="text-base">🟡</span>
                  <div>
                    <strong className="text-sm text-foreground">Délai d'approvisionnement en hausse (+6 jours)</strong>
                    <p className="text-xs text-muted-foreground mt-0.5">Le délai moyen passe de 14 à 20 jours sur les équipements techniques.</p>
                  </div>
                </div>
              </div>
            </div>
          </section>
        )}

        {/* PAGE 8 : ANALYSE DES FLUX TRANSVERSAUX */}
        {(displayMode === "continuous" || activeTab === "transversal") && (
          <section className="rounded-2xl border border-primary/30 bg-gradient-to-br from-primary/5 via-card to-card p-6 sm:p-8 shadow-sm space-y-6">
            <div className="flex items-center justify-between border-b border-border/60 pb-4">
              <div>
                <span className="text-xs font-black uppercase tracking-widest text-primary">Page 08 • Signature GESCOP</span>
                <h2 className="text-xl font-extrabold text-foreground">Ce que les flux révèlent</h2>
              </div>
              <Badge className="bg-primary text-primary-foreground text-xs">Analyse causale</Badge>
            </div>

            <p className="text-sm text-muted-foreground">
              Traçabilité des effets entre activité commerciale, réassorts de stock et décaissements de trésorerie.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 pt-2">
              {transversalFlow.steps.map((st, idx) => (
                <div key={st.step} className="relative rounded-2xl border border-border bg-card p-5 shadow-xs">
                  <div className="flex items-center justify-between">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-xs font-black text-primary">
                      {st.step}
                    </span>
                    <span className="text-xs font-bold text-primary">{st.metric}</span>
                  </div>
                  <h4 className="mt-3 text-sm font-bold text-foreground">{st.title}</h4>
                  <p className="mt-1 text-xs text-muted-foreground leading-relaxed">{st.detail}</p>
                  {idx < transversalFlow.steps.length - 1 && (
                    <div className="hidden md:block absolute -right-3 top-1/2 -translate-y-1/2 z-10 rounded-full bg-border p-1">
                      <ArrowRight className="h-3 w-3 text-muted-foreground" />
                    </div>
                  )}
                </div>
              ))}
            </div>

            <div className="rounded-xl border border-primary/20 bg-primary/10 p-5">
              <h4 className="text-xs font-bold uppercase tracking-wider text-primary">
                Enchaînement observé
              </h4>
              <p className="mt-1.5 text-sm font-medium leading-relaxed text-foreground">
                {transversalFlow.narrative}
              </p>
            </div>
          </section>
        )}

        {/* PAGE 9 : FACTEURS OBSERVÉS & INSIGHTS */}
        {(displayMode === "continuous" || activeTab === "intelligence") && (
          <section className="rounded-2xl border border-border bg-card p-6 sm:p-8 shadow-sm space-y-6">
            <div className="flex items-center justify-between border-b border-border/60 pb-4">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-primary">Page 09</span>
                <h2 className="text-xl font-bold text-foreground">Facteurs observés et insights qualifiés</h2>
              </div>
              <Badge variant="outline" className="text-xs">Confiance analytique</Badge>
            </div>

            <div className="space-y-4">
              {intelligenceInsights.map((ins, idx) => {
                const badgeColor =
                  ins.confidence >= 90
                    ? "bg-emerald-500/10 text-emerald-700 border-emerald-300 dark:border-emerald-800"
                    : ins.confidence >= 70
                    ? "bg-blue-500/10 text-blue-700 border-blue-300 dark:border-blue-800"
                    : "bg-amber-500/10 text-amber-700 border-amber-300 dark:border-amber-800";

                return (
                  <div key={idx} className="rounded-2xl border border-border/80 bg-muted/15 p-5 transition-all hover:bg-muted/25">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className={`inline-flex items-center rounded-md border px-2.5 py-0.5 text-xs font-extrabold tracking-wider ${badgeColor}`}>
                          {ins.level} · {ins.confidence} %
                        </span>
                        <h4 className="text-sm font-bold text-foreground">{ins.title}</h4>
                      </div>
                      <span className="text-xs text-muted-foreground">
                        Sources vérifiées : {ins.sources.join(" • ")}
                      </span>
                    </div>
                    <div className="mt-3 space-y-1.5 text-xs text-foreground/90">
                      <p><strong className="text-foreground">Facteur observé :</strong> {ins.observation}</p>
                      <p><strong className="text-foreground">À examiner :</strong> {ins.toExamine}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* PAGE 10 : SIMULATEUR DE SCÉNARIOS */}
        {(displayMode === "continuous" || activeTab === "scenarios") && (
          <section className="rounded-2xl border border-border bg-card p-6 sm:p-8 shadow-sm space-y-6">
            <div className="flex items-center justify-between border-b border-border/60 pb-4">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-primary">Page 10</span>
                <h2 className="text-xl font-bold text-foreground">Simulation de scénarios ("Et si...")</h2>
              </div>
              <Badge variant="outline" className="text-xs">Modélisation</Badge>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              {scenarios.map((sc) => (
                <div key={sc.id} className="rounded-2xl border border-border bg-card p-5 shadow-xs flex flex-col justify-between">
                  <div>
                    <span className="text-xs font-bold text-primary uppercase">Scénario</span>
                    <h4 className="mt-1 text-base font-bold text-foreground">{sc.name}</h4>
                    <p className="mt-1.5 text-xs text-muted-foreground leading-relaxed">{sc.hypothesis}</p>
                    <div className="mt-4 space-y-1.5 rounded-xl bg-muted/30 p-3 text-xs">
                      <div className="flex justify-between"><span>Impact CA</span><strong className="text-foreground">{sc.impactCa}</strong></div>
                      <div className="flex justify-between"><span>Impact Marge</span><strong className="text-foreground">{sc.impactMarge}</strong></div>
                      <div className="flex justify-between"><span>Impact Trésorerie</span><strong className="text-foreground">{sc.impactCash}</strong></div>
                    </div>
                  </div>
                  <p className="mt-4 text-xs font-medium text-foreground border-t border-border/50 pt-3">
                    {sc.summary}
                  </p>
                </div>
              ))}
            </div>

            {/* Simulateur interactif */}
            <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-6 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <h4 className="text-sm font-bold text-foreground">Simuler un ajustement tarifaire</h4>
                  <p className="text-xs text-muted-foreground">Évaluez l'impact d'une variation de prix sur le chiffre d'affaires et la marge brute</p>
                </div>
                <span className="text-lg font-black text-emerald-600">
                  +{customPriceIncrease} % sur les prix catalogue
                </span>
              </div>
              <input
                type="range"
                min="0"
                max="10"
                step="0.5"
                value={customPriceIncrease}
                onChange={(e) => setCustomPriceIncrease(parseFloat(e.target.value))}
                className="w-full accent-emerald-600 cursor-pointer"
              />
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pt-2">
                <div className="rounded-xl border border-border/60 bg-card p-3 text-center">
                  <span className="text-[11px] text-muted-foreground">Gain de marge estimé</span>
                  <p className="text-base font-extrabold text-emerald-600 mt-1">+{simMargeGain.toLocaleString()} $</p>
                </div>
                <div className="rounded-xl border border-border/60 bg-card p-3 text-center">
                  <span className="text-[11px] text-muted-foreground">Trésorerie nette générée</span>
                  <p className="text-base font-extrabold text-foreground mt-1">+{simCashGain.toLocaleString()} $</p>
                </div>
                <div className="col-span-2 sm:col-span-1 rounded-xl border border-border/60 bg-card p-3 text-center">
                  <span className="text-[11px] text-muted-foreground">Élasticité estimée</span>
                  <p className="text-base font-extrabold text-amber-600 mt-1">&lt; 1,2 % de volume</p>
                </div>
              </div>
            </div>
          </section>
        )}

        {/* PAGE 11 : PLAN D'ACTION RECOMMANDÉ */}
        {(displayMode === "continuous" || activeTab === "actions") && (
          <section className="rounded-2xl border border-border bg-card p-6 sm:p-8 shadow-sm space-y-6">
            <div className="flex items-center justify-between border-b border-border/60 pb-4">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-primary">Page 11</span>
                <h2 className="text-xl font-bold text-foreground">Plan d'action recommandé</h2>
              </div>
              <Badge variant="outline" className="text-xs">Suivi des actions</Badge>
            </div>

            <div className="overflow-x-auto rounded-xl border border-border">
              <table className="w-full min-w-[760px] text-left text-xs">
                <thead className="bg-muted/60 text-muted-foreground font-semibold uppercase tracking-wider">
                  <tr>
                    <th className="px-4 py-3">#</th>
                    <th className="px-4 py-3">Priorité</th>
                    <th className="px-4 py-3">Point identifié</th>
                    <th className="px-4 py-3">Action recommandée</th>
                    <th className="px-4 py-3">Responsable</th>
                    <th className="px-4 py-3">Échéance</th>
                    <th className="px-4 py-3">Impact attendu</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {actionPlan.map((act) => (
                    <tr key={act.id} className="hover:bg-muted/20 transition-colors">
                      <td className="px-4 py-3 font-bold text-foreground">#{act.id}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center rounded-md border px-2 py-0.5 text-[10px] font-bold ${act.priorityColor}`}>
                          {act.priority}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-medium text-foreground max-w-[200px]">{act.problem}</td>
                      <td className="px-4 py-3 text-muted-foreground max-w-[220px]">{act.action}</td>
                      <td className="px-4 py-3 font-medium text-foreground">{act.owner}</td>
                      <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">{act.deadline}</td>
                      <td className="px-4 py-3 font-bold text-emerald-600 whitespace-nowrap">{act.impact}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {/* PAGE 12 : QUALITÉ ET FIABILITÉ DES DONNÉES */}
        {(displayMode === "continuous" || activeTab === "reliability") && (
          <section className="rounded-2xl border border-border bg-card p-6 sm:p-8 shadow-sm space-y-6">
            <div className="flex items-center justify-between border-b border-border/60 pb-4">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-primary">Page 12</span>
                <h2 className="text-xl font-bold text-foreground">Qualité et traçabilité des données</h2>
              </div>
              <Badge variant="outline" className="text-xs">Audit des sources</Badge>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="rounded-xl border border-border bg-muted/20 p-4">
                <span className="text-xs text-muted-foreground font-semibold">Fiabilité globale</span>
                <p className="text-2xl font-black text-emerald-600 mt-1">92 %</p>
                <Progress value={92} className="h-2 mt-2" />
              </div>
              <div className="rounded-xl border border-border bg-muted/20 p-4">
                <span className="text-xs text-muted-foreground font-semibold">Sources connectées</span>
                <p className="text-2xl font-black text-foreground mt-1">6 sources</p>
                <span className="text-[11px] text-muted-foreground">ERP, caisse, banque, paie...</span>
              </div>
              <div className="rounded-xl border border-border bg-muted/20 p-4">
                <span className="text-xs text-muted-foreground font-semibold">Taux de complétude</span>
                <p className="text-2xl font-black text-foreground mt-1">96,8 %</p>
                <span className="text-[11px] text-muted-foreground">0 champ critique manquant</span>
              </div>
              <div className="rounded-xl border border-border bg-muted/20 p-4">
                <span className="text-xs text-muted-foreground font-semibold">Anomalies neutralisées</span>
                <p className="text-2xl font-black text-foreground mt-1">4 écarts</p>
                <span className="text-[11px] text-emerald-600 font-bold">Doublons exclus et tracés</span>
              </div>
            </div>

            <div className="rounded-xl border border-border bg-card p-5 space-y-2">
              <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Périmètre et limites de l'analyse
              </h4>
              <p className="text-xs leading-relaxed text-muted-foreground">
                Les indicateurs présentés reposent sur les données comptables et commerciales validées au 25 septembre 2026. L'évaluation du stock dormant s'appuie sur le relevé d'inventaire physique du 20 septembre 2026. Les projections de trésorerie à 30 et 60 jours sont calculées sur la base des commandes confirmées et des dépenses récurrentes connues.
              </p>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
