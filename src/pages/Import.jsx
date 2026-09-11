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
} from "lucide-react";
import { Link } from "react-router-dom";

const acceptedTypes = ".csv,.xlsx,.xls,.tsv,.pdf";

export default function ImportPage() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [uploading, setUploading] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  const { data: imports, isLoading } = useQuery({
    queryKey: ["imports"],
    queryFn: async () => {
      const list = await base44.entities.Import.list("-created_date", 20);
      return list || [];
    },
  });

  const handleFile = async (file) => {
    if (!file) return;
    const ext = file.name.split(".").pop().toLowerCase();
    const sourceType = ["csv", "xlsx", "xls", "tsv", "pdf"].includes(ext) ? ext : "csv";

    setUploading(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadPublicFile({ file });
      setUploading(false);
      setProcessing(true);
      const res = await base44.functions.invoke("importData", {
        file_url,
        source_type: sourceType,
        file_name: file.name,
      });
      const data = res.data || res;
      if (data.error) {
        toast({ title: data.error, variant: "destructive" });
      } else {
        toast({
          title: "Import terminé",
          description: `${data.rows_imported} transactions importées (qualité ${data.quality_score}%)`,
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
    try {
      await base44.entities.Import.delete(id);
      qc.invalidateQueries(["imports"]);
      toast({ title: "Import supprimé" });
    } catch (e) {
      toast({ title: "Erreur: " + e.message, variant: "destructive" });
    }
  };

  const onDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
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
              {uploading ? "Téléversement du fichier…" : "Extraction et normalisation des données…"}
            </p>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted">
              <Upload className="h-7 w-7 text-muted-foreground" />
            </div>
            <div>
              <p className="font-medium">Glissez votre fichier ici ou cliquez pour parcourir</p>
              <p className="mt-1 text-sm text-muted-foreground">Formats supportés: CSV, XLSX, XLS, TSV, PDF texte</p>
            </div>
            <label>
              <input
                type="file"
                accept={acceptedTypes}
                className="hidden"
                onChange={(e) => handleFile(e.target.files[0])}
              />
              <span className="inline-flex cursor-pointer items-center rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90">
                Choisir un fichier
              </span>
            </label>
          </div>
        )}
      </div>

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
          <div className="overflow-hidden rounded-xl border border-border">
            <table className="w-full text-sm">
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
                    <td className="px-4 py-3 font-medium">{imp.file_name}</td>
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
                    <td className="px-4 py-3 text-right">
                      <button onClick={() => handleDelete(imp.id)} className="text-muted-foreground hover:text-red-600">
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