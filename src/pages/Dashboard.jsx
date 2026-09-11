import React, { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { useCompany } from "@/hooks/useCompany";
import HealthScoreCard from "@/components/dashboard/HealthScoreCard";
import TodayHighlights from "@/components/dashboard/TodayHighlights";
import PriorityCard from "@/components/dashboard/PriorityCard";
import StatCard from "@/components/StatCard";
import EmptyState from "@/components/EmptyState";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import { Sparkles, RefreshCw, Upload, ArrowRight, Wallet, Receipt, PiggyBank, Check, Loader2 } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";

const analysisSteps = [
  "Vérification des données",
  "Calcul des tendances",
  "Détection des anomalies",
  "Évaluation des risques",
  "Génération des recommandations",
];

const dimLabels = {
  finance: "Finance", ventes: "Ventes", tresorerie: "Trésorerie", clients: "Clients",
  operations: "Opérations", marketing: "Marketing", productivite: "Productivité",
  risques: "Risques", croissance: "Croissance",
};

const formatImpact = (amount) => {
  if (!amount || amount === 0) return null;
  const v = Math.round(Math.abs(amount)).toLocaleString("fr-CA");
  return amount > 0 ? `+${v} $` : `-${v} $`;
};

const statusLine = (score, attentionCount) => {
  const health = score >= 75 ? "globalement saine" : score >= 50 ? "fragile" : "en difficulté";
  if (attentionCount === 0) return `Votre entreprise est ${health}. Rien ne nécessite d'attention particulière aujourd'hui.`;
  return `Votre entreprise est ${health}, mais ${attentionCount} élément${attentionCount > 1 ? "s" : ""} nécessite${attentionCount > 1 ? "nt" : ""} votre attention.`;
};

export default function Dashboard() {
  const { company, isLoading: loadingCompany } = useCompany();
  const { toast } = useToast();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [analyzing, setAnalyzing] = useState(false);
  const [progress, setProgress] = useState(0);

  const { data: transactions } = useQuery({
    queryKey: ["transactions-summary"],
    queryFn: async () => { const l = await base44.entities.Transaction.list("-date", 500); return l || []; },
  });
  const { data: anomalies } = useQuery({
    queryKey: ["anomalies"],
    queryFn: async () => { const l = await base44.entities.Anomaly.list("-created_date", 20); return l || []; },
  });
  const { data: risks } = useQuery({
    queryKey: ["risks-active"],
    queryFn: async () => { const l = await base44.entities.Risk.filter({ status: "actif" }); return l || []; },
  });
  const { data: opportunities } = useQuery({
    queryKey: ["opportunities-new"],
    queryFn: async () => { const l = await base44.entities.Opportunity.filter({ status: "nouvelle" }); return l || []; },
  });
  const { data: recommendations } = useQuery({
    queryKey: ["recommendations"],
    queryFn: async () => { const l = await base44.entities.Recommendation.list("-created_date", 10); return l || []; },
  });

  const handleAnalyze = async () => {
    setAnalyzing(true);
    setProgress(0);
    const interval = setInterval(() => setProgress((p) => Math.min(p + 1, analysisSteps.length - 1)), 2500);
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
      clearInterval(interval);
      setAnalyzing(false);
      setProgress(0);
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
  const hasAnalysis = (anomalies?.length || 0) + (risks?.length || 0) + (opportunities?.length || 0) + (recommendations?.length || 0) > 0;

  const income = (transactions || []).filter((t) => t.type === "income").reduce((s, t) => s + (t.amount || 0), 0);
  const expenses = (transactions || []).filter((t) => t.type === "expense").reduce((s, t) => s + (t.amount || 0), 0);
  const margin = income - expenses;

  const dimScores = company.dimension_scores || {};
  const dimensions = Object.keys(dimLabels).map((key) => ({
    key, label: dimLabels[key],
    ...(dimScores[key] || { score: 0, trend: "stable", explanation: "En attente d'analyse" }),
  }));

  // Build "À retenir aujourd'hui"
  const highlights = [];
  const topAnomaly = (anomalies || []).find((a) => a.severity === "critique") || (anomalies || [])[0];
  if (topAnomaly) {
    highlights.push({
      color: "red", link: "/anomalies",
      title: topAnomaly.title,
      subtitle: topAnomaly.explanation || topAnomaly.description,
      impact: topAnomaly.financial_impact ? `${formatImpact(topAnomaly.financial_impact)}/mois` : (topAnomaly.deviation_pct ? `${topAnomaly.deviation_pct > 0 ? "+" : ""}${Math.round(topAnomaly.deviation_pct)}%` : null),
    });
  }
  const topRisk = (risks || []).sort((a, b) => (b.score || 0) - (a.score || 0))[0];
  if (topRisk) {
    highlights.push({
      color: "orange", link: "/risques",
      title: topRisk.title, subtitle: topRisk.description,
      impact: formatImpact(topRisk.financial_impact),
    });
  }
  const topOpp = (opportunities || []).sort((a, b) => (b.score || 0) - (a.score || 0))[0];
  if (topOpp) {
    highlights.push({
      color: "green", link: "/risques",
      title: topOpp.title, subtitle: topOpp.description,
      impact: formatImpact(topOpp.financial_impact),
    });
  }

  // Build priorities
  const pOrder = { urgente: 0, elevee: 1, moyenne: 2, faible: 3 };
  const priorities = (recommendations || [])
    .filter((r) => r.status === "nouvelle")
    .sort((a, b) => (pOrder[a.priority] || 4) - (pOrder[b.priority] || 4))
    .slice(0, 3);

  const attentionCount = (anomalies || []).filter((a) => a.severity === "critique" || a.severity === "important").length
    + (risks || []).filter((r) => (r.score || 0) >= 70).length;

  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Bonjour" : hour < 18 ? "Bon après-midi" : "Bonsoir";
  const today = new Date().toLocaleDateString("fr-CA", { weekday: "long", day: "numeric", month: "long", year: "numeric" });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{greeting}</h1>
          <p className="mt-0.5 text-sm capitalize text-muted-foreground">{today}</p>
          {hasData && hasAnalysis && (
            <p className="mt-2 max-w-lg text-sm text-muted-foreground">{statusLine(company.health_score || 0, attentionCount)}</p>
          )}
        </div>
        <Button onClick={handleAnalyze} disabled={analyzing || !hasData} className="shrink-0">
          <RefreshCw className={`mr-2 h-4 w-4 ${analyzing ? "animate-spin" : ""}`} />
          {analyzing ? "Analyse en cours…" : "Analyser maintenant"}
        </Button>
      </div>

      {/* Analysis progress */}
      {analyzing && (
        <div className="rounded-2xl border border-border bg-card p-6">
          <div className="space-y-2.5">
            {analysisSteps.map((step, i) => (
              <div key={i} className="flex items-center gap-3 text-sm">
                {i < progress ? <Check className="h-4 w-4 text-emerald-600" />
                  : i === progress ? <Loader2 className="h-4 w-4 animate-spin text-primary" />
                  : <div className="h-4 w-4 rounded-full border-2 border-muted-foreground/20" />}
                <span className={i <= progress ? "text-foreground" : "text-muted-foreground"}>{step}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {!hasData && (
        <EmptyState
          icon={Upload}
          title="Aucune donnée importée"
          description="Importez vos transactions (CSV, Excel ou PDF) pour que GESCOP analyse votre entreprise et produise votre tableau de bord."
          action={<Button asChild><Link to="/importer">Importer des données <ArrowRight className="ml-2 h-4 w-4" /></Link></Button>}
        />
      )}

      {hasData && !hasAnalysis && !analyzing && (
        <EmptyState
          icon={Sparkles}
          title="Lancez votre première analyse"
          description="GESCOP va examiner vos données, détecter les anomalies, évaluer les risques et produire des recommandations actionnables."
          action={<Button onClick={handleAnalyze}><Sparkles className="mr-2 h-4 w-4" /> Analyser maintenant</Button>}
        />
      )}

      {hasData && hasAnalysis && (
        <>
          {/* Score + Financial stats */}
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
            <HealthScoreCard score={company.health_score || 0} dimensions={dimensions} lastAnalysisDate={company.last_analysis_date} />
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 lg:col-span-2">
              <StatCard label="Revenus" value={`${Math.round(income).toLocaleString("fr-CA")} $`} icon={Wallet} accent="bg-emerald-50 text-emerald-600" />
              <StatCard label="Dépenses" value={`${Math.round(expenses).toLocaleString("fr-CA")} $`} icon={Receipt} accent="bg-orange-50 text-orange-600" />
              <StatCard label="Marge brute" value={`${Math.round(margin).toLocaleString("fr-CA")} $`} sublabel={income > 0 ? `${Math.round((margin / income) * 100)}%` : "—"} icon={PiggyBank} accent={margin >= 0 ? "bg-blue-50 text-blue-600" : "bg-red-50 text-red-600"} />
            </div>
          </div>

          {/* À retenir aujourd'hui */}
          <TodayHighlights items={highlights} />

          {/* Vos 3 priorités */}
          <div>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Vos 3 priorités</h2>
              {priorities.length > 0 && (
                <Button variant="ghost" size="sm" asChild>
                  <Link to="/recommandations">Voir tout <ArrowRight className="ml-1 h-3.5 w-3.5" /></Link>
                </Button>
              )}
            </div>
            {priorities.length === 0 ? (
              <p className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
                Aucune recommandation prioritaire. Lancez une analyse pour obtenir des recommandations.
              </p>
            ) : (
              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                {priorities.map((r, i) => (
                  <PriorityCard
                    key={r.id} number={i + 1} title={r.title} action={r.action}
                    impact={formatImpact(r.financial_impact) || r.impact}
                    priority={r.priority} confidencePct={r.confidence_pct || 0}
                    onAct={() => navigate("/recommandations")}
                  />
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}