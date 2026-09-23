import React, { useState, useMemo } from "react";
import { motion, AnimatePresence } from "@/lib/fake-framer-motion.jsx";
import {
  BarChart, LineChart, Bar, Line, XAxis, YAxis, Tooltip, ResponsiveContainer,
  CartesianGrid, AreaChart, Area, RadialBarChart, RadialBar, PolarAngleAxis,
  Legend, Cell, ReferenceLine,
} from "recharts";
import { TrendingUp, TrendingDown, Wallet, Receipt, Percent } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  AXE_MOIS, AXE_MONTANT, AXE_POURCENT, GRILLE, INFOBULLE, INFOBULLE_LIGNE, LEGENDE, BARRE, LIGNE,
  COULEURS, couleurCategorie, montant, pourcent,
} from "@/lib/graphiques";

const FENETRE = 6;

function SkeletonCard() {
  return (
    <div className="rounded-2xl border border-border bg-card p-6">
      <div className="animate-shimmer h-4 w-32 rounded-md" />
      <div className="mt-4 h-56 w-full rounded-lg animate-shimmer" />
    </div>
  );
}

/**
 * @param {Object} props
 * @param {Object} props.monthlyData  revenue / charges / margin / cash : series { month, val }
 * @param {boolean} [props.isLoading]
 * @param {Array<Object>} props.dimensions
 */
