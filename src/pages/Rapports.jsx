import React, { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import EmptyState from "@/components/EmptyState";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import { FileText, Loader2, Calendar, Trash2 } from "lucide-react";
import ReactMarkdown from "react-markdown";

const reportTypes = [
  { key: "quotidien", label: "Rapport quotidien", desc: "État général, performance, risques, actions prioritaires" },
  { key: "hebdomadaire", label: "Rapport hebdomadaire", desc: "Comparaison semaine vs précédente, KPI, tendances" },
  { key: "mensuel", label: "Rapport mensuel", desc: "Analyse approfondie, résumé exécutif automatique" },
];

export default function Rapports() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [generating, setGenerating] = useState(null);
  const [selected, setSelected] = useState(null);

  const { data: reports, isLoading } = useQuery({
    queryKey: ["reports"],
    queryFn: async () => {
      const list = await base44.entities.Report.list("-created_date", 20);
      return list || [];
    },
  });

  const generate = async (type) => {
    setGenerating(type);
    try {
      const res = await base44.functions.invoke("generateReport", { type });
      const data = res.data || res;
      if (data.error) {
        toast({ title: data.error, variant: "destructive" });
      } else {
        toast({ title: "Rapport généré" });
        qc.invalidateQueries(["reports"]);
        setSelected(data.report);
      }
    } catch (e) {
      toast({ title: "Erreur: " + (e.response?.data?.error || e.message), variant: "destructive" });
    } finally {
      setGenerating(null);
    }
  };

  const remove = async (id) => {
    await base44.entities.Report.delete(id);
    qc.invalidateQueries(["reports"]);
    if (selected?.id === id) setSelected(null);
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Rapports</h1>
        <p className="mt-1 text-muted-foreground">Rapports générés automatiquement à partir de vos données.</p>
      </div>

      {/* Generate buttons */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {reportTypes.map((rt) => (
          <div key={rt.key} className="rounded-xl border border-border bg-card p-5">
            <FileText className="mb-3 h-6 w-6 text-primary" />
            <h3 className="font-semibold">{rt.label}</h3>
            <p className="mt-1 text-xs text-muted-foreground">{rt.desc}</p>
            <Button
              size="sm"
              className="mt-4 w-full"
              onClick={() => generate(rt.key)}
              disabled={generating === rt.key}
            >
              {generating === rt.key ? (
                <><Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> Génération…</>
              ) : (
                <><Calendar className="mr-1.5 h-3.5 w-3.5" /> Générer</>
              )}
            </Button>
          </div>
        ))}
      </div>

      {/* Selected report */}
      {selected && (
        <div className="rounded-2xl border border-border bg-card p-6">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold">{selected.period}</h2>
              <p className="text-sm text-muted-foreground">Rapport {selected.type}</p>
            </div>
            <button onClick={() => setSelected(null)} className="text-sm text-muted-foreground hover:text-foreground">
              Fermer
            </button>
          </div>
          {selected.summary && (
            <div className="mb-4 rounded-lg bg-primary/5 p-4">
              <p className="text-xs font-medium text-muted-foreground">Résumé exécutif</p>
              <p className="mt-1 text-sm">{selected.summary}</p>
            </div>
          )}
          <div className="prose prose-sm max-w-none text-sm leading-relaxed">
            <ReactMarkdown>{selected.content || ""}</ReactMarkdown>
          </div>
        </div>
      )}

      {/* History */}
      <div>
        <h2 className="mb-4 text-lg font-semibold">Rapports récents</h2>
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Chargement…</p>
        ) : !reports || reports.length === 0 ? (
          <EmptyState icon={FileText} title="Aucun rapport" description="Générez votre premier rapport ci-dessus." />
        ) : (
          <div className="space-y-2">
            {reports.map((r) => (
              <div key={r.id} className="flex items-center justify-between rounded-xl border border-border bg-card p-4">
                <div className="flex items-center gap-3">
                  <FileText className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium">Rapport {r.type}</p>
                    <p className="text-xs text-muted-foreground">{r.period} · {new Date(r.created_date).toLocaleDateString("fr-CA")}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button size="sm" variant="ghost" onClick={() => setSelected(r)}>Consulter</Button>
                  <button onClick={() => remove(r.id)} className="text-muted-foreground hover:text-red-600">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}