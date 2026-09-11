import React, { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import EmptyState from "@/components/EmptyState";
import { useToast } from "@/components/ui/use-toast";
import {
  Upload,
  FileSpreadsheet,
  FileText,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Trash2,
  Download,
  ArrowRight,
} from "lucide-react";
import { Link } from "react-router-dom";
import { useCompany } from "@/hooks/useCompany";
import { AlertTriangle } from "lucide-react";

const acceptedTypes = ".csv,.xlsx,.xls,.tsv,.pdf";

export default function ImportPage() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [uploading, setUploading] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [importResult, setImportResult] = useState(null);
  const [purging, setPurging] = useState(false);
  const { company } = useCompany();

  const { data: imports, isLoading } = useQuery({
    queryKey: ["imports"],
    queryFn: async () => {
      const list = await base44.entities.Import.list("-created_date", 20);
      return list || [];
    },
  });

  const handleFiles = async (fileList) => {
    const files = Array.from(fileList || []);
    if (files.length === 0) return;

    setUploading(true);
    try {
      const uploadedFiles = [];
      for (const file of files) {
        const { file_url } = await base44.integrations.Core.UploadPublicFile({ file });
        uploadedFiles.push({ file_url, file_name: file.name });
      }
      setUploading(false);
      setProcessing(true);
      const res = await base44.functions.invoke("importMultiData", { files: uploadedFiles });
      const data = res.data || res;
      if (data.error) {
        toast({ title: data.error, variant: "destructive" });
      } else {
        setImportResult(data);
        const totalRows = (data.results || []).reduce((s, r) => s + (r.rows || 0), 0);
        const okCount = (data.results || []).filter((r) => r.status === "complete").length;
        toast({
          title: "Import terminé",
          description: `${okCount}/${data.results.length} fichiers traités, ${totalRows} lignes importées`,
        });
        qc.invalidateQueries(["imports"]);
        qc.invalidateQueries(["transactions-summary"]);
      }
    } catch (e) {
      toast({ title: "Erreur: " + (e.response?.data?.error || e.message), variant: "destructive" });
    } finally {
      setUploading(false);
      setProcessing(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Supprimer cet import effacera aussi toutes les transactions associées. Continuer ?")) return;
    try {
      await base44.entities.Transaction.deleteMany({ import_id: id });
      await base44.entities.Import.delete(id);
      qc.invalidateQueries(["imports"]);
      qc.invalidateQueries(["transactions-summary"]);
      toast({ title: "Import et transactions supprimés" });
    } catch (e) {
      toast({ title: "Erreur: " + e.message, variant: "destructive" });
    }
  };

  const handlePurgeAll = async () => {
    if (!window.confirm("Cela supprimera DÉFINITIVEMENT toutes vos transactions, KPI, anomalies, risques, opportunités et recommandations. Continuer ?")) return;
    try {
      setPurging(true);
      await base44.entities.Transaction.deleteMany({});
      await base44.entities.Order.deleteMany({});
      await base44.entities.Customer.deleteMany({});
      await base44.entities.Product.deleteMany({});
      await base44.entities.Inventory.deleteMany({});
      await base44.entities.Supplier.deleteMany({});
      await base44.entities.Purchase.deleteMany({});
      await base44.entities.Campaign.deleteMany({});
      await base44.entities.CampaignDaily.deleteMany({});
      await base44.entities.Employee.deleteMany({});
      await base44.entities.Payroll.deleteMany({});
      await base44.entities.Expense.deleteMany({});
      await base44.entities.Cashflow.deleteMany({});
      await base44.entities.Interaction.deleteMany({});
      await base44.entities.Competitor.deleteMany({});
      await base44.entities.Goal.deleteMany({});
      await base44.entities.Event.deleteMany({});
      await base44.entities.Kpi.deleteMany({});
      await base44.entities.Anomaly.deleteMany({});
      await base44.entities.Risk.deleteMany({});
      await base44.entities.Opportunity.deleteMany({});
      await base44.entities.Recommendation.deleteMany({});
      await base44.entities.Alert.deleteMany({});
      await base44.entities.Task.deleteMany({});
      await base44.entities.Decision.deleteMany({});
      await base44.entities.ExternalSignal.deleteMany({});
      await base44.entities.Report.deleteMany({});
      await base44.entities.AnalysisRun.deleteMany({});
      await base44.entities.Import.deleteMany({});
      if (company) {
        await base44.entities.Company.update(company.id, { health_score: 0, dimension_scores: {}, last_analysis_date: null });
      }
      qc.invalidateQueries();
      toast({ title: "Toutes les données ont été purgées" });
    } catch (e) {
      toast({ title: "Erreur: " + e.message, variant: "destructive" });
    } finally {
      setPurging(false);
    }
  };

  const onDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files.length > 0) handleFiles(e.dataTransfer.files);
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Importer des données</h1>
        <p className="mt-1 text-muted-foreground">
          Téléversez vos fichiers (CSV, Excel, PDF). GESCOP extrait et normalise automatiquement vos transactions.
        </p>
      </div>

      {/* Drop zone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        className={`rounded-2xl border-2 border-dashed p-10 text-center transition-colors ${
          dragOver ? "border-primary bg-primary/5" : "border-border bg-card"
        }`}
      >
        {uploading || processing ? (
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="h-10 w-10 animate-spin text-primary" />
            <p className="text-sm font-medium">
              {uploading ? "Téléversement des fichiers…" : "Extraction et normalisation des données…"}
            </p>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted">
              <Upload className="h-7 w-7 text-muted-foreground" />
            </div>
            <div>
              <p className="font-medium">Glissez vos fichiers ici ou cliquez pour parcourir</p>
              <p className="mt-1 text-sm text-muted-foreground">Multi-fichiers supporté: CSV, XLSX, XLS, TSV, PDF texte</p>
            </div>
            <label>
              <input
                type="file"
                accept={acceptedTypes}
                multiple
                className="hidden"
                onChange={(e) => handleFiles(e.target.files)}
              />
              <span className="inline-flex cursor-pointer items-center rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90">
                Choisir un fichier
              </span>
            </label>
          </div>
        )}
      </div>

      {importResult && (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50/30 p-6">
          <div className="mb-4 flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-emerald-600" />
            <h2 className="font-semibold text-emerald-900">Import multi-fichiers terminé</h2>
          </div>
          <div className="overflow-x-auto rounded-lg border border-emerald-200">
            <table className="w-full min-w-[500px] text-sm">
              <thead className="bg-emerald-100/50 text-left text-xs uppercase text-emerald-900">
                <tr>
                  <th className="px-4 py-2 font-medium">Fichier</th>
                  <th className="px-4 py-2 font-medium">Entité</th>
                  <th className="px-4 py-2 font-medium">Lignes</th>
                  <th className="px-4 py-2 font-medium">Statut</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-emerald-100">
                {(importResult.results || []).map((r, i) => (
                  <tr key={i}>
                    <td className="max-w-[200px] truncate px-4 py-2 font-medium" title={r.file_name}>{r.file_name}</td>
                    <td className="px-4 py-2 text-muted-foreground">{r.entity || "—"}</td>
                    <td className="px-4 py-2">{r.rows || 0}</td>
                    <td className="px-4 py-2">
                      <span className={r.status === "complete" ? "text-emerald-600" : r.status === "ignore" ? "text-muted-foreground" : "text-red-600"}>
                        {r.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-4 flex flex-wrap gap-3">
            <Button asChild><Link to="/">Commencer l'analyse IA <ArrowRight className="ml-1 h-4 w-4" /></Link></Button>
            <Button variant="outline" onClick={() => setImportResult(null)}>Fermer</Button>
          </div>
        </div>
      )}

      {/* Tips */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-border bg-card p-4">
          <FileSpreadsheet className="mb-2 h-5 w-5 text-emerald-600" />
          <p className="text-sm font-medium">Tableurs</p>
          <p className="text-xs text-muted-foreground">Colonnes: date, description, montant, type, catégorie</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <FileText className="mb-2 h-5 w-5 text-red-600" />
          <p className="text-sm font-medium">PDF texte</p>
          <p className="text-xs text-muted-foreground">Relevés bancaires, factures en PDF natif</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <CheckCircle2 className="mb-2 h-5 w-5 text-blue-600" />
          <p className="text-sm font-medium">Normalisation auto</p>
          <p className="text-xs text-muted-foreground">Détection des types, doublons et devises</p>
        </div>
      </div>

      {/* Import history */}
      <div>
        <h2 className="mb-4 text-lg font-semibold">Historique des imports</h2>
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Chargement…</p>
        ) : !imports || imports.length === 0 ? (
          <EmptyState icon={Download} title="Aucun import" description="Vos imports apparaîtront ici." />
        ) : (
          <div className="overflow-x-auto rounded-xl border border-border">
            <table className="w-full min-w-[640px] text-sm">
              <thead className="bg-muted/50 text-left text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 font-medium">Fichier</th>
                  <th className="px-4 py-3 font-medium">Type</th>
                  <th className="px-4 py-3 font-medium">Lignes</th>
                  <th className="px-4 py-3 font-medium">Qualité</th>
                  <th className="px-4 py-3 font-medium">Statut</th>
                  <th className="px-4 py-3 font-medium">Date</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {imports.map((imp) => (
                  <tr key={imp.id} className="hover:bg-muted/30">
                    <td className="max-w-[180px] truncate px-4 py-3 font-medium" title={imp.file_name}>{imp.file_name}</td>
                    <td className="px-4 py-3 uppercase text-muted-foreground">{imp.source_type}</td>
                    <td className="px-4 py-3">{imp.rows_processed || 0}</td>
                    <td className="px-4 py-3">
                      {imp.quality_score != null ? `${imp.quality_score}%` : "—"}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1 text-xs font-medium ${
                        imp.status === "complete" ? "text-emerald-600" : imp.status === "echoue" ? "text-red-600" : "text-amber-600"
                      }`}>
                        {imp.status === "complete" && <CheckCircle2 className="h-3.5 w-3.5" />}
                        {imp.status === "echoue" && <AlertCircle className="h-3.5 w-3.5" />}
                        {imp.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {new Date(imp.created_date).toLocaleDateString("fr-CA")}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-right">
                      <button onClick={() => handleDelete(imp.id)} className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-red-50 hover:text-red-600">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Danger zone */}
      <div className="rounded-xl border border-red-200 bg-red-50/30 p-5">
        <div className="flex items-start gap-3">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-red-600" />
          <div className="flex-1">
            <p className="text-sm font-semibold text-red-900">Purger toutes les données</p>
            <p className="mt-1 text-sm text-red-700">
              Supprime définitivement toutes les transactions, KPI, anomalies, risques, opportunités et recommandations. Utile si des données orphelines subsistent après la suppression des imports.
            </p>
          </div>
          <Button variant="destructive" onClick={handlePurgeAll} disabled={purging}>
            {purging ? "Purge en cours…" : "Tout supprimer"}
          </Button>
        </div>
      </div>

      <div className="rounded-xl bg-blue-50 p-4 text-sm text-blue-900">
        <p className="font-medium">Astuce</p>
        <p className="mt-1 text-blue-700">
          Après l'import, allez au tableau de bord et lancez l'analyse IA pour obtenir votre score de santé,
          vos KPI, vos risques et vos recommandations.{" "}
          <Link to="/" className="font-medium underline">Aller au tableau de bord →</Link>
        </p>
      </div>
    </div>
  );
}