export default function KpiOverview({ monthlyData, isLoading, dimensions }) {
  const [view, setView] = useState("combined");

  // CA et CHARGES TOTALES (cout des ventes + depenses + paie) : la meme base
  // que la marge nette affichee a cote. Les barres montraient les seules
  // depenses, et la marge ne se lisait pas a partir d'elles.
  const combinedData = useMemo(() => {
    const rev = (monthlyData?.revenue || []).slice(-FENETRE);
    const charges = monthlyData?.charges || [];
    const margin = monthlyData?.margin || [];
    return rev.map((r) => ({
      month: r.month,
      revenue: Math.round(r.val),
      charges: Math.round(charges.find((x) => x.month === r.month)?.val ?? 0),
      margin: margin.find((x) => x.month === r.month)?.val ?? null,
    }));
  }, [monthlyData]);

  const cashData = useMemo(() => (monthlyData?.cash || []).slice(-FENETRE).map((d) => ({ month: d.month, cash: Math.round(d.val) })), [monthlyData]);

  const radarData = useMemo(() => {
    const dims = dimensions?.filter((d) => ["finance", "ventes", "tresorerie", "clients", "operations", "marketing"].includes(d.key) && d.measured !== false) || [];
    return dims.map((d, i) => ({ name: d.label, value: d.score || 0, fill: couleurCategorie(i) }));
  }, [dimensions]);

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <SkeletonCard />
        <SkeletonCard />
        <SkeletonCard />
      </div>
    );
  }

  const hasCombined = combinedData.length > 0;
  const hasCash = cashData.length > 0;
  const hasRadar = radarData.length > 0;
  const vide = <div className="flex h-72 items-center justify-center rounded-2xl border border-border bg-card text-sm text-muted-foreground">Données insuffisantes</div>;

  return (
    <div className="space-y-4">
      {/* View toggle */}
      <div className="flex flex-wrap items-center gap-2">
        {[
          { key: "combined", label: "CA vs charges", icon: Receipt },
          { key: "cash", label: "Trésorerie", icon: Wallet },
          { key: "radar", label: "Scores par domaine", icon: Percent },
        ].map((v) => (
          <button
            key={v.key}
            onClick={() => setView(v.key)}
            aria-pressed={view === v.key}
            className={cn(
              "flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-all duration-200",
              view === v.key
                ? "bg-primary text-primary-foreground shadow-sm"
                : "bg-muted text-muted-foreground hover:bg-muted/70"
            )}
          >
            <v.icon className="h-3.5 w-3.5" />
            {v.label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <AnimatePresence mode="wait">
            {view === "combined" && hasCombined && (
              <motion.div key="combined" className="rounded-2xl border border-border bg-card p-6">
                <div className="mb-4 flex items-baseline justify-between gap-2">
                  <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Chiffre d'affaires et charges totales</h3>
                  <span className="text-xs text-muted-foreground">{combinedData.length} derniers mois complets</span>
                </div>
                {/* $ et % ne partagent pas d'échelle : deux panneaux, un axe chacun. */}
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                  <div className="h-56 sm:col-span-2">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={combinedData} margin={{ top: 5, right: 10, bottom: 5, left: 0 }} barGap={2}>
                        <CartesianGrid {...GRILLE} />
                        <XAxis dataKey="month" {...AXE_MOIS} />
                        <YAxis {...AXE_MONTANT} />
                        <Tooltip {...INFOBULLE} formatter={(v, nom) => [montant(v), nom]} />
                        <Legend {...LEGENDE} />
                        <Bar dataKey="revenue" name="Chiffre d'affaires" fill={COULEURS.revenus} {...BARRE} />
                        <Bar dataKey="charges" name="Charges totales" fill={COULEURS.charges} {...BARRE} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="h-56">
                    <p className="mb-1 text-xs font-medium text-muted-foreground">Marge nette</p>
                    <ResponsiveContainer width="100%" height="90%">
                      <LineChart data={combinedData} margin={{ top: 5, right: 10, bottom: 5, left: 0 }}>
                        <CartesianGrid {...GRILLE} />
                        <XAxis dataKey="month" {...AXE_MOIS} />
                        <YAxis {...AXE_POURCENT} />
                        <ReferenceLine y={0} stroke="hsl(var(--muted-foreground))" strokeOpacity={0.5} />
                        <Tooltip {...INFOBULLE_LIGNE} formatter={(v) => [pourcent(v, 0), "Marge nette"]} />
                        <Line dataKey="margin" name="Marge nette" stroke={COULEURS.resultat} {...LIGNE} dot={{ r: 3 }} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </motion.div>
            )}

            {view === "cash" && hasCash && (
              <motion.div key="cash" className="rounded-2xl border border-border bg-card p-6">
                <div className="mb-4 flex items-baseline justify-between">
                  <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Évolution de la trésorerie</h3>
                  <span className="text-xs text-muted-foreground">Solde de fin de mois · {cashData.length} derniers mois</span>
                </div>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={cashData} margin={{ top: 5, right: 10, bottom: 5, left: 0 }}>
                      <CartesianGrid {...GRILLE} />
                      <XAxis dataKey="month" {...AXE_MOIS} />
                      <YAxis {...AXE_MONTANT} />
                      <Tooltip {...INFOBULLE_LIGNE} formatter={(v) => [montant(v), "Trésorerie"]} />
                      <Area dataKey="cash" name="Trésorerie" stroke={COULEURS.tresorerie} fill={COULEURS.tresorerie} fillOpacity={0.12} {...LIGNE} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </motion.div>
            )}

            {view === "radar" && hasRadar && (
              <motion.div key="radar" className="rounded-2xl border border-border bg-card p-6">
                <div className="mb-4 flex items-baseline justify-between">
                  <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Scores par domaine</h3>
                  <span className="text-xs text-muted-foreground">sur 100 · domaines mesurés</span>
                </div>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <RadialBarChart data={radarData} innerRadius="20%" outerRadius="100%" startAngle={90} endAngle={-270}>
                      <PolarAngleAxis type="number" domain={[0, 100]} tick={false} />
                      <RadialBar dataKey="value" background={{ fill: "hsl(var(--muted))" }} cornerRadius={6}>
                        {radarData.map((entry, i) => <Cell key={entry.name} fill={couleurCategorie(i)} />)}
                      </RadialBar>
                      <Tooltip {...INFOBULLE} labelFormatter={() => ""} formatter={(v, _n, p) => [`${v} / 100`, p?.payload?.name]} />
                      <Legend {...LEGENDE} layout="horizontal" verticalAlign="bottom" align="center" />
                    </RadialBarChart>
                  </ResponsiveContainer>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {!hasCombined && view === "combined" && vide}
          {!hasCash && view === "cash" && vide}
          {!hasRadar && view === "radar" && vide}
        </div>

        {/* Side stats */}
        <div className="space-y-4">
          {(() => {
            const dernier = combinedData[combinedData.length - 1];
            const avant = combinedData[combinedData.length - 2];
            const revDelta = dernier && avant?.revenue > 0 ? ((dernier.revenue - avant.revenue) / avant.revenue) * 100 : null;
            const lastCash = cashData[cashData.length - 1]?.cash ?? null;
            const prevCash = cashData[cashData.length - 2]?.cash ?? null;
            const cashDelta = lastCash !== null && prevCash > 0 ? ((lastCash - prevCash) / prevCash) * 100 : null;

            const stats = [
              { label: "Chiffre d'affaires (mois)", value: dernier ? montant(dernier.revenue) : "—", delta: revDelta, icon: TrendingUp },
              { label: "Trésorerie", value: lastCash === null ? "—" : montant(lastCash), delta: cashDelta, icon: Wallet },
              { label: "Marge nette (mois)", value: dernier?.margin == null ? "—" : pourcent(dernier.margin, 0), delta: null, icon: Percent },
            ];

            return stats.map((s) => (
              <motion.div key={s.label} className="rounded-2xl border border-border bg-card p-5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{s.label}</span>
                  <s.icon className="h-4 w-4 text-muted-foreground" />
                </div>
                <p className="mt-2 text-2xl font-bold tracking-tight">{s.value}</p>
                {s.delta !== null && (
                  <div className={cn("mt-1 flex items-center gap-1 text-xs font-medium", s.delta >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400")}>
                    {s.delta >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                    {pourcent(Math.abs(s.delta), 1)} vs mois précédent
                  </div>
                )}
              </motion.div>
            ));
          })()}
        </div>
      </div>
    </div>
  );
}
