import React, { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { useCompany } from "@/hooks/useCompany";
import HealthGauge from "@/components/HealthGauge";
import StatCard from "@/components/StatCard";
import PriorityBadge from "@/components/PriorityBadge";
import EmptyState from "@/components/EmptyState";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import {
  TrendingUp,
  TrendingDown,
  Minus,
  AlertTriangle,
  ShieldAlert,
  Sparkles,
  Lightbulb,
  ArrowRight,
  RefreshCw,
  Upload,
  Wallet,
  Receipt,
  PiggyBank,
} from "lucide-react";
import { Link } from "react-router-dom";

const dimensionLabels = {
  finance: "Finance",
  ventes: "Ventes",
  tresorerie: "Trésorerie",
  clients: "Clients",
  operations: "Opérations",
  marketing: "Marketing",
  productivite: "Productivité",
  risques: "Risques",
  croissance: "Croissance",
};

const trendIcon = { up: TrendingUp, down: TrendingDown, stable: Minus };
const trendColor = {
  up: "text-emerald-600",
  down: "text-red-600",
  stable: "text-muted-foreground",
};

export default function Dashboard() {
  const { company, isLoading: loadingCompany } = useCompany();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [analyzing, setAnalyzing] = useState(false);

  const { data: transactions } = useQuery({
    queryKey: ["transactions-summary"],
    queryFn: async () => {
      const list = await base44.entities.Transaction.list("-date", 500);
      return list || [];
    },
  });

  const { data: anomalies } = useQuery({
    queryKey: ["anomalies"],
    queryFn: async () => {
      const list = await base44.entities.Anomaly.list("-created_date", 20);
      return list || [];
    },
  });

  const { data: risks } = useQuery({
    queryKey: ["risks-active"],
    queryFn: async () => {
      const list = await base44.entities.Risk.filter({ status: "actif" });
      return list || [];
    },
  });

  const { data: opportunities } = useQuery({
    queryKey: ["opportunities-new"],
    queryFn: async () => {
      const list = await base44.entities.Opportunity.filter({ status: "nouvelle" });
      return list || [];
    },
  });

  const { data: recommendations } = useQuery({
    queryKey: ["recommendations"],
    queryFn: async () => {
      const list = await base44.entities.Recommendation.list("-created_date", 10);
      return list || [];
    },
  });

  const { data: alerts } = useQuery({
    queryKey: ["alerts-unread"],
    queryFn: async () => {
      const list = await base44.entities.Alert.filter({ status: "non_lue" });
      return list || [];
    },
  });

  const handleAnalyze = async () => {
    setAnalyzing(true);
    try {
      const res = await base44.functions.invoke("analyzeBusiness", {});
      const data = res.data || res;
      if (data.error) {
        toast({ title: data.error, variant: "destructive" });
      } else {
        toast({ title: "Analyse terminée", description: `Score de santé: ${data.health_score}/100` });
        qc.invalidateQueries();
      }
    } catch (e) {
      toast({ title: "Erreur: " + (e.response?.data?.error || e.message), variant: "destructive" });
    } finally {
      setAnalyzing(false);
    }
  };

  if (loadingCompany) {
    return <div className="flex h-96 items-center justify-center"><RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }

  if (!company) {
    return (
      <EmptyState
        icon={Sparkles}
        title="Bienvenue dans GESCOP"
        description="Configurez votre entreprise pour commencer à recevoir des analyses et des recommandations."
        action={<Button asChild><Link to="/onboarding">Configurer mon entreprise <ArrowRight className="ml-2 h-4 w-4" /></Link></Button>}
      />
    );
  }

  const hasData = transactions && transactions.length > 0;
  const income = (transactions || []).filter((t) => t.type === "income").reduce((s, t) => s + (t.amount || 0), 0);
  const expenses = (transactions || []).filter((t) => t.type === "expense").reduce((s, t) => s + (t.amount || 0), 0);
  const margin = income - expenses;

  const dimScores = company.dimension_scores || {};
  const dimensions = Object.keys(dimensionLabels).map((key) => ({
    key,
    label: dimensionLabels[key],
    ...(dimScores[key] || { score: 0, trend: "stable", explanation: "En attente d'analyse" }),
  }));

  const criticalAnomalies = (anomalies || []).filter((a) => a.severity === "critique" || a.severity === "important");
  const topRisks = (risks || []).sort((a, b) => (b.score || 0) - (a.score || 0)).slice(0, 2);
  const topOpps = (opportunities || []).sort((a, b) => (b.score || 0) - (a.score || 0)).slice(0, 2);
  const priorities = (recommendations || [])
    .filter((r) => r.status === "nouvelle")
    .sort((a, b) => {
      const order = { urgente: 0, elevee: 1, moyenne: 2, faible: 3 };
      return (order[a.priority] || 4) - (order[b.priority] || 4);
    })
    .slice(0, 3);

  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Bonjour" : hour < 18 ? "Bon après-midi" : "Bonsoir";

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{greeting}.</h1>
          <p className="mt-1 text-muted-foreground">
            Voici ce qui mérite votre attention aujourd'hui.
          </p>
        </div>
        <Button onClick={handleAnalyze} disabled={analyzing || !hasData}>
          <RefreshCw className={`mr-2 h-4 w-4 ${analyzing ? "animate-spin" : ""}`} />
          {analyzing ? "Analyse en cours…" : "Lancer l'analyse IA"}
        </Button>
      </div>

      {!hasData && (
        <EmptyState
          icon={Upload}
          title="Aucune donnée importée"
          description="Importez vos transactions (CSV, Excel ou PDF) pour que GESCOP analyse votre entreprise et produise votre tableau de bord."
          action={<Button asChild><Link to="/importer">Importer des données <ArrowRight className="ml-2 h-4 w-4" /></Link></Button>}
        />
      )}

      {hasData && (
        <>
          {/* Health score + stats */}
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
            <div className="flex flex-col items-center justify-center rounded-2xl border border-border bg-card p-6">
              <HealthGauge score={company.health_score || 0} size={150} label="Santé de l'entreprise" />
              {company.last_analysis_date && (
                <p className="mt-3 text-xs text-muted-foreground">
                  Dernière analyse: {new Date(company.last_analysis_date).toLocaleDateString("fr-CA")}
                </p>
              )}
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 lg:col-span-2">
              <StatCard label="Revenus" value={`${Math.round(income).toLocaleString("fr-CA")} $`} icon={Wallet} accent="bg-emerald-50 text-emerald-600" />
              <StatCard label="Dépenses" value={`${Math.round(expenses).toLocaleString("fr-CA")} $`} icon={Receipt} accent="bg-orange-50 text-orange-600" />
              <StatCard
                label="Marge brute"
                value={`${Math.round(margin).toLocaleString("fr-CA")} $`}
                sublabel={income > 0 ? `${Math.round((margin / income) * 100)}%` : "—"}
                icon={PiggyBank}
                accent={margin >= 0 ? "bg-blue-50 text-blue-600" : "bg-red-50 text-red-600"}
              />
            </div>
          </div>

          {/* 9 dimensions */}
          <div>
            <h2 className="mb-4 text-lg font-semibold">Neuf dimensions de santé</h2>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
              {dimensions.map((d) => {
                const TIcon = trendIcon[d.trend] || Minus;
                return (
                  <div key={d.key} className="rounded-xl border border-border bg-card p-4">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-muted-foreground">{d.label}</span>
                      <TIcon className={`h-3.5 w-3.5 ${trendColor[d.trend] || ""}`} />
                    </div>
                    <p className="mt-2 text-xl font-bold">{Math.round(d.score || 0)}</p>
                    <p className="mt-1 text-[11px] leading-tight text-muted-foreground line-clamp-2">{d.explanation}</p>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Critical problem */}
          {criticalAnomalies.length > 0 && (
            <div className="rounded-2xl border border-red-200 bg-red-50/40 p-5">
              <div className="mb-3 flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-red-600" />
                <h2 className="font-semibold text-red-900">
                  {criticalAnomalies.length} problème{criticalAnomalies.length > 1 ? "s" : ""} à surveiller
                </h2>
              </div>
              <div className="space-y-2">
                {criticalAnomalies.slice(0, 3).map((a) => (
                  <div key={a.id} className="flex items-start gap-3 rounded-lg bg-card p-3">
                    <PriorityBadge level={a.severity} />
                    <div>
                      <p className="text-sm font-medium">{a.title}</p>
                      {a.explanation && <p className="text-xs text-muted-foreground">{a.explanation}</p>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Risks & Opportunities */}
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
            <div className="rounded-2xl border border-border bg-card p-5">
              <div className="mb-3 flex items-center gap-2">
                <ShieldAlert className="h-5 w-5 text-orange-600" />
                <h2 className="font-semibold">Risques détectés</h2>
              </div>
              {topRisks.length === 0 ? (
                <p className="text-sm text-muted-foreground">Aucun risque actif. Lancez une analyse pour détecter les risques.</p>
              ) : (
                <div className="space-y-2">
                  {topRisks.map((r) => (
                    <div key={r.id} className="flex items-start justify-between gap-3 rounded-lg bg-muted/30 p-3">
                      <div>
                        <p className="text-sm font-medium">{r.title}</p>
                        <p className="text-xs text-muted-foreground line-clamp-2">{r.description}</p>
                      </div>
                      <span className="shrink-0 text-lg font-bold text-orange-600">{r.score || 0}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="rounded-2xl border border-border bg-card p-5">
              <div className="mb-3 flex items-center gap-2">
                <Lightbulb className="h-5 w-5 text-emerald-600" />
                <h2 className="font-semibold">Opportunités</h2>
              </div>
              {topOpps.length === 0 ? (
                <p className="text-sm text-muted-foreground">Aucune opportunité détectée. Lancez une analyse.</p>
              ) : (
                <div className="space-y-2">
                  {topOpps.map((o) => (
                    <div key={o.id} className="flex items-start justify-between gap-3 rounded-lg bg-muted/30 p-3">
                      <div>
                        <p className="text-sm font-medium">{o.title}</p>
                        <p className="text-xs text-muted-foreground line-clamp-2">{o.description}</p>
                      </div>
                      <span className="shrink-0 text-lg font-bold text-emerald-600">{o.score || 0}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Priorities */}
          <div className="rounded-2xl border border-border bg-card p-5">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-semibold">Vos priorités</h2>
              {priorities.length > 0 && (
                <Button variant="ghost" size="sm" asChild>
                  <Link to="/recommandations">Voir tout <ArrowRight className="ml-1 h-3.5 w-3.5" /></Link>
                </Button>
              )}
            </div>
            {priorities.length === 0 ? (
              <p className="text-sm text-muted-foreground">Aucune recommandation prioritaire. Lancez une analyse pour obtenir des recommandations.</p>
            ) : (
              <div className="space-y-2">
                {priorities.map((r, i) => (
                  <div key={r.id} className="flex items-start gap-3 rounded-lg border border-border p-3">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">{i + 1}</span>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium">{r.title}</p>
                        <PriorityBadge level={r.priority} />
                      </div>
                      <p className="mt-0.5 text-xs text-muted-foreground">{r.action}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Closing line */}
          {alerts && alerts.length === 0 && criticalAnomalies.length === 0 && topRisks.length === 0 && (
            <p className="text-center text-sm text-muted-foreground">
              Aucune autre intervention importante n'est nécessaire aujourd'hui.
            </p>
          )}
        </>
      )}
    </div>
  );
}