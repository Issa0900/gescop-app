import React, { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import CheckRow from "@/components/audit/CheckRow";
import QualityCard from "@/components/audit/QualityCard";
import MetricTrace from "@/components/audit/MetricTrace";
import { runCoherenceChecks, runQualityChecks, buildMetricTraces } from "@/lib/dataAudit";
import { fetchAll } from "@/lib/fetchAll";
import { ShieldCheck } from "lucide-react";

// Every source is read with pagination: a single call caps at 500 records and
// a truncated source produces false incoherences.
const sources = {
  transactions: () => fetchAll(base44.entities.Transaction, "-date"),
  orders: () => fetchAll(base44.entities.Order, "-date"),
  customers: () => fetchAll(base44.entities.Customer),
  products: () => fetchAll(base44.entities.Product),
  inventory: () => fetchAll(base44.entities.Inventory, "-date"),
  cashflow: () => fetchAll(base44.entities.Cashflow, "-date"),
  expenses: () => fetchAll(base44.entities.Expense, "-date"),
  payroll: () => fetchAll(base44.entities.Payroll, "-period"),
  employees: () => fetchAll(base44.entities.Employee),
  campaigns: () => fetchAll(base44.entities.Campaign),
  campaignDaily: () => fetchAll(base44.entities.CampaignDaily, "-date"),
};

export default function Audit() {
  const { data, isLoading } = useQuery({
    queryKey: ["audit-data"],
    queryFn: async () => {
      const keys = Object.keys(sources);
      const results = await Promise.all(keys.map((k) => sources[k]()));
      const out = {};
      keys.forEach((k, i) => { out[k] = results[i] || []; });
      return out;
    },
    staleTime: 0,
  });

  const checks = useMemo(() => (data ? runCoherenceChecks(data) : []), [data]);
  const quality = useMemo(() => (data ? runQualityChecks(data) : []), [data]);
  const traces = useMemo(() => (data ? buildMetricTraces(data) : []), [data]);

  if (isLoading) return <p className="text-sm text-muted-foreground">Analyse des données…</p>;

  const errors = checks.filter((c) => c.status === "error").length;
  const warns = checks.filter((c) => c.status === "warn").length
    + quality.filter((q) => q.status === "warn").length;
  const qErrors = quality.filter((q) => q.status === "error").length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Audit des calculs</h1>
        <p className="mt-1 text-muted-foreground">
          Contrôles de cohérence entre vos sources de données, qualité des imports et traçabilité de chaque indicateur.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-card p-4">
        <ShieldCheck className={`h-5 w-5 ${errors + qErrors > 0 ? "text-red-600" : warns > 0 ? "text-amber-600" : "text-emerald-600"}`} />
        <p className="text-sm">
          {errors + qErrors > 0
            ? `${errors + qErrors} incohérence(s) bloquante(s) et ${warns} avertissement(s) détectés.`
            : warns > 0
              ? `Aucune incohérence bloquante · ${warns} point(s) à surveiller.`
              : "Toutes les vérifications passent : vos indicateurs reposent sur des données cohérentes."}
        </p>
      </div>

      <Tabs defaultValue="coherence">
        <TabsList>
          <TabsTrigger value="coherence">Cohérence</TabsTrigger>
          <TabsTrigger value="quality">Qualité des imports</TabsTrigger>
          <TabsTrigger value="trace">Traçabilité</TabsTrigger>
        </TabsList>

        <TabsContent value="coherence" className="mt-4">
          <div className="rounded-xl border border-border bg-card p-5">
            <h2 className="mb-1 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              Recoupements entre sources indépendantes
            </h2>
            <p className="mb-3 text-xs text-muted-foreground">
              Chaque contrôle compare deux chemins de calcul qui devraient donner le même résultat.
            </p>
            {checks.map((c) => <CheckRow key={c.label} check={c} />)}
          </div>
        </TabsContent>

        <TabsContent value="quality" className="mt-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {quality.map((q) => <QualityCard key={q.name} set={q} />)}
          </div>
        </TabsContent>

        <TabsContent value="trace" className="mt-4">
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {traces.map((t) => <MetricTrace key={`${t.domain}-${t.metric}`} trace={t} />)}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